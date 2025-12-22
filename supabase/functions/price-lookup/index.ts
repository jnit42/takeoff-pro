/**
 * Price Lookup Edge Function
 * Architecture: Global Cache (store_sku_mappings) → Price Book → Knowledge Base
 * 
 * COST-SAVING DESIGN:
 * - Check store_sku_mappings FIRST (global cache, shared across all users)
 * - Only scrape on explicit forceRefresh request
 * - Return status indicators so UI can show verified/stale/unknown
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limits
const MAX_LOOKUPS_PER_DAY = 50;
const MAX_ITEMS_PER_REQUEST = 10;
const CACHE_FRESHNESS_HOURS = 48;

type PriceStatus = 'verified' | 'stale' | 'unknown';

interface PriceResult {
  source: 'global_cache' | 'price_book' | 'knowledge_base' | 'scraped_fresh';
  status: PriceStatus;
  price: number | null;
  unit: string;
  productName: string;
  confidence: number;
  matchType: 'sku' | 'strict' | 'fuzzy' | 'none';
  note?: string;
  productUrl?: string;
  sku?: string;
  store?: string;
  inStock?: boolean;
  lastUpdated?: string;
  catalogId?: string;
  mappingId?: string;
}

interface PriceLookupRequest {
  items: string[];
  projectId?: string;
  zipCode?: string;
  stores?: string[];
  forceRefresh?: boolean;
}

// ========================================
// AUTHENTICATION
// ========================================

async function authenticateRequest(req: Request): Promise<{ authenticated: boolean; userId: string | null; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return { authenticated: false, userId: null, error: 'Missing Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { authenticated: false, userId: null, error: error?.message || 'Invalid token' };
  }

  return { authenticated: true, userId: user.id };
}

// ========================================
// RATE LIMITING
// ========================================

async function checkAndUpdateRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const today = new Date().toISOString().split('T')[0];
  
  const { data: existing } = await supabase
    .from('user_lookup_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('lookup_date', today)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingRow = existing as any;

  if (existingRow) {
    if (existingRow.lookup_count >= MAX_LOOKUPS_PER_DAY) {
      return { 
        allowed: false, 
        remaining: 0, 
        error: `Daily lookup limit (${MAX_LOOKUPS_PER_DAY}) reached. Resets at midnight.` 
      };
    }
    
    await supabase
      .from('user_lookup_limits')
      .update({ 
        lookup_count: existingRow.lookup_count + 1,
        last_lookup_at: new Date().toISOString()
      } as never)
      .eq('id', existingRow.id);
    
    return { allowed: true, remaining: MAX_LOOKUPS_PER_DAY - existingRow.lookup_count - 1 };
  }

  await supabase
    .from('user_lookup_limits')
    .insert({
      user_id: userId,
      lookup_date: today,
      lookup_count: 1,
      last_lookup_at: new Date().toISOString()
    } as never);

  return { allowed: true, remaining: MAX_LOOKUPS_PER_DAY - 1 };
}

// ========================================
// PRODUCT MATCHING & NORMALIZATION
// ========================================

function normalizeSearchTerm(item: string): string {
  return item.toLowerCase()
    .replace(/\d+\s*(sf|lf|ea|pcs?|pieces?|sheets?|boxes?|ft|in|inch|inches)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProductSpecs(item: string): { 
  size?: string; 
  thickness?: string; 
  type?: string; 
  brand?: string;
  dimensions?: string;
} {
  const specs: { size?: string; thickness?: string; type?: string; brand?: string; dimensions?: string } = {};
  
  const dimMatch = item.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (dimMatch) {
    specs.dimensions = `${dimMatch[1]}x${dimMatch[2]}`;
  }
  
  const thickMatch = item.match(/(\d+\/\d+|\d+\.?\d*)\s*["']?/);
  if (thickMatch) {
    specs.thickness = thickMatch[1];
  }
  
  const typePatterns = [
    'standard', 'type x', 'fire-rated', 'moisture resistant', 'mold resistant',
    'exterior', 'interior', 'treated', 'pressure treated', 'pt', 'cdx', 'osb', 'plywood'
  ];
  for (const tp of typePatterns) {
    if (item.toLowerCase().includes(tp)) {
      specs.type = tp;
      break;
    }
  }
  
  return specs;
}

function calculateMatchConfidence(searchTerm: string, productName: string, specs: Record<string, string | undefined>): number {
  const normalizedSearch = normalizeSearchTerm(searchTerm);
  const normalizedProduct = normalizeSearchTerm(productName);
  
  let confidence = 0;
  
  if (normalizedSearch === normalizedProduct) return 1.0;
  if (normalizedProduct.includes(normalizedSearch)) confidence += 0.5;
  
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
  const productWords = normalizedProduct.split(' ');
  const matchedWords = searchWords.filter(w => productWords.some(pw => pw.includes(w)));
  confidence += (matchedWords.length / Math.max(searchWords.length, 1)) * 0.3;
  
  if (specs.dimensions && normalizedProduct.includes(specs.dimensions.toLowerCase())) confidence += 0.1;
  if (specs.thickness && normalizedProduct.includes(specs.thickness)) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

// ========================================
// CHECK CACHE FRESHNESS
// ========================================

function isCacheFresh(lastPriceAt: string | null): boolean {
  if (!lastPriceAt) return false;
  
  const cacheTime = new Date(lastPriceAt).getTime();
  const now = Date.now();
  const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);
  
  return hoursDiff < CACHE_FRESHNESS_HOURS;
}

function getCacheStatus(lastPriceAt: string | null): PriceStatus {
  if (!lastPriceAt) return 'unknown';
  return isCacheFresh(lastPriceAt) ? 'verified' : 'stale';
}

// ========================================
// SCRAPING WITH FIRECRAWL (Only on forceRefresh)
// ========================================

// ========================================
// FAILURE LOGGING
// ========================================

async function logScrapeFailure(
  userId: string | null,
  store: string,
  searchTerm: string,
  zipCode: string,
  errorType: string,
  errorMessage: string,
  httpStatus: number | null,
  responsePreview: string | null,
  searchUrl: string,
  durationMs: number
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('scrape_failures').insert({
      user_id: userId,
      store,
      search_term: searchTerm,
      zip_code: zipCode,
      error_type: errorType,
      error_message: errorMessage,
      http_status: httpStatus,
      response_preview: responsePreview?.slice(0, 500),
      search_url: searchUrl,
      duration_ms: durationMs,
    } as never);
    
    console.log(`[price-lookup] Logged failure: ${errorType} for ${store}`);
  } catch (err) {
    console.error('[price-lookup] Failed to log failure:', err);
  }
}

// ========================================
// BUILD PRODUCT URL
// ========================================

function buildProductUrl(store: string, sku: string | null, productName: string): string | null {
  // Only build URL if we have a valid SKU (not placeholder numbers)
  if (!sku || sku === '123456' || !/^[A-Za-z0-9-]+$/.test(sku) || sku.length < 5) {
    // Return search URL as fallback
    const encodedName = encodeURIComponent(productName);
    if (store.toLowerCase() === 'home depot') {
      return `https://www.homedepot.com/s/${encodedName}`;
    } else if (store.toLowerCase() === "lowe's" || store.toLowerCase() === 'lowes') {
      return `https://www.lowes.com/search?searchTerm=${encodedName}`;
    }
    return null;
  }
  
  const cleanName = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').slice(0, 60);
  
  if (store.toLowerCase() === 'home depot') {
    return `https://www.homedepot.com/p/${cleanName}/${sku}`;
  } else if (store.toLowerCase() === "lowe's" || store.toLowerCase() === 'lowes') {
    return `https://www.lowes.com/pd/${cleanName}/${sku}`;
  }
  
  return null;
}

async function scrapeStorePrices(
  item: string,
  zipCode: string,
  stores: string[],
  userId: string | null
): Promise<Array<{
  store: string;
  productName: string;
  price: number | null;
  unit: string;
  sku: string | null;
  productUrl: string | null;
  inStock: boolean;
  rawData: Record<string, unknown>;
}>> {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (!firecrawlKey) {
    console.log('[price-lookup] No Firecrawl API key configured');
    return [];
  }

  const results: Array<{
    store: string;
    productName: string;
    price: number | null;
    unit: string;
    sku: string | null;
    productUrl: string | null;
    inStock: boolean;
    rawData: Record<string, unknown>;
  }> = [];

  const normalizedItem = normalizeSearchTerm(item);
  const specs = extractProductSpecs(item);

  for (const store of stores.slice(0, 2)) {
    const startTime = Date.now();
    let searchUrl = '';
    
    try {
      if (store.toLowerCase() === 'home depot') {
        // Updated HD URL format - use their search API format
        searchUrl = `https://www.homedepot.com/s/${encodeURIComponent(normalizedItem)}?NCNI-5&storeId=121&zipCode=${zipCode}`;
      } else if (store.toLowerCase() === "lowe's" || store.toLowerCase() === 'lowes') {
        searchUrl = `https://www.lowes.com/search?searchTerm=${encodeURIComponent(normalizedItem)}&zipCode=${zipCode}`;
      } else {
        continue;
      }

      console.log(`[price-lookup] Scraping ${store} for: ${normalizedItem} (URL: ${searchUrl})`);

      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: searchUrl,
          formats: ['extract'],
          extract: {
            schema: {
              type: 'object',
              properties: {
                products: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Full product name' },
                      price: { type: 'number', description: 'Price in dollars as a number (e.g., 5.98 not "$5.98")' },
                      unit: { type: 'string', description: 'Unit of measure like "each", "per piece", "per sq ft"' },
                      sku: { type: 'string', description: 'Product SKU or item number' },
                      productUrl: { type: 'string', description: 'Full URL to the product page' },
                      inStock: { type: 'boolean', description: 'Whether the item is in stock' },
                      brand: { type: 'string', description: 'Brand name' },
                    },
                    required: ['name', 'price']
                  },
                  maxItems: 5
                }
              },
              required: ['products']
            },
            prompt: `Extract the first 5 product search results from this ${store} page. For each product:
- name: the full product name including dimensions
- price: just the number (e.g., 5.98)
- sku: the item number or SKU (look for "Item #" or "Model #")
- productUrl: the FULL URL to view that specific product (starts with https://)
- inStock: true if available, false if out of stock

Search term: ${item}`
          },
          waitFor: 3000,
          timeout: 20000,
        }),
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[price-lookup] Firecrawl error for ${store}:`, response.status, errorText);
        
        await logScrapeFailure(
          userId,
          store,
          normalizedItem,
          zipCode,
          'http_error',
          `HTTP ${response.status}: ${errorText}`,
          response.status,
          errorText,
          searchUrl,
          durationMs
        );
        continue;
      }

      const data = await response.json();
      
      if (!data.success) {
        console.error(`[price-lookup] Firecrawl returned failure for ${store}:`, data.error);
        
        await logScrapeFailure(
          userId,
          store,
          normalizedItem,
          zipCode,
          'api_failure',
          data.error || 'Unknown API error',
          null,
          JSON.stringify(data).slice(0, 500),
          searchUrl,
          durationMs
        );
        continue;
      }
      
      if (data.data?.extract?.products && data.data.extract.products.length > 0) {
        console.log(`[price-lookup] ${store} returned ${data.data.extract.products.length} products`);
        
        for (const product of data.data.extract.products.slice(0, 3)) {
          const confidence = calculateMatchConfidence(item, product.name, specs);
          
          if (confidence >= 0.4) {
            // Build proper product URL - prefer extracted URL, fallback to constructed
            let productUrl = product.productUrl || product.url || null;
            if (!productUrl || !productUrl.startsWith('http')) {
              productUrl = buildProductUrl(store, product.sku, product.name);
            }
            
            results.push({
              store,
              productName: product.name,
              price: product.price || null,
              unit: product.unit || 'EA',
              sku: product.sku || null,
              productUrl,
              inStock: product.inStock !== false,
              rawData: { ...product, searchUrl, confidence, specs },
            });
          }
        }
      } else {
        console.log(`[price-lookup] ${store} returned no products`);
        
        await logScrapeFailure(
          userId,
          store,
          normalizedItem,
          zipCode,
          'no_results',
          'Scrape succeeded but no products extracted',
          null,
          JSON.stringify(data.data?.extract || {}).slice(0, 500),
          searchUrl,
          durationMs
        );
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[price-lookup] Error scraping ${store}:`, error);
      
      await logScrapeFailure(
        userId,
        store,
        normalizedItem,
        zipCode,
        'exception',
        errorMessage,
        null,
        null,
        searchUrl,
        durationMs
      );
    }
  }

  return results;
}

// ========================================
// CATALOG LEARNING - Update Global Cache
// ========================================

async function updateGlobalCache(
  searchTerm: string,
  scrapedProduct: {
    store: string;
    productName: string;
    price: number | null;
    sku: string | null;
    productUrl: string | null;
    rawData: Record<string, unknown>;
  }
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const normalizedKey = normalizeSearchTerm(scrapedProduct.productName)
      .replace(/\s+/g, '_')
      .toUpperCase()
      .slice(0, 50);

    // Check if product already in catalog
    const { data: existing } = await supabase
      .from('product_catalog')
      .select('id, usage_count')
      .eq('canonical_key', normalizedKey)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingRow = existing as any;
    let catalogId: string;

    if (existingRow) {
      catalogId = existingRow.id;
      
      // Update usage count
      await supabase
        .from('product_catalog')
        .update({ usage_count: (existingRow.usage_count || 0) + 1 } as never)
        .eq('id', catalogId);
    } else {
      // Create new catalog entry
      const categoryPatterns: Record<string, string[]> = {
        'Drywall': ['drywall', 'sheetrock', 'gypsum'],
        'Lumber': ['2x4', '2x6', '2x8', '2x10', '2x12', 'stud', 'lumber', 'board'],
        'Plywood': ['plywood', 'osb', 'cdx', 'sheathing'],
        'Insulation': ['insulation', 'r-', 'fiberglass', 'foam'],
        'Electrical': ['wire', 'outlet', 'switch', 'breaker', 'electrical'],
        'Plumbing': ['pipe', 'pvc', 'copper', 'fitting', 'valve'],
        'Concrete': ['concrete', 'cement', 'mortar', 'grout'],
        'Roofing': ['shingle', 'roofing', 'underlayment', 'flashing'],
        'Hardware': ['screw', 'nail', 'bolt', 'anchor', 'hanger'],
      };

      let category = 'General';
      const lowerName = scrapedProduct.productName.toLowerCase();
      for (const [cat, patterns] of Object.entries(categoryPatterns)) {
        if (patterns.some(p => lowerName.includes(p))) {
          category = cat;
          break;
        }
      }

      const { data: newEntry } = await supabase
        .from('product_catalog')
        .insert({
          canonical_key: normalizedKey,
          display_name: scrapedProduct.productName,
          category,
          default_unit: 'EA',
          search_keywords: [searchTerm.toLowerCase(), ...scrapedProduct.productName.toLowerCase().split(' ')],
          is_system: true,
          usage_count: 1,
        } as never)
        .select('id')
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      catalogId = (newEntry as any)?.id;
    }

    // CRITICAL: Update store_sku_mappings (the GLOBAL cache)
    if (catalogId) {
      await supabase
        .from('store_sku_mappings')
        .upsert({
          product_catalog_id: catalogId,
          store: scrapedProduct.store,
          sku: scrapedProduct.sku || `AUTO_${Date.now()}`,
          store_product_name: scrapedProduct.productName,
          product_url: scrapedProduct.productUrl,
          last_price: scrapedProduct.price,
          last_price_at: new Date().toISOString(),
          match_confidence: 0.85,
        } as never, {
          onConflict: 'product_catalog_id,store'
        });

      console.log(`[price-lookup] Updated global cache for ${scrapedProduct.productName} at ${scrapedProduct.store}`);
    }
  } catch (error) {
    console.error('[price-lookup] Error updating global cache:', error);
  }
}

// ========================================
// MAIN HANDLER
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authenticateRequest(req);
  
  if (!auth.authenticated || !auth.userId) {
    console.error('[price-lookup] Auth failed:', auth.error);
    return new Response(
      JSON.stringify({ error: auth.error || 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = auth.userId;

  try {
    const { 
      items, 
      projectId,
      zipCode = '02903',
      stores = ['Home Depot', "Lowe's"],
      forceRefresh = false
    } = await req.json() as PriceLookupRequest;

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No items provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, PriceResult[]> = {};
    const itemsToProcess = items
      .slice(0, MAX_ITEMS_PER_REQUEST)
      .filter((item: string) => {
        // Skip placeholder items that won't match anything
        const normalized = item.toLowerCase().trim();
        return normalized !== 'new item' && normalized.length > 2;
      });
    let scrapesPerformed = 0;

    console.log('[price-lookup] Processing', itemsToProcess.length, 'items. forceRefresh:', forceRefresh);

    for (const item of itemsToProcess) {
      const searchTerm = normalizeSearchTerm(item);
      const itemResults: PriceResult[] = [];

      // ========================================
      // PRIORITY 1: Global Cache (store_sku_mappings)
      // This is the KEY cost-saving mechanism - shared across ALL users
      // ========================================
      const { data: catalogItems } = await supabase
        .from('product_catalog')
        .select(`
          id,
          canonical_key,
          display_name,
          default_unit,
          category,
          store_sku_mappings (
            id,
            store,
            sku,
            store_product_name,
            product_url,
            last_price,
            last_price_at,
            match_confidence
          )
        `)
        .or(`canonical_key.ilike.%${searchTerm.replace(/\s+/g, '_')}%,display_name.ilike.%${searchTerm}%`)
        .limit(5);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (catalogItems && (catalogItems as any[]).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const cat of catalogItems as any[]) {
          for (const mapping of (cat.store_sku_mappings || [])) {
            const status = getCacheStatus(mapping.last_price_at);
            
            // Return cached price regardless (UI will show status indicator)
            itemResults.push({
              source: 'global_cache',
              status,
              price: mapping.last_price,
              unit: cat.default_unit || 'EA',
              productName: mapping.store_product_name || cat.display_name,
              confidence: mapping.match_confidence || 0.85,
              matchType: mapping.sku ? 'sku' : 'strict',
              note: status === 'verified' 
                ? `✓ Verified (${mapping.store}) - Updated ${new Date(mapping.last_price_at).toLocaleDateString()}`
                : `⏱ Stale cache - Click refresh for live price`,
              productUrl: mapping.product_url || undefined,
              sku: mapping.sku || undefined,
              store: mapping.store,
              lastUpdated: mapping.last_price_at,
              catalogId: cat.id,
              mappingId: mapping.id,
            });
          }
        }
      }

      // ========================================
      // PRIORITY 2: User's Price Book (always trusted)
      // ========================================
      const { data: priceBookItems } = await supabase
        .from('price_book')
        .select('*')
        .or(`created_by.eq.${userId},is_system.eq.true`)
        .ilike('item_name', `%${searchTerm}%`)
        .limit(3);

      if (priceBookItems && priceBookItems.length > 0) {
        for (const pb of priceBookItems) {
          itemResults.push({
            source: 'price_book',
            status: 'verified',
            price: pb.unit_cost,
            unit: pb.unit || 'EA',
            productName: pb.item_name,
            confidence: 0.98,
            matchType: 'strict',
            note: pb.vendor ? `✓ Your verified price (${pb.vendor})` : '✓ From your price book',
            lastUpdated: pb.updated_at,
          });
        }
      }

      // ========================================
      // PRIORITY 3: Fresh Scrape (ONLY if forceRefresh AND no fresh cache)
      // ========================================
      const hasFreshCache = itemResults.some(r => r.source === 'global_cache' && r.status === 'verified');
      const hasPriceBook = itemResults.some(r => r.source === 'price_book');

      if (forceRefresh && !hasFreshCache && !hasPriceBook && scrapesPerformed < 3) {
        // Check rate limit before scraping
        const rateLimit = await checkAndUpdateRateLimit(userId);
        
        if (rateLimit.allowed) {
          console.log('[price-lookup] Scraping for:', item);
          
          const scraped = await scrapeStorePrices(item, zipCode, stores, userId);
          scrapesPerformed++;
          
          for (const s of scraped) {
            const specs = extractProductSpecs(item);
            const confidence = calculateMatchConfidence(item, s.productName, specs);
            const matchType: 'sku' | 'strict' | 'fuzzy' = s.sku ? 'sku' : (confidence > 0.7 ? 'strict' : 'fuzzy');
            
            itemResults.push({
              source: 'scraped_fresh',
              status: 'verified',
              price: s.price,
              unit: s.unit,
              productName: s.productName,
              confidence,
              matchType,
              note: `✓ Fresh from ${s.store}`,
              productUrl: s.productUrl || undefined,
              sku: s.sku || undefined,
              store: s.store,
              inStock: s.inStock,
              lastUpdated: new Date().toISOString(),
            });

            // Update global cache for next user (async)
            updateGlobalCache(item, s).catch(console.error);
          }
        } else {
          console.log('[price-lookup] Rate limited, skipping scrape');
        }
      }

      // ========================================
      // PRIORITY 4: Knowledge Base (fallback benchmarks)
      // ========================================
      if (itemResults.length === 0) {
        // Build search terms for better matching
        const searchTerms = searchTerm.toLowerCase().split(/[\s\-_]+/).filter(t => t.length > 1);
        
        // Try multiple search strategies
        let knowledgeItems: Array<{ 
          value: number | null; 
          unit: string | null; 
          display_name: string;
          confidence_score: number | null;
          region: string | null;
          updated_at: string;
        }> = [];
        
        // Strategy 1: Search by key
        const { data: byKey } = await supabase
          .from('construction_knowledge')
          .select('value, unit, display_name, confidence_score, region, updated_at')
          .eq('knowledge_type', 'material_cost')
          .ilike('key', `%${searchTerm.replace(/[^a-zA-Z0-9]/g, '%')}%`)
          .limit(3);
        
        if (byKey && byKey.length > 0) {
          knowledgeItems = byKey;
        }
        
        // Strategy 2: Search by display_name if no key matches
        if (knowledgeItems.length === 0) {
          const { data: byName } = await supabase
            .from('construction_knowledge')
            .select('value, unit, display_name, confidence_score, region, updated_at')
            .eq('knowledge_type', 'material_cost')
            .ilike('display_name', `%${searchTerms[0] || searchTerm}%`)
            .limit(3);
          
          if (byName && byName.length > 0) {
            knowledgeItems = byName;
          }
        }
        
        // Strategy 3: Match common construction items by keywords
        if (knowledgeItems.length === 0) {
          const materialKeywords: Record<string, string[]> = {
            '2x4': ['2x4x8_stud'],
            '2x6': ['2x6x8_stud'],
            'stud': ['2x4x8_stud', '2x6x8_stud'],
            'drywall': ['drywall_1_2_4x8', 'drywall_5_8_4x8'],
            'sheetrock': ['drywall_1_2_4x8'],
            'osb': ['osb_7_16_4x8'],
            'plywood': ['plywood_1_2_4x8'],
            'shingle': ['arch_shingles_sq'],
            'concrete': ['concrete_4000psi_cy'],
          };
          
          for (const [keyword, keys] of Object.entries(materialKeywords)) {
            if (searchTerm.toLowerCase().includes(keyword)) {
              const { data: byKeyword } = await supabase
                .from('construction_knowledge')
                .select('value, unit, display_name, confidence_score, region, updated_at')
                .eq('knowledge_type', 'material_cost')
                .in('key', keys)
                .limit(2);
              
              if (byKeyword && byKeyword.length > 0) {
                knowledgeItems = byKeyword;
                break;
              }
            }
          }
        }

        for (const k of knowledgeItems) {
          itemResults.push({
            source: 'knowledge_base',
            status: 'stale',
            price: k.value,
            unit: k.unit || 'EA',
            productName: k.display_name,
            confidence: k.confidence_score || 0.5,
            matchType: 'fuzzy',
            note: k.region ? `⚠️ Benchmark (${k.region})` : '⚠️ Historical benchmark - Click refresh for current price',
            lastUpdated: k.updated_at,
          });
        }
      }

      // No results at all
      if (itemResults.length === 0) {
        itemResults.push({
          source: 'knowledge_base',
          status: 'unknown',
          price: null,
          unit: 'EA',
          productName: item,
          confidence: 0,
          matchType: 'none',
          note: '❓ No pricing found - Click refresh to search stores',
        });
      }

      // Sort: verified first, then by confidence
      itemResults.sort((a, b) => {
        if (a.status === 'verified' && b.status !== 'verified') return -1;
        if (b.status === 'verified' && a.status !== 'verified') return 1;
        return b.confidence - a.confidence;
      });
      
      results[item] = itemResults;
    }

    console.log('[price-lookup] Completed. Items:', Object.keys(results).length, 'Scrapes:', scrapesPerformed);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        meta: {
          itemsProcessed: itemsToProcess.length,
          scrapesPerformed,
          zipCode,
          stores,
          cacheInfo: `Prices from global cache are shared across all users. Click refresh for live store prices.`,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[price-lookup] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

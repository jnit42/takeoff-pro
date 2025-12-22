/**
 * Price Lookup Edge Function
 * Architecture: SKU-based matching → Price Book → Scraped Suggestions → Knowledge Base
 * 
 * Scraped prices are SUGGESTIONS only, never auto-applied.
 * User must confirm before accepting into price book.
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

interface PriceResult {
  source: 'price_book' | 'product_catalog' | 'scraped_suggestion' | 'knowledge_base' | 'cache';
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
  suggestionId?: string;
  lastUpdated?: string;
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
  
  // Check current usage - using raw query for new table
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
    
    // Increment count
    await supabase
      .from('user_lookup_limits')
      .update({ 
        lookup_count: existingRow.lookup_count + 1,
        last_lookup_at: new Date().toISOString()
      } as never)
      .eq('id', existingRow.id);
    
    return { allowed: true, remaining: MAX_LOOKUPS_PER_DAY - existingRow.lookup_count - 1 };
  }

  // Create new record for today
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
  
  // Extract dimensions like 4x8, 2x4, etc.
  const dimMatch = item.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (dimMatch) {
    specs.dimensions = `${dimMatch[1]}x${dimMatch[2]}`;
  }
  
  // Extract thickness like 1/2", 5/8", etc.
  const thickMatch = item.match(/(\d+\/\d+|\d+\.?\d*)\s*["']?/);
  if (thickMatch) {
    specs.thickness = thickMatch[1];
  }
  
  // Extract common types
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
  
  // Exact match
  if (normalizedSearch === normalizedProduct) return 1.0;
  
  // Contains full search term
  if (normalizedProduct.includes(normalizedSearch)) confidence += 0.5;
  
  // Word matching
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
  const productWords = normalizedProduct.split(' ');
  const matchedWords = searchWords.filter(w => productWords.some(pw => pw.includes(w)));
  confidence += (matchedWords.length / searchWords.length) * 0.3;
  
  // Spec matching bonus
  if (specs.dimensions && normalizedProduct.includes(specs.dimensions.toLowerCase())) confidence += 0.1;
  if (specs.thickness && normalizedProduct.includes(specs.thickness)) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

// ========================================
// SCRAPING WITH FIRECRAWL
// ========================================

async function scrapeStorePrices(
  item: string,
  zipCode: string,
  stores: string[]
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

  for (const store of stores.slice(0, 2)) { // Max 2 stores per item
    try {
      let searchUrl = '';
      
      if (store.toLowerCase() === 'home depot') {
        searchUrl = `https://www.homedepot.com/s/${encodeURIComponent(normalizedItem)}?NCNI-5&zipCode=${zipCode}`;
      } else if (store.toLowerCase() === "lowe's" || store.toLowerCase() === 'lowes') {
        searchUrl = `https://www.lowes.com/search?searchTerm=${encodeURIComponent(normalizedItem)}&zipCode=${zipCode}`;
      } else {
        continue;
      }

      console.log(`[price-lookup] Scraping ${store} for: ${normalizedItem}`);

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
                      name: { type: 'string' },
                      price: { type: 'number' },
                      unit: { type: 'string' },
                      sku: { type: 'string' },
                      url: { type: 'string' },
                      inStock: { type: 'boolean' },
                      brand: { type: 'string' },
                    },
                    required: ['name', 'price']
                  },
                  maxItems: 5
                }
              },
              required: ['products']
            },
            prompt: `Extract the first 5 product results from this ${store} search page. Include exact prices, product names, SKUs if visible, and stock status. Focus on construction materials matching: ${item}`
          },
          waitFor: 2000,
          timeout: 15000,
        }),
      });

      if (!response.ok) {
        console.error(`[price-lookup] Firecrawl error for ${store}:`, response.status);
        continue;
      }

      const data = await response.json();
      
      if (data.success && data.data?.extract?.products) {
        for (const product of data.data.extract.products.slice(0, 3)) {
          // Calculate match confidence
          const confidence = calculateMatchConfidence(item, product.name, specs);
          
          // Only include if confidence is above threshold
          if (confidence >= 0.4) {
            results.push({
              store,
              productName: product.name,
              price: product.price || null,
              unit: product.unit || 'EA',
              sku: product.sku || null,
              productUrl: product.url || null,
              inStock: product.inStock !== false,
              rawData: { ...product, searchUrl, confidence, specs },
            });
          }
        }
      }
    } catch (error) {
      console.error(`[price-lookup] Error scraping ${store}:`, error);
    }
  }

  return results;
}

// ========================================
// CATALOG LEARNING
// ========================================

async function learnFromScrape(
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
    // Check if product already in catalog
    const normalizedKey = normalizeSearchTerm(scrapedProduct.productName)
      .replace(/\s+/g, '_')
      .toUpperCase()
      .slice(0, 50);

    const { data: existing } = await supabase
      .from('product_catalog')
      .select('id, usage_count')
      .eq('canonical_key', normalizedKey)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingRow = existing as any;

    if (existingRow) {
      // Update usage count
      await supabase
        .from('product_catalog')
        .update({ usage_count: (existingRow.usage_count || 0) + 1 } as never)
        .eq('id', existingRow.id);
      
      // Update or create SKU mapping
      if (scrapedProduct.sku) {
        await supabase
          .from('store_sku_mappings')
          .upsert({
            product_catalog_id: existingRow.id,
            store: scrapedProduct.store,
            sku: scrapedProduct.sku,
            store_product_name: scrapedProduct.productName,
            product_url: scrapedProduct.productUrl,
            last_price: scrapedProduct.price,
            last_price_at: new Date().toISOString(),
          } as never, {
            onConflict: 'product_catalog_id,store,sku'
          });
      }
    } else {
      // Extract category from search term
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

      // Create new catalog entry
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
      const newRow = newEntry as any;

      // Create SKU mapping if we have one
      if (newRow && scrapedProduct.sku) {
        await supabase
          .from('store_sku_mappings')
          .insert({
            product_catalog_id: newRow.id,
            store: scrapedProduct.store,
            sku: scrapedProduct.sku,
            store_product_name: scrapedProduct.productName,
            product_url: scrapedProduct.productUrl,
            last_price: scrapedProduct.price,
            last_price_at: new Date().toISOString(),
          } as never);
      }
    }
  } catch (error) {
    console.error('[price-lookup] Error learning from scrape:', error);
  }
}

// ========================================
// MAIN HANDLER
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ========================================
  // SECURITY: Authenticate
  // ========================================
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
      zipCode = '02903', // Default to Providence, RI
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

    // Check rate limit
    const rateLimit = await checkAndUpdateRateLimit(userId);
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: rateLimit.error,
          rateLimitExceeded: true,
          remaining: 0
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Record<string, PriceResult[]> = {};
    const itemsToProcess = items.slice(0, MAX_ITEMS_PER_REQUEST);

    console.log('[price-lookup] Processing', itemsToProcess.length, 'items for user:', userId);

    for (const item of itemsToProcess) {
      const searchTerm = normalizeSearchTerm(item);
      const itemResults: PriceResult[] = [];

      // ========================================
      // PRIORITY 1: User's Price Book
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
            price: pb.unit_cost,
            unit: pb.unit || 'EA',
            productName: pb.item_name,
            confidence: 0.98,
            matchType: 'strict',
            note: pb.vendor ? `Verified price from ${pb.vendor}` : 'From your price book',
            lastUpdated: pb.updated_at,
          });
        }
      }

      // ========================================
      // PRIORITY 2: Product Catalog with SKU Mappings
      // ========================================
      const { data: catalogItems } = await supabase
        .from('product_catalog')
        .select(`
          *,
          store_sku_mappings (
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
        .limit(3);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (catalogItems && (catalogItems as any[]).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const cat of catalogItems as any[]) {
          for (const mapping of (cat.store_sku_mappings || [])) {
            if (mapping.last_price) {
              itemResults.push({
                source: 'product_catalog',
                price: mapping.last_price,
                unit: cat.default_unit || 'EA',
                productName: mapping.store_product_name || cat.display_name,
                confidence: mapping.match_confidence || 0.85,
                matchType: mapping.sku ? 'sku' : 'strict',
                note: `${mapping.store} - SKU: ${mapping.sku || 'N/A'}`,
                productUrl: mapping.product_url || undefined,
                sku: mapping.sku || undefined,
                store: mapping.store,
                lastUpdated: mapping.last_price_at,
              });
            }
          }
        }
      }

      // ========================================
      // PRIORITY 3: Valid Cached Suggestions
      // ========================================
      const now = new Date().toISOString();
      
      if (!forceRefresh) {
        const { data: cachedSuggestions } = await supabase
          .from('price_suggestions')
          .select('*')
          .eq('user_id', userId)
          .ilike('search_term', `%${searchTerm}%`)
          .gt('expires_at', now)
          .eq('status', 'pending')
          .order('scraped_at', { ascending: false })
          .limit(3);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (cachedSuggestions && (cachedSuggestions as any[]).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const sug of cachedSuggestions as any[]) {
            itemResults.push({
              source: 'scraped_suggestion',
              price: sug.price,
              unit: sug.unit || 'EA',
              productName: sug.product_name || item,
              confidence: sug.match_confidence || 0.6,
              matchType: sug.match_type as 'sku' | 'strict' | 'fuzzy' | 'none',
              note: `⚠️ SUGGESTION from ${sug.source} - verify before using`,
              productUrl: sug.product_url || undefined,
              sku: sug.sku || undefined,
              store: sug.source,
              inStock: sug.in_stock,
              suggestionId: sug.id,
              lastUpdated: sug.scraped_at,
            });
          }
        }
      }

      // ========================================
      // PRIORITY 4: Fresh Scrape (if needed and no cached suggestions)
      // ========================================
      const hasSuggestions = itemResults.some(r => r.source === 'scraped_suggestion');
      const hasPriceBookPrice = itemResults.some(r => r.source === 'price_book');
      
      if (!hasSuggestions && !hasPriceBookPrice && (forceRefresh || itemResults.length < 2)) {
        console.log('[price-lookup] Scraping for:', item);
        
        const scraped = await scrapeStorePrices(item, zipCode, stores);
        
        for (const s of scraped) {
          const specs = extractProductSpecs(item);
          const confidence = calculateMatchConfidence(item, s.productName, specs);
          const matchType: 'sku' | 'strict' | 'fuzzy' = s.sku ? 'sku' : (confidence > 0.7 ? 'strict' : 'fuzzy');
          
          // Save as suggestion
          const { data: newSuggestion } = await supabase
            .from('price_suggestions')
            .insert({
              user_id: userId,
              project_id: projectId,
              search_term: item,
              match_type: matchType,
              match_confidence: confidence,
              source: s.store,
              zip_code: zipCode,
              price: s.price,
              unit: s.unit,
              product_name: s.productName,
              product_url: s.productUrl,
              sku: s.sku,
              in_stock: s.inStock,
              raw_response: s.rawData,
              status: 'pending',
            } as never)
            .select('id')
            .single();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = newSuggestion as any;

          itemResults.push({
            source: 'scraped_suggestion',
            price: s.price,
            unit: s.unit,
            productName: s.productName,
            confidence,
            matchType,
            note: `⚠️ NEW SUGGESTION from ${s.store} - verify before using`,
            productUrl: s.productUrl || undefined,
            sku: s.sku || undefined,
            store: s.store,
            inStock: s.inStock,
            suggestionId: newRow?.id,
            lastUpdated: now,
          });

          // Learn from scrape (async, don't wait)
          learnFromScrape(item, s).catch(console.error);
        }
      }

      // ========================================
      // PRIORITY 5: Construction Knowledge Base
      // ========================================
      const { data: knowledgeItems } = await supabase
        .from('construction_knowledge')
        .select('*')
        .eq('knowledge_type', 'material_cost')
        .ilike('key', `%${searchTerm.replace(/\s+/g, '_')}%`)
        .limit(2);

      if (knowledgeItems && knowledgeItems.length > 0) {
        for (const k of knowledgeItems) {
          itemResults.push({
            source: 'knowledge_base',
            price: k.value,
            unit: k.unit || 'EA',
            productName: k.display_name,
            confidence: k.confidence_score || 0.5,
            matchType: 'fuzzy',
            note: k.region ? `Regional benchmark (${k.region})` : 'Historical benchmark - may be outdated',
            lastUpdated: k.updated_at,
          });
        }
      }

      // No results - add helpful message
      if (itemResults.length === 0) {
        itemResults.push({
          source: 'knowledge_base',
          price: null,
          unit: 'EA',
          productName: item,
          confidence: 0,
          matchType: 'none',
          note: 'No pricing found. Add to your price book or click "Refresh Prices" to search stores.',
        });
      }

      // Sort by confidence
      itemResults.sort((a, b) => b.confidence - a.confidence);
      results[item] = itemResults;
    }

    console.log('[price-lookup] Completed. Processed', Object.keys(results).length, 'items. Remaining lookups today:', rateLimit.remaining);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        meta: {
          itemsProcessed: itemsToProcess.length,
          lookupsRemaining: rateLimit.remaining,
          zipCode,
          stores,
        },
        note: 'Prices from price book are verified. Scraped suggestions require confirmation before use.',
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

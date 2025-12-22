/**
 * Price Lookup Edge Function
 * Searches Home Depot and Lowes for material pricing using Firecrawl
 * Returns live pricing based on project location
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceResult {
  store: string;
  price: number | null;
  unit: string;
  productName: string;
  productUrl: string;
  inStock: boolean;
  location?: string;
}

interface PriceLookupRequest {
  items: string[]; // Item descriptions to search for
  zipCode?: string; // Location for local pricing
  stores?: string[]; // Which stores to search (default: all)
}

// Construction material search term mappings for better results
const SEARCH_TERM_MAPPINGS: Record<string, string[]> = {
  'drywall': ['drywall sheet', 'gypsum board', 'sheetrock'],
  'stud': ['wood stud', '2x4 stud', 'lumber stud'],
  '2x4': ['2x4 lumber', '2x4 stud', '2x4-8'],
  '2x6': ['2x6 lumber', '2x6 stud', '2x6-8'],
  'plywood': ['plywood sheet', 'cdx plywood', 'sheathing'],
  'insulation': ['insulation batt', 'fiberglass insulation', 'r-13 insulation'],
  'joint compound': ['drywall mud', 'joint compound', 'all purpose compound'],
  'drywall tape': ['paper tape drywall', 'mesh tape', 'joint tape'],
  'screws': ['drywall screws', 'construction screws'],
  'nails': ['framing nails', 'common nails'],
  'anchor': ['concrete anchor', 'tapcon', 'masonry anchor'],
  'pt plate': ['pressure treated plate', 'treated lumber 2x4', 'pt 2x4'],
  'vapor barrier': ['plastic sheeting', 'vapor barrier', '6 mil plastic'],
};

// Normalize item description for better search
function normalizeSearchTerm(item: string): string {
  const lower = item.toLowerCase();
  
  // Check for known mappings
  for (const [key, terms] of Object.entries(SEARCH_TERM_MAPPINGS)) {
    if (lower.includes(key)) {
      return terms[0]; // Use primary search term
    }
  }
  
  // Extract key product terms, remove quantities and sizes
  return lower
    .replace(/\d+\s*(sf|lf|ea|pcs?|pieces?|sheets?|boxes?)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

// Parse price from scraped content
function extractPrice(content: string): { price: number | null; unit: string } {
  // Look for price patterns like $12.99, $12.99/ea, $12.99 per piece
  const pricePatterns = [
    /\$(\d+(?:\.\d{2})?)\s*(?:\/|\s*per\s*)?(ea|each|pc|piece|sheet|lf|sf|bag|box)?/gi,
    /\$(\d+(?:\.\d{2})?)/g,
  ];
  
  for (const pattern of pricePatterns) {
    const match = pattern.exec(content);
    if (match) {
      return {
        price: parseFloat(match[1]),
        unit: match[2] || 'EA',
      };
    }
  }
  
  return { price: null, unit: 'EA' };
}

// Extract product URL from search results
function extractProductUrl(content: string, store: string): string {
  const baseUrls: Record<string, string> = {
    homedepot: 'https://www.homedepot.com',
    lowes: 'https://www.lowes.com',
  };
  
  // Try to find product links
  const linkPattern = store === 'homedepot' 
    ? /\/p\/[^\s"'>]+/g
    : /\/pd\/[^\s"'>]+/g;
  
  const match = linkPattern.exec(content);
  if (match) {
    return baseUrls[store] + match[0];
  }
  
  return baseUrls[store] || '';
}

// Check stock status from content
function checkInStock(content: string): boolean {
  const outOfStockPatterns = [
    /out of stock/i,
    /unavailable/i,
    /sold out/i,
    /not available/i,
  ];
  
  for (const pattern of outOfStockPatterns) {
    if (pattern.test(content)) {
      return false;
    }
  }
  
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, zipCode, stores = ['homedepot', 'lowes'] } = await req.json() as PriceLookupRequest;

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No items provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Price lookup not configured. Please connect Firecrawl in project settings.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for caching
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, PriceResult[]> = {};
    const now = new Date().toISOString();

    for (const item of items.slice(0, 5)) { // Limit to 5 items per request
      const searchTerm = normalizeSearchTerm(item);
      const itemResults: PriceResult[] = [];

      // Check cache first
      const { data: cached } = await supabase
        .from('price_cache')
        .select('*')
        .ilike('item_name', `%${searchTerm}%`)
        .gt('expires_at', now)
        .limit(2);

      if (cached && cached.length > 0) {
        console.log(`[Price Lookup] Cache hit for: ${searchTerm}`);
        for (const c of cached) {
          itemResults.push({
            store: c.store,
            price: c.price,
            unit: c.unit || 'EA',
            productName: c.item_name,
            productUrl: c.product_url || '',
            inStock: c.in_stock ?? true,
            location: c.location,
          });
        }
        results[item] = itemResults;
        continue;
      }

      console.log(`[Price Lookup] Searching for: ${searchTerm}`);

      // Search each store using Firecrawl search
      for (const store of stores) {
        try {
          const searchQuery = `${searchTerm} ${store === 'homedepot' ? 'site:homedepot.com' : 'site:lowes.com'} price`;
          
          const response = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: searchQuery,
              limit: 3,
              scrapeOptions: {
                formats: ['markdown'],
              },
            }),
          });

          if (!response.ok) {
            console.error(`[Price Lookup] Firecrawl error for ${store}:`, response.status);
            continue;
          }

          const data = await response.json();
          const searchResults = data.data || [];

          if (searchResults.length > 0) {
            const topResult = searchResults[0];
            const content = topResult.markdown || topResult.description || '';
            
            const { price, unit } = extractPrice(content);
            const productUrl = topResult.url || extractProductUrl(content, store);
            const inStock = checkInStock(content);
            const productName = topResult.title || searchTerm;

            const priceResult: PriceResult = {
              store,
              price,
              unit,
              productName,
              productUrl,
              inStock,
              location: zipCode,
            };

            itemResults.push(priceResult);

            // Cache the result
            if (price !== null) {
              const { error: insertError } = await supabase.from('price_cache').insert({
                item_name: productName,
                search_term: searchTerm,
                store,
                price,
                unit,
                product_url: productUrl,
                in_stock: inStock,
                location: zipCode,
              });
              if (insertError) {
                console.error('[Price Lookup] Cache insert error:', insertError);
              }
            }
          }
        } catch (storeError) {
          console.error(`[Price Lookup] Error searching ${store}:`, storeError);
        }
      }

      results[item] = itemResults;
    }

    console.log(`[Price Lookup] Completed. Found prices for ${Object.keys(results).length} items`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        cached: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Price Lookup] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

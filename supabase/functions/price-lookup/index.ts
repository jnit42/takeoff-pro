/**
 * Price Lookup Edge Function
 * QUARANTINED: Web scraping disabled for security and reliability
 * Now returns prices from price book and knowledge base only
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceResult {
  source: 'price_book' | 'knowledge_base' | 'cache';
  price: number | null;
  unit: string;
  productName: string;
  confidence: number;
  note?: string;
}

interface PriceLookupRequest {
  items: string[];
  projectId?: string;
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

// Normalize item description for lookup
function normalizeSearchTerm(item: string): string {
  return item.toLowerCase()
    .replace(/\d+\s*(sf|lf|ea|pcs?|pieces?|sheets?|boxes?)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

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
    const { items } = await req.json() as PriceLookupRequest;

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

    console.log('[price-lookup] Looking up', items.length, 'items for user:', userId);

    for (const item of items.slice(0, 10)) {
      const searchTerm = normalizeSearchTerm(item);
      const itemResults: PriceResult[] = [];

      // 1. Check user's price book first (highest priority)
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
            confidence: 0.95,
            note: pb.vendor ? `From ${pb.vendor}` : 'From your price book',
          });
        }
      }

      // 2. Check construction knowledge base
      const { data: knowledgeItems } = await supabase
        .from('construction_knowledge')
        .select('*')
        .eq('knowledge_type', 'material_cost')
        .ilike('key', `%${searchTerm.replace(/\s+/g, '_')}%`)
        .limit(3);

      if (knowledgeItems && knowledgeItems.length > 0) {
        for (const k of knowledgeItems) {
          itemResults.push({
            source: 'knowledge_base',
            price: k.value,
            unit: k.unit || 'EA',
            productName: k.display_name,
            confidence: k.confidence_score || 0.7,
            note: k.region ? `Regional data (${k.region})` : 'Historical data',
          });
        }
      }

      // 3. Check price cache (still valid cached data)
      const now = new Date().toISOString();
      const { data: cached } = await supabase
        .from('price_cache')
        .select('*')
        .ilike('search_term', `%${searchTerm}%`)
        .gt('expires_at', now)
        .limit(2);

      if (cached && cached.length > 0) {
        for (const c of cached) {
          itemResults.push({
            source: 'cache',
            price: c.price,
            unit: c.unit || 'EA',
            productName: c.item_name,
            confidence: 0.6,
            note: `Cached from ${c.store} (may be outdated)`,
          });
        }
      }

      // If no results found, add a note
      if (itemResults.length === 0) {
        itemResults.push({
          source: 'price_book',
          price: null,
          unit: 'EA',
          productName: item,
          confidence: 0,
          note: 'No pricing found. Add to your price book for accurate estimates.',
        });
      }

      results[item] = itemResults;
    }

    console.log('[price-lookup] Completed. Found prices for', Object.keys(results).length, 'items');

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        note: 'Prices from your price book and knowledge base. Web scraping is disabled for reliability.',
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

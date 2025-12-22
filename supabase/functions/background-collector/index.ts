/**
 * Background Data Collector
 * Scrapes construction data from various sources to build the knowledge base
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeResult {
  source: string;
  success: boolean;
  itemsFound: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (!FIRECRAWL_API_KEY) {
    console.log('[background-collector] Firecrawl not configured, skipping scrape');
    return new Response(
      JSON.stringify({ message: 'Firecrawl not configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { sourceType = 'all' } = await req.json().catch(() => ({}));
    
    console.log('[background-collector] Starting collection run:', sourceType);

    const results: ScrapeResult[] = [];

    // Get active data sources
    const { data: sources, error: sourcesError } = await supabase
      .from('data_sources')
      .select('*')
      .eq('scrape_enabled', true);

    if (sourcesError) {
      throw new Error(`Failed to fetch data sources: ${sourcesError.message}`);
    }

    // If no sources configured, seed with defaults
    if (!sources || sources.length === 0) {
      console.log('[background-collector] No sources configured, seeding defaults');
      await seedDefaultSources(supabase);
      
      // Fetch again after seeding
      const { data: newSources } = await supabase
        .from('data_sources')
        .select('*')
        .eq('scrape_enabled', true);
      
      if (newSources) {
        for (const source of newSources) {
          const result = await scrapeSource(source, FIRECRAWL_API_KEY, supabase);
          results.push(result);
        }
      }
    } else {
      // Process each source
      for (const source of sources) {
        if (sourceType !== 'all' && source.source_type !== sourceType) continue;
        
        const result = await scrapeSource(source, FIRECRAWL_API_KEY, supabase);
        results.push(result);
        
        // Update last scraped timestamp
        await supabase
          .from('data_sources')
          .update({ 
            last_scraped_at: new Date().toISOString(),
            total_imports: (source.total_imports || 0) + result.itemsFound,
            successful_imports: result.success 
              ? (source.successful_imports || 0) + result.itemsFound 
              : source.successful_imports,
            failed_imports: result.success 
              ? source.failed_imports 
              : (source.failed_imports || 0) + 1,
          })
          .eq('id', source.id);
      }
    }

    // Run validation on pending imports
    await validatePendingImports(supabase);

    const successCount = results.filter(r => r.success).length;
    const totalItems = results.reduce((sum, r) => sum + r.itemsFound, 0);

    console.log('[background-collector] Complete:', {
      sources: results.length,
      successful: successCount,
      totalItems
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        summary: {
          sourcesProcessed: results.length,
          successful: successCount,
          totalItemsFound: totalItems
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[background-collector] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function seedDefaultSources(supabase: any) {
  const defaultSources = [
    {
      name: 'Home Depot - Lumber',
      source_type: 'retailer',
      url: 'https://www.homedepot.com/b/Lumber-Composites/N-5yc1vZbqm7',
      credibility_score: 0.85,
      credibility_factors: { type: 'major_retailer', verified: true },
      scrape_frequency: 'daily',
      scrape_config: { 
        category: 'lumber',
        search_terms: ['2x4', '2x6', '2x8', '2x10', '2x12', 'plywood', 'OSB']
      }
    },
    {
      name: 'Home Depot - Drywall',
      source_type: 'retailer',
      url: 'https://www.homedepot.com/b/Building-Materials-Drywall/N-5yc1vZc5f3',
      credibility_score: 0.85,
      credibility_factors: { type: 'major_retailer', verified: true },
      scrape_frequency: 'daily',
      scrape_config: { 
        category: 'drywall',
        search_terms: ['drywall', 'sheetrock', 'joint compound', 'drywall tape']
      }
    },
    {
      name: 'Lowes - Electrical',
      source_type: 'retailer', 
      url: 'https://www.lowes.com/c/Electrical',
      credibility_score: 0.85,
      credibility_factors: { type: 'major_retailer', verified: true },
      scrape_frequency: 'daily',
      scrape_config: {
        category: 'electrical',
        search_terms: ['romex', 'wire', 'outlet', 'breaker', 'panel']
      }
    },
  ];

  for (const source of defaultSources) {
    await supabase.from('data_sources').insert(source);
  }
}

async function scrapeSource(source: any, apiKey: string, supabase: any): Promise<ScrapeResult> {
  console.log('[background-collector] Scraping:', source.name);

  try {
    const config = source.scrape_config || {};
    const searchTerms = config.search_terms || [];
    let totalItems = 0;

    for (const term of searchTerms.slice(0, 5)) { // Limit to 5 terms per source
      try {
        // Use Firecrawl search to find current prices
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `${term} price site:${new URL(source.url).hostname}`,
            limit: 5,
            scrapeOptions: {
              formats: ['markdown'],
              onlyMainContent: true,
            }
          }),
        });

        if (!response.ok) {
          console.error(`[background-collector] Search failed for ${term}:`, await response.text());
          continue;
        }

        const searchResult = await response.json();
        
        if (searchResult.success && searchResult.data) {
          for (const result of searchResult.data) {
            // Extract price information from markdown content
            const priceData = extractPriceFromContent(result.markdown || '', term, config.category);
            
            if (priceData) {
              // Store as knowledge import for validation
              await supabase.from('knowledge_imports').insert({
                data_source_id: source.id,
                import_type: 'material_price',
                raw_data: {
                  url: result.url,
                  title: result.title,
                  content: result.markdown?.slice(0, 2000),
                  extracted: priceData
                },
                extracted_key: priceData.key,
                extracted_value: priceData.price,
                extracted_unit: priceData.unit,
                extracted_trade: config.category,
                validation_status: 'pending',
                source_date: new Date().toISOString().split('T')[0],
              });
              
              totalItems++;
            }
          }
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (termError) {
        console.error(`[background-collector] Error scraping term ${term}:`, termError);
      }
    }

    return {
      source: source.name,
      success: true,
      itemsFound: totalItems,
    };

  } catch (error) {
    console.error(`[background-collector] Error scraping ${source.name}:`, error);
    return {
      source: source.name,
      success: false,
      itemsFound: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function extractPriceFromContent(content: string, searchTerm: string, category: string): { key: string; price: number; unit: string } | null {
  // Look for price patterns
  const pricePatterns = [
    /\$(\d+(?:\.\d{2})?)/g,
    /(\d+(?:\.\d{2})?)\s*(?:each|per\s+(?:piece|unit|ea|lf|sf))/gi,
  ];

  let price: number | null = null;
  
  for (const pattern of pricePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // Extract the first reasonable price (between $0.50 and $500)
      for (const match of matches) {
        const numMatch = match.match(/(\d+(?:\.\d{2})?)/);
        if (numMatch) {
          const num = parseFloat(numMatch[1]);
          if (num >= 0.5 && num <= 500) {
            price = num;
            break;
          }
        }
      }
      if (price) break;
    }
  }

  if (!price) return null;

  // Determine unit based on category and search term
  let unit = 'EA';
  if (category === 'lumber' && searchTerm.match(/2x\d/)) {
    unit = 'EA'; // Stud/board
  } else if (category === 'lumber' && searchTerm.match(/plywood|osb/i)) {
    unit = 'SHT'; // Sheet
  } else if (category === 'drywall') {
    unit = 'SHT';
  } else if (category === 'electrical' && searchTerm.match(/wire|romex/i)) {
    unit = 'FT';
  }

  // Create a normalized key
  const key = searchTerm
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  return { key, price, unit };
}

async function validatePendingImports(supabase: any) {
  console.log('[background-collector] Validating pending imports...');

  // Get pending imports
  const { data: pending } = await supabase
    .from('knowledge_imports')
    .select('*')
    .eq('validation_status', 'pending')
    .limit(100);

  if (!pending || pending.length === 0) {
    console.log('[background-collector] No pending imports to validate');
    return;
  }

  for (const item of pending) {
    let status = 'validated';
    let reason = 'Passed validation checks';
    let confidence = 0.7;

    // Sanity checks
    if (item.extracted_value) {
      // Check for reasonable price ranges
      if (item.extracted_value < 0.10 || item.extracted_value > 10000) {
        status = 'rejected';
        reason = 'Price outside reasonable range';
        confidence = 0;
      }

      // Check for existing knowledge to compare
      const { data: existing } = await supabase
        .from('construction_knowledge')
        .select('value, min_value, max_value')
        .eq('key', item.extracted_key)
        .maybeSingle();

      if (existing) {
        const variance = Math.abs((item.extracted_value - existing.value) / existing.value);
        
        if (variance > 0.5) { // More than 50% different
          status = 'outlier';
          reason = `${Math.round(variance * 100)}% variance from existing knowledge`;
          confidence = 0.3;
        } else {
          // Corroborates existing data
          confidence = 0.85;
          reason = 'Corroborates existing knowledge';
        }
      }
    }

    // Update import status
    await supabase
      .from('knowledge_imports')
      .update({
        validation_status: status,
        validation_reason: reason,
        confidence_score: confidence,
        validated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    // If validated, update construction knowledge
    if (status === 'validated' && item.extracted_key && item.extracted_value) {
      await updateConstructionKnowledge(supabase, item, confidence);
    }
  }

  console.log('[background-collector] Validated', pending.length, 'imports');
}

async function updateConstructionKnowledge(supabase: any, item: any, confidence: number) {
  const { data: existing } = await supabase
    .from('construction_knowledge')
    .select('*')
    .eq('key', item.extracted_key)
    .eq('knowledge_type', 'material_cost')
    .maybeSingle();

  if (existing) {
    // Update existing with running average
    const newSampleCount = existing.sample_count + 1;
    const newAvg = ((existing.avg_value * existing.sample_count) + item.extracted_value) / newSampleCount;
    const newMin = Math.min(existing.min_value || Infinity, item.extracted_value);
    const newMax = Math.max(existing.max_value || -Infinity, item.extracted_value);
    const newConfidence = Math.min(0.95, existing.confidence_score + 0.02); // Slowly increase confidence

    await supabase
      .from('construction_knowledge')
      .update({
        value: item.extracted_value, // Latest value
        avg_value: newAvg,
        min_value: newMin,
        max_value: newMax,
        sample_count: newSampleCount,
        confidence_score: newConfidence,
        last_validated_at: new Date().toISOString(),
        data_freshness_days: 0,
      })
      .eq('id', existing.id);
  } else {
    // Create new knowledge entry
    await supabase
      .from('construction_knowledge')
      .insert({
        knowledge_type: 'material_cost',
        trade: item.extracted_trade,
        key: item.extracted_key,
        display_name: item.extracted_key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        value: item.extracted_value,
        unit: item.extracted_unit,
        avg_value: item.extracted_value,
        min_value: item.extracted_value,
        max_value: item.extracted_value,
        sample_count: 1,
        confidence_score: confidence,
        last_validated_at: new Date().toISOString(),
        data_freshness_days: 0,
        primary_sources: [item.data_source_id],
      });
  }
}

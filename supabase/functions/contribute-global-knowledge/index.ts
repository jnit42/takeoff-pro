/**
 * Contribute Global Knowledge Edge Function
 * Aggregates anonymized project data into collective learning
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KnowledgeContribution {
  knowledge_type: 'labor_rate' | 'material_cost' | 'productivity' | 'waste_factor' | 'markup';
  trade?: string;
  category?: string;
  region?: string;
  project_type?: string;
  key: string;
  value: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contributions, projectId } = await req.json() as { 
      contributions: KnowledgeContribution[];
      projectId: string;
    };

    if (!contributions || !Array.isArray(contributions) || contributions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No contributions provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[contribute-global] Processing', contributions.length, 'contributions from project:', projectId);

    const results = [];

    for (const contrib of contributions) {
      const { knowledge_type, trade, category, region, project_type, key, value } = contrib;

      // Check if this knowledge entry already exists
      const { data: existing, error: fetchError } = await supabase
        .from('global_knowledge')
        .select('*')
        .eq('knowledge_type', knowledge_type)
        .eq('key', key)
        .eq('trade', trade || '')
        .eq('category', category || '')
        .eq('region', region || '')
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[contribute-global] Fetch error:', fetchError);
        results.push({ key, success: false, error: fetchError.message });
        continue;
      }

      if (existing) {
        // Update existing entry with running statistics
        const newCount = existing.sample_count + 1;
        const existingValues = existing.value as { samples?: number[] } || { samples: [] };
        const samples = [...(existingValues.samples || []), value].slice(-1000); // Keep last 1000 samples
        
        const newMin = Math.min(existing.min_value || Infinity, value);
        const newMax = Math.max(existing.max_value || -Infinity, value);
        const newAvg = samples.reduce((a: number, b: number) => a + b, 0) / samples.length;
        
        // Calculate standard deviation
        const squaredDiffs = samples.map((v: number) => Math.pow(v - newAvg, 2));
        const newStdDev = Math.sqrt(squaredDiffs.reduce((a: number, b: number) => a + b, 0) / samples.length);

        // Confidence increases with sample size (asymptotic to 1.0)
        const newConfidence = Math.min(0.95, 0.3 + (0.65 * (1 - Math.exp(-newCount / 50))));

        const { error: updateError } = await supabase
          .from('global_knowledge')
          .update({
            value: { samples, latest: value },
            sample_count: newCount,
            min_value: newMin,
            max_value: newMax,
            avg_value: newAvg,
            std_dev: newStdDev,
            confidence: newConfidence,
            last_updated_by_project: projectId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('[contribute-global] Update error:', updateError);
          results.push({ key, success: false, error: updateError.message });
        } else {
          results.push({ key, success: true, action: 'updated', sample_count: newCount });
        }
      } else {
        // Create new entry
        const { error: insertError } = await supabase
          .from('global_knowledge')
          .insert({
            knowledge_type,
            trade: trade || null,
            category: category || null,
            region: region || null,
            project_type: project_type || null,
            key,
            value: { samples: [value], latest: value },
            sample_count: 1,
            min_value: value,
            max_value: value,
            avg_value: value,
            std_dev: 0,
            confidence: 0.3, // Low initial confidence
            last_updated_by_project: projectId,
          });

        if (insertError) {
          console.error('[contribute-global] Insert error:', insertError);
          results.push({ key, success: false, error: insertError.message });
        } else {
          results.push({ key, success: true, action: 'created' });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log('[contribute-global] Completed:', successCount, '/', contributions.length, 'successful');

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: contributions.length,
        successful: successCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[contribute-global] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

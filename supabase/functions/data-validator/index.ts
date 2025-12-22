/**
 * Data Validator Edge Function
 * Validates incoming data, detects outliers, and updates knowledge base
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  id: string;
  key: string;
  status: 'validated' | 'rejected' | 'outlier' | 'needs_review';
  reason: string;
  confidence: number;
  corroboratingCount: number;
  contradictingCount: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action = 'validate_pending', importId } = await req.json().catch(() => ({}));

    console.log('[data-validator] Action:', action);

    let results: ValidationResult[] = [];

    if (action === 'validate_pending') {
      results = await validatePendingImports(supabase);
    } else if (action === 'validate_single' && importId) {
      const result = await validateSingleImport(supabase, importId);
      if (result) results.push(result);
    } else if (action === 'recalculate_confidence') {
      await recalculateAllConfidence(supabase);
    } else if (action === 'decay_old_data') {
      await decayOldData(supabase);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        action,
        results,
        processed: results.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[data-validator] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function validatePendingImports(supabase: any): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Get pending imports
  const { data: pending, error } = await supabase
    .from('knowledge_imports')
    .select('*')
    .eq('validation_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error || !pending) {
    console.log('[data-validator] No pending imports or error:', error);
    return results;
  }

  console.log('[data-validator] Validating', pending.length, 'imports');

  for (const item of pending) {
    const result = await validateImport(supabase, item);
    results.push(result);

    // Update the import record
    await supabase
      .from('knowledge_imports')
      .update({
        validation_status: result.status,
        validation_reason: result.reason,
        confidence_score: result.confidence,
        corroborating_sources: result.corroboratingCount,
        contradicting_sources: result.contradictingCount,
        validated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    // If validated, update construction knowledge
    if (result.status === 'validated') {
      await updateKnowledgeBase(supabase, item, result.confidence);
    }
  }

  return results;
}

async function validateSingleImport(supabase: any, importId: string): Promise<ValidationResult | null> {
  const { data: item } = await supabase
    .from('knowledge_imports')
    .select('*')
    .eq('id', importId)
    .single();

  if (!item) return null;

  return validateImport(supabase, item);
}

async function validateImport(supabase: any, item: any): Promise<ValidationResult> {
  const result: ValidationResult = {
    id: item.id,
    key: item.extracted_key || 'unknown',
    status: 'validated',
    reason: '',
    confidence: 0.5,
    corroboratingCount: 0,
    contradictingCount: 0,
  };

  // Skip if no extracted value
  if (!item.extracted_value || !item.extracted_key) {
    result.status = 'rejected';
    result.reason = 'Missing extracted value or key';
    result.confidence = 0;
    return result;
  }

  const value = parseFloat(item.extracted_value);

  // ========================================
  // CHECK 1: Reasonable bounds
  // ========================================
  
  const bounds = getReasonableBounds(item.import_type, item.extracted_trade);
  
  if (value < bounds.min || value > bounds.max) {
    result.status = 'rejected';
    result.reason = `Value $${value} outside reasonable bounds ($${bounds.min}-$${bounds.max})`;
    result.confidence = 0;
    return result;
  }

  // ========================================
  // CHECK 2: Compare to existing knowledge
  // ========================================
  
  const { data: existing } = await supabase
    .from('construction_knowledge')
    .select('value, avg_value, min_value, max_value, std_deviation, sample_count, confidence_score')
    .eq('key', item.extracted_key)
    .maybeSingle();

  if (existing && existing.sample_count >= 3) {
    const avgValue = existing.avg_value || existing.value;
    const stdDev = existing.std_deviation || (avgValue * 0.2); // Default 20% std dev if unknown
    
    // Z-score calculation
    const zScore = Math.abs((value - avgValue) / stdDev);

    if (zScore > 3) {
      // More than 3 standard deviations - likely outlier
      result.status = 'outlier';
      result.reason = `Value differs by ${zScore.toFixed(1)} std deviations from average`;
      result.confidence = 0.2;
      result.contradictingCount = existing.sample_count;
    } else if (zScore > 2) {
      // 2-3 std deviations - flag for review
      result.status = 'needs_review';
      result.reason = `Value differs by ${zScore.toFixed(1)} std deviations - may be outlier or market shift`;
      result.confidence = 0.4;
    } else {
      // Within normal range - corroborates existing data
      result.corroboratingCount = existing.sample_count;
      result.confidence = Math.min(0.9, existing.confidence_score + 0.05);
      result.reason = 'Corroborates existing knowledge';
    }
  } else {
    // No existing data - validate against general patterns
    result.confidence = 0.6;
    result.reason = 'New data point - no prior knowledge to compare';
  }

  // ========================================
  // CHECK 3: Source credibility adjustment
  // ========================================
  
  if (item.data_source_id) {
    const { data: source } = await supabase
      .from('data_sources')
      .select('credibility_score')
      .eq('id', item.data_source_id)
      .single();

    if (source) {
      // Adjust confidence by source credibility
      result.confidence = result.confidence * source.credibility_score;
    }
  }

  // ========================================
  // CHECK 4: Recency bonus
  // ========================================
  
  const sourceDate = item.source_date ? new Date(item.source_date) : new Date();
  const daysSinceSource = Math.floor((Date.now() - sourceDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceSource <= 7) {
    result.confidence = Math.min(0.95, result.confidence + 0.05);
    result.reason += ' (recent data bonus)';
  } else if (daysSinceSource > 90) {
    result.confidence = result.confidence * 0.9;
    result.reason += ' (stale data penalty)';
  }

  return result;
}

function getReasonableBounds(importType: string, trade: string): { min: number; max: number } {
  // Define reasonable price ranges by type and trade
  const bounds: Record<string, Record<string, { min: number; max: number }>> = {
    material_price: {
      lumber: { min: 0.50, max: 500 },
      drywall: { min: 5, max: 100 },
      electrical: { min: 0.10, max: 1000 },
      plumbing: { min: 1, max: 2000 },
      default: { min: 0.10, max: 5000 },
    },
    labor_rate: {
      framing: { min: 1, max: 25 },
      drywall: { min: 0.50, max: 15 },
      electrical: { min: 50, max: 200 },
      plumbing: { min: 50, max: 200 },
      default: { min: 15, max: 150 },
    },
  };

  const typeMap = bounds[importType] || bounds.material_price;
  return typeMap[trade] || typeMap.default;
}

async function updateKnowledgeBase(supabase: any, item: any, confidence: number) {
  const { data: existing } = await supabase
    .from('construction_knowledge')
    .select('*')
    .eq('key', item.extracted_key)
    .eq('knowledge_type', item.import_type.replace('_price', '_cost'))
    .maybeSingle();

  if (existing) {
    // Update with running statistics
    const samples = existing.sample_count + 1;
    const newAvg = ((existing.avg_value * existing.sample_count) + item.extracted_value) / samples;
    
    // Calculate running std deviation (Welford's algorithm simplified)
    const variance = existing.std_deviation ? Math.pow(existing.std_deviation, 2) : 0;
    const newVariance = variance + ((item.extracted_value - existing.avg_value) * (item.extracted_value - newAvg)) / samples;
    const newStdDev = Math.sqrt(Math.max(0, newVariance));

    await supabase
      .from('construction_knowledge')
      .update({
        value: item.extracted_value,
        avg_value: newAvg,
        min_value: Math.min(existing.min_value || Infinity, item.extracted_value),
        max_value: Math.max(existing.max_value || -Infinity, item.extracted_value),
        std_deviation: newStdDev,
        sample_count: samples,
        confidence_score: Math.min(0.95, confidence),
        last_validated_at: new Date().toISOString(),
        data_freshness_days: 0,
      })
      .eq('id', existing.id);
  } else {
    // Insert new knowledge
    await supabase
      .from('construction_knowledge')
      .insert({
        knowledge_type: item.import_type.replace('_price', '_cost'),
        trade: item.extracted_trade,
        key: item.extracted_key,
        display_name: formatDisplayName(item.extracted_key),
        value: item.extracted_value,
        unit: item.extracted_unit || 'EA',
        avg_value: item.extracted_value,
        min_value: item.extracted_value,
        max_value: item.extracted_value,
        sample_count: 1,
        confidence_score: confidence * 0.8, // Lower initial confidence
        last_validated_at: new Date().toISOString(),
        data_freshness_days: 0,
        primary_sources: item.data_source_id ? [item.data_source_id] : [],
      });
  }
}

function formatDisplayName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function recalculateAllConfidence(supabase: any) {
  console.log('[data-validator] Recalculating all confidence scores...');

  const { data: knowledge } = await supabase
    .from('construction_knowledge')
    .select('id, sample_count, last_validated_at, confidence_score');

  if (!knowledge) return;

  for (const item of knowledge) {
    let newConfidence = item.confidence_score;

    // Sample count factor (more samples = higher confidence, asymptotic to 0.95)
    const sampleFactor = Math.min(0.95, 0.3 + (0.65 * (1 - Math.exp(-item.sample_count / 30))));
    
    // Freshness factor
    const lastValidated = new Date(item.last_validated_at);
    const daysSince = Math.floor((Date.now() - lastValidated.getTime()) / (1000 * 60 * 60 * 24));
    const freshnessFactor = Math.max(0.5, 1 - (daysSince / 365)); // Decay over a year

    newConfidence = sampleFactor * freshnessFactor;

    await supabase
      .from('construction_knowledge')
      .update({ 
        confidence_score: newConfidence,
        data_freshness_days: daysSince,
      })
      .eq('id', item.id);
  }

  console.log('[data-validator] Recalculated confidence for', knowledge.length, 'items');
}

async function decayOldData(supabase: any) {
  console.log('[data-validator] Decaying old data confidence...');

  // Reduce confidence for data not updated in 30+ days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: oldData } = await supabase
    .from('construction_knowledge')
    .select('id, confidence_score')
    .lt('last_validated_at', thirtyDaysAgo);

  if (!oldData) return;

  for (const item of oldData) {
    const newConfidence = Math.max(0.3, item.confidence_score * 0.95); // Decay by 5%, floor at 0.3
    
    await supabase
      .from('construction_knowledge')
      .update({ confidence_score: newConfidence })
      .eq('id', item.id);
  }

  console.log('[data-validator] Decayed confidence for', oldData.length, 'old items');
}

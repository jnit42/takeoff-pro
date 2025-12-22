/**
 * Receipt OCR Edge Function
 * Uses Lovable AI (Gemini Vision) to extract structured data from receipt/invoice images
 * SECURITY: Requires JWT auth, verifies project ownership before writing
 * LEARNING: Automatically learns labor rates from parsed receipts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedLineItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface ExtractionResult {
  vendor_name: string | null;
  receipt_date: string | null;
  receipt_number: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  line_items: ExtractedLineItem[];
  confidence: number;
  raw_text: string;
}

// Labor keywords for detecting labor line items
const LABOR_KEYWORDS = [
  'labor', 'install', 'demo', 'demolition', 'hour', 'hrs', 'hr',
  'service', 'work', 'repair', 'maintenance', 'finish', 'hang',
  'tape', 'mud', 'sand', 'paint', 'frame', 'framing', 'electric',
  'plumb', 'plumbing', 'hvac', 'rough', 'trim', 'tile', 'floor'
];

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

async function verifyProjectOwnership(userId: string, projectId: string): Promise<boolean> {
  if (!projectId) return false;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: project } = await serviceClient
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (project as any)?.user_id === userId;
}

// ========================================
// LABOR RATE LEARNING
// ========================================

function isLaborItem(description: string): boolean {
  const lower = description.toLowerCase();
  return LABOR_KEYWORDS.some(keyword => lower.includes(keyword));
}

function normalizeTaskKey(description: string): string {
  // Convert "Drywall Hang & Finish" -> "drywall_hang_finish"
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

function inferTrade(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('drywall') || lower.includes('sheetrock') || lower.includes('tape') || lower.includes('mud')) return 'Drywall';
  if (lower.includes('frame') || lower.includes('stud') || lower.includes('carpent')) return 'Framing';
  if (lower.includes('electric') || lower.includes('wire') || lower.includes('outlet')) return 'Electrical';
  if (lower.includes('plumb') || lower.includes('pipe') || lower.includes('drain')) return 'Plumbing';
  if (lower.includes('paint') || lower.includes('primer')) return 'Paint';
  if (lower.includes('hvac') || lower.includes('duct') || lower.includes('heating')) return 'HVAC';
  if (lower.includes('tile') || lower.includes('floor')) return 'Flooring';
  if (lower.includes('demo')) return 'Demo';
  return 'General';
}

function inferUnit(description: string, quantity: number): string {
  const lower = description.toLowerCase();
  if (lower.includes('hour') || lower.includes('hr')) return 'HR';
  if (lower.includes('sf') || lower.includes('sq ft') || lower.includes('square')) return 'SF';
  if (lower.includes('lf') || lower.includes('linear')) return 'LF';
  if (quantity === 1) return 'JOB'; // Flat rate job
  return 'EA';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function learnLaborRatesFromReceipt(supabase: any, userId: string, lineItems: ExtractedLineItem[]): Promise<number> {
  let learnedCount = 0;

  for (const item of lineItems) {
    if (!isLaborItem(item.description)) continue;
    if (!item.unit_price || item.unit_price <= 0) continue;

    const taskKey = normalizeTaskKey(item.description);
    const trade = inferTrade(item.description);
    const unit = inferUnit(item.description, item.quantity);

    console.log(`[receipt-ocr] Learning labor rate: ${taskKey} = $${item.unit_price}/${unit}`);

    // UPSERT to labor_rate_calibration
    const { error } = await supabase
      .from('labor_rate_calibration')
      .upsert({
        user_id: userId,
        trade,
        task_key: taskKey,
        base_rate: item.unit_price,
        unit,
        sample_count: 1,
        last_used_at: new Date().toISOString(),
        modifiers_json: { source: 'receipt_ocr' }
      }, {
        onConflict: 'user_id,trade,task_key',
        ignoreDuplicates: false
      });

    if (error) {
      // If conflict, update with weighted average
      const { data: existing } = await supabase
        .from('labor_rate_calibration')
        .select('base_rate, sample_count')
        .eq('user_id', userId)
        .eq('trade', trade)
        .eq('task_key', taskKey)
        .single();

      if (existing) {
        // Weighted average of rates
        const newSampleCount = (existing.sample_count || 1) + 1;
        const newRate = ((existing.base_rate * (existing.sample_count || 1)) + item.unit_price) / newSampleCount;

        await supabase
          .from('labor_rate_calibration')
          .update({
            base_rate: Math.round(newRate * 100) / 100,
            sample_count: newSampleCount,
            last_used_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('trade', trade)
          .eq('task_key', taskKey);
      }
    }

    learnedCount++;
  }

  return learnedCount;
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
    console.error('[receipt-ocr] Auth failed:', auth.error);
    return new Response(
      JSON.stringify({ error: auth.error || 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = auth.userId;

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[receipt-ocr] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageUrl, imageBase64, projectId, receiptId } = await req.json();

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Either imageUrl or imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // SECURITY: Verify project ownership before any DB writes
    // ========================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (projectId) {
      const ownsProject = await verifyProjectOwnership(userId, projectId);
      if (!ownsProject) {
        console.error('[receipt-ocr] Access denied: user does not own project');
        return new Response(
          JSON.stringify({ error: 'Access denied: you do not own this project' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[receipt-ocr] Processing receipt for user:', userId);

    // Build the image content for the API
    let imageContent: { type: string; image_url?: { url: string }; };
    
    if (imageBase64) {
      imageContent = {
        type: "image_url",
        image_url: {
          url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
        }
      };
    } else {
      imageContent = {
        type: "image_url",
        image_url: { url: imageUrl }
      };
    }

    const systemPrompt = `You are an expert receipt and invoice OCR system. Extract structured data from receipt/invoice images with high accuracy.

EXTRACTION RULES:
1. Extract vendor/store name from the top of the receipt
2. Find the date in various formats (MM/DD/YYYY, YYYY-MM-DD, etc.) - normalize to YYYY-MM-DD
3. Find receipt/invoice number if present
4. Extract each line item with:
   - Description (product name)
   - Quantity (default 1 if not shown)
   - Unit (EA, LF, SF, HR, JOB, etc. - infer from context)
   - Unit price
   - Line total
5. Find subtotal, tax, and total amounts

LABOR DETECTION:
- Look for labor charges (installation, service, hourly work)
- Extract hourly rates or per-unit labor costs
- Common labor terms: Labor, Install, Demo, Service, Hour, HR, Work, Repair

RESPOND WITH VALID JSON ONLY:
{
  "vendor_name": "Store Name",
  "receipt_date": "2024-01-15",
  "receipt_number": "12345",
  "subtotal": 100.00,
  "tax_amount": 7.00,
  "total_amount": 107.00,
  "line_items": [
    {
      "description": "2x4x8 SPF Stud",
      "quantity": 10,
      "unit": "EA",
      "unit_price": 3.98,
      "total": 39.80
    },
    {
      "description": "Drywall Install Labor",
      "quantity": 500,
      "unit": "SF",
      "unit_price": 2.50,
      "total": 1250.00
    }
  ],
  "confidence": 0.95,
  "raw_text": "Full text extracted from receipt..."
}`;

    console.log('[receipt-ocr] Calling Lovable AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: 'Extract all data from this receipt/invoice image. Pay special attention to labor charges and hourly rates. Return only valid JSON.' },
              imageContent
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[receipt-ocr] AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted, please add funds' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    let extracted: ExtractionResult;
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error('[receipt-ocr] Failed to parse AI response');
      extracted = {
        vendor_name: null,
        receipt_date: null,
        receipt_number: null,
        subtotal: null,
        tax_amount: null,
        total_amount: null,
        line_items: [],
        confidence: 0.1,
        raw_text: content
      };
    }

    // ========================================
    // NEW: Learn labor rates from receipt
    // ========================================
    let learnedRatesCount = 0;
    if (extracted.line_items && extracted.line_items.length > 0) {
      learnedRatesCount = await learnLaborRatesFromReceipt(supabase, userId, extracted.line_items);
      if (learnedRatesCount > 0) {
        console.log(`[receipt-ocr] Learned ${learnedRatesCount} labor rates from receipt`);
      }
    }

    // Update the receipt record (ownership already verified)
    if (receiptId && projectId) {
      const { error: updateError } = await supabase
        .from('receipts')
        .update({
          vendor_name: extracted.vendor_name,
          receipt_date: extracted.receipt_date,
          receipt_number: extracted.receipt_number,
          subtotal: extracted.subtotal,
          tax_amount: extracted.tax_amount,
          total_amount: extracted.total_amount,
          line_items: extracted.line_items,
          ocr_status: 'completed',
          ocr_confidence: extracted.confidence,
          ocr_raw_text: extracted.raw_text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiptId)
        .eq('project_id', projectId); // Double-check project ownership

      if (updateError) {
        console.error('[receipt-ocr] Failed to update receipt:', updateError);
      }
    }

    console.log('[receipt-ocr] Extraction complete');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extracted,
        learned_rates: learnedRatesCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[receipt-ocr] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

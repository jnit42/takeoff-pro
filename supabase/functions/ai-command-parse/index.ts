import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedAction {
  type: string;
  params: Record<string, unknown>;
  confidence: number;
}

interface ParseResult {
  success: boolean;
  actions: ParsedAction[];
  followUpQuestions: string[];
  message?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, projectContext } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[AI Parse] LOVABLE_API_KEY not configured, using fallback');
      // Fallback to simple patterns
      return new Response(
        JSON.stringify(parseWithSimplePatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AI Parse] Input:', message);
    console.log('[AI Parse] Context:', projectContext);

    const systemPrompt = `You are a command parser for a construction estimating application. Convert natural language into structured actions.

Available action types:
- project.create: Create a new project. Params: { name: string }
- project.set_defaults: Set project defaults. Params: { markup_percent?, tax_percent?, labor_burden_percent?, waste_percent? }
- takeoff.add_item: Add a takeoff item. Params: { description: string, quantity: number, unit: string, unit_cost?: number, category?: string }
- takeoff.generate_drafts_from_assemblies: Generate draft items from assemblies. Params: { assemblies: string[] }
- takeoff.promote_drafts: Promote draft items to final. Params: { scope: 'all' | 'selected' }
- takeoff.delete_drafts: Delete draft items. Params: { scope: 'all' | 'selected' }
- export.pdf: Export project as PDF. Params: {}
- export.csv: Export as CSV. Params: { which: 'takeoff' | 'labor' | 'all' }
- qa.show_issues: Show QA issues. Params: {}
- plans.open: Open plan files. Params: { plan_file_id?: string, page?: number }
- labor.add_task_line: Add labor task. Params: { task_name: string, quantity: number, unit: string, rate?: number }

Rules:
1. Extract the user's intent and map to available actions
2. If info is missing, include follow-up questions  
3. Be generous in interpretation - "add some drywall" means add a takeoff item
4. Numbers can be spelled out (e.g., "fifteen percent" = 15)
5. Common abbreviations: sqft/sf = square feet, lf = linear feet, ea = each
6. If you can't determine the action, return success: false with a helpful message
7. Multiple commands can be in one sentence (e.g., "set markup 20 and export pdf")

Respond with JSON only (no markdown):
{
  "success": boolean,
  "actions": [{ "type": "action.type", "params": {...}, "confidence": 0.0-1.0 }],
  "followUpQuestions": ["question1?"],
  "message": "optional explanation"
}`;

    const userPrompt = `Parse this command: "${message}"

Project context: ${JSON.stringify(projectContext || { projectId: null })}`;

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
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Parse] Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Fallback to simple patterns on error
      console.log('[AI Parse] Falling back to simple patterns');
      return new Response(
        JSON.stringify(parseWithSimplePatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log('[AI Parse] Raw response:', content);

    if (!content) {
      return new Response(
        JSON.stringify(parseWithSimplePatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response, handling markdown code blocks
    let parsed: ParseResult;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('[AI Parse] Failed to parse JSON:', e, content);
      return new Response(
        JSON.stringify(parseWithSimplePatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AI Parse] Parsed result:', parsed);

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI Parse] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simple pattern-based parsing (fallback when LLM unavailable)
function parseWithSimplePatterns(message: string): ParseResult {
  const lower = message.toLowerCase();
  const actions: ParsedAction[] = [];
  const questions: string[] = [];

  // Export patterns
  if (/export.*pdf|pdf.*export|download.*pdf/i.test(lower)) {
    actions.push({ type: 'export.pdf', params: {}, confidence: 0.9 });
  }
  
  if (/export.*csv|csv.*export/i.test(lower)) {
    actions.push({ type: 'export.csv', params: { which: 'takeoff' }, confidence: 0.9 });
  }

  // Promote drafts
  if (/promote.*draft|finalize|make.*active|approve.*draft/i.test(lower)) {
    actions.push({ type: 'takeoff.promote_drafts', params: { scope: 'all' }, confidence: 0.85 });
  }

  // Delete drafts
  if (/delete.*draft|remove.*draft|clear.*draft/i.test(lower)) {
    actions.push({ type: 'takeoff.delete_drafts', params: { scope: 'all' }, confidence: 0.85 });
  }

  // Set markup/tax/waste/burden - handle multiple in one command
  const markupMatch = /markup.*?(\d+)\s*%?/i.exec(lower);
  const taxMatch = /tax.*?(\d+)\s*%?/i.exec(lower);
  const wasteMatch = /waste.*?(\d+)\s*%?/i.exec(lower);
  const burdenMatch = /burden.*?(\d+)\s*%?/i.exec(lower);
  
  if (markupMatch || taxMatch || wasteMatch || burdenMatch) {
    const params: Record<string, number> = {};
    if (markupMatch) params.markup_percent = parseInt(markupMatch[1]);
    if (taxMatch) params.tax_percent = parseInt(taxMatch[1]);
    if (wasteMatch) params.waste_percent = parseInt(wasteMatch[1]);
    if (burdenMatch) params.labor_burden_percent = parseInt(burdenMatch[1]);
    
    actions.push({ type: 'project.set_defaults', params, confidence: 0.9 });
  }

  // QA issues
  if (/show.*(?:qa|issues|problems)|check.*quality|review/i.test(lower)) {
    actions.push({ type: 'qa.show_issues', params: {}, confidence: 0.9 });
  }

  // Add takeoff item patterns
  const addMatch = /add\s+(?:(?:some|more)\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*(sf|sqft|lf|ea|each|square\s*feet?|linear\s*feet?)/i.exec(lower);
  if (addMatch) {
    const unitMap: Record<string, string> = {
      'sf': 'SF', 'sqft': 'SF', 'square feet': 'SF', 'square foot': 'SF',
      'lf': 'LF', 'linear feet': 'LF', 'linear foot': 'LF',
      'ea': 'EA', 'each': 'EA'
    };
    actions.push({
      type: 'takeoff.add_item',
      params: {
        description: addMatch[1].trim(),
        quantity: parseFloat(addMatch[2]),
        unit: unitMap[addMatch[3].toLowerCase()] || 'EA',
        category: 'General'
      },
      confidence: 0.8
    });
  }

  // Generate from assemblies
  if (/generate.*(?:draft|takeoff)|create.*from.*assembl/i.test(lower)) {
    const assemblies: string[] = [];
    if (/framing/i.test(lower)) assemblies.push('framing');
    if (/drywall/i.test(lower)) assemblies.push('drywall');
    if (/electrical/i.test(lower)) assemblies.push('electrical');
    if (/plumbing/i.test(lower)) assemblies.push('plumbing');
    if (/flooring/i.test(lower)) assemblies.push('flooring');
    
    if (assemblies.length > 0) {
      actions.push({
        type: 'takeoff.generate_drafts_from_assemblies',
        params: { assemblies },
        confidence: 0.85
      });
    } else {
      questions.push('Which assemblies would you like to use? (e.g., framing, drywall, electrical)');
    }
  }

  // Open plans
  if (/open.*plan|view.*plan|show.*plan/i.test(lower)) {
    actions.push({ type: 'plans.open', params: {}, confidence: 0.8 });
  }

  // Help
  if (/help|what can you do|\?$/i.test(lower)) {
    return {
      success: true,
      actions: [{ type: 'system.capabilities', params: {}, confidence: 1 }],
      followUpQuestions: [],
      message: 'Showing available commands'
    };
  }

  if (actions.length === 0) {
    return {
      success: false,
      actions: [],
      followUpQuestions: [],
      message: 'I couldn\'t understand that. Try something like "set markup 20%" or "add drywall 500 sf" or "export PDF".'
    };
  }

  return {
    success: true,
    actions,
    followUpQuestions: questions
  };
}

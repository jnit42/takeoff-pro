import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

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

// Construction knowledge embedded in the function
const CONSTRUCTION_KNOWLEDGE = `
## MATERIAL COVERAGE RATES
- Drywall (4x8 sheet): covers 32 SF, typical waste 10%
- Formula: sheets needed = (wall SF + ceiling SF) / 32 * 1.10
- Studs (16" OC): 0.75 studs per linear foot of wall
- R-13 insulation: 1 SF per SF of wall, 5% waste
- LVP flooring: 1 SF per SF of floor, 10% waste
- Baseboard: 1 LF per LF of perimeter, 10% waste

## TYPICAL QUANTITIES FOR BASEMENT FINISH (1000 SF example)
- Wall framing: ~150 LF of walls = ~113 studs + plates
- Drywall: ~1800 SF (walls + ceiling) = ~62 sheets
- Insulation: ~1200 SF of walls = ~1260 SF of R-13
- Outlets: 1 per 80 SF = ~12-15 outlets
- Recessed lights: 1 per 50 SF = ~20 lights
- Flooring: 1000 SF + 10% = ~1100 SF

## ESTIMATING FORMULAS
- Wall SF = wall LF × wall height
- Perimeter LF ≈ 2 × (length + width)
- For rectangular room: perimeter ≈ 4 × sqrt(floor SF)
- Ceiling SF = floor SF (typically)

## TRADES & CATEGORIES
- Framing: studs, plates, headers, blocking
- Drywall: sheets, mud, tape, screws, corner bead
- Electrical: outlets, switches, lights, wire, boxes, panel
- Plumbing: fixtures, pipe, fittings, valves
- Flooring: LVP, carpet, tile, underlayment, transitions
- Insulation: batts, foam, vapor barrier
- Trim: baseboard, casing, crown, doors

## TYPICAL COSTS (material only, installed is 2-3x)
- Drywall sheet: $10-18
- 2x4 stud: $3-8
- Outlet installed: $75-150
- Recessed light installed: $100-250
- LVP per SF: $2-8
- Baseboard per LF: $3-10
`;

serve(async (req) => {
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Fetch project data if we have a projectId
    let projectData = null;
    let takeoffSummary = '';
    
    if (projectContext?.projectId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Get project details
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectContext.projectId)
        .single();
      
      if (project) {
        projectData = project;
        
        // Get takeoff items summary
        const { data: takeoffItems } = await supabase
          .from('takeoff_items')
          .select('category, description, quantity, unit, unit_cost, draft')
          .eq('project_id', projectContext.projectId)
          .limit(50);
        
        if (takeoffItems && takeoffItems.length > 0) {
          const byCategory = takeoffItems.reduce((acc: Record<string, typeof takeoffItems>, item) => {
            acc[item.category] = acc[item.category] || [];
            acc[item.category].push(item);
            return acc;
          }, {});
          
          takeoffSummary = Object.entries(byCategory)
            .map(([cat, items]) => `${cat}: ${items.length} items`)
            .join(', ');
        }
      }
    }

    console.log('[AI Parse] Input:', message);
    console.log('[AI Parse] Project:', projectData?.name);
    console.log('[AI Parse] Takeoff:', takeoffSummary);

    if (!LOVABLE_API_KEY) {
      console.log('[AI Parse] No API key, using pattern fallback');
      return new Response(
        JSON.stringify(parseWithPatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an AI assistant for a construction estimating application. You understand construction trades, materials, quantities, and estimating practices.

${CONSTRUCTION_KNOWLEDGE}

## CURRENT PROJECT CONTEXT
${projectData ? `
Project: ${projectData.name}
Markup: ${projectData.markup_percent || 0}%
Tax: ${projectData.tax_percent || 0}%
Waste: ${projectData.waste_percent || 0}%
Labor Burden: ${projectData.labor_burden_percent || 0}%
Current Takeoff: ${takeoffSummary || 'No items yet'}
` : 'No project selected'}

## YOUR CAPABILITIES
You can help users by:
1. Suggesting what materials they need based on scope (e.g., "I'm finishing a 1000 SF basement")
2. Calculating quantities using the formulas above
3. Converting their natural language into structured actions
4. Asking clarifying questions when information is missing

## AVAILABLE ACTIONS
- project.set_defaults: Set markup, tax, waste, or burden. Params: { markup_percent?, tax_percent?, waste_percent?, labor_burden_percent? }
- takeoff.add_item: Add material. Params: { description, quantity, unit, unit_cost?, category? }
- takeoff.add_multiple: Add multiple items. Params: { items: [{ description, quantity, unit, unit_cost?, category }] }
- takeoff.generate_drafts_from_assemblies: Generate from assembly templates. Params: { assemblies: string[], variables?: { floorSF?, wallLF?, wallHeight?, roomCount? } }
- takeoff.promote_drafts: Finalize drafts. Params: { scope: 'all' }
- takeoff.delete_drafts: Delete drafts. Params: { scope: 'all' }
- export.pdf: Export PDF. Params: {}
- export.csv: Export CSV. Params: { which: 'takeoff' | 'labor' | 'all' }
- qa.show_issues: Show QA issues. Params: {}

## RESPONSE FORMAT
Always respond with valid JSON (no markdown):
{
  "success": true/false,
  "actions": [{ "type": "action.type", "params": {...}, "confidence": 0.0-1.0 }],
  "followUpQuestions": ["clarifying question?"],
  "message": "Brief explanation of what you're proposing",
  "suggestions": ["related thing you might want to do next"]
}

## IMPORTANT RULES
1. When user describes scope (e.g., "1000 SF basement"), calculate quantities and propose takeoff.add_multiple
2. Use the formulas above to estimate - be specific with numbers
3. If you need more info, ask in followUpQuestions
4. Be conversational but action-oriented
5. When adding items, ALWAYS include calculated quantities based on scope`;

    const userPrompt = `User says: "${message}"

Based on the project context and construction knowledge, determine what actions to take. If the user is describing a scope or project, calculate the materials needed and propose adding them as takeoff items.`;

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
          JSON.stringify({ error: 'Rate limit exceeded. Try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify(parseWithPatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log('[AI Parse] Raw response:', content);

    if (!content) {
      return new Response(
        JSON.stringify(parseWithPatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed: ParseResult;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      
      parsed = JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('[AI Parse] JSON parse failed:', e);
      // Try to extract just the message for conversational response
      return new Response(
        JSON.stringify({
          success: false,
          actions: [],
          followUpQuestions: [],
          message: content.slice(0, 500),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AI Parse] Success:', parsed);
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

// Pattern-based fallback
function parseWithPatterns(message: string): ParseResult {
  const lower = message.toLowerCase();
  const actions: ParsedAction[] = [];

  // Export
  if (/export.*pdf|download.*pdf/i.test(lower)) {
    actions.push({ type: 'export.pdf', params: {}, confidence: 0.9 });
  }
  if (/export.*csv/i.test(lower)) {
    actions.push({ type: 'export.csv', params: { which: 'takeoff' }, confidence: 0.9 });
  }

  // Drafts
  if (/promote.*draft|finalize/i.test(lower)) {
    actions.push({ type: 'takeoff.promote_drafts', params: { scope: 'all' }, confidence: 0.85 });
  }
  if (/delete.*draft|clear.*draft/i.test(lower)) {
    actions.push({ type: 'takeoff.delete_drafts', params: { scope: 'all' }, confidence: 0.85 });
  }

  // Settings
  const markupMatch = /markup.*?(\d+)/i.exec(lower);
  const taxMatch = /tax.*?(\d+)/i.exec(lower);
  const wasteMatch = /waste.*?(\d+)/i.exec(lower);
  
  if (markupMatch || taxMatch || wasteMatch) {
    const params: Record<string, number> = {};
    if (markupMatch) params.markup_percent = parseInt(markupMatch[1]);
    if (taxMatch) params.tax_percent = parseInt(taxMatch[1]);
    if (wasteMatch) params.waste_percent = parseInt(wasteMatch[1]);
    actions.push({ type: 'project.set_defaults', params, confidence: 0.9 });
  }

  // QA
  if (/show.*(?:qa|issues)|review/i.test(lower)) {
    actions.push({ type: 'qa.show_issues', params: {}, confidence: 0.9 });
  }

  // Help
  if (/help|what can/i.test(lower)) {
    return {
      success: true,
      actions: [{ type: 'system.capabilities', params: {}, confidence: 1 }],
      followUpQuestions: [],
    };
  }

  if (actions.length === 0) {
    return {
      success: false,
      actions: [],
      followUpQuestions: [],
      message: 'I need more details. Try describing your project scope (e.g., "I\'m finishing a 1000 SF basement") or a specific action (e.g., "set markup to 20%").',
    };
  }

  return { success: true, actions, followUpQuestions: [] };
}

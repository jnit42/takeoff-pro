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

// Accurate construction knowledge - formulas verified
const CONSTRUCTION_KNOWLEDGE = `
## FRAMING - ACCURATE FORMULAS

### Stud Count (16" OC - standard)
- Formula: studs = (wall LF × 12 / 16) + 1 per wall section
- Simplified: studs = wall LF × 0.75, then round up
- Add 1 stud per corner (4 corners = 4 extra studs)
- Add 2 studs per door/window opening (king + trimmer each side)

### Plates
- Bottom plate: 1 LF per 1 LF wall (SINGLE) - use PT (pressure treated) on concrete
- Top plate: 2 LF per 1 LF wall (DOUBLE top plate is code)
- Total plate LF = wall LF × 3

### Example: 20×30 room (8' ceiling, no doors/windows)
- Perimeter = 2×(20+30) = 100 LF
- Studs at 16" OC: 100 × 0.75 = 75 studs + 4 corners = 79 studs
- PT bottom plate: 100 LF (on concrete)
- Top plates: 200 LF (doubled)
- Total plate stock: 100 ÷ 8' = 13 bottom plates + 200 ÷ 8' = 25 top plates

### Standard stud lengths
- 8' ceiling: use 92-5/8" precut studs or 8' studs
- 9' ceiling: use 104-5/8" precut or 10' studs
- 10' ceiling: use 116-5/8" precut or 10' studs

## DRYWALL - ACCURATE FORMULAS

### Sheet coverage
- 4×8 sheet = 32 SF
- 4×12 sheet = 48 SF (fewer seams, preferred for ceilings)

### Quantity calculation
- Wall SF = perimeter LF × wall height
- Ceiling SF = floor SF (length × width)
- Total SF = wall SF + ceiling SF
- Sheets = total SF ÷ sheet size × waste factor (1.10 for 10% waste)

### Example: 20×30 room, 8' walls, finishing ceiling
- Wall SF = 100 LF × 8' = 800 SF
- Ceiling SF = 20 × 30 = 600 SF
- Total = 1400 SF
- 4×8 sheets: 1400 × 1.10 ÷ 32 = 48 sheets
- OR 4×12 sheets: 1400 × 1.10 ÷ 48 = 32 sheets

### Drywall accessories (per 1000 SF)
- Joint compound: 3-4 gallons (or 1 5-gal bucket per 500 SF)
- Tape: 1 roll (500') per 500 SF
- Screws: 1 lb per 100 SF (10 lbs per 1000 SF)
- Corner bead: measure all outside corners LF

## INSULATION

### Batt insulation
- Exterior walls: R-13 or R-15 (3.5" batts for 2×4 walls)
- Basement walls: R-13 typical, check local code
- Coverage: 1 SF per 1 SF of wall, +5% waste
- Kraft-faced for vapor barrier in basement

## ELECTRICAL (basement typical)

### Code minimums
- Outlets: 1 per 12 LF of wall (not per SF)
- No point on wall more than 6' from outlet
- Typical room: perimeter ÷ 12 = outlet count
- Switches: 1-2 per room (entry points)
- Lighting: 1 fixture per 50-100 SF

### Example: 20×30 room
- Perimeter = 100 LF
- Outlets: 100 ÷ 12 = 9 outlets minimum

## SMART DEFAULTS (use these, don't ask)

### Basement assumptions (unless told otherwise)
- Ceiling height: 8' (standard)
- Bottom plates: PT lumber on concrete
- Exterior walls: insulated with vapor barrier
- Include ceiling drywall (finishing the space)
- Standard 16" OC framing

### Don't over-ask
- If room dimensions given → calculate and propose
- If "basement" mentioned → use basement defaults
- Only ask about: doors, windows, special finishes
- Skip questions about obvious things

## COMMON MISTAKES TO AVOID

1. Don't multiply studs × 3 for plates - plates are linear, not per-stud
2. Don't forget corners add studs
3. Don't mix up LF and EA
4. Bottom plate on concrete MUST be pressure treated
5. Top plates are ALWAYS doubled (code requirement)
6. Don't ask obvious questions - use smart defaults
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, projectContext, pendingActions, conversationHistory, isFollowUp } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AI Parse] Conversation history:', conversationHistory?.length || 0, 'messages');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Fetch comprehensive project data
    let projectData = null;
    let takeoffItems: any[] = [];
    let laborItems: any[] = [];
    let assumptions: any[] = [];
    let rfis: any[] = [];
    
    if (projectContext?.projectId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectContext.projectId)
        .single();
      
      if (project) {
        projectData = project;
        
        const { data: items } = await supabase
          .from('takeoff_items')
          .select('*')
          .eq('project_id', projectContext.projectId)
          .order('category', { ascending: true });
        
        if (items) takeoffItems = items;
        
        const { data: labor } = await supabase
          .from('labor_line_items')
          .select('*, labor_estimates!inner(project_id)')
          .eq('labor_estimates.project_id', projectContext.projectId);
        
        if (labor) laborItems = labor;
        
        const { data: assumps } = await supabase
          .from('assumptions')
          .select('*')
          .eq('project_id', projectContext.projectId);
        
        if (assumps) assumptions = assumps;
        
        const { data: rfiData } = await supabase
          .from('rfis')
          .select('*')
          .eq('project_id', projectContext.projectId);
        
        if (rfiData) rfis = rfiData;
      }
    }

    const takeoffSummary = buildTakeoffSummary(takeoffItems);
    const laborSummary = buildLaborSummary(laborItems);
    const projectSummary = buildProjectSummary(projectData, takeoffItems, laborItems, assumptions, rfis);

    console.log('[AI Parse] Input:', message);
    console.log('[AI Parse] Project:', projectData?.name);

    if (!LOVABLE_API_KEY) {
      console.log('[AI Parse] No API key, using pattern fallback');
      return new Response(
        JSON.stringify(parseWithPatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert construction estimator. You know framing, drywall, electrical, plumbing - the whole trade. You calculate accurately and don't waste the user's time with obvious questions.

${CONSTRUCTION_KNOWLEDGE}

## CURRENT PROJECT
${projectSummary}

## EXISTING TAKEOFF
${takeoffSummary || 'Empty - no items yet.'}

## EXISTING LABOR
${laborSummary || 'None yet.'}

## YOUR STYLE
- ACCURATE: Use the formulas above exactly. Double-check your math.
- CONCISE: Don't ask questions you can answer with smart defaults.
- CONFIDENT: State what you're adding. Don't hedge or say "I think".
- COMPLETE: Include all materials needed (studs, plates, accessories).

## WHEN USER GIVES DIMENSIONS
Calculate immediately using these steps:
1. Perimeter = 2 × (length + width)
2. Wall SF = perimeter × height (assume 8' if not specified)
3. Ceiling SF = length × width (include unless told otherwise)
4. Apply formulas from knowledge base
5. Propose items with EXACT quantities

## ACTIONS
- takeoff.add_multiple: { items: [{ description, quantity, unit, category }] }
- takeoff.add_item: { description, quantity, unit, category }
- project.set_defaults: { markup_percent?, tax_percent?, waste_percent? }
- takeoff.promote_drafts: { scope: 'all' }
- export.pdf: {}
- qa.show_issues: {}

## RESPONSE FORMAT (JSON only, no markdown)
{
  "success": true,
  "actions": [{ "type": "takeoff.add_multiple", "params": { "items": [...] }, "confidence": 0.95 }],
  "followUpQuestions": [],
  "message": "Brief explanation of what you calculated"
}

## RULES
1. CALCULATE quantities - never guess or use placeholders
2. Use smart defaults - don't ask about ceiling height, PT plates, etc.
3. Only ask about doors/windows if it significantly affects the estimate
4. Include ALL related materials (if drywall, include mud/tape/screws)
5. Separate line items by trade category
6. For basement: always use PT bottom plate, include insulation if exterior walls

## FOLLOW-UP HANDLING
If the user is refining a previous proposal, incorporate their feedback:
- If they question a quantity, explain your math clearly
- If they want changes (e.g., "make it 24 on center"), recalculate and return updated actions
- If they ask "why", explain without re-proposing (set actions to empty array)
- Keep the conversation natural - they can refine multiple times before confirming`;

    // Build user prompt based on context
    let userPrompt = `"${message}"`;
    
    if (isFollowUp && pendingActions) {
      userPrompt = `Current pending proposal:
${pendingActions}

User says: "${message}"

If they're asking a question, answer it clearly. If they're requesting a change, recalculate and return updated actions. If explaining, set actions to empty array.`;
    } else {
      userPrompt += `\n\nCalculate quantities using the formulas. Be accurate and complete.`;
    }

    console.log('[AI Parse] Is follow-up:', isFollowUp);

    // Build messages array with conversation history for context
    const aiMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history if available (for context)
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-8)) { // Last 8 messages for context
        aiMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content.slice(0, 500) // Truncate long messages
        });
      }
    }

    // Add current user message
    aiMessages.push({ role: 'user', content: userPrompt });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
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
      return new Response(
        JSON.stringify({
          success: true,
          actions: [],
          followUpQuestions: [],
          message: content.slice(0, 1000),
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

function buildTakeoffSummary(items: any[]): string {
  if (!items || items.length === 0) return '';
  
  const byCategory: Record<string, any[]> = {};
  let totalCost = 0;
  
  for (const item of items) {
    const cat = item.category || 'Uncategorized';
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(item);
    if (item.extended_cost) totalCost += item.extended_cost;
  }
  
  let summary = `Total: ${items.length} items, $${totalCost.toLocaleString()}\n`;
  
  for (const [category, catItems] of Object.entries(byCategory)) {
    summary += `\n${category}:\n`;
    for (const item of catItems.slice(0, 5)) {
      summary += `- ${item.description}: ${item.quantity} ${item.unit}\n`;
    }
    if (catItems.length > 5) summary += `  ... +${catItems.length - 5} more\n`;
  }
  
  return summary;
}

function buildLaborSummary(items: any[]): string {
  if (!items || items.length === 0) return '';
  
  let total = 0;
  let summary = '';
  
  for (const item of items) {
    total += item.extended || 0;
    summary += `- ${item.task_name}: ${item.quantity} ${item.unit}\n`;
  }
  
  return summary + `Total: $${total.toLocaleString()}`;
}

function buildProjectSummary(project: any, takeoff: any[], labor: any[], assumptions: any[], rfis: any[]): string {
  if (!project) return 'No project selected.';
  
  const takeoffTotal = takeoff.reduce((sum, i) => sum + (i.extended_cost || 0), 0);
  const laborTotal = labor.reduce((sum, i) => sum + (i.extended || 0), 0);
  
  return `Project: ${project.name}
Markup: ${project.markup_percent || 0}% | Tax: ${project.tax_percent || 0}% | Waste: ${project.waste_percent || 0}%
Items: ${takeoff.length} | Material: $${takeoffTotal.toLocaleString()} | Labor: $${laborTotal.toLocaleString()}`;
}

function parseWithPatterns(message: string): ParseResult {
  const lower = message.toLowerCase();
  const actions: ParsedAction[] = [];

  if (/export.*pdf/i.test(lower)) {
    actions.push({ type: 'export.pdf', params: {}, confidence: 0.9 });
  }
  if (/export.*csv/i.test(lower)) {
    actions.push({ type: 'export.csv', params: { which: 'takeoff' }, confidence: 0.9 });
  }
  if (/promote.*draft|finalize/i.test(lower)) {
    actions.push({ type: 'takeoff.promote_drafts', params: { scope: 'all' }, confidence: 0.85 });
  }
  if (/delete.*draft/i.test(lower)) {
    actions.push({ type: 'takeoff.delete_drafts', params: { scope: 'all' }, confidence: 0.85 });
  }

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

  if (/show.*(?:qa|issues)/i.test(lower)) {
    actions.push({ type: 'qa.show_issues', params: {}, confidence: 0.9 });
  }
  if (/help|what can/i.test(lower)) {
    return { success: true, actions: [{ type: 'system.capabilities', params: {}, confidence: 1 }], followUpQuestions: [] };
  }

  if (actions.length === 0) {
    return {
      success: false,
      actions: [],
      followUpQuestions: [],
      message: "Give me dimensions (e.g., '20×30 basement room') or a direct command (e.g., 'set markup to 20%').",
    };
  }

  return { success: true, actions, followUpQuestions: [] };
}

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

// Comprehensive construction knowledge
const CONSTRUCTION_KNOWLEDGE = `
## MATERIAL COVERAGE RATES & ESTIMATING

### Drywall
- 4x8 sheet = 32 SF, 4x12 = 48 SF
- Waste factor: 10-15% (use 10% standard)
- Formula: sheets = (total SF × 1.10) ÷ sheet size
- Mud: 1 gallon per 100 SF
- Tape: 1 roll (500') per 500 SF
- Screws: 1 lb per 100 SF

### Framing
- Studs at 16" OC: 0.75 studs per LF of wall
- Studs at 24" OC: 0.50 studs per LF of wall  
- Top/bottom plates: 1 LF per 1 LF of wall (doubled = 2x)
- Headers: varies by opening
- Blocking: ~10% extra studs

### Insulation
- R-13 batts (3.5"): 1 SF per SF of wall
- R-19 batts (6.25"): 1 SF per SF of floor/ceiling
- R-30 batts: 1 SF per SF
- Waste: 5%

### Flooring
- LVP/Laminate: 1 SF per SF + 10% waste
- Tile: 1 SF per SF + 15% waste (cuts)
- Carpet: 1 SF per SF + 5% waste
- Underlayment: 1:1 with flooring

### Electrical (rough numbers)
- Outlets: 1 per 80 SF minimum (code)
- Switches: 1-2 per room
- Recessed lights: 1 per 25-50 SF
- Wire (14/2): ~25 LF per device

### Plumbing
- Bathroom rough-in: 1 toilet, 1 sink, 1 shower/tub typical
- Kitchen rough-in: 1 sink, dishwasher, disposal

### Trim
- Baseboard: perimeter LF + 10%
- Door casing: 17 LF per door
- Window casing: ~12 LF per window
- Crown: perimeter LF + 10%

## ROOM/PROJECT CALCULATIONS

### For a rectangular room:
- Perimeter LF = 2 × (length + width)
- For square footage: perimeter ≈ 4 × √(floor SF)
- Wall SF = perimeter LF × ceiling height
- Ceiling SF ≈ floor SF

### Common room sizes:
- Small bedroom: 100-120 SF
- Master bedroom: 150-200 SF  
- Bathroom: 40-80 SF
- Living room: 200-400 SF
- Kitchen: 100-200 SF

### Basement finish typical scope (1000 SF example):
- Wall LF: ~150 LF (rectangular layout)
- Wall SF: 150 × 8' = 1200 SF
- Ceiling SF: 1000 SF
- Total drywall: 2200 SF = ~69 sheets (4x8) with 10% waste
- Studs (16" OC): 150 × 0.75 = ~113 + plates
- Outlets: 1000 ÷ 80 = ~13 minimum
- Recessed lights: 1000 ÷ 40 = ~25

## TYPICAL MATERIAL COSTS (material only)
- Drywall 4x8 1/2": $12-18/sheet
- 2x4x8 stud: $4-8
- 2x4x10 stud: $6-10
- R-13 insulation: $0.50-1.00/SF
- LVP flooring: $2-5/SF
- Baseboard: $2-8/LF
- Interior door (prehung): $80-200
- Outlet/switch: $2-5 each
- Wire 14/2 (250'): $50-80

## TRADES
- Demo/Prep
- Framing
- Rough Electrical
- Rough Plumbing
- HVAC
- Insulation
- Drywall
- Paint
- Flooring
- Trim/Finish
- Finish Electrical
- Finish Plumbing
- Cleanup
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

    // Fetch comprehensive project data
    let projectData = null;
    let takeoffItems: any[] = [];
    let laborItems: any[] = [];
    let assumptions: any[] = [];
    let rfis: any[] = [];
    
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
        
        // Get ALL takeoff items (not just 50)
        const { data: items } = await supabase
          .from('takeoff_items')
          .select('*')
          .eq('project_id', projectContext.projectId)
          .order('category', { ascending: true });
        
        if (items) takeoffItems = items;
        
        // Get labor estimates
        const { data: labor } = await supabase
          .from('labor_line_items')
          .select('*, labor_estimates!inner(project_id)')
          .eq('labor_estimates.project_id', projectContext.projectId);
        
        if (labor) laborItems = labor;
        
        // Get assumptions
        const { data: assumps } = await supabase
          .from('assumptions')
          .select('*')
          .eq('project_id', projectContext.projectId);
        
        if (assumps) assumptions = assumps;
        
        // Get RFIs
        const { data: rfiData } = await supabase
          .from('rfis')
          .select('*')
          .eq('project_id', projectContext.projectId);
        
        if (rfiData) rfis = rfiData;
      }
    }

    // Build detailed context string
    const takeoffSummary = buildTakeoffSummary(takeoffItems);
    const laborSummary = buildLaborSummary(laborItems);
    const projectSummary = buildProjectSummary(projectData, takeoffItems, laborItems, assumptions, rfis);

    console.log('[AI Parse] Input:', message);
    console.log('[AI Parse] Project:', projectData?.name);
    console.log('[AI Parse] Items:', takeoffItems.length, 'takeoff,', laborItems.length, 'labor');

    if (!LOVABLE_API_KEY) {
      console.log('[AI Parse] No API key, using pattern fallback');
      return new Response(
        JSON.stringify(parseWithPatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert construction estimator AI assistant. You have deep knowledge of construction trades, materials, quantities, labor, and estimating practices. You speak confidently and knowledgeably - like a seasoned superintendent or estimator who knows their craft inside and out.

${CONSTRUCTION_KNOWLEDGE}

## CURRENT PROJECT STATE
${projectSummary}

## DETAILED TAKEOFF
${takeoffSummary || 'No items in takeoff yet.'}

## LABOR ESTIMATES
${laborSummary || 'No labor estimates yet.'}

## YOUR PERSONALITY
- You are CONFIDENT. You know construction. You don't say "I think" or "maybe" - you state facts.
- You are HELPFUL. You proactively suggest what the user might need.
- You are THOROUGH. When asked about the project, give real details from the data.
- You CALCULATE. When asked about quantities, use the formulas and give specific numbers.
- You REMEMBER. Reference what's already in the project when relevant.

## WHAT YOU CAN DO
1. **Report on Project Status**: Tell users exactly what's in their project, what's missing, totals, etc.
2. **Calculate Quantities**: Given dimensions or scope, calculate exactly how much material is needed.
3. **Add/Modify Items**: Add takeoff items, labor, set project defaults.
4. **Suggest Next Steps**: Based on what's in the project, suggest what they should add next.
5. **Answer Questions**: About construction methods, materials, best practices.

## AVAILABLE ACTIONS
- project.set_defaults: { markup_percent?, tax_percent?, waste_percent?, labor_burden_percent? }
- takeoff.add_item: { description, quantity, unit, unit_cost?, category?, spec?, vendor?, notes? }
- takeoff.add_multiple: { items: [{ description, quantity, unit, unit_cost?, category? }] }
- takeoff.update_item: { id, updates: { quantity?, unit_cost?, notes?, category? } }
- takeoff.delete_item: { id }
- takeoff.generate_drafts_from_assemblies: { assemblies: string[], variables?: { floorSF?, wallLF?, wallHeight?, roomCount? } }
- takeoff.promote_drafts: { scope: 'all' }
- takeoff.delete_drafts: { scope: 'all' }
- labor.add_task_line: { task_name, quantity, unit, base_rate?, notes? }
- export.pdf: {}
- export.csv: { which: 'takeoff' | 'labor' | 'all' }
- qa.show_issues: {}
- navigate.plans: {}
- navigate.takeoff: {}
- navigate.labor: {}

## RESPONSE FORMAT (STRICT JSON)
{
  "success": true/false,
  "actions": [{ "type": "action.type", "params": {...}, "confidence": 0.0-1.0 }],
  "followUpQuestions": [],
  "message": "Your confident, helpful response",
  "suggestions": ["Next thing to consider"]
}

## CRITICAL RULES
1. If user asks about the project, REPORT from the actual data above - be specific!
2. If user describes scope, CALCULATE quantities using formulas, then propose takeoff.add_multiple
3. If user asks about dimensions/rooms without data, TELL THEM what you need to know
4. When adding items, always include CALCULATED quantities, not placeholders
5. Be conversational but action-oriented
6. If you can't do something, explain what you CAN do instead
7. Reference actual items/totals from the project when relevant`;

    const userPrompt = `User says: "${message}"

Respond confidently based on the project data and your construction knowledge. If they're asking about the project, tell them what you know. If they want to add things, calculate the quantities. Be specific and helpful.`;

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
      // Return as conversational response
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

// Build detailed takeoff summary
function buildTakeoffSummary(items: any[]): string {
  if (!items || items.length === 0) return '';
  
  const byCategory: Record<string, any[]> = {};
  let totalCost = 0;
  let draftCount = 0;
  
  for (const item of items) {
    const cat = item.category || 'Uncategorized';
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(item);
    
    if (item.extended_cost) totalCost += item.extended_cost;
    if (item.draft) draftCount++;
  }
  
  let summary = `Total Items: ${items.length} (${draftCount} drafts)\nTotal Material Cost: $${totalCost.toLocaleString()}\n\n`;
  
  for (const [category, catItems] of Object.entries(byCategory)) {
    const catTotal = catItems.reduce((sum, i) => sum + (i.extended_cost || 0), 0);
    summary += `### ${category} (${catItems.length} items, $${catTotal.toLocaleString()})\n`;
    
    for (const item of catItems.slice(0, 10)) { // Limit per category
      const draft = item.draft ? ' [DRAFT]' : '';
      const cost = item.extended_cost ? ` = $${item.extended_cost.toLocaleString()}` : '';
      summary += `- ${item.description}: ${item.quantity} ${item.unit}${cost}${draft}\n`;
    }
    
    if (catItems.length > 10) {
      summary += `- ... and ${catItems.length - 10} more items\n`;
    }
    summary += '\n';
  }
  
  return summary;
}

// Build labor summary
function buildLaborSummary(items: any[]): string {
  if (!items || items.length === 0) return '';
  
  let total = 0;
  let summary = '';
  
  for (const item of items) {
    const ext = item.extended || 0;
    total += ext;
    summary += `- ${item.task_name}: ${item.quantity} ${item.unit} × $${item.final_rate || item.base_rate}/unit = $${ext.toLocaleString()}\n`;
  }
  
  summary += `\nTotal Labor: $${total.toLocaleString()}`;
  return summary;
}

// Build overall project summary
function buildProjectSummary(project: any, takeoff: any[], labor: any[], assumptions: any[], rfis: any[]): string {
  if (!project) return 'No project selected.';
  
  const takeoffTotal = takeoff.reduce((sum, i) => sum + (i.extended_cost || 0), 0);
  const laborTotal = labor.reduce((sum, i) => sum + (i.extended || 0), 0);
  const draftCount = takeoff.filter(i => i.draft).length;
  const openRfis = rfis.filter(r => r.status !== 'closed').length;
  
  return `
Project: ${project.name}
Status: ${project.status || 'Active'}
Address: ${project.address || 'Not set'}

Settings:
- Markup: ${project.markup_percent || 0}%
- Tax: ${project.tax_percent || 0}%
- Waste Factor: ${project.waste_percent || 0}%
- Labor Burden: ${project.labor_burden_percent || 0}%

Current Totals:
- Takeoff Items: ${takeoff.length} (${draftCount} are drafts)
- Material Cost: $${takeoffTotal.toLocaleString()}
- Labor Cost: $${laborTotal.toLocaleString()}
- Combined: $${(takeoffTotal + laborTotal).toLocaleString()}
- Assumptions: ${assumptions.length}
- Open RFIs: ${openRfis}
`;
}

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
      message: "I need more specific information to help. You can describe your project scope (e.g., '1000 SF basement with 3 rooms'), ask about what's in this project, or give a direct command like 'set markup to 20%'.",
    };
  }

  return { success: true, actions, followUpQuestions: [] };
}

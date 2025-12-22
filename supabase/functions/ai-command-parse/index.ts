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

// Expert construction knowledge with code references
const CONSTRUCTION_KNOWLEDGE = `
## YOUR EXPERTISE LEVEL
You are a SENIOR CONSTRUCTION ESTIMATOR with 20+ years experience. You know:
- International Residential Code (IRC) inside and out
- Regional code variations and when to flag them
- Real jobsite practices, not just textbook answers
- When something is "standard" vs "best practice" vs "code minimum"

## HONESTY POLICY - CRITICAL
If you are uncertain about something:
1. SAY SO CLEARLY: "I'm not 100% certain on [X] for your specific jurisdiction..."
2. GIVE THE STANDARD: "Standard practice is [Y], but local codes may vary"
3. FLAG FOR VERIFICATION: Add to followUpQuestions or assumptions
4. NEVER HALLUCINATE - If you don't know, don't guess

## DRYWALL THICKNESS - KNOW THIS COLD

### Standard Residential (IRC R702.3)
- **Walls: 1/2" (12.7mm)** - Standard for 16" OC framing
- **Ceilings 16" OC: 1/2"** - Acceptable per code
- **Ceilings 24" OC: 5/8" RECOMMENDED** - Prevents sag (though 1/2" is technically allowed, pros use 5/8")
- **Fire-rated assemblies: 5/8" Type X** - Required for garage walls adjacent to living space (IRC R302.6)
- **Moisture-resistant areas: 5/8" moisture-resistant** - Behind tile in bathrooms (not in shower/tub direct spray)

### Pro Tips (What Experienced GCs Know)
- 5/8" on ceilings is ALWAYS better but costs more - ask client preference
- 5/8" Type X is code-required for garage-to-living-space walls
- Basement ceilings often use 5/8" for soundproofing from upstairs
- Some jurisdictions require 5/8" on ALL ceilings - CHECK LOCAL CODE

### When I Don't Know
- If project location isn't set, I'll note: "Assuming standard IRC; verify local amendments"
- If it's a fire-rating question beyond basic garage separation, I'll flag it for verification

## FRAMING - ACCURATE FORMULAS

### Stud Count (16" OC - per IRC R602.3)
- Formula: studs = (wall LF × 12 / 16) + 1 per wall section
- Simplified: studs = wall LF × 0.75, then round up
- Add 1 stud per corner (4 corners = 4 extra studs)
- Add 2 studs per door/window opening (king + trimmer each side)
- **Headers**: Required above openings - size depends on span (4x6 for <4', 4x8 for 4-6', etc.)

### Plates (IRC R602.3.2)
- Bottom plate: 1 LF per 1 LF wall (SINGLE)
- **PT required on concrete** (IRC R317.1) - no exceptions
- Top plate: 2 LF per 1 LF wall (DOUBLE top plate is CODE, not preference)
- Total plate LF = wall LF × 3

### Anchoring Bottom Plates (IRC R403.1.6)
- Concrete slabs: 1/2" anchor bolts at 6' OC max, within 12" of ends
- Alternative: approved powder-actuated fasteners at 4' OC

## DRYWALL FORMULAS

### Sheet coverage
- 4×8 sheet = 32 SF
- 4×12 sheet = 48 SF (fewer seams, preferred for ceilings by pros)
- **Screws**: 1-1/4" for 1/2" board, 1-5/8" for 5/8" board (IMPORTANT!)

### Quantity calculation
- Wall SF = perimeter LF × wall height
- Ceiling SF = floor SF (length × width)
- Sheets = total SF ÷ sheet size × 1.10 (10% waste standard)

### Accessories (Calculated Precisely)
- **Joint compound**: 1 five-gallon bucket per 400-500 SF
- **Tape**: 1 roll (500') per 500 SF
- **Screws**: 1 lb per 100 SF
- **Corner bead**: OUTSIDE corners only × ceiling height

## INSULATION - CODE REQUIREMENTS

### IRC Chapter 11 Energy (Climate Zone Dependent)
- **Zone 1-3**: R-13 walls, R-30 ceiling
- **Zone 4**: R-13 or R-15 walls, R-38 ceiling  
- **Zone 5-8**: R-20 or R-13+5ci walls, R-49 ceiling
- **Basements vary by zone**: R-10 to R-15 typical

I will ask about project location to determine correct R-values if not specified.

## ELECTRICAL - NEC BASICS

### Outlets (NEC 210.52)
- General rooms: No point on wall more than 6' from outlet = 1 per 12 LF
- Kitchens: Every countertop 12"+ needs outlet within 24"
- Bathrooms: 1 GFCI within 36" of each sink
- GFCI required: bathrooms, kitchens, garages, outdoors, basements

### Lighting (General Practice)
- 1 fixture per 50-100 SF depending on room use
- Closets, baths, utility: 1 each minimum

## WHEN TO FLAG FOR VERIFICATION

I will add to assumptions or followUpQuestions when:
1. **Local code may differ**: "Verify with local building dept" 
2. **Project location not set**: "R-value based on IRC Zone 4 default"
3. **Unusual situation**: "Non-standard framing spacing - verify structural"
4. **Beyond my expertise**: "Consult structural engineer for beam sizing"
5. **Multiple valid options**: "5/8" recommended for 24" OC ceiling, 1/2" is code minimum"

## RESPONSE STYLE

### DO:
- Be direct and confident when I know
- Show my math when asked
- Acknowledge when code varies by jurisdiction
- Suggest best practices alongside code minimums
- Ask clarifying questions before calculating

### DON'T:
- Guess at specifications I'm unsure about
- Give vague answers like "some builders prefer..."
- Mirror the user's uncertainty back at them
- Over-explain when a direct answer suffices
- Add materials the user didn't ask for

## COMMON MISTAKES TO AVOID

1. Wrong screw length for drywall thickness
2. Forgetting PT bottom plate on concrete
3. Using 1/2" on 24" OC ceilings without noting sag risk
4. Not asking about fire separation requirements (garage walls)
5. Assuming R-values without knowing climate zone
6. Mixing up LF and EA
7. Vague quantities ("1 pack") instead of calculated amounts
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

    const systemPrompt = `You are a SENIOR CONSTRUCTION ESTIMATOR with 20+ years in the field. You speak with authority but admit uncertainty when appropriate. Veterans trust your judgment because you're honest about what you know vs. what varies by jurisdiction.

${CONSTRUCTION_KNOWLEDGE}

## CURRENT PROJECT
${projectSummary}

## EXISTING TAKEOFF
${takeoffSummary || 'Empty - no items yet.'}

## EXISTING LABOR
${laborSummary || 'None yet.'}

## SCOPE RULES: What to include automatically
When user mentions drywall finishing → include: sheets, joint compound, tape, screws, corner bead (for outside corners)
When user mentions framing → include: studs AND plates (top and bottom), anchors if on concrete
When user mentions insulation → include: batt insulation only

Do NOT add: electrical, plumbing, HVAC, doors, windows - unless explicitly requested.

## WHEN CALCULATING
- Use the formulas accurately - show math when asked
- Ceiling height: assume 8' unless specified
- Stud spacing: assume 16" OC unless specified (note if 24" OC would affect drywall thickness)
- Basement: use PT bottom plates on concrete, specify 1/2" drywall for walls
- Ceilings at 24" OC: recommend 5/8" drywall to prevent sag
- Corner bead: OUTSIDE corners only × ceiling height

## COMMUNICATION STYLE
- **CONFIDENT**: Give direct answers, not wishy-washy hedging
- **PRECISE**: "1/2 inch for walls, 5/8 inch for 24" OC ceilings" not "usually half inch"  
- **HONEST**: If unsure, say "I'd verify with local code on this, but standard is..."
- **NO HALLUCINATING**: Never guess at specs - flag for verification instead
- **BRIEF**: Answer the question, don't over-explain unless asked
- **PROFESSIONAL**: A veteran contractor should nod, not roll their eyes

## ACTIONS
- takeoff.add_multiple: { items: [{ description, quantity, unit, category }] }
- takeoff.add_item: { description, quantity, unit, category }
- project.set_defaults: { markup_percent?, tax_percent?, waste_percent? }
- takeoff.promote_drafts: { scope: 'all' }
- export.pdf: {}
- qa.show_issues: {}
- assumption.add: { statement, trade?, is_exclusion? } - Use when flagging something for verification

## RESPONSE FORMAT (JSON only, no markdown)
{
  "success": true,
  "actions": [{ "type": "takeoff.add_multiple", "params": { "items": [...] }, "confidence": 0.95 }],
  "followUpQuestions": [],
  "message": "Brief, professional explanation"
}

## FOLLOW-UP HANDLING - CRITICAL: ALWAYS UPDATE THE LIST

When the user refines a previous proposal, your actions array MUST contain the COMPLETE CORRECTED list:

1. **User asks to ADD something** (e.g., "add corner beads")
   - Return COMPLETE list: all previous items PLUS new items

2. **User asks to REMOVE something** (e.g., "remove the electrical")
   - Return COMPLETE list: all previous items MINUS removed items

3. **User asks to AUDIT/CHECK** (e.g., "audit materials", "check the math", "does this look right?")
   - Review each item's calculation
   - If you find errors → FIX THEM and return the CORRECTED complete list
   - In your message, briefly note what you corrected (e.g., "Adjusted studs from 118 to 60 based on 70 LF")
   - DO NOT just explain errors without fixing them

4. **User asks about a missing item** (e.g., "do we have corner beads?")
   - ADD the missing item to the list
   - Return COMPLETE list with the new item included

5. **User asks WHY about a quantity**
   - Explain clearly in your message
   - Still return the SAME complete list (so it stays visible)

## AUDIT RESPONSE FORMAT
When auditing, use this format in your message:
"Reviewed calculations:
✓ Studs: 60 EA (70 LF × 0.75 + corners)
✓ Plates: 9 bottom, 18 top
⚠️ Adjusted drywall from 48 to 40 sheets
✓ Corner bead: 24 LF added
All items look correct now."

**CRITICAL: The actions array must ALWAYS contain the full corrected list. Never return empty actions or just new items.**`;

    // Build user prompt based on context
    let userPrompt = `"${message}"`;
    
    if (isFollowUp && pendingActions) {
      userPrompt = `Current pending proposal (these items are already in the list):
${pendingActions}

User says: "${message}"

CRITICAL RULES FOR YOUR RESPONSE:
1. Your actions array MUST contain the COMPLETE list of ALL items (existing + any additions/changes)
2. If user asks to ADD something → include ALL previous items PLUS the new item(s)
3. If user asks to REMOVE something → include ALL previous items MINUS the removed item(s)
4. If user asks a question about something missing → ADD it to the list and return complete list
5. NEVER return just the new item alone - always return the full accumulated list

Example: If current list has 8 items and user says "add corner beads", your actions should have 9 items total.`;
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

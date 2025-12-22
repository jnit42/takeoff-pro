/**
 * AI Command Parse - Parses natural language into structured actions
 * SECURITY: Requires JWT auth, verifies project ownership
 * PROPOSE-ONLY: Returns proposed actions for user confirmation
 */

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyProjectOwnership(supabase: any, userId: string, projectId: string): Promise<boolean> {
  if (!projectId) return true;

  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single();

  return project?.user_id === userId;
}

// Expert construction knowledge
const CONSTRUCTION_KNOWLEDGE = `
## YOUR EXPERTISE LEVEL
You are a SENIOR CONSTRUCTION ESTIMATOR with 20+ years experience.

## HONESTY POLICY - CRITICAL
If you are uncertain about something:
1. SAY SO CLEARLY
2. GIVE THE STANDARD
3. FLAG FOR VERIFICATION
4. NEVER HALLUCINATE

## DRYWALL THICKNESS
- Walls: 1/2"
- Ceilings 16" OC: 1/2"
- Ceilings 24" OC: 5/8" RECOMMENDED
- Fire-rated: 5/8" Type X

## FRAMING FORMULAS
- Studs 16" OC: wall LF × 0.75, round up + corners + openings
- Plates: wall LF × 3 (1 bottom + 2 top)

## DRYWALL FORMULAS
- 4×8 sheet = 32 SF
- Sheets = total SF ÷ 32 × 1.10 (10% waste)

## COMMUNICATION STYLE
- CONFIDENT: Direct answers
- PRECISE: Specific specs
- HONEST: Flag uncertainties
- BRIEF: Answer the question
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ========================================
  // SECURITY: Authenticate
  // ========================================
  const auth = await authenticateRequest(req);
  
  if (!auth.authenticated || !auth.userId) {
    console.error('[AI Parse] Auth failed:', auth.error);
    return new Response(
      JSON.stringify({ error: auth.error || 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = auth.userId;

  try {
    const { message, projectContext, pendingActions, conversationHistory, isFollowUp } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let supabase: ReturnType<typeof createClient> | null = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }

    // ========================================
    // SECURITY: Verify project ownership
    // ========================================
    if (projectContext?.projectId && supabase) {
      const ownsProject = await verifyProjectOwnership(supabase, userId, projectContext.projectId);
      if (!ownsProject) {
        console.error('[AI Parse] Access denied: user does not own project');
        return new Response(
          JSON.stringify({ error: 'Access denied: you do not own this project' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[AI Parse] Processing for user:', userId);

    // Fetch project data (only for owned project)
    let projectData = null;
    let takeoffItems: unknown[] = [];
    let laborItems: unknown[] = [];
    let assumptions: unknown[] = [];
    let rfis: unknown[] = [];
    let userKnowledge: unknown[] = [];
    
    if (projectContext?.projectId && supabase) {
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

    // Load user's learned knowledge (only their own)
    if (supabase) {
      const { data: knowledge } = await supabase
        .from('ai_knowledge')
        .select('category, key, value, confidence')
        .eq('user_id', userId)
        .order('usage_count', { ascending: false })
        .limit(50);
      
      if (knowledge) userKnowledge = knowledge;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const takeoffSummary = buildTakeoffSummary(takeoffItems as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const laborSummary = buildLaborSummary(laborItems as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectSummary = buildProjectSummary(projectData as any, takeoffItems as any, laborItems as any, assumptions, rfis);
    
    const knowledgeContext = userKnowledge.length > 0 
      ? `## USER'S LEARNED PREFERENCES\n${(userKnowledge as KnowledgeItem[]).map((k) => `- ${k.category}: "${k.key}" → ${JSON.stringify(k.value)}`).join('\n')}`
      : '';

    console.log('[AI Parse] Input:', message);

    if (!LOVABLE_API_KEY) {
      console.log('[AI Parse] No API key, using pattern fallback');
      return new Response(
        JSON.stringify(parseWithPatterns(message)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a SENIOR CONSTRUCTION ESTIMATOR. You PROPOSE actions that the user must confirm.

CRITICAL: You are PROPOSE-ONLY. You suggest actions but NEVER write directly.
All proposed actions will be shown to the user for confirmation before execution.

${CONSTRUCTION_KNOWLEDGE}

## CURRENT PROJECT
${projectSummary}

## EXISTING TAKEOFF
${takeoffSummary || 'Empty - no items yet.'}

## EXISTING LABOR
${laborSummary || 'None yet.'}

${knowledgeContext}

## PRICING RULES
- Use price book entries when available
- Use knowledge base historical data
- Leave price blank if unknown (do NOT guess)
- NEVER use web-scraped prices

## ACTIONS (proposals only)
- takeoff.add_multiple: { items: [{ description, quantity, unit, category, unit_cost? }] }
- takeoff.add_item: { description, quantity, unit, category, unit_cost? }
- project.set_defaults: { markup_percent?, tax_percent?, waste_percent? }
- takeoff.promote_drafts: { scope: 'all' }
- export.pdf: {}
- qa.show_issues: {}
- assumption.add: { statement, trade?, is_exclusion? }
- learn.terminology: { term, meaning, context? }
- learn.preference: { preference, value }

## RESPONSE FORMAT (JSON only)
{
  "success": true,
  "actions": [{ "type": "takeoff.add_multiple", "params": { "items": [...] }, "confidence": 0.95 }],
  "followUpQuestions": [],
  "message": "Brief explanation"
}`;

    let userPrompt = `"${message}"`;
    
    if (isFollowUp && pendingActions) {
      userPrompt = `Current pending proposal:\n${pendingActions}\n\nUser says: "${message}"\n\nReturn COMPLETE updated list.`;
    }

    const aiMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-8)) {
        aiMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content.slice(0, 500)
        });
      }
    }

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
      jsonStr = jsonStr.trim();
      
      if (!jsonStr.startsWith('{')) {
        const jsonMatch = jsonStr.match(/\{[\s\S]*"success"\s*:\s*(true|false)[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }
      
      parsed = JSON.parse(jsonStr);
      
      if (typeof parsed.success !== 'boolean') {
        throw new Error('Invalid response structure');
      }
    } catch {
      return new Response(
        JSON.stringify({
          success: true,
          actions: [],
          followUpQuestions: [],
          message: content.slice(0, 1500),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

// Types for helpers
interface TakeoffItem {
  category?: string;
  description: string;
  quantity: number;
  unit: string;
  extended_cost?: number;
}

interface LaborItem {
  task_name: string;
  quantity: number;
  unit: string;
  extended?: number;
}

interface KnowledgeItem {
  category: string;
  key: string;
  value: unknown;
}

function buildTakeoffSummary(items: TakeoffItem[]): string {
  if (!items || items.length === 0) return '';
  
  const byCategory: Record<string, TakeoffItem[]> = {};
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

function buildLaborSummary(items: LaborItem[]): string {
  if (!items || items.length === 0) return '';
  
  let total = 0;
  let summary = '';
  
  for (const item of items) {
    total += item.extended || 0;
    summary += `- ${item.task_name}: ${item.quantity} ${item.unit}\n`;
  }
  
  return summary + `Total: $${total.toLocaleString()}`;
}

interface ProjectData {
  name: string;
  markup_percent?: number;
  tax_percent?: number;
  waste_percent?: number;
}

function buildProjectSummary(project: ProjectData | null, takeoff: TakeoffItem[], labor: LaborItem[], _assumptions: unknown[], _rfis: unknown[]): string {
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
      message: "Give me dimensions (e.g., '20×30 basement room') or a direct command.",
    };
  }

  return { success: true, actions, followUpQuestions: [] };
}

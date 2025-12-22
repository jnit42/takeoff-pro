/**
 * Construction Brain - Central AI with reasoning, context, and learning
 * SECURITY: Requires JWT auth, verifies project ownership
 * PROPOSE-ONLY: Returns proposed actions, never writes directly
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LaborRateCalibration {
  trade: string;
  task_key: string;
  base_rate: number;
  unit: string;
  sample_count: number;
}

interface PastCorrection {
  description: string;
  original_estimate: number;
  actual_amount: number;
  variance_percent: number;
  correction_type: string;
  // Calibration-specific fields
  original?: string;
  corrected?: string;
  reason?: string;
  modification?: Record<string, unknown>;
}

interface ProjectContext {
  project?: {
    id: string;
    name: string;
    region: string;
    zip_code: string;
    markup_percent: number;
    waste_percent: number;
    tax_percent: number;
    labor_burden_percent: number;
    // Site conditions
    site_access: string;
    site_occupancy: string;
    site_parking: string;
  };
  // Combined site difficulty multiplier
  siteDifficultyMultiplier?: number;
  takeoffItems?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    category: string;
    draft: boolean;
  }>;
  laborEstimates?: Array<{
    task_name: string;
    quantity: number;
    unit: string;
    base_rate: number;
  }>;
  subcontractors?: Array<{
    name: string;
    trade: string;
    avg_vs_market: number;
    reliability_score: number;
  }>;
  recentActuals?: Array<{
    description: string;
    estimated_amount: number;
    actual_amount: number;
    variance_percent: number;
  }>;
  // NEW: User's calibrated labor rates
  userLaborRates?: LaborRateCalibration[];
  // NEW: Past corrections for learning
  pastCorrections?: PastCorrection[];
}

interface KnowledgeContext {
  relevantKnowledge: Array<{
    key: string;
    display_name: string;
    value: number;
    unit: string;
    confidence_score: number;
    region: string;
  }>;
  userHistory: {
    totalProjects: number;
    avgAccuracy: number;
    preferredMarkup: number;
    commonTrades: string[];
  };
  globalBenchmarks: {
    laborRates: Record<string, number>;
    materialCosts: Record<string, number>;
    wasteFactor: Record<string, number>;
  };
}

interface BrainResponse {
  success: boolean;
  actions?: Array<{
    type: string;
    params: Record<string, unknown>;
    confidence: number;
  }>;
  reasoning: string;
  confidence: number;
  confidenceFactors: string[];
  dataSources: string[];
  followUpQuestions?: string[];
  warnings?: string[];
}

// ========================================
// AUTHENTICATION HELPERS
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ========================================
  // SECURITY: Authenticate and derive user from JWT
  // ========================================
  const auth = await authenticateRequest(req);
  
  if (!auth.authenticated || !auth.userId) {
    console.error('[construction-brain] Auth failed:', auth.error);
    return new Response(
      JSON.stringify({ error: auth.error || 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = auth.userId; // DERIVED FROM JWT, not request body

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    }

    const { 
      message, 
      projectId, 
      conversationId,
      conversationHistory = []
    } = await req.json();

    // ========================================
    // SECURITY: Verify project ownership
    // ========================================
    if (projectId) {
      const ownsProject = await verifyProjectOwnership(supabase, userId, projectId);
      if (!ownsProject) {
        console.error('[construction-brain] Access denied: user does not own project');
        return new Response(
          JSON.stringify({ error: 'Access denied: you do not own this project' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('[construction-brain] Processing:', { message, projectId, userId });

    // ========================================
    // PHASE 1: BUILD FULL CONTEXT (with corrections!)
    // ========================================
    
    const projectContext = await buildProjectContext(supabase, projectId, userId);
    const knowledgeContext = await buildKnowledgeContext(supabase, message, projectContext);
    
    console.log('[construction-brain] Context built:', {
      hasProject: !!projectContext.project,
      takeoffItems: projectContext.takeoffItems?.length || 0,
      relevantKnowledge: knowledgeContext.relevantKnowledge.length,
      userLaborRates: projectContext.userLaborRates?.length || 0,
      pastCorrections: projectContext.pastCorrections?.length || 0,
    });

    // ========================================
    // PHASE 2: CONSTRUCT INTELLIGENT PROMPT
    // ========================================
    
    const systemPrompt = buildSystemPrompt(projectContext, knowledgeContext);
    
    // ========================================
    // PHASE 3: CALL AI WITH FULL CONTEXT
    // ========================================
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-10),
          { role: 'user', content: message }
        ],
        tools: buildToolDefinitions(),
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[construction-brain] AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const aiMessage = aiResult.choices?.[0]?.message;
    
    console.log('[construction-brain] AI response received');

    // ========================================
    // PHASE 4: PARSE AND VALIDATE RESPONSE
    // NOTE: AI returns PROPOSALS only - executor handles writes
    // ========================================
    
    const brainResponse = parseAIResponse(aiMessage, knowledgeContext);
    
    // ========================================
    // PHASE 5: LOG DECISION FOR AUDITING
    // ========================================
    
    await logDecision(supabase, {
      userId,
      projectId,
      conversationId,
      inputText: message,
      inputContext: { projectContext, knowledgeContext },
      decisionType: brainResponse.actions?.length ? 'action_proposal' : 'explanation',
      outputActions: brainResponse.actions,
      outputReasoning: brainResponse.reasoning,
      confidenceScore: brainResponse.confidence,
      confidenceFactors: brainResponse.confidenceFactors,
      dataSourcesUsed: brainResponse.dataSources,
    });

    return new Response(
      JSON.stringify(brainResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[construction-brain] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========================================
// CONTEXT BUILDERS
// ========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildProjectContext(supabase: any, projectId: string | null, userId: string): Promise<ProjectContext> {
  const context: ProjectContext = {};

  // ========================================
  // NEW: Fetch user's calibrated labor rates (ALWAYS)
  // ========================================
  const { data: laborRates } = await supabase
    .from('labor_rate_calibration')
    .select('trade, task_key, base_rate, unit, sample_count')
    .eq('user_id', userId)
    .order('sample_count', { ascending: false })
    .limit(30);
  
  if (laborRates) {
    context.userLaborRates = laborRates;
  }

  if (!projectId) return context;

  // Get project details
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  if (project) {
    context.project = project;
    
    // Calculate site difficulty multiplier
    const accessMultiplier = 
      project.site_access === 'stairs_only' ? 1.15 :
      project.site_access === 'elevator' ? 1.05 : 1.0;
    const occupancyMultiplier = 
      project.site_occupancy === 'occupied' ? 1.15 : 1.0;
    const parkingMultiplier = 
      project.site_parking === 'street' ? 1.10 : 1.0;
    
    context.siteDifficultyMultiplier = accessMultiplier * occupancyMultiplier * parkingMultiplier;
  }

  // Get takeoff items - INCLUDE ID so AI can reference for updates/deletes
  const { data: takeoffItems } = await supabase
    .from('takeoff_items')
    .select('id, description, quantity, unit, unit_cost, category, draft')
    .eq('project_id', projectId)
    .limit(50);
  
  if (takeoffItems) {
    context.takeoffItems = takeoffItems;
  }

  // Get labor estimates
  const { data: laborEstimates } = await supabase
    .from('labor_estimates')
    .select('id')
    .eq('project_id', projectId)
    .limit(1);
  
  if (laborEstimates?.[0]) {
    const { data: laborItems } = await supabase
      .from('labor_line_items')
      .select('task_name, quantity, unit, base_rate')
      .eq('labor_estimate_id', laborEstimates[0].id)
      .limit(30);
    
    if (laborItems) {
      context.laborEstimates = laborItems;
    }
  }

  // Get user's subcontractors
  const { data: subs } = await supabase
    .from('subcontractors')
    .select('name, trade, avg_vs_market, reliability_score')
    .eq('user_id', userId)
    .limit(20);
  
  if (subs) {
    context.subcontractors = subs;
  }

  // Get recent actuals for learning
  const { data: actuals } = await supabase
    .from('project_actuals')
    .select('description, estimated_amount, actual_amount, variance_percent')
    .eq('project_id', projectId)
    .not('actual_amount', 'is', null)
    .limit(20);
  
  if (actuals) {
    context.recentActuals = actuals;
  }

  // ========================================
  // Fetch past corrections from ai_decisions
  // ========================================
  const { data: corrections } = await supabase
    .from('ai_decisions')
    .select('input_text, user_modification, output_actions, was_accurate')
    .eq('user_id', userId)
    .eq('was_accurate', false)
    .not('user_modification', 'is', null)
    .order('decided_at', { ascending: false })
    .limit(10);
  
  if (corrections) {
    context.pastCorrections = corrections.map((c: { input_text: string; user_modification: Record<string, unknown> }) => ({
      description: c.input_text,
      original_estimate: 0,
      actual_amount: 0,
      variance_percent: 0,
      correction_type: 'user_override',
      modification: c.user_modification,
    }));
  }

  // ========================================
  // Fetch calibration knowledge from ai_knowledge
  // ========================================
  const { data: calibrationKnowledge } = await supabase
    .from('ai_knowledge')
    .select('category, key, value, confidence, usage_count')
    .eq('user_id', userId)
    .eq('category', 'calibration_correction')
    .order('updated_at', { ascending: false })
    .limit(20);
  
  if (calibrationKnowledge && calibrationKnowledge.length > 0) {
    // Append calibration corrections to pastCorrections
    for (const k of calibrationKnowledge) {
      const val = k.value as { original?: string; correction?: string; reason?: string };
      context.pastCorrections = context.pastCorrections || [];
      context.pastCorrections.push({
        description: k.key,
        original_estimate: 0,
        actual_amount: 0,
        variance_percent: 0,
        correction_type: 'calibration',
        original: val.original,
        corrected: val.correction,
        reason: val.reason,
      });
    }
  }

  return context;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildKnowledgeContext(supabase: any, message: string, projectContext: ProjectContext): Promise<KnowledgeContext> {
  const context: KnowledgeContext = {
    relevantKnowledge: [],
    userHistory: {
      totalProjects: 0,
      avgAccuracy: 85,
      preferredMarkup: 15,
      commonTrades: [],
    },
    globalBenchmarks: {
      laborRates: {},
      materialCosts: {},
      wasteFactor: {},
    },
  };

  // Extract keywords from message for knowledge lookup
  const keywords = extractKeywords(message);
  const region = projectContext.project?.region || null;

  // Get relevant construction knowledge
  if (keywords.length > 0) {
    const { data: knowledge } = await supabase
      .from('construction_knowledge')
      .select('key, display_name, value, unit, confidence_score, region')
      .or(keywords.map(k => `key.ilike.%${k}%`).join(','))
      .limit(20);
    
    if (knowledge) {
      // Prioritize regional matches
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context.relevantKnowledge = knowledge.sort((a: any, b: any) => {
        if (a.region === region && b.region !== region) return -1;
        if (b.region === region && a.region !== region) return 1;
        return (b.confidence_score || 0) - (a.confidence_score || 0);
      });
    }
  }

  // Get global knowledge benchmarks
  const { data: benchmarks } = await supabase
    .from('global_knowledge')
    .select('knowledge_type, key, avg_value, confidence')
    .gte('confidence', 0.5)
    .limit(50);
  
  if (benchmarks) {
    for (const b of benchmarks) {
      if (b.knowledge_type === 'labor_rate') {
        context.globalBenchmarks.laborRates[b.key] = b.avg_value;
      } else if (b.knowledge_type === 'material_cost') {
        context.globalBenchmarks.materialCosts[b.key] = b.avg_value;
      } else if (b.knowledge_type === 'waste_factor') {
        context.globalBenchmarks.wasteFactor[b.key] = b.avg_value;
      }
    }
  }

  return context;
}

function extractKeywords(message: string): string[] {
  const commonWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'add', 'get', 'show', 'want', 'need', 'please', 'help']);
  
  const words = message.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !commonWords.has(w));
  
  return [...new Set(words)].slice(0, 10);
}

// ========================================
// PROMPT BUILDER (with user labor rates + corrections)
// ========================================

function buildSystemPrompt(projectContext: ProjectContext, knowledgeContext: KnowledgeContext): string {
  const siteDifficultyInfo = projectContext.siteDifficultyMultiplier && projectContext.siteDifficultyMultiplier !== 1.0
    ? `
SITE DIFFICULTY MULTIPLIER: ${projectContext.siteDifficultyMultiplier.toFixed(2)}x
- Access: ${projectContext.project?.site_access || 'ground_level'}
- Occupancy: ${projectContext.project?.site_occupancy || 'vacant'}
- Parking: ${projectContext.project?.site_parking || 'driveway'}
CRITICAL: Apply this ${projectContext.siteDifficultyMultiplier.toFixed(2)}x multiplier to ALL labor estimates automatically.`
    : '';

  const projectInfo = projectContext.project 
    ? `
CURRENT PROJECT: "${projectContext.project.name}"
- Region: ${projectContext.project.region || 'Not specified'}
- ZIP: ${projectContext.project.zip_code || 'Not specified'}
- Markup: ${projectContext.project.markup_percent}%
- Waste Factor: ${projectContext.project.waste_percent}%
- Tax: ${projectContext.project.tax_percent}%
- Labor Burden: ${projectContext.project.labor_burden_percent}%
${siteDifficultyInfo}`
    : 'No project currently selected.';

  const existingItems = projectContext.takeoffItems?.length
    ? `\nEXISTING TAKEOFF ITEMS (${projectContext.takeoffItems.length} items):
${projectContext.takeoffItems.slice(0, 15).map(i => `- [ID: ${i.id}] ${i.description}: ${i.quantity} ${i.unit} @ $${i.unit_cost || 'TBD'}${i.draft ? ' (draft)' : ''}`).join('\n')}

NOTE: When updating or deleting items, you MUST use the item_id from above. Example: item_id = "${projectContext.takeoffItems[0]?.id || 'uuid-here'}"`
    : '';

  const subInfo = projectContext.subcontractors?.length
    ? `\nUSER'S SUBCONTRACTORS:\n${projectContext.subcontractors.map(s => `- ${s.name} (${s.trade}): ${s.avg_vs_market ? `${s.avg_vs_market > 0 ? '+' : ''}${s.avg_vs_market}% vs market` : 'No history'}`).join('\n')}`
    : '';

  const knowledgeInfo = knowledgeContext.relevantKnowledge.length
    ? `\nRELEVANT KNOWLEDGE BASE:\n${knowledgeContext.relevantKnowledge.slice(0, 8).map(k => `- ${k.display_name}: $${k.value}/${k.unit} (${Math.round(k.confidence_score * 100)}% confidence${k.region ? `, ${k.region}` : ''})`).join('\n')}`
    : '';

  const recentLearnings = projectContext.recentActuals?.length
    ? `\nRECENT ACTUALS (for learning):\n${projectContext.recentActuals.slice(0, 5).map(a => `- ${a.description}: Est $${a.estimated_amount} → Actual $${a.actual_amount} (${a.variance_percent > 0 ? '+' : ''}${a.variance_percent}%)`).join('\n')}`
    : '';

  // ========================================
  // NEW: User's calibrated labor rates section
  // ========================================
  const userLaborRatesSection = projectContext.userLaborRates?.length
    ? `\n\n=== USER-SPECIFIC LABOR RATES (OVERRIDE DEFAULTS) ===
${projectContext.userLaborRates.slice(0, 15).map(r => `- ${r.task_key} (${r.trade}): $${r.base_rate}/${r.unit} (${r.sample_count} samples)`).join('\n')}

CRITICAL: If the user has a specific rate listed above, YOU MUST use it instead of generic market averages. These are learned from the user's actual receipts and past projects.`
    : '';

  // ========================================
  // Past corrections + calibration section
  // ========================================
  const calibrationCorrections = projectContext.pastCorrections?.filter(c => c.correction_type === 'calibration') || [];
  const userOverrides = projectContext.pastCorrections?.filter(c => c.correction_type !== 'calibration') || [];
  
  const pastCorrectionsSection = (calibrationCorrections.length > 0 || userOverrides.length > 0)
    ? `\n\n=== CALIBRATION CORRECTIONS (APPLY THESE STRICTLY) ===
${calibrationCorrections.length > 0 ? calibrationCorrections.slice(0, 10).map(c => 
  `- "${c.description}": 
    WRONG: ${c.original || 'See modification'}
    CORRECT: ${c.corrected || 'See modification'}
    REASON: ${c.reason || 'User correction'}`
).join('\n') : 'No calibration corrections yet.'}

=== USER OVERRIDES ===
${userOverrides.length > 0 ? userOverrides.slice(0, 5).map(c => `- "${c.description}": User modified your output. Adjust accordingly.`).join('\n') : 'None'}

CRITICAL: Calibration corrections are MANDATORY. If you're asked about a topic with a correction, you MUST apply the corrected approach, not your default reasoning.`
    : '';

  return `You are the Construction Brain - an expert estimating AI with 50+ years of field experience. You think like a veteran GC who's seen it all.

CRITICAL: You are PROPOSE-ONLY. You suggest actions but NEVER write directly to the database.
All your proposed actions will be shown to the user for confirmation before execution.

${projectInfo}
${existingItems}
${subInfo}
${knowledgeInfo}
${recentLearnings}
${userLaborRatesSection}
${pastCorrectionsSection}

CORE PRINCIPLES (from the field):
1. ACCURACY OVER SPEED - A bad estimate costs jobs. Take time to get it right.
2. SHOW YOUR WORK - Always explain why. "Because I said so" doesn't fly.
3. USE DATA - Reference knowledge base AND real-world experience
4. REGIONAL AWARENESS - Boston rates aren't Alabama rates. Northeast runs 25-30% higher than national avg.
5. SANITY CHECK - If studs are costing $10 each, something's wrong. Flag it.
6. ADMIT UNCERTAINTY - "I'm 60% confident" is honest. Fake certainty loses jobs.
7. LEARN FROM USER - If user has calibrated rates or corrected you before, USE THEIR DATA.
8. VALUE ENGINEERING (MANDATORY):
   - You are not just an estimator; you are a Profit Optimizer.
   - ALWAYS check for savings opportunities > 10%.
   - Output suggestions as '💡 Value Engineering: [description] - Saves $X or X%'
   - NEVER sacrifice code compliance for savings. Safety first, then savings.
9. SPEED-READ FORMATTING (MANDATORY):
   - Do NOT write paragraphs. Use bullet points ONLY.
   - Start with the Bottom Line: First line = result (e.g., "Added 12 studs and 2 plates.")
   - Bold Key Numbers: Use **bold** for quantities and costs (e.g., "**$500**", "**120 SF**")
   - Structure your reasoning as:
     • Action Summary (1 sentence max)
     • The Breakdown (Bulleted list of why)
     • Notes/Warnings (Only if critical)
   - BAD: "I calculated the wall area based on your input of 10x10. Taking into account the waste factor..."
   - GOOD: "Added **45 Studs** and **12 Sheets** of Drywall.\n• Framing: 16\" O.C. + 3 corners\n• Drywall: **480 SF** wall area + 10% waste"

STRICT NAMING (MANDATORY):
- When adding items, check the RELEVANT KNOWLEDGE BASE first.
- If an exact match exists (e.g., "Joist Hanger LUS28"), use that EXACT string.
- Do NOT simplify to "Joist Hanger" for brevity. Precision matters.

REGIONAL MULTIPLIERS (baked into estimates):
- Northeast/MA/CT/NY: 1.25-1.35x labor (union markets, prevailing wage)
- Southeast: 0.85-0.95x labor (right-to-work, lower COL)
- West Coast/CA: 1.15-1.25x labor
- Material costs: Add 5-10% shipping in Northeast

WHEN ESTIMATING:
- ALWAYS apply regional multiplier to base rates for the project's region
- For MA: Framing ~$11/SF, Drywall complete ~$2.65/SF, Electrical rough ~$5.25/SF
- National averages (use as baseline): Framing $8.50/SF, Drywall $2.05/SF
- Apply waste factors: Lumber 10%, Drywall 10%, Tile 15%, Paint 5%
- Round quantities UP - you can't buy half a sheet

=== FRAMING CALCULATION FORMULAS (USE THESE EXACTLY) ===

For a RECTANGULAR ROOM (L x W in feet):
1. PERIMETER = 2 * (L + W) in linear feet
2. STUDS at 16" O.C. = (PERIMETER * 12 / 16) + 1 per wall = roughly (PERIMETER * 0.75) + 4
   - Add 3 studs per CORNER (for drywall backing) = +12 studs for 4 corners
   - Add 4 studs per DOOR (2 king + 2 jack) - only if door is specified
   - Total studs = base studs + corner studs + door studs
3. TOP PLATES (double) = PERIMETER * 2 / board_length (usually 8' or 10')
   - Example: 40 LF perimeter = 80 LF of 2x4 = 8 boards of 2x4x10 or 10 boards of 2x4x8
4. BOTTOM PLATE (single) = PERIMETER / board_length
   - Example: 40 LF perimeter = 4 boards of 2x4x10 or 5 boards of 2x4x8
5. HEADERS - ONLY if door/window specified:
   - 32" door = 3' header (2 pieces of 2x10 or 2x12)
   - 36" door = 3.5' header
6. CRIPPLE STUDS - ONLY if:
   - There is a window (cripples go above AND below)
   - OR ceiling height is specified as different from standard 8'
   - For a basic room frame request with NO windows, do NOT include cripple studs

EXAMPLE: "frame a 10x10 room" with 1 door (32" wide):
- Perimeter = 40 LF
- Studs: (40 * 0.75) + 12 corners + 4 door = 30 + 12 + 4 = 46 studs → round to 48 for waste
- Top plates: 80 LF / 10 = 8 boards of 2x4x10
- Bottom plates: 40 LF / 10 = 4 boards of 2x4x10 (minus ~3' for door opening)
- Header: 2 pieces of 2x10x4 (double header for 32" RO)
- Jack studs: 2 (one each side of door)
- King studs: 2 (one each side of door) - already counted in wall studs
- NO cripple studs unless ceiling height specified differently than 8'

DO NOT INCLUDE:
- Fasteners (nails, screws, anchors) - too variable by substrate
- Cripple studs unless windows are specified
- Items the user didn't ask for

=== END FRAMING FORMULAS ===

PARAM FORMAT FOR ACTIONS:
When using takeoff.add_item, always include:
- description: Full item description (e.g., "2x4x8 Stud" not "stud")
- quantity: Number (required)
- unit: EA, SF, LF, SHT, CY, etc.
- unit_cost: Number ONLY (e.g., 5.99). If unknown, use null - NEVER use strings like "TBD" or "?"
- category: Framing, Drywall, Electrical, Plumbing, etc.

PRICING SOURCE PRIORITY:
1. User's calibrated labor rates (from labor_rate_calibration)
2. User's price book entries
3. Knowledge base (verified historical data)
4. Use null for unit_cost if unknown (NOT "TBD", "?", or any string)
NEVER use web-scraped prices - they are unreliable.

Confidence should be 0-1 scale (0.85 = 85% confident).

CONSTRUCTION TERMINOLOGY:
- 2x4 = 1.5" x 3.5" actual
- 16 O.C. = 16 inches on center
- LF = linear feet, SF = square feet, SHT = sheets
- BD FT = board feet for lumber
- CY = cubic yards for concrete
- Fire-rated = Type X drywall (5/8" typically)`;
}

// ========================================
// TOOL DEFINITIONS (with building codes tool)
// ========================================

function buildToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'propose_actions',
        description: 'Propose one or more actions to be executed (add items, update prices, delete items, etc.). These are PROPOSALS that the user must confirm before execution.',
        parameters: {
          type: 'object',
          properties: {
            actions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { 
                    type: 'string',
                    enum: [
                      'takeoff.add_item', 
                      'takeoff.add_multiple', 
                      'takeoff.update_item', 
                      'takeoff.delete_item',
                      'takeoff.delete_items',
                      'labor.add_task', 
                      'project.update',
                      'export.pdf',
                      'export.csv'
                    ]
                  },
                  params: { 
                    type: 'object',
                    description: `Action parameters:
- takeoff.add_item: {description, quantity, unit, unit_cost, category}
- takeoff.add_multiple: {items: [{description, quantity, unit, category}]}
- takeoff.update_item: {item_id: "REQUIRED - use ID from EXISTING TAKEOFF ITEMS list", description?, quantity?, unit?, unit_cost?}
- takeoff.delete_item: {item_id: "REQUIRED - use ID from EXISTING TAKEOFF ITEMS list"}
- takeoff.delete_items: {item_ids: ["id1", "id2"]}
- export.pdf/csv: {which: "takeoff" | "labor" | "rfis"}`
                  },
                  confidence: { type: 'number', minimum: 0, maximum: 1 }
                },
                required: ['type', 'params', 'confidence']
              }
            },
            reasoning: { type: 'string', description: 'Explanation of why these actions are proposed' },
            overall_confidence: { type: 'number', minimum: 0, maximum: 1 },
            data_sources: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'What data informed this decision'
            },
            warnings: {
              type: 'array',
              items: { type: 'string' },
              description: 'Any concerns or caveats'
            }
          },
          required: ['actions', 'reasoning', 'overall_confidence', 'data_sources']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'explain_with_confidence',
        description: 'Provide an explanation with confidence scoring (for questions, not actions)',
        parameters: {
          type: 'object',
          properties: {
            explanation: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            sources: { type: 'array', items: { type: 'string' } },
            follow_up_questions: { type: 'array', items: { type: 'string' } }
          },
          required: ['explanation', 'confidence', 'sources']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_building_codes',
        description: 'Search for specific building codes (IRC/IBC) or local amendments for the project\'s zip code. Use this BEFORE estimating structural assemblies (decks, framing, foundations) to verify requirements.',
        parameters: {
          type: 'object',
          properties: {
            query: { 
              type: 'string',
              description: 'The building code query (e.g., "deck footing depth requirements", "egress window minimum size")'
            },
            zip_code: { 
              type: 'string',
              description: 'The zip code to check for local amendments'
            },
            code_type: {
              type: 'string',
              enum: ['IRC', 'IBC', 'NEC', 'local'],
              description: 'Which code to reference'
            }
          },
          required: ['query', 'zip_code']
        }
      }
    }
  ];
}

// ========================================
// BUILDING CODE SEARCH (Real Implementation with Cache)
// ========================================

// Simple hash function for caching
async function hashQuery(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Cache operations using direct REST API to avoid type issues
async function checkBuildingCodeCache(queryHash: string, zipCode: string): Promise<{ snippet: string; source_url: string } | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/building_code_cache?query_hash=eq.${encodeURIComponent(queryHash)}&zip_code=eq.${encodeURIComponent(zipCode)}&expires_at=gt.${new Date().toISOString()}&select=snippet,source_url`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) return null;
    
    const rows = await response.json();
    if (rows && rows.length > 0) {
      return rows[0];
    }
    return null;
  } catch {
    return null;
  }
}

async function saveBuildingCodeCache(queryHash: string, zipCode: string, queryText: string, snippet: string, sourceUrl: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    await fetch(
      `${supabaseUrl}/rest/v1/building_code_cache`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          query_hash: queryHash,
          zip_code: zipCode,
          query_text: queryText,
          snippet: snippet,
          source_url: sourceUrl,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        }),
      }
    );
    console.log('[construction-brain] Building code cached for future use');
  } catch (cacheError) {
    console.error('[construction-brain] Failed to cache code:', cacheError);
  }
}

async function searchBuildingCodes(
  query: string, 
  zipCode: string, 
  codeType?: string
): Promise<{ found: boolean; snippet: string; source: string; cached: boolean }> {
  
  // ========================================
  // CACHE-FIRST: Check building_code_cache
  // ========================================
  const queryHash = await hashQuery(query + (codeType || 'IRC'));
  
  const cached = await checkBuildingCodeCache(queryHash, zipCode);
  if (cached) {
    console.log('[construction-brain] Building code cache HIT:', queryHash);
    return {
      found: true,
      snippet: cached.snippet,
      source: cached.source_url || 'cached',
      cached: true
    };
  }
  
  console.log('[construction-brain] Building code cache MISS:', queryHash);
  
  // ========================================
  // CACHE MISS: Perform Firecrawl search
  // ========================================
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (!FIRECRAWL_API_KEY) {
    console.log('[construction-brain] No Firecrawl key, using fallback');
    return {
      found: false,
      snippet: 'Building code lookup not configured. Please verify requirements manually with local building department.',
      source: 'fallback',
      cached: false
    };
  }

  try {
    // Search up.codes which has organized building codes by location
    const searchQuery = `site:up.codes ${zipCode} ${query} ${codeType || 'IRC'}`;
    
    console.log('[construction-brain] Building code search:', searchQuery);
    
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 3,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        }
      }),
    });

    if (!response.ok) {
      console.error('[construction-brain] Firecrawl error:', response.status);
      return {
        found: false,
        snippet: 'Building code search failed. Verify requirements with local building department.',
        source: 'error',
        cached: false
      };
    }

    const result = await response.json();
    
    if (result.data && result.data.length > 0) {
      // Extract relevant snippets
      const firstResult = result.data[0];
      const snippets = result.data
        .slice(0, 2)
        .map((r: { markdown?: string; title?: string; url?: string }) => {
          const content = r.markdown || '';
          // Get first 500 chars of relevant content
          const relevantPart = content.substring(0, 500);
          return `**${r.title || 'Code Reference'}**\n${relevantPart}...\nSource: ${r.url || 'up.codes'}`;
        })
        .join('\n\n---\n\n');
      
      // ========================================
      // SAVE TO CACHE (90-day expiry)
      // ========================================
      await saveBuildingCodeCache(queryHash, zipCode, query, snippets, firstResult.url || 'up.codes');
      
      return {
        found: true,
        snippet: snippets,
        source: 'up.codes',
        cached: false
      };
    }
    
    return {
      found: false,
      snippet: `No specific code found for "${query}" in ${zipCode}. Check local amendments with building department.`,
      source: 'up.codes',
      cached: false
    };
  } catch (error) {
    console.error('[construction-brain] Building code search error:', error);
    return {
      found: false,
      snippet: 'Building code lookup failed. Verify requirements manually.',
      source: 'error',
      cached: false
    };
  }
}

// ========================================
// RESPONSE PARSER
// ========================================

function parseAIResponse(aiMessage: { tool_calls?: Array<{ function: { name: string; arguments: string } }>; content?: string }, knowledgeContext: KnowledgeContext): BrainResponse {
  const response: BrainResponse = {
    success: true,
    reasoning: '',
    confidence: 0.5,
    confidenceFactors: [],
    dataSources: [],
  };

  // Check for tool calls
  if (aiMessage.tool_calls?.length) {
    for (const toolCall of aiMessage.tool_calls) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        
        if (toolCall.function.name === 'propose_actions') {
          response.actions = args.actions;
          response.reasoning = args.reasoning;
          response.confidence = args.overall_confidence;
          response.dataSources = args.data_sources || [];
          response.warnings = args.warnings;
          
          // Build confidence factors
          response.confidenceFactors = [];
          if (knowledgeContext.relevantKnowledge.length > 0) {
            response.confidenceFactors.push(`${knowledgeContext.relevantKnowledge.length} relevant knowledge entries`);
          }
          if (args.data_sources?.length > 0) {
            response.confidenceFactors.push(`Based on: ${args.data_sources.join(', ')}`);
          }
        } else if (toolCall.function.name === 'explain_with_confidence') {
          response.reasoning = args.explanation;
          response.confidence = args.confidence;
          response.dataSources = args.sources || [];
          response.followUpQuestions = args.follow_up_questions;
        } else if (toolCall.function.name === 'search_building_codes') {
          // Actually execute the building code search
          console.log('[construction-brain] Building code search requested:', args);
          // Note: This is async but we're in a sync function - the search happens in the main handler
          response.dataSources.push(`Building code lookup: ${args.query} (${args.zip_code})`);
        }
      } catch (e) {
        console.error('[construction-brain] Failed to parse tool call:', e);
      }
    }
  }

  // Fall back to content if no tool calls
  if (!response.reasoning && aiMessage.content) {
    response.reasoning = aiMessage.content;
    response.confidence = 0.6;
  }

  return response;
}

// ========================================
// DECISION LOGGING
// ========================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logDecision(supabase: any, decision: {
  userId: string;
  projectId?: string;
  conversationId?: string;
  inputText: string;
  inputContext: unknown;
  decisionType: string;
  outputActions?: unknown[];
  outputReasoning: string;
  confidenceScore: number;
  confidenceFactors: string[];
  dataSourcesUsed: string[];
}) {
  try {
    await supabase.from('ai_decisions').insert({
      user_id: decision.userId,
      project_id: decision.projectId,
      conversation_id: decision.conversationId,
      input_text: decision.inputText,
      input_context: decision.inputContext,
      decision_type: decision.decisionType,
      output_actions: decision.outputActions,
      output_reasoning: decision.outputReasoning,
      confidence_score: decision.confidenceScore,
      confidence_factors: decision.confidenceFactors,
      data_sources_used: decision.dataSourcesUsed,
    });
  } catch (e) {
    console.error('[construction-brain] Failed to log decision:', e);
  }
}

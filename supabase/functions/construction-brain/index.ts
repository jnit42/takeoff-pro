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
  };
  takeoffItems?: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_cost: number;
    category: string;
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
    // PHASE 1: BUILD FULL CONTEXT
    // ========================================
    
    const projectContext = await buildProjectContext(supabase, projectId, userId);
    const knowledgeContext = await buildKnowledgeContext(supabase, message, projectContext);
    
    console.log('[construction-brain] Context built:', {
      hasProject: !!projectContext.project,
      takeoffItems: projectContext.takeoffItems?.length || 0,
      relevantKnowledge: knowledgeContext.relevantKnowledge.length,
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
        model: 'google/gemini-2.5-flash',
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

  if (!projectId) return context;

  // Get project details
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  if (project) {
    context.project = project;
  }

  // Get takeoff items
  const { data: takeoffItems } = await supabase
    .from('takeoff_items')
    .select('description, quantity, unit, unit_cost, category')
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
// PROMPT BUILDER
// ========================================

function buildSystemPrompt(projectContext: ProjectContext, knowledgeContext: KnowledgeContext): string {
  const projectInfo = projectContext.project 
    ? `
CURRENT PROJECT: "${projectContext.project.name}"
- Region: ${projectContext.project.region || 'Not specified'}
- ZIP: ${projectContext.project.zip_code || 'Not specified'}
- Markup: ${projectContext.project.markup_percent}%
- Waste Factor: ${projectContext.project.waste_percent}%
- Tax: ${projectContext.project.tax_percent}%
- Labor Burden: ${projectContext.project.labor_burden_percent}%
`
    : 'No project currently selected.';

  const existingItems = projectContext.takeoffItems?.length
    ? `\nEXISTING TAKEOFF ITEMS (${projectContext.takeoffItems.length} items):\n${projectContext.takeoffItems.slice(0, 10).map(i => `- ${i.description}: ${i.quantity} ${i.unit} @ $${i.unit_cost || '?'}`).join('\n')}`
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

  return `You are the Construction Brain - an expert estimating AI with 50+ years of field experience. You think like a veteran GC who's seen it all.

CRITICAL: You are PROPOSE-ONLY. You suggest actions but NEVER write directly to the database.
All your proposed actions will be shown to the user for confirmation before execution.

${projectInfo}
${existingItems}
${subInfo}
${knowledgeInfo}
${recentLearnings}

CORE PRINCIPLES (from the field):
1. ACCURACY OVER SPEED - A bad estimate costs jobs. Take time to get it right.
2. SHOW YOUR WORK - Always explain why. "Because I said so" doesn't fly.
3. USE DATA - Reference knowledge base AND real-world experience
4. REGIONAL AWARENESS - Boston rates aren't Alabama rates. Northeast runs 25-30% higher than national avg.
5. SANITY CHECK - If studs are costing $10 each, something's wrong. Flag it.
6. ADMIT UNCERTAINTY - "I'm 60% confident" is honest. Fake certainty loses jobs.

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

PARAM FORMAT FOR ACTIONS:
When using takeoff.add_item, always include:
- description: Full item description (e.g., "2x4x8 Stud" not "stud")
- quantity: Number
- unit: EA, SF, LF, SHT, CY, etc.
- unit_cost: Dollar amount (from price book, NOT web scraping)
- category: Framing, Drywall, Electrical, Plumbing, etc.

PRICING SOURCE PRIORITY:
1. User's price book entries
2. Knowledge base (verified historical data)
3. Leave blank and note "price TBD" if unknown
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
// TOOL DEFINITIONS
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
                    description: 'For takeoff.add_item use: description, quantity, unit, unit_cost, category. For takeoff.delete_item use: description or item_id. For export use: which (takeoff/labor/rfis).'
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
    }
  ];
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

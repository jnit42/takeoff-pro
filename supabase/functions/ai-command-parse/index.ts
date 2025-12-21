import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseRequest {
  message: string;
  projectContext: {
    projectId: string;
    projectName: string;
    takeoffItemCount: number;
    draftCount: number;
    laborEstimateCount: number;
    wastePercent: number;
    markupPercent: number;
    recentActions: string[];
  };
}

interface ParsedAction {
  type: string;
  params: Record<string, unknown>;
  confidence: number;
}

interface ParseResponse {
  proposed_actions: ParsedAction[];
  follow_up_questions: string[];
  fallback_to_deterministic: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, projectContext }: ParseRequest = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt
    const systemPrompt = `You are a construction estimating command parser. Convert natural language into structured actions.

AVAILABLE ACTIONS:
- takeoff.add_item: Add a takeoff line item. Params: description, quantity, unit, category
- takeoff.promote_drafts: Promote draft items to active. Params: filter (optional)
- takeoff.delete_drafts: Delete draft items. Params: filter (optional)
- project.set_defaults: Update project settings. Params: markup_percent, waste_percent, tax_percent, labor_burden_percent
- export.pdf: Export project to PDF. Params: includeLabor, includeSummary
- export.csv: Export takeoff to CSV. Params: none
- plans.open: Open a plan file. Params: planFileId, page
- qa.show_issues: Show QA issues. Params: none
- labor.add_task: Add labor task. Params: taskName, quantity, unit

RULES:
1. Only propose actions that match user intent
2. Never invent quantities - if unsure, ask
3. Return follow_up_questions if info is missing
4. Set confidence 0.0-1.0 based on clarity
5. Return fallback_to_deterministic: true if you can't parse

PROJECT CONTEXT:
- Name: ${projectContext.projectName}
- Takeoff Items: ${projectContext.takeoffItemCount} (${projectContext.draftCount} drafts)
- Labor Estimates: ${projectContext.laborEstimateCount}
- Waste: ${projectContext.wastePercent}%, Markup: ${projectContext.markupPercent}%
- Recent: ${projectContext.recentActions.slice(0, 3).join(', ') || 'none'}

Respond with JSON only:
{
  "proposed_actions": [{"type": "...", "params": {...}, "confidence": 0.9}],
  "follow_up_questions": ["..."],
  "fallback_to_deterministic": false
}`;

    // Call AI - using fetch to openrouter or similar
    // For now, implement simple pattern matching as fallback
    const response = await parseWithSimplePatterns(message, projectContext);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error parsing command:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        proposed_actions: [],
        follow_up_questions: [],
        fallback_to_deterministic: true,
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simple pattern-based parsing (fallback when LLM unavailable)
function parseWithSimplePatterns(message: string, context: ParseRequest['projectContext']): ParseResponse {
  const lower = message.toLowerCase();
  const actions: ParsedAction[] = [];
  const questions: string[] = [];

  // Export patterns
  if (/export.*pdf|pdf.*export/i.test(lower)) {
    actions.push({
      type: 'export.pdf',
      params: { includeLabor: true, includeSummary: true },
      confidence: 0.9
    });
  }
  
  if (/export.*csv|csv.*export/i.test(lower)) {
    actions.push({
      type: 'export.csv',
      params: {},
      confidence: 0.9
    });
  }

  // Promote drafts
  if (/promote.*draft|finalize.*takeoff|make.*active/i.test(lower)) {
    actions.push({
      type: 'takeoff.promote_drafts',
      params: {},
      confidence: 0.85
    });
  }

  // Delete drafts
  if (/delete.*draft|remove.*draft|clear.*draft/i.test(lower)) {
    actions.push({
      type: 'takeoff.delete_drafts',
      params: {},
      confidence: 0.85
    });
  }

  // Set markup/waste
  const markupMatch = /(?:set|change).*markup.*?(\d+)%?/i.exec(lower);
  if (markupMatch) {
    actions.push({
      type: 'project.set_defaults',
      params: { markup_percent: parseInt(markupMatch[1]) },
      confidence: 0.9
    });
  }

  const wasteMatch = /(?:set|change).*waste.*?(\d+)%?/i.exec(lower);
  if (wasteMatch) {
    actions.push({
      type: 'project.set_defaults',
      params: { waste_percent: parseInt(wasteMatch[1]) },
      confidence: 0.9
    });
  }

  // QA issues
  if (/show.*(?:qa|issues|problems)|check.*quality/i.test(lower)) {
    actions.push({
      type: 'qa.show_issues',
      params: {},
      confidence: 0.9
    });
  }

  // If no actions matched, ask for clarification
  if (actions.length === 0) {
    return {
      proposed_actions: [],
      follow_up_questions: ['I\'m not sure what you\'d like to do. Could you try rephrasing? For example: "Set markup to 15%" or "Export PDF"'],
      fallback_to_deterministic: true
    };
  }

  return {
    proposed_actions: actions,
    follow_up_questions: questions,
    fallback_to_deterministic: false
  };
}

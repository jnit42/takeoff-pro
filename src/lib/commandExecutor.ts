/**
 * Command Executor - Executes parsed actions via Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import type { ParsedAction } from './commandParser';
import { evaluateFormula } from './formulaEvaluator';
import {
  exportTakeoffCSV,
  exportLaborCSV,
  exportRFIsCSV,
  exportAssumptionsCSV,
  exportChecklistCSV,
  exportProjectPDF,
} from './exportUtils';

export interface ExecutionResult {
  success: boolean;
  actionType: string;
  message: string;
  data?: Record<string, unknown>;
  undoable: boolean;
  undoData?: Record<string, unknown>;
}

export interface ExecutionContext {
  projectId?: string;
  userId: string;
  source: 'text' | 'voice' | 'ui';
  commandText: string;
}

interface AssemblyItem {
  description: string;
  formula: string;
  unit: string;
}

interface Assembly {
  id: string;
  name: string;
  trade: string;
  items: AssemblyItem[];
}

/**
 * Execute a single action
 */
export async function executeAction(
  action: ParsedAction,
  context: ExecutionContext
): Promise<ExecutionResult> {
  try {
    switch (action.type) {
      case 'project.create':
        return await executeProjectCreate(action.params, context);

      case 'project.set_defaults':
        return await executeProjectSetDefaults(action.params, context);

      case 'takeoff.add_item':
        return await executeTakeoffAddItem(action.params, context);

      case 'takeoff.generate_drafts_from_assemblies':
        return await executeTakeoffGenerateDrafts(action.params, context);

      case 'takeoff.promote_drafts':
        return await executeTakeoffPromoteDrafts(action.params, context);

      case 'takeoff.delete_drafts':
        return await executeTakeoffDeleteDrafts(action.params, context);

      case 'labor.add_task_line':
        return await executeLaborAddTaskLine(action.params, context);

      case 'export.pdf':
        return await executeExportPDF(action.params, context);

      case 'export.csv':
        return await executeExportCSV(action.params, context);

      case 'qa.show_issues':
        return await executeQAShowIssues(context);

      default:
        return {
          success: false,
          actionType: action.type,
          message: `Unknown action type: ${action.type}`,
          undoable: false,
        };
    }
  } catch (error) {
    return {
      success: false,
      actionType: action.type,
      message: error instanceof Error ? error.message : 'Unknown error',
      undoable: false,
    };
  }
}

/**
 * Execute all actions and log to action_log
 */
export async function executeActions(
  actions: ParsedAction[],
  context: ExecutionContext
): Promise<{ results: ExecutionResult[]; logId: string | null }> {
  const results: ExecutionResult[] = [];

  for (const action of actions) {
    const result = await executeAction(action, context);
    results.push(result);
  }

  // Log to action_log
  const allSuccess = results.every(r => r.success);
  const undoData = results
    .filter(r => r.undoable && r.undoData)
    .map(r => ({ type: r.actionType, data: r.undoData }));

  const insertData = {
    project_id: context.projectId || null,
    source: context.source,
    command_text: context.commandText,
    actions_json: actions as unknown as Record<string, unknown>,
    status: allSuccess ? 'applied' : 'failed',
    error: allSuccess ? null : results.find(r => !r.success)?.message,
    undoable: undoData.length > 0,
    undo_data: undoData.length > 0 ? undoData : null,
  };

  const { data: logEntry, error: logError } = await supabase
    .from('action_log')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertData as any)
    .select('id')
    .single();

  return {
    results,
    logId: logError ? null : logEntry?.id || null,
  };
}

// === Individual Action Executors ===

async function executeProjectCreate(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: params.name as string,
      address: (params.address as string) || null,
      region: (params.region as string) || 'Rhode Island',
      user_id: context.userId,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    actionType: 'project.create',
    message: `Created project "${project.name}"`,
    data: { projectId: project.id, name: project.name },
    undoable: true,
    undoData: { projectId: project.id },
  };
}

async function executeProjectSetDefaults(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  // Get current values for undo
  const { data: current } = await supabase
    .from('projects')
    .select('tax_percent, markup_percent, labor_burden_percent, waste_percent')
    .eq('id', context.projectId)
    .single();

  const updates: Record<string, number> = {};
  if (params.tax_percent !== undefined) updates.tax_percent = params.tax_percent as number;
  if (params.markup_percent !== undefined) updates.markup_percent = params.markup_percent as number;
  if (params.labor_burden_percent !== undefined) updates.labor_burden_percent = params.labor_burden_percent as number;
  if (params.waste_percent !== undefined) updates.waste_percent = params.waste_percent as number;

  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', context.projectId);

  if (error) throw error;

  const changedFields = Object.keys(updates).map(k => `${k.replace('_percent', '').replace('_', ' ')} = ${updates[k]}%`).join(', ');

  return {
    success: true,
    actionType: 'project.set_defaults',
    message: `Updated: ${changedFields}`,
    data: updates,
    undoable: true,
    undoData: { projectId: context.projectId, previous: current },
  };
}

async function executeTakeoffAddItem(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const { data: item, error } = await supabase
    .from('takeoff_items')
    .insert({
      project_id: context.projectId,
      category: (params.category as string) || 'General',
      description: params.description as string,
      unit: (params.unit as string) || 'EA',
      quantity: params.quantity as number,
      unit_cost: (params.unit_cost as number) || 0,
      extended_cost: ((params.quantity as number) || 0) * ((params.unit_cost as number) || 0),
      draft: (params.draft as boolean) || false,
      notes: params.notes as string,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    actionType: 'takeoff.add_item',
    message: `Added "${item.description}" (${item.quantity} ${item.unit})`,
    data: { itemId: item.id },
    undoable: true,
    undoData: { itemId: item.id },
  };
}

async function executeTakeoffGenerateDrafts(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const assemblyNames = params.assemblies as string[];
  const variables = params.variables as Record<string, number>;
  const projectType = params.project_type as string;

  // Fetch matching assemblies
  const { data: assemblies, error: fetchError } = await supabase
    .from('assemblies')
    .select('*')
    .eq('project_type', projectType);

  if (fetchError) throw fetchError;

  // Filter to matching assemblies by name
  const matchingAssemblies = (assemblies || []).filter((a) =>
    assemblyNames.some(name =>
      a.name.toLowerCase().includes(name.toLowerCase()) ||
      a.trade.toLowerCase().includes(name.toLowerCase())
    )
  );

  if (matchingAssemblies.length === 0) {
    return {
      success: false,
      actionType: 'takeoff.generate_drafts_from_assemblies',
      message: `No assemblies found matching: ${assemblyNames.join(', ')}`,
      undoable: false,
    };
  }

  const draftItems: {
    project_id: string;
    category: string;
    description: string;
    unit: string;
    quantity: number;
    draft: boolean;
    notes: string;
  }[] = [];
  const rfis: { project_id: string; question: string; trade: string }[] = [];

  // Process each assembly
  for (const assembly of matchingAssemblies) {
    const items = (assembly.items as unknown as AssemblyItem[]) || [];
    
    for (const item of items) {
      const { result, missingVars } = evaluateFormula(item.formula, variables);
      
      if (missingVars.length > 0) {
        rfis.push({
          project_id: context.projectId,
          question: `Missing measurement for "${item.description}": need ${missingVars.join(', ')}`,
          trade: assembly.trade,
        });
      } else if (result !== null && result > 0) {
        draftItems.push({
          project_id: context.projectId,
          category: assembly.trade,
          description: item.description,
          unit: item.unit,
          quantity: result,
          draft: true,
          notes: `Generated from ${assembly.name} | Formula: ${item.formula}`,
        });
      }
    }
  }

  // Insert draft items
  const createdIds: string[] = [];
  if (draftItems.length > 0) {
    const { data: created, error: insertError } = await supabase
      .from('takeoff_items')
      .insert(draftItems)
      .select('id');

    if (insertError) throw insertError;
    createdIds.push(...(created || []).map(c => c.id));
  }

  // Insert RFIs
  if (rfis.length > 0) {
    const uniqueRfis = rfis.filter((rfi, idx, self) =>
      idx === self.findIndex(r => r.question === rfi.question)
    );
    await supabase.from('rfis').insert(uniqueRfis);
  }

  return {
    success: true,
    actionType: 'takeoff.generate_drafts_from_assemblies',
    message: `Generated ${draftItems.length} draft items from ${matchingAssemblies.length} assemblies. Created ${rfis.length} RFIs for missing variables.`,
    data: { draftsCreated: draftItems.length, rfisCreated: rfis.length },
    undoable: createdIds.length > 0,
    undoData: { createdItemIds: createdIds },
  };
}

async function executeTakeoffPromoteDrafts(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const scope = params.scope as string;
  const selectedIds = params.selected_ids as string[] | undefined;

  let query = supabase
    .from('takeoff_items')
    .update({ draft: false })
    .eq('project_id', context.projectId)
    .eq('draft', true);

  if (scope !== 'all' && selectedIds?.length) {
    query = query.in('id', selectedIds);
  }

  const { data, error } = await query.select('id');

  if (error) throw error;

  const promotedCount = data?.length || 0;

  return {
    success: true,
    actionType: 'takeoff.promote_drafts',
    message: `Promoted ${promotedCount} draft items to active`,
    data: { promotedCount },
    undoable: promotedCount > 0,
    undoData: { promotedIds: data?.map(d => d.id) || [] },
  };
}

async function executeTakeoffDeleteDrafts(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const scope = params.scope as string;
  const selectedIds = params.selected_ids as string[] | undefined;

  // Get drafts to delete (for undo data)
  let selectQuery = supabase
    .from('takeoff_items')
    .select('*')
    .eq('project_id', context.projectId)
    .eq('draft', true);

  if (scope !== 'all' && selectedIds?.length) {
    selectQuery = selectQuery.in('id', selectedIds);
  }

  const { data: draftsToDelete } = await selectQuery;

  // Delete them
  let deleteQuery = supabase
    .from('takeoff_items')
    .delete()
    .eq('project_id', context.projectId)
    .eq('draft', true);

  if (scope !== 'all' && selectedIds?.length) {
    deleteQuery = deleteQuery.in('id', selectedIds);
  }

  const { error } = await deleteQuery;

  if (error) throw error;

  const deletedCount = draftsToDelete?.length || 0;

  return {
    success: true,
    actionType: 'takeoff.delete_drafts',
    message: `Deleted ${deletedCount} draft items`,
    data: { deletedCount },
    undoable: deletedCount > 0,
    undoData: { deletedItems: draftsToDelete },
  };
}

async function executeLaborAddTaskLine(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  // Get or create labor estimate for project
  let { data: estimate } = await supabase
    .from('labor_estimates')
    .select('id')
    .eq('project_id', context.projectId)
    .single();

  if (!estimate) {
    const { data: newEstimate, error: createError } = await supabase
      .from('labor_estimates')
      .insert({ project_id: context.projectId })
      .select('id')
      .single();
    
    if (createError) throw createError;
    estimate = newEstimate;
  }

  const baseRate = (params.base_rate as number) || 0;
  const quantity = params.quantity as number;

  const { data: lineItem, error } = await supabase
    .from('labor_line_items')
    .insert({
      labor_estimate_id: estimate.id,
      task_name: params.task_name as string,
      quantity,
      unit: (params.unit as string) || 'EA',
      base_rate: baseRate,
      final_rate: baseRate,
      extended: baseRate * quantity,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    actionType: 'labor.add_task_line',
    message: `Added labor task "${lineItem.task_name}"`,
    data: { lineItemId: lineItem.id },
    undoable: true,
    undoData: { lineItemId: lineItem.id },
  };
}

async function executeExportPDF(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  // Fetch all project data
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', context.projectId)
    .single();

  const { data: takeoffItems } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('project_id', context.projectId);

  const { data: laborEstimates } = await supabase
    .from('labor_estimates')
    .select('*, labor_line_items(*)')
    .eq('project_id', context.projectId);

  const { data: rfis } = await supabase
    .from('rfis')
    .select('*')
    .eq('project_id', context.projectId);

  const { data: assumptions } = await supabase
    .from('assumptions')
    .select('*')
    .eq('project_id', context.projectId);

  const { data: checklistItems } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('project_id', context.projectId);

  if (!project) throw new Error('Project not found');

  exportProjectPDF({
    project,
    takeoffItems: takeoffItems || [],
    laborEstimates: laborEstimates || [],
    rfis: rfis || [],
    assumptions: assumptions || [],
    checklistItems: checklistItems || [],
    includeDrafts: params.includeDrafts as boolean,
  });

  return {
    success: true,
    actionType: 'export.pdf',
    message: 'PDF exported successfully',
    undoable: false,
  };
}

async function executeExportCSV(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const which = params.which as string;
  const includeDrafts = params.includeDrafts as boolean;

  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', context.projectId)
    .single();

  if (!project) throw new Error('Project not found');

  switch (which) {
    case 'takeoff': {
      const { data: items } = await supabase
        .from('takeoff_items')
        .select('*')
        .eq('project_id', context.projectId);
      exportTakeoffCSV(items || [], project.name, includeDrafts);
      break;
    }
    case 'labor': {
      const { data: estimates } = await supabase
        .from('labor_estimates')
        .select('*, labor_line_items(*)')
        .eq('project_id', context.projectId);
      exportLaborCSV(estimates || [], project.name);
      break;
    }
    case 'rfis': {
      const { data: rfis } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', context.projectId);
      exportRFIsCSV(rfis || [], project.name);
      break;
    }
    case 'assumptions': {
      const { data: assumptions } = await supabase
        .from('assumptions')
        .select('*')
        .eq('project_id', context.projectId);
      exportAssumptionsCSV(assumptions || [], project.name);
      break;
    }
    case 'checklist': {
      const { data: items } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('project_id', context.projectId);
      exportChecklistCSV(items || [], project.name);
      break;
    }
  }

  return {
    success: true,
    actionType: 'export.csv',
    message: `${which} CSV exported successfully`,
    undoable: false,
  };
}

async function executeQAShowIssues(
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  // Gather QA metrics
  const { data: rfis } = await supabase
    .from('rfis')
    .select('*')
    .eq('project_id', context.projectId)
    .eq('status', 'open');

  const { data: drafts } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('project_id', context.projectId)
    .eq('draft', true);

  const { data: pendingChecklist } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('project_id', context.projectId)
    .eq('status', 'pending');

  const issues: string[] = [];
  
  if ((rfis?.length || 0) > 0) {
    issues.push(`${rfis?.length} open RFIs need answers`);
  }
  if ((drafts?.length || 0) > 0) {
    issues.push(`${drafts?.length} draft items to review`);
  }
  if ((pendingChecklist?.length || 0) > 0) {
    issues.push(`${pendingChecklist?.length} pending checklist items`);
  }

  const message = issues.length > 0
    ? `QA Issues:\n• ${issues.join('\n• ')}`
    : 'No open QA issues found!';

  return {
    success: true,
    actionType: 'qa.show_issues',
    message,
    data: {
      openRfis: rfis?.length || 0,
      drafts: drafts?.length || 0,
      pendingChecklist: pendingChecklist?.length || 0,
      topIssues: [
        ...(rfis || []).slice(0, 5).map(r => ({ type: 'rfi', text: r.question })),
        ...(drafts || []).slice(0, 5).map(d => ({ type: 'draft', text: d.description })),
      ],
    },
    undoable: false,
  };
}

/**
 * Undo a previous action
 */
export async function undoAction(logId: string): Promise<ExecutionResult> {
  const { data: log, error: fetchError } = await supabase
    .from('action_log')
    .select('*')
    .eq('id', logId)
    .single();

  if (fetchError || !log) {
    return {
      success: false,
      actionType: 'undo',
      message: 'Action log not found',
      undoable: false,
    };
  }

  if (!log.undoable || log.status === 'undone') {
    return {
      success: false,
      actionType: 'undo',
      message: 'This action cannot be undone',
      undoable: false,
    };
  }

  const undoData = log.undo_data as { type: string; data: Record<string, unknown> }[] | null;
  if (!undoData || undoData.length === 0) {
    return {
      success: false,
      actionType: 'undo',
      message: 'No undo data available',
      undoable: false,
    };
  }

  // Process each undo operation
  for (const undo of undoData) {
    switch (undo.type) {
      case 'project.create': {
        const projectId = undo.data.projectId as string;
        await supabase.from('projects').delete().eq('id', projectId);
        break;
      }
      case 'project.set_defaults': {
        const projectId = undo.data.projectId as string;
        const previous = undo.data.previous as Record<string, number>;
        await supabase.from('projects').update(previous).eq('id', projectId);
        break;
      }
      case 'takeoff.add_item': {
        const itemId = undo.data.itemId as string;
        await supabase.from('takeoff_items').delete().eq('id', itemId);
        break;
      }
      case 'takeoff.generate_drafts_from_assemblies': {
        const itemIds = undo.data.createdItemIds as string[];
        if (itemIds?.length) {
          await supabase.from('takeoff_items').delete().in('id', itemIds);
        }
        break;
      }
      case 'takeoff.promote_drafts': {
        const promotedIds = undo.data.promotedIds as string[];
        if (promotedIds?.length) {
          await supabase.from('takeoff_items').update({ draft: true }).in('id', promotedIds);
        }
        break;
      }
      case 'takeoff.delete_drafts': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deletedItems = undo.data.deletedItems as any[];
        if (deletedItems?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await supabase.from('takeoff_items').insert(deletedItems as any);
        }
        break;
      }
      case 'labor.add_task_line': {
        const lineItemId = undo.data.lineItemId as string;
        await supabase.from('labor_line_items').delete().eq('id', lineItemId);
        break;
      }
    }
  }

  // Mark log as undone
  await supabase
    .from('action_log')
    .update({ status: 'undone' })
    .eq('id', logId);

  return {
    success: true,
    actionType: 'undo',
    message: 'Action undone successfully',
    undoable: false,
  };
}

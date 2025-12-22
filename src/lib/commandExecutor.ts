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
  /** For navigation actions */
  navigateTo?: string;
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

// Schema/parser version for action log
export const LOG_SCHEMA_VERSION = 1;
export const LOG_PARSER_VERSION = '1.0.0';

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

      case 'project.log_payment':
        return await executeLogPayment(action.params, context);

      case 'takeoff.add_item':
        return await executeTakeoffAddItem(action.params, context);

      case 'takeoff.add_multiple':
        return await executeTakeoffAddMultiple(action.params, context);

      case 'takeoff.delete_item':
        return await executeTakeoffDeleteItem(action.params, context);

      case 'takeoff.delete_items':
        return await executeTakeoffDeleteItems(action.params, context);

      case 'takeoff.update_item':
        return await executeTakeoffUpdateItem(action.params, context);

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

      case 'plans.open':
        return await executePlansOpen(action.params, context);

      case 'learn.terminology':
        return await executeLearnTerminology(action.params, context);

      case 'learn.preference':
        return await executeLearnPreference(action.params, context);

      case 'pricing.lookup':
        return await executePricingLookup(action.params, context);

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
 * Execute all actions and log to action_log with versioning
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

  // Log to action_log with versioned schema
  const allSuccess = results.every(r => r.success);
  const undoData = results
    .filter(r => r.undoable && r.undoData)
    .map(r => ({ type: r.actionType, data: r.undoData }));

  // Versioned actions_json structure
  const versionedActionsJson = {
    schema_version: LOG_SCHEMA_VERSION,
    parser_version: LOG_PARSER_VERSION,
    executed_at: new Date().toISOString(),
    actions: actions,
  };

  const insertData = {
    project_id: context.projectId || null,
    source: context.source,
    command_text: context.commandText,
    actions_json: versionedActionsJson as unknown as Record<string, unknown>,
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

/**
 * Execute plans.open - returns navigation data
 */
async function executePlansOpen(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const planFileId = params.plan_file_id as string | undefined;
  const sheetLabel = params.sheet_label as string | undefined;
  const page = params.page as number | undefined;

  // If we have a sheet label, try to find the plan file
  let targetPlanFileId = planFileId;
  
  if (!targetPlanFileId && sheetLabel) {
    const { data: planFiles } = await supabase
      .from('plan_files')
      .select('id, sheet_label, filename')
      .eq('project_id', context.projectId);
    
    const match = planFiles?.find(
      (pf) =>
        pf.sheet_label?.toLowerCase() === sheetLabel.toLowerCase() ||
        pf.filename.toLowerCase().includes(sheetLabel.toLowerCase())
    );
    
    if (match) {
      targetPlanFileId = match.id;
    }
  }

  // Build navigation URL
  let navigateTo = `/projects/${context.projectId}?tab=plans`;
  if (targetPlanFileId) {
    navigateTo += `&planFileId=${targetPlanFileId}`;
  }
  if (page) {
    navigateTo += `&page=${page}`;
  }

  return {
    success: true,
    actionType: 'plans.open',
    message: targetPlanFileId ? 'Opening plan...' : 'Opening plans tab...',
    data: { plan_file_id: targetPlanFileId, page },
    undoable: false,
    navigateTo,
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

/**
 * Quick Log Payment - "Paid Jose $500 for demo"
 */
async function executeLogPayment(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const paidTo = params.paid_to as string;
  const amount = params.amount as number;
  const description = params.description as string;
  const category = (params.category as string) || 'Labor';
  const trade = params.trade as string;

  // Insert into project_actuals for budget tracking
  const { data: actual, error: actualError } = await supabase
    .from('project_actuals')
    .insert({
      project_id: context.projectId,
      category,
      description: `${paidTo}: ${description}`,
      estimated_amount: 0,
      estimated_qty: 1,
      estimated_unit: 'JOB',
      actual_amount: amount,
      actual_qty: 1,
      actual_unit: 'JOB',
      paid_to: paidTo,
      paid_date: new Date().toISOString().split('T')[0],
      notes: `Quick logged via command`,
    })
    .select()
    .single();

  if (actualError) throw actualError;

  // Also learn this as a labor rate if it looks like labor
  const laborKeywords = ['demo', 'install', 'labor', 'work', 'finish', 'frame', 'paint', 'tile', 'electric', 'plumb'];
  const isLabor = laborKeywords.some(k => description.toLowerCase().includes(k));

  if (isLabor && trade) {
    const taskKey = description.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_');
    
    await supabase
      .from('labor_rate_calibration')
      .upsert({
        user_id: context.userId,
        trade,
        task_key: taskKey,
        base_rate: amount,
        unit: 'JOB',
        sample_count: 1,
        last_used_at: new Date().toISOString(),
        modifiers_json: { source: 'quick_log', paid_to: paidTo }
      }, {
        onConflict: 'user_id,trade,task_key',
        ignoreDuplicates: false
      });
  }

  return {
    success: true,
    actionType: 'project.log_payment',
    message: `Logged: Paid ${paidTo} $${amount} for ${description}`,
    data: { actualId: actual.id, amount, paidTo },
    undoable: true,
    undoData: { actualId: actual.id },
  };
}

async function executeTakeoffAddItem(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  // Handle AI param variations: item_name, name, or description
  const description = (params.description || params.item_name || params.name) as string;
  if (!description) {
    throw new Error('Item description is required');
  }

  const quantity = (params.quantity as number) || 0;
  
  // Sanitize unit_cost - aggressively convert ANY non-numeric to null
  const rawUnitCost = params.unit_cost ?? params.cost ?? params.price;
  let unitCost: number | null = null;
  if (typeof rawUnitCost === 'number' && !isNaN(rawUnitCost)) {
    unitCost = rawUnitCost;
  } else if (typeof rawUnitCost === 'string') {
    // Strip currency symbols and commas, then try to parse
    const cleanStr = rawUnitCost.replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleanStr);
    // Only assign if it's a valid number (catches "TBD", "?", "N/A", etc.)
    if (!isNaN(parsed)) {
      unitCost = parsed;
    }
  }

  const { data: item, error } = await supabase
    .from('takeoff_items')
    .insert({
      project_id: context.projectId,
      category: (params.category as string) || 'General',
      description,
      unit: (params.unit as string) || 'EA',
      quantity,
      unit_cost: unitCost,
      // Note: extended_cost is a generated column, don't insert it
      draft: (params.draft as boolean) ?? true, // Default to draft for AI-generated
      notes: params.notes as string,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    actionType: 'takeoff.add_item',
    message: `Added "${item.description}" (${item.quantity} ${item.unit}${unitCost ? ` @ $${unitCost}` : ' - TBD'})`,
    data: { itemId: item.id },
    undoable: true,
    undoData: { itemId: item.id },
  };
}

async function executeTakeoffAddMultiple(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const items = params.items as Array<{
    description: string;
    quantity: number;
    unit: string;
    category?: string;
    unit_cost?: number;
    notes?: string;
  }>;

  if (!items || items.length === 0) {
    return {
      success: false,
      actionType: 'takeoff.add_multiple',
      message: 'No items provided',
      undoable: false,
    };
  }

  const insertData = items.map((item) => {
    const qty = item.quantity || 0;
    // Sanitize unit_cost - aggressively convert ANY non-numeric to null
    const rawCost = item.unit_cost;
    let cost: number | null = null;
    if (typeof rawCost === 'number' && !isNaN(rawCost)) {
      cost = rawCost;
    } else if (typeof rawCost === 'string') {
      const cleanStr = (rawCost as string).replace(/[$,]/g, '').trim();
      const parsed = parseFloat(cleanStr);
      if (!isNaN(parsed)) {
        cost = parsed;
      }
    }
    
    return {
      project_id: context.projectId,
      category: item.category || 'General',
      description: item.description,
      unit: item.unit || 'EA',
      quantity: qty,
      unit_cost: cost,
      // Note: extended_cost is a generated column, don't insert it
      draft: true, // Always create as drafts so user can review
      notes: item.notes || null,
    };
  });

  const { data: created, error } = await supabase
    .from('takeoff_items')
    .insert(insertData)
    .select('id, description');

  if (error) throw error;

  const createdIds = (created || []).map((c) => c.id);

  return {
    success: true,
    actionType: 'takeoff.add_multiple',
    message: `Added ${createdIds.length} items as drafts. Use "Promote drafts" to finalize.`,
    data: { itemIds: createdIds, count: createdIds.length },
    undoable: true,
    undoData: { itemIds: createdIds },
  };
}

/**
 * Delete a single takeoff item by ID or description match
 */
async function executeTakeoffDeleteItem(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const itemId = params.item_id as string | undefined;
  const description = (params.description || params.item_name || params.name) as string | undefined;

  let targetId = itemId;
  let targetDescription = description;

  // If no ID provided, try to find by description
  if (!targetId && description) {
    const { data: items } = await supabase
      .from('takeoff_items')
      .select('id, description')
      .eq('project_id', context.projectId)
      .ilike('description', `%${description}%`)
      .limit(1);

    if (items && items.length > 0) {
      targetId = items[0].id;
      targetDescription = items[0].description;
    } else {
      return {
        success: false,
        actionType: 'takeoff.delete_item',
        message: `No item found matching "${description}"`,
        undoable: false,
      };
    }
  }

  if (!targetId) {
    return {
      success: false,
      actionType: 'takeoff.delete_item',
      message: 'No item ID or description provided',
      undoable: false,
    };
  }

  // Get the item for undo data
  const { data: item } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('id', targetId)
    .single();

  if (!item) {
    return {
      success: false,
      actionType: 'takeoff.delete_item',
      message: 'Item not found',
      undoable: false,
    };
  }

  const { error } = await supabase
    .from('takeoff_items')
    .delete()
    .eq('id', targetId);

  if (error) throw error;

  return {
    success: true,
    actionType: 'takeoff.delete_item',
    message: `Deleted "${targetDescription || item.description}"`,
    undoable: true,
    undoData: { item },
  };
}

/**
 * Delete multiple takeoff items by IDs or scope
 */
async function executeTakeoffDeleteItems(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const itemIds = params.item_ids as string[] | undefined;
  const scope = params.scope as string | undefined; // 'last', 'drafts', 'all'
  const count = (params.count as number) || 1;

  let query = supabase
    .from('takeoff_items')
    .select('id, description')
    .eq('project_id', context.projectId);

  if (itemIds && itemIds.length > 0) {
    query = query.in('id', itemIds);
  } else if (scope === 'drafts') {
    query = query.eq('draft', true);
  } else if (scope === 'last') {
    query = query.order('created_at', { ascending: false }).limit(count);
  }

  const { data: items, error: fetchError } = await query;
  if (fetchError) throw fetchError;

  if (!items || items.length === 0) {
    return {
      success: false,
      actionType: 'takeoff.delete_items',
      message: 'No items found to delete',
      undoable: false,
    };
  }

  const idsToDelete = items.map(i => i.id);
  const { error } = await supabase
    .from('takeoff_items')
    .delete()
    .in('id', idsToDelete);

  if (error) throw error;

  return {
    success: true,
    actionType: 'takeoff.delete_items',
    message: `Deleted ${idsToDelete.length} item(s)`,
    undoable: false, // Could implement undo with saved items
  };
}

/**
 * Update an existing takeoff item
 */
async function executeTakeoffUpdateItem(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  if (!context.projectId) {
    throw new Error('No project selected. Please open a project first.');
  }

  const itemId = params.item_id as string | undefined;
  const description = params.description as string | undefined;

  let targetId = itemId;

  // If no ID, try to find by description
  if (!targetId && description) {
    const { data: items } = await supabase
      .from('takeoff_items')
      .select('id')
      .eq('project_id', context.projectId)
      .ilike('description', `%${description}%`)
      .limit(1);

    if (items && items.length > 0) {
      targetId = items[0].id;
    }
  }

  if (!targetId) {
    return {
      success: false,
      actionType: 'takeoff.update_item',
      message: 'Item not found',
      undoable: false,
    };
  }

  // Get current for undo
  const { data: current } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('id', targetId)
    .single();

  // Build update object from params
  const updates: Record<string, unknown> = {};
  if (params.new_description) updates.description = params.new_description;
  if (params.quantity !== undefined) updates.quantity = params.quantity;
  if (params.unit) updates.unit = params.unit;
  if (params.unit_cost !== undefined) updates.unit_cost = params.unit_cost;
  if (params.category) updates.category = params.category;

  // Recalculate extended_cost if qty or cost changed
  const qty = (updates.quantity ?? current?.quantity ?? 0) as number;
  const cost = (updates.unit_cost ?? current?.unit_cost ?? 0) as number;
  updates.extended_cost = qty * cost;

  const { data: updated, error } = await supabase
    .from('takeoff_items')
    .update(updates)
    .eq('id', targetId)
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    actionType: 'takeoff.update_item',
    message: `Updated "${updated.description}"`,
    data: { itemId: targetId },
    undoable: true,
    undoData: { itemId: targetId, previous: current },
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
 * Execute learn.terminology - Save user's terminology correction
 */
async function executeLearnTerminology(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const term = params.term as string;
  const meaning = params.meaning as string;
  const contextInfo = params.context as string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('ai_knowledge' as any).insert({
    user_id: context.userId,
    category: 'terminology',
    key: term,
    value: { meaning, context: contextInfo },
    source: 'user_correction',
    confidence: 1.0,
  } as any);

  if (error) {
    console.error('[Learn] Failed to save terminology:', error);
    return {
      success: false,
      actionType: 'learn.terminology',
      message: 'Failed to save terminology',
      undoable: false,
    };
  }

  return {
    success: true,
    actionType: 'learn.terminology',
    message: `Got it! I'll remember "${term}" for future estimates.`,
    undoable: false,
  };
}

/**
 * Execute learn.preference - Save user's preference
 */
async function executeLearnPreference(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  const preference = params.preference as string;
  const value = params.value;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('ai_knowledge' as any).insert({
    user_id: context.userId,
    category: 'preference',
    key: preference,
    value: { value },
    source: 'user_stated',
    confidence: 1.0,
  } as any);

  if (error) {
    console.error('[Learn] Failed to save preference:', error);
    return {
      success: false,
      actionType: 'learn.preference',
      message: 'Failed to save preference',
      undoable: false,
    };
  }

  return {
    success: true,
    actionType: 'learn.preference',
    message: `Noted! I'll remember that preference.`,
    undoable: false,
  };
}

/**
 * Execute pricing.lookup - Request live pricing for items
 * Handles both single item (from AI) and array of items
 */
async function executePricingLookup(
  params: Record<string, unknown>,
  context: ExecutionContext
): Promise<ExecutionResult> {
  // Handle AI param variations: single item string or items array
  let items: string[] = [];
  if (params.items && Array.isArray(params.items)) {
    items = params.items as string[];
  } else if (params.item) {
    items = [params.item as string];
  } else if (params.description) {
    items = [params.description as string];
  } else if (params.name) {
    items = [params.name as string];
  }

  if (items.length === 0) {
    return {
      success: false,
      actionType: 'pricing.lookup',
      message: 'No items specified for price lookup',
      undoable: false,
    };
  }

  // Get project zip code if available
  let zipCode: string | undefined;
  if (context.projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('zip_code, region')
      .eq('id', context.projectId)
      .single();
    
    zipCode = project?.zip_code || undefined;
  }

  try {
    const { data, error } = await supabase.functions.invoke('price-lookup', {
      body: { items, zipCode },
    });

    if (error) {
      console.error('[Pricing] Lookup error:', error);
      return {
        success: false,
        actionType: 'pricing.lookup',
        message: 'Price lookup failed. Make sure Firecrawl connector is enabled.',
        undoable: false,
      };
    }

    if (!data?.success) {
      return {
        success: false,
        actionType: 'pricing.lookup',
        message: data?.error || 'Price lookup returned no results',
        undoable: false,
      };
    }

    // Format results for display
    const results = data.results as Record<string, Array<{ store: string; price: number | null; unit: string; productName: string }>>;
    const formattedResults: string[] = [];
    
    for (const [item, prices] of Object.entries(results)) {
      if (prices && prices.length > 0) {
        const priceStrings = prices
          .filter(p => p.price !== null)
          .map(p => `${p.store}: $${p.price}/${p.unit}`)
          .join(', ');
        if (priceStrings) {
          formattedResults.push(`${item}: ${priceStrings}`);
        }
      }
    }

    return {
      success: true,
      actionType: 'pricing.lookup',
      message: formattedResults.length > 0 
        ? `Found pricing:\n${formattedResults.join('\n')}`
        : 'No pricing found for those items. Try more specific product names.',
      data: { results },
      undoable: false,
    };
  } catch (e) {
    console.error('[Pricing] Exception:', e);
    return {
      success: false,
      actionType: 'pricing.lookup',
      message: 'Price lookup service unavailable',
      undoable: false,
    };
  }
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

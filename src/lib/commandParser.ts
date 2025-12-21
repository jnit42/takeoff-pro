/**
 * Command Parser - Deterministic parsing of natural language commands
 * No LLM required - pattern-based extraction
 */

export type ActionType =
  | 'project.create'
  | 'project.set_defaults'
  | 'takeoff.add_item'
  | 'takeoff.add_multiple'
  | 'takeoff.update_item'
  | 'takeoff.delete_item'
  | 'takeoff.generate_drafts_from_assemblies'
  | 'takeoff.promote_drafts'
  | 'takeoff.delete_drafts'
  | 'labor.add_task_line'
  | 'export.pdf'
  | 'export.csv'
  | 'qa.show_issues'
  | 'plans.open'
  | 'navigate.plans'
  | 'navigate.takeoff'
  | 'navigate.labor';

export interface ParsedAction {
  type: ActionType;
  params: Record<string, unknown>;
  confidence: number; // 0-1 how confident we are in the parse
}

export interface ParseResult {
  success: boolean;
  actions: ParsedAction[];
  missingInfo?: string;
  error?: string;
}

// Unit normalization map
const UNIT_MAP: Record<string, string> = {
  'sf': 'SF',
  'sqft': 'SF',
  'sq ft': 'SF',
  'square feet': 'SF',
  'square foot': 'SF',
  'lf': 'LF',
  'linear feet': 'LF',
  'linear foot': 'LF',
  'ft': 'LF',
  'feet': 'LF',
  'ea': 'EA',
  'each': 'EA',
  'pc': 'EA',
  'pcs': 'EA',
  'pieces': 'EA',
  'sheet': 'SHT',
  'sheets': 'SHT',
  'bd ft': 'BF',
  'board feet': 'BF',
  'cy': 'CY',
  'cubic yard': 'CY',
  'cubic yards': 'CY',
  'sy': 'SY',
  'square yard': 'SY',
  'square yards': 'SY',
};

function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  return UNIT_MAP[lower] || unit.toUpperCase();
}

// Extract numbers from text, handling words like "fifteen"
const WORD_NUMBERS: Record<string, number> = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
  'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
  'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
  'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100,
};

function parseNumber(text: string): number | null {
  // Try direct parse first
  const direct = parseFloat(text);
  if (!isNaN(direct)) return direct;

  // Try word parsing
  const lower = text.toLowerCase();
  if (WORD_NUMBERS[lower] !== undefined) return WORD_NUMBERS[lower];

  // Try compound numbers like "twenty five"
  const parts = lower.split(/[\s-]+/);
  if (parts.length === 2) {
    const tens = WORD_NUMBERS[parts[0]];
    const ones = WORD_NUMBERS[parts[1]];
    if (tens !== undefined && ones !== undefined) {
      return tens + ones;
    }
  }

  return null;
}

// Extract monetary values
function parsePrice(text: string): number | null {
  // Match patterns like $12.99, 12.99, $12
  const match = text.match(/\$?(\d+(?:\.\d{1,2})?)/);
  if (match) return parseFloat(match[1]);
  return null;
}

/**
 * Parse a command string into structured actions
 */
export function parseCommand(command: string, projectContext?: { projectId?: string; projectType?: string }): ParseResult {
  const lower = command.toLowerCase().trim();
  const actions: ParsedAction[] = [];

  // === PROJECT COMMANDS ===

  // Create project
  const createProjectMatch = lower.match(/create\s+project\s+(.+?)(?:\.\s*|$)/i);
  if (createProjectMatch) {
    const rest = createProjectMatch[1];
    const name = rest.split(/\s*(?:tax|markup|burden|address)/i)[0].trim();
    
    actions.push({
      type: 'project.create',
      params: { name: capitalizeWords(name) },
      confidence: 0.9,
    });
  }

  // Set defaults (tax, markup, burden, waste)
  const taxMatch = lower.match(/tax\s*(?:rate|percent|%)?\s*[:=]?\s*(\d+(?:\.\d+)?|\w+)/);
  const markupMatch = lower.match(/markup\s*(?:rate|percent|%)?\s*[:=]?\s*(\d+(?:\.\d+)?|\w+)/);
  const burdenMatch = lower.match(/(?:labor\s*)?burden\s*(?:rate|percent|%)?\s*[:=]?\s*(\d+(?:\.\d+)?|\w+)/);
  const wasteMatch = lower.match(/(?:default\s*)?waste\s*(?:rate|percent|%)?\s*[:=]?\s*(\d+(?:\.\d+)?|\w+)/);

  if (taxMatch || markupMatch || burdenMatch || wasteMatch) {
    const params: Record<string, number> = {};
    
    if (taxMatch) {
      const val = parseNumber(taxMatch[1]);
      if (val !== null) params.tax_percent = val;
    }
    if (markupMatch) {
      const val = parseNumber(markupMatch[1]);
      if (val !== null) params.markup_percent = val;
    }
    if (burdenMatch) {
      const val = parseNumber(burdenMatch[1]);
      if (val !== null) params.labor_burden_percent = val;
    }
    if (wasteMatch) {
      const val = parseNumber(wasteMatch[1]);
      if (val !== null) params.waste_percent = val;
    }

    if (Object.keys(params).length > 0) {
      actions.push({
        type: 'project.set_defaults',
        params,
        confidence: 0.95,
      });
    }
  }

  // === TAKEOFF COMMANDS ===

  // Add takeoff item: "add drywall 1050 sf at $12.99 per sheet"
  const addItemMatch = lower.match(/add\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(sf|lf|ea|each|sq\s*ft|linear\s*(?:feet|ft)|sheets?|pcs?|cy|sy|bd\s*ft)?(?:\s+(?:at|@)\s*\$?(\d+(?:\.\d+)?))?/i);
  if (addItemMatch && !lower.includes('task') && !lower.includes('labor')) {
    const description = capitalizeWords(addItemMatch[1].trim());
    const quantity = parseFloat(addItemMatch[2]);
    const unit = addItemMatch[3] ? normalizeUnit(addItemMatch[3]) : 'EA';
    const unitCost = addItemMatch[4] ? parseFloat(addItemMatch[4]) : undefined;

    // Determine category from description
    const category = inferCategory(description);

    actions.push({
      type: 'takeoff.add_item',
      params: {
        description,
        quantity,
        unit,
        unit_cost: unitCost,
        category,
        draft: lower.includes('draft'),
      },
      confidence: 0.85,
    });
  }

  // Delete takeoff item
  if (lower.match(/delete\s+(?:takeoff\s+)?item/)) {
    return {
      success: false,
      actions: [],
      missingInfo: 'Which item would you like to delete? Please provide the item ID or description.',
    };
  }

  // Generate drafts from assemblies
  const generateMatch = lower.match(/generate\s+(?:drafts?|takeoff|items?)\s+(?:using|from|for)\s+(.+)/i) ||
    lower.match(/(.+?):\s*generate\s+drafts?\s+(?:using|from)\s+(.+)/i);
  
  if (generateMatch) {
    const assembliesText = generateMatch[generateMatch.length - 1] || generateMatch[1];
    const assemblies = extractAssemblyNames(assembliesText);
    const variables = extractVariablesFromCommand(command);

    if (assemblies.length === 0) {
      return {
        success: false,
        actions: [],
        missingInfo: 'Which assemblies would you like to use? (e.g., framing, drywall, electrical)',
      };
    }

    actions.push({
      type: 'takeoff.generate_drafts_from_assemblies',
      params: {
        assemblies,
        variables,
        project_type: projectContext?.projectType || inferProjectType(lower),
        draft: true,
      },
      confidence: 0.8,
    });
  }

  // Promote drafts
  if (lower.match(/promote\s+(?:all\s+)?drafts?/)) {
    const allMatch = lower.includes('all');
    actions.push({
      type: 'takeoff.promote_drafts',
      params: { scope: allMatch ? 'all' : 'selected' },
      confidence: 0.95,
    });
  }

  // Delete drafts
  if (lower.match(/delete\s+(?:all\s+)?drafts?/)) {
    const allMatch = lower.includes('all');
    actions.push({
      type: 'takeoff.delete_drafts',
      params: { scope: allMatch ? 'all' : 'selected' },
      confidence: 0.95,
    });
  }

  // === LABOR COMMANDS ===

  // Add labor task line
  const laborMatch = lower.match(/add\s+(?:labor\s+)?task\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(ea|each|sf|lf|hr|hours?)(?:\s+(?:at|@)\s*\$?(\d+(?:\.\d+)?))?/i);
  if (laborMatch) {
    const taskName = capitalizeWords(laborMatch[1].trim());
    const quantity = parseFloat(laborMatch[2]);
    const unit = normalizeUnit(laborMatch[3]);
    const baseRate = laborMatch[4] ? parseFloat(laborMatch[4]) : undefined;

    actions.push({
      type: 'labor.add_task_line',
      params: {
        task_name: taskName,
        quantity,
        unit,
        base_rate: baseRate,
        trade: inferTrade(taskName),
      },
      confidence: 0.85,
    });
  }

  // === EXPORT COMMANDS ===

  // Export PDF
  if (lower.match(/export\s+pdf/)) {
    actions.push({
      type: 'export.pdf',
      params: { includeDrafts: lower.includes('draft') },
      confidence: 0.95,
    });
  }

  // Export CSV
  const csvMatch = lower.match(/export\s+(.+?)\s*csv/);
  if (csvMatch) {
    const which = csvMatch[1].toLowerCase();
    let dataType = 'takeoff';
    if (which.includes('labor')) dataType = 'labor';
    else if (which.includes('rfi')) dataType = 'rfis';
    else if (which.includes('assumption')) dataType = 'assumptions';
    else if (which.includes('checklist')) dataType = 'checklist';

    actions.push({
      type: 'export.csv',
      params: { which: dataType, includeDrafts: lower.includes('draft') },
      confidence: 0.9,
    });
  }

  // === QA COMMANDS ===

  if (lower.match(/(?:show|list|check)\s*(?:qa|quality|issues?|problems?)/)) {
    actions.push({
      type: 'qa.show_issues',
      params: {},
      confidence: 0.95,
    });
  }

  // === PLANS COMMANDS ===

  if (lower.match(/open\s+(?:plan|blueprint|drawing)/)) {
    return {
      success: false,
      actions: [],
      missingInfo: 'Which plan file would you like to open?',
    };
  }

  // If no actions parsed
  if (actions.length === 0) {
    return {
      success: false,
      actions: [],
      error: `I couldn't understand that command. Try things like:\n• "Create project [name]. Tax 7 markup 20 burden 35"\n• "Add drywall 1050 sf at $12.99"\n• "Generate drafts using framing + drywall"\n• "Promote all drafts"\n• "Export PDF"`,
    };
  }

  return { success: true, actions };
}

// Helper functions

function capitalizeWords(text: string): string {
  return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function inferCategory(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('drywall') || lower.includes('sheetrock')) return 'Drywall';
  if (lower.includes('stud') || lower.includes('plate') || lower.includes('framing')) return 'Framing';
  if (lower.includes('insulation') || lower.includes('r-')) return 'Insulation';
  if (lower.includes('paint') || lower.includes('primer')) return 'Paint';
  if (lower.includes('electrical') || lower.includes('wire') || lower.includes('outlet') || lower.includes('switch')) return 'Electrical';
  if (lower.includes('plumb') || lower.includes('pipe') || lower.includes('drain')) return 'Plumbing';
  if (lower.includes('hvac') || lower.includes('duct')) return 'HVAC';
  if (lower.includes('floor') || lower.includes('tile') || lower.includes('carpet')) return 'Flooring';
  if (lower.includes('door')) return 'Doors';
  if (lower.includes('window')) return 'Windows';
  if (lower.includes('trim') || lower.includes('molding') || lower.includes('baseboard')) return 'Trim';
  if (lower.includes('roof') || lower.includes('shingle')) return 'Roofing';
  if (lower.includes('siding')) return 'Siding';
  if (lower.includes('concrete') || lower.includes('cement')) return 'Concrete';
  return 'General';
}

function inferTrade(taskName: string): string {
  const lower = taskName.toLowerCase();
  if (lower.includes('drywall') || lower.includes('tape') || lower.includes('mud')) return 'Drywall';
  if (lower.includes('frame') || lower.includes('stud') || lower.includes('carpent')) return 'Framing';
  if (lower.includes('electric') || lower.includes('wire')) return 'Electrical';
  if (lower.includes('plumb') || lower.includes('pipe')) return 'Plumbing';
  if (lower.includes('paint')) return 'Paint';
  if (lower.includes('hvac') || lower.includes('duct')) return 'HVAC';
  return 'General';
}

function inferProjectType(text: string): string {
  if (text.includes('basement')) return 'basement_finish';
  if (text.includes('deck')) return 'deck';
  if (text.includes('roof')) return 'roofing';
  if (text.includes('siding')) return 'siding';
  if (text.includes('kitchen')) return 'kitchen_remodel';
  if (text.includes('bath')) return 'bathroom_remodel';
  return 'basement_finish';
}

function extractAssemblyNames(text: string): string[] {
  // Split on common separators and clean up
  const parts = text.split(/[,+&]|\s+and\s+|\s+with\s+/i);
  const assemblies: string[] = [];

  for (const part of parts) {
    const cleaned = part.trim().toLowerCase();
    if (!cleaned) continue;

    // Match common assembly keywords
    if (cleaned.includes('framing') || cleaned.includes('frame')) assemblies.push('framing');
    else if (cleaned.includes('drywall') || cleaned.includes('sheetrock')) assemblies.push('drywall');
    else if (cleaned.includes('electrical') || cleaned.includes('electric')) assemblies.push('electrical');
    else if (cleaned.includes('plumb')) assemblies.push('plumbing');
    else if (cleaned.includes('insulation')) assemblies.push('insulation');
    else if (cleaned.includes('paint')) assemblies.push('paint');
    else if (cleaned.includes('trim')) assemblies.push('trim');
    else if (cleaned.includes('flooring') || cleaned.includes('floor')) assemblies.push('flooring');
    else if (cleaned.includes('hvac')) assemblies.push('hvac');
    else if (cleaned.includes('door')) assemblies.push('doors');
    else if (cleaned.includes('window')) assemblies.push('windows');
    else if (cleaned.includes('deck')) assemblies.push('deck');
    else if (cleaned.includes('roof')) assemblies.push('roofing');
    else if (cleaned.includes('siding')) assemblies.push('siding');
  }

  return [...new Set(assemblies)];
}

function extractVariablesFromCommand(command: string): Record<string, number> {
  const variables: Record<string, number> = {};
  const lower = command.toLowerCase();

  // Wall LF patterns
  const wallLfMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lf|linear\s*(?:feet|ft)|ft|')\s*(?:of\s*)?(?:walls?|framing)/i) ||
    lower.match(/walls?\s*(\d+(?:\.\d+)?)\s*(?:lf|linear\s*(?:feet|ft)|ft|')/i);
  if (wallLfMatch) variables.wall_lf = parseFloat(wallLfMatch[1]);

  // Wall/Drywall SF patterns
  const wallSfMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)\s*(?:of\s*)?(?:drywall|walls?)/i) ||
    lower.match(/drywall\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)/i);
  if (wallSfMatch) variables.wall_sf = parseFloat(wallSfMatch[1]);

  // Ceiling SF
  const ceilingSfMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)\s*(?:of\s*)?ceiling/i) ||
    lower.match(/ceiling[s]?\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)/i);
  if (ceilingSfMatch) variables.ceiling_sf = parseFloat(ceilingSfMatch[1]);

  // Ceiling height
  const ceilingHeightMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')\s*(?:ceiling|high|tall)/i) ||
    lower.match(/ceiling[s]?\s*(?:height)?\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')?/i);
  if (ceilingHeightMatch) variables.ceiling_height = parseFloat(ceilingHeightMatch[1]);

  // Doors
  const doorsMatch = lower.match(/(\d+)\s*(?:interior\s*)?doors?/i);
  if (doorsMatch) {
    variables.doors_count = parseInt(doorsMatch[1]);
    variables.door_count = parseInt(doorsMatch[1]);
  }

  // Windows
  const windowsMatch = lower.match(/(\d+)\s*windows?/i);
  if (windowsMatch) {
    variables.windows_count = parseInt(windowsMatch[1]);
    variables.window_count = parseInt(windowsMatch[1]);
  }

  // Soffit LF
  const soffitMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lf|ft|')\s*(?:of\s*)?soffit/i) ||
    lower.match(/soffit[s]?\s*(\d+(?:\.\d+)?)\s*(?:lf|ft|')/i);
  if (soffitMatch) variables.soffit_lf = parseFloat(soffitMatch[1]);

  // Floor SF
  const floorMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)\s*(?:of\s*)?floor/i);
  if (floorMatch) variables.floor_sf = parseFloat(floorMatch[1]);

  // Deck SF
  const deckMatch = lower.match(/deck\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)/i) ||
    lower.match(/(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)\s*(?:of\s*)?deck/i);
  if (deckMatch) variables.deck_sf = parseFloat(deckMatch[1]);

  return variables;
}

export { extractVariablesFromCommand };

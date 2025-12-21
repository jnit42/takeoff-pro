/**
 * Takeoff-related command rules
 */

import type { CommandRule, CommandContext, RuleResult, ParsedAction } from './types';

const UNIT_MAP: Record<string, string> = {
  'sf': 'SF', 'sqft': 'SF', 'sq ft': 'SF', 'square feet': 'SF', 'square foot': 'SF',
  'lf': 'LF', 'linear feet': 'LF', 'linear foot': 'LF', 'ft': 'LF', 'feet': 'LF',
  'ea': 'EA', 'each': 'EA', 'pc': 'EA', 'pcs': 'EA', 'pieces': 'EA',
  'sheet': 'SHT', 'sheets': 'SHT',
  'bd ft': 'BF', 'board feet': 'BF',
  'cy': 'CY', 'cubic yard': 'CY', 'cubic yards': 'CY',
  'sy': 'SY', 'square yard': 'SY', 'square yards': 'SY',
};

function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  return UNIT_MAP[lower] || unit.toUpperCase();
}

function capitalizeWords(text: string): string {
  return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function inferCategory(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('drywall') || lower.includes('sheetrock')) return 'Drywall';
  if (lower.includes('stud') || lower.includes('plate') || lower.includes('framing')) return 'Framing';
  if (lower.includes('insulation') || lower.includes('r-')) return 'Insulation';
  if (lower.includes('paint') || lower.includes('primer')) return 'Paint';
  if (lower.includes('electrical') || lower.includes('wire') || lower.includes('outlet')) return 'Electrical';
  if (lower.includes('plumb') || lower.includes('pipe') || lower.includes('drain')) return 'Plumbing';
  if (lower.includes('hvac') || lower.includes('duct')) return 'HVAC';
  if (lower.includes('floor') || lower.includes('tile') || lower.includes('carpet')) return 'Flooring';
  if (lower.includes('door')) return 'Doors';
  if (lower.includes('window')) return 'Windows';
  if (lower.includes('trim') || lower.includes('molding') || lower.includes('baseboard')) return 'Trim';
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
  const parts = text.split(/[,+&]|\s+and\s+|\s+with\s+/i);
  const assemblies: string[] = [];
  for (const part of parts) {
    const cleaned = part.trim().toLowerCase();
    if (!cleaned) continue;
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

  const wallLfMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lf|linear\s*(?:feet|ft)|ft|')\s*(?:of\s*)?(?:walls?|framing)/i);
  if (wallLfMatch) variables.wall_lf = parseFloat(wallLfMatch[1]);

  const wallSfMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)\s*(?:of\s*)?(?:drywall|walls?)/i);
  if (wallSfMatch) variables.wall_sf = parseFloat(wallSfMatch[1]);

  const ceilingSfMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)\s*(?:of\s*)?ceiling/i);
  if (ceilingSfMatch) variables.ceiling_sf = parseFloat(ceilingSfMatch[1]);

  const ceilingHeightMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')\s*(?:ceiling|high|tall)/i);
  if (ceilingHeightMatch) variables.ceiling_height = parseFloat(ceilingHeightMatch[1]);

  const doorsMatch = lower.match(/(\d+)\s*(?:interior\s*)?doors?/i);
  if (doorsMatch) {
    variables.doors_count = parseInt(doorsMatch[1]);
    variables.door_count = parseInt(doorsMatch[1]);
  }

  const windowsMatch = lower.match(/(\d+)\s*windows?/i);
  if (windowsMatch) {
    variables.windows_count = parseInt(windowsMatch[1]);
    variables.window_count = parseInt(windowsMatch[1]);
  }

  const soffitMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lf|ft|')\s*(?:of\s*)?soffit/i);
  if (soffitMatch) variables.soffit_lf = parseFloat(soffitMatch[1]);

  const floorMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)\s*(?:of\s*)?floor/i);
  if (floorMatch) variables.floor_sf = parseFloat(floorMatch[1]);

  const deckMatch = lower.match(/deck\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)/i);
  if (deckMatch) variables.deck_sf = parseFloat(deckMatch[1]);

  return variables;
}

export const addTakeoffItemRule: CommandRule = {
  id: 'takeoff.add_item',
  name: 'Add Takeoff Item',
  priority: 80,
  examples: [
    'Add drywall 1050 sf at $12.99',
    'Add 2x4 studs 100 ea at $3.50',
  ],
  requiredContext: ['projectId'],
  detect: (command) => {
    const lower = command.toLowerCase();
    return /add\s+.+\s+\d+\s*(?:sf|lf|ea|each|sheets?)/i.test(lower) && 
           !lower.includes('task') && !lower.includes('labor');
  },
  parse: (command, context): RuleResult => {
    if (!context.projectId) {
      return { matched: true, actions: [], missingInfo: 'Please open a project first.' };
    }
    
    const match = command.match(/add\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(sf|lf|ea|each|sq\s*ft|linear\s*(?:feet|ft)|sheets?|pcs?|cy|sy|bd\s*ft)?(?:\s+(?:at|@)\s*\$?(\d+(?:\.\d+)?))?/i);
    if (!match) return { matched: false, actions: [] };

    const description = capitalizeWords(match[1].trim());
    const quantity = parseFloat(match[2]);
    const unit = match[3] ? normalizeUnit(match[3]) : 'EA';
    const unitCost = match[4] ? parseFloat(match[4]) : undefined;
    const category = inferCategory(description);

    return {
      matched: true,
      actions: [{
        type: 'takeoff.add_item',
        params: {
          description, quantity, unit, unit_cost: unitCost, category,
          draft: command.toLowerCase().includes('draft'),
        },
        confidence: 0.85,
      }],
    };
  },
};

export const generateDraftsRule: CommandRule = {
  id: 'takeoff.generate_drafts',
  name: 'Generate Draft Items',
  priority: 85,
  examples: [
    'Generate drafts using framing + drywall. 90 LF walls, 8 ft ceilings',
    'Basement: generate drafts from framing, drywall, electrical',
  ],
  requiredContext: ['projectId'],
  detect: (command) => /generate\s+(?:drafts?|takeoff|items?)/i.test(command),
  parse: (command, context): RuleResult => {
    if (!context.projectId) {
      return { matched: true, actions: [], missingInfo: 'Please open a project first.' };
    }

    const match = command.match(/generate\s+(?:drafts?|takeoff|items?)\s+(?:using|from|for)\s+(.+)/i) ||
      command.match(/(.+?):\s*generate\s+drafts?\s+(?:using|from)\s+(.+)/i);
    
    if (!match) {
      return { matched: true, actions: [], missingInfo: 'Which assemblies? (e.g., framing, drywall, electrical)' };
    }

    const assembliesText = match[match.length - 1] || match[1];
    const assemblies = extractAssemblyNames(assembliesText);
    const variables = extractVariablesFromCommand(command);

    if (assemblies.length === 0) {
      return { matched: true, actions: [], missingInfo: 'Which assemblies? (e.g., framing, drywall, electrical)' };
    }

    return {
      matched: true,
      actions: [{
        type: 'takeoff.generate_drafts_from_assemblies',
        params: {
          assemblies, variables,
          project_type: context.projectType || inferProjectType(command.toLowerCase()),
          draft: true,
        },
        confidence: 0.8,
      }],
    };
  },
};

export const promoteDraftsRule: CommandRule = {
  id: 'takeoff.promote_drafts',
  name: 'Promote Drafts',
  priority: 90,
  examples: ['Promote all drafts', 'Promote drafts'],
  requiredContext: ['projectId'],
  detect: (command) => /promote\s+(?:all\s+)?drafts?/i.test(command),
  parse: (command, context): RuleResult => {
    if (!context.projectId) {
      return { matched: true, actions: [], missingInfo: 'Please open a project first.' };
    }
    const allMatch = command.toLowerCase().includes('all');
    return {
      matched: true,
      actions: [{ type: 'takeoff.promote_drafts', params: { scope: allMatch ? 'all' : 'selected' }, confidence: 0.95 }],
    };
  },
};

export const deleteDraftsRule: CommandRule = {
  id: 'takeoff.delete_drafts',
  name: 'Delete Drafts',
  priority: 90,
  examples: ['Delete all drafts', 'Delete drafts'],
  requiredContext: ['projectId'],
  detect: (command) => /delete\s+(?:all\s+)?drafts?/i.test(command),
  parse: (command, context): RuleResult => {
    if (!context.projectId) {
      return { matched: true, actions: [], missingInfo: 'Please open a project first.' };
    }
    const allMatch = command.toLowerCase().includes('all');
    return {
      matched: true,
      actions: [{ type: 'takeoff.delete_drafts', params: { scope: allMatch ? 'all' : 'selected' }, confidence: 0.95 }],
    };
  },
};

export const takeoffRules: CommandRule[] = [
  generateDraftsRule,
  promoteDraftsRule,
  deleteDraftsRule,
  addTakeoffItemRule,
];

/**
 * Project-related command rules
 */

import type { CommandRule, CommandContext, RuleResult, ParsedAction } from './types';

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
  const direct = parseFloat(text);
  if (!isNaN(direct)) return direct;
  const lower = text.toLowerCase();
  if (WORD_NUMBERS[lower] !== undefined) return WORD_NUMBERS[lower];
  const parts = lower.split(/[\s-]+/);
  if (parts.length === 2) {
    const tens = WORD_NUMBERS[parts[0]];
    const ones = WORD_NUMBERS[parts[1]];
    if (tens !== undefined && ones !== undefined) return tens + ones;
  }
  return null;
}

function capitalizeWords(text: string): string {
  return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const createProjectRule: CommandRule = {
  id: 'project.create',
  name: 'Create Project',
  priority: 100,
  examples: [
    'Create project Smithfield Addition',
    'Create project Kitchen Remodel. Tax 7 markup 20 burden 35',
  ],
  requiredContext: [],
  detect: (command) => /create\s+project/i.test(command),
  parse: (command): RuleResult => {
    const match = command.match(/create\s+project\s+(.+?)(?:\.\s*|$)/i);
    if (!match) return { matched: false, actions: [] };
    
    const rest = match[1];
    const name = rest.split(/\s*(?:tax|markup|burden|address)/i)[0].trim();
    
    const actions: ParsedAction[] = [{
      type: 'project.create',
      params: { name: capitalizeWords(name) },
      confidence: 0.9,
    }];

    return { matched: true, actions };
  },
};

export const setDefaultsRule: CommandRule = {
  id: 'project.set_defaults',
  name: 'Set Project Defaults',
  priority: 90,
  examples: [
    'Set tax 7 markup 20 burden 35',
    'Set markup 15 percent',
    'Set waste 10%',
  ],
  requiredContext: ['projectId'],
  detect: (command) => {
    const lower = command.toLowerCase();
    return /(?:tax|markup|burden|waste)\s*(?:rate|percent|%)?\s*[:=]?\s*(\d+|\w+)/i.test(lower);
  },
  parse: (command, context): RuleResult => {
    if (!context.projectId) {
      return { matched: true, actions: [], missingInfo: 'Please open a project first to set defaults.' };
    }
    
    const lower = command.toLowerCase();
    const params: Record<string, number> = {};

    const taxMatch = lower.match(/tax\s*(?:rate|percent|%)?\s*[:=]?\s*(\d+(?:\.\d+)?|\w+)/);
    const markupMatch = lower.match(/markup\s*(?:rate|percent|%)?\s*[:=]?\s*(\d+(?:\.\d+)?|\w+)/);
    const burdenMatch = lower.match(/(?:labor\s*)?burden\s*(?:rate|percent|%)?\s*[:=]?\s*(\d+(?:\.\d+)?|\w+)/);
    const wasteMatch = lower.match(/(?:default\s*)?waste\s*(?:rate|percent|%)?\s*[:=]?\s*(\d+(?:\.\d+)?|\w+)/);

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

    if (Object.keys(params).length === 0) {
      return { matched: false, actions: [] };
    }

    return {
      matched: true,
      actions: [{ type: 'project.set_defaults', params, confidence: 0.95 }],
    };
  },
};

export const projectRules: CommandRule[] = [createProjectRule, setDefaultsRule];

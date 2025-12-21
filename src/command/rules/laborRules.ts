/**
 * Labor-related command rules
 */

import type { CommandRule, RuleResult } from './types';

const UNIT_MAP: Record<string, string> = {
  'ea': 'EA', 'each': 'EA', 'sf': 'SF', 'lf': 'LF', 
  'hr': 'HR', 'hour': 'HR', 'hours': 'HR',
};

function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  return UNIT_MAP[lower] || unit.toUpperCase();
}

function capitalizeWords(text: string): string {
  return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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

export const addLaborTaskRule: CommandRule = {
  id: 'labor.add_task_line',
  name: 'Add Labor Task',
  priority: 80,
  examples: [
    'Add labor task framing 100 hr at $45',
    'Add task drywall hanging 1050 sf at $1.25',
  ],
  requiredContext: ['projectId'],
  detect: (command) => /add\s+(?:labor\s+)?task/i.test(command),
  parse: (command, context): RuleResult => {
    if (!context.projectId) {
      return { matched: true, actions: [], missingInfo: 'Please open a project first.' };
    }

    const match = command.match(/add\s+(?:labor\s+)?task\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(ea|each|sf|lf|hr|hours?)(?:\s+(?:at|@)\s*\$?(\d+(?:\.\d+)?))?/i);
    if (!match) {
      return { matched: true, actions: [], missingInfo: 'Please specify: task name, quantity, unit, and optionally rate. E.g., "Add task framing 100 hr at $45"' };
    }

    const taskName = capitalizeWords(match[1].trim());
    const quantity = parseFloat(match[2]);
    const unit = normalizeUnit(match[3]);
    const baseRate = match[4] ? parseFloat(match[4]) : undefined;

    return {
      matched: true,
      actions: [{
        type: 'labor.add_task_line',
        params: { task_name: taskName, quantity, unit, base_rate: baseRate, trade: inferTrade(taskName) },
        confidence: 0.85,
      }],
    };
  },
};

export const laborRules: CommandRule[] = [addLaborTaskRule];

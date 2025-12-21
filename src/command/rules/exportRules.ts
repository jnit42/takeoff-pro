/**
 * Export-related command rules
 */

import type { CommandRule, RuleResult } from './types';

export const exportPDFRule: CommandRule = {
  id: 'export.pdf',
  name: 'Export PDF',
  priority: 95,
  examples: ['Export PDF', 'Export PDF with drafts'],
  requiredContext: ['projectId'],
  detect: (command) => /export\s+pdf/i.test(command),
  parse: (command, context): RuleResult => {
    if (!context.projectId) {
      return { matched: true, actions: [], missingInfo: 'Please open a project first.' };
    }
    return {
      matched: true,
      actions: [{
        type: 'export.pdf',
        params: { includeDrafts: command.toLowerCase().includes('draft') },
        confidence: 0.95,
      }],
    };
  },
};

export const exportCSVRule: CommandRule = {
  id: 'export.csv',
  name: 'Export CSV',
  priority: 94,
  examples: [
    'Export takeoff CSV',
    'Export labor CSV',
    'Export RFIs CSV',
  ],
  requiredContext: ['projectId'],
  detect: (command) => /export\s+.+\s*csv/i.test(command),
  parse: (command, context): RuleResult => {
    if (!context.projectId) {
      return { matched: true, actions: [], missingInfo: 'Please open a project first.' };
    }
    
    const match = command.match(/export\s+(.+?)\s*csv/i);
    if (!match) return { matched: false, actions: [] };

    const which = match[1].toLowerCase();
    let dataType = 'takeoff';
    if (which.includes('labor')) dataType = 'labor';
    else if (which.includes('rfi')) dataType = 'rfis';
    else if (which.includes('assumption')) dataType = 'assumptions';
    else if (which.includes('checklist')) dataType = 'checklist';

    return {
      matched: true,
      actions: [{
        type: 'export.csv',
        params: { which: dataType, includeDrafts: command.toLowerCase().includes('draft') },
        confidence: 0.9,
      }],
    };
  },
};

export const exportRules: CommandRule[] = [exportPDFRule, exportCSVRule];

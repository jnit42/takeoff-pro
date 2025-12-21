/**
 * QA and utility command rules
 */

import type { CommandRule, RuleResult } from './types';
import { PARSER_VERSION } from './types';

export const showIssuesRule: CommandRule = {
  id: 'qa.show_issues',
  name: 'Show QA Issues',
  priority: 95,
  examples: ['Show QA issues', 'List issues', 'Check quality'],
  requiredContext: ['projectId'],
  detect: (command) => /(?:show|list|check)\s*(?:qa|quality|issues?|problems?)/i.test(command),
  parse: (command, context): RuleResult => {
    if (!context.projectId) {
      return { matched: true, actions: [], missingInfo: 'Please open a project first.' };
    }
    return {
      matched: true,
      actions: [{ type: 'qa.show_issues', params: {}, confidence: 0.95 }],
    };
  },
};

export const capabilitiesRule: CommandRule = {
  id: 'system.capabilities',
  name: 'Show Capabilities',
  priority: 100,
  examples: ['What can you do?', 'Help', 'Show commands'],
  requiredContext: [],
  detect: (command) => {
    const lower = command.toLowerCase();
    return /what\s+can\s+you\s+do/i.test(lower) ||
           /^help$/i.test(lower.trim()) ||
           /show\s+(?:commands|capabilities|help)/i.test(lower);
  },
  parse: (): RuleResult => {
    return {
      matched: true,
      actions: [{ type: 'system.capabilities', params: { version: PARSER_VERSION }, confidence: 1.0 }],
    };
  },
};

export const qaRules: CommandRule[] = [showIssuesRule, capabilitiesRule];

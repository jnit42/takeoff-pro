/**
 * Command Rule Registry - Extensible command parsing system
 */

import type { CommandRule, CommandContext, ParsedAction } from './types';
import { SCHEMA_VERSION, PARSER_VERSION } from './types';
import { projectRules } from './projectRules';
import { takeoffRules } from './takeoffRules';
import { exportRules } from './exportRules';
import { qaRules } from './qaRules';
import { laborRules } from './laborRules';

// Collect all rules and sort by priority (descending)
const allRules: CommandRule[] = [
  ...projectRules,
  ...takeoffRules,
  ...exportRules,
  ...qaRules,
  ...laborRules,
].sort((a, b) => b.priority - a.priority);

export interface ParseResult {
  success: boolean;
  actions: ParsedAction[];
  missingInfo?: string;
  error?: string;
  schemaVersion: number;
  parserVersion: string;
}

/**
 * Parse a command using the rule registry
 */
export function parseCommand(command: string, context: CommandContext = {}): ParseResult {
  const trimmed = command.trim();
  if (!trimmed) {
    return {
      success: false,
      actions: [],
      error: 'Empty command',
      schemaVersion: SCHEMA_VERSION,
      parserVersion: PARSER_VERSION,
    };
  }

  // Try each rule in priority order
  for (const rule of allRules) {
    if (rule.detect(trimmed, context)) {
      const result = rule.parse(trimmed, context);
      
      if (result.matched) {
        if (result.missingInfo) {
          return {
            success: false,
            actions: [],
            missingInfo: result.missingInfo,
            schemaVersion: SCHEMA_VERSION,
            parserVersion: PARSER_VERSION,
          };
        }
        
        return {
          success: result.actions.length > 0,
          actions: result.actions,
          schemaVersion: SCHEMA_VERSION,
          parserVersion: PARSER_VERSION,
        };
      }
    }
  }

  // Also check for combined commands (e.g., "Create project X. Tax 7 markup 20")
  const combinedActions: ParsedAction[] = [];
  for (const rule of allRules) {
    if (rule.detect(trimmed, context)) {
      const result = rule.parse(trimmed, context);
      if (result.matched && result.actions.length > 0) {
        combinedActions.push(...result.actions);
      }
    }
  }

  if (combinedActions.length > 0) {
    return {
      success: true,
      actions: combinedActions,
      schemaVersion: SCHEMA_VERSION,
      parserVersion: PARSER_VERSION,
    };
  }

  return {
    success: false,
    actions: [],
    error: getHelpText(),
    schemaVersion: SCHEMA_VERSION,
    parserVersion: PARSER_VERSION,
  };
}

/**
 * Get all available commands for help
 */
export function getCapabilities(): { rules: { id: string; name: string; examples: string[] }[] } {
  return {
    rules: allRules.map(r => ({
      id: r.id,
      name: r.name,
      examples: r.examples,
    })),
  };
}

function getHelpText(): string {
  return `I couldn't understand that command. Try things like:
• "Create project [name]. Tax 7 markup 20 burden 35"
• "Add drywall 1050 sf at $12.99"
• "Generate drafts using framing + drywall"
• "Promote all drafts"
• "Export PDF"
• "Show QA issues"
• "What can you do?" for full list`;
}

// Re-export types
export type { ParsedAction, CommandContext, CommandRule } from './types';
export { SCHEMA_VERSION, PARSER_VERSION } from './types';

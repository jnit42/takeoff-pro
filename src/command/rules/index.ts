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

export interface ParseSuggestion {
  label: string;
  command: string;
}

export interface ParseResult {
  success: boolean;
  actions: ParsedAction[];
  missingInfo?: string;
  error?: string;
  suggestions?: ParseSuggestion[];
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

  // Smart fallback with suggestions
  const suggestions = getSmartSuggestions(trimmed);
  
  return {
    success: false,
    actions: [],
    error: suggestions.message,
    suggestions: suggestions.suggestions,
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

function getSmartSuggestions(command: string): { message: string; suggestions: ParseSuggestion[] } {
  const lower = command.toLowerCase();
  const suggestions: ParseSuggestion[] = [];
  
  // Keyword heuristics for smart suggestions
  if (/export|pdf|csv|download|save/i.test(lower)) {
    suggestions.push({ label: 'Export PDF', command: 'Export PDF' });
    suggestions.push({ label: 'Export takeoff CSV', command: 'Export takeoff CSV' });
  }
  
  if (/markup|tax|burden|percent|%/i.test(lower)) {
    suggestions.push({ label: 'Set markup', command: 'Set markup 20 percent' });
    suggestions.push({ label: 'Set tax', command: 'Set tax 7 percent' });
    suggestions.push({ label: 'Set burden', command: 'Set burden 35 percent' });
  }
  
  if (/draft|promote|finalize/i.test(lower)) {
    suggestions.push({ label: 'Promote drafts', command: 'Promote all drafts' });
    suggestions.push({ label: 'Delete drafts', command: 'Delete all drafts' });
  }
  
  if (/drywall|stud|flooring|tile|framing|deck|lumber/i.test(lower)) {
    suggestions.push({ label: 'Add drywall', command: 'Add drywall 500 sf at $12.99' });
    suggestions.push({ label: 'Add studs', command: 'Add studs 100 each at $4.50' });
  }
  
  if (/generate|assembly|assemblies/i.test(lower)) {
    suggestions.push({ label: 'Generate from assemblies', command: 'Generate drafts using framing + drywall' });
  }
  
  if (/qa|issue|check|review/i.test(lower)) {
    suggestions.push({ label: 'Show QA issues', command: 'Show QA issues' });
  }
  
  if (/plan|open|view|sheet/i.test(lower)) {
    suggestions.push({ label: 'Open plans', command: 'Open plans' });
  }
  
  if (/create|project|new/i.test(lower)) {
    suggestions.push({ label: 'Create project', command: 'Create project My New Project' });
  }
  
  // Add default suggestions if none matched
  if (suggestions.length === 0) {
    suggestions.push(
      { label: 'Add takeoff item', command: 'Add drywall 500 sf at $12.99' },
      { label: 'Generate drafts', command: 'Generate drafts using framing + drywall' },
      { label: 'Set markup/tax', command: 'Set markup 20 tax 7 burden 35' },
      { label: 'Export PDF', command: 'Export PDF' },
      { label: 'Show help', command: 'What can you do?' }
    );
  }
  
  // Limit to 5 suggestions
  const finalSuggestions = suggestions.slice(0, 5);
  
  return {
    message: `I didn't understand that command. Did you mean one of these?`,
    suggestions: finalSuggestions,
  };
}

// Re-export types
export type { ParsedAction, CommandContext, CommandRule } from './types';
export { SCHEMA_VERSION, PARSER_VERSION } from './types';

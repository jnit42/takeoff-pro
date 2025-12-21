/**
 * Command Rule Types - Extensible rule system
 */

export interface CommandContext {
  projectId?: string;
  projectType?: string;
}

export interface ParsedAction {
  type: string;
  params: Record<string, unknown>;
  confidence: number;
}

export interface RuleResult {
  matched: boolean;
  actions: ParsedAction[];
  missingInfo?: string;
  followUp?: string;
}

export interface CommandRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Priority (higher = checked first) */
  priority: number;
  /** Example commands for help */
  examples: string[];
  /** Required context keys (e.g., ['projectId']) */
  requiredContext: string[];
  /** Check if this rule matches the command */
  detect: (command: string, context: CommandContext) => boolean;
  /** Parse command into actions */
  parse: (command: string, context: CommandContext) => RuleResult;
}

// Versioning constants
export const SCHEMA_VERSION = 1;
export const PARSER_VERSION = '1.0.0';

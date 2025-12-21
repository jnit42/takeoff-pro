/**
 * Safe formula evaluator - no eval/new Function
 * Supports: +, -, *, /, parentheses, numbers, and variable names
 */

type Variables = Record<string, number>;

interface Token {
  type: 'number' | 'operator' | 'variable' | 'lparen' | 'rparen';
  value: string | number;
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < formula.length) {
    const char = formula[i];
    
    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    
    // Numbers (including decimals)
    if (/[\d.]/.test(char)) {
      let num = '';
      while (i < formula.length && /[\d.]/.test(formula[i])) {
        num += formula[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }
    
    // Operators
    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ type: 'operator', value: char });
      i++;
      continue;
    }
    
    // Parentheses
    if (char === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }
    
    // Variable names (letters, underscores, numbers)
    if (/[a-zA-Z_]/.test(char)) {
      let varName = '';
      while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
        varName += formula[i];
        i++;
      }
      tokens.push({ type: 'variable', value: varName });
      continue;
    }
    
    // Skip unknown characters
    i++;
  }
  
  return tokens;
}

function parseExpression(tokens: Token[], pos: { i: number }, variables: Variables): number {
  let left = parseTerm(tokens, pos, variables);
  
  while (pos.i < tokens.length) {
    const token = tokens[pos.i];
    if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
      pos.i++;
      const right = parseTerm(tokens, pos, variables);
      left = token.value === '+' ? left + right : left - right;
    } else {
      break;
    }
  }
  
  return left;
}

function parseTerm(tokens: Token[], pos: { i: number }, variables: Variables): number {
  let left = parseFactor(tokens, pos, variables);
  
  while (pos.i < tokens.length) {
    const token = tokens[pos.i];
    if (token.type === 'operator' && (token.value === '*' || token.value === '/')) {
      pos.i++;
      const right = parseFactor(tokens, pos, variables);
      left = token.value === '*' ? left * right : (right !== 0 ? left / right : 0);
    } else {
      break;
    }
  }
  
  return left;
}

function parseFactor(tokens: Token[], pos: { i: number }, variables: Variables): number {
  const token = tokens[pos.i];
  
  if (!token) return 0;
  
  if (token.type === 'number') {
    pos.i++;
    return token.value as number;
  }
  
  if (token.type === 'variable') {
    pos.i++;
    const varName = token.value as string;
    if (varName in variables) {
      return variables[varName];
    }
    throw new Error(`Missing variable: ${varName}`);
  }
  
  if (token.type === 'lparen') {
    pos.i++;
    const result = parseExpression(tokens, pos, variables);
    if (tokens[pos.i]?.type === 'rparen') {
      pos.i++;
    }
    return result;
  }
  
  // Handle unary minus
  if (token.type === 'operator' && token.value === '-') {
    pos.i++;
    return -parseFactor(tokens, pos, variables);
  }
  
  return 0;
}

/**
 * Evaluate a formula string with given variables
 * Returns { result, missingVars } where missingVars are variables not provided
 */
export function evaluateFormula(
  formula: string,
  variables: Variables
): { result: number | null; missingVars: string[] } {
  try {
    const tokens = tokenize(formula);
    const requiredVars = tokens
      .filter(t => t.type === 'variable')
      .map(t => t.value as string);
    
    const missingVars = requiredVars.filter(v => !(v in variables) || variables[v] === undefined);
    
    if (missingVars.length > 0) {
      return { result: null, missingVars: [...new Set(missingVars)] };
    }
    
    const pos = { i: 0 };
    const result = parseExpression(tokens, pos, variables);
    
    return { result: Math.ceil(result * 100) / 100, missingVars: [] };
  } catch (error) {
    return { result: null, missingVars: [] };
  }
}

/**
 * Extract all variable names from a formula
 */
export function extractVariables(formula: string): string[] {
  const tokens = tokenize(formula);
  const vars = tokens
    .filter(t => t.type === 'variable')
    .map(t => t.value as string);
  return [...new Set(vars)];
}

/**
 * Get all required variables from a list of assembly items
 */
export function getRequiredVariables(
  items: { formula: string }[]
): string[] {
  const allVars = new Set<string>();
  for (const item of items) {
    const vars = extractVariables(item.formula);
    vars.forEach(v => allVars.add(v));
  }
  return Array.from(allVars);
}

/**
 * Variable display names for user-friendly prompts
 */
export const VARIABLE_LABELS: Record<string, string> = {
  wall_lf: 'Wall Linear Feet (LF)',
  wall_sf: 'Wall Square Feet (SF)',
  ceiling_sf: 'Ceiling Square Feet (SF)',
  floor_sf: 'Floor Square Feet (SF)',
  soffit_lf: 'Soffit/Bulkhead Linear Feet (LF)',
  doors_count: 'Number of Doors',
  door_count: 'Number of Doors',
  windows_count: 'Number of Windows',
  window_count: 'Number of Windows',
  ceiling_height: 'Ceiling Height (feet)',
  room_count: 'Number of Rooms',
  room_perimeter: 'Room Perimeter (LF)',
  door_openings_lf: 'Door Opening Width Total (LF)',
  outside_corners: 'Number of Outside Corners',
  inside_corners: 'Number of Inside Corners',
  garage_ceiling_sf: 'Garage Ceiling SF (fire-rated)',
  deck_sf: 'Deck Square Feet',
  deck_width: 'Deck Width (feet)',
  deck_perimeter: 'Deck Perimeter (LF)',
  post_count: 'Number of Posts',
  joist_count: 'Number of Joists',
  rail_lf: 'Railing Linear Feet',
  roof_squares: 'Roof Squares',
  siding_sf: 'Siding Square Feet',
  ridge_lf: 'Ridge Linear Feet',
  valley_lf: 'Valley Linear Feet',
  eave_lf: 'Eave/Drip Edge LF',
  rake_lf: 'Rake Edge LF',
};

/**
 * Extract numeric variables from natural language text
 */
export function extractVariablesFromText(text: string): Variables {
  const variables: Variables = {};
  const lowerText = text.toLowerCase();
  
  // Patterns to match various ways users might express measurements
  const patterns: { regex: RegExp; vars: string[] }[] = [
    // Wall measurements
    { regex: /(\d+(?:\.\d+)?)\s*(?:linear\s*)?(?:feet|ft|lf|')\s*(?:of\s*)?(?:wall|framing)/i, vars: ['wall_lf'] },
    { regex: /wall[s]?\s*(?:are|is)?\s*(\d+(?:\.\d+)?)\s*(?:linear\s*)?(?:feet|ft|lf|')/i, vars: ['wall_lf'] },
    { regex: /framing\s*(\d+)\s*(?:lf|linear feet|ft)/i, vars: ['wall_lf'] },
    
    // Square footage patterns
    { regex: /(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)\s*(?:of\s*)?drywall/i, vars: ['wall_sf'] },
    { regex: /drywall\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)/i, vars: ['wall_sf'] },
    { regex: /(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)\s*(?:of\s*)?ceiling/i, vars: ['ceiling_sf'] },
    { regex: /ceiling[s]?\s*(?:are|is)?\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)/i, vars: ['ceiling_sf'] },
    { regex: /(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)\s*(?:of\s*)?floor/i, vars: ['floor_sf'] },
    { regex: /floor[s]?\s*(?:are|is)?\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)/i, vars: ['floor_sf'] },
    
    // Combined wall/ceiling SF (often given together for basements)
    { regex: /(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft)\s*(?:total\s*)?(?:walls?\s*(?:and|&)\s*ceiling|drywall)/i, vars: ['wall_sf'] },
    
    // Soffit/bulkhead
    { regex: /soffit[s]?\s*(\d+(?:\.\d+)?)\s*(?:lf|linear feet|ft|')/i, vars: ['soffit_lf'] },
    { regex: /(\d+(?:\.\d+)?)\s*(?:lf|linear feet|ft|')\s*(?:of\s*)?soffit/i, vars: ['soffit_lf'] },
    { regex: /bulkhead[s]?\s*(\d+(?:\.\d+)?)\s*(?:lf|linear feet|ft|')/i, vars: ['soffit_lf'] },
    
    // Doors
    { regex: /(\d+)\s*(?:interior\s*)?door[s]?/i, vars: ['doors_count', 'door_count'] },
    { regex: /door[s]?\s*(?:count|qty|quantity)?[:\s]*(\d+)/i, vars: ['doors_count', 'door_count'] },
    
    // Windows
    { regex: /(\d+)\s*window[s]?/i, vars: ['windows_count', 'window_count'] },
    { regex: /window[s]?\s*(?:count|qty|quantity)?[:\s]*(\d+)/i, vars: ['windows_count', 'window_count'] },
    
    // Ceiling height
    { regex: /(\d+(?:\.\d+)?)['\s]*(?:foot|ft|')?\s*ceiling[s]?/i, vars: ['ceiling_height'] },
    { regex: /ceiling[s]?\s*(?:height|ht)?[:\s]*(\d+(?:\.\d+)?)['\s]*(?:foot|ft|feet|')?/i, vars: ['ceiling_height'] },
    { regex: /(\d+(?:\.\d+)?)['\s]*(?:foot|ft|')?\s*(?:high|tall|height)/i, vars: ['ceiling_height'] },
    
    // Deck measurements
    { regex: /deck\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)/i, vars: ['deck_sf'] },
    { regex: /(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)\s*deck/i, vars: ['deck_sf'] },
    
    // Posts
    { regex: /(\d+)\s*post[s]?/i, vars: ['post_count'] },
    
    // Rails
    { regex: /(\d+(?:\.\d+)?)\s*(?:lf|linear feet|ft|')\s*(?:of\s*)?rail(?:ing)?/i, vars: ['rail_lf'] },
    { regex: /rail(?:ing)?[s]?\s*(\d+(?:\.\d+)?)\s*(?:lf|linear feet|ft|')/i, vars: ['rail_lf'] },
    
    // Rooms
    { regex: /(\d+)\s*room[s]?/i, vars: ['room_count'] },
    
    // Outside corners
    { regex: /(\d+)\s*(?:outside|exterior)\s*corner[s]?/i, vars: ['outside_corners'] },
    
    // Room perimeter
    { regex: /(?:room\s*)?perimeter\s*(\d+(?:\.\d+)?)\s*(?:lf|linear feet|ft|')/i, vars: ['room_perimeter'] },
    
    // Door openings LF
    { regex: /door\s*opening[s]?\s*(\d+(?:\.\d+)?)\s*(?:lf|linear feet|ft|')/i, vars: ['door_openings_lf'] },
    
    // Roof
    { regex: /(\d+(?:\.\d+)?)\s*(?:roof\s*)?square[s]?/i, vars: ['roof_squares'] },
    
    // Siding
    { regex: /(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)\s*(?:of\s*)?siding/i, vars: ['siding_sf'] },
    { regex: /siding\s*(\d+(?:\.\d+)?)\s*(?:sf|sq\s*ft|square\s*feet)/i, vars: ['siding_sf'] },
  ];
  
  for (const { regex, vars } of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const value = parseFloat(match[1]);
      for (const varName of vars) {
        if (!variables[varName]) {
          variables[varName] = value;
        }
      }
    }
  }
  
  return variables;
}

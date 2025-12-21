/**
 * Construction Knowledge Base
 * Domain knowledge for estimating: assemblies, formulas, coverage rates
 */

// ============================================================
// UNIT DEFINITIONS
// ============================================================

export interface UnitDefinition {
  code: string;
  name: string;
  plural: string;
  aliases: string[];
}

export const UNITS: Record<string, UnitDefinition> = {
  SF: { code: 'SF', name: 'Square Foot', plural: 'Square Feet', aliases: ['sqft', 'sq ft', 'square feet', 'square foot'] },
  LF: { code: 'LF', name: 'Linear Foot', plural: 'Linear Feet', aliases: ['lf', 'lin ft', 'linear feet', 'linear foot'] },
  EA: { code: 'EA', name: 'Each', plural: 'Each', aliases: ['ea', 'each', 'piece', 'pieces', 'pc', 'pcs'] },
  SY: { code: 'SY', name: 'Square Yard', plural: 'Square Yards', aliases: ['sqyd', 'sq yd', 'square yard', 'square yards'] },
  CF: { code: 'CF', name: 'Cubic Foot', plural: 'Cubic Feet', aliases: ['cuft', 'cu ft', 'cubic feet', 'cubic foot'] },
  CY: { code: 'CY', name: 'Cubic Yard', plural: 'Cubic Yards', aliases: ['cuyd', 'cu yd', 'cubic yard', 'cubic yards'] },
  HR: { code: 'HR', name: 'Hour', plural: 'Hours', aliases: ['hr', 'hrs', 'hour', 'hours'] },
  BF: { code: 'BF', name: 'Board Foot', plural: 'Board Feet', aliases: ['bf', 'board foot', 'board feet'] },
  TON: { code: 'TON', name: 'Ton', plural: 'Tons', aliases: ['ton', 'tons'] },
  GAL: { code: 'GAL', name: 'Gallon', plural: 'Gallons', aliases: ['gal', 'gallon', 'gallons'] },
  BAG: { code: 'BAG', name: 'Bag', plural: 'Bags', aliases: ['bag', 'bags'] },
  ROLL: { code: 'ROLL', name: 'Roll', plural: 'Rolls', aliases: ['roll', 'rolls'] },
  BOX: { code: 'BOX', name: 'Box', plural: 'Boxes', aliases: ['box', 'boxes'] },
  SHEET: { code: 'SHEET', name: 'Sheet', plural: 'Sheets', aliases: ['sheet', 'sheets'] },
};

// ============================================================
// MATERIAL DEFINITIONS WITH COVERAGE RATES
// ============================================================

export interface MaterialDefinition {
  id: string;
  name: string;
  category: string;
  trade: string;
  unit: string;
  coverageRate?: number;      // How much area/length one unit covers
  coverageUnit?: string;      // What unit the coverage is in (SF, LF, etc.)
  packageSize?: number;       // Units per package
  typicalWaste?: number;      // Typical waste percentage
  typicalCost?: { min: number; max: number; avg: number };
  description?: string;
  relatedMaterials?: string[];
}

export const MATERIALS: Record<string, MaterialDefinition> = {
  // Drywall
  'drywall-4x8-1/2': {
    id: 'drywall-4x8-1/2',
    name: '1/2" Drywall 4x8 Sheet',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'SHEET',
    coverageRate: 32,
    coverageUnit: 'SF',
    typicalWaste: 10,
    typicalCost: { min: 10, max: 18, avg: 14 },
    description: 'Standard 1/2 inch drywall sheet, 4ft x 8ft',
    relatedMaterials: ['drywall-mud', 'drywall-tape', 'drywall-screws'],
  },
  'drywall-4x8-5/8': {
    id: 'drywall-4x8-5/8',
    name: '5/8" Drywall 4x8 Sheet',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'SHEET',
    coverageRate: 32,
    coverageUnit: 'SF',
    typicalWaste: 10,
    typicalCost: { min: 12, max: 22, avg: 17 },
    description: 'Fire-rated or moisture-resistant 5/8 inch drywall',
    relatedMaterials: ['drywall-mud', 'drywall-tape', 'drywall-screws'],
  },
  'drywall-mud': {
    id: 'drywall-mud',
    name: 'Joint Compound (Mud)',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'GAL',
    coverageRate: 100,
    coverageUnit: 'SF',
    typicalWaste: 15,
    typicalCost: { min: 15, max: 35, avg: 22 },
    description: 'Joint compound for finishing drywall seams',
  },
  'drywall-tape': {
    id: 'drywall-tape',
    name: 'Drywall Tape',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'ROLL',
    coverageRate: 500,
    coverageUnit: 'LF',
    typicalWaste: 10,
    typicalCost: { min: 5, max: 12, avg: 8 },
  },
  'drywall-screws': {
    id: 'drywall-screws',
    name: 'Drywall Screws',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'BOX',
    coverageRate: 500,
    coverageUnit: 'SF',
    typicalWaste: 5,
    typicalCost: { min: 25, max: 45, avg: 35 },
    description: '1 lb box of 1-1/4" drywall screws',
  },

  // Framing
  'stud-2x4-8': {
    id: 'stud-2x4-8',
    name: '2x4x8 Stud',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 1.33,  // One stud per 16" OC = ~1.33 LF of wall
    coverageUnit: 'LF',
    typicalWaste: 8,
    typicalCost: { min: 3, max: 8, avg: 5 },
    description: 'Dimensional lumber 2x4, 8 foot length',
    relatedMaterials: ['stud-2x4-10', 'top-plate', 'bottom-plate'],
  },
  'stud-2x4-10': {
    id: 'stud-2x4-10',
    name: '2x4x10 Stud',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 1.33,
    coverageUnit: 'LF',
    typicalWaste: 8,
    typicalCost: { min: 4, max: 10, avg: 7 },
  },
  'stud-2x6-8': {
    id: 'stud-2x6-8',
    name: '2x6x8 Stud',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 1.33,
    coverageUnit: 'LF',
    typicalWaste: 8,
    typicalCost: { min: 5, max: 12, avg: 8 },
    description: 'Dimensional lumber 2x6, 8 foot length for exterior walls',
  },

  // Insulation
  'insulation-r13-batt': {
    id: 'insulation-r13-batt',
    name: 'R-13 Fiberglass Batt',
    category: 'Insulation',
    trade: 'Insulation',
    unit: 'SF',
    typicalWaste: 5,
    typicalCost: { min: 0.50, max: 1.20, avg: 0.85 },
    description: 'R-13 insulation for 2x4 walls',
  },
  'insulation-r19-batt': {
    id: 'insulation-r19-batt',
    name: 'R-19 Fiberglass Batt',
    category: 'Insulation',
    trade: 'Insulation',
    unit: 'SF',
    typicalWaste: 5,
    typicalCost: { min: 0.75, max: 1.50, avg: 1.10 },
    description: 'R-19 insulation for 2x6 walls',
  },

  // Flooring
  'lvp-flooring': {
    id: 'lvp-flooring',
    name: 'Luxury Vinyl Plank',
    category: 'Flooring',
    trade: 'Flooring',
    unit: 'SF',
    typicalWaste: 10,
    typicalCost: { min: 2, max: 8, avg: 4 },
    description: 'Luxury vinyl plank flooring',
    relatedMaterials: ['flooring-underlayment', 'flooring-transitions'],
  },
  'carpet': {
    id: 'carpet',
    name: 'Carpet',
    category: 'Flooring',
    trade: 'Flooring',
    unit: 'SY',
    typicalWaste: 10,
    typicalCost: { min: 15, max: 60, avg: 35 },
    description: 'Carpet with pad',
    relatedMaterials: ['carpet-pad', 'carpet-tack-strip'],
  },
  'tile-floor': {
    id: 'tile-floor',
    name: 'Floor Tile',
    category: 'Flooring',
    trade: 'Tile',
    unit: 'SF',
    typicalWaste: 15,
    typicalCost: { min: 3, max: 20, avg: 8 },
    relatedMaterials: ['thinset', 'grout', 'tile-spacers'],
  },

  // Electrical
  'outlet-standard': {
    id: 'outlet-standard',
    name: 'Standard Outlet',
    category: 'Electrical',
    trade: 'Electrical',
    unit: 'EA',
    typicalCost: { min: 75, max: 150, avg: 100 },
    description: 'Standard 15A duplex outlet, installed',
  },
  'outlet-gfci': {
    id: 'outlet-gfci',
    name: 'GFCI Outlet',
    category: 'Electrical',
    trade: 'Electrical',
    unit: 'EA',
    typicalCost: { min: 100, max: 200, avg: 150 },
    description: 'GFCI outlet for wet locations, installed',
  },
  'light-recessed': {
    id: 'light-recessed',
    name: 'Recessed Light',
    category: 'Electrical',
    trade: 'Electrical',
    unit: 'EA',
    typicalCost: { min: 100, max: 250, avg: 175 },
    description: 'LED recessed light fixture, installed',
  },
  'switch-single': {
    id: 'switch-single',
    name: 'Light Switch',
    category: 'Electrical',
    trade: 'Electrical',
    unit: 'EA',
    typicalCost: { min: 50, max: 100, avg: 75 },
    description: 'Single pole light switch, installed',
  },

  // Plumbing
  'toilet': {
    id: 'toilet',
    name: 'Toilet',
    category: 'Plumbing',
    trade: 'Plumbing',
    unit: 'EA',
    typicalCost: { min: 300, max: 800, avg: 500 },
    description: 'Standard toilet, installed',
  },
  'vanity-sink': {
    id: 'vanity-sink',
    name: 'Bathroom Vanity with Sink',
    category: 'Plumbing',
    trade: 'Plumbing',
    unit: 'EA',
    typicalCost: { min: 400, max: 1500, avg: 800 },
    description: 'Vanity with sink and faucet, installed',
  },

  // Trim
  'baseboard': {
    id: 'baseboard',
    name: 'Baseboard Trim',
    category: 'Trim',
    trade: 'Trim',
    unit: 'LF',
    typicalWaste: 10,
    typicalCost: { min: 3, max: 10, avg: 6 },
    description: 'Baseboard molding, installed and painted',
  },
  'door-interior': {
    id: 'door-interior',
    name: 'Interior Door',
    category: 'Doors',
    trade: 'Trim',
    unit: 'EA',
    typicalCost: { min: 200, max: 600, avg: 350 },
    description: 'Interior prehung door with hardware, installed',
  },
};

// ============================================================
// ASSEMBLY DEFINITIONS
// ============================================================

export interface AssemblyItem {
  materialId: string;
  quantityFormula: string;  // Formula referencing assembly variables like {wallSF}, {wallLF}
  description?: string;
}

export interface AssemblyDefinition {
  id: string;
  name: string;
  description: string;
  trade: string;
  projectTypes: string[];
  variables: {
    name: string;
    label: string;
    unit: string;
    description?: string;
    defaultFormula?: string;  // e.g., "{floorSF}" or "{roomCount} * 12"
  }[];
  items: AssemblyItem[];
  typicalLabor?: {
    task: string;
    ratePerUnit: number;
    unit: string;
  }[];
}

export const ASSEMBLIES: Record<string, AssemblyDefinition> = {
  'basement-framing': {
    id: 'basement-framing',
    name: 'Basement Wall Framing',
    description: 'Wood framing for basement walls, 2x4 studs 16" OC',
    trade: 'Framing',
    projectTypes: ['basement', 'basement_finish', 'addition'],
    variables: [
      { name: 'wallLF', label: 'Wall Linear Feet', unit: 'LF', description: 'Total linear feet of walls to frame' },
      { name: 'wallHeight', label: 'Wall Height', unit: 'FT', description: 'Height of walls (typically 8ft)' },
    ],
    items: [
      { materialId: 'stud-2x4-8', quantityFormula: '{wallLF} * 0.75', description: 'Studs at 16" OC' },
      { materialId: 'stud-2x4-8', quantityFormula: '{wallLF} / 8 * 2', description: 'Top and bottom plates' },
    ],
    typicalLabor: [
      { task: 'Frame walls', ratePerUnit: 2.50, unit: 'LF' },
    ],
  },

  'basement-drywall': {
    id: 'basement-drywall',
    name: 'Basement Drywall',
    description: 'Drywall for basement walls and ceiling',
    trade: 'Drywall',
    projectTypes: ['basement', 'basement_finish', 'addition'],
    variables: [
      { name: 'wallSF', label: 'Wall Square Feet', unit: 'SF', description: 'Total wall area' },
      { name: 'ceilingSF', label: 'Ceiling Square Feet', unit: 'SF', description: 'Total ceiling area' },
    ],
    items: [
      { materialId: 'drywall-4x8-1/2', quantityFormula: '({wallSF} + {ceilingSF}) / 32 * 1.1', description: 'Drywall sheets with 10% waste' },
      { materialId: 'drywall-mud', quantityFormula: '({wallSF} + {ceilingSF}) / 100', description: 'Joint compound' },
      { materialId: 'drywall-tape', quantityFormula: '({wallSF} + {ceilingSF}) / 500 + 1', description: 'Drywall tape' },
      { materialId: 'drywall-screws', quantityFormula: '({wallSF} + {ceilingSF}) / 500 + 1', description: 'Screws' },
    ],
    typicalLabor: [
      { task: 'Hang drywall', ratePerUnit: 0.75, unit: 'SF' },
      { task: 'Tape and finish', ratePerUnit: 0.85, unit: 'SF' },
    ],
  },

  'basement-insulation': {
    id: 'basement-insulation',
    name: 'Basement Wall Insulation',
    description: 'R-13 insulation for basement walls',
    trade: 'Insulation',
    projectTypes: ['basement', 'basement_finish'],
    variables: [
      { name: 'wallSF', label: 'Wall Square Feet', unit: 'SF' },
    ],
    items: [
      { materialId: 'insulation-r13-batt', quantityFormula: '{wallSF} * 1.05', description: 'R-13 batt insulation with 5% waste' },
    ],
    typicalLabor: [
      { task: 'Install batt insulation', ratePerUnit: 0.35, unit: 'SF' },
    ],
  },

  'basement-electrical': {
    id: 'basement-electrical',
    name: 'Basement Electrical Rough',
    description: 'Basic electrical for finished basement',
    trade: 'Electrical',
    projectTypes: ['basement', 'basement_finish'],
    variables: [
      { name: 'floorSF', label: 'Floor Square Feet', unit: 'SF' },
      { name: 'roomCount', label: 'Number of Rooms', unit: 'EA' },
    ],
    items: [
      { materialId: 'outlet-standard', quantityFormula: '{floorSF} / 80', description: 'Outlets per code (1 per 12ft of wall)' },
      { materialId: 'outlet-gfci', quantityFormula: '2', description: 'GFCI outlets (bathroom, wet bar)' },
      { materialId: 'light-recessed', quantityFormula: '{floorSF} / 50', description: 'Recessed lights' },
      { materialId: 'switch-single', quantityFormula: '{roomCount} + 2', description: 'Light switches' },
    ],
  },

  'basement-flooring-lvp': {
    id: 'basement-flooring-lvp',
    name: 'Basement LVP Flooring',
    description: 'Luxury vinyl plank flooring for basement',
    trade: 'Flooring',
    projectTypes: ['basement', 'basement_finish'],
    variables: [
      { name: 'floorSF', label: 'Floor Square Feet', unit: 'SF' },
    ],
    items: [
      { materialId: 'lvp-flooring', quantityFormula: '{floorSF} * 1.10', description: 'LVP with 10% waste' },
    ],
    typicalLabor: [
      { task: 'Install LVP', ratePerUnit: 1.50, unit: 'SF' },
    ],
  },

  'basement-trim': {
    id: 'basement-trim',
    name: 'Basement Trim Package',
    description: 'Baseboard and doors for finished basement',
    trade: 'Trim',
    projectTypes: ['basement', 'basement_finish'],
    variables: [
      { name: 'perimeterLF', label: 'Room Perimeter', unit: 'LF' },
      { name: 'doorCount', label: 'Number of Doors', unit: 'EA' },
    ],
    items: [
      { materialId: 'baseboard', quantityFormula: '{perimeterLF} * 1.10', description: 'Baseboard with waste' },
      { materialId: 'door-interior', quantityFormula: '{doorCount}', description: 'Interior doors' },
    ],
    typicalLabor: [
      { task: 'Install trim', ratePerUnit: 2.00, unit: 'LF' },
      { task: 'Install doors', ratePerUnit: 75, unit: 'EA' },
    ],
  },

  'bathroom-plumbing': {
    id: 'bathroom-plumbing',
    name: 'Bathroom Plumbing Rough & Fixtures',
    description: 'Plumbing for a basic bathroom',
    trade: 'Plumbing',
    projectTypes: ['basement', 'basement_finish', 'addition', 'bathroom'],
    variables: [
      { name: 'fullBath', label: 'Full Bath Count', unit: 'EA' },
      { name: 'halfBath', label: 'Half Bath Count', unit: 'EA' },
    ],
    items: [
      { materialId: 'toilet', quantityFormula: '{fullBath} + {halfBath}', description: 'Toilets' },
      { materialId: 'vanity-sink', quantityFormula: '{fullBath} + {halfBath}', description: 'Vanities' },
    ],
  },
};

// ============================================================
// PROJECT TYPE DEFINITIONS
// ============================================================

export interface ProjectTypeDefinition {
  id: string;
  name: string;
  description: string;
  defaultAssemblies: string[];
  typicalVariables: { name: string; prompt: string; defaultValue?: number }[];
  scopeQuestions: string[];
}

export const PROJECT_TYPES: Record<string, ProjectTypeDefinition> = {
  basement_finish: {
    id: 'basement_finish',
    name: 'Basement Finish',
    description: 'Finish an unfinished basement into living space',
    defaultAssemblies: [
      'basement-framing',
      'basement-insulation',
      'basement-electrical',
      'basement-drywall',
      'basement-flooring-lvp',
      'basement-trim',
    ],
    typicalVariables: [
      { name: 'floorSF', prompt: 'What is the total floor area in square feet?', defaultValue: 1000 },
      { name: 'wallLF', prompt: 'What is the total linear feet of walls?', defaultValue: 150 },
      { name: 'wallHeight', prompt: 'What is the ceiling height in feet?', defaultValue: 8 },
      { name: 'roomCount', prompt: 'How many rooms (including bathroom)?', defaultValue: 3 },
      { name: 'doorCount', prompt: 'How many interior doors?', defaultValue: 4 },
    ],
    scopeQuestions: [
      'Will there be a bathroom?',
      'What type of flooring? (LVP, carpet, tile)',
      'Are you adding a wet bar or kitchenette?',
      'What ceiling type? (drywall, drop ceiling)',
      'Is there existing rough plumbing for bathroom?',
    ],
  },
  deck: {
    id: 'deck',
    name: 'Deck Build',
    description: 'Build a new deck',
    defaultAssemblies: [],
    typicalVariables: [
      { name: 'deckSF', prompt: 'What is the deck area in square feet?' },
      { name: 'deckHeight', prompt: 'What is the deck height from ground?' },
    ],
    scopeQuestions: [
      'What material? (pressure treated, composite, cedar)',
      'Does it need stairs?',
      'Will there be a railing?',
      'Is a permit required?',
    ],
  },
  addition: {
    id: 'addition',
    name: 'Room Addition',
    description: 'Add a new room to an existing structure',
    defaultAssemblies: [],
    typicalVariables: [
      { name: 'floorSF', prompt: 'What is the addition size in square feet?' },
    ],
    scopeQuestions: [
      'Single story or two story?',
      'What is the foundation type?',
      'What rooms are included?',
      'Will HVAC be extended?',
    ],
  },
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen Remodel',
    description: 'Remodel an existing kitchen',
    defaultAssemblies: [],
    typicalVariables: [
      { name: 'kitchenSF', prompt: 'Kitchen size in square feet?' },
      { name: 'cabinetLF', prompt: 'Linear feet of cabinets?' },
    ],
    scopeQuestions: [
      'Full gut or cosmetic update?',
      'New cabinets or reface?',
      'New appliances?',
      'Changing the layout?',
    ],
  },
  bathroom: {
    id: 'bathroom',
    name: 'Bathroom Remodel',
    description: 'Remodel an existing bathroom',
    defaultAssemblies: ['bathroom-plumbing'],
    typicalVariables: [
      { name: 'bathSF', prompt: 'Bathroom size in square feet?' },
    ],
    scopeQuestions: [
      'Full bath or half bath?',
      'Moving any fixtures?',
      'Shower, tub, or both?',
      'New tile?',
    ],
  },
};

// ============================================================
// CALCULATION HELPERS
// ============================================================

export function calculateMaterialQuantity(
  formula: string,
  variables: Record<string, number>
): number {
  let expression = formula;
  
  for (const [key, value] of Object.entries(variables)) {
    expression = expression.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  
  try {
    // Safe eval using Function constructor
    const result = new Function(`return ${expression}`)();
    return Math.ceil(result);
  } catch (e) {
    console.error('Formula evaluation error:', e, formula, variables);
    return 0;
  }
}

export function getMaterialsForProjectType(projectType: string): MaterialDefinition[] {
  const pt = PROJECT_TYPES[projectType];
  if (!pt) return [];
  
  const materials = new Set<string>();
  
  for (const assemblyId of pt.defaultAssemblies) {
    const assembly = ASSEMBLIES[assemblyId];
    if (assembly) {
      for (const item of assembly.items) {
        materials.add(item.materialId);
      }
    }
  }
  
  return Array.from(materials)
    .map(id => MATERIALS[id])
    .filter(Boolean);
}

export function generateTakeoffFromAssembly(
  assemblyId: string,
  variables: Record<string, number>
): { description: string; quantity: number; unit: string; category: string; unitCost?: number }[] {
  const assembly = ASSEMBLIES[assemblyId];
  if (!assembly) return [];
  
  return assembly.items.map(item => {
    const material = MATERIALS[item.materialId];
    if (!material) return null;
    
    const quantity = calculateMaterialQuantity(item.quantityFormula, variables);
    
    return {
      description: material.name,
      quantity,
      unit: material.unit,
      category: material.category,
      unitCost: material.typicalCost?.avg,
    };
  }).filter(Boolean) as { description: string; quantity: number; unit: string; category: string; unitCost?: number }[];
}

export function suggestQuantitiesForScope(
  projectType: string,
  scopeVariables: Record<string, number>
): { assemblyId: string; items: ReturnType<typeof generateTakeoffFromAssembly> }[] {
  const pt = PROJECT_TYPES[projectType];
  if (!pt) return [];
  
  return pt.defaultAssemblies.map(assemblyId => ({
    assemblyId,
    items: generateTakeoffFromAssembly(assemblyId, scopeVariables),
  }));
}

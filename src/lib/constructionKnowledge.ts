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
    name: 'Drywall Screws 1-1/4"',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'BOX',
    coverageRate: 500,
    coverageUnit: 'SF',
    typicalWaste: 5,
    typicalCost: { min: 25, max: 45, avg: 35 },
    description: '1 lb box of 1-1/4" fine thread drywall screws (wood studs)',
  },
  'drywall-screws-coarse': {
    id: 'drywall-screws-coarse',
    name: 'Drywall Screws 1-5/8"',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'BOX',
    coverageRate: 500,
    coverageUnit: 'SF',
    typicalWaste: 5,
    typicalCost: { min: 28, max: 48, avg: 38 },
    description: '1 lb box of 1-5/8" coarse thread drywall screws (for 5/8" board)',
  },
  'corner-bead-metal': {
    id: 'corner-bead-metal',
    name: 'Metal Corner Bead 8ft',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'EA',
    coverageRate: 8,
    coverageUnit: 'LF',
    typicalWaste: 5,
    typicalCost: { min: 2, max: 5, avg: 3.50 },
    description: 'Standard metal corner bead for outside corners',
  },
  'corner-bead-paper': {
    id: 'corner-bead-paper',
    name: 'Paper-Faced Corner Bead 100ft Roll',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'ROLL',
    coverageRate: 100,
    coverageUnit: 'LF',
    typicalWaste: 10,
    typicalCost: { min: 25, max: 40, avg: 32 },
    description: 'Flex corner bead for curved or bullnose corners',
  },
  'drywall-mud-setting': {
    id: 'drywall-mud-setting',
    name: 'Setting Compound 18lb',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'BAG',
    coverageRate: 200,
    coverageUnit: 'SF',
    typicalWaste: 10,
    typicalCost: { min: 18, max: 30, avg: 24 },
    description: 'Hot mud setting compound for first coat and repairs',
  },
  'drywall-mud-topping': {
    id: 'drywall-mud-topping',
    name: 'Topping Compound 4.5gal',
    category: 'Drywall',
    trade: 'Drywall',
    unit: 'GAL',
    coverageRate: 150,
    coverageUnit: 'SF',
    typicalWaste: 15,
    typicalCost: { min: 20, max: 35, avg: 26 },
    description: 'Lightweight topping compound for final skim coats',
  },

  // Framing - Professional Grade
  'stud-2x4-8': {
    id: 'stud-2x4-8',
    name: '2x4x8 SPF Stud',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 1.33,  // One stud per 16" OC = ~1.33 LF of wall
    coverageUnit: 'LF',
    typicalWaste: 8,
    typicalCost: { min: 3, max: 8, avg: 5 },
    description: 'Dimensional lumber 2x4, 8 foot length, SPF grade',
    relatedMaterials: ['stud-2x4-10', 'top-plate', 'bottom-plate', 'framing-nails'],
  },
  'stud-2x4-10': {
    id: 'stud-2x4-10',
    name: '2x4x10 SPF',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 1.33,
    coverageUnit: 'LF',
    typicalWaste: 8,
    typicalCost: { min: 4, max: 10, avg: 7 },
    description: 'For 9ft+ ceilings or double plates',
  },
  'stud-2x6-8': {
    id: 'stud-2x6-8',
    name: '2x6x8 SPF Stud',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 1.33,
    coverageUnit: 'LF',
    typicalWaste: 8,
    typicalCost: { min: 5, max: 12, avg: 8 },
    description: 'Dimensional lumber 2x6, 8 foot length for exterior walls (R-19 cavity)',
  },
  'pt-bottom-plate': {
    id: 'pt-bottom-plate',
    name: 'Pressure Treated 2x4x8 Bottom Plate',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 8,
    coverageUnit: 'LF',
    typicalWaste: 10,
    typicalCost: { min: 6, max: 12, avg: 9 },
    description: 'Required by code for bottom plates on concrete (IRC R317.1)',
  },
  'framing-nails-16d': {
    id: 'framing-nails-16d',
    name: '16d Sinker Framing Nails 5lb',
    category: 'Framing',
    trade: 'Framing',
    unit: 'BOX',
    coverageRate: 100,
    coverageUnit: 'LF',
    typicalWaste: 5,
    typicalCost: { min: 18, max: 30, avg: 24 },
    description: 'Standard 16d x 3-1/4" vinyl-coated sinker nails for framing',
  },
  'concrete-anchors': {
    id: 'concrete-anchors',
    name: 'Concrete Wedge Anchors 1/2"x4-1/4"',
    category: 'Framing',
    trade: 'Framing',
    unit: 'BOX',
    coverageRate: 48,
    coverageUnit: 'LF',
    typicalWaste: 5,
    typicalCost: { min: 35, max: 55, avg: 45 },
    description: 'Box of 25 wedge anchors for securing sill plate to concrete (per IRC R403.1.6)',
  },
  'construction-adhesive': {
    id: 'construction-adhesive',
    name: 'Subfloor/Construction Adhesive 28oz',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 50,
    coverageUnit: 'LF',
    typicalWaste: 10,
    typicalCost: { min: 5, max: 10, avg: 7 },
    description: 'Polyurethane construction adhesive for framing connections',
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

  // ============================================================
  // DECK MATERIALS (with connector logic)
  // ============================================================
  'pt-2x8-12': {
    id: 'pt-2x8-12',
    name: 'Pressure Treated 2x8x12 Joist',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 12,
    coverageUnit: 'LF',
    typicalWaste: 10,
    typicalCost: { min: 12, max: 22, avg: 16 },
    description: 'Ground contact PT lumber for deck joists',
  },
  'pt-2x10-12': {
    id: 'pt-2x10-12',
    name: 'Pressure Treated 2x10x12 Joist',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 12,
    coverageUnit: 'LF',
    typicalWaste: 10,
    typicalCost: { min: 18, max: 30, avg: 24 },
    description: 'Ground contact PT lumber for deck joists (long spans)',
  },
  'pt-4x4-8': {
    id: 'pt-4x4-8',
    name: 'Pressure Treated 4x4x8 Post',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    typicalWaste: 5,
    typicalCost: { min: 12, max: 25, avg: 18 },
    description: 'Ground contact PT post for deck support',
  },
  'pt-6x6-10': {
    id: 'pt-6x6-10',
    name: 'Pressure Treated 6x6x10 Post',
    category: 'Framing',
    trade: 'Framing',
    unit: 'EA',
    typicalWaste: 5,
    typicalCost: { min: 35, max: 60, avg: 45 },
    description: 'Ground contact PT post for deck support (notched beam connection)',
  },
  'pt-2x6-16-decking': {
    id: 'pt-2x6-16-decking',
    name: 'Pressure Treated 2x6x16 Deck Board',
    category: 'Decking',
    trade: 'Framing',
    unit: 'EA',
    coverageRate: 8,
    coverageUnit: 'SF',
    typicalWaste: 15,
    typicalCost: { min: 14, max: 24, avg: 18 },
    description: 'PT deck boards, 16ft length',
  },
  'joist-hanger-2x8': {
    id: 'joist-hanger-2x8',
    name: 'Joist Hanger LUS28 (2x8)',
    category: 'Connectors',
    trade: 'Framing',
    unit: 'EA',
    typicalWaste: 0,
    typicalCost: { min: 3.50, max: 6, avg: 4.50 },
    description: 'Simpson Strong-Tie LUS28 joist hanger for 2x8 (REQUIRED by IRC R502.6)',
    relatedMaterials: ['joist-hanger-nails'],
  },
  'joist-hanger-2x10': {
    id: 'joist-hanger-2x10',
    name: 'Joist Hanger LUS210 (2x10)',
    category: 'Connectors',
    trade: 'Framing',
    unit: 'EA',
    typicalWaste: 0,
    typicalCost: { min: 4, max: 7, avg: 5.50 },
    description: 'Simpson Strong-Tie LUS210 joist hanger for 2x10 (REQUIRED by IRC R502.6)',
    relatedMaterials: ['joist-hanger-nails'],
  },
  'joist-hanger-nails': {
    id: 'joist-hanger-nails',
    name: 'Joist Hanger Nails 1-1/2" (1lb)',
    category: 'Connectors',
    trade: 'Framing',
    unit: 'LB',
    coverageRate: 25,
    coverageUnit: 'EA',
    typicalWaste: 10,
    typicalCost: { min: 8, max: 15, avg: 11 },
    description: 'Hot-dipped galvanized hanger nails - required for hangers',
  },
  'ledger-bolt': {
    id: 'ledger-bolt',
    name: 'Ledger Lag Bolt 1/2"x6"',
    category: 'Connectors',
    trade: 'Framing',
    unit: 'EA',
    typicalWaste: 0,
    typicalCost: { min: 2, max: 4, avg: 3 },
    description: 'Lag bolt for ledger attachment per IRC R507.9.1.3',
  },
  'post-base': {
    id: 'post-base',
    name: 'Post Base (Adjustable)',
    category: 'Connectors',
    trade: 'Framing',
    unit: 'EA',
    typicalWaste: 0,
    typicalCost: { min: 12, max: 25, avg: 18 },
    description: 'Simpson ABA adjustable post base for deck posts',
  },
  'concrete-sonotube-12': {
    id: 'concrete-sonotube-12',
    name: 'Sonotube 12"x48" Footing Form',
    category: 'Concrete',
    trade: 'Concrete',
    unit: 'EA',
    typicalWaste: 0,
    typicalCost: { min: 15, max: 28, avg: 20 },
    description: 'Cardboard footing form for deck posts',
  },
  'concrete-60lb-bag': {
    id: 'concrete-60lb-bag',
    name: 'Concrete Mix 60lb Bag',
    category: 'Concrete',
    trade: 'Concrete',
    unit: 'BAG',
    typicalWaste: 5,
    typicalCost: { min: 4, max: 7, avg: 5.50 },
    description: '60lb bag - about 0.45 cu ft per bag',
  },
  'deck-screws-3in': {
    id: 'deck-screws-3in',
    name: 'Deck Screws 3" (5lb box)',
    category: 'Fasteners',
    trade: 'Framing',
    unit: 'BOX',
    coverageRate: 100,
    coverageUnit: 'SF',
    typicalWaste: 10,
    typicalCost: { min: 35, max: 60, avg: 45 },
    description: 'Exterior-rated deck screws for decking installation',
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
    name: 'Basement Wall Framing (Code-Compliant)',
    description: 'Wood framing for basement walls, 2x4 studs 16" OC per IRC R602.3',
    trade: 'Framing',
    projectTypes: ['basement', 'basement_finish', 'addition'],
    variables: [
      { name: 'wallLF', label: 'Wall Linear Feet', unit: 'LF', description: 'Total linear feet of walls to frame' },
      { name: 'wallHeight', label: 'Wall Height', unit: 'FT', description: 'Height of walls (typically 8ft)' },
      { name: 'cornerCount', label: 'Number of Corners', unit: 'EA', description: 'Inside and outside corners' },
      { name: 'doorOpenings', label: 'Number of Door Openings', unit: 'EA' },
    ],
    items: [
      { materialId: 'stud-2x4-8', quantityFormula: '{wallLF} * 0.75 + {cornerCount} * 3 + {doorOpenings} * 4', description: 'Studs at 16" OC + corners + king/jack studs for openings' },
      { materialId: 'pt-bottom-plate', quantityFormula: '{wallLF} / 8', description: 'PT bottom plate on concrete (required IRC R317.1)' },
      { materialId: 'stud-2x4-8', quantityFormula: '{wallLF} / 8 * 2', description: 'Top double plate (IRC R602.3.2)' },
      { materialId: 'framing-nails-16d', quantityFormula: '{wallLF} / 100 + 1', description: '16d nails for framing connections' },
      { materialId: 'concrete-anchors', quantityFormula: '{wallLF} / 48 + 1', description: 'Concrete anchors every 4ft (IRC R403.1.6)' },
      { materialId: 'construction-adhesive', quantityFormula: '{wallLF} / 50 + 1', description: 'Adhesive for sill plate' },
    ],
    typicalLabor: [
      { task: 'Frame walls', ratePerUnit: 2.50, unit: 'LF' },
      { task: 'Set anchors', ratePerUnit: 0.50, unit: 'LF' },
    ],
  },

  'basement-drywall': {
    id: 'basement-drywall',
    name: 'Basement Drywall (Level 4 Finish)',
    description: 'Drywall for basement walls and ceiling with professional Level 4 finish',
    trade: 'Drywall',
    projectTypes: ['basement', 'basement_finish', 'addition'],
    variables: [
      { name: 'wallSF', label: 'Wall Square Feet', unit: 'SF', description: 'Total wall area' },
      { name: 'ceilingSF', label: 'Ceiling Square Feet', unit: 'SF', description: 'Total ceiling area' },
      { name: 'outsideCornerLF', label: 'Outside Corner LF', unit: 'LF', description: 'Linear feet of outside corners' },
    ],
    items: [
      { materialId: 'drywall-4x8-1/2', quantityFormula: '({wallSF} + {ceilingSF}) / 32 * 1.1', description: '1/2" drywall sheets with 10% waste' },
      { materialId: 'drywall-screws', quantityFormula: '({wallSF} + {ceilingSF}) / 500 + 1', description: '1-1/4" fine thread screws (1 screw per 12" on edges, 16" in field)' },
      { materialId: 'drywall-tape', quantityFormula: '({wallSF} + {ceilingSF}) / 400 + 1', description: 'Paper tape for all joints' },
      { materialId: 'corner-bead-metal', quantityFormula: '{outsideCornerLF} / 8 + 2', description: 'Metal corner bead for outside corners' },
      { materialId: 'drywall-mud-setting', quantityFormula: '({wallSF} + {ceilingSF}) / 400 + 1', description: 'Setting compound for first coat and embedding tape' },
      { materialId: 'drywall-mud-topping', quantityFormula: '({wallSF} + {ceilingSF}) / 100', description: 'Topping compound for 2nd & 3rd coats (Level 4)' },
    ],
    typicalLabor: [
      { task: 'Hang drywall', ratePerUnit: 0.75, unit: 'SF' },
      { task: 'Tape and first coat', ratePerUnit: 0.45, unit: 'SF' },
      { task: 'Second coat', ratePerUnit: 0.35, unit: 'SF' },
      { task: 'Final coat and sand', ratePerUnit: 0.40, unit: 'SF' },
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

  // ============================================================
  // DECK ASSEMBLIES (with mandatory connector logic)
  // ============================================================
  'deck-framing': {
    id: 'deck-framing',
    name: 'Deck Framing (Code-Compliant)',
    description: 'Complete deck framing including footings, posts, beams, joists, and ALL required connectors per IRC R507',
    trade: 'Framing',
    projectTypes: ['deck'],
    variables: [
      { name: 'deckSF', label: 'Deck Square Feet', unit: 'SF', description: 'Total deck area' },
      { name: 'deckLength', label: 'Deck Length', unit: 'FT', description: 'Length parallel to house' },
      { name: 'deckWidth', label: 'Deck Width', unit: 'FT', description: 'Depth from house' },
      { name: 'deckHeight', label: 'Deck Height', unit: 'FT', description: 'Height from ground to top of decking' },
      { name: 'attachedToHouse', label: 'Attached to House', unit: 'EA', description: '1 if ledger-attached, 0 if freestanding' },
    ],
    items: [
      // Footings (1 per 8ft of beam, plus corners)
      { materialId: 'concrete-sonotube-12', quantityFormula: 'Math.ceil({deckLength} / 8) + 2', description: 'Footing forms per code span tables' },
      { materialId: 'concrete-60lb-bag', quantityFormula: '(Math.ceil({deckLength} / 8) + 2) * 4', description: '4 bags per 12" footing @ 42" deep' },
      // Posts
      { materialId: 'pt-6x6-10', quantityFormula: 'Math.ceil({deckLength} / 8) + 2', description: 'Posts for beam support' },
      { materialId: 'post-base', quantityFormula: 'Math.ceil({deckLength} / 8) + 2', description: 'Post bases (REQUIRED connector - IRC R507.8)' },
      // Beams (double 2x10 for typical spans)
      { materialId: 'pt-2x10-12', quantityFormula: 'Math.ceil({deckLength} / 12) * 4', description: 'Doubled beam (2 per span)' },
      // Joists at 16" OC
      { materialId: 'pt-2x8-12', quantityFormula: 'Math.ceil({deckLength} / 1.33) + 2', description: 'Joists at 16" OC for PT decking' },
      // MANDATORY CONNECTORS (the "Connector Logic")
      { materialId: 'joist-hanger-2x8', quantityFormula: '(Math.ceil({deckLength} / 1.33) + 2) * 2', description: 'Joist hangers - 2 per joist (MANDATORY per IRC R502.6)' },
      { materialId: 'joist-hanger-nails', quantityFormula: 'Math.ceil((Math.ceil({deckLength} / 1.33) + 2) * 2 / 25) + 1', description: 'Hanger nails (1lb per 25 hangers)' },
      { materialId: 'ledger-bolt', quantityFormula: '{attachedToHouse} * Math.ceil({deckLength} / 1.5)', description: 'Ledger bolts if attached (per IRC R507.9.1.3)' },
      // Rim/band board
      { materialId: 'pt-2x8-12', quantityFormula: 'Math.ceil(({deckLength} + {deckWidth} * 2) / 12) + 1', description: 'Rim board perimeter' },
      // Hardware
      { materialId: 'deck-screws-3in', quantityFormula: 'Math.ceil({deckSF} / 100) + 1', description: 'Deck screws for framing connections' },
    ],
    typicalLabor: [
      { task: 'Dig and pour footings', ratePerUnit: 75, unit: 'EA' },
      { task: 'Set posts and beams', ratePerUnit: 50, unit: 'EA' },
      { task: 'Frame joists', ratePerUnit: 3.50, unit: 'SF' },
    ],
  },

  'deck-surface-pt': {
    id: 'deck-surface-pt',
    name: 'Deck Surface (Pressure Treated)',
    description: 'Pressure treated decking boards installed',
    trade: 'Framing',
    projectTypes: ['deck'],
    variables: [
      { name: 'deckSF', label: 'Deck Square Feet', unit: 'SF' },
    ],
    items: [
      { materialId: 'pt-2x6-16-decking', quantityFormula: 'Math.ceil({deckSF} / 8) * 1.15', description: 'PT deck boards with 15% waste for angles/cuts' },
      { materialId: 'deck-screws-3in', quantityFormula: 'Math.ceil({deckSF} / 100) + 1', description: 'Deck screws' },
    ],
    typicalLabor: [
      { task: 'Install decking', ratePerUnit: 2.50, unit: 'SF' },
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
    description: 'Build a new deck with code-compliant framing and connectors',
    defaultAssemblies: [
      'deck-framing',
      'deck-surface-pt',
    ],
    typicalVariables: [
      { name: 'deckSF', prompt: 'What is the deck area in square feet?', defaultValue: 200 },
      { name: 'deckLength', prompt: 'What is the deck length (parallel to house) in feet?', defaultValue: 16 },
      { name: 'deckWidth', prompt: 'What is the deck depth (from house) in feet?', defaultValue: 12 },
      { name: 'deckHeight', prompt: 'What is the deck height from ground in feet?', defaultValue: 3 },
      { name: 'attachedToHouse', prompt: 'Is the deck attached to the house? (1=Yes, 0=No)', defaultValue: 1 },
    ],
    scopeQuestions: [
      'What material? (pressure treated, composite, cedar)',
      'Does it need stairs?',
      'Will there be a railing?',
      'Is a permit required?',
      'What is the frost depth in your area? (affects footing depth)',
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

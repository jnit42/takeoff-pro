// GC Wizard question sets by project type

export interface WizardQuestion {
  id: string;
  question: string;
  options: { value: string; label: string }[];
  trade?: string;
  generateRfi?: boolean; // If answer is 'unknown', create RFI
  generateAssumption?: (answer: string) => string | null; // Generate assumption based on answer
}

export const PROJECT_TYPES = [
  { value: 'deck', label: 'Deck Build', icon: '🪵' },
  { value: 'basement_remodel', label: 'Basement Remodel', icon: '🏠' },
  { value: 'addition', label: 'Room Addition', icon: '🏗️' },
  { value: 'new_build', label: 'New Home Build', icon: '🏡' },
  { value: 'restaurant_remodel', label: 'Restaurant Remodel', icon: '🍽️' },
  { value: 'kitchen_remodel', label: 'Kitchen Remodel', icon: '🍳' },
  { value: 'bathroom_remodel', label: 'Bathroom Remodel', icon: '🚿' },
] as const;

export const WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    id: 'mep_responsibility',
    question: 'Who is responsible for MEP (Mechanical, Electrical, Plumbing)?',
    options: [
      { value: 'gc', label: 'GC manages all MEP subs' },
      { value: 'owner_direct', label: 'Owner contracts MEP directly' },
      { value: 'sub_self_perform', label: 'Subs self-perform' },
      { value: 'unknown', label: 'Unknown / Need to clarify' },
    ],
    trade: 'General',
    generateRfi: true,
  },
  {
    id: 'demo_level',
    question: 'What level of demolition is required?',
    options: [
      { value: 'none', label: 'None - new construction only' },
      { value: 'light', label: 'Light - surface removal, fixtures' },
      { value: 'heavy', label: 'Heavy - structural, walls, floors' },
      { value: 'unknown', label: 'Unknown / Need site visit' },
    ],
    trade: 'Demo',
    generateRfi: true,
    generateAssumption: (answer) => {
      if (answer === 'light') return 'Light demo only: surface materials, fixtures. No structural.';
      if (answer === 'heavy') return 'Heavy demo required. Dumpster and debris haul included.';
      return null;
    },
  },
  {
    id: 'dumpster_haul',
    question: 'Is dumpster / debris haul included in scope?',
    options: [
      { value: 'yes', label: 'Yes - GC provides dumpster' },
      { value: 'owner', label: 'Owner provides dumpster' },
      { value: 'no', label: 'No dumpster needed' },
      { value: 'unknown', label: 'Unknown' },
    ],
    trade: 'Demo',
    generateRfi: true,
  },
  {
    id: 'ceiling_height',
    question: 'What are the ceiling heights?',
    options: [
      { value: '8', label: 'Standard 8 ft' },
      { value: '9', label: '9 ft' },
      { value: '10', label: '10 ft' },
      { value: '12+', label: '12 ft or higher' },
      { value: 'varies', label: 'Varies / Multiple heights' },
    ],
    trade: 'General',
    generateAssumption: (answer) => {
      if (answer === '8') return 'Standard 8 ft ceiling height assumed throughout.';
      if (answer === 'varies') return 'Multiple ceiling heights - see plans for specifics.';
      return null;
    },
  },
  {
    id: 'access_difficulty',
    question: 'What is the site access / mobilization difficulty?',
    options: [
      { value: 'easy', label: 'Easy - ground level, open access' },
      { value: 'normal', label: 'Normal - some stairs, standard access' },
      { value: 'difficult', label: 'Difficult - tight spaces, multiple floors, limited parking' },
    ],
    trade: 'General',
  },
  {
    id: 'drywall_finish',
    question: 'What drywall finish level is required?',
    options: [
      { value: 'l4', label: 'Level 4 - Standard for paint' },
      { value: 'l5', label: 'Level 5 - Premium smooth finish' },
      { value: 'plaster', label: 'Plaster skim / Venetian' },
      { value: 'patch', label: 'Patch-heavy remodel work' },
      { value: 'unknown', label: 'Unknown' },
    ],
    trade: 'Drywall',
    generateRfi: true,
    generateAssumption: (answer) => {
      if (answer === 'l4') return 'Level 4 drywall finish for painted surfaces.';
      if (answer === 'l5') return 'Level 5 premium finish required - additional skim coat.';
      return null;
    },
  },
  {
    id: 'moisture_risk',
    question: 'What is the moisture / waterproofing situation?',
    options: [
      { value: 'low', label: 'Low - dry conditions, no history of issues' },
      { value: 'medium', label: 'Medium - some moisture, standard vapor barrier' },
      { value: 'high', label: 'High - active moisture, requires waterproofing' },
      { value: 'unknown', label: 'Unknown - need inspection' },
    ],
    trade: 'General',
    generateRfi: true,
    generateAssumption: (answer) => {
      if (answer === 'low') return 'Standard vapor barrier at basement walls. No waterproofing.';
      if (answer === 'high') return 'Active waterproofing system required.';
      return null;
    },
  },
  {
    id: 'windows_doors',
    question: 'Windows and doors - new or existing?',
    options: [
      { value: 'all_new', label: 'All new windows and doors' },
      { value: 'existing', label: 'Existing - no changes' },
      { value: 'mixed', label: 'Mixed - some new, some existing' },
      { value: 'unknown', label: 'Unknown - need clarification' },
    ],
    trade: 'Windows/Doors',
    generateRfi: true,
  },
  {
    id: 'flooring_type',
    question: 'What flooring type(s) are specified?',
    options: [
      { value: 'lvp', label: 'LVP / Vinyl Plank' },
      { value: 'hardwood', label: 'Hardwood' },
      { value: 'tile', label: 'Tile (ceramic/porcelain)' },
      { value: 'carpet', label: 'Carpet' },
      { value: 'mixed', label: 'Mixed / Multiple types' },
      { value: 'unknown', label: 'Unknown / TBD' },
    ],
    trade: 'Flooring',
    generateRfi: true,
  },
  {
    id: 'trim_level',
    question: 'What is the trim / millwork level?',
    options: [
      { value: 'basic', label: 'Basic - builder grade, simple profiles' },
      { value: 'medium', label: 'Medium - upgraded trim, some detail' },
      { value: 'high', label: 'High - custom millwork, crown, wainscot' },
    ],
    trade: 'Trim',
    generateAssumption: (answer) => {
      if (answer === 'basic') return 'Builder grade trim package. 3-1/4" base, 2-1/4" casing.';
      if (answer === 'high') return 'Custom millwork package with crown, wainscot details.';
      return null;
    },
  },
  {
    id: 'soffits_bulkheads',
    question: 'Are there soffits / bulkheads in scope?',
    options: [
      { value: 'none', label: 'None' },
      { value: 'some', label: 'Yes - some areas' },
      { value: 'extensive', label: 'Extensive throughout' },
      { value: 'unknown', label: 'Unknown - need to verify on plans' },
    ],
    trade: 'Framing',
    generateRfi: true,
  },
  {
    id: 'structural_work',
    question: 'Is there structural work (LVL, beams, posts)?',
    options: [
      { value: 'none', label: 'None' },
      { value: 'minor', label: 'Minor - lolly column, small beam' },
      { value: 'major', label: 'Major - large beams, load-bearing changes' },
      { value: 'unknown', label: 'Unknown - need engineer' },
    ],
    trade: 'Framing',
    generateRfi: true,
  },
  {
    id: 'exterior_scope',
    question: 'Any exterior work (siding, roof tie-in)?',
    options: [
      { value: 'none', label: 'None - interior only' },
      { value: 'minor', label: 'Minor - flashing, small repairs' },
      { value: 'major', label: 'Major - new siding, roof work' },
      { value: 'unknown', label: 'Unknown' },
    ],
    trade: 'Siding',
    generateRfi: true,
  },
  {
    id: 'schedule',
    question: 'What is the schedule expectation?',
    options: [
      { value: 'normal', label: 'Normal - standard timeline' },
      { value: 'tight', label: 'Tight - compressed schedule' },
      { value: 'rush', label: 'Rush - overtime/weekends required' },
    ],
    trade: 'General',
    generateAssumption: (answer) => {
      if (answer === 'rush') return 'Rush schedule - overtime labor rates may apply.';
      return null;
    },
  },
  {
    id: 'occupied_space',
    question: 'Is this an occupied space requiring protection?',
    options: [
      { value: 'no', label: 'No - unoccupied' },
      { value: 'partial', label: 'Partially occupied' },
      { value: 'yes', label: 'Yes - fully occupied, protection required' },
    ],
    trade: 'General',
    generateAssumption: (answer) => {
      if (answer === 'yes') return 'Occupied space - floor/furniture protection and dust barriers included.';
      return null;
    },
  },
  {
    id: 'permit',
    question: 'Is a building permit required?',
    options: [
      { value: 'yes', label: 'Yes - permit included in scope' },
      { value: 'owner', label: 'Owner handles permit' },
      { value: 'unknown', label: 'Unknown - need to verify with building dept' },
    ],
    trade: 'General',
    generateRfi: true,
    generateAssumption: (answer) => {
      if (answer === 'yes') return 'Building permit by GC. Inspection coordination included.';
      if (answer === 'owner') return 'Owner responsible for building permit.';
      return null;
    },
  },
];

// Get questions relevant to a project type
export function getQuestionsForProjectType(projectType: string): WizardQuestion[] {
  // For now, return all questions. Could filter by project type later.
  return WIZARD_QUESTIONS;
}

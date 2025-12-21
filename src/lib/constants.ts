// Unit types
export const UNITS = ['EA', 'LF', 'SF', 'SY', 'CY', 'CF', 'BF', 'GAL', 'LBS', 'TON', 'HR'] as const;
export type Unit = typeof UNITS[number];

// Trade categories
export const TRADES = [
  'Demo',
  'Excavation',
  'Concrete',
  'Framing',
  'Roofing',
  'Siding',
  'Windows/Doors',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Insulation',
  'Drywall',
  'Trim',
  'Flooring',
  'Painting',
  'Cabinets',
  'Countertops',
  'Tile',
  'Misc',
] as const;
export type Trade = typeof TRADES[number];

// Takeoff categories
export const TAKEOFF_CATEGORIES = [
  'Demo',
  'Framing - Lumber',
  'Framing - Hardware',
  'Sheathing',
  'Roofing',
  'Siding',
  'Windows',
  'Doors - Interior',
  'Doors - Exterior',
  'Insulation',
  'Drywall',
  'Trim - Baseboard',
  'Trim - Casing',
  'Trim - Crown',
  'Flooring',
  'Paint',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Hardware',
  'Fasteners',
  'Misc',
] as const;

// Labor modifiers
export const LABOR_MODIFIERS = {
  accessDifficulty: {
    label: 'Access Difficulty',
    options: [
      { value: 1.0, label: 'Easy - Ground level, open access' },
      { value: 1.15, label: 'Moderate - Some obstacles, stairs' },
      { value: 1.3, label: 'Difficult - Tight spaces, ladders' },
      { value: 1.5, label: 'Very Difficult - Crawl spaces, heights' },
    ],
  },
  ceilingHeight: {
    label: 'Ceiling Height',
    options: [
      { value: 1.0, label: 'Standard (8-9 ft)' },
      { value: 1.1, label: 'Tall (10-12 ft)' },
      { value: 1.25, label: 'Very Tall (12+ ft)' },
    ],
  },
  existingConditions: {
    label: 'Existing Conditions',
    options: [
      { value: 1.0, label: 'New construction' },
      { value: 1.1, label: 'Remodel - Good condition' },
      { value: 1.2, label: 'Remodel - Fair condition' },
      { value: 1.35, label: 'Remodel - Poor/Unknown' },
    ],
  },
  scheduleConstraints: {
    label: 'Schedule Constraints',
    options: [
      { value: 1.0, label: 'Normal schedule' },
      { value: 1.15, label: 'Tight schedule' },
      { value: 1.3, label: 'Rush/Overtime required' },
    ],
  },
  travel: {
    label: 'Travel Distance',
    options: [
      { value: 1.0, label: 'Local (< 30 min)' },
      { value: 1.05, label: 'Moderate (30-60 min)' },
      { value: 1.1, label: 'Far (60+ min)' },
    ],
  },
  smallJobFactor: {
    label: 'Job Size Factor',
    options: [
      { value: 1.0, label: 'Standard job size' },
      { value: 1.15, label: 'Small job (< $5k)' },
      { value: 1.25, label: 'Very small job (< $2k)' },
    ],
  },
} as const;

// Default project settings
export const DEFAULT_PROJECT_SETTINGS = {
  region: 'Rhode Island',
  taxPercent: 7.0,
  wastePercent: 10.0,
  markupPercent: 15.0,
  laborBurdenPercent: 35.0,
  currency: 'USD',
};

// Regions
export const REGIONS = [
  'Rhode Island',
  'Massachusetts',
  'Connecticut',
  'New Hampshire',
  'Vermont',
  'Maine',
] as const;

// Format currency
export const formatCurrency = (value: number | null | undefined, currency = 'USD'): string => {
  if (value == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Format number with commas
export const formatNumber = (value: number | null | undefined, decimals = 2): string => {
  if (value == null) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

// Format percentage
export const formatPercent = (value: number | null | undefined): string => {
  if (value == null) return '0%';
  return `${value.toFixed(1)}%`;
};

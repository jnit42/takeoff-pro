/**
 * MaterialListItem - Renders a single material item in a clean, readable card format
 */

import { cn } from '@/lib/utils';

interface MaterialItem {
  description: string;
  quantity: number;
  unit: string;
  category?: string;
}

interface MaterialListItemProps {
  item: MaterialItem;
  index: number;
}

// Category color mapping for visual distinction
const CATEGORY_COLORS: Record<string, string> = {
  'Framing': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Framing - Lumber': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Drywall': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Insulation': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'Electrical': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Plumbing': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'HVAC': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Flooring': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Painting': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'General': 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
};

export function MaterialListItem({ item, index }: MaterialListItemProps) {
  const categoryColor = CATEGORY_COLORS[item.category || 'General'] || CATEGORY_COLORS['General'];

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 bg-background/60 rounded-lg border border-border/40 hover:border-border/60 transition-colors">
      {/* Index number */}
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-medium text-muted-foreground bg-muted/50 rounded-full">
        {index + 1}
      </span>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">
          {item.description}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {/* Quantity badge */}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-primary/10 text-primary">
            {item.quantity} {item.unit}
          </span>
          {/* Category badge */}
          {item.category && (
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', categoryColor)}>
              {item.category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface MaterialListProps {
  items: MaterialItem[];
  className?: string;
}

export function MaterialList({ items, className }: MaterialListProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // Group items by category
  const groupedItems = items.reduce<Record<string, MaterialItem[]>>((acc, item) => {
    const category = item.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const categories = Object.keys(groupedItems).sort();

  return (
    <div className={cn('space-y-3', className)}>
      {categories.map((category) => (
        <div key={category} className="space-y-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {category} ({groupedItems[category].length})
          </h4>
          <div className="space-y-1.5">
            {groupedItems[category].map((item, idx) => (
              <MaterialListItem
                key={`${item.description}-${idx}`}
                item={item}
                index={items.indexOf(item)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * MaterialListItem - Renders a single material item in a clean, readable card format
 * Now with inline editing capability
 */

import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MaterialItem {
  description: string;
  quantity: number;
  unit: string;
  category?: string;
}

interface MaterialListItemProps {
  item: MaterialItem;
  index: number;
  onUpdate?: (index: number, updates: Partial<MaterialItem>) => void;
  onRemove?: (index: number) => void;
  editable?: boolean;
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

export function MaterialListItem({ item, index, onUpdate, onRemove, editable = false }: MaterialListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(String(item.quantity));
  const categoryColor = CATEGORY_COLORS[item.category || 'General'] || CATEGORY_COLORS['General'];

  const handleSave = () => {
    const qty = parseFloat(editQuantity);
    if (!isNaN(qty) && qty > 0 && onUpdate) {
      onUpdate(index, { quantity: qty });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditQuantity(String(item.quantity));
    setIsEditing(false);
  };

  return (
    <div className="flex items-start gap-2 py-2 px-2.5 bg-background/60 rounded-lg border border-border/40 hover:border-border/60 transition-colors group">
      {/* Index number */}
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-medium text-muted-foreground bg-muted/50 rounded-full mt-0.5">
        {index + 1}
      </span>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug break-words">
          {item.description}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {/* Quantity - editable or display */}
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="w-16 h-6 text-xs px-1.5"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <span className="text-xs text-muted-foreground">{item.unit}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleSave}>
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCancel}>
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-primary/10 text-primary">
              {item.quantity} {item.unit}
            </span>
          )}
          {/* Category badge */}
          {item.category && !isEditing && (
            <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium', categoryColor)}>
              {item.category}
            </span>
          )}
        </div>
      </div>

      {/* Edit/Remove buttons */}
      {editable && !isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface MaterialListProps {
  items: MaterialItem[];
  className?: string;
  onUpdate?: (index: number, updates: Partial<MaterialItem>) => void;
  onRemove?: (index: number) => void;
  editable?: boolean;
}

export function MaterialList({ items, className, onUpdate, onRemove, editable = false }: MaterialListProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // Group items by category
  const groupedItems = items.reduce<Record<string, { item: MaterialItem; originalIndex: number }[]>>((acc, item, idx) => {
    const category = item.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ item, originalIndex: idx });
    return acc;
  }, {});

  const categories = Object.keys(groupedItems).sort();

  return (
    <div className={cn('space-y-2.5', className)}>
      {categories.map((category) => (
        <div key={category} className="space-y-1">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {category} ({groupedItems[category].length})
          </h4>
          <div className="space-y-1">
            {groupedItems[category].map(({ item, originalIndex }) => (
              <MaterialListItem
                key={`${item.description}-${originalIndex}`}
                item={item}
                index={originalIndex}
                onUpdate={onUpdate}
                onRemove={onRemove}
                editable={editable}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

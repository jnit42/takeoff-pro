/**
 * Quick Edit Chips Component
 * Handoff-style tappable suggestions for refining estimates
 * e.g., "Change 2×4 Wall Studs to 48"
 */

import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickEditSuggestion {
  id: string;
  label: string;
  command: string;
}

interface QuickEditChipsProps {
  suggestions: QuickEditSuggestion[];
  onSelect: (command: string) => void;
  isProcessing?: boolean;
  className?: string;
}

export function QuickEditChips({ 
  suggestions, 
  onSelect, 
  isProcessing = false,
  className 
}: QuickEditChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm text-muted-foreground">
        Refine your estimate by <span className="font-medium text-foreground">tapping one of these edits:</span>
      </p>
      
      <div className="flex flex-col gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion.id}
            variant="outline"
            size="sm"
            className="justify-start h-auto py-2.5 px-3 text-left bg-muted/30 hover:bg-muted/50 border-border/50"
            onClick={() => onSelect(suggestion.command)}
            disabled={isProcessing}
          >
            <MessageSquare className="h-4 w-4 mr-2 text-primary shrink-0" />
            <span className="text-sm">{suggestion.label}</span>
          </Button>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground">
        You can also ask directly using the input below.
      </p>
    </div>
  );
}

// Helper to generate suggestions based on estimate items
export function generateQuickEditSuggestions(items: Array<{
  description: string;
  quantity: number;
  category: string;
  unit_cost: number | null;
}>): QuickEditSuggestion[] {
  const suggestions: QuickEditSuggestion[] = [];
  
  // Find items that might need adjustment
  const framingItems = items.filter(i => i.category.toLowerCase().includes('framing'));
  const drywallItems = items.filter(i => i.category.toLowerCase().includes('drywall'));
  const insulationItems = items.filter(i => i.category.toLowerCase().includes('insulation'));
  
  // Suggest quantity changes for common items
  if (framingItems.length > 0) {
    const studs = framingItems.find(i => i.description.toLowerCase().includes('stud'));
    if (studs) {
      const newQty = Math.round(studs.quantity * 1.1);
      suggestions.push({
        id: 'studs-qty',
        label: `Change ${studs.description} to ${newQty}`,
        command: `Change ${studs.description} quantity to ${newQty}`
      });
    }
  }
  
  // Suggest material upgrades
  if (insulationItems.length > 0) {
    const r13 = insulationItems.find(i => i.description.toLowerCase().includes('r-13') || i.description.toLowerCase().includes('r13'));
    if (r13) {
      suggestions.push({
        id: 'insulation-upgrade',
        label: 'Replace R-13 with R-15 insulation',
        command: 'Replace R-13 insulation with R-15 for better energy efficiency'
      });
    }
  }
  
  // Suggest labor rate adjustment
  if (drywallItems.length > 0) {
    suggestions.push({
      id: 'drywall-labor',
      label: 'Update Drywall Labor rate to $75',
      command: 'Update drywall labor rate to $75 per hour'
    });
  }
  
  // Add a generic "add contingency" suggestion
  if (items.length > 5) {
    suggestions.push({
      id: 'add-contingency',
      label: 'Add 10% contingency',
      command: 'Add a 10% contingency line item for unexpected costs'
    });
  }
  
  return suggestions.slice(0, 4); // Max 4 suggestions
}

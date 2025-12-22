/**
 * Trade Card Component
 * Handoff-style "receipt view" - clean, simple, tap-to-edit
 * Shows items like a shopping list, not a spreadsheet
 */

import { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/constants';

interface TakeoffItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  extended_cost: number | null;
  draft: boolean | null;
  vendor: string | null;
}

interface TradeCardProps {
  trade: string;
  items: TakeoffItem[];
  total: number;
  onUpdateItem: (id: string, field: string, value: string | number) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (category: string) => void;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function TradeCard({
  trade,
  items,
  total,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  isExpanded = false,
  onToggle
}: TradeCardProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const draftCount = items.filter(i => i.draft).length;
  const missingPriceCount = items.filter(i => !i.unit_cost || i.unit_cost === 0).length;

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId, editingField]);

  // Inline edit for quantity - tap the number to edit
  const handleTapToEdit = (item: TakeoffItem, field: 'quantity' | 'unit_cost') => {
    setEditingId(item.id);
    setEditingField(field);
  };

  const handleEditBlur = () => {
    setEditingId(null);
    setEditingField(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditBlur();
    }
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-all border-border/50',
      isExpanded && 'ring-1 ring-primary/20'
    )}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        {/* Trade Header - Bold, simple */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors active:bg-muted/50">
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="text-left">
                <h3 className="font-bold text-base uppercase tracking-wide">{trade}</h3>
                <p className="text-xs text-muted-foreground">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                  {draftCount > 0 && (
                    <span className="text-warning"> • {draftCount} pending</span>
                  )}
                  {missingPriceCount > 0 && (
                    <span className="text-warning/70"> • {missingPriceCount} unpriced</span>
                  )}
                </p>
              </div>
            </div>
            
            <span className="font-mono font-bold text-lg tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>
        </CollapsibleTrigger>
        
        {/* Items - Receipt style list */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-3">
            <div className="divide-y divide-border/30">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'py-3 px-1 transition-all',
                    item.draft && 'opacity-70'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Description */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium leading-tight',
                        item.draft && 'italic'
                      )}>
                        {item.description}
                        {item.draft && (
                          <Badge variant="outline" className="ml-2 text-[9px] py-0 px-1 text-warning border-warning/50">
                            DRAFT
                          </Badge>
                        )}
                      </p>
                      {item.vendor && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {item.vendor}
                        </p>
                      )}
                    </div>
                    
                    {/* Right: Qty • Total (tap to edit) */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Tappable Quantity */}
                      {editingId === item.id && editingField === 'quantity' ? (
                        <Input
                          ref={inputRef}
                          type="number"
                          value={item.quantity}
                          onChange={(e) => onUpdateItem(item.id, 'quantity', e.target.value)}
                          onBlur={handleEditBlur}
                          onKeyDown={handleEditKeyDown}
                          className="w-16 h-7 text-right font-mono text-sm p-1"
                        />
                      ) : (
                        <button
                          onClick={() => handleTapToEdit(item, 'quantity')}
                          className="text-sm font-mono text-muted-foreground hover:text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded transition-colors"
                        >
                          {item.quantity} {item.unit}
                        </button>
                      )}
                      
                      <span className="text-muted-foreground text-xs">•</span>
                      
                      {/* Total or Est. badge */}
                      {item.extended_cost && item.extended_cost > 0 ? (
                        <span className="font-mono font-semibold text-sm tabular-nums min-w-[60px] text-right">
                          {formatCurrency(item.extended_cost)}
                        </span>
                      ) : (
                        <Badge 
                          variant="outline" 
                          className="text-[10px] py-0 px-1.5 text-warning border-warning/40 font-mono"
                          onClick={() => handleTapToEdit(item, 'unit_cost')}
                        >
                          Est.
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Inline price edit if tapped on Est. */}
                  {editingId === item.id && editingField === 'unit_cost' && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">$/unit:</span>
                      <Input
                        ref={inputRef}
                        type="number"
                        step="0.01"
                        value={item.unit_cost || ''}
                        onChange={(e) => onUpdateItem(item.id, 'unit_cost', e.target.value)}
                        onBlur={handleEditBlur}
                        onKeyDown={handleEditKeyDown}
                        className="w-20 h-7 font-mono text-sm"
                        placeholder="0.00"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-primary"
                        onClick={handleEditBlur}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive ml-auto"
                        onClick={() => onDeleteItem(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Add Item - Subtle */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/50"
              onClick={() => onAddItem(trade)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add item
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

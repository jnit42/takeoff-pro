/**
 * Trade Card Component
 * Handoff-style "receipt view" - clean, simple, tap-to-edit
 * Shows "Qty × Price / Unit" format like Handoff
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

// Store logos using semantic tokens
const STORE_BADGES: Record<string, { bg: string; text: string }> = {
  "Lowe's": { bg: 'bg-info', text: 'Lowe\'s' },
  "Home Depot": { bg: 'bg-accent', text: 'HD' },
  "Menards": { bg: 'bg-success', text: 'Menards' },
};

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

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId, editingField]);

  // Inline edit - tap the number to edit
  const handleTapToEdit = (e: React.MouseEvent, item: TakeoffItem, field: 'quantity' | 'unit_cost') => {
    e.stopPropagation();
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

  // Get store badge if vendor matches known stores
  const getStoreBadge = (vendor: string | null) => {
    if (!vendor) return null;
    for (const [store, config] of Object.entries(STORE_BADGES)) {
      if (vendor.toLowerCase().includes(store.toLowerCase())) {
        return config;
      }
    }
    return null;
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-all bg-card/50 border-border/40',
      isExpanded && 'ring-1 ring-primary/30 bg-card'
    )}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        {/* Trade Header - Handoff style */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors active:bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="text-left">
                <h3 className="font-semibold text-base">{trade}</h3>
                <p className="text-xs text-muted-foreground">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base tabular-nums">
                {formatCurrency(total)}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        {/* Items - Handoff receipt style */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-0">
            <div className="divide-y divide-border/20">
              {items.map((item) => {
                const storeBadge = getStoreBadge(item.vendor);
                const hasPrice = item.unit_cost && item.unit_cost > 0;
                
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'py-3 px-4 transition-all',
                      item.draft && 'opacity-60 bg-warning/5'
                    )}
                  >
                    {/* Main row: Description + Total */}
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Description */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-medium leading-tight',
                          item.draft && 'italic'
                        )}>
                          {item.description}
                          {item.draft && (
                            <Badge variant="outline" className="ml-2 text-[9px] py-0 px-1 text-warning border-warning/50 align-middle">
                              DRAFT
                            </Badge>
                          )}
                        </p>
                        
                        {/* Qty × Price / Unit breakdown */}
                        <div className="flex items-center gap-2 mt-1">
                          {hasPrice ? (
                            <button
                              onClick={(e) => handleTapToEdit(e, item, 'quantity')}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span className="font-mono">{item.quantity}</span>
                              <span className="mx-1">×</span>
                              <span className="font-mono">{formatCurrency(item.unit_cost!)}</span>
                              <span className="mx-1">/</span>
                              <span>{item.unit}</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => handleTapToEdit(e, item, 'unit_cost')}
                              className="text-xs text-warning hover:text-warning/80 transition-colors"
                            >
                              <span className="font-mono">{item.quantity}</span>
                              <span className="mx-1">{item.unit}</span>
                              <span>• needs price</span>
                            </button>
                          )}
                          
                          {/* Store badge */}
                          {storeBadge && (
                            <span className={cn(
                              'text-[9px] font-bold px-1.5 py-0.5 rounded text-white',
                              storeBadge.bg
                            )}>
                              {storeBadge.text}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Right: Total */}
                      <div className="text-right shrink-0">
                        {item.extended_cost && item.extended_cost > 0 ? (
                          <span className="font-mono font-semibold tabular-nums">
                            {formatCurrency(item.extended_cost)}
                          </span>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className="text-[10px] py-0 px-1.5 text-warning border-warning/40 font-mono cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTapToEdit(e as unknown as React.MouseEvent, item, 'unit_cost');
                            }}
                          >
                            Est.
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Inline edit row */}
                    {editingId === item.id && (
                      <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-medium">Qty</label>
                            <Input
                              ref={editingField === 'quantity' ? inputRef : undefined}
                              type="number"
                              value={item.quantity}
                              onChange={(e) => onUpdateItem(item.id, 'quantity', e.target.value)}
                              onBlur={handleEditBlur}
                              onKeyDown={handleEditKeyDown}
                              className="h-9 font-mono mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-medium">Unit</label>
                            <Input
                              value={item.unit}
                              onChange={(e) => onUpdateItem(item.id, 'unit', e.target.value)}
                              className="h-9 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground font-medium">$/Unit</label>
                            <Input
                              ref={editingField === 'unit_cost' ? inputRef : undefined}
                              type="number"
                              step="0.01"
                              value={item.unit_cost || ''}
                              onChange={(e) => onUpdateItem(item.id, 'unit_cost', e.target.value)}
                              onBlur={handleEditBlur}
                              onKeyDown={handleEditKeyDown}
                              className="h-9 font-mono mt-1"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => onDeleteItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={handleEditBlur}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Done
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Add Item */}
            <div className="px-4 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/40 h-10"
                onClick={() => onAddItem(trade)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add item
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/**
 * Trade Card Component
 * Mobile-first card layout for takeoff items grouped by trade
 * Replaces table view on mobile devices
 */

import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus,
  Trash2,
  Check,
  AlertCircle
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
  
  const draftCount = items.filter(i => i.draft).length;
  const missingPriceCount = items.filter(i => !i.unit_cost || i.unit_cost === 0).length;

  return (
    <Card className={cn(
      'overflow-hidden transition-all',
      isExpanded && 'ring-2 ring-primary/20'
    )}>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="text-left">
                <h3 className="font-semibold text-base">{trade}</h3>
                <p className="text-xs text-muted-foreground">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                  {draftCount > 0 && ` • ${draftCount} draft`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {missingPriceCount > 0 && (
                <Badge variant="outline" className="text-warning border-warning/50 text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {missingPriceCount}
                </Badge>
              )}
              <span className="font-mono font-semibold text-base">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'p-3 rounded-lg border bg-background transition-all',
                  item.draft && 'border-warning/50 bg-warning/5',
                  editingId === item.id && 'ring-2 ring-primary/30'
                )}
                onClick={() => setEditingId(item.id)}
              >
                {editingId === item.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <Input
                      value={item.description}
                      onChange={(e) => onUpdateItem(item.id, 'description', e.target.value)}
                      className="font-medium"
                      placeholder="Item description"
                      autoFocus
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">Qty</label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => onUpdateItem(item.id, 'quantity', e.target.value)}
                          className="h-9 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">Unit</label>
                        <Input
                          value={item.unit}
                          onChange={(e) => onUpdateItem(item.id, 'unit', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">$/Unit</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_cost || ''}
                          onChange={(e) => onUpdateItem(item.id, 'unit_cost', e.target.value)}
                          className="h-9 font-mono"
                          placeholder="Est."
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteItem(item.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Done
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{item.description}</p>
                        {item.draft && (
                          <Badge variant="outline" className="text-[10px] text-warning border-warning/50">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.quantity} {item.unit}
                        {item.unit_cost ? ` × ${formatCurrency(item.unit_cost)}` : ''}
                      </p>
                    </div>
                    
                    <div className="text-right shrink-0 ml-2">
                      {item.extended_cost ? (
                        <span className="font-mono font-semibold text-sm">
                          {formatCurrency(item.extended_cost)}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-warning border-warning/50 text-xs">
                          Est.
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Add Item Button */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full border-dashed border mt-2"
              onClick={() => onAddItem(trade)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add {trade} Item
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

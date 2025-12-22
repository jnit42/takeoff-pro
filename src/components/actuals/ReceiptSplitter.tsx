/**
 * Receipt Splitter Component
 * Allows splitting a single receipt across multiple cost categories
 */

import { useState, useMemo } from 'react';
import { 
  Split, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle,
  DollarSign 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SplitAllocation {
  id: string;
  category: string;
  amount: number;
  description: string;
}

interface ReceiptSplitterProps {
  receiptTotal: number;
  vendorName?: string;
  onSplit: (allocations: Omit<SplitAllocation, 'id'>[]) => void;
  onCancel: () => void;
  className?: string;
}

const CATEGORIES = [
  { value: 'framing', label: 'Framing' },
  { value: 'drywall', label: 'Drywall' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'insulation', label: 'Insulation' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'painting', label: 'Painting' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'tools', label: 'Tools' },
  { value: 'lumber', label: 'Lumber' },
  { value: 'concrete', label: 'Concrete' },
  { value: 'other', label: 'Other' },
];

export function ReceiptSplitter({ 
  receiptTotal, 
  vendorName,
  onSplit, 
  onCancel,
  className 
}: ReceiptSplitterProps) {
  const { toast } = useToast();
  
  const [allocations, setAllocations] = useState<SplitAllocation[]>([
    { id: crypto.randomUUID(), category: '', amount: receiptTotal, description: '' }
  ]);

  const allocatedTotal = useMemo(() => 
    allocations.reduce((sum, a) => sum + (a.amount || 0), 0),
    [allocations]
  );

  const remaining = receiptTotal - allocatedTotal;
  const isBalanced = Math.abs(remaining) < 0.01;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const addAllocation = () => {
    setAllocations([
      ...allocations,
      { 
        id: crypto.randomUUID(), 
        category: '', 
        amount: remaining > 0 ? remaining : 0, 
        description: '' 
      }
    ]);
  };

  const removeAllocation = (id: string) => {
    if (allocations.length <= 1) return;
    setAllocations(allocations.filter(a => a.id !== id));
  };

  const updateAllocation = (id: string, updates: Partial<SplitAllocation>) => {
    setAllocations(allocations.map(a => 
      a.id === id ? { ...a, ...updates } : a
    ));
  };

  const handleSubmit = () => {
    // Validate all allocations have categories
    const missingCategories = allocations.some(a => !a.category);
    if (missingCategories) {
      toast({
        title: 'Missing category',
        description: 'Please select a category for each allocation',
        variant: 'destructive'
      });
      return;
    }

    // Validate amounts are positive
    const invalidAmounts = allocations.some(a => a.amount <= 0);
    if (invalidAmounts) {
      toast({
        title: 'Invalid amount',
        description: 'All amounts must be greater than $0',
        variant: 'destructive'
      });
      return;
    }

    // Validate balanced
    if (!isBalanced) {
      toast({
        title: 'Amounts don\'t match',
        description: `Allocations must equal the receipt total (${formatCurrency(remaining)} ${remaining > 0 ? 'remaining' : 'over'})`,
        variant: 'destructive'
      });
      return;
    }

    onSplit(allocations.map(({ category, amount, description }) => ({
      category,
      amount,
      description
    })));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Split className="h-4 w-4 text-primary" />
          <span className="font-medium">Split Receipt</span>
        </div>
        <Badge variant="outline" className="font-mono">
          {formatCurrency(receiptTotal)}
        </Badge>
      </div>

      {vendorName && (
        <p className="text-sm text-muted-foreground">
          Split this {vendorName} receipt across multiple cost categories
        </p>
      )}

      {/* Allocations List */}
      <div className="space-y-3">
        {allocations.map((allocation, index) => (
          <div 
            key={allocation.id}
            className="p-3 rounded-lg bg-muted/50 border space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Allocation {index + 1}
              </span>
              {allocations.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAllocation(allocation.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={allocation.category}
                  onValueChange={(value) => updateAllocation(allocation.id, { category: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={allocation.amount || ''}
                    onChange={(e) => updateAllocation(allocation.id, { 
                      amount: parseFloat(e.target.value) || 0 
                    })}
                    className="pl-7 h-9 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                placeholder="e.g., 2x4 studs, pipe fittings..."
                value={allocation.description}
                onChange={(e) => updateAllocation(allocation.id, { description: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add Allocation Button */}
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full"
        onClick={addAllocation}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Another Category
      </Button>

      {/* Balance Summary */}
      <div className={cn(
        'p-3 rounded-lg border flex items-center justify-between',
        isBalanced 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-warning/10 border-warning/30'
      )}>
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-warning" />
          )}
          <span className="text-sm font-medium">
            {isBalanced ? 'Balanced' : 
              remaining > 0 ? `${formatCurrency(remaining)} remaining` : 
              `${formatCurrency(Math.abs(remaining))} over`
            }
          </span>
        </div>
        <span className="text-sm font-mono">
          {formatCurrency(allocatedTotal)} / {formatCurrency(receiptTotal)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          className="flex-1" 
          onClick={handleSubmit}
          disabled={!isBalanced || allocations.some(a => !a.category)}
        >
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Apply Split
        </Button>
      </div>
    </div>
  );
}

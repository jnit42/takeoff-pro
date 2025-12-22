/**
 * Variance Drill-Down Component
 * Shows detailed breakdown of variance by category when clicking the variance card
 */

import { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  ChevronRight
} from 'lucide-react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ActualRecord {
  id: string;
  category: string;
  description: string;
  estimated_amount: number;
  actual_amount: number | null;
  variance_amount: number | null;
  variance_percent: number | null;
}

interface VarianceDrillDownProps {
  isOpen: boolean;
  onClose: () => void;
  actuals: ActualRecord[];
  totalVariance: number;
  totalVariancePercent: number;
}

interface CategoryBreakdown {
  category: string;
  estimated: number;
  actual: number;
  variance: number;
  variancePercent: number;
  itemCount: number;
  items: ActualRecord[];
}

export function VarianceDrillDown({ 
  isOpen, 
  onClose, 
  actuals,
  totalVariance,
  totalVariancePercent
}: VarianceDrillDownProps) {
  
  // Group actuals by category and calculate totals
  const categoryBreakdown = useMemo((): CategoryBreakdown[] => {
    const completed = actuals.filter(a => a.actual_amount !== null);
    
    const grouped = completed.reduce((acc, item) => {
      const cat = item.category || 'Other';
      if (!acc[cat]) {
        acc[cat] = {
          category: cat,
          estimated: 0,
          actual: 0,
          variance: 0,
          variancePercent: 0,
          itemCount: 0,
          items: []
        };
      }
      acc[cat].estimated += item.estimated_amount || 0;
      acc[cat].actual += item.actual_amount || 0;
      acc[cat].variance += item.variance_amount || 0;
      acc[cat].itemCount += 1;
      acc[cat].items.push(item);
      return acc;
    }, {} as Record<string, CategoryBreakdown>);

    // Calculate variance percent for each category
    return Object.values(grouped)
      .map(cat => ({
        ...cat,
        variancePercent: cat.estimated > 0 
          ? (cat.variance / cat.estimated) * 100 
          : 0
      }))
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }, [actuals]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getVarianceColor = (percent: number) => {
    if (percent > 10) return 'text-destructive';
    if (percent > 5) return 'text-warning';
    if (percent < -5) return 'text-green-600';
    return 'text-muted-foreground';
  };

  const getVarianceBg = (percent: number) => {
    if (percent > 10) return 'bg-destructive/10 border-destructive/20';
    if (percent > 5) return 'bg-warning/10 border-warning/20';
    if (percent < -5) return 'bg-green-500/10 border-green-500/20';
    return 'bg-muted/50 border-border';
  };

  const getVarianceIcon = (percent: number) => {
    if (percent > 5) return <TrendingUp className="h-4 w-4" />;
    if (percent < -5) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getStatusLabel = (percent: number) => {
    if (percent > 10) return { label: 'Alert', icon: AlertTriangle, color: 'text-destructive' };
    if (percent > 5) return { label: 'Warning', icon: AlertTriangle, color: 'text-warning' };
    if (percent < -5) return { label: 'Savings', icon: CheckCircle, color: 'text-green-600' };
    return { label: 'On Target', icon: CheckCircle, color: 'text-muted-foreground' };
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle className="flex items-center justify-between">
            <span>Variance Breakdown</span>
            <Badge 
              variant="outline" 
              className={cn('font-mono', getVarianceColor(totalVariancePercent))}
            >
              {totalVariance >= 0 ? '+' : ''}{formatCurrency(totalVariance)}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        {/* Total Summary */}
        <div className={cn(
          'mx-4 mt-4 p-4 rounded-lg border',
          getVarianceBg(totalVariancePercent)
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Total Project Variance</span>
            <div className={cn('flex items-center gap-1', getVarianceColor(totalVariancePercent))}>
              {getVarianceIcon(totalVariancePercent)}
              <span className="font-bold">
                {totalVariancePercent >= 0 ? '+' : ''}{totalVariancePercent.toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {categoryBreakdown.length} categories tracked
          </p>
        </div>

        {/* Category List */}
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-3">
            {categoryBreakdown.length > 0 ? (
              categoryBreakdown.map((cat) => {
                const status = getStatusLabel(cat.variancePercent);
                const StatusIcon = status.icon;
                
                return (
                  <div
                    key={cat.category}
                    className={cn(
                      'p-3 rounded-lg border transition-colors',
                      getVarianceBg(cat.variancePercent)
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{cat.category}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {cat.itemCount} items
                        </Badge>
                      </div>
                      <div className={cn('flex items-center gap-1 text-sm', status.color)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span className="font-medium">{status.label}</span>
                      </div>
                    </div>

                    {/* Variance Amount */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        Est: {formatCurrency(cat.estimated)} → Act: {formatCurrency(cat.actual)}
                      </span>
                      <span className={cn('font-mono font-semibold', getVarianceColor(cat.variancePercent))}>
                        {cat.variance >= 0 ? '+' : ''}{formatCurrency(cat.variance)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <Progress 
                        value={Math.min((cat.actual / cat.estimated) * 100, 150)} 
                        className="h-1.5"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{((cat.actual / cat.estimated) * 100).toFixed(0)}% of budget</span>
                        <span className={getVarianceColor(cat.variancePercent)}>
                          {cat.variancePercent >= 0 ? '+' : ''}{cat.variancePercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Top items (collapsed) */}
                    {cat.items.slice(0, 2).map((item, idx) => (
                      <div 
                        key={item.id}
                        className={cn(
                          'flex items-center justify-between text-xs py-1.5',
                          idx === 0 && 'border-t mt-2 pt-2'
                        )}
                      >
                        <span className="text-muted-foreground truncate flex-1 mr-2">
                          {item.description}
                        </span>
                        <span className={cn('font-mono', getVarianceColor(item.variance_percent || 0))}>
                          {(item.variance_amount || 0) >= 0 ? '+' : ''}{formatCurrency(item.variance_amount || 0)}
                        </span>
                      </div>
                    ))}
                    {cat.items.length > 2 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <ChevronRight className="h-3 w-3" />
                        <span>+{cat.items.length - 2} more items</span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No completed actuals to analyze</p>
                <p className="text-xs mt-1">Upload receipts and record actual costs first</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

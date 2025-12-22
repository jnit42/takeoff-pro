/**
 * Value Card Component
 * Shows the 3 key numbers at a glance: Total Cost, Markup, Profit
 * Handoff-style "bottom line first" approach
 */

import { DollarSign, TrendingUp, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useClientMode } from '@/hooks/useClientMode';
import { cn } from '@/lib/utils';

interface ValueCardProps {
  subtotal: number;
  markup: number;
  markupPercent: number;
  taxPercent: number;
  finalBid: number;
  draftSubtotal?: number;
  className?: string;
}

export function ValueCard({
  subtotal,
  markup,
  markupPercent,
  taxPercent,
  finalBid,
  draftSubtotal = 0,
  className
}: ValueCardProps) {
  const { isClientMode } = useClientMode();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate profit (markup minus tax on materials)
  const tax = subtotal * (taxPercent / 100);
  const profit = markup - tax;

  return (
    <Card className={cn('bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20', className)}>
      <CardContent className="p-4">
        {/* Main Number - Final Bid */}
        <div className="text-center mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Final Bid
          </p>
          <p className="text-4xl font-mono font-bold text-primary">
            {formatCurrency(finalBid)}
          </p>
          {draftSubtotal > 0 && (
            <Badge variant="outline" className="mt-2 text-warning border-warning/50">
              +{formatCurrency(draftSubtotal)} in drafts
            </Badge>
          )}
        </div>

        {/* Three Metrics Row */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-primary/20">
          {/* Cost */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              <span className="text-[10px] uppercase">Cost</span>
            </div>
            <p className="font-mono font-semibold text-sm">
              {formatCurrency(subtotal)}
            </p>
          </div>

          {/* Markup / Hidden in Client Mode */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Percent className="h-3 w-3" />
              <span className="text-[10px] uppercase">Markup</span>
            </div>
            {isClientMode ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <p className="font-mono font-semibold text-sm">
                {markupPercent}%
              </p>
            )}
          </div>

          {/* Profit / Hidden in Client Mode */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              <span className="text-[10px] uppercase">Profit</span>
            </div>
            {isClientMode ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <p className={cn(
                'font-mono font-semibold text-sm',
                profit > 0 ? 'text-green-600' : 'text-destructive'
              )}>
                {formatCurrency(profit)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

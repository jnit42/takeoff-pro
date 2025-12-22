/**
 * Value Card Component
 * Handoff-style: Just 3 numbers - Cost, Markup, Final Bid
 * Clean, bold, no noise
 */

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/constants';
import { useClientMode } from '@/hooks/useClientMode';

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
  const tax = subtotal * (taxPercent / 100);
  const profit = markup;
  
  return (
    <div className={cn('rounded-xl bg-gradient-to-br from-primary/10 via-background to-accent/5 p-4 border border-primary/20', className)}>
      {/* Main 3-number display */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {/* Cost */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cost</p>
          <p className="text-xl font-bold font-mono tabular-nums mt-0.5">
            {formatCurrency(subtotal)}
          </p>
        </div>
        
        {/* Markup/Tax - hidden in client mode */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {isClientMode ? 'Tax' : 'Markup'}
          </p>
          <p className="text-xl font-bold font-mono tabular-nums mt-0.5 text-muted-foreground">
            {isClientMode ? formatCurrency(tax) : `+${markupPercent}%`}
          </p>
        </div>
        
        {/* Final Bid */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {isClientMode ? 'Total' : 'Bid'}
          </p>
          <p className="text-xl font-bold font-mono tabular-nums mt-0.5 text-primary">
            {formatCurrency(finalBid)}
          </p>
        </div>
      </div>
      
      {/* Draft indicator - small, unobtrusive */}
      {draftSubtotal > 0 && (
        <p className="text-[10px] text-center text-warning mt-3 pt-2 border-t border-border/30">
          +{formatCurrency(draftSubtotal)} in drafts
        </p>
      )}
      
      {/* Hidden profit indicator for contractor */}
      {!isClientMode && profit > 0 && (
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          Profit: {formatCurrency(profit)}
        </p>
      )}
    </div>
  );
}

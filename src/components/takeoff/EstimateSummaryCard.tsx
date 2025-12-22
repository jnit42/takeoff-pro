/**
 * Estimate Summary Card
 * Handoff-style in-chat estimate preview card
 * Shows estimate number, title, item count, and total
 */

import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface EstimateSummaryCardProps {
  estimateNumber?: string;
  title: string;
  itemCount: number;
  total: number;
  onClick?: () => void;
  className?: string;
}

export function EstimateSummaryCard({
  estimateNumber,
  title,
  itemCount,
  total,
  onClick,
  className
}: EstimateSummaryCardProps) {
  return (
    <Card 
      className={cn(
        'p-4 cursor-pointer hover:bg-muted/30 transition-colors active:bg-muted/50',
        className
      )}
      onClick={onClick}
    >
      {/* Estimate number */}
      {estimateNumber && (
        <p className="text-xs text-muted-foreground font-mono mb-1">
          {estimateNumber}
        </p>
      )}
      
      {/* Title */}
      <h3 className="font-semibold text-lg leading-tight mb-2">
        {title}
      </h3>
      
      {/* Item count */}
      <p className="text-sm text-muted-foreground mb-3">
        {itemCount} item{itemCount !== 1 ? 's' : ''}
      </p>
      
      {/* Total */}
      <p className="text-xl font-bold font-mono text-primary tabular-nums">
        {formatCurrency(total)}
      </p>
      
      {/* View button hint */}
      {onClick && (
        <div className="flex items-center justify-center mt-4 py-2 border-t border-border/50">
          <span className="text-sm text-muted-foreground">View estimate</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
        </div>
      )}
    </Card>
  );
}

/**
 * Variance Dashboard Component
 * Shows estimate vs actual comparison with deviation analysis
 * Click variance card to drill down into category breakdown
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  BarChart3,
  Filter,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VarianceDrillDown } from './VarianceDrillDown';
import { cn } from '@/lib/utils';

interface VarianceDashboardProps {
  projectId: string;
  className?: string;
}

interface ActualRecord {
  id: string;
  category: string;
  description: string;
  estimated_amount: number;
  actual_amount: number | null;
  variance_amount: number | null;
  variance_percent: number | null;
  paid_to: string | null;
  paid_date: string | null;
}

type CategoryFilter = 'all' | 'material' | 'labor' | 'equipment' | 'subcontractor';

export function VarianceDashboard({ projectId, className }: VarianceDashboardProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showDrillDown, setShowDrillDown] = useState(false);

  // Fetch actuals data
  const { data: actuals = [], isLoading } = useQuery({
    queryKey: ['project-actuals', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_actuals')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ActualRecord[];
    },
    enabled: !!projectId,
  });

  // Filter by category
  const filteredActuals = useMemo(() => {
    if (categoryFilter === 'all') return actuals;
    return actuals.filter(a => a.category === categoryFilter);
  }, [actuals, categoryFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    const completed = filteredActuals.filter(a => a.actual_amount !== null);
    const totalEstimated = filteredActuals.reduce((sum, a) => sum + (a.estimated_amount || 0), 0);
    const totalActual = completed.reduce((sum, a) => sum + (a.actual_amount || 0), 0);
    const totalVariance = completed.reduce((sum, a) => sum + (a.variance_amount || 0), 0);
    const overBudgetCount = completed.filter(a => (a.variance_percent || 0) > 5).length;
    const underBudgetCount = completed.filter(a => (a.variance_percent || 0) < -5).length;
    const onTargetCount = completed.filter(a => Math.abs(a.variance_percent || 0) <= 5).length;
    
    return {
      estimated: totalEstimated,
      actual: totalActual,
      variance: totalVariance,
      variancePercent: totalEstimated > 0 ? (totalVariance / totalEstimated) * 100 : 0,
      completed: completed.length,
      pending: filteredActuals.length - completed.length,
      overBudget: overBudgetCount,
      underBudget: underBudgetCount,
      onTarget: onTargetCount,
    };
  }, [filteredActuals]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  const getVarianceColor = (percent: number | null) => {
    if (percent === null) return 'text-muted-foreground';
    if (percent > 10) return 'text-destructive';
    if (percent > 5) return 'text-warning';
    if (percent < -5) return 'text-green-600';
    return 'text-muted-foreground';
  };

  const getVarianceIcon = (percent: number | null) => {
    if (percent === null) return <Minus className="h-3.5 w-3.5" />;
    if (percent > 5) return <TrendingUp className="h-3.5 w-3.5" />;
    if (percent < -5) return <TrendingDown className="h-3.5 w-3.5" />;
    return <Minus className="h-3.5 w-3.5" />;
  };

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-24 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Estimate vs Actual
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
                <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCategoryFilter('all')}>All Categories</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter('material')}>Materials</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter('labor')}>Labor</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter('subcontractor')}>Subcontractors</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCategoryFilter('equipment')}>Equipment</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Estimated</p>
            <p className="text-lg font-bold">{formatCurrency(totals.estimated)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Actual</p>
            <p className="text-lg font-bold">{formatCurrency(totals.actual)}</p>
          </div>
          {/* Clickable Variance Card */}
          <button
            onClick={() => setShowDrillDown(true)}
            className={cn(
              'p-3 rounded-lg border text-left w-full transition-all hover:ring-2 hover:ring-primary/20',
              totals.variancePercent > 5 ? 'bg-destructive/10 border-destructive/20' :
              totals.variancePercent < -5 ? 'bg-green-500/10 border-green-500/20' :
              'bg-muted/50'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Variance</p>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className={cn('text-lg font-bold', getVarianceColor(totals.variancePercent))}>
              {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance)}
            </p>
            <p className={cn('text-xs', getVarianceColor(totals.variancePercent))}>
              {totals.variancePercent >= 0 ? '+' : ''}{totals.variancePercent.toFixed(1)}%
            </p>
          </button>
        </div>

        {/* Variance Drill-Down Sheet */}
        <VarianceDrillDown
          isOpen={showDrillDown}
          onClose={() => setShowDrillDown(false)}
          actuals={filteredActuals}
          totalVariance={totals.variance}
          totalVariancePercent={totals.variancePercent}
        />

        {/* Status breakdown */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs">{totals.underBudget} Under</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="text-xs">{totals.onTarget} On Target</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            <span className="text-xs">{totals.overBudget} Over</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-muted-foreground">{totals.pending} pending</span>
          </div>
        </div>

        {/* Progress bar */}
        {totals.completed > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Budget Progress</span>
              <span className="font-medium">
                {formatCurrency(totals.actual)} / {formatCurrency(totals.estimated)}
              </span>
            </div>
            <Progress 
              value={Math.min((totals.actual / totals.estimated) * 100, 100)} 
              className="h-2"
            />
          </div>
        )}

        {/* Items list */}
        {filteredActuals.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredActuals.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background border hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{item.description || 'Unnamed item'}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {item.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>Est: {formatCurrency(item.estimated_amount)}</span>
                    {item.actual_amount !== null && (
                      <span>Act: {formatCurrency(item.actual_amount)}</span>
                    )}
                    {item.paid_to && <span>→ {item.paid_to}</span>}
                  </div>
                </div>
                
                {item.variance_percent !== null ? (
                  <div className={cn('flex items-center gap-1 text-sm font-medium', getVarianceColor(item.variance_percent))}>
                    {getVarianceIcon(item.variance_percent)}
                    <span>{item.variance_percent >= 0 ? '+' : ''}{item.variance_percent.toFixed(1)}%</span>
                  </div>
                ) : (
                  <Badge variant="secondary" className="text-xs">Pending</Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No actuals recorded yet</p>
            <p className="text-xs mt-1">Upload receipts or add actual costs to track variance</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

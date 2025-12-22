import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatCurrency } from '@/lib/constants';

interface CostSummaryProps {
  projectId: string;
  project: {
    name: string;
    tax_percent: number | null;
    labor_burden_percent: number | null;
    markup_percent: number | null;
  };
}

interface TakeoffItem {
  id: string;
  category: string;
  description: string;
  adjusted_qty: number | null;
  unit_cost: number | null;
  extended_cost: number | null;
  draft: boolean | null;
}

interface LaborLineItem {
  id: string;
  task_name: string;
  extended: number | null;
}

interface LaborEstimate {
  id: string;
  subcontractor_name: string | null;
  total: number | null;
  labor_line_items: LaborLineItem[];
}

export function CostSummary({ projectId, project }: CostSummaryProps) {
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [expandMaterials, setExpandMaterials] = useState(false);
  const [expandLabor, setExpandLabor] = useState(false);

  const { data: takeoffItems = [] } = useQuery({
    queryKey: ['takeoff-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('takeoff_items')
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return data as TakeoffItem[];
    },
  });

  const { data: laborEstimates = [] } = useQuery({
    queryKey: ['labor-estimates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_estimates')
        .select('*, labor_line_items(*)')
        .eq('project_id', projectId);
      if (error) throw error;
      return data as LaborEstimate[];
    },
  });

  // Filter items based on draft toggle
  const filteredItems = includeDrafts 
    ? takeoffItems 
    : takeoffItems.filter(item => !item.draft);

  // Find items with missing costs
  const missingCostItems = filteredItems.filter(
    item => item.unit_cost == null || item.unit_cost === 0
  );

  // Group items by category
  const itemsByCategory = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, TakeoffItem[]>);

  // Calculate category totals
  const categoryTotals = Object.entries(itemsByCategory).reduce((acc, [cat, items]) => {
    acc[cat] = items.reduce((sum, item) => sum + (Number(item.extended_cost) || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  // Calculate totals using the specified math hierarchy
  const materialSubtotal = filteredItems.reduce(
    (sum, item) => sum + (Number(item.extended_cost) || 0), 
    0
  );
  const materialTax = materialSubtotal * ((project.tax_percent || 0) / 100);
  const materialsTotal = materialSubtotal + materialTax;

  const laborSubtotal = laborEstimates.reduce(
    (sum, est) => sum + (Number(est.total) || 0), 
    0
  );
  const laborBurden = laborSubtotal * ((project.labor_burden_percent || 0) / 100);
  const laborTotal = laborSubtotal + laborBurden;

  const projectSubtotal = materialsTotal + laborTotal;
  const markupAmount = projectSubtotal * ((project.markup_percent || 0) / 100);
  const totalWithMarkup = projectSubtotal + markupAmount;

  // Round to nearest $100
  const finalBidPrice = Math.round(totalWithMarkup / 100) * 100;

  return (
    <div className="space-y-4">
      {/* Final Bid Card - Clean stacked layout */}
      <Card className="bg-accent/10 border-accent/30">
        <CardContent className="p-4">
          {/* Price row */}
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <DollarSign className="h-4 w-4" />
            Final Bid Price
          </div>
          <div className="text-3xl font-mono font-bold text-accent mb-3">
            {formatCurrency(finalBidPrice)}
          </div>
          
          {/* Toggle row - separate line */}
          <div className="flex items-center gap-2 pt-2 border-t border-accent/20">
            <Switch
              id="include-drafts"
              checked={includeDrafts}
              onCheckedChange={setIncludeDrafts}
            />
            <Label htmlFor="include-drafts" className="text-sm">Include Drafts</Label>
          </div>
        </CardContent>
      </Card>

      {/* Missing Cost Warning */}
      {missingCostItems.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">
                {missingCostItems.length} item{missingCostItems.length !== 1 ? 's' : ''} missing unit cost
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {missingCostItems.slice(0, 3).map(i => i.description).join(', ')}
              {missingCostItems.length > 3 && ` + ${missingCostItems.length - 3} more`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cost Breakdown */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          {/* Materials Section */}
          <Collapsible open={expandMaterials} onOpenChange={setExpandMaterials}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  {expandMaterials ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="font-medium text-sm">Materials</span>
                  <Badge variant="secondary" className="text-xs">{filteredItems.length}</Badge>
                </div>
                <span className="font-mono text-sm font-semibold">{formatCurrency(materialsTotal)}</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-4 pt-2 space-y-1.5">
                {Object.entries(categoryTotals)
                  .filter(([_, total]) => total > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, total]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate pr-2">{category}</span>
                      <span className="font-mono">{formatCurrency(total)}</span>
                    </div>
                  ))}
                <div className="border-t pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(materialSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Tax ({project.tax_percent || 0}%)</span>
                    <span className="font-mono">{formatCurrency(materialTax)}</span>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Labor Section */}
          <Collapsible open={expandLabor} onOpenChange={setExpandLabor}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  {expandLabor ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="font-medium text-sm">Labor</span>
                  <Badge variant="secondary" className="text-xs">
                    {laborEstimates.reduce((sum, e) => sum + (e.labor_line_items?.length || 0), 0)}
                  </Badge>
                </div>
                <span className="font-mono text-sm font-semibold">{formatCurrency(laborTotal)}</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-4 pt-2 space-y-1.5">
                {laborEstimates.map((est) => (
                  est.labor_line_items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate pr-2">{item.task_name}</span>
                      <span className="font-mono">{formatCurrency(item.extended || 0)}</span>
                    </div>
                  ))
                ))}
                <div className="border-t pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(laborSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Burden ({project.labor_burden_percent || 0}%)</span>
                    <span className="font-mono">{formatCurrency(laborBurden)}</span>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Grand Total Section */}
          <div className="border-t pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Project Subtotal</span>
              <span className="font-mono">{formatCurrency(projectSubtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Markup ({project.markup_percent || 0}%)</span>
              <span className="font-mono">{formatCurrency(markupAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total with Markup</span>
              <span className="font-mono">{formatCurrency(totalWithMarkup)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>Final Bid (rounded)</span>
              <span className="font-mono text-accent">{formatCurrency(finalBidPrice)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

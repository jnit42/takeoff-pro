import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  DollarSign,
  Link2Off,
  Percent,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QADashboardProps {
  projectId: string;
}

interface QAIssue {
  id: string;
  type: 'missing_cost' | 'unlinked_qty' | 'override' | 'waste_outlier' | 'unresolved_rfi';
  severity: 'red' | 'orange' | 'yellow';
  title: string;
  description: string;
  itemId?: string;
  navigateTo?: string;
}

// Waste bands by trade/category
const WASTE_BANDS: Record<string, [number, number]> = {
  'Drywall': [8, 15],
  'Framing': [5, 12],
  'Decking': [5, 10],
  'Tile': [10, 20],
  'Flooring': [8, 15],
  'Roofing': [5, 15],
  'Insulation': [5, 12],
};

export function QADashboard({ projectId }: QADashboardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Fetch takeoff items
  const { data: takeoffItems = [] } = useQuery({
    queryKey: ['takeoff-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('takeoff_items')
        .select('*')
        .eq('project_id', projectId)
        .eq('draft', false);
      if (error) throw error;
      return data;
    },
  });

  // Fetch blueprint measurements for linking check
  const { data: measurements = [] } = useQuery({
    queryKey: ['blueprint-measurements-project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blueprint_measurements')
        .select('id, takeoff_item_id, value, plan_file_id')
        .eq('project_id', projectId);
      if (error) throw error;
      return data;
    },
  });

  // Fetch RFIs
  const { data: rfis = [] } = useQuery({
    queryKey: ['rfis', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'open');
      if (error) throw error;
      return data;
    },
  });

  // Build issues list
  const issues = useMemo<QAIssue[]>(() => {
    const result: QAIssue[] = [];

    // Create map of takeoff_item_id -> measurements
    const measurementsByItem = measurements.reduce((acc, m) => {
      if (m.takeoff_item_id) {
        if (!acc[m.takeoff_item_id]) acc[m.takeoff_item_id] = [];
        acc[m.takeoff_item_id].push(m);
      }
      return acc;
    }, {} as Record<string, typeof measurements>);

    takeoffItems.forEach((item) => {
      // Missing cost (RED)
      if (item.unit_cost == null || item.unit_cost === 0) {
        result.push({
          id: `missing-cost-${item.id}`,
          type: 'missing_cost',
          severity: 'red',
          title: 'Missing Unit Cost',
          description: item.description,
          itemId: item.id,
          navigateTo: `/projects/${projectId}?tab=takeoff`,
        });
      }

      // Unlinked quantities (ORANGE)
      const itemMeasurements = measurementsByItem[item.id] || [];
      if (item.quantity > 0 && itemMeasurements.length === 0 && !item.notes?.includes('[manual ok]')) {
        result.push({
          id: `unlinked-${item.id}`,
          type: 'unlinked_qty',
          severity: 'orange',
          title: 'Unlinked Quantity',
          description: `${item.description} (${item.quantity} ${item.unit})`,
          itemId: item.id,
          navigateTo: `/projects/${projectId}?tab=takeoff`,
        });
      }

      // Override check (ORANGE)
      if (itemMeasurements.length > 0) {
        const linkedSum = itemMeasurements.reduce((sum, m) => sum + (m.value || 0), 0);
        const diff = Math.abs(item.quantity - linkedSum);
        const percentDiff = linkedSum > 0 ? (diff / linkedSum) * 100 : 0;
        
        if (percentDiff > 5 && !item.notes?.includes('[override:')) {
          result.push({
            id: `override-${item.id}`,
            type: 'override',
            severity: 'orange',
            title: 'Quantity Override',
            description: `${item.description}: ${item.quantity} vs linked ${linkedSum.toFixed(1)} (${percentDiff.toFixed(0)}% diff)`,
            itemId: item.id,
            navigateTo: `/projects/${projectId}?tab=takeoff`,
          });
        }
      }

      // Waste outliers (YELLOW)
      const wasteBand = WASTE_BANDS[item.category];
      if (wasteBand && item.waste_percent != null) {
        if (item.waste_percent < wasteBand[0] || item.waste_percent > wasteBand[1]) {
          result.push({
            id: `waste-${item.id}`,
            type: 'waste_outlier',
            severity: 'yellow',
            title: 'Waste % Outside Range',
            description: `${item.description}: ${item.waste_percent}% (expected ${wasteBand[0]}-${wasteBand[1]}%)`,
            itemId: item.id,
            navigateTo: `/projects/${projectId}?tab=takeoff`,
          });
        }
      }
    });

    // Unresolved RFIs (RED)
    rfis.forEach((rfi) => {
      result.push({
        id: `rfi-${rfi.id}`,
        type: 'unresolved_rfi',
        severity: 'red',
        title: 'Unresolved RFI',
        description: rfi.question,
        navigateTo: `/projects/${projectId}?tab=command`,
      });
    });

    return result;
  }, [takeoffItems, measurements, rfis, projectId]);

  // Calculate QA score
  const qaScore = useMemo(() => {
    let score = 100;
    issues.forEach((issue) => {
      if (issue.severity === 'red') score -= 10;
      else if (issue.severity === 'orange') score -= 5;
      else if (issue.severity === 'yellow') score -= 2;
    });
    return Math.max(0, score);
  }, [issues]);

  const redCount = issues.filter((i) => i.severity === 'red').length;
  const orangeCount = issues.filter((i) => i.severity === 'orange').length;
  const yellowCount = issues.filter((i) => i.severity === 'yellow').length;

  const getSeverityIcon = (severity: QAIssue['severity']) => {
    switch (severity) {
      case 'red':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'orange':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'yellow':
        return <Info className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getTypeIcon = (type: QAIssue['type']) => {
    switch (type) {
      case 'missing_cost':
        return <DollarSign className="h-4 w-4" />;
      case 'unlinked_qty':
        return <Link2Off className="h-4 w-4" />;
      case 'override':
        return <Percent className="h-4 w-4" />;
      case 'waste_outlier':
        return <Percent className="h-4 w-4" />;
      case 'unresolved_rfi':
        return <HelpCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Score Card */}
      <Card className={qaScore >= 80 ? 'border-green-500/30' : qaScore >= 50 ? 'border-warning/30' : 'border-destructive/30'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardDescription>QA Score</CardDescription>
              <CardTitle className={`text-4xl font-mono ${
                qaScore >= 80 ? 'text-green-500' : qaScore >= 50 ? 'text-warning' : 'text-destructive'
              }`}>
                {qaScore}
              </CardTitle>
            </div>
            {qaScore === 100 ? (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            ) : (
              <div className="flex gap-2">
                {redCount > 0 && (
                  <Badge variant="destructive">{redCount} critical</Badge>
                )}
                {orangeCount > 0 && (
                  <Badge className="bg-warning text-warning-foreground">{orangeCount} warnings</Badge>
                )}
                {yellowCount > 0 && (
                  <Badge variant="secondary">{yellowCount} info</Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Progress 
            value={qaScore} 
            className={`h-2 ${qaScore >= 80 ? '[&>div]:bg-green-500' : qaScore >= 50 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive'}`}
          />
        </CardContent>
      </Card>

      {/* Issues List */}
      {issues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="font-semibold">No Issues Found</h3>
            <p className="text-muted-foreground text-center">
              Your estimate passes all QA checks
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Fix-It Queue</CardTitle>
            <CardDescription>
              {issues.length} issue{issues.length !== 1 ? 's' : ''} to review
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                  >
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(issue.type)}
                        <span className="font-medium text-sm">{issue.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {issue.description}
                      </p>
                    </div>
                    {issue.navigateTo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(issue.navigateTo!)}
                      >
                        Fix <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

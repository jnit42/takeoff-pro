import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Loader2, TrendingUp, DollarSign, FolderKanban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';

export default function Reports() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['report-stats'],
    queryFn: async () => {
      const { data: projects } = await supabase
        .from('projects')
        .select('id');

      const { data: takeoffItems } = await supabase
        .from('takeoff_items')
        .select('extended_cost');

      const { data: laborEstimates } = await supabase
        .from('labor_estimates')
        .select('total');

      const totalMaterials = takeoffItems?.reduce(
        (sum, item) => sum + (Number(item.extended_cost) || 0),
        0
      ) || 0;

      const totalLabor = laborEstimates?.reduce(
        (sum, est) => sum + (Number(est.total) || 0),
        0
      ) || 0;

      return {
        projectCount: projects?.length || 0,
        totalMaterials,
        totalLabor,
        grandTotal: totalMaterials + totalLabor,
      };
    },
  });

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your estimating activity
            </p>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" />
                    Total Projects
                  </CardDescription>
                  <CardTitle className="text-3xl">{stats?.projectCount || 0}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Total Materials
                  </CardDescription>
                  <CardTitle className="text-3xl font-mono">
                    {formatCurrency(stats?.totalMaterials || 0)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Total Labor
                  </CardDescription>
                  <CardTitle className="text-3xl font-mono">
                    {formatCurrency(stats?.totalLabor || 0)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className="bg-accent/10 border-accent/20">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Grand Total
                  </CardDescription>
                  <CardTitle className="text-3xl font-mono text-accent">
                    {formatCurrency(stats?.grandTotal || 0)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Coming Soon */}
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Advanced Reports Coming Soon</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Detailed analytics including cost breakdowns by category, vendor analysis,
                  historical comparisons, and profit margin tracking.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

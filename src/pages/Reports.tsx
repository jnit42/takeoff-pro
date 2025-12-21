import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Loader2, TrendingUp, DollarSign, FolderKanban, FileSpreadsheet, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/constants';
import { exportTakeoffCSV, exportLaborCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

export default function Reports() {
  const { toast } = useToast();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['report-stats'],
    queryFn: async () => {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name');

      const { data: takeoffItems } = await supabase
        .from('takeoff_items')
        .select('extended_cost, draft');

      const { data: laborEstimates } = await supabase
        .from('labor_estimates')
        .select('total, labor_line_items(extended)');

      // Only count active items for totals
      const activeItems = takeoffItems?.filter(item => !item.draft) || [];
      const totalMaterials = activeItems.reduce(
        (sum, item) => sum + (Number(item.extended_cost) || 0),
        0
      );

      const totalLabor = laborEstimates?.reduce(
        (sum, est) => sum + (Number(est.total) || 0),
        0
      ) || 0;

      const draftCount = takeoffItems?.filter(item => item.draft).length || 0;
      const activeCount = activeItems.length;

      return {
        projectCount: projects?.length || 0,
        projects: projects || [],
        totalMaterials,
        totalLabor,
        grandTotal: totalMaterials + totalLabor,
        draftCount,
        activeCount,
        takeoffItems: takeoffItems || [],
        laborEstimates: laborEstimates || [],
      };
    },
  });

  const handleExportAllTakeoff = () => {
    if (!stats) return;
    exportTakeoffCSV(stats.takeoffItems as any, 'All_Projects', true);
    toast({ title: 'All takeoff items exported' });
  };

  const handleExportAllLabor = () => {
    if (!stats) return;
    exportLaborCSV(stats.laborEstimates as any, 'All_Projects');
    toast({ title: 'All labor items exported' });
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Overview of your estimating activity
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportAllTakeoff}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                All Takeoff Items (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportAllLabor}>
                <Users className="h-4 w-4 mr-2" />
                All Labor Items (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
              <Card>
                <CardHeader className="pb-2 p-3 sm:p-6">
                  <CardDescription className="flex items-center gap-2 text-xs sm:text-sm">
                    <FolderKanban className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Total</span> Projects
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-3xl">{stats?.projectCount || 0}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2 p-3 sm:p-6">
                  <CardDescription className="flex items-center gap-2 text-xs sm:text-sm">
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                    Materials
                  </CardDescription>
                  <CardTitle className="text-lg sm:text-3xl font-mono">
                    {formatCurrency(stats?.totalMaterials || 0)}
                  </CardTitle>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    {stats?.activeCount || 0} items ({stats?.draftCount || 0} drafts)
                  </p>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2 p-3 sm:p-6">
                  <CardDescription className="flex items-center gap-2 text-xs sm:text-sm">
                    <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
                    Labor
                  </CardDescription>
                  <CardTitle className="text-lg sm:text-3xl font-mono">
                    {formatCurrency(stats?.totalLabor || 0)}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className="bg-accent/10 border-accent/20 col-span-2 lg:col-span-1">
                <CardHeader className="pb-2 p-3 sm:p-6">
                  <CardDescription className="flex items-center gap-2 text-xs sm:text-sm">
                    <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                    Grand Total
                  </CardDescription>
                  <CardTitle className="text-xl sm:text-3xl font-mono text-accent">
                    {formatCurrency(stats?.grandTotal || 0)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Coming Soon */}
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
                <BarChart3 className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-base sm:text-lg mb-2 text-center">Advanced Reports Coming Soon</h3>
                <p className="text-muted-foreground text-center max-w-md text-sm">
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

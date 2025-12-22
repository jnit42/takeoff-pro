import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Settings,
  FileSpreadsheet,
  Users,
  Download,
  Loader2,
  FileText,
  Wand2,
  FileQuestion,
  AlertCircle,
  ListChecks,
  Calculator,
  Terminal,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MobileTabs, MobileTabsList, MobileTabsTrigger, MobileTabsContent } from '@/components/ui/mobile-tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TakeoffBuilder } from '@/components/takeoff/TakeoffBuilder';
import { LaborEstimator } from '@/components/labor/LaborEstimator';
import { PlanFilesManager } from '@/components/plans/PlanFilesManager';
import { ProjectSettings } from '@/components/project/ProjectSettings';
import { CostSummary } from '@/components/project/CostSummary';
import { GCWizard } from '@/components/wizard/GCWizard';
import { RFIsManager } from '@/components/wizard/RFIsManager';
import { AssumptionsManager } from '@/components/wizard/AssumptionsManager';
import { ChecklistManager } from '@/components/wizard/ChecklistManager';
import { CommandCenter } from '@/components/command/CommandCenter';
import { formatCurrency } from '@/lib/constants';
import { 
  exportTakeoffCSV, 
  exportLaborCSV, 
  exportRFIsCSV, 
  exportAssumptionsCSV, 
  exportChecklistCSV,
  exportProjectPDF 
} from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'summary');
  const [showWizard, setShowWizard] = useState(false);

  // Sync tab with URL params
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: takeoffItems = [] } = useQuery({
    queryKey: ['takeoff-items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('takeoff_items')
        .select('*')
        .eq('project_id', id)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: laborEstimates = [] } = useQuery({
    queryKey: ['labor-estimates', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_estimates')
        .select('*, labor_line_items(*)')
        .eq('project_id', id);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rfis = [] } = useQuery({
    queryKey: ['rfis', id],
    queryFn: async () => {
      const { data } = await supabase.from('rfis').select('*').eq('project_id', id);
      return data || [];
    },
  });

  const { data: assumptions = [] } = useQuery({
    queryKey: ['assumptions', id],
    queryFn: async () => {
      const { data } = await supabase.from('assumptions').select('*').eq('project_id', id);
      return data || [];
    },
  });

  const { data: checklistItems = [] } = useQuery({
    queryKey: ['checklist-items', id],
    queryFn: async () => {
      const { data } = await supabase.from('checklist_items').select('*').eq('project_id', id);
      return data || [];
    },
  });

  // Export handlers
  const handleExportPDF = () => {
    if (!project) return;
    exportProjectPDF({
      project,
      takeoffItems,
      laborEstimates,
      rfis,
      assumptions,
      checklistItems,
      includeDrafts: false,
    });
    toast({ title: 'PDF exported successfully' });
  };

  const handleExportTakeoffCSV = (includeDrafts: boolean) => {
    if (!project) return;
    exportTakeoffCSV(takeoffItems, project.name, includeDrafts);
    toast({ title: 'Takeoff CSV exported' });
  };

  const handleExportLaborCSV = () => {
    if (!project) return;
    exportLaborCSV(laborEstimates, project.name);
    toast({ title: 'Labor CSV exported' });
  };

  const handleExportRFIsCSV = () => {
    if (!project) return;
    exportRFIsCSV(rfis, project.name);
    toast({ title: 'RFIs CSV exported' });
  };

  const handleExportAssumptionsCSV = () => {
    if (!project) return;
    exportAssumptionsCSV(assumptions, project.name);
    toast({ title: 'Assumptions CSV exported' });
  };

  const handleExportChecklistCSV = () => {
    if (!project) return;
    exportChecklistCSV(checklistItems, project.name);
    toast({ title: 'Checklist CSV exported' });
  };

  const materialSubtotal = takeoffItems?.reduce((sum, item) => sum + (Number(item.extended_cost) || 0), 0) || 0;
  const tax = materialSubtotal * ((project?.tax_percent || 0) / 100);
  const materialTotal = materialSubtotal + tax;
  const laborTotal = laborEstimates?.reduce((sum, est) => sum + (Number(est.total) || 0), 0) || 0;
  const openRfis = rfis?.filter(r => r.status === 'open').length || 0;
  const pendingChecklist = checklistItems?.filter(c => c.status === 'pending').length || 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-screen">
          <p className="text-muted-foreground">Project not found</p>
          <Button variant="outline" onClick={() => navigate('/projects')} className="mt-4">
            Back to Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        {/* Mobile-optimized Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Top row: Back button + Actions */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="shrink-0 -ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <div className="flex items-center gap-2">
                <Button variant="accent" size="sm" onClick={() => setShowWizard(true)} className="hidden sm:flex">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Run GC Wizard
                </Button>
                <Button variant="accent" size="icon" onClick={() => setShowWizard(true)} className="sm:hidden">
                  <Wand2 className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleExportPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export PDF (Full Estimate)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExportTakeoffCSV(false)}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Takeoff CSV (Active Only)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportTakeoffCSV(true)}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Takeoff CSV (Include Drafts)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportLaborCSV}>
                      <Users className="h-4 w-4 mr-2" />
                      Labor CSV
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportRFIsCSV}>
                      <FileQuestion className="h-4 w-4 mr-2" />
                      RFIs CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportAssumptionsCSV}>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Assumptions CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportChecklistCSV}>
                      <ListChecks className="h-4 w-4 mr-2" />
                      Checklist CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Project info row */}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{project.name}</h1>
              {project.address && <p className="text-sm text-muted-foreground truncate">{project.address}</p>}
            </div>
          </div>
        </div>

        {/* Wizard Modal */}
        {showWizard && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto">
              <GCWizard projectId={id!} onComplete={() => setShowWizard(false)} />
              <Button variant="ghost" onClick={() => setShowWizard(false)} className="mt-4 w-full">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 pt-0 sm:pt-0">
          {/* Summary Cards - 2x2 grid on mobile, 4 columns on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 mt-4">
            <Card className="min-w-0">
              <CardHeader className="p-3 sm:pb-2 sm:p-4">
                <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Materials</span>
                </CardDescription>
                <CardTitle className="text-lg sm:text-2xl font-mono">{formatCurrency(materialTotal)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="p-3 sm:pb-2 sm:p-4">
                <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Labor</span>
                </CardDescription>
                <CardTitle className="text-lg sm:text-2xl font-mono">{formatCurrency(laborTotal)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className={`min-w-0 ${openRfis > 0 ? 'border-warning/50' : ''}`}>
              <CardHeader className="p-3 sm:pb-2 sm:p-4">
                <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <FileQuestion className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Open RFIs</span>
                </CardDescription>
                <CardTitle className="text-lg sm:text-2xl">{openRfis}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="p-3 sm:pb-2 sm:p-4">
                <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <ListChecks className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="truncate">Checklist</span>
                </CardDescription>
                <CardTitle className="text-lg sm:text-2xl">{pendingChecklist} pending</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Tabs - horizontal scroll on mobile */}
          <MobileTabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <MobileTabsList>
              <MobileTabsTrigger value="summary" className="gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                Summary
              </MobileTabsTrigger>
              <MobileTabsTrigger value="command" className="gap-1.5">
                <Terminal className="h-3.5 w-3.5" />
                Command
              </MobileTabsTrigger>
              <MobileTabsTrigger value="wizard" className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" />
                Wizard
              </MobileTabsTrigger>
              <MobileTabsTrigger value="rfis" className="gap-1.5">
                <FileQuestion className="h-3.5 w-3.5" />
                RFIs
              </MobileTabsTrigger>
              <MobileTabsTrigger value="assumptions" className="gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Assumptions
              </MobileTabsTrigger>
              <MobileTabsTrigger value="checklist" className="gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                Checklist
              </MobileTabsTrigger>
              <MobileTabsTrigger value="takeoff" className="gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Takeoff
              </MobileTabsTrigger>
              <MobileTabsTrigger value="labor" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Labor
              </MobileTabsTrigger>
              <MobileTabsTrigger value="plans" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Plans
              </MobileTabsTrigger>
              <MobileTabsTrigger value="settings" className="gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </MobileTabsTrigger>
            </MobileTabsList>

            <MobileTabsContent value="summary">
              <CostSummary projectId={id!} project={project} />
            </MobileTabsContent>
            <MobileTabsContent value="command">
              <div className="h-[calc(100vh-320px)] min-h-[400px]">
                <CommandCenter projectId={id!} projectType={undefined} className="h-full" />
              </div>
            </MobileTabsContent>
            <MobileTabsContent value="wizard">
              <Card>
                <CardHeader>
                  <CardTitle>GC Wizard Results</CardTitle>
                  <CardDescription>Run the wizard to generate RFIs, assumptions, and checklists</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="accent" onClick={() => setShowWizard(true)}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Run GC Wizard
                  </Button>
                </CardContent>
              </Card>
            </MobileTabsContent>
            <MobileTabsContent value="rfis"><RFIsManager projectId={id!} /></MobileTabsContent>
            <MobileTabsContent value="assumptions"><AssumptionsManager projectId={id!} /></MobileTabsContent>
            <MobileTabsContent value="checklist"><ChecklistManager projectId={id!} /></MobileTabsContent>
            <MobileTabsContent value="takeoff"><TakeoffBuilder projectId={id!} project={project} /></MobileTabsContent>
            <MobileTabsContent value="labor"><LaborEstimator projectId={id!} project={project} /></MobileTabsContent>
            <MobileTabsContent value="plans"><PlanFilesManager projectId={id!} planFileId={searchParams.get('planFileId') || undefined} /></MobileTabsContent>
            <MobileTabsContent value="settings"><ProjectSettings project={project} /></MobileTabsContent>
          </MobileTabs>
        </div>
      </div>
    </AppLayout>
  );
}

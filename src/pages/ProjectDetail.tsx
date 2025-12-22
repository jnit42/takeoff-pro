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
  Calculator,
  Handshake,
  Receipt,
  ClipboardList,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TakeoffBuilder } from '@/components/takeoff/TakeoffBuilder';
import { LaborEstimator } from '@/components/labor/LaborEstimator';
import { PlanFilesManager } from '@/components/plans/PlanFilesManager';
import { ProjectSettings } from '@/components/project/ProjectSettings';
import { CostSummary } from '@/components/project/CostSummary';
import { GCWizard } from '@/components/wizard/GCWizard';
import { ScopeManager } from '@/components/scope/ScopeManager';
import { CommandCenter } from '@/components/command/CommandCenter';
import { SubcontractorManager } from '@/components/subcontractors/SubcontractorManager';
import { ActualsTab } from '@/components/actuals/ActualsTab';
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
import { cn } from '@/lib/utils';

// Simplified tab configuration - 6 tabs instead of 12
const TABS = [
  { id: 'summary', label: 'Summary', icon: Calculator },
  { id: 'scope', label: 'Scope', icon: ClipboardList },
  { id: 'takeoff', label: 'Materials', icon: FileSpreadsheet },
  { id: 'labor', label: 'Labor', icon: Users },
  { id: 'actuals', label: 'Actuals', icon: Receipt },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

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
      <div className="flex flex-col min-h-screen pb-20 md:pb-0">
        {/* MOBILE HEADER - Stacked layout */}
        <header className="sticky top-0 z-40 bg-background border-b">
          {/* Row 1: Back + Project Name */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/projects')} 
              className="shrink-0 h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-base truncate">{project.name}</h1>
              {project.address && (
                <p className="text-xs text-muted-foreground truncate">{project.address}</p>
              )}
            </div>
          </div>
          
          {/* Row 2: Action Buttons */}
          <div className="flex items-center gap-2 px-4 py-2">
            <Button 
              variant="accent" 
              size="sm" 
              onClick={() => setShowWizard(true)}
              className="flex-1 sm:flex-none"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              <span>Wizard</span>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Download className="h-4 w-4 mr-2" />
                  <span>Export</span>
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
                  <ClipboardList className="h-4 w-4 mr-2" />
                  RFIs CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportAssumptionsCSV}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Assumptions CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportChecklistCSV}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Checklist CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row 3: Horizontal Scrolling Tabs */}
          <div className="overflow-x-auto scrollbar-none border-t border-border/50">
            <div className="flex min-w-max px-2 py-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg mx-0.5 transition-colors whitespace-nowrap",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

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

        {/* Main Content Area */}
        <main className="flex-1 p-4 overflow-auto">
          {/* Quick Stats - Only show on Summary tab for cleaner UI */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Materials
                  </div>
                  <div className="font-mono font-semibold">{formatCurrency(materialTotal)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Users className="h-3.5 w-3.5" />
                    Labor
                  </div>
                  <div className="font-mono font-semibold">{formatCurrency(laborTotal)}</div>
                </CardContent>
              </Card>
              <Card className={openRfis > 0 ? 'border-warning/50' : ''}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Open RFIs
                  </div>
                  <div className="font-semibold">{openRfis}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Checklist
                  </div>
                  <div className="font-semibold">{pendingChecklist} pending</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab Content */}
          <div className="min-h-0">
            {activeTab === 'summary' && (
              <div className="space-y-6">
                {/* Command Center embedded in Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wand2 className="h-5 w-5 text-primary" />
                      AI Command Center
                    </CardTitle>
                    <CardDescription>Talk to your estimating assistant</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[300px]">
                      <CommandCenter projectId={id!} projectType={undefined} className="h-full border-0" />
                    </div>
                  </CardContent>
                </Card>
                <CostSummary projectId={id!} project={project} />
              </div>
            )}
            {activeTab === 'scope' && <ScopeManager projectId={id!} />}
            {activeTab === 'takeoff' && <TakeoffBuilder projectId={id!} project={project} />}
            {activeTab === 'labor' && <LaborEstimator projectId={id!} project={project} />}
            {activeTab === 'actuals' && <ActualsTab projectId={id!} />}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <ProjectSettings project={project} />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Plan Files</CardTitle>
                    <CardDescription>Upload and manage project blueprints</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PlanFilesManager projectId={id!} planFileId={searchParams.get('planFileId') || undefined} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Subcontractors</CardTitle>
                    <CardDescription>Manage subs assigned to this project</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SubcontractorManager projectId={id!} />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

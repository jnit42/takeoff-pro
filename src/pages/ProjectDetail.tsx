import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Settings,
  FileSpreadsheet,
  Users,
  Download,
  Loader2,
  FileText,
  DollarSign,
  Wand2,
  FileQuestion,
  AlertCircle,
  ListChecks,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TakeoffBuilder } from '@/components/takeoff/TakeoffBuilder';
import { LaborEstimator } from '@/components/labor/LaborEstimator';
import { PlanFilesManager } from '@/components/plans/PlanFilesManager';
import { ProjectSettings } from '@/components/project/ProjectSettings';
import { GCWizard } from '@/components/wizard/GCWizard';
import { RFIsManager } from '@/components/wizard/RFIsManager';
import { AssumptionsManager } from '@/components/wizard/AssumptionsManager';
import { ChecklistManager } from '@/components/wizard/ChecklistManager';
import { formatCurrency } from '@/lib/constants';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('wizard');
  const [showWizard, setShowWizard] = useState(false);

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

  const { data: takeoffItems } = useQuery({
    queryKey: ['takeoff-items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('takeoff_items')
        .select('*')
        .eq('project_id', id)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: laborEstimates } = useQuery({
    queryKey: ['labor-estimates', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_estimates')
        .select('*, labor_line_items(*)')
        .eq('project_id', id);
      if (error) throw error;
      return data;
    },
  });

  const { data: rfis } = useQuery({
    queryKey: ['rfis', id],
    queryFn: async () => {
      const { data } = await supabase.from('rfis').select('*').eq('project_id', id);
      return data || [];
    },
  });

  const { data: checklistItems } = useQuery({
    queryKey: ['checklist-items', id],
    queryFn: async () => {
      const { data } = await supabase.from('checklist_items').select('*').eq('project_id', id);
      return data || [];
    },
  });

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
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.address && <p className="text-muted-foreground">{project.address}</p>}
          </div>
          <Button variant="accent" onClick={() => setShowWizard(true)}>
            <Wand2 className="h-4 w-4 mr-2" />
            Run GC Wizard
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>

        {/* Wizard Modal */}
        {showWizard && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
              <GCWizard projectId={id!} onComplete={() => setShowWizard(false)} />
              <Button variant="ghost" onClick={() => setShowWizard(false)} className="mt-4 w-full">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Materials
              </CardDescription>
              <CardTitle className="text-2xl font-mono">{formatCurrency(materialTotal)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Labor
              </CardDescription>
              <CardTitle className="text-2xl font-mono">{formatCurrency(laborTotal)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={openRfis > 0 ? 'border-warning/50' : ''}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4" />
                Open RFIs
              </CardDescription>
              <CardTitle className="text-2xl">{openRfis}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Checklist
              </CardDescription>
              <CardTitle className="text-2xl">{pendingChecklist} pending</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="wizard" className="gap-2"><Wand2 className="h-4 w-4" />Wizard</TabsTrigger>
            <TabsTrigger value="rfis" className="gap-2"><FileQuestion className="h-4 w-4" />RFIs</TabsTrigger>
            <TabsTrigger value="assumptions" className="gap-2"><AlertCircle className="h-4 w-4" />Assumptions</TabsTrigger>
            <TabsTrigger value="checklist" className="gap-2"><ListChecks className="h-4 w-4" />Checklist</TabsTrigger>
            <TabsTrigger value="takeoff" className="gap-2"><FileSpreadsheet className="h-4 w-4" />Takeoff</TabsTrigger>
            <TabsTrigger value="labor" className="gap-2"><Users className="h-4 w-4" />Labor</TabsTrigger>
            <TabsTrigger value="plans" className="gap-2"><FileText className="h-4 w-4" />Plans</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" />Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="wizard">
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
          </TabsContent>
          <TabsContent value="rfis"><RFIsManager projectId={id!} /></TabsContent>
          <TabsContent value="assumptions"><AssumptionsManager projectId={id!} /></TabsContent>
          <TabsContent value="checklist"><ChecklistManager projectId={id!} /></TabsContent>
          <TabsContent value="takeoff"><TakeoffBuilder projectId={id!} project={project} /></TabsContent>
          <TabsContent value="labor"><LaborEstimator projectId={id!} project={project} /></TabsContent>
          <TabsContent value="plans"><PlanFilesManager projectId={id!} /></TabsContent>
          <TabsContent value="settings"><ProjectSettings project={project} /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

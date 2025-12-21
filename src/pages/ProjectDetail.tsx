import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Settings,
  FileSpreadsheet,
  Users,
  Upload,
  Plus,
  Download,
  Trash2,
  Loader2,
  FileText,
  DollarSign,
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
import { formatCurrency } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('takeoff');

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

  // Calculate totals
  const materialSubtotal = takeoffItems?.reduce(
    (sum, item) => sum + (Number(item.extended_cost) || 0),
    0
  ) || 0;
  const tax = materialSubtotal * ((project?.tax_percent || 0) / 100);
  const materialTotal = materialSubtotal + tax;

  const laborTotal = laborEstimates?.reduce(
    (sum, est) => sum + (Number(est.total) || 0),
    0
  ) || 0;

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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/projects')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.address && (
              <p className="text-muted-foreground">{project.address}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Material Takeoff
              </CardDescription>
              <CardTitle className="text-2xl font-mono">
                {formatCurrency(materialTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {takeoffItems?.length || 0} line items • {formatCurrency(tax)} tax
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Labor Estimates
              </CardDescription>
              <CardTitle className="text-2xl font-mono">
                {formatCurrency(laborTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {laborEstimates?.length || 0} estimates
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Project Total
              </CardDescription>
              <CardTitle className="text-2xl font-mono text-accent">
                {formatCurrency(materialTotal + laborTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Materials + Labor
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="takeoff" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Takeoff
            </TabsTrigger>
            <TabsTrigger value="labor" className="gap-2">
              <Users className="h-4 w-4" />
              Labor
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <FileText className="h-4 w-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="takeoff" className="space-y-4">
            <TakeoffBuilder projectId={id!} project={project} />
          </TabsContent>

          <TabsContent value="labor" className="space-y-4">
            <LaborEstimator projectId={id!} project={project} />
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            <PlanFilesManager projectId={id!} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <ProjectSettings project={project} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

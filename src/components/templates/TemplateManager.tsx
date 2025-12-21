import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileSpreadsheet, 
  Loader2, 
  Plus, 
  ArrowRight, 
  Trash2,
  Save 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Template {
  id: string;
  type: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_by: string | null;
}

const templateIcons: Record<string, string> = {
  basement_finish: '🏠',
  kitchen_remodel: '🍳',
  bathroom_remodel: '🚿',
  deck_build: '🪵',
  addition: '🏗️',
  restaurant_remodel: '🍽️',
  default: '📋',
};

interface TemplateManagerProps {
  onApplyTemplate?: (templateId: string) => void;
  projectId?: string;
}

export function TemplateManager({ onApplyTemplate, projectId }: TemplateManagerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateType, setNewTemplateType] = useState('custom');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as Template[];
    },
  });

  // Fetch project data for saving as template
  const { data: projectData } = useQuery({
    queryKey: ['project-for-template', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const [{ data: project }, { data: takeoffItems }, { data: assemblies }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('takeoff_items').select('*').eq('project_id', projectId).eq('draft', false),
        supabase.from('assemblies').select('*'),
      ]);

      return { project, takeoffItems, assemblies };
    },
    enabled: !!projectId,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in');

      // Create template
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .insert({
          name: newTemplateName,
          description: newTemplateDescription,
          type: newTemplateType,
          is_system: false,
          created_by: user.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // If we have project data, save items as template items
      if (projectData?.takeoffItems) {
        const templateItems = projectData.takeoffItems.map((item, index) => ({
          template_id: template.id,
          kind: 'takeoff_item',
          sort_order: index,
          payload: {
            category: item.category,
            description: item.description,
            unit: item.unit,
            waste_percent: item.waste_percent,
            spec: item.spec,
          },
        }));

        if (templateItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('template_items')
            .insert(templateItems);

          if (itemsError) throw itemsError;
        }
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowCreateDialog(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      toast({ title: 'Template saved successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error saving template', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // Delete template items first
      await supabase.from('template_items').delete().eq('template_id', templateId);
      
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({ title: 'Template deleted' });
    },
    onError: (error) => {
      toast({ title: 'Error deleting template', description: error.message, variant: 'destructive' });
    },
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!projectId) throw new Error('No project selected');

      // Fetch template items
      const { data: templateItems, error } = await supabase
        .from('template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order');

      if (error) throw error;

      // Create takeoff items from template
      const takeoffItems = templateItems
        .filter((ti) => ti.kind === 'takeoff_item')
        .map((ti, index) => {
          const payload = ti.payload as Record<string, unknown>;
          return {
            project_id: projectId,
            category: payload.category as string,
            description: payload.description as string,
            unit: (payload.unit as string) || 'EA',
            waste_percent: (payload.waste_percent as number) || 10,
            spec: payload.spec as string | null,
            quantity: 0,
            draft: true,
            sort_order: index,
          };
        });

      if (takeoffItems.length > 0) {
        const { error: insertError } = await supabase
          .from('takeoff_items')
          .insert(takeoffItems);

        if (insertError) throw insertError;
      }

      return takeoffItems.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
      toast({ title: `Applied template: ${count} items added as drafts` });
      onApplyTemplate?.('');
    },
    onError: (error) => {
      toast({ title: 'Error applying template', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const systemTemplates = templates.filter((t) => t.is_system);
  const userTemplates = templates.filter((t) => !t.is_system);

  return (
    <div className="space-y-6">
      {/* Save as Template - only show if in project context */}
      {projectId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Save Current Project as Template</CardTitle>
            <CardDescription>
              Create a reusable template from this project's takeoff items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save as Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Template</DialogTitle>
                  <DialogDescription>
                    Save this project's takeoff structure as a reusable template
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium">Template Name</label>
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g., Basement Finish - Standard"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                      placeholder="Describe what this template includes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createTemplateMutation.mutate()}
                    disabled={!newTemplateName.trim() || createTemplateMutation.isPending}
                  >
                    {createTemplateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* System Templates */}
      {systemTemplates.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Starter Templates
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systemTemplates.map((template) => (
              <Card key={template.id} className="group">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">
                      {templateIcons[template.type] || templateIcons.default}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {template.description || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => applyTemplateMutation.mutate(template.id)}
                    disabled={!projectId || applyTemplateMutation.isPending}
                  >
                    Apply Template
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* User Templates */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          My Templates
        </h3>
        {userTemplates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No custom templates yet. Save a project as a template to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userTemplates.map((template) => (
              <Card key={template.id} className="group">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">
                      {templateIcons[template.type] || templateIcons.default}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {template.description || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => applyTemplateMutation.mutate(template.id)}
                      disabled={!projectId || applyTemplateMutation.isPending}
                    >
                      Apply
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete template?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{template.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTemplateMutation.mutate(template.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { REGIONS } from '@/lib/constants';

interface Project {
  id: string;
  name: string;
  address: string | null;
  region: string | null;
  tax_percent: number | null;
  waste_percent: number | null;
  markup_percent: number | null;
  labor_burden_percent: number | null;
  currency: string | null;
  status: string | null;
}

interface ProjectSettingsProps {
  project: Project;
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Project>) => {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', project.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      toast({ title: 'Settings saved' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleChange = (field: keyof Project, value: string | number) => {
    updateMutation.mutate({ [field]: value });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>Basic details about this project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              defaultValue={project.name}
              onBlur={(e) => handleChange('name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              defaultValue={project.address || ''}
              onBlur={(e) => handleChange('address', e.target.value)}
              placeholder="123 Main St, City, State"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Select
              defaultValue={project.region || 'Rhode Island'}
              onValueChange={(value) => handleChange('region', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Project Defaults</CardTitle>
          <CardDescription>
            Default values applied to new takeoff items and labor calculations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax_percent">Tax Rate (%)</Label>
              <Input
                id="tax_percent"
                type="number"
                step="0.01"
                defaultValue={project.tax_percent || 0}
                onBlur={(e) => handleChange('tax_percent', Number(e.target.value))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waste_percent">Default Waste Factor (%)</Label>
              <Input
                id="waste_percent"
                type="number"
                step="0.01"
                defaultValue={project.waste_percent || 0}
                onBlur={(e) => handleChange('waste_percent', Number(e.target.value))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="markup_percent">Markup (%)</Label>
              <Input
                id="markup_percent"
                type="number"
                step="0.01"
                defaultValue={project.markup_percent || 0}
                onBlur={(e) => handleChange('markup_percent', Number(e.target.value))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labor_burden_percent">Labor Burden (%)</Label>
              <Input
                id="labor_burden_percent"
                type="number"
                step="0.01"
                defaultValue={project.labor_burden_percent || 0}
                onBlur={(e) => handleChange('labor_burden_percent', Number(e.target.value))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Includes workers comp, taxes, insurance, etc.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Project Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            defaultValue={project.status || 'active'}
            onValueChange={(value) => handleChange('status', value)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {updateMutation.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
}

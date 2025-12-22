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
  site_access: string | null;
  site_occupancy: string | null;
  site_parking: string | null;
}

// Site condition multipliers
const SITE_ACCESS_OPTIONS = [
  { value: 'ground_level', label: 'Ground Level', multiplier: 1.0 },
  { value: 'stairs_only', label: 'Stairs Only (No Elevator)', multiplier: 1.15 },
  { value: 'elevator', label: 'Elevator Available', multiplier: 1.05 },
];

const SITE_OCCUPANCY_OPTIONS = [
  { value: 'vacant', label: 'Vacant', multiplier: 1.0 },
  { value: 'occupied', label: 'Occupied/Furnished', multiplier: 1.15 },
];

const SITE_PARKING_OPTIONS = [
  { value: 'driveway', label: 'Driveway/Lot', multiplier: 1.0 },
  { value: 'street', label: 'Street/Paid Parking', multiplier: 1.10 },
];

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

      {/* Site Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Site Conditions</CardTitle>
          <CardDescription>
            Real-world factors that affect labor costs. The AI will automatically apply these multipliers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="site_access">Access</Label>
              <Select
                defaultValue={project.site_access || 'ground_level'}
                onValueChange={(value) => handleChange('site_access' as keyof Project, value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITE_ACCESS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} ({option.multiplier}x)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                4th floor walk-up = +15% labor
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site_occupancy">Occupancy</Label>
              <Select
                defaultValue={project.site_occupancy || 'vacant'}
                onValueChange={(value) => handleChange('site_occupancy' as keyof Project, value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITE_OCCUPANCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} ({option.multiplier}x)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Working around furniture = +15% labor
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site_parking">Parking</Label>
              <Select
                defaultValue={project.site_parking || 'driveway'}
                onValueChange={(value) => handleChange('site_parking' as keyof Project, value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITE_PARKING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} ({option.multiplier}x)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Street parking = +10% labor
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">
              Combined Site Multiplier: {(
                (SITE_ACCESS_OPTIONS.find(o => o.value === (project.site_access || 'ground_level'))?.multiplier || 1) *
                (SITE_OCCUPANCY_OPTIONS.find(o => o.value === (project.site_occupancy || 'vacant'))?.multiplier || 1) *
                (SITE_PARKING_OPTIONS.find(o => o.value === (project.site_parking || 'driveway'))?.multiplier || 1)
              ).toFixed(2)}x
            </p>
            <p className="text-xs text-muted-foreground">
              All labor estimates will be automatically adjusted by this factor
            </p>
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

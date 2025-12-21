import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Ruler, 
  Hash, 
  Square, 
  Plus, 
  ChevronRight,
  Loader2,
  Check,
  Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { TAKEOFF_CATEGORIES, UNITS } from '@/lib/constants';

interface GuidedTakeoffProps {
  projectId: string;
  planFileId: string;
  planFileName: string;
  onClose: () => void;
}

interface CountEntry {
  description: string;
  count: number;
  category: string;
}

interface MeasurementEntry {
  description: string;
  value: number;
  unit: string;
  category: string;
}

const COMMON_COUNTS = [
  { label: 'Interior Doors', category: 'Doors - Interior' },
  { label: 'Exterior Doors', category: 'Doors - Exterior' },
  { label: 'Windows', category: 'Windows' },
  { label: 'Rooms', category: 'Drywall' },
  { label: 'Electrical Outlets', category: 'Electrical' },
  { label: 'Light Fixtures', category: 'Electrical' },
  { label: 'Plumbing Fixtures', category: 'Plumbing' },
  { label: 'HVAC Registers', category: 'HVAC' },
  { label: 'Stairs (flights)', category: 'Framing - Lumber' },
  { label: 'Posts/Columns', category: 'Framing - Lumber' },
];

const COMMON_MEASUREMENTS = [
  { label: 'Wall Length (total LF)', unit: 'LF', category: 'Framing - Lumber' },
  { label: 'Exterior Wall LF', unit: 'LF', category: 'Siding' },
  { label: 'Baseboard LF', unit: 'LF', category: 'Trim - Baseboard' },
  { label: 'Crown Molding LF', unit: 'LF', category: 'Trim - Crown' },
  { label: 'Door Casing LF', unit: 'LF', category: 'Trim - Casing' },
  { label: 'Soffit LF', unit: 'LF', category: 'Framing - Lumber' },
  { label: 'Ridge LF', unit: 'LF', category: 'Roofing' },
  { label: 'Eave LF', unit: 'LF', category: 'Roofing' },
  { label: 'Deck Perimeter LF', unit: 'LF', category: 'Framing - Lumber' },
];

const COMMON_AREAS = [
  { label: 'Wall Area', unit: 'SF', category: 'Drywall' },
  { label: 'Ceiling Area', unit: 'SF', category: 'Drywall' },
  { label: 'Floor Area', unit: 'SF', category: 'Flooring' },
  { label: 'Roof Area', unit: 'SF', category: 'Roofing' },
  { label: 'Siding Area', unit: 'SF', category: 'Siding' },
  { label: 'Deck Area', unit: 'SF', category: 'Framing - Lumber' },
  { label: 'Paint Area (walls)', unit: 'SF', category: 'Paint' },
  { label: 'Tile Area', unit: 'SF', category: 'Flooring' },
];

export function GuidedTakeoff({ projectId, planFileId, planFileName, onClose }: GuidedTakeoffProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [counts, setCounts] = useState<Record<string, CountEntry>>({});
  const [measurements, setMeasurements] = useState<Record<string, MeasurementEntry>>({});
  const [areas, setAreas] = useState<Record<string, MeasurementEntry>>({});
  const [customItems, setCustomItems] = useState<{
    description: string;
    value: number;
    unit: string;
    category: string;
  }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      
      const takeoffItems: {
        project_id: string;
        plan_file_id: string;
        category: string;
        description: string;
        unit: string;
        quantity: number;
        notes: string;
        draft: boolean;
      }[] = [];

      // Add counts
      Object.entries(counts).forEach(([key, entry]) => {
        if (entry.count > 0) {
          takeoffItems.push({
            project_id: projectId,
            plan_file_id: planFileId,
            category: entry.category,
            description: entry.description,
            unit: 'EA',
            quantity: entry.count,
            notes: `From guided takeoff: ${planFileName}`,
            draft: true,
          });
        }
      });

      // Add measurements
      Object.entries(measurements).forEach(([key, entry]) => {
        if (entry.value > 0) {
          takeoffItems.push({
            project_id: projectId,
            plan_file_id: planFileId,
            category: entry.category,
            description: entry.description,
            unit: entry.unit,
            quantity: entry.value,
            notes: `From guided takeoff: ${planFileName}`,
            draft: true,
          });
        }
      });

      // Add areas
      Object.entries(areas).forEach(([key, entry]) => {
        if (entry.value > 0) {
          takeoffItems.push({
            project_id: projectId,
            plan_file_id: planFileId,
            category: entry.category,
            description: entry.description,
            unit: entry.unit,
            quantity: entry.value,
            notes: `From guided takeoff: ${planFileName}`,
            draft: true,
          });
        }
      });

      // Add custom items
      customItems.forEach((item) => {
        if (item.value > 0 && item.description) {
          takeoffItems.push({
            project_id: projectId,
            plan_file_id: planFileId,
            category: item.category,
            description: item.description,
            unit: item.unit,
            quantity: item.value,
            notes: `From guided takeoff: ${planFileName}`,
            draft: true,
          });
        }
      });

      if (takeoffItems.length === 0) {
        throw new Error('No items to add. Enter at least one count or measurement.');
      }

      const { error } = await supabase.from('takeoff_items').insert(takeoffItems);
      if (error) throw error;

      return takeoffItems.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
      toast({
        title: 'Guided takeoff complete',
        description: `Added ${count} draft items linked to ${planFileName}`,
      });
      setIsSubmitting(false);
      onClose();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setIsSubmitting(false);
    },
  });

  const updateCount = (key: string, label: string, category: string, value: number) => {
    setCounts({
      ...counts,
      [key]: { description: label, count: value, category },
    });
  };

  const updateMeasurement = (key: string, label: string, unit: string, category: string, value: number) => {
    setMeasurements({
      ...measurements,
      [key]: { description: label, value, unit, category },
    });
  };

  const updateArea = (key: string, label: string, unit: string, category: string, value: number) => {
    setAreas({
      ...areas,
      [key]: { description: label, value, unit, category },
    });
  };

  const addCustomItem = () => {
    setCustomItems([
      ...customItems,
      { description: '', value: 0, unit: 'EA', category: 'Misc' },
    ]);
  };

  const totalItems = 
    Object.values(counts).filter(c => c.count > 0).length +
    Object.values(measurements).filter(m => m.value > 0).length +
    Object.values(areas).filter(a => a.value > 0).length +
    customItems.filter(i => i.value > 0 && i.description).length;

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="h-5 w-5 text-accent" />
          Guided Takeoff
        </CardTitle>
        <CardDescription>
          Enter counts and measurements for <strong>{planFileName}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="counts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="counts" className="gap-2">
              <Hash className="h-4 w-4" />
              Counts
            </TabsTrigger>
            <TabsTrigger value="linear" className="gap-2">
              <Ruler className="h-4 w-4" />
              Linear
            </TabsTrigger>
            <TabsTrigger value="area" className="gap-2">
              <Square className="h-4 w-4" />
              Area
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <Package className="h-4 w-4" />
              Custom
            </TabsTrigger>
          </TabsList>

          <TabsContent value="counts" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Count items visible on this sheet. Empty fields will be skipped.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {COMMON_COUNTS.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <Label className="flex-1 text-sm">{item.label}</Label>
                  <Input
                    type="number"
                    min="0"
                    className="w-20 text-right font-mono"
                    value={counts[item.label]?.count || ''}
                    onChange={(e) =>
                      updateCount(item.label, item.label, item.category, Number(e.target.value) || 0)
                    }
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="linear" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter linear measurements in feet. Empty fields will be skipped.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {COMMON_MEASUREMENTS.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <Label className="flex-1 text-sm">{item.label}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    className="w-24 text-right font-mono"
                    value={measurements[item.label]?.value || ''}
                    onChange={(e) =>
                      updateMeasurement(item.label, item.label, item.unit, item.category, Number(e.target.value) || 0)
                    }
                  />
                  <span className="text-xs text-muted-foreground w-6">{item.unit}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="area" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter area measurements in square feet. Empty fields will be skipped.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {COMMON_AREAS.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <Label className="flex-1 text-sm">{item.label}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    className="w-24 text-right font-mono"
                    value={areas[item.label]?.value || ''}
                    onChange={(e) =>
                      updateArea(item.label, item.label, item.unit, item.category, Number(e.target.value) || 0)
                    }
                  />
                  <span className="text-xs text-muted-foreground w-6">{item.unit}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add custom items not covered by standard prompts.
            </p>
            
            {customItems.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-4 p-3 border rounded-lg">
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => {
                    const updated = [...customItems];
                    updated[index].description = e.target.value;
                    setCustomItems(updated);
                  }}
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  className="font-mono"
                  value={item.value || ''}
                  onChange={(e) => {
                    const updated = [...customItems];
                    updated[index].value = Number(e.target.value) || 0;
                    setCustomItems(updated);
                  }}
                />
                <Select
                  value={item.unit}
                  onValueChange={(value) => {
                    const updated = [...customItems];
                    updated[index].unit = value;
                    setCustomItems(updated);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={item.category}
                  onValueChange={(value) => {
                    const updated = [...customItems];
                    updated[index].category = value;
                    setCustomItems(updated);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAKEOFF_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <Button variant="outline" onClick={addCustomItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Item
            </Button>
          </TabsContent>
        </Tabs>

        {/* Summary & Submit */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <div className="text-sm text-muted-foreground">
            {totalItems > 0 ? (
              <span className="font-medium text-foreground">{totalItems} items</span>
            ) : (
              'No items entered yet'
            )}
            {' will be added as draft takeoff items'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => submitMutation.mutate()}
              disabled={totalItems === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Add {totalItems} Items
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

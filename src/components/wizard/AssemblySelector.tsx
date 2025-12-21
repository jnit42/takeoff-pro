import { useQuery } from '@tanstack/react-query';
import { Package, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface AssemblyItem {
  description: string;
  formula: string;
  unit: string;
}

interface ChecklistItem {
  item: string;
  trade: string;
}

interface Assembly {
  id: string;
  name: string;
  description: string | null;
  trade: string;
  project_type: string;
  items: AssemblyItem[];
  checklist_items: ChecklistItem[];
}

interface AssemblySelectorProps {
  projectType: string;
  selectedAssemblies: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function AssemblySelector({ 
  projectType, 
  selectedAssemblies, 
  onSelectionChange 
}: AssemblySelectorProps) {
  const { data: assemblies = [], isLoading } = useQuery({
    queryKey: ['assemblies', projectType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assemblies')
        .select('*')
        .eq('project_type', projectType);
      
      if (error) throw error;
      
      return (data || []).map(a => ({
        ...a,
        items: (a.items as unknown as AssemblyItem[]) || [],
        checklist_items: (a.checklist_items as unknown as ChecklistItem[]) || [],
      })) as Assembly[];
    },
  });

  const toggleAssembly = (id: string) => {
    if (selectedAssemblies.includes(id)) {
      onSelectionChange(selectedAssemblies.filter(a => a !== id));
    } else {
      onSelectionChange([...selectedAssemblies, id]);
    }
  };

  const selectAll = () => {
    onSelectionChange(assemblies.map(a => a.id));
  };

  const selectNone = () => {
    onSelectionChange([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group assemblies by trade
  const byTrade = assemblies.reduce((acc, assembly) => {
    if (!acc[assembly.trade]) {
      acc[assembly.trade] = [];
    }
    acc[assembly.trade].push(assembly);
    return acc;
  }, {} as Record<string, Assembly[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-accent" />
          <span className="font-medium">Select Assemblies</span>
        </div>
        <div className="flex gap-2 text-sm">
          <button onClick={selectAll} className="text-accent hover:underline">
            Select All
          </button>
          <span className="text-muted-foreground">|</span>
          <button onClick={selectNone} className="text-muted-foreground hover:underline">
            Clear
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Choose which assemblies to include. Each assembly contains line items with formulas 
        that will generate takeoff items from your measurements.
      </p>

      {Object.entries(byTrade).map(([trade, tradeAssemblies]) => (
        <div key={trade} className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {trade}
          </h4>
          <div className="grid gap-2">
            {tradeAssemblies.map((assembly) => {
              const isSelected = selectedAssemblies.includes(assembly.id);
              return (
                <Card
                  key={assembly.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'border-accent bg-accent/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => toggleAssembly(assembly.id)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleAssembly(assembly.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{assembly.name}</span>
                          {isSelected && (
                            <Check className="h-4 w-4 text-accent" />
                          )}
                        </div>
                        {assembly.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {assembly.description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {assembly.items.length} items
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {assembly.checklist_items.length} checklist
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {assemblies.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            No assemblies found for this project type.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Loader2, Calculator, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { TAKEOFF_CATEGORIES, UNITS, formatCurrency, formatNumber } from '@/lib/constants';

interface TakeoffItem {
  id: string;
  category: string;
  description: string;
  spec: string | null;
  unit: string;
  quantity: number;
  waste_percent: number | null;
  adjusted_qty: number | null;
  package_size: number | null;
  packages: number | null;
  unit_cost: number | null;
  extended_cost: number | null;
  vendor: string | null;
  phase: string | null;
  notes: string | null;
  sort_order: number | null;
}

interface TakeoffBuilderProps {
  projectId: string;
  project: {
    waste_percent: number | null;
    tax_percent: number | null;
  };
}

export function TakeoffBuilder({ projectId, project }: TakeoffBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['takeoff-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('takeoff_items')
        .select('*')
        .eq('project_id', projectId)
        .order('category')
        .order('sort_order');

      if (error) throw error;
      return data as TakeoffItem[];
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (category: string) => {
      const { data, error } = await supabase
        .from('takeoff_items')
        .insert({
          project_id: projectId,
          category,
          description: 'New Item',
          unit: 'EA',
          quantity: 0,
          waste_percent: project.waste_percent || 10,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TakeoffItem> }) => {
      const { error } = await supabase
        .from('takeoff_items')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('takeoff_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
      toast({ title: 'Item deleted' });
    },
  });

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, TakeoffItem[]>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleInputChange = (
    id: string,
    field: keyof TakeoffItem,
    value: string | number
  ) => {
    const numericFields = ['quantity', 'waste_percent', 'package_size', 'unit_cost'];
    const finalValue = numericFields.includes(field) ? Number(value) || 0 : value;
    updateItemMutation.mutate({ id, updates: { [field]: finalValue } });
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (Number(item.extended_cost) || 0), 0);
  const tax = subtotal * ((project.tax_percent || 0) / 100);
  const total = subtotal + tax;

  // Calculate category totals
  const categoryTotals = Object.entries(itemsByCategory).reduce((acc, [cat, catItems]) => {
    acc[cat] = catItems.reduce((sum, item) => sum + (Number(item.extended_cost) || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Item Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Add Line Item</CardTitle>
          <CardDescription>Select a category to add a new takeoff item</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TAKEOFF_CATEGORIES.slice(0, 12).map((category) => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                onClick={() => {
                  addItemMutation.mutate(category);
                  setExpandedCategories(new Set([...expandedCategories, category]));
                }}
                disabled={addItemMutation.isPending}
              >
                <Plus className="h-3 w-3 mr-1" />
                {category}
              </Button>
            ))}
            <Select
              onValueChange={(value) => {
                addItemMutation.mutate(value);
                setExpandedCategories(new Set([...expandedCategories, value]));
              }}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="More..." />
              </SelectTrigger>
              <SelectContent>
                {TAKEOFF_CATEGORIES.slice(12).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Takeoff Table by Category */}
      {Object.keys(itemsByCategory).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No takeoff items yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Add your first line item by selecting a category above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(itemsByCategory).map(([category, catItems]) => (
            <Collapsible
              key={category}
              open={expandedCategories.has(category)}
              onOpenChange={() => toggleCategory(category)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${
                            expandedCategories.has(category) ? '' : '-rotate-90'
                          }`}
                        />
                        <div>
                          <CardTitle className="text-base">{category}</CardTitle>
                          <CardDescription>{catItems.length} items</CardDescription>
                        </div>
                      </div>
                      <span className="font-mono text-lg font-semibold">
                        {formatCurrency(categoryTotals[category])}
                      </span>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Description</TableHead>
                            <TableHead className="w-[100px]">Spec</TableHead>
                            <TableHead className="w-[80px]">Unit</TableHead>
                            <TableHead className="w-[80px] text-right">Qty</TableHead>
                            <TableHead className="w-[70px] text-right">Waste%</TableHead>
                            <TableHead className="w-[80px] text-right">Adj Qty</TableHead>
                            <TableHead className="w-[70px] text-right">Pkg Size</TableHead>
                            <TableHead className="w-[70px] text-right">Pkgs</TableHead>
                            <TableHead className="w-[90px] text-right">Unit $</TableHead>
                            <TableHead className="w-[100px] text-right">Extended</TableHead>
                            <TableHead className="w-[120px]">Vendor</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Input
                                  value={item.description}
                                  onChange={(e) =>
                                    handleInputChange(item.id, 'description', e.target.value)
                                  }
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.spec || ''}
                                  onChange={(e) =>
                                    handleInputChange(item.id, 'spec', e.target.value)
                                  }
                                  className="h-8"
                                  placeholder="..."
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={item.unit}
                                  onValueChange={(value) =>
                                    handleInputChange(item.id, 'unit', value)
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UNITS.map((unit) => (
                                      <SelectItem key={unit} value={unit}>
                                        {unit}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleInputChange(item.id, 'quantity', e.target.value)
                                  }
                                  className="h-8 text-right font-mono"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.waste_percent || 0}
                                  onChange={(e) =>
                                    handleInputChange(item.id, 'waste_percent', e.target.value)
                                  }
                                  className="h-8 text-right font-mono"
                                />
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                {formatNumber(item.adjusted_qty || 0, 2)}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.package_size || 1}
                                  onChange={(e) =>
                                    handleInputChange(item.id, 'package_size', e.target.value)
                                  }
                                  className="h-8 text-right font-mono"
                                />
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                {item.packages || 0}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.unit_cost || 0}
                                  onChange={(e) =>
                                    handleInputChange(item.id, 'unit_cost', e.target.value)
                                  }
                                  className="h-8 text-right font-mono"
                                />
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                {formatCurrency(item.extended_cost || 0)}
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.vendor || ''}
                                  onChange={(e) =>
                                    handleInputChange(item.id, 'vendor', e.target.value)
                                  }
                                  className="h-8"
                                  placeholder="..."
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Summary */}
      {items.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({project.tax_percent || 0}%)
                  </span>
                  <span className="font-mono">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total</span>
                  <span className="font-mono text-accent">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Users, Calculator, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { LABOR_MODIFIERS, formatCurrency, formatNumber } from '@/lib/constants';

interface LaborTask {
  id: string;
  name: string;
  trade: string;
  unit: string;
  base_rate: number;
  min_rate: number | null;
  max_rate: number | null;
  notes: string | null;
}

interface LaborLineItem {
  id: string;
  labor_estimate_id: string;
  labor_task_id: string | null;
  task_name: string;
  quantity: number;
  unit: string;
  base_rate: number;
  modifiers: Record<string, number>;
  modifier_multiplier: number;
  final_rate: number | null;
  extended: number | null;
  notes: string | null;
}

interface LaborEstimate {
  id: string;
  project_id: string;
  subcontractor_name: string | null;
  total: number | null;
  labor_line_items: LaborLineItem[];
}

interface LaborEstimatorProps {
  projectId: string;
  project: {
    labor_burden_percent: number | null;
  };
}

export function LaborEstimator({ projectId, project }: LaborEstimatorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<LaborTask | null>(null);
  const [newTaskQty, setNewTaskQty] = useState(0);
  const [newTaskModifiers, setNewTaskModifiers] = useState<Record<string, number>>({
    accessDifficulty: 1.0,
    ceilingHeight: 1.0,
    existingConditions: 1.0,
    scheduleConstraints: 1.0,
    travel: 1.0,
    smallJobFactor: 1.0,
  });

  const { data: laborTasks = [] } = useQuery({
    queryKey: ['labor-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_tasks')
        .select('*')
        .order('trade')
        .order('name');

      if (error) throw error;
      return data as LaborTask[];
    },
  });

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ['labor-estimates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_estimates')
        .select('*, labor_line_items(*)')
        .eq('project_id', projectId);

      if (error) throw error;
      return data as LaborEstimate[];
    },
  });

  // Get or create estimate
  const getOrCreateEstimate = async () => {
    if (estimates.length > 0) return estimates[0];

    const { data, error } = await supabase
      .from('labor_estimates')
      .insert({ project_id: projectId })
      .select('*, labor_line_items(*)')
      .single();

    if (error) throw error;
    return data as LaborEstimate;
  };

  const addLineItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask) return;

      const estimate = await getOrCreateEstimate();
      const modifierMultiplier = Object.values(newTaskModifiers).reduce((a, b) => a * b, 1);

      const { error } = await supabase.from('labor_line_items').insert({
        labor_estimate_id: estimate.id,
        labor_task_id: selectedTask.id,
        task_name: selectedTask.name,
        quantity: newTaskQty,
        unit: selectedTask.unit,
        base_rate: selectedTask.base_rate,
        modifiers: newTaskModifiers,
        modifier_multiplier: modifierMultiplier,
      });

      if (error) throw error;

      // Update estimate total
      await updateEstimateTotal(estimate.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-estimates', projectId] });
      setIsAddingTask(false);
      setSelectedTask(null);
      setNewTaskQty(0);
      setNewTaskModifiers({
        accessDifficulty: 1.0,
        ceilingHeight: 1.0,
        existingConditions: 1.0,
        scheduleConstraints: 1.0,
        travel: 1.0,
        smallJobFactor: 1.0,
      });
      toast({ title: 'Task added' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateEstimateTotal = async (estimateId: string) => {
    const { data: items } = await supabase
      .from('labor_line_items')
      .select('extended')
      .eq('labor_estimate_id', estimateId);

    const total = items?.reduce((sum, item) => sum + (Number(item.extended) || 0), 0) || 0;

    await supabase
      .from('labor_estimates')
      .update({ total })
      .eq('id', estimateId);
  };

  const deleteLineItemMutation = useMutation({
    mutationFn: async ({ itemId, estimateId }: { itemId: string; estimateId: string }) => {
      const { error } = await supabase.from('labor_line_items').delete().eq('id', itemId);
      if (error) throw error;
      await updateEstimateTotal(estimateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-estimates', projectId] });
      toast({ title: 'Task removed' });
    },
  });

  const calculateModifierMultiplier = () => {
    return Object.values(newTaskModifiers).reduce((a, b) => a * b, 1);
  };

  const tasksByTrade = laborTasks.reduce((acc, task) => {
    if (!acc[task.trade]) acc[task.trade] = [];
    acc[task.trade].push(task);
    return acc;
  }, {} as Record<string, LaborTask[]>);

  const estimate = estimates[0];
  const lineItems = estimate?.labor_line_items || [];
  const total = lineItems.reduce((sum, item) => sum + (Number(item.extended) || 0), 0);
  const burdenTotal = total * (1 + (project.labor_burden_percent || 0) / 100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Task Dialog */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Labor Pricing</CardTitle>
          <CardDescription>
            Add labor tasks with complexity modifiers for fair subcontractor pricing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
            <DialogTrigger asChild>
              <Button variant="accent">
                <Plus className="h-4 w-4 mr-2" />
                Add Labor Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Labor Task</DialogTitle>
                <DialogDescription>
                  Select a task and adjust modifiers for job-specific conditions
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Task Selection */}
                <div className="space-y-2">
                  <Label>Select Task</Label>
                  <Select
                    value={selectedTask?.id || ''}
                    onValueChange={(id) => {
                      const task = laborTasks.find((t) => t.id === id);
                      setSelectedTask(task || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a task..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(tasksByTrade).map(([trade, tasks]) => (
                        <div key={trade}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {trade}
                          </div>
                          {tasks.map((task) => (
                            <SelectItem key={task.id} value={task.id}>
                              {task.name} ({formatCurrency(task.base_rate)}/{task.unit})
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTask && (
                  <>
                    {/* Task Info */}
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Base Rate</span>
                            <p className="font-mono font-semibold">
                              {formatCurrency(selectedTask.base_rate)}/{selectedTask.unit}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Min</span>
                            <p className="font-mono">
                              {formatCurrency(selectedTask.min_rate || 0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Max</span>
                            <p className="font-mono">
                              {formatCurrency(selectedTask.max_rate || 0)}
                            </p>
                          </div>
                        </div>
                        {selectedTask.notes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {selectedTask.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Quantity */}
                    <div className="space-y-2">
                      <Label>Quantity ({selectedTask.unit})</Label>
                      <Input
                        type="number"
                        value={newTaskQty}
                        onChange={(e) => setNewTaskQty(Number(e.target.value) || 0)}
                        className="font-mono"
                      />
                    </div>

                    {/* Modifiers */}
                    <div className="space-y-4">
                      <Label>Job Condition Modifiers</Label>
                      {Object.entries(LABOR_MODIFIERS).map(([key, modifier]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{modifier.label}</span>
                            <span className="text-sm font-mono text-accent">
                              x{newTaskModifiers[key].toFixed(2)}
                            </span>
                          </div>
                          <Select
                            value={String(newTaskModifiers[key])}
                            onValueChange={(value) =>
                              setNewTaskModifiers({
                                ...newTaskModifiers,
                                [key]: Number(value),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {modifier.options.map((opt) => (
                                <SelectItem key={opt.value} value={String(opt.value)}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>

                    {/* Calculation Preview */}
                    <Card className="bg-accent/10 border-accent/20">
                      <CardContent className="pt-4">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span>Base Rate</span>
                            <span className="font-mono">
                              {formatCurrency(selectedTask.base_rate)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Modifier Multiplier</span>
                            <span className="font-mono">
                              x{calculateModifierMultiplier().toFixed(4)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Adjusted Rate</span>
                            <span className="font-mono">
                              {formatCurrency(
                                selectedTask.base_rate * calculateModifierMultiplier()
                              )}/{selectedTask.unit}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                            <span>Extended ({formatNumber(newTaskQty)} {selectedTask.unit})</span>
                            <span className="font-mono text-accent">
                              {formatCurrency(
                                newTaskQty *
                                  selectedTask.base_rate *
                                  calculateModifierMultiplier()
                              )}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingTask(false)}>
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  onClick={() => addLineItemMutation.mutate()}
                  disabled={!selectedTask || newTaskQty <= 0 || addLineItemMutation.isPending}
                >
                  {addLineItemMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Add Task'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Line Items Table */}
      {lineItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No labor tasks yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Add labor tasks to build your subcontractor pay sheet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Labor Pay Sheet</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {/* Mobile card layout */}
            <div className="sm:hidden space-y-2 p-4">
              {lineItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm">{item.task_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => estimate && deleteLineItemMutation.mutate({ itemId: item.id, estimateId: estimate.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block">Qty</span>
                      <span className="font-mono text-foreground">{formatNumber(item.quantity)} {item.unit}</span>
                    </div>
                    <div>
                      <span className="block">Rate</span>
                      <span className="font-mono text-foreground">{formatCurrency(item.final_rate || 0)}</span>
                    </div>
                    <div className="text-right">
                      <span className="block">Extended</span>
                      <span className="font-mono font-semibold text-accent">{formatCurrency(item.extended || 0)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-accent mt-1">
                    x{item.modifier_multiplier.toFixed(2)} modifier
                  </div>
                </div>
              ))}
            </div>
            
            {/* Desktop table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Base Rate</TableHead>
                    <TableHead className="text-right">Modifier</TableHead>
                    <TableHead className="text-right">Adj Rate</TableHead>
                    <TableHead className="text-right">Extended</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.task_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(item.quantity)}
                      </TableCell>
                      <TableCell className="text-right">{item.unit}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.base_rate)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-accent">
                        x{item.modifier_multiplier.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.final_rate || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(item.extended || 0)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          deleteLineItemMutation.mutate({
                            itemId: item.id,
                            estimateId: estimate.id,
                          })
                        }
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

            {/* Summary - responsive */}
            <div className="flex justify-center sm:justify-end mt-4 sm:mt-6 px-4 sm:px-0">
              <div className="w-full sm:w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Labor Subtotal</span>
                  <span className="font-mono">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    + Burden ({project.labor_burden_percent || 0}%)
                  </span>
                  <span className="font-mono">
                    {formatCurrency(total * ((project.labor_burden_percent || 0) / 100))}
                  </span>
                </div>
                <div className="flex justify-between text-base sm:text-lg font-semibold border-t pt-2">
                  <span>Total Labor Cost</span>
                  <span className="font-mono text-accent">{formatCurrency(burdenTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

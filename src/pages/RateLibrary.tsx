import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, DollarSign, Edit, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { TRADES, UNITS, formatCurrency } from '@/lib/constants';

interface LaborTask {
  id: string;
  name: string;
  trade: string;
  unit: string;
  base_rate: number;
  min_rate: number | null;
  max_rate: number | null;
  notes: string | null;
  is_system: boolean;
}

export default function RateLibrary() {
  const [search, setSearch] = useState('');
  const [filterTrade, setFilterTrade] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LaborTask | null>(null);
  const [newTask, setNewTask] = useState({
    name: '',
    trade: 'Drywall',
    unit: 'SF',
    base_rate: 0,
    min_rate: 0,
    max_rate: 0,
    notes: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async (task: typeof newTask) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('labor_tasks').insert({
        ...task,
        is_system: false,
        created_by: user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-tasks'] });
      setIsAddOpen(false);
      setNewTask({
        name: '',
        trade: 'Drywall',
        unit: 'SF',
        base_rate: 0,
        min_rate: 0,
        max_rate: 0,
        notes: '',
      });
      toast({ title: 'Task created' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (task: LaborTask) => {
      const { error } = await supabase
        .from('labor_tasks')
        .update({
          name: task.name,
          trade: task.trade,
          unit: task.unit,
          base_rate: task.base_rate,
          min_rate: task.min_rate,
          max_rate: task.max_rate,
          notes: task.notes,
        })
        .eq('id', task.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-tasks'] });
      setEditingTask(null);
      toast({ title: 'Task updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('labor_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-tasks'] });
      toast({ title: 'Task deleted' });
    },
  });

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(search.toLowerCase()) ||
      task.trade.toLowerCase().includes(search.toLowerCase());
    const matchesTrade = filterTrade === 'all' || task.trade === filterTrade;
    return matchesSearch && matchesTrade;
  });

  const uniqueTrades = [...new Set(tasks.map((t) => t.trade))].sort();

  const TaskForm = ({
    task,
    onSubmit,
    submitLabel,
    isLoading,
  }: {
    task: typeof newTask;
    onSubmit: () => void;
    submitLabel: string;
    isLoading: boolean;
  }) => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Task Name</Label>
        <Input
          value={task.name}
          onChange={(e) =>
            editingTask
              ? setEditingTask({ ...editingTask, name: e.target.value })
              : setNewTask({ ...newTask, name: e.target.value })
          }
          placeholder="e.g., Hang 1/2 drywall - walls"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Trade</Label>
          <Select
            value={task.trade}
            onValueChange={(value) =>
              editingTask
                ? setEditingTask({ ...editingTask, trade: value })
                : setNewTask({ ...newTask, trade: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRADES.map((trade) => (
                <SelectItem key={trade} value={trade}>
                  {trade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Unit</Label>
          <Select
            value={task.unit}
            onValueChange={(value) =>
              editingTask
                ? setEditingTask({ ...editingTask, unit: value })
                : setNewTask({ ...newTask, unit: value })
            }
          >
            <SelectTrigger>
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
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Base Rate ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={task.base_rate}
            onChange={(e) =>
              editingTask
                ? setEditingTask({ ...editingTask, base_rate: Number(e.target.value) })
                : setNewTask({ ...newTask, base_rate: Number(e.target.value) })
            }
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>Min Rate ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={task.min_rate || 0}
            onChange={(e) =>
              editingTask
                ? setEditingTask({ ...editingTask, min_rate: Number(e.target.value) })
                : setNewTask({ ...newTask, min_rate: Number(e.target.value) })
            }
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>Max Rate ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={task.max_rate || 0}
            onChange={(e) =>
              editingTask
                ? setEditingTask({ ...editingTask, max_rate: Number(e.target.value) })
                : setNewTask({ ...newTask, max_rate: Number(e.target.value) })
            }
            className="font-mono"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Input
          value={task.notes || ''}
          onChange={(e) =>
            editingTask
              ? setEditingTask({ ...editingTask, notes: e.target.value })
              : setNewTask({ ...newTask, notes: e.target.value })
          }
          placeholder="Additional details..."
        />
      </div>
      <DialogFooter className="pt-4">
        <Button
          variant="outline"
          onClick={() => (editingTask ? setEditingTask(null) : setIsAddOpen(false))}
        >
          Cancel
        </Button>
        <Button variant="accent" onClick={onSubmit} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Rate Library</h1>
            <p className="text-muted-foreground mt-1">
              Manage labor task rates for subcontractor pricing
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="accent" size="lg">
                <Plus className="h-5 w-5" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Labor Task</DialogTitle>
                <DialogDescription>
                  Create a new task with base rates for labor pricing
                </DialogDescription>
              </DialogHeader>
              <TaskForm
                task={newTask}
                onSubmit={() => createMutation.mutate(newTask)}
                submitLabel="Create Task"
                isLoading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterTrade} onValueChange={setFilterTrade}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by trade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trades</SelectItem>
              {uniqueTrades.map((trade) => (
                <SelectItem key={trade} value={trade}>
                  {trade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tasks Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No tasks found</h3>
              <p className="text-muted-foreground">
                {search || filterTrade !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first labor task to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead className="text-center">Unit</TableHead>
                  <TableHead className="text-right">Base Rate</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                        {task.trade}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{task.unit}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(task.base_rate)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(task.min_rate || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(task.max_rate || 0)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {task.notes || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Dialog
                          open={editingTask?.id === task.id}
                          onOpenChange={(open) => !open && setEditingTask(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEditingTask(task)}
                              disabled={task.is_system}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Labor Task</DialogTitle>
                            </DialogHeader>
                            {editingTask && (
                              <TaskForm
                                task={editingTask}
                                onSubmit={() => updateMutation.mutate(editingTask)}
                                submitLabel="Save Changes"
                                isLoading={updateMutation.isPending}
                              />
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => deleteMutation.mutate(task.id)}
                          disabled={task.is_system}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

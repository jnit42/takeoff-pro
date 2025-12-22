/**
 * Library - Combined Rate Library + Templates in one page
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, FileSpreadsheet } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

// Import the content from existing pages (we'll inline them)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

interface Template {
  id: string;
  type: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

const templateIcons: Record<string, string> = {
  basement_finish: '🏠',
  kitchen_remodel: '🍳',
  bathroom_remodel: '🚿',
  deck_build: '🪵',
  addition: '🏗️',
};

export default function Library() {
  const [activeTab, setActiveTab] = useState('rates');

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Library</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage labor rates and project templates
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="rates" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Rate Library
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rates">
            <RateLibraryContent />
          </TabsContent>

          <TabsContent value="templates">
            <TemplatesContent />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function RateLibraryContent() {
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
      setNewTask({ name: '', trade: 'Drywall', unit: 'SF', base_rate: 0, min_rate: 0, max_rate: 0, notes: '' });
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

  return (
    <div className="space-y-6">
      {/* Header + Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          Manage labor task rates for subcontractor pricing
        </p>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button variant="accent" size="sm">
              <Plus className="h-4 w-4 mr-2" />
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
              setTask={(t) => setNewTask(t as typeof newTask)}
              onSubmit={() => createMutation.mutate(newTask)}
              onCancel={() => setIsAddOpen(false)}
              submitLabel="Create Task"
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by trade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {uniqueTrades.map((trade) => (
              <SelectItem key={trade} value={trade}>{trade}</SelectItem>
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
            <p className="text-muted-foreground text-sm">
              {search || filterTrade !== 'all' ? 'Try adjusting your filters' : 'Add your first labor task to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead className="text-center">Unit</TableHead>
                  <TableHead className="text-right">Base Rate</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Min</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Max</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
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
                    <TableCell className="text-right font-mono">{formatCurrency(task.base_rate)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground hidden sm:table-cell">
                      {formatCurrency(task.min_rate || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground hidden sm:table-cell">
                      {formatCurrency(task.max_rate || 0)}
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
                              size="icon"
                              className="h-8 w-8"
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
                                setTask={(t) => setEditingTask(t as LaborTask)}
                                onSubmit={() => updateMutation.mutate(editingTask)}
                                onCancel={() => setEditingTask(null)}
                                submitLabel="Save Changes"
                                isLoading={updateMutation.isPending}
                              />
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteMutation.mutate(task.id)}
                          disabled={task.is_system}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function TaskForm({
  task,
  setTask,
  onSubmit,
  onCancel,
  submitLabel,
  isLoading,
}: {
  task: any;
  setTask: (task: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Task Name</Label>
        <Input
          value={task.name}
          onChange={(e) => setTask({ ...task, name: e.target.value })}
          placeholder="e.g., Hang 1/2 drywall - walls"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Trade</Label>
          <Select value={task.trade} onValueChange={(value) => setTask({ ...task, trade: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRADES.map((trade) => (
                <SelectItem key={trade} value={trade}>{trade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Unit</Label>
          <Select value={task.unit} onValueChange={(value) => setTask({ ...task, unit: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
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
            onChange={(e) => setTask({ ...task, base_rate: Number(e.target.value) })}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>Min Rate ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={task.min_rate || 0}
            onChange={(e) => setTask({ ...task, min_rate: Number(e.target.value) })}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>Max Rate ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={task.max_rate || 0}
            onChange={(e) => setTask({ ...task, max_rate: Number(e.target.value) })}
            className="font-mono"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Input
          value={task.notes || ''}
          onChange={(e) => setTask({ ...task, notes: e.target.value })}
          placeholder="Additional details..."
        />
      </div>
      <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">Cancel</Button>
        <Button variant="accent" onClick={onSubmit} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}

function TemplatesContent() {
  const { toast } = useToast();
  
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('templates').select('*').order('name');
      if (error) throw error;
      return data as Template[];
    },
  });

  const handleUseTemplate = (templateName: string) => {
    toast({
      title: 'Template feature coming soon',
      description: `"${templateName}" will be available to apply to projects in a future update.`,
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Pre-built takeoff templates for common project types
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No templates available</h3>
            <p className="text-muted-foreground text-center max-w-sm text-sm">
              Templates will appear here once they're created.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="interactive-card group">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{templateIcons[template.type] || '📋'}</div>
                  <div className="flex-1">
                    <CardTitle className="text-base group-hover:text-accent transition-colors">
                      {template.name}
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm">
                      {template.description || 'No description'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {template.is_system && (
                    <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                      System
                    </span>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-auto gap-2"
                    onClick={() => handleUseTemplate(template.name)}
                  >
                    Use Template
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Coming soon:</strong> Apply templates to new projects to automatically
            populate takeoff line items and labor tasks based on project type.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

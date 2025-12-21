import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Check, Circle, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface ChecklistItem {
  id: string;
  trade: string;
  item: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface ChecklistManagerProps {
  projectId: string;
}

export function ChecklistManager({ projectId }: ChecklistManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['checklist-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('project_id', projectId)
        .order('trade')
        .order('created_at');

      if (error) throw error;
      return data as ChecklistItem[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === 'complete' ? 'pending' : 'complete';
      const { error } = await supabase
        .from('checklist_items')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-items', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-items', projectId] });
      toast({ title: 'Item removed' });
    },
  });

  // Group by trade
  const byTrade = items.reduce((acc, item) => {
    if (!acc[item.trade]) acc[item.trade] = [];
    acc[item.trade].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const completedCount = items.filter(i => i.status === 'complete').length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">No checklist items</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Run the GC Wizard to generate a checklist of commonly missed items.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Checklist Progress
            </span>
            <span className="text-sm text-muted-foreground">
              {completedCount} / {items.length} complete
            </span>
          </div>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      {/* Items by trade */}
      {Object.entries(byTrade).map(([trade, tradeItems]) => {
        const tradeComplete = tradeItems.filter(i => i.status === 'complete').length;
        
        return (
          <div key={trade} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Badge variant="outline">{trade}</Badge>
              </h3>
              <span className="text-xs text-muted-foreground">
                {tradeComplete}/{tradeItems.length}
              </span>
            </div>
            
            {tradeItems.map((item) => (
              <Card
                key={item.id}
                className={`cursor-pointer transition-colors ${
                  item.status === 'complete' ? 'bg-success/5 border-success/30' : ''
                }`}
                onClick={() => toggleMutation.mutate({ id: item.id, status: item.status })}
              >
                <CardContent className="py-3 flex items-center gap-3">
                  <div className={`shrink-0 ${item.status === 'complete' ? 'text-success' : 'text-muted-foreground'}`}>
                    {item.status === 'complete' ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </div>
                  <span className={item.status === 'complete' ? 'line-through text-muted-foreground' : ''}>
                    {item.item}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(item.id);
                    }}
                    className="ml-auto text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}

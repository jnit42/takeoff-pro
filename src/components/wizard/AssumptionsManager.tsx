import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus, Trash2, Loader2, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface Assumption {
  id: string;
  statement: string;
  status: string;
  trade: string | null;
  is_exclusion: boolean;
  notes: string | null;
  created_at: string;
}

interface AssumptionsManagerProps {
  projectId: string;
}

export function AssumptionsManager({ projectId }: AssumptionsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newStatement, setNewStatement] = useState('');
  const [isExclusion, setIsExclusion] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['assumptions', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assumptions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Assumption[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('assumptions')
        .insert({
          project_id: projectId,
          statement: newStatement,
          is_exclusion: isExclusion,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assumptions', projectId] });
      setNewStatement('');
      toast({ title: isExclusion ? 'Exclusion added' : 'Assumption added' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assumptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assumptions', projectId] });
      toast({ title: 'Item deleted' });
    },
  });

  const assumptions = items.filter(i => !i.is_exclusion);
  const exclusions = items.filter(i => i.is_exclusion);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="assumptions">
        <TabsList>
          <TabsTrigger value="assumptions" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Assumptions ({assumptions.length})
          </TabsTrigger>
          <TabsTrigger value="exclusions" className="gap-2">
            <Ban className="h-4 w-4" />
            Exclusions ({exclusions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assumptions" className="space-y-4 mt-4">
          {/* Add new */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2">
                <Input
                  value={newStatement}
                  onChange={(e) => {
                    setNewStatement(e.target.value);
                    setIsExclusion(false);
                  }}
                  placeholder="Add new assumption..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newStatement.trim()) {
                      addMutation.mutate();
                    }
                  }}
                />
                <Button
                  variant="accent"
                  onClick={() => addMutation.mutate()}
                  disabled={!newStatement.trim() || addMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {assumptions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-center">
                  No assumptions yet. Run the GC Wizard or add manually.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {assumptions.map((item) => (
                <Card key={item.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <AlertCircle className="h-4 w-4 text-info shrink-0" />
                      <span>{item.statement}</span>
                      {item.trade && (
                        <Badge variant="outline" className="shrink-0">
                          {item.trade}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="exclusions" className="space-y-4 mt-4">
          {/* Add new exclusion */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2">
                <Input
                  value={newStatement}
                  onChange={(e) => {
                    setNewStatement(e.target.value);
                    setIsExclusion(true);
                  }}
                  placeholder="Add new exclusion..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newStatement.trim()) {
                      setIsExclusion(true);
                      addMutation.mutate();
                    }
                  }}
                />
                <Button
                  variant="accent"
                  onClick={() => {
                    setIsExclusion(true);
                    addMutation.mutate();
                  }}
                  disabled={!newStatement.trim() || addMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {exclusions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Ban className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-center">
                  No exclusions documented.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {exclusions.map((item) => (
                <Card key={item.id} className="border-destructive/30">
                  <CardContent className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <Ban className="h-4 w-4 text-destructive shrink-0" />
                      <span>{item.statement}</span>
                      {item.trade && (
                        <Badge variant="outline" className="shrink-0">
                          {item.trade}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

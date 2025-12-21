import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileQuestion, Check, X, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface RFI {
  id: string;
  question: string;
  status: string;
  trade: string | null;
  answer: string | null;
  notes: string | null;
  created_at: string;
}

interface RFIsManagerProps {
  projectId: string;
}

export function RFIsManager({ projectId }: RFIsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rfis = [], isLoading } = useQuery({
    queryKey: ['rfis', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RFI[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RFI> }) => {
      const { error } = await supabase
        .from('rfis')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rfis')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
      toast({ title: 'RFI resolved' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rfis').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
      toast({ title: 'RFI deleted' });
    },
  });

  const openRfis = rfis.filter(r => r.status === 'open');
  const resolvedRfis = rfis.filter(r => r.status === 'resolved');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rfis.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">No RFIs yet</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Run the GC Wizard to generate RFIs for items needing clarification.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Open RFIs */}
      {openRfis.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warning" />
            Open RFIs ({openRfis.length})
          </h3>
          {openRfis.map((rfi) => (
            <Card key={rfi.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {rfi.trade && (
                        <Badge variant="outline">{rfi.trade}</Badge>
                      )}
                      <Badge variant="secondary" className="bg-warning/10 text-warning">
                        Open
                      </Badge>
                    </div>
                    <p className="font-medium mb-3">{rfi.question}</p>
                    <div className="space-y-2">
                      <Input
                        value={rfi.answer || ''}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: rfi.id,
                            updates: { answer: e.target.value },
                          })
                        }
                        placeholder="Enter answer/resolution..."
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => resolveMutation.mutate(rfi.id)}
                      disabled={!rfi.answer}
                      className="text-success hover:text-success"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteMutation.mutate(rfi.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resolved RFIs */}
      {resolvedRfis.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            Resolved ({resolvedRfis.length})
          </h3>
          {resolvedRfis.map((rfi) => (
            <Card key={rfi.id} className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {rfi.trade && (
                        <Badge variant="outline">{rfi.trade}</Badge>
                      )}
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        Resolved
                      </Badge>
                    </div>
                    <p className="font-medium mb-1">{rfi.question}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {rfi.answer || 'No answer recorded'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

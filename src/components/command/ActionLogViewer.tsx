/**
 * Action Log Viewer - Shows command history with undo
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History, Undo2, ChevronDown, ChevronRight, Mic, Keyboard, MousePointer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActionLogViewerProps {
  projectId?: string;
  onUndo: (logId: string) => void;
  className?: string;
}

interface ActionLog {
  id: string;
  created_at: string;
  source: string;
  command_text: string;
  status: string;
  undoable: boolean;
  actions_json: unknown;
  error: string | null;
}

const SOURCE_ICONS = {
  voice: Mic,
  text: Keyboard,
  ui: MousePointer,
};

export function ActionLogViewer({ projectId, onUndo, className }: ActionLogViewerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['action-log', projectId],
    queryFn: async () => {
      let query = supabase
        .from('action_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as ActionLog[]) || [];
    },
  });

  if (isLoading) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground text-sm', className)}>
        Loading history...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground text-sm', className)}>
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No command history yet
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-2 p-2">
        {logs.map((log) => {
          const SourceIcon = SOURCE_ICONS[log.source as keyof typeof SOURCE_ICONS] || Keyboard;
          const isExpanded = expandedId === log.id;

          return (
            <div
              key={log.id}
              className={cn(
                'rounded-lg border bg-card p-2 text-sm',
                log.status === 'failed' && 'border-destructive/50',
                log.status === 'undone' && 'opacity-60'
              )}
            >
              <div className="flex items-start gap-2">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="shrink-0 p-0.5 hover:bg-accent rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SourceIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'HH:mm:ss')}
                    </span>
                    <Badge
                      variant={
                        log.status === 'applied' ? 'default' :
                        log.status === 'undone' ? 'secondary' : 'destructive'
                      }
                      className="text-[10px] px-1 py-0"
                    >
                      {log.status}
                    </Badge>
                  </div>
                  <p className="truncate font-medium">{log.command_text}</p>

                  {log.error && (
                    <p className="text-destructive text-xs mt-1">{log.error}</p>
                  )}
                </div>

                {log.undoable && log.status === 'applied' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 px-2"
                    onClick={() => onUndo(log.id)}
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    Undo
                  </Button>
                )}
              </div>

              {isExpanded && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Actions:</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(log.actions_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

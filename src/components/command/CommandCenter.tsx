/**
 * Command Center - Voice/Text control panel for the app
 * Enhanced with action log viewer, better voice status, extensible rules
 */

import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Mic,
  MicOff,
  Check,
  X,
  Loader2,
  Terminal,
  Sparkles,
  AlertCircle,
  History,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceInput, type VoiceStatus } from '@/hooks/useVoiceInput';
import { parseCommand, getCapabilities, PARSER_VERSION } from '@/command/rules';
import { executeActions, undoAction, type ExecutionResult } from '@/lib/commandExecutor';
import type { ParsedAction } from '@/lib/commandParser';
import { ActionLogViewer } from './ActionLogViewer';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'system' | 'preview';
  content: string;
  timestamp: Date;
  actions?: ParsedAction[];
  results?: ExecutionResult[];
  logId?: string;
}

interface CommandCenterProps {
  projectId?: string;
  projectType?: string;
  className?: string;
}

const QUICK_COMMANDS = [
  { label: 'Show QA issues', command: 'Show QA issues' },
  { label: 'Promote drafts', command: 'Promote all drafts' },
  { label: 'Export PDF', command: 'Export PDF' },
  { label: 'Help', command: 'What can you do?' },
];

const VOICE_STATUS_STYLES: Record<VoiceStatus, { color: string; pulse: boolean }> = {
  idle: { color: 'bg-muted', pulse: false },
  listening: { color: 'bg-green-500', pulse: true },
  processing: { color: 'bg-yellow-500', pulse: true },
  error: { color: 'bg-destructive', pulse: false },
  'not-supported': { color: 'bg-muted', pulse: false },
  'permission-denied': { color: 'bg-destructive', pulse: false },
};

export function CommandCenter({ projectId, projectType, className }: CommandCenterProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: projectId 
        ? 'Command Center ready! Type or speak commands. Try "Show QA issues" or click a quick command below.'
        : 'Select a project to use Command Center, or type "Create project [name]".',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [pendingActions, setPendingActions] = useState<ParsedAction[] | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [source, setSource] = useState<'text' | 'voice'>('text');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice input with enhanced status
  const { 
    isListening, 
    isSupported: voiceSupported, 
    status: voiceStatus,
    statusMessage: voiceStatusMessage,
    interimTranscript,
    startListening, 
    stopListening 
  } = useVoiceInput({
    onResult: (transcript) => {
      setInputValue(transcript);
      setSource('voice');
    },
    onError: (error) => {
      toast({ title: 'Voice Error', description: error, variant: 'destructive' });
    },
    autoPunctuation: true,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = (role: 'user' | 'system' | 'preview', content: string, extra?: Partial<Message>) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      ...extra,
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!inputValue.trim()) return;
    
    const commandText = inputValue.trim();
    setInputValue('');

    // Add user message
    addMessage('user', commandText);

    // Parse command using rule registry
    const result = parseCommand(commandText, { projectId, projectType });

    // Handle capabilities/help command specially
    if (result.success && result.actions.length === 1 && (result.actions[0] as { type: string }).type === 'system.capabilities') {
      const caps = getCapabilities();
      const helpText = caps.rules.map(r => 
        `**${r.name}**\n${r.examples.map(e => `  • ${e}`).join('\n')}`
      ).join('\n\n');
      addMessage('system', `Available Commands (v${PARSER_VERSION}):\n\n${helpText}`);
      return;
    }

    if (!result.success) {
      if (result.missingInfo) {
        addMessage('system', result.missingInfo);
      } else if (result.error) {
        addMessage('system', result.error);
      }
      return;
    }

    // Show proposed actions for confirmation - cast to executor type
    const actions = result.actions as unknown as ParsedAction[];
    setPendingActions(actions);
    
    const actionPreview = actions
      .map((a) => `• ${formatActionPreview(a)}`)
      .join('\n');
    
    addMessage('preview', `Proposed Actions:\n${actionPreview}`, { actions });
  };

  const handleConfirmActions = async () => {
    if (!pendingActions || !user) return;

    setIsExecuting(true);

    try {
      const { results, logId } = await executeActions(pendingActions, {
        projectId,
        userId: user.id,
        source,
        commandText: messages[messages.length - 2]?.content || '',
      });

      // Format results
      const resultMessages = results.map((r) => 
        r.success ? `✓ ${r.message}` : `✗ ${r.message}`
      );

      addMessage('system', resultMessages.join('\n'), { results, logId: logId || undefined });

      // Invalidate relevant queries
      invalidateQueries();

      const allSuccess = results.every((r) => r.success);
      if (allSuccess) {
        toast({ title: 'Commands executed successfully' });
      } else {
        toast({ title: 'Some commands failed', variant: 'destructive' });
      }
    } catch (error) {
      addMessage('system', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({ title: 'Execution failed', variant: 'destructive' });
    } finally {
      setIsExecuting(false);
      setPendingActions(null);
      setSource('text');
    }
  };

  const handleCancelActions = () => {
    setPendingActions(null);
    addMessage('system', 'Actions cancelled.');
  };

  const handleUndo = async (logId: string) => {
    try {
      const result = await undoAction(logId);
      
      if (result.success) {
        addMessage('system', 'Action undone successfully.');
        invalidateQueries();
        toast({ title: 'Undone successfully' });
      } else {
        addMessage('system', result.message);
        toast({ title: 'Cannot undo', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Undo failed', variant: 'destructive' });
    }
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
    queryClient.invalidateQueries({ queryKey: ['labor-estimates', projectId] });
    queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
    queryClient.invalidateQueries({ queryKey: ['assumptions', projectId] });
    queryClient.invalidateQueries({ queryKey: ['checklist-items', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['action-log', projectId] });
  };

  const handleQuickCommand = (command: string) => {
    setInputValue(command);
    inputRef.current?.focus();
  };

  const voiceStyle = VOICE_STATUS_STYLES[voiceStatus];

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-accent" />
            Command Center
          </div>
          <Badge variant="outline" className="text-[10px]">
            v{PARSER_VERSION}
          </Badge>
        </CardTitle>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'history')} className="flex-1 flex flex-col">
        <TabsList className="mx-3 grid grid-cols-2">
          <TabsTrigger value="chat" className="gap-1 text-xs">
            <Terminal className="h-3 w-3" />
            Commands
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1 text-xs">
            <History className="h-3 w-3" />
            History
          </TabsTrigger>
        </TabsList>

        <CardContent className="flex-1 flex flex-col gap-3 p-3 pt-2 overflow-hidden">
          <TabsContent value="chat" className="flex-1 flex flex-col gap-3 mt-0 data-[state=inactive]:hidden overflow-hidden">
            {/* Messages */}
            <ScrollArea className="flex-1 pr-3" ref={scrollRef}>
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'rounded-lg p-3 text-sm',
                      msg.role === 'user' && 'bg-accent/10 ml-8',
                      msg.role === 'system' && 'bg-muted',
                      msg.role === 'preview' && 'bg-warning/10 border border-warning/30'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {msg.role === 'preview' && <Sparkles className="h-4 w-4 text-warning shrink-0 mt-0.5" />}
                      {msg.role === 'system' && msg.results?.some(r => !r.success) && (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      )}
                      <p className="whitespace-pre-wrap flex-1">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Confirm/Cancel for pending actions */}
            {pendingActions && (
              <div className="flex gap-2 p-2 bg-warning/10 rounded-lg border border-warning/30">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConfirmActions}
                  disabled={isExecuting}
                  className="flex-1"
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelActions}
                  disabled={isExecuting}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}

            {/* Quick Commands */}
            <div className="flex flex-wrap gap-1">
              {QUICK_COMMANDS.map((qc) => (
                <Badge
                  key={qc.label}
                  variant="secondary"
                  className="cursor-pointer hover:bg-accent/20 transition-colors text-xs"
                  onClick={() => handleQuickCommand(qc.command)}
                >
                  {qc.label}
                </Badge>
              ))}
            </div>

            {/* Voice Status */}
            {voiceSupported && voiceStatus !== 'idle' && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                voiceStyle.color === 'bg-green-500' && 'bg-green-500/10 text-green-600',
                voiceStyle.color === 'bg-yellow-500' && 'bg-yellow-500/10 text-yellow-600',
                voiceStyle.color === 'bg-destructive' && 'bg-destructive/10 text-destructive',
              )}>
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  voiceStyle.color,
                  voiceStyle.pulse && 'animate-pulse'
                )} />
                <span>{voiceStatusMessage}</span>
                {interimTranscript && (
                  <span className="italic text-muted-foreground ml-2">"{interimTranscript}"</span>
                )}
              </div>
            )}

            {/* Not supported message */}
            {!voiceSupported && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-muted text-muted-foreground">
                <HelpCircle className="h-3 w-3" />
                <span>Voice not supported. Use Chrome for voice commands.</span>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={projectId ? "Type a command..." : "Create project [name]..."}
                className="flex-1"
                disabled={isExecuting || !!pendingActions}
              />
              
              {voiceSupported && (
                <Button
                  type="button"
                  variant={isListening ? 'destructive' : 'outline'}
                  size="icon"
                  onClick={isListening ? stopListening : startListening}
                  disabled={isExecuting || !!pendingActions || voiceStatus === 'permission-denied'}
                  title={voiceStatusMessage}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              
              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim() || isExecuting || !!pendingActions}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="history" className="flex-1 mt-0 data-[state=inactive]:hidden overflow-hidden">
            <ActionLogViewer 
              projectId={projectId} 
              onUndo={handleUndo}
              className="h-full"
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

function formatActionPreview(action: ParsedAction): string {
  switch (action.type) {
    case 'project.create':
      return `Create project "${action.params.name}"`;
    case 'project.set_defaults': {
      const updates = Object.entries(action.params)
        .map(([k, v]) => `${k.replace('_percent', '').replace('_', ' ')} = ${v}%`)
        .join(', ');
      return `Set ${updates}`;
    }
    case 'takeoff.add_item':
      return `Add takeoff: ${action.params.description} (${action.params.quantity} ${action.params.unit})`;
    case 'takeoff.generate_drafts_from_assemblies':
      return `Generate drafts from ${(action.params.assemblies as string[]).join(', ')}`;
    case 'takeoff.promote_drafts':
      return `Promote ${action.params.scope === 'all' ? 'all' : 'selected'} drafts`;
    case 'takeoff.delete_drafts':
      return `Delete ${action.params.scope === 'all' ? 'all' : 'selected'} drafts`;
    case 'labor.add_task_line':
      return `Add labor: ${action.params.task_name} (${action.params.quantity} ${action.params.unit})`;
    case 'export.pdf':
      return 'Export PDF estimate';
    case 'export.csv':
      return `Export ${action.params.which} CSV`;
    case 'qa.show_issues':
      return 'Show QA issues';
    default:
      return action.type;
  }
}

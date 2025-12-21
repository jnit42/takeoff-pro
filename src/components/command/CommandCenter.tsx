/**
 * Command Center - Voice/Text control panel for the app
 * Enhanced with action log viewer, better voice status, extensible rules
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceInput, type VoiceStatus } from '@/hooks/useVoiceInput';
import { parseCommand, getCapabilities, PARSER_VERSION, type ParseSuggestion } from '@/command/rules';
import { executeActions, undoAction, type ExecutionResult } from '@/lib/commandExecutor';
import type { ParsedAction } from '@/lib/commandParser';
import { ActionLogViewer } from './ActionLogViewer';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'system' | 'preview' | 'suggestion';
  content: string;
  timestamp: Date;
  actions?: ParsedAction[];
  results?: ExecutionResult[];
  logId?: string;
  suggestions?: ParseSuggestion[];
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

const VOICE_STATUS_CONFIG: Record<VoiceStatus, { color: string; bgColor: string; pulse: boolean; message: string }> = {
  idle: { color: 'text-muted-foreground', bgColor: 'bg-muted', pulse: false, message: 'Click mic to speak' },
  listening: { color: 'text-green-600', bgColor: 'bg-green-500', pulse: true, message: 'Listening... speak now' },
  processing: { color: 'text-yellow-600', bgColor: 'bg-yellow-500', pulse: true, message: 'Processing...' },
  error: { color: 'text-destructive', bgColor: 'bg-destructive', pulse: false, message: 'Error occurred' },
  'not-supported': { color: 'text-muted-foreground', bgColor: 'bg-muted', pulse: false, message: 'Voice works best in Chrome/Edge desktop' },
  'permission-denied': { color: 'text-destructive', bgColor: 'bg-destructive', pulse: false, message: 'Microphone blocked' },
};

// Money-impact action types that need stronger confirmation
const MONEY_IMPACT_ACTIONS = ['takeoff.promote_drafts', 'takeoff.delete_drafts', 'export.pdf', 'export.csv'];

// Actions that require a project context
const PROJECT_REQUIRED_ACTIONS = [
  'takeoff.add_item', 'takeoff.generate_drafts_from_assemblies', 'takeoff.promote_drafts', 
  'takeoff.delete_drafts', 'labor.add_task_line', 'export.pdf', 'export.csv', 
  'qa.show_issues', 'plans.open', 'project.set_defaults'
];

export function CommandCenter({ projectId, projectType, className }: CommandCenterProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
  const [showMoneyConfirm, setShowMoneyConfirm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    onInterim: (interim) => {
      // Show live transcription in input while speaking
      if (interim) {
        setInputValue(interim);
      }
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

  const addMessage = (role: 'user' | 'system' | 'preview' | 'suggestion', content: string, extra?: Partial<Message>) => {
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

    // First try deterministic parser
    let result = parseCommand(commandText, { projectId, projectType });

    // Handle capabilities/help command specially
    if (result.success && result.actions.length === 1 && (result.actions[0] as { type: string }).type === 'system.capabilities') {
      const caps = getCapabilities();
      const helpText = caps.rules.map(r => 
        `**${r.name}**\n${r.examples.map(e => `  • ${e}`).join('\n')}`
      ).join('\n\n');
      addMessage('system', `Available Commands (v${PARSER_VERSION}):\n\n${helpText}`);
      return;
    }

    // If deterministic parser failed, try AI parsing
    if (!result.success) {
      addMessage('system', '🤔 Checking with AI...');
      
      try {
        const { data, error } = await supabase.functions.invoke('ai-command-parse', {
          body: { 
            message: commandText,
            projectContext: { projectId, projectType }
          }
        });

        if (error) {
          console.error('[AI Parse] Error:', error);
          // Show original fallback
          if (result.suggestions && result.suggestions.length > 0) {
            setMessages(prev => prev.slice(0, -1)); // Remove "Checking with AI" message
            addMessage('suggestion', result.error || "I couldn't understand that.", { suggestions: result.suggestions });
          } else {
            setMessages(prev => prev.slice(0, -1));
            addMessage('system', result.error || "I couldn't understand that command.");
          }
          return;
        }

        console.log('[AI Parse] Response:', data);
        
        // Remove "Checking with AI" message
        setMessages(prev => prev.slice(0, -1));

        if (data.error) {
          toast({ title: 'AI Error', description: data.error, variant: 'destructive' });
          if (result.suggestions && result.suggestions.length > 0) {
            addMessage('suggestion', result.error || "I couldn't understand that.", { suggestions: result.suggestions });
          }
          return;
        }

        if (data.success && data.actions && data.actions.length > 0) {
          // AI successfully parsed - use those actions
          result = {
            success: true,
            actions: data.actions,
            schemaVersion: result.schemaVersion,
            parserVersion: result.parserVersion + '+AI'
          };
          
          // If there are follow-up questions, show them
          if (data.followUpQuestions && data.followUpQuestions.length > 0) {
            addMessage('system', `📝 ${data.followUpQuestions.join('\n')}`);
          }
        } else if (data.message) {
          addMessage('system', data.message);
          return;
        } else {
          // AI also couldn't understand
          if (result.suggestions && result.suggestions.length > 0) {
            addMessage('suggestion', result.error || "I couldn't understand that.", { suggestions: result.suggestions });
          } else {
            addMessage('system', result.error || "I couldn't understand that command. Try 'help' for examples.");
          }
          return;
        }
      } catch (err) {
        console.error('[AI Parse] Exception:', err);
        setMessages(prev => prev.slice(0, -1));
        if (result.suggestions && result.suggestions.length > 0) {
          addMessage('suggestion', result.error || "I couldn't understand that.", { suggestions: result.suggestions });
        } else {
          addMessage('system', result.error || "I couldn't understand that command.");
        }
        return;
      }
    }

    // Show proposed actions for confirmation - cast to executor type
    const actions = result.actions as unknown as ParsedAction[];
    
    // Check if any action requires project context
    const needsProject = actions.some(a => PROJECT_REQUIRED_ACTIONS.includes(a.type));
    if (needsProject && !projectId) {
      addMessage('system', '⚠️ Please select a project first. This command requires a project context.');
      return;
    }
    
    setPendingActions(actions);
    
    const actionPreview = actions
      .map((a) => `• ${formatActionPreview(a)}`)
      .join('\n');
    
    addMessage('preview', `Proposed Actions:\n${actionPreview}`, { actions });
  };

  const handleConfirmActions = async (skipMoneyCheck = false) => {
    if (!pendingActions || !user) return;

    // Check for money-impact actions
    const hasMoneyImpact = pendingActions.some(a => MONEY_IMPACT_ACTIONS.includes(a.type));
    if (hasMoneyImpact && !skipMoneyCheck) {
      setShowMoneyConfirm(true);
      return;
    }

    setIsExecuting(true);
    setShowMoneyConfirm(false);

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

      // Handle navigation if any result has navigateTo
      const navResult = results.find(r => r.navigateTo);
      if (navResult?.navigateTo) {
        navigate(navResult.navigateTo);
      }

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

  const handleSuggestionClick = (command: string) => {
    setInputValue(command);
    inputRef.current?.focus();
  };

  const voiceConfig = VOICE_STATUS_CONFIG[voiceStatus];

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
            {/* Project Warning */}
            {!projectId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-warning/10 border border-warning/30 text-warning">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>No project selected. Some commands require a project context.</span>
              </div>
            )}

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
                      msg.role === 'preview' && 'bg-warning/10 border border-warning/30',
                      msg.role === 'suggestion' && 'bg-accent/5 border border-accent/20'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {msg.role === 'preview' && <Sparkles className="h-4 w-4 text-warning shrink-0 mt-0.5" />}
                      {msg.role === 'suggestion' && <HelpCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
                      {msg.role === 'system' && msg.results?.some(r => !r.success) && (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        {/* Clickable suggestions */}
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {msg.suggestions.map((s, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="cursor-pointer hover:bg-accent/20 transition-colors text-xs"
                                onClick={() => handleSuggestionClick(s.command)}
                              >
                                {s.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
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
                  onClick={() => handleConfirmActions()}
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
                  onClick={() => handleSuggestionClick(qc.command)}
                >
                  {qc.label}
                </Badge>
              ))}
            </div>

            {/* Voice Status - Always show when voice is supported */}
            {voiceSupported && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs border',
                voiceStatus === 'listening' && 'bg-green-500/10 border-green-500/30 text-green-600',
                voiceStatus === 'processing' && 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
                voiceStatus === 'error' && 'bg-destructive/10 border-destructive/30 text-destructive',
                voiceStatus === 'permission-denied' && 'bg-destructive/10 border-destructive/30 text-destructive',
                voiceStatus === 'idle' && 'bg-muted border-border text-muted-foreground',
              )}>
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  voiceConfig.bgColor,
                  voiceConfig.pulse && 'animate-pulse'
                )} />
                <span className="flex-1">{voiceConfig.message}</span>
                {voiceStatus === 'permission-denied' && (
                  <a 
                    href="https://support.google.com/chrome/answer/2693767" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-accent hover:underline"
                  >
                    Enable mic <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {isListening && interimTranscript && (
                  <span className="italic text-muted-foreground">"{interimTranscript}"</span>
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

            {/* Input - Textarea for multi-line dictation */}
            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  // Submit on Enter (without Shift)
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={projectId ? "Type or speak a command..." : "Select a project first..."}
                className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isExecuting || !!pendingActions}
                rows={Math.min(4, Math.max(1, inputValue.split('\n').length))}
              />
              
              {voiceSupported && (
                <Button
                  type="button"
                  variant={isListening ? 'destructive' : 'outline'}
                  size="icon"
                  onClick={isListening ? stopListening : startListening}
                  disabled={isExecuting || !!pendingActions || voiceStatus === 'permission-denied'}
                  title={voiceStatusMessage}
                  className={cn(
                    'relative transition-all',
                    isListening && 'ring-2 ring-destructive ring-offset-2 animate-pulse'
                  )}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive animate-ping" />
                    </>
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
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

      {/* Money-impact confirmation dialog */}
      <AlertDialog open={showMoneyConfirm} onOpenChange={setShowMoneyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action affects your project data (promote drafts, delete items, or export). 
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmActions(true)}>
              Yes, Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

/**
 * Command Center - Voice/Text control panel for the app
 * Mobile-first redesign with proper layout and scrolling
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
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceInput, type VoiceStatus } from '@/hooks/useVoiceInput';
import { parseCommand, getCapabilities, PARSER_VERSION, type ParseSuggestion } from '@/command/rules';
import { executeActions, undoAction, type ExecutionResult } from '@/lib/commandExecutor';
import type { ParsedAction } from '@/lib/commandParser';
import { ActionLogViewer } from './ActionLogViewer';
import { MaterialList, type MaterialItem } from './MaterialListItem';
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
  const [itemsDrawerOpen, setItemsDrawerOpen] = useState(false);

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

  // Count actual items in pending actions (handles takeoff.add_multiple)
  const getPendingItemCount = (actions: ParsedAction[]): number => {
    let count = 0;
    for (const action of actions) {
      if (action.type === 'takeoff.add_multiple' && action.params.items) {
        count += (action.params.items as unknown[]).length;
      } else {
        count += 1;
      }
    }
    return count;
  };

  const addMessage = (role: 'user' | 'system' | 'preview' | 'suggestion', content: string, extra?: Partial<Message>) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
    
    // Stop voice recording when sending
    if (isListening) {
      stopListening();
    }

    // Add user message
    addMessage('user', commandText);

    // Check if user is confirming pending actions
    const confirmPhrases = /^(confirm|go ahead|looks good|do it|yes|execute|approve|that's right|perfect|ok|okay)$/i;
    if (pendingActions && confirmPhrases.test(commandText.trim())) {
      handleConfirmActions();
      return;
    }

    // Check if user is canceling
    const cancelPhrases = /^(cancel|never ?mind|stop|clear|start over|reset)$/i;
    if (pendingActions && cancelPhrases.test(commandText.trim())) {
      handleCancelActions();
      return;
    }

    // Build conversation history for AI context (last 10 messages)
    const conversationHistory = messages
      .slice(-10)
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

    // If we have pending actions OR just asking about recent context, send as follow-up
    const isAskingAboutContext = !pendingActions && /why|how|what|explain/i.test(commandText);
    
    if (pendingActions || isAskingAboutContext) {
      addMessage('system', pendingActions ? '🔄 Updating...' : '🤔 Thinking...');
      
      try {
        const pendingContext = pendingActions 
          ? pendingActions.map(a => formatActionPreview(a)).join('\n')
          : '';
        
        const { data, error } = await supabase.functions.invoke('ai-command-parse', {
          body: { 
            message: commandText,
            projectContext: { projectId, projectType },
            pendingActions: pendingContext,
            conversationHistory,
            isFollowUp: true
          }
        });

        setMessages(prev => prev.slice(0, -1)); // Remove loading message

        if (error) {
          console.error('[AI Follow-up] Error:', error);
          addMessage('system', "I couldn't process that. Try rephrasing.");
          return;
        }

        if (data.actions && data.actions.length > 0) {
          // Update pending actions
          const newActions = data.actions as unknown as ParsedAction[];
          setPendingActions(newActions);
          
          const actionPreview = newActions
            .map((a) => `• ${formatActionPreview(a)}`)
            .join('\n');
          
          const msg = data.message ? `${data.message}\n\n` : '';
          addMessage('preview', `${msg}Proposed:\n${actionPreview}\n\nRefine or say "confirm".`, { actions: newActions });
        } else if (data.message) {
          // AI responded with explanation
          addMessage('system', data.message);
        }
        
        return;
      } catch (err) {
        console.error('[AI Follow-up] Exception:', err);
        setMessages(prev => prev.slice(0, -1));
        addMessage('system', "Something went wrong. Try again.");
        return;
      }
    }

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
      addMessage('system', '🤔 Thinking...');
      
      try {
        const { data, error } = await supabase.functions.invoke('ai-command-parse', {
          body: { 
            message: commandText,
            projectContext: { projectId, projectType }
          }
        });

        if (error) {
          console.error('[AI Parse] Error:', error);
          if (result.suggestions && result.suggestions.length > 0) {
            setMessages(prev => prev.slice(0, -1));
            addMessage('suggestion', result.error || "I couldn't understand that.", { suggestions: result.suggestions });
          } else {
            setMessages(prev => prev.slice(0, -1));
            addMessage('system', result.error || "I couldn't understand that command.");
          }
          return;
        }

        console.log('[AI Parse] Response:', data);
        
        setMessages(prev => prev.slice(0, -1));

        if (data.error) {
          toast({ title: 'AI Error', description: data.error, variant: 'destructive' });
          if (result.suggestions && result.suggestions.length > 0) {
            addMessage('suggestion', result.error || "I couldn't understand that.", { suggestions: result.suggestions });
          }
          return;
        }

        if (data.success && data.actions && data.actions.length > 0) {
          result = {
            success: true,
            actions: data.actions,
            schemaVersion: result.schemaVersion,
            parserVersion: result.parserVersion + '+AI'
          };
          
          // Show AI message with follow-up questions if any
          const aiMessage = data.message || '';
          const questions = data.followUpQuestions?.length > 0 
            ? '\n\n' + data.followUpQuestions.join('\n') 
            : '';
          
          if (aiMessage || questions) {
            addMessage('system', (aiMessage + questions).trim());
          }
        } else if (data.message) {
          addMessage('system', data.message);
          return;
        } else {
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

    // Show proposed actions - cast to executor type
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
    
    addMessage('preview', `Proposed:\n${actionPreview}\n\nAsk questions, request changes, or say "confirm" when ready.`, { actions });
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
    addMessage('system', 'Proposal cleared. You can still ask questions about the last estimate or start a new one.');
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

  // Extract material items from pending actions for display
  const getPendingMaterialItems = (): MaterialItem[] => {
    if (!pendingActions) return [];
    
    const items: MaterialItem[] = [];
    for (const action of pendingActions) {
      if (action.type === 'takeoff.add_multiple' && action.params.items) {
        const actionItems = action.params.items as MaterialItem[];
        items.push(...actionItems);
      } else if (action.type === 'takeoff.add_item') {
        items.push({
          description: action.params.description as string,
          quantity: action.params.quantity as number,
          unit: action.params.unit as string,
          category: action.params.category as string,
        });
      }
    }
    return items;
  };

  // Update an item in pending actions
  const handleUpdatePendingItem = (index: number, updates: Partial<MaterialItem>) => {
    if (!pendingActions) return;
    
    // Rebuild actions with updated item
    const items = getPendingMaterialItems();
    if (index < 0 || index >= items.length) return;
    
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    
    // Create a single add_multiple action with updated items
    const newActions: ParsedAction[] = [{
      type: 'takeoff.add_multiple',
      params: { items: updatedItems },
      confidence: 0.9,
    }];
    
    setPendingActions(newActions);
    addMessage('system', `Updated: ${updatedItems[index].description} → ${updatedItems[index].quantity} ${updatedItems[index].unit}`);
  };

  // Remove an item from pending actions
  const handleRemovePendingItem = (index: number) => {
    if (!pendingActions) return;
    
    const items = getPendingMaterialItems();
    if (index < 0 || index >= items.length) return;
    
    const removedItem = items[index];
    const updatedItems = items.filter((_, i) => i !== index);
    
    if (updatedItems.length === 0) {
      // No items left, cancel pending actions
      handleCancelActions();
      return;
    }
    
    const newActions: ParsedAction[] = [{
      type: 'takeoff.add_multiple',
      params: { items: updatedItems },
      confidence: 0.9,
    }];
    
    setPendingActions(newActions);
    addMessage('system', `Removed: ${removedItem.description}`);
  };

  const pendingMaterialItems = getPendingMaterialItems();

  return (
    <Card className={cn('flex flex-col h-full overflow-hidden', className)}>
      <CardHeader className="pb-2 px-3 sm:px-6 flex-shrink-0 border-b">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            <span className="hidden sm:inline">Command Center</span>
            <span className="sm:hidden">Commands</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            v{PARSER_VERSION}
          </Badge>
        </CardTitle>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'history')} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 grid grid-cols-2 flex-shrink-0">
          <TabsTrigger value="chat" className="gap-1.5 text-xs">
            <Terminal className="h-3 w-3" />
            Commands
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3 w-3" />
            History
          </TabsTrigger>
        </TabsList>

        <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
          <TabsContent value="chat" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden min-h-0 overflow-hidden m-0">
            {/* Main chat area - flex column layout */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Project Warning */}
              {!projectId && (
                <div className="flex items-center gap-2 px-3 py-2 mx-3 mt-3 rounded-lg text-xs bg-warning/10 border border-warning/30 text-warning flex-shrink-0">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>No project selected. Some commands require a project context.</span>
                </div>
              )}

              {/* Messages - scrollable area - takes remaining space */}
              <ScrollArea className="flex-1 min-h-0 px-3" ref={scrollRef}>
                <div className="space-y-3 py-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'rounded-lg p-3 text-sm break-words animate-fade-in',
                        msg.role === 'user' && 'bg-primary/10 ml-4 sm:ml-8 border border-primary/20',
                        msg.role === 'system' && 'bg-muted/60 border border-border/50',
                        msg.role === 'preview' && 'bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800',
                        msg.role === 'suggestion' && 'bg-accent/5 border border-accent/20'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {msg.role === 'preview' && <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />}
                        {msg.role === 'suggestion' && <HelpCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
                        {msg.role === 'system' && msg.results?.some(r => !r.success) && (
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          {/* For preview messages with material items, show structured list */}
                          {msg.role === 'preview' && msg.actions ? (
                            <div className="space-y-2">
                              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                                {msg.content.split('\n')[0]}
                              </p>
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Review items below. Ask questions or say "confirm" when ready.
                              </p>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          )}
                          {/* Clickable suggestions */}
                          {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
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

              {/* Bottom section - fixed at bottom */}
              <div className="flex-shrink-0 border-t bg-background">
                {/* Pending items indicator - opens drawer */}
                {pendingActions && (
                  <button
                    onClick={() => setItemsDrawerOpen(true)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border-b border-amber-200 dark:border-amber-800 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">
                        {getPendingItemCount(pendingActions)}
                      </div>
                      <span className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                        Items Ready
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Tap to review
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleConfirmActions()}
                        disabled={isExecuting}
                        className="h-8 px-3 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                      >
                        {isExecuting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 sm:mr-1" />}
                        <span className="hidden sm:inline">Confirm</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelActions}
                        disabled={isExecuting}
                        className="h-8 w-8 p-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 hover:bg-amber-200/50 rounded-full"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </button>
                )}

                {/* Quick Commands */}
                <div className="flex gap-1.5 overflow-x-auto p-3 pb-2 scrollbar-none">
                  {QUICK_COMMANDS.map((qc) => (
                    <Badge
                      key={qc.label}
                      variant="secondary"
                      className="cursor-pointer hover:bg-accent/20 transition-colors text-xs whitespace-nowrap flex-shrink-0"
                      onClick={() => handleSuggestionClick(qc.command)}
                    >
                      {qc.label}
                    </Badge>
                  ))}
                </div>

                {/* Voice Status */}
                {voiceSupported && voiceStatus !== 'idle' && (
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-1.5 mx-3 mb-2 rounded-lg text-xs',
                    voiceStatus === 'listening' && 'bg-green-500/10 text-green-600 border border-green-200 dark:border-green-800',
                    voiceStatus === 'processing' && 'bg-yellow-500/10 text-yellow-600 border border-yellow-200 dark:border-yellow-800',
                    voiceStatus === 'error' && 'bg-destructive/10 text-destructive border border-destructive/20',
                    voiceStatus === 'permission-denied' && 'bg-destructive/10 text-destructive border border-destructive/20',
                  )}>
                    <div className={cn('h-2 w-2 rounded-full', voiceConfig.bgColor, voiceConfig.pulse && 'animate-pulse')} />
                    <span>{voiceConfig.message}</span>
                  </div>
                )}

                {/* Input area */}
                <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3 pt-0">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      placeholder={projectId ? "Type or speak..." : "Select a project..."}
                      className="w-full min-h-[44px] max-h-[100px] overflow-y-auto resize-none rounded-xl border border-input bg-background px-3 py-3 text-base placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                      disabled={isExecuting}
                      rows={1}
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  
                  <div className="flex gap-1.5 shrink-0 pb-0.5">
                    {voiceSupported && (
                      <Button
                        type="button"
                        variant={isListening ? 'destructive' : 'outline'}
                        size="icon"
                        onClick={isListening ? stopListening : startListening}
                        disabled={isExecuting || voiceStatus === 'permission-denied'}
                        title={voiceStatusMessage}
                        className={cn(
                          'h-10 w-10 sm:h-11 sm:w-11 transition-all rounded-xl',
                          isListening && 'ring-2 ring-destructive ring-offset-1'
                        )}
                      >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    )}
                    
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!inputValue.trim() || isExecuting}
                      className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="flex-1 mt-0 data-[state=inactive]:hidden overflow-hidden m-0 p-3">
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

      {/* Items Review Drawer - Mobile-optimized fullscreen overlay */}
      <Drawer open={itemsDrawerOpen} onOpenChange={setItemsDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20">
            <DrawerTitle className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white text-sm font-bold">
                {pendingActions ? getPendingItemCount(pendingActions) : 0}
              </div>
              <span className="text-amber-800 dark:text-amber-200">Items Ready for Review</span>
            </DrawerTitle>
          </DrawerHeader>
          
          {/* Scrollable item list */}
          <div className="flex-1 overflow-y-auto p-4 max-h-[50vh]">
            {pendingMaterialItems.length > 0 ? (
              <MaterialList 
                items={pendingMaterialItems}
                onUpdate={handleUpdatePendingItem}
                onRemove={handleRemovePendingItem}
                editable={true}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No items to review</p>
              </div>
            )}
          </div>

          {/* Hint */}
          <div className="px-4 py-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30 border-t border-amber-200/50 dark:border-amber-800/50">
            💬 Close drawer to continue chatting. Tap items to edit quantity.
          </div>

          <DrawerFooter className="border-t pt-4 gap-2">
            <Button
              onClick={() => {
                handleConfirmActions();
                setItemsDrawerOpen(false);
              }}
              disabled={isExecuting}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isExecuting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Confirm All Items
            </Button>
            <div className="flex gap-2">
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1">
                  Continue Chatting
                </Button>
              </DrawerClose>
              <Button 
                variant="ghost" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  handleCancelActions();
                  setItemsDrawerOpen(false);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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
      return `Add: ${action.params.description} (${action.params.quantity} ${action.params.unit})`;
    case 'takeoff.add_multiple': {
      const items = action.params.items as Array<{ description: string; quantity: number; unit: string; category?: string }>;
      if (!items || items.length === 0) return 'Add multiple items (none specified)';
      
      const itemList = items.map(item => 
        `  → ${item.description}: ${item.quantity} ${item.unit}${item.category ? ` [${item.category}]` : ''}`
      ).join('\n');
      
      return `Add ${items.length} items:\n${itemList}`;
    }
    case 'takeoff.update_item':
      return `Update item: ${JSON.stringify(action.params.updates)}`;
    case 'takeoff.delete_item':
      return `Delete item (ID: ${action.params.id})`;
    case 'takeoff.generate_drafts_from_assemblies':
      return `Generate drafts from ${(action.params.assemblies as string[]).join(', ')}`;
    case 'takeoff.promote_drafts':
      return `Promote ${action.params.scope === 'all' ? 'all' : 'selected'} drafts to final`;
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
    case 'navigate.plans':
      return 'Open Plans viewer';
    case 'navigate.takeoff':
      return 'Open Takeoff builder';
    case 'navigate.labor':
      return 'Open Labor estimator';
    default:
      return action.type;
  }
}

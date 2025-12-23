import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, Send, Mic, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AIProcessingOverlay } from '@/components/takeoff/AIProcessingOverlay';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [magicInputOpen, setMagicInputOpen] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Extract projectId from URL if on project page
  const projectMatch = location.pathname.match(/\/projects\/([^/?]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;

  // AI Magic Input handler
  const handleAISubmit = async (input: string) => {
    if (!projectId) {
      toast({ title: 'No project selected', description: 'Open a project first', variant: 'destructive' });
      return;
    }
    
    setIsAIProcessing(true);
    setMagicInputOpen(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('construction-brain', {
        body: { message: input, projectId }
      });

      if (error) throw error;

      if (data?.actions?.length > 0) {
        await supabase.functions.invoke('ai-command-parse', {
          body: {
            message: input,
            projectId,
            execute: true,
            proposedActions: data.actions,
          }
        });

        toast({
          title: 'Estimate updated',
          description: data.reasoning || `Added ${data.actions.length} items`,
        });

        queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
      } else {
        toast({
          title: 'AI Response',
          description: data.reasoning || 'No items to add',
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to process request';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsAIProcessing(false);
    }
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        {/* AI Processing Overlay */}
        <AIProcessingOverlay isVisible={isAIProcessing} />
        
        {/* Mobile header */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur-md px-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 border-r-0">
              <AppSidebar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-base">Scope to Pay</span>
          </div>
        </header>
        
        <main className="min-h-[calc(100vh-3.5rem-5rem)]">
          {children}
        </main>
        
        {/* Bottom Navigation */}
        <MobileBottomNav 
          onMagicPress={() => setMagicInputOpen(true)}
          showMagicButton={!!projectId}
        />
        
        {/* AI Input Sheet */}
        {projectId && (
          <AIInputSheet
            open={magicInputOpen}
            onOpenChange={setMagicInputOpen}
            onSubmit={handleAISubmit}
            isProcessing={isAIProcessing}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}

// Polished AI Input Sheet
function AIInputSheet({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isProcessing 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: string) => Promise<void>;
  isProcessing: boolean;
}) {
  const [textInput, setTextInput] = useState('');

  const handleSubmit = async () => {
    if (!textInput.trim()) return;
    await onSubmit(textInput);
    setTextInput('');
  };

  const quickPrompts = [
    "5x8 bathroom remodel",
    "Frame 15x20 room",
    "10x12 bedroom",
    "Kitchen demo",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-2xl border-t border-border/50 bg-card p-0 max-h-[85vh]"
      >
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Estimator</h3>
                <p className="text-xs text-muted-foreground">Describe your project</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Input Area */}
          <div className="relative">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="What do you need to estimate?"
              className={cn(
                "w-full min-h-[100px] p-4 pr-12 text-base rounded-xl resize-none",
                "bg-muted/50 border-0 placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background",
                "transition-all duration-200"
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={isProcessing}
              autoFocus
            />
            
            {/* Action Buttons */}
            <div className="absolute right-3 bottom-3 flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                disabled={isProcessing}
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleSubmit}
                disabled={!textInput.trim() || isProcessing}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Prompts */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Quick estimates</p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setTextInput(prompt)}
                  disabled={isProcessing}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full",
                    "bg-muted hover:bg-muted/80 text-foreground",
                    "transition-colors duration-150",
                    "disabled:opacity-50 disabled:pointer-events-none"
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
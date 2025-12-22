import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, Send, Mic, Paperclip, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AIProcessingOverlay } from '@/components/takeoff/AIProcessingOverlay';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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
            command: input,
            projectId,
            execute: true,
            proposedActions: data.actions,
          }
        });

        toast({
          title: 'Estimate updated!',
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
        
        {/* Mobile header with hamburger */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <AppSidebar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Takeoff + SubPay</span>
          </div>
        </header>
        
        <main className="min-h-[calc(100vh-3.5rem-5rem)]">
          {children}
        </main>
        
        {/* Bottom Navigation with Magic Button */}
        <MobileBottomNav 
          onMagicPress={() => setMagicInputOpen(true)}
          showMagicButton={!!projectId}
        />
        
        {/* Handoff-style Magic Input Sheet */}
        {projectId && (
          <HandoffInputSheet
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

// Handoff-style input sheet with location badge
function HandoffInputSheet({ 
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
    "5x8 bathroom, mid-range",
    "Frame a 15x20 basement room",
    "10x12 bedroom with closet",
    "Kitchen demo and remodel",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-primary/30 bg-background">
        <div className="pt-3 pb-6 space-y-4">
          {/* Handoff-style input bar */}
          <div className="rounded-xl border-2 border-primary/50 bg-background p-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-muted-foreground">Use AI</span>
            </div>
            
            <div className="relative">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Describe what you need to estimate..."
                className="w-full h-12 px-4 pr-24 text-base bg-muted/30 rounded-lg border-0 focus:outline-none focus:ring-0"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                disabled={isProcessing}
                autoFocus
              />
              
              {/* Action buttons */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground"
                  disabled={isProcessing}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground"
                  disabled={isProcessing}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleSubmit}
                  disabled={!textInput.trim() || isProcessing}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Location badge */}
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <MapPin className="h-3 w-3" />
                Set Location
              </Button>
            </div>
          </div>

          {/* Quick Prompts */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Try one of these:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-muted/20"
                  onClick={() => setTextInput(prompt)}
                  disabled={isProcessing}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MagicInput } from '@/components/takeoff/MagicInput';
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
  const handleAISubmit = async (input: string, _type: 'voice' | 'text' | 'photo') => {
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
          title: 'Done!',
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
        {/* Mobile header with hamburger */}
        <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
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
        
        {/* Global Magic Input - controlled open state */}
        {projectId && (
          <MagicInputSheet
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

// Separate controlled component for magic input
function MagicInputSheet({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isProcessing 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: string, type: 'voice' | 'text' | 'photo') => Promise<void>;
  isProcessing: boolean;
}) {
  const [textInput, setTextInput] = useState('');

  const handleSubmit = async () => {
    if (!textInput.trim()) return;
    await onSubmit(textInput, 'text');
    setTextInput('');
  };

  const quickPrompts = [
    "5x8 bathroom, mid-range",
    "10x12 bedroom, standard",
    "Frame a 10x10 room",
    "Kitchen demo and remodel",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
        <div className="pt-2 pb-6 space-y-4">
          <h3 className="text-center font-semibold text-lg">What do you need?</h3>

          {/* Text Input */}
          <div className="relative">
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="e.g., '5x8 bathroom, mid-range finishes'"
              className="w-full h-12 px-4 pr-12 text-base rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={isProcessing}
              autoFocus
            />
            <Button
              size="icon"
              className="absolute right-1 top-1 h-10 w-10"
              onClick={handleSubmit}
              disabled={!textInput.trim() || isProcessing}
            >
              {isProcessing ? (
                <span className="h-5 w-5 animate-spin border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <span className="text-lg">→</span>
              )}
            </Button>
          </div>

          {/* Quick Prompts */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Quick prompts</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setTextInput(prompt)}
                  disabled={isProcessing}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>

          {/* Pro Tip */}
          <p className="text-xs text-center text-muted-foreground pt-2">
            💡 Just describe the room or project. We'll handle the math.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Magic Input Component
 * WhatsApp-style floating button for voice/photo input
 * The zero-friction "Handoff-style" input method
 */

import { useState } from 'react';
import { 
  Mic, 
  Camera, 
  MessageSquare, 
  X,
  Send,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MagicInputProps {
  onSubmit: (input: string, type: 'voice' | 'text' | 'photo') => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

export function MagicInput({ onSubmit, isProcessing = false, className }: MagicInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice' | 'photo'>('text');
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const handleSubmit = async () => {
    if (!textInput.trim()) return;
    
    await onSubmit(textInput, inputMode);
    setTextInput('');
    setIsOpen(false);
  };

  const handleVoiceStart = () => {
    setIsRecording(true);
    setInputMode('voice');
    // Voice recognition would be implemented here
    // For now, we'll show a placeholder
  };

  const handleVoiceEnd = () => {
    setIsRecording(false);
  };

  const quickPrompts = [
    "5x8 bathroom, mid-range",
    "10x12 bedroom, standard",
    "Frame a 10x10 room",
    "Kitchen demo and remodel",
  ];

  return (
    <>
      {/* Floating Action Button */}
      <div className={cn('fixed bottom-20 right-4 z-50', className)}>
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => setIsOpen(true)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <MessageSquare className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Input Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">What do you need?</SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            {/* Text Input */}
            <div className="relative">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g., '5x8 bathroom, mid-range finishes'"
                className="pr-12 h-12 text-base"
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
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
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

            {/* Alternative Input Methods */}
            <div className="flex gap-3 justify-center pt-4 border-t">
              <Button
                variant="outline"
                size="lg"
                className={cn(
                  'flex-1 h-14 gap-2',
                  isRecording && 'bg-destructive/10 border-destructive text-destructive'
                )}
                onMouseDown={handleVoiceStart}
                onMouseUp={handleVoiceEnd}
                onMouseLeave={handleVoiceEnd}
                onTouchStart={handleVoiceStart}
                onTouchEnd={handleVoiceEnd}
                disabled={isProcessing}
              >
                <Mic className={cn('h-5 w-5', isRecording && 'animate-pulse')} />
                {isRecording ? 'Listening...' : 'Hold to Talk'}
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                className="flex-1 h-14 gap-2"
                disabled={isProcessing}
              >
                <Camera className="h-5 w-5" />
                Snap Plans
              </Button>
            </div>

            {/* Pro Tip */}
            <p className="text-xs text-center text-muted-foreground pt-2">
              💡 Just describe the room or project. We'll handle the math.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

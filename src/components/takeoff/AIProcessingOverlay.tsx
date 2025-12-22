/**
 * AI Processing Overlay
 * Handoff-style loading state with rotating Pro Tips
 */

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRO_TIPS = [
  {
    tip: "Save rates and project instructions for tailored estimates as",
    highlight: "AI presets.",
  },
  {
    tip: "Ask the AI to change",
    highlight: "whatever you need",
    suffix: "on your estimate.",
  },
  {
    tip: "Describe rooms naturally like",
    highlight: "'5x8 bathroom, mid-range'",
    suffix: "for instant estimates.",
  },
  {
    tip: "The AI automatically includes",
    highlight: "demo, cleanup & waste removal",
    suffix: "for complete scopes.",
  },
  {
    tip: "Tap any quantity to",
    highlight: "edit inline",
    suffix: "without opening menus.",
  },
];

const PROCESSING_STEPS = [
  "Analyzing project requirements...",
  "Calculating material quantities...",
  "Reviewing regional pricing trends...",
  "Applying labor rates...",
  "Finalizing estimate...",
];

interface AIProcessingOverlayProps {
  isVisible: boolean;
  className?: string;
}

export function AIProcessingOverlay({ isVisible, className }: AIProcessingOverlayProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Rotate tips every 3 seconds
  useEffect(() => {
    if (!isVisible) return;
    
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % PRO_TIPS.length);
    }, 3000);
    
    return () => clearInterval(tipInterval);
  }, [isVisible]);

  // Animate processing steps
  useEffect(() => {
    if (!isVisible) {
      setStepIndex(0);
      setProgress(0);
      return;
    }
    
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < PROCESSING_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2000);
    
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 95) {
          return prev + Math.random() * 10;
        }
        return prev;
      });
    }, 500);
    
    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const currentTip = PRO_TIPS[tipIndex];

  return (
    <div className={cn(
      'fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6',
      className
    )}>
      {/* Sparkle icon */}
      <div className="mb-8">
        <Sparkles className="h-10 w-10 text-primary animate-pulse" />
      </div>

      {/* Pro Tip */}
      <div className="text-center max-w-sm mb-12">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          PRO TIP:
        </p>
        <p className="text-lg leading-relaxed">
          {currentTip.tip}{' '}
          <span className="text-primary font-medium">{currentTip.highlight}</span>
          {currentTip.suffix && ` ${currentTip.suffix}`}
        </p>
      </div>

      {/* Tip indicators */}
      <div className="flex gap-2 mb-8">
        {PRO_TIPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              i === tipIndex ? 'bg-primary' : 'bg-muted-foreground/30'
            )}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1 bg-muted rounded-full overflow-hidden mb-3">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {PROCESSING_STEPS[stepIndex]}
        </p>
      </div>
    </div>
  );
}

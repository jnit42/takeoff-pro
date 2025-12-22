/**
 * Client Mode Toggle Component
 * Eye icon button that toggles between showing/hiding sensitive cost data
 */

import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useClientMode } from '@/hooks/useClientMode';
import { cn } from '@/lib/utils';

interface ClientModeToggleProps {
  className?: string;
}

export function ClientModeToggle({ className }: ClientModeToggleProps) {
  const { isClientMode, toggleClientMode } = useClientMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isClientMode ? 'default' : 'outline'}
          size="icon"
          className={cn(
            'h-8 w-8 shrink-0',
            isClientMode && 'bg-primary text-primary-foreground',
            className
          )}
          onClick={toggleClientMode}
        >
          {isClientMode ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isClientMode 
          ? 'Client Mode ON - Sensitive data hidden' 
          : 'Toggle Client Mode to hide margins'}
      </TooltipContent>
    </Tooltip>
  );
}

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface OverrideBadgeProps {
  linkedValue: number;
  currentValue: number;
  overrideNote: string | null;
  onSaveNote: (note: string) => void;
}

export function OverrideBadge({ 
  linkedValue, 
  currentValue, 
  overrideNote,
  onSaveNote 
}: OverrideBadgeProps) {
  const [note, setNote] = useState(overrideNote || '');
  const [isOpen, setIsOpen] = useState(false);

  const difference = Math.abs(currentValue - linkedValue);
  const percentDiff = linkedValue > 0 ? (difference / linkedValue) * 100 : 0;

  // Only show if >5% difference
  if (percentDiff <= 5) return null;

  const handleSave = () => {
    onSaveNote(note);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Badge 
          variant="outline" 
          className={`cursor-pointer gap-1 ${
            overrideNote 
              ? 'bg-warning/20 text-warning border-warning/50' 
              : 'bg-destructive/20 text-destructive border-destructive/50'
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          OVERRIDE
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm">Quantity Override Detected</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Linked measurement: {linkedValue.toFixed(1)}<br />
              Current quantity: {currentValue.toFixed(1)}<br />
              Difference: {percentDiff.toFixed(0)}%
            </p>
          </div>
          <div>
            <label className="text-xs font-medium">Override Reason (required)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain why this quantity differs from the measurement..."
              className="mt-1 text-sm"
              rows={3}
            />
          </div>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={!note.trim()}
            className="w-full"
          >
            Save Note
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useState, useEffect } from 'react';
import { MessageCircle, Send, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  extractVariablesFromText, 
  VARIABLE_LABELS,
  getRequiredVariables,
} from '@/lib/formulaEvaluator';

interface AssemblyItem {
  description: string;
  formula: string;
  unit: string;
}

interface ConversationInputProps {
  requiredVariables: string[];
  extractedVariables: Record<string, number>;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  onSendMessage: (message: string) => void;
  onVariablesUpdate: (variables: Record<string, number>) => void;
}

export function ConversationInput({
  requiredVariables,
  extractedVariables,
  conversationHistory,
  onSendMessage,
  onVariablesUpdate,
}: ConversationInputProps) {
  const [input, setInput] = useState('');
  const [manualEditing, setManualEditing] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');

  // Get missing variables
  const missingVars = requiredVariables.filter(
    v => !(v in extractedVariables) || extractedVariables[v] === undefined
  );

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Extract variables from the message
    const newVars = extractVariablesFromText(input);
    
    // Merge with existing variables
    const merged = { ...extractedVariables, ...newVars };
    onVariablesUpdate(merged);
    
    // Add to conversation
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleManualEdit = (varName: string) => {
    setManualEditing(varName);
    setManualValue(extractedVariables[varName]?.toString() || '');
  };

  const saveManualEdit = () => {
    if (manualEditing && manualValue) {
      const value = parseFloat(manualValue);
      if (!isNaN(value)) {
        onVariablesUpdate({
          ...extractedVariables,
          [manualEditing]: value,
        });
      }
    }
    setManualEditing(null);
    setManualValue('');
  };

  const removeVariable = (varName: string) => {
    const updated = { ...extractedVariables };
    delete updated[varName];
    onVariablesUpdate(updated);
  };

  // Generate prompt for missing variables
  const generateMissingVarsPrompt = () => {
    if (missingVars.length === 0) return null;
    
    const varNames = missingVars
      .slice(0, 3)
      .map(v => VARIABLE_LABELS[v] || v.replace(/_/g, ' '))
      .join(', ');
    
    if (missingVars.length > 3) {
      return `I still need: ${varNames}, and ${missingVars.length - 3} more...`;
    }
    return `I still need: ${varNames}`;
  };

  return (
    <div className="space-y-4">
      {/* Extracted Variables Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Extracted Measurements</Label>
          <span className="text-xs text-muted-foreground">
            {Object.keys(extractedVariables).length} of {requiredVariables.length} variables
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {Object.entries(extractedVariables).map(([key, value]) => (
            <Badge 
              key={key} 
              variant="secondary" 
              className="gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => handleManualEdit(key)}
            >
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {VARIABLE_LABELS[key] || key}: {value}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeVariable(key);
                }}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          ))}
          
          {missingVars.slice(0, 5).map((key) => (
            <Badge 
              key={key} 
              variant="outline" 
              className="gap-1 cursor-pointer hover:bg-muted"
              onClick={() => handleManualEdit(key)}
            >
              <AlertCircle className="h-3 w-3 text-warning" />
              {VARIABLE_LABELS[key] || key}: ?
            </Badge>
          ))}
          
          {missingVars.length > 5 && (
            <Badge variant="outline" className="text-muted-foreground">
              +{missingVars.length - 5} more needed
            </Badge>
          )}
        </div>
      </div>

      {/* Manual Edit Modal */}
      {manualEditing && (
        <Card className="bg-muted/50">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap">
                {VARIABLE_LABELS[manualEditing] || manualEditing}:
              </Label>
              <Input
                type="number"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                className="w-32"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveManualEdit();
                  if (e.key === 'Escape') setManualEditing(null);
                }}
              />
              <Button size="sm" onClick={saveManualEdit}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setManualEditing(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation History */}
      {conversationHistory.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-muted/30">
          {conversationHistory.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          
          {/* System prompt for missing vars */}
          {generateMissingVarsPrompt() && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-warning/10 text-warning-foreground border border-warning/30">
                <Sparkles className="h-3 w-3 inline mr-1" />
                {generateMissingVarsPrompt()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Describe your project measurements
        </Label>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Example: Basement finish, 1050 SF drywall, 8 ft ceilings, 2 doors, soffit 30 LF, framing 90 LF"
            className="min-h-[80px] flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim()}
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Type naturally. The app extracts measurements like "1050 SF drywall" or "8' ceilings" automatically.
          Click any badge to manually edit.
        </p>
      </div>

      {/* Progress indicator */}
      {requiredVariables.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-300"
              style={{ 
                width: `${(Object.keys(extractedVariables).length / requiredVariables.length) * 100}%` 
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {missingVars.length === 0 ? (
              <span className="text-green-500 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> All measurements collected
              </span>
            ) : (
              `${missingVars.length} measurements needed`
            )}
          </span>
        </div>
      )}
    </div>
  );
}

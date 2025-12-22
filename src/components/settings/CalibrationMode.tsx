/**
 * Calibration Mode Component
 * Admin interface for testing AI, correcting mistakes, and storing corrections
 * Corrections are fed back to the Construction Brain for improved accuracy
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Edit3,
  Save,
  Trash2,
  AlertTriangle,
  Lightbulb,
  History,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CalibrationEntry {
  id: string;
  key: string;
  value: {
    original?: string;
    correction?: string;
    reason?: string;
    test_prompt?: string;
  };
  confidence: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface TestResult {
  success: boolean;
  reasoning: string;
  actions?: Array<{
    type: string;
    params: Record<string, unknown>;
    confidence: number;
  }>;
  confidence: number;
  warnings?: string[];
}

export function CalibrationMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for test prompt
  const [testPrompt, setTestPrompt] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTestingLoading, setIsTestingLoading] = useState(false);

  // State for correction
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionData, setCorrectionData] = useState({
    key: '',
    original: '',
    correction: '',
    reason: '',
  });

  // Fetch existing calibration corrections
  const { data: corrections = [], isLoading: correctionsLoading } = useQuery({
    queryKey: ['calibration-corrections', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_knowledge')
        .select('*')
        .eq('user_id', user!.id)
        .eq('category', 'calibration_correction')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as CalibrationEntry[];
    },
  });

  // Test prompt against Construction Brain
  const testPromptMutation = useMutation({
    mutationFn: async (prompt: string) => {
      setIsTestingLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/construction-brain`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: prompt,
            projectId: null, // Test mode, no project
            conversationId: null,
            conversationHistory: [],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      setIsTestingLoading(false);
      
      // Pre-fill correction form with the prompt
      setCorrectionData(prev => ({
        ...prev,
        key: testPrompt.slice(0, 100).replace(/[^a-zA-Z0-9\s]/g, '_').trim(),
        original: data.reasoning?.slice(0, 500) || '',
      }));
    },
    onError: (error) => {
      setIsTestingLoading(false);
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save correction mutation
  const saveCorrectionMutation = useMutation({
    mutationFn: async (data: typeof correctionData) => {
      const { error } = await supabase
        .from('ai_knowledge')
        .upsert({
          user_id: user!.id,
          category: 'calibration_correction',
          key: data.key,
          value: {
            original: data.original,
            correction: data.correction,
            reason: data.reason,
            test_prompt: testPrompt,
          },
          source: 'calibration_mode',
          confidence: 1.0,
          usage_count: 0,
        }, {
          onConflict: 'user_id,category,key',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-corrections'] });
      toast({
        title: 'Correction Saved',
        description: 'The AI will now apply this correction in future conversations.',
      });
      setShowCorrectionForm(false);
      setCorrectionData({ key: '', original: '', correction: '', reason: '' });
      setTestResult(null);
      setTestPrompt('');
    },
    onError: (error) => {
      toast({
        title: 'Failed to Save',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete correction mutation
  const deleteCorrectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_knowledge')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-corrections'] });
      toast({ title: 'Correction Deleted' });
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleTest = () => {
    if (!testPrompt.trim()) return;
    testPromptMutation.mutate(testPrompt);
  };

  const handleMarkCorrect = () => {
    toast({
      title: 'Marked as Correct',
      description: 'No correction needed. The AI got it right!',
    });
    setTestResult(null);
    setTestPrompt('');
  };

  const handleMarkIncorrect = () => {
    setShowCorrectionForm(true);
  };

  const handleSaveCorrection = () => {
    if (!correctionData.key || !correctionData.correction) {
      toast({
        title: 'Missing Fields',
        description: 'Please provide a key and the correct answer.',
        variant: 'destructive',
      });
      return;
    }
    saveCorrectionMutation.mutate(correctionData);
  };

  // Example test prompts
  const examplePrompts = [
    'Frame a 10x10 room with 1 door',
    'How many studs for a 16 foot wall?',
    'Estimate drywall for 500 SF ceiling',
    'What size header for a 6 foot opening?',
    'How many joist hangers for a 12x16 deck?',
  ];

  return (
    <div className="space-y-6">
      {/* Test Prompt Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FlaskConical className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            Calibration Mode
          </CardTitle>
          <CardDescription className="text-sm">
            Test the AI with edge cases, correct mistakes, and teach it your preferences.
            Corrections are stored and fed back to improve accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Example prompts */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Tests:</Label>
            <div className="flex flex-wrap gap-2">
              {examplePrompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setTestPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>

          {/* Test input */}
          <div className="space-y-2">
            <Label htmlFor="test-prompt">Test Prompt</Label>
            <div className="flex gap-2">
              <Textarea
                id="test-prompt"
                placeholder="Enter a construction estimation question to test..."
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                className="min-h-[60px]"
              />
              <Button
                onClick={handleTest}
                disabled={!testPrompt.trim() || isTestingLoading}
                className="shrink-0"
              >
                {isTestingLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  AI Response
                </h4>
                <Badge variant={testResult.confidence >= 0.8 ? 'default' : 'secondary'}>
                  {Math.round(testResult.confidence * 100)}% confident
                </Badge>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="whitespace-pre-wrap">{testResult.reasoning}</p>
              </div>

              {testResult.actions && testResult.actions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Proposed Actions:</Label>
                  <div className="space-y-1">
                    {testResult.actions.map((action, i) => (
                      <div key={i} className="text-xs bg-background border rounded p-2">
                        <span className="font-mono text-primary">{action.type}</span>
                        <span className="ml-2 text-muted-foreground">
                          {JSON.stringify(action.params).slice(0, 100)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testResult.warnings && testResult.warnings.length > 0 && (
                <div className="flex items-start gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    {testResult.warnings.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback buttons */}
              {!showCorrectionForm && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-600 hover:bg-green-50"
                    onClick={handleMarkCorrect}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Correct
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                    onClick={handleMarkIncorrect}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Incorrect - Add Correction
                  </Button>
                </div>
              )}

              {/* Correction Form */}
              {showCorrectionForm && (
                <div className="space-y-4 p-4 border rounded-lg bg-red-50/50 dark:bg-red-950/20">
                  <h4 className="font-medium flex items-center gap-2 text-red-700 dark:text-red-400">
                    <Edit3 className="h-4 w-4" />
                    Add Correction
                  </h4>

                  <div className="space-y-2">
                    <Label htmlFor="correction-key">Correction Key (short identifier)</Label>
                    <Input
                      id="correction-key"
                      placeholder="e.g., 10x10_room_framing"
                      value={correctionData.key}
                      onChange={(e) => setCorrectionData(prev => ({ ...prev, key: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="original-answer">AI's Original Answer (What was wrong)</Label>
                    <Textarea
                      id="original-answer"
                      placeholder="What the AI said that was incorrect..."
                      value={correctionData.original}
                      onChange={(e) => setCorrectionData(prev => ({ ...prev, original: e.target.value }))}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="correct-answer">Correct Answer</Label>
                    <Textarea
                      id="correct-answer"
                      placeholder="What the AI should have said..."
                      value={correctionData.correction}
                      onChange={(e) => setCorrectionData(prev => ({ ...prev, correction: e.target.value }))}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason / Explanation (Optional)</Label>
                    <Textarea
                      id="reason"
                      placeholder="Why is this the correct approach? (e.g., IRC code reference, field experience)"
                      value={correctionData.reason}
                      onChange={(e) => setCorrectionData(prev => ({ ...prev, reason: e.target.value }))}
                      className="min-h-[40px]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveCorrection}
                      disabled={saveCorrectionMutation.isPending}
                    >
                      {saveCorrectionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Correction
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowCorrectionForm(false);
                        setCorrectionData({ key: '', original: '', correction: '', reason: '' });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Corrections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <History className="h-4 w-4 sm:h-5 sm:w-5" />
            Saved Corrections ({corrections.length})
          </CardTitle>
          <CardDescription className="text-sm">
            These corrections are automatically fed to the AI for improved accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {correctionsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading corrections...
            </div>
          ) : corrections.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {corrections.map((correction) => (
                  <div
                    key={correction.id}
                    className="p-3 rounded-lg border bg-background"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{correction.key}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Added {new Date(correction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Correction?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the correction. The AI will no longer apply this lesson.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCorrectionMutation.mutate(correction.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <div className="space-y-2 text-xs">
                      {correction.value.original && (
                        <div>
                          <span className="text-red-600 font-medium">Wrong: </span>
                          <span className="text-muted-foreground">{correction.value.original.slice(0, 150)}...</span>
                        </div>
                      )}
                      {correction.value.correction && (
                        <div>
                          <span className="text-green-600 font-medium">Correct: </span>
                          <span>{correction.value.correction.slice(0, 150)}...</span>
                        </div>
                      )}
                      {correction.value.reason && (
                        <div>
                          <span className="text-amber-600 font-medium">Why: </span>
                          <span className="text-muted-foreground">{correction.value.reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium mb-1">No corrections yet</p>
              <p className="text-sm">
                Test the AI above and add corrections when it makes mistakes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

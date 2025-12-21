import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Wand2, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  AlertCircle,
  Loader2,
  HelpCircle,
  FileQuestion,
  ListChecks
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  PROJECT_TYPES, 
  WIZARD_QUESTIONS, 
  getQuestionsForProjectType,
  WizardQuestion 
} from '@/lib/wizardQuestions';

interface GCWizardProps {
  projectId: string;
  onComplete: () => void;
}

export function GCWizard({ projectId, onComplete }: GCWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<'type' | 'questions' | 'summary'>('type');
  const [projectType, setProjectType] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = projectType ? getQuestionsForProjectType(projectType) : [];
  const currentQuestion = questions[currentQuestionIndex];
  const progress = step === 'type' ? 0 : ((currentQuestionIndex + 1) / questions.length) * 100;

  const submitWizardMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);

      // 1. Create wizard run record
      const { data: wizardRun, error: wizardError } = await supabase
        .from('wizard_runs')
        .insert({
          project_id: projectId,
          project_type: projectType,
          answers: answers,
        })
        .select()
        .single();

      if (wizardError) throw wizardError;

      // 2. Generate RFIs for 'unknown' answers
      const rfis: { project_id: string; question: string; trade: string | null }[] = [];
      const assumptions: { project_id: string; statement: string; trade: string | null }[] = [];
      const checklistItems: { project_id: string; item: string; trade: string }[] = [];

      for (const q of questions) {
        const answer = answers[q.id];
        
        // Generate RFIs
        if (q.generateRfi && answer === 'unknown') {
          rfis.push({
            project_id: projectId,
            question: q.question,
            trade: q.trade || null,
          });
        }

        // Generate assumptions
        if (q.generateAssumption && answer) {
          const assumption = q.generateAssumption(answer);
          if (assumption) {
            assumptions.push({
              project_id: projectId,
              statement: assumption,
              trade: q.trade || null,
            });
          }
        }
      }

      // 3. Fetch assemblies for this project type and generate checklist items
      const { data: assemblies } = await supabase
        .from('assemblies')
        .select('*')
        .eq('project_type', projectType);

      if (assemblies) {
        for (const assembly of assemblies) {
          const checklistData = assembly.checklist_items as { item: string; trade: string }[] || [];
          for (const item of checklistData) {
            checklistItems.push({
              project_id: projectId,
              item: item.item,
              trade: item.trade,
            });
          }
        }
      }

      // 4. Insert RFIs
      if (rfis.length > 0) {
        const { error: rfiError } = await supabase.from('rfis').insert(rfis);
        if (rfiError) throw rfiError;
      }

      // 5. Insert assumptions
      if (assumptions.length > 0) {
        const { error: assumptionError } = await supabase.from('assumptions').insert(assumptions);
        if (assumptionError) throw assumptionError;
      }

      // 6. Insert checklist items
      if (checklistItems.length > 0) {
        const { error: checklistError } = await supabase.from('checklist_items').insert(checklistItems);
        if (checklistError) throw checklistError;
      }

      return { rfis: rfis.length, assumptions: assumptions.length, checklist: checklistItems.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
      queryClient.invalidateQueries({ queryKey: ['assumptions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['checklist-items', projectId] });
      queryClient.invalidateQueries({ queryKey: ['wizard-runs', projectId] });
      
      toast({
        title: 'GC Wizard Complete',
        description: `Generated ${data.rfis} RFIs, ${data.assumptions} assumptions, and ${data.checklist} checklist items.`,
      });
      
      setIsSubmitting(false);
      onComplete();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setIsSubmitting(false);
    },
  });

  const handleSelectProjectType = (type: string) => {
    setProjectType(type);
    setStep('questions');
  };

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: value });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setStep('summary');
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else {
      setStep('type');
      setProjectType('');
    }
  };

  // Count RFIs and assumptions that will be generated
  const pendingRfis = questions.filter(q => q.generateRfi && answers[q.id] === 'unknown').length;
  const pendingAssumptions = questions.filter(q => {
    if (!q.generateAssumption) return false;
    const answer = answers[q.id];
    return answer && q.generateAssumption(answer);
  }).length;

  if (step === 'type') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-accent" />
            GC Wizard
          </CardTitle>
          <CardDescription>
            Answer questions to build your RFIs, assumptions, and checklist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Select your project type to get started:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROJECT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => handleSelectProjectType(type.value)}
                className="flex items-center gap-3 p-4 rounded-lg border hover:border-accent hover:bg-accent/5 transition-colors text-left"
              >
                <span className="text-2xl">{type.icon}</span>
                <span className="font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'questions' && currentQuestion) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            {currentQuestion.trade && (
              <span className="text-xs bg-muted px-2 py-1 rounded-full">
                {currentQuestion.trade}
              </span>
            )}
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">{currentQuestion.question}</h3>
            <RadioGroup
              value={answers[currentQuestion.id] || ''}
              onValueChange={handleAnswer}
              className="space-y-3"
            >
              {currentQuestion.options.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                    {option.label}
                  </Label>
                  {option.value === 'unknown' && (
                    <HelpCircle className="h-4 w-4 text-warning" />
                  )}
                </div>
              ))}
            </RadioGroup>
          </div>

          {answers[currentQuestion.id] === 'unknown' && currentQuestion.generateRfi && (
            <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              This will generate an RFI for clarification
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              variant="accent"
              onClick={handleNext}
              disabled={!answers[currentQuestion.id]}
            >
              {currentQuestionIndex === questions.length - 1 ? 'Review' : 'Next'}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'summary') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-success" />
            Review & Complete
          </CardTitle>
          <CardDescription>
            Review what will be generated from your answers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileQuestion className="h-5 w-5 text-warning" />
                  <span className="font-semibold">RFIs</span>
                </div>
                <p className="text-2xl font-mono">{pendingRfis}</p>
                <p className="text-xs text-muted-foreground">items need clarification</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-info" />
                  <span className="font-semibold">Assumptions</span>
                </div>
                <p className="text-2xl font-mono">{pendingAssumptions}</p>
                <p className="text-xs text-muted-foreground">will be documented</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="h-5 w-5 text-success" />
                  <span className="font-semibold">Checklist</span>
                </div>
                <p className="text-2xl font-mono">—</p>
                <p className="text-xs text-muted-foreground">from assemblies</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Your Answers:</h4>
            <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
              {questions.map((q) => (
                <div key={q.id} className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground truncate mr-4">{q.question}</span>
                  <span className="font-medium">
                    {q.options.find(o => o.value === answers[q.id])?.label || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep('questions')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Questions
            </Button>
            <Button
              variant="accent"
              onClick={() => submitWizardMutation.mutate()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Complete Wizard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Wand2, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  AlertCircle,
  Loader2,
  HelpCircle,
  FileQuestion,
  ListChecks,
  Package,
  MessageCircle
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
  getQuestionsForProjectType,
} from '@/lib/wizardQuestions';
import { 
  evaluateFormula, 
  getRequiredVariables,
  extractVariablesFromText,
} from '@/lib/formulaEvaluator';
import { AssemblySelector } from './AssemblySelector';
import { ConversationInput } from './ConversationInput';

interface GCWizardProps {
  projectId: string;
  onComplete: () => void;
}

type WizardStep = 'type' | 'questions' | 'assemblies' | 'conversation' | 'summary';

interface AssemblyItem {
  description: string;
  formula: string;
  unit: string;
}

interface ChecklistItem {
  item: string;
  trade: string;
}

interface Assembly {
  id: string;
  name: string;
  description: string | null;
  trade: string;
  project_type: string;
  items: AssemblyItem[];
  checklist_items: ChecklistItem[];
}

export function GCWizard({ projectId, onComplete }: GCWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<WizardStep>('type');
  const [projectType, setProjectType] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedAssemblyIds, setSelectedAssemblyIds] = useState<string[]>([]);
  const [extractedVariables, setExtractedVariables] = useState<Record<string, number>>({});
  const [conversationHistory, setConversationHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = projectType ? getQuestionsForProjectType(projectType) : [];
  const currentQuestion = questions[currentQuestionIndex];
  
  // Calculate progress based on current step
  const getProgress = () => {
    if (step === 'type') return 0;
    if (step === 'questions') return ((currentQuestionIndex + 1) / questions.length) * 25;
    if (step === 'assemblies') return 25 + 25;
    if (step === 'conversation') return 50 + 25;
    return 100;
  };

  // Fetch assemblies for selected IDs
  const { data: selectedAssemblies = [] } = useQuery({
    queryKey: ['selected-assemblies', selectedAssemblyIds],
    queryFn: async () => {
      if (selectedAssemblyIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('assemblies')
        .select('*')
        .in('id', selectedAssemblyIds);
      
      if (error) throw error;
      
      return (data || []).map(a => ({
        ...a,
        items: (a.items as unknown as AssemblyItem[]) || [],
        checklist_items: (a.checklist_items as unknown as ChecklistItem[]) || [],
      })) as Assembly[];
    },
    enabled: selectedAssemblyIds.length > 0,
  });

  // Get all required variables from selected assemblies
  const allItems = selectedAssemblies.flatMap(a => a.items);
  const requiredVariables = getRequiredVariables(allItems);
  const missingVariables = requiredVariables.filter(v => !(v in extractedVariables));

  const submitWizardMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);

      // 1. Create wizard run record with conversation data
      const { data: wizardRun, error: wizardError } = await supabase
        .from('wizard_runs')
        .insert({
          project_id: projectId,
          project_type: projectType,
          answers: {
            ...answers,
            selected_assemblies: selectedAssemblyIds,
            extracted_variables: extractedVariables,
            conversation_history: conversationHistory,
          },
        })
        .select()
        .single();

      if (wizardError) throw wizardError;

      // 2. Generate RFIs, assumptions, checklist items
      const rfis: { project_id: string; question: string; trade: string | null }[] = [];
      const assumptions: { project_id: string; statement: string; trade: string | null }[] = [];
      const checklistItems: { project_id: string; item: string; trade: string }[] = [];
      const draftTakeoffItems: {
        project_id: string;
        category: string;
        description: string;
        unit: string;
        quantity: number;
        waste_percent: number;
        draft: boolean;
        notes: string;
      }[] = [];

      // Generate RFIs and assumptions from wizard questions
      for (const q of questions) {
        const answer = answers[q.id];
        
        if (q.generateRfi && answer === 'unknown') {
          rfis.push({
            project_id: projectId,
            question: q.question,
            trade: q.trade || null,
          });
        }

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

      // 3. Process selected assemblies
      for (const assembly of selectedAssemblies) {
        // Add checklist items
        for (const item of assembly.checklist_items) {
          checklistItems.push({
            project_id: projectId,
            item: item.item,
            trade: item.trade,
          });
        }

        // Evaluate formulas and create draft takeoff items
        for (const item of assembly.items) {
          const { result, missingVars } = evaluateFormula(item.formula, extractedVariables);
          
          if (missingVars.length > 0) {
            // Create RFI for missing variables
            const missingLabels = missingVars.join(', ');
            rfis.push({
              project_id: projectId,
              question: `Missing measurement for "${item.description}": need ${missingLabels}`,
              trade: assembly.trade,
            });
          } else if (result !== null && result > 0) {
            draftTakeoffItems.push({
              project_id: projectId,
              category: assembly.trade,
              description: item.description,
              unit: item.unit,
              quantity: result,
              waste_percent: 10,
              draft: true,
              notes: `Generated from ${assembly.name} | Formula: ${item.formula}`,
            });
          }
        }
      }

      // 4. Insert all records
      if (rfis.length > 0) {
        // Remove duplicates
        const uniqueRfis = rfis.filter((rfi, index, self) =>
          index === self.findIndex(r => r.question === rfi.question)
        );
        const { error: rfiError } = await supabase.from('rfis').insert(uniqueRfis);
        if (rfiError) throw rfiError;
      }

      if (assumptions.length > 0) {
        const { error: assumptionError } = await supabase.from('assumptions').insert(assumptions);
        if (assumptionError) throw assumptionError;
      }

      if (checklistItems.length > 0) {
        // Remove duplicates
        const uniqueChecklist = checklistItems.filter((item, index, self) =>
          index === self.findIndex(c => c.item === item.item && c.trade === item.trade)
        );
        const { error: checklistError } = await supabase.from('checklist_items').insert(uniqueChecklist);
        if (checklistError) throw checklistError;
      }

      if (draftTakeoffItems.length > 0) {
        const { error: takeoffError } = await supabase.from('takeoff_items').insert(draftTakeoffItems);
        if (takeoffError) throw takeoffError;
      }

      return { 
        rfis: rfis.length, 
        assumptions: assumptions.length, 
        checklist: checklistItems.length,
        drafts: draftTakeoffItems.length,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
      queryClient.invalidateQueries({ queryKey: ['assumptions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['checklist-items', projectId] });
      queryClient.invalidateQueries({ queryKey: ['wizard-runs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
      
      toast({
        title: 'GC Wizard Complete',
        description: `Generated ${data.drafts} draft takeoff items, ${data.rfis} RFIs, ${data.assumptions} assumptions, and ${data.checklist} checklist items.`,
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
    if (step === 'questions') {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        setStep('assemblies');
      }
    } else if (step === 'assemblies') {
      setStep('conversation');
      // Add initial assistant message
      if (conversationHistory.length === 0) {
        setConversationHistory([{
          role: 'assistant',
          content: `Great! I'll help you with your ${projectType.replace('_', ' ')}. Please describe your measurements - things like wall lengths, square footage, door counts, ceiling height, etc.`,
        }]);
      }
    } else if (step === 'conversation') {
      setStep('summary');
    }
  };

  const handleBack = () => {
    if (step === 'questions') {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
      } else {
        setStep('type');
        setProjectType('');
      }
    } else if (step === 'assemblies') {
      setStep('questions');
      setCurrentQuestionIndex(questions.length - 1);
    } else if (step === 'conversation') {
      setStep('assemblies');
    } else if (step === 'summary') {
      setStep('conversation');
    }
  };

  const handleSendMessage = (message: string) => {
    setConversationHistory([
      ...conversationHistory,
      { role: 'user', content: message },
    ]);
  };

  // Count RFIs and assumptions that will be generated
  const pendingRfis = questions.filter(q => q.generateRfi && answers[q.id] === 'unknown').length + missingVariables.length;
  const pendingAssumptions = questions.filter(q => {
    if (!q.generateAssumption) return false;
    const answer = answers[q.id];
    return answer && q.generateAssumption(answer);
  }).length;

  // Calculate expected draft items
  const expectedDrafts = allItems.filter(item => {
    const { result, missingVars } = evaluateFormula(item.formula, extractedVariables);
    return missingVars.length === 0 && result !== null && result > 0;
  }).length;

  // Step 1: Select Project Type
  if (step === 'type') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-accent" />
            GC Wizard
          </CardTitle>
          <CardDescription>
            Build your takeoff through a guided conversation
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

  // Step 2: Wizard Questions
  if (step === 'questions' && currentQuestion) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Step 1: Questions — {currentQuestionIndex + 1} of {questions.length}
            </span>
            {currentQuestion.trade && (
              <span className="text-xs bg-muted px-2 py-1 rounded-full">
                {currentQuestion.trade}
              </span>
            )}
          </div>
          <Progress value={getProgress()} className="h-2" />
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
              {currentQuestionIndex === questions.length - 1 ? 'Select Assemblies' : 'Next'}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 3: Select Assemblies
  if (step === 'assemblies') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Step 2: Select Assemblies
            </span>
            <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">
              {selectedAssemblyIds.length} selected
            </span>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <AssemblySelector
            projectType={projectType}
            selectedAssemblies={selectedAssemblyIds}
            onSelectionChange={setSelectedAssemblyIds}
          />

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              variant="accent"
              onClick={handleNext}
              disabled={selectedAssemblyIds.length === 0}
            >
              Enter Measurements
              <MessageCircle className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 4: Conversational Input
  if (step === 'conversation') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Step 3: Enter Measurements
            </span>
            <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">
              {Object.keys(extractedVariables).length} / {requiredVariables.length} collected
            </span>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <ConversationInput
            requiredVariables={requiredVariables}
            extractedVariables={extractedVariables}
            conversationHistory={conversationHistory}
            onSendMessage={handleSendMessage}
            onVariablesUpdate={setExtractedVariables}
          />

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              variant="accent"
              onClick={handleNext}
            >
              Review & Generate
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 5: Summary
  if (step === 'summary') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-success" />
            Review & Complete
          </CardTitle>
          <CardDescription>
            Review what will be generated from your inputs
          </CardDescription>
          <Progress value={100} className="h-2 mt-4" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="bg-accent/10 border-accent/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-accent" />
                  <span className="font-semibold">Drafts</span>
                </div>
                <p className="text-2xl font-mono">{expectedDrafts}</p>
                <p className="text-xs text-muted-foreground">takeoff items</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileQuestion className="h-5 w-5 text-warning" />
                  <span className="font-semibold">RFIs</span>
                </div>
                <p className="text-2xl font-mono">{pendingRfis}</p>
                <p className="text-xs text-muted-foreground">need clarification</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-info" />
                  <span className="font-semibold">Assumptions</span>
                </div>
                <p className="text-2xl font-mono">{pendingAssumptions}</p>
                <p className="text-xs text-muted-foreground">documented</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="h-5 w-5 text-success" />
                  <span className="font-semibold">Checklist</span>
                </div>
                <p className="text-2xl font-mono">
                  {selectedAssemblies.reduce((sum, a) => sum + a.checklist_items.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">from assemblies</p>
              </CardContent>
            </Card>
          </div>

          {/* Extracted Variables Summary */}
          <div className="space-y-2">
            <h4 className="font-medium">Collected Measurements:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(extractedVariables).map(([key, value]) => (
                <span key={key} className="text-sm bg-muted px-2 py-1 rounded">
                  {key.replace(/_/g, ' ')}: <strong>{value}</strong>
                </span>
              ))}
              {Object.keys(extractedVariables).length === 0 && (
                <span className="text-sm text-muted-foreground">No measurements entered</span>
              )}
            </div>
          </div>

          {/* Missing Variables Warning */}
          {missingVariables.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span className="font-medium text-warning">Missing Measurements</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                The following measurements are needed but not provided. RFIs will be created for items that require them:
              </p>
              <div className="flex flex-wrap gap-1">
                {missingVariables.map(v => (
                  <span key={v} className="text-xs bg-warning/20 px-2 py-0.5 rounded">
                    {v.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
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
              Generate Takeoff
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

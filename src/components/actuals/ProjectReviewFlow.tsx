/**
 * Project Review Flow Component
 * Guided post-project review to capture lessons learned
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle,
  XCircle,
  Star,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Send,
  Loader2,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProjectReviewFlowProps {
  projectId: string;
  projectName?: string;
  onComplete?: () => void;
  className?: string;
}

type Step = 'overview' | 'accuracy' | 'variances' | 'lessons' | 'contribute' | 'complete';

interface ReviewData {
  overall_accuracy_rating: number;
  on_time: boolean | null;
  on_budget: boolean | null;
  what_worked: string;
  what_didnt_work: string;
  recommendations: string;
  pricing_variances: Array<{ item: string; estimated: number; actual: number; reason: string }>;
  contribute_to_global: boolean;
}

export function ProjectReviewFlow({ projectId, projectName, onComplete, className }: ProjectReviewFlowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<Step>('overview');
  const [reviewData, setReviewData] = useState<ReviewData>({
    overall_accuracy_rating: 0,
    on_time: null,
    on_budget: null,
    what_worked: '',
    what_didnt_work: '',
    recommendations: '',
    pricing_variances: [],
    contribute_to_global: true,
  });

  // Fetch existing review if any
  const { data: existingReview } = useQuery({
    queryKey: ['project-review', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_reviews')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Save review mutation
  const saveReviewMutation = useMutation({
    mutationFn: async (data: ReviewData) => {
      const payload = {
        project_id: projectId,
        overall_accuracy_rating: data.overall_accuracy_rating,
        on_time: data.on_time,
        on_budget: data.on_budget,
        what_worked: data.what_worked || null,
        what_didnt_work: data.what_didnt_work || null,
        recommendations: data.recommendations || null,
        pricing_variances: data.pricing_variances,
        contribute_to_global: data.contribute_to_global,
        status: 'completed',
        completed_at: new Date().toISOString(),
      };

      if (existingReview?.id) {
        const { error } = await supabase
          .from('project_reviews')
          .update(payload)
          .eq('id', existingReview.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_reviews')
          .insert(payload);
        if (error) throw error;
      }

      // Contribute to global knowledge if enabled
      if (data.contribute_to_global) {
        await supabase.functions.invoke('contribute-global-knowledge', {
          body: {
            projectId,
            contributions: [
              // This would include actual rate data from the project
              // For now we're just setting up the structure
            ]
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-review', projectId] });
      toast({ title: 'Review saved successfully!' });
      setStep('complete');
    },
    onError: (error) => {
      toast({ title: 'Failed to save review', description: error.message, variant: 'destructive' });
    },
  });

  const steps: Step[] = ['overview', 'accuracy', 'variances', 'lessons', 'contribute', 'complete'];
  const currentStepIndex = steps.indexOf(step);

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const handleSubmit = () => {
    saveReviewMutation.mutate(reviewData);
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-accent/5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-primary" />
          Project Review
        </CardTitle>
        <CardDescription>
          {projectName ? `Reviewing: ${projectName}` : 'Capture lessons learned to improve future estimates'}
        </CardDescription>
        
        {/* Progress indicator */}
        <div className="flex items-center gap-1 mt-4">
          {steps.slice(0, -1).map((s, idx) => (
            <div
              key={s}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-colors',
                idx < currentStepIndex ? 'bg-primary' :
                idx === currentStepIndex ? 'bg-primary/60' :
                'bg-muted'
              )}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Step: Overview */}
        {step === 'overview' && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Let's Review This Project</h3>
              <p className="text-muted-foreground text-sm">
                Take a few minutes to reflect on how this project went. Your insights help improve 
                future estimates—both for you and for all users of the platform.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={reviewData.on_time === true ? 'default' : 'outline'}
                className="h-auto py-4 flex-col gap-2"
                onClick={() => setReviewData(prev => ({ ...prev, on_time: true }))}
              >
                <CheckCircle className="h-5 w-5" />
                <span>On Time</span>
              </Button>
              <Button
                variant={reviewData.on_time === false ? 'destructive' : 'outline'}
                className="h-auto py-4 flex-col gap-2"
                onClick={() => setReviewData(prev => ({ ...prev, on_time: false }))}
              >
                <XCircle className="h-5 w-5" />
                <span>Delayed</span>
              </Button>
              <Button
                variant={reviewData.on_budget === true ? 'default' : 'outline'}
                className="h-auto py-4 flex-col gap-2"
                onClick={() => setReviewData(prev => ({ ...prev, on_budget: true }))}
              >
                <TrendingDown className="h-5 w-5" />
                <span>On/Under Budget</span>
              </Button>
              <Button
                variant={reviewData.on_budget === false ? 'destructive' : 'outline'}
                className="h-auto py-4 flex-col gap-2"
                onClick={() => setReviewData(prev => ({ ...prev, on_budget: false }))}
              >
                <TrendingUp className="h-5 w-5" />
                <span>Over Budget</span>
              </Button>
            </div>
          </div>
        )}

        {/* Step: Accuracy Rating */}
        {step === 'accuracy' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">How Accurate Was Your Estimate?</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Rate the overall accuracy of your initial estimate
              </p>
            </div>
            
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setReviewData(prev => ({ ...prev, overall_accuracy_rating: rating }))}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-all hover:scale-105',
                    reviewData.overall_accuracy_rating >= rating
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-primary/50'
                  )}
                >
                  <Star
                    className={cn(
                      'h-8 w-8 transition-colors',
                      reviewData.overall_accuracy_rating >= rating
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
            
            <div className="text-center text-sm text-muted-foreground">
              {reviewData.overall_accuracy_rating === 1 && 'Way off - major gaps'}
              {reviewData.overall_accuracy_rating === 2 && 'Below expectations'}
              {reviewData.overall_accuracy_rating === 3 && 'Acceptable - some variance'}
              {reviewData.overall_accuracy_rating === 4 && 'Good - minor adjustments'}
              {reviewData.overall_accuracy_rating === 5 && 'Excellent - spot on'}
            </div>
          </div>
        )}

        {/* Step: Variances */}
        {step === 'variances' && (
          <div className="space-y-6">
            <div className="text-center">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-warning" />
              <h3 className="text-lg font-semibold mb-2">What Had Major Variances?</h3>
              <p className="text-muted-foreground text-sm">
                Which items were significantly different from your estimate?
              </p>
            </div>
            
            <Textarea
              placeholder="Examples:
• Framing labor was 20% higher due to complex roof
• Electrical materials cost more than quoted
• Concrete came in under budget"
              value={reviewData.what_didnt_work}
              onChange={(e) => setReviewData(prev => ({ ...prev, what_didnt_work: e.target.value }))}
              className="min-h-[150px]"
            />
          </div>
        )}

        {/* Step: Lessons */}
        {step === 'lessons' && (
          <div className="space-y-6">
            <div className="text-center">
              <Lightbulb className="h-10 w-10 mx-auto mb-3 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Lessons Learned</h3>
              <p className="text-muted-foreground text-sm">
                What would you do differently next time?
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">What worked well?</Label>
                <Textarea
                  placeholder="List things that went according to plan..."
                  value={reviewData.what_worked}
                  onChange={(e) => setReviewData(prev => ({ ...prev, what_worked: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium mb-2 block">Recommendations for next time</Label>
                <Textarea
                  placeholder="What would you change or do differently?"
                  value={reviewData.recommendations}
                  onChange={(e) => setReviewData(prev => ({ ...prev, recommendations: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step: Contribute */}
        {step === 'contribute' && (
          <div className="space-y-6">
            <div className="text-center">
              <Send className="h-10 w-10 mx-auto mb-3 text-accent" />
              <h3 className="text-lg font-semibold mb-2">Help Everyone Get Better</h3>
              <p className="text-muted-foreground text-sm">
                Your actual costs (anonymized) can help improve estimates for all users
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="font-medium">Contribute to Global Learning</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Share anonymized cost data to improve accuracy for everyone
                  </p>
                </div>
                <Switch
                  checked={reviewData.contribute_to_global}
                  onCheckedChange={(checked) => setReviewData(prev => ({ ...prev, contribute_to_global: checked }))}
                />
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground text-center">
              <p>We never share your project details, client info, or identifiable data.</p>
              <p>Only anonymized cost rates and productivity metrics are contributed.</p>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <h3 className="text-xl font-semibold mb-2">Review Complete!</h3>
            <p className="text-muted-foreground mb-6">
              Your insights have been saved. Thank you for contributing to better estimates.
            </p>
            <Button onClick={onComplete}>
              Return to Project
            </Button>
          </div>
        )}

        {/* Navigation */}
        {step !== 'complete' && (
          <div className="flex justify-between mt-8 pt-4 border-t">
            <Button
              variant="ghost"
              onClick={goPrev}
              disabled={currentStepIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            {step === 'contribute' ? (
              <Button 
                onClick={handleSubmit}
                disabled={saveReviewMutation.isPending}
              >
                {saveReviewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Complete Review
              </Button>
            ) : (
              <Button onClick={goNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

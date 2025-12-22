/**
 * Learning Settings Component
 * Shows learning stats and allows users to manage their learning data
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Trash2, ToggleLeft, ToggleRight, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { useLearning } from '@/hooks/useLearning';

export function LearningSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { 
    getLearningStats, 
    clearLearningData, 
    setLearningEnabled, 
    isLearningEnabled 
  } = useLearning();

  const [enabled, setEnabled] = useState(true);

  // Fetch learning stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['learning-stats'],
    queryFn: getLearningStats,
  });

  // Check if learning is enabled
  useEffect(() => {
    isLearningEnabled().then(setEnabled);
  }, [isLearningEnabled]);

  // Toggle learning mutation
  const toggleMutation = useMutation({
    mutationFn: async (newEnabled: boolean) => {
      const success = await setLearningEnabled(newEnabled);
      if (!success) throw new Error('Failed to update setting');
      return newEnabled;
    },
    onSuccess: (newEnabled) => {
      setEnabled(newEnabled);
      toast({
        title: newEnabled ? 'Learning enabled' : 'Learning disabled',
        description: newEnabled 
          ? 'The app will learn from your choices to provide better suggestions.'
          : 'The app will no longer learn from your choices.',
      });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update learning settings', 
        variant: 'destructive' 
      });
    },
  });

  // Clear data mutation
  const clearMutation = useMutation({
    mutationFn: clearLearningData,
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['learning-stats'] });
        toast({
          title: 'Learning data cleared',
          description: 'All your learning data has been deleted.',
        });
      } else {
        throw new Error('Failed to clear data');
      }
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to clear learning data', 
        variant: 'destructive' 
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Learning Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            Learning Suggestions
          </CardTitle>
          <CardDescription className="text-sm">
            Allow the app to learn from your choices and provide personalized suggestions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="learning-toggle" className="text-sm font-medium">
                Enable learning
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, the app remembers your labor rates, assembly selections, and material preferences
              </p>
            </div>
            <Switch
              id="learning-toggle"
              checked={enabled}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Learning Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            Learning Stats
          </CardTitle>
          <CardDescription className="text-sm">
            What the app has learned from your usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stats...
            </div>
          ) : stats ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-accent">{stats.laborCalibrations}</div>
                <div className="text-xs text-muted-foreground mt-1">Labor Rate Calibrations</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-accent">{stats.assemblyPresets}</div>
                <div className="text-xs text-muted-foreground mt-1">Assembly Presets</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-accent">{stats.totalEvents}</div>
                <div className="text-xs text-muted-foreground mt-1">Events Logged</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No learning data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Clear Data */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-destructive">
            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
            Clear Learning Data
          </CardTitle>
          <CardDescription className="text-sm">
            Permanently delete all learned preferences and calibrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                disabled={clearMutation.isPending || (stats?.totalEvents === 0 && stats?.laborCalibrations === 0 && stats?.assemblyPresets === 0)}
              >
                {clearMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Learning Data
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all learning data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your labor rate calibrations, assembly presets, 
                  and logged events. The app will no longer provide personalized suggestions until 
                  it learns from your new usage. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear All Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

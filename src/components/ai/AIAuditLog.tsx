/**
 * AI Audit Log Component
 * View AI decisions, reasoning, and accuracy tracking
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Brain,
  Check,
  X,
  Edit,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Target,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface AIAuditLogProps {
  projectId?: string;
  className?: string;
}

interface AIDecision {
  id: string;
  input_text: string;
  decision_type: string;
  output_reasoning: string;
  confidence_score: number;
  confidence_factors: string[];
  data_sources_used: string[];
  user_response: string | null;
  was_accurate: boolean | null;
  decided_at: string;
}

export function AIAuditLog({ projectId, className }: AIAuditLogProps) {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch AI decisions
  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ['ai-decisions', projectId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('ai_decisions')
        .select('*')
        .order('decided_at', { ascending: false })
        .limit(50);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AIDecision[];
    },
    enabled: !!user,
  });

  // Calculate accuracy metrics
  const metrics = {
    total: decisions.length,
    accepted: decisions.filter(d => d.user_response === 'accepted').length,
    modified: decisions.filter(d => d.user_response === 'modified').length,
    rejected: decisions.filter(d => d.user_response === 'rejected').length,
    pending: decisions.filter(d => !d.user_response).length,
    avgConfidence: decisions.length > 0
      ? decisions.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / decisions.length
      : 0,
    accuracyRate: (() => {
      const withOutcome = decisions.filter(d => d.was_accurate !== null);
      if (withOutcome.length === 0) return null;
      const accurate = withOutcome.filter(d => d.was_accurate).length;
      return (accurate / withOutcome.length) * 100;
    })(),
  };

  const getResponseIcon = (response: string | null) => {
    switch (response) {
      case 'accepted': return <Check className="h-3.5 w-3.5 text-green-600" />;
      case 'modified': return <Edit className="h-3.5 w-3.5 text-amber-600" />;
      case 'rejected': return <X className="h-3.5 w-3.5 text-red-600" />;
      default: return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getResponseLabel = (response: string | null) => {
    switch (response) {
      case 'accepted': return 'Accepted';
      case 'modified': return 'Modified';
      case 'rejected': return 'Rejected';
      default: return 'Pending';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4" />
          AI Decision Audit
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metrics Summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold">{metrics.total}</p>
            <p className="text-xs text-muted-foreground">Decisions</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-center">
            <p className="text-2xl font-bold text-green-600">{metrics.accepted}</p>
            <p className="text-xs text-muted-foreground">Accepted</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-center">
            <p className="text-2xl font-bold text-amber-600">{metrics.modified}</p>
            <p className="text-xs text-muted-foreground">Modified</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold">{metrics.avgConfidence.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Avg Confidence</p>
          </div>
        </div>

        {/* Accuracy Rate */}
        {metrics.accuracyRate !== null && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" />
                Verified Accuracy Rate
              </span>
              <span className="text-lg font-bold text-primary">
                {metrics.accuracyRate.toFixed(1)}%
              </span>
            </div>
            <Progress value={metrics.accuracyRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Based on actual project outcomes vs AI predictions
            </p>
          </div>
        )}

        {/* Decision List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : decisions.length > 0 ? (
          <ScrollArea className="h-[350px]">
            <div className="space-y-2">
              {decisions.map((decision) => (
                <Collapsible
                  key={decision.id}
                  open={expandedId === decision.id}
                  onOpenChange={() => setExpandedId(expandedId === decision.id ? null : decision.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {decision.input_text.slice(0, 60)}
                              {decision.input_text.length > 60 ? '...' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(decision.decided_at)}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {decision.decision_type}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Confidence */}
                          <span className={cn('text-sm font-medium', getConfidenceColor(decision.confidence_score || 0))}>
                            {decision.confidence_score?.toFixed(0)}%
                          </span>

                          {/* User response */}
                          <Badge 
                            variant="secondary" 
                            className="gap-1 text-[10px]"
                          >
                            {getResponseIcon(decision.user_response)}
                            {getResponseLabel(decision.user_response)}
                          </Badge>

                          {/* Expand icon */}
                          {expandedId === decision.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 space-y-3 bg-muted/20 rounded-b-lg border-x border-b -mt-1">
                      {/* Reasoning */}
                      {decision.output_reasoning && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">AI Reasoning</p>
                          <p className="text-sm bg-background p-2 rounded border">
                            {decision.output_reasoning}
                          </p>
                        </div>
                      )}

                      {/* Confidence Factors */}
                      {decision.confidence_factors && decision.confidence_factors.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Confidence Factors</p>
                          <div className="flex flex-wrap gap-1">
                            {decision.confidence_factors.map((factor, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Data Sources */}
                      {decision.data_sources_used && decision.data_sources_used.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Data Sources Used</p>
                          <div className="flex flex-wrap gap-1">
                            {decision.data_sources_used.map((source, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">
                                <Info className="h-2.5 w-2.5 mr-1" />
                                {source}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Accuracy indicator */}
                      {decision.was_accurate !== null && (
                        <div className={cn(
                          'flex items-center gap-2 p-2 rounded text-sm',
                          decision.was_accurate 
                            ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                        )}>
                          {decision.was_accurate ? (
                            <>
                              <Check className="h-4 w-4" />
                              Verified accurate based on actual results
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4" />
                              Actual results differed from prediction
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No AI decisions yet</p>
            <p className="text-sm">Decisions will appear here as you use the Command Center</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

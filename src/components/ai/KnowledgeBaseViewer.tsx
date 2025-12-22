/**
 * Knowledge Base Viewer Component
 * View and manage the AI's construction knowledge
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BookOpen,
  Search,
  Filter,
  TrendingUp,
  Database,
  RefreshCw,
  ChevronDown,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface KnowledgeBaseViewerProps {
  className?: string;
}

interface KnowledgeEntry {
  id: string;
  knowledge_type: string;
  trade: string | null;
  category: string | null;
  key: string;
  display_name: string;
  description: string | null;
  value: number | null;
  unit: string | null;
  avg_value: number | null;
  min_value: number | null;
  max_value: number | null;
  sample_count: number;
  confidence_score: number;
  last_validated_at: string | null;
  is_system_seeded: boolean;
}

const KNOWLEDGE_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'labor_rate', label: 'Labor Rates' },
  { value: 'material_cost', label: 'Material Costs' },
  { value: 'waste_factor', label: 'Waste Factors' },
  { value: 'productivity', label: 'Productivity' },
];

export function KnowledgeBaseViewer({ className }: KnowledgeBaseViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Fetch knowledge entries
  const { data: knowledge = [], isLoading, refetch } = useQuery({
    queryKey: ['construction-knowledge', typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('construction_knowledge')
        .select('*')
        .order('confidence_score', { ascending: false })
        .limit(100);

      if (typeFilter !== 'all') {
        query = query.eq('knowledge_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as KnowledgeEntry[];
    },
  });

  // Filter by search
  const filteredKnowledge = searchQuery
    ? knowledge.filter(k => 
        k.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.trade?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : knowledge;

  // Calculate stats
  const stats = {
    total: knowledge.length,
    highConfidence: knowledge.filter(k => k.confidence_score >= 0.8).length,
    lowConfidence: knowledge.filter(k => k.confidence_score < 0.5).length,
    systemSeeded: knowledge.filter(k => k.is_system_seeded).length,
    userContributed: knowledge.filter(k => !k.is_system_seeded).length,
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const formatValue = (entry: KnowledgeEntry) => {
    if (entry.value === null) return '-';
    
    if (entry.knowledge_type === 'waste_factor' || entry.knowledge_type === 'productivity') {
      return `${entry.value}${entry.unit || ''}`;
    }
    
    return `$${entry.value.toFixed(2)}/${entry.unit || 'EA'}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTypeLabel = (type: string) => {
    const found = KNOWLEDGE_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Knowledge Base
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>

        {/* Search and filter */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                {getTypeLabel(typeFilter)}
                <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {KNOWLEDGE_TYPES.map(type => (
                <DropdownMenuItem 
                  key={type.value}
                  onClick={() => setTypeFilter(type.value)}
                >
                  {type.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-muted/50">
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total Entries</p>
          </div>
          <div className="p-2 rounded bg-green-50 dark:bg-green-950/30">
            <p className="text-lg font-bold text-green-600">{stats.highConfidence}</p>
            <p className="text-[10px] text-muted-foreground">High Confidence</p>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <p className="text-lg font-bold">{stats.systemSeeded}</p>
            <p className="text-[10px] text-muted-foreground">System Data</p>
          </div>
          <div className="p-2 rounded bg-primary/5">
            <p className="text-lg font-bold text-primary">{stats.userContributed}</p>
            <p className="text-[10px] text-muted-foreground">Learned</p>
          </div>
        </div>

        {/* Knowledge entries */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredKnowledge.length > 0 ? (
          <ScrollArea className="h-[350px]">
            <div className="space-y-2">
              {filteredKnowledge.map((entry) => (
                <TooltipProvider key={entry.id}>
                  <div className="p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{entry.display_name}</p>
                          {entry.trade && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {entry.trade}
                            </Badge>
                          )}
                          {entry.is_system_seeded && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              <Database className="h-2.5 w-2.5 mr-0.5" />
                              System
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {formatValue(entry)}
                          </span>
                          <span>{entry.sample_count} samples</span>
                          <span>Updated: {formatDate(entry.last_validated_at)}</span>
                        </div>
                      </div>

                      {/* Confidence indicator */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-16">
                              <Progress 
                                value={entry.confidence_score * 100} 
                                className="h-1.5"
                              />
                            </div>
                            <span className="text-xs font-medium w-8">
                              {(entry.confidence_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1">
                            <p className="font-medium">Confidence: {(entry.confidence_score * 100).toFixed(1)}%</p>
                            {entry.min_value !== null && entry.max_value !== null && (
                              <p>Range: ${entry.min_value.toFixed(2)} - ${entry.max_value.toFixed(2)}</p>
                            )}
                            <p>Based on {entry.sample_count} data points</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Range visualization */}
                    {entry.min_value !== null && entry.max_value !== null && entry.avg_value !== null && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>${entry.min_value.toFixed(2)}</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full relative">
                            <div 
                              className="absolute h-2 w-2 bg-primary rounded-full top-1/2 -translate-y-1/2"
                              style={{
                                left: `${((entry.avg_value - entry.min_value) / (entry.max_value - entry.min_value)) * 100}%`
                              }}
                            />
                          </div>
                          <span>${entry.max_value.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </TooltipProvider>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No knowledge found</p>
            <p className="text-sm">
              {searchQuery ? 'Try a different search term' : 'Knowledge will be added as the AI learns'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

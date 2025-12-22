/**
 * Subcontractor Manager Component
 * Manage subs, track their quotes, and analyze patterns
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Users,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Phone,
  Mail,
  MapPin,
  MoreVertical,
  Edit,
  Trash2,
  History,
  ChevronRight,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SubcontractorManagerProps {
  projectId?: string;
  className?: string;
}

interface Subcontractor {
  id: string;
  name: string;
  company_name: string | null;
  trade: string;
  phone: string | null;
  email: string | null;
  region: string | null;
  total_projects: number;
  avg_quote_accuracy: number | null;
  avg_vs_market: number | null;
  reliability_score: number | null;
  notes: string | null;
}

const TRADES = [
  'framing', 'drywall', 'electrical', 'plumbing', 'hvac', 'roofing',
  'siding', 'painting', 'flooring', 'tile', 'concrete', 'excavation',
  'landscaping', 'insulation', 'windows', 'doors', 'cabinets', 'countertops',
  'general', 'other'
];

export function SubcontractorManager({ projectId, className }: SubcontractorManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcontractor | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [newSub, setNewSub] = useState({
    name: '',
    company_name: '',
    trade: 'general',
    phone: '',
    email: '',
    region: '',
    notes: '',
  });

  // Fetch subcontractors
  const { data: subcontractors = [], isLoading } = useQuery({
    queryKey: ['subcontractors', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Subcontractor[];
    },
    enabled: !!user,
  });

  // Add subcontractor mutation
  const addSubMutation = useMutation({
    mutationFn: async (sub: typeof newSub) => {
      const { error } = await supabase.from('subcontractors').insert({
        name: sub.name,
        company_name: sub.company_name || null,
        trade: sub.trade,
        phone: sub.phone || null,
        email: sub.email || null,
        region: sub.region || null,
        notes: sub.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
      toast({ title: 'Subcontractor added' });
      setShowAddDialog(false);
      setNewSub({ name: '', company_name: '', trade: 'general', phone: '', email: '', region: '', notes: '' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add subcontractor', description: error.message, variant: 'destructive' });
    },
  });

  // Delete subcontractor mutation
  const deleteSubMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subcontractors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
      toast({ title: 'Subcontractor deleted' });
    },
  });

  // Filter by trade
  const filteredSubs = selectedTrade === 'all'
    ? subcontractors
    : subcontractors.filter(s => s.trade === selectedTrade);

  // Get unique trades from subs
  const activeTrades = [...new Set(subcontractors.map(s => s.trade))];

  const getMarketBadge = (avgVsMarket: number | null) => {
    if (avgVsMarket === null) return null;
    if (avgVsMarket < -5) return { icon: TrendingDown, label: `${avgVsMarket.toFixed(0)}%`, color: 'text-green-600 bg-green-50' };
    if (avgVsMarket > 5) return { icon: TrendingUp, label: `+${avgVsMarket.toFixed(0)}%`, color: 'text-red-600 bg-red-50' };
    return { icon: Minus, label: 'Market rate', color: 'text-muted-foreground bg-muted' };
  };

  const getReliabilityStars = (score: number | null) => {
    if (score === null) return 0;
    return Math.round(score / 20); // 0-100 → 0-5 stars
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Subcontractors
          </CardTitle>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Sub
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Subcontractor</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Name *</Label>
                    <Input
                      value={newSub.name}
                      onChange={(e) => setNewSub({ ...newSub, name: e.target.value })}
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={newSub.company_name}
                      onChange={(e) => setNewSub({ ...newSub, company_name: e.target.value })}
                      placeholder="Smith Framing LLC"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trade *</Label>
                    <Select value={newSub.trade} onValueChange={(v) => setNewSub({ ...newSub, trade: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRADES.map(t => (
                          <SelectItem key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Input
                      value={newSub.region}
                      onChange={(e) => setNewSub({ ...newSub, region: e.target.value })}
                      placeholder="Rhode Island"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={newSub.phone}
                      onChange={(e) => setNewSub({ ...newSub, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newSub.email}
                      onChange={(e) => setNewSub({ ...newSub, email: e.target.value })}
                      placeholder="john@smithframing.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newSub.notes}
                    onChange={(e) => setNewSub({ ...newSub, notes: e.target.value })}
                    placeholder="Any notes about this subcontractor..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button 
                  onClick={() => addSubMutation.mutate(newSub)}
                  disabled={!newSub.name || addSubMutation.isPending}
                >
                  Add Subcontractor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Trade filter */}
        {activeTrades.length > 1 && (
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
            <Badge
              variant={selectedTrade === 'all' ? 'default' : 'outline'}
              className="cursor-pointer shrink-0"
              onClick={() => setSelectedTrade('all')}
            >
              All ({subcontractors.length})
            </Badge>
            {activeTrades.map(trade => (
              <Badge
                key={trade}
                variant={selectedTrade === trade ? 'default' : 'outline'}
                className="cursor-pointer shrink-0"
                onClick={() => setSelectedTrade(trade)}
              >
                {trade.charAt(0).toUpperCase() + trade.slice(1)}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredSubs.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredSubs.map((sub) => {
                const marketBadge = getMarketBadge(sub.avg_vs_market);
                const stars = getReliabilityStars(sub.reliability_score);

                return (
                  <div
                    key={sub.id}
                    className="p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{sub.name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {sub.trade}
                          </Badge>
                        </div>
                        {sub.company_name && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" />
                            {sub.company_name}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {sub.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {sub.phone}
                            </span>
                          )}
                          {sub.region && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {sub.region}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Market comparison badge */}
                        {marketBadge && (
                          <Badge variant="secondary" className={cn('text-xs gap-1', marketBadge.color)}>
                            <marketBadge.icon className="h-3 w-3" />
                            {marketBadge.label}
                          </Badge>
                        )}

                        {/* Reliability stars */}
                        {stars > 0 && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(i => (
                              <Star
                                key={i}
                                className={cn(
                                  'h-3 w-3',
                                  i <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-muted'
                                )}
                              />
                            ))}
                          </div>
                        )}

                        {/* Actions menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <History className="h-4 w-4 mr-2" />
                              View History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingSub(sub)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteSubMutation.mutate(sub.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Stats row */}
                    {sub.total_projects > 0 && (
                      <div className="flex items-center gap-4 mt-2 pt-2 border-t text-xs">
                        <span className="text-muted-foreground">
                          {sub.total_projects} project{sub.total_projects !== 1 ? 's' : ''}
                        </span>
                        {sub.avg_quote_accuracy !== null && (
                          <span className="text-muted-foreground">
                            {sub.avg_quote_accuracy.toFixed(0)}% quote accuracy
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No subcontractors yet</p>
            <p className="text-sm mb-4">Add your subs to track their pricing patterns</p>
            <Button variant="outline" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Subcontractor
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

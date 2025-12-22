import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Calculator, 
  ChevronDown,
  Eye,
  EyeOff,
  CheckCircle2,
  FileUp,
  Trash,
  RefreshCw,
  Check,
  Clock,
  HelpCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { PlanLinkBadge } from './PlanLinkBadge';
import { OverrideBadge } from './OverrideBadge';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { TAKEOFF_CATEGORIES, UNITS, formatCurrency, formatNumber } from '@/lib/constants';

interface TakeoffItem {
  id: string;
  category: string;
  description: string;
  spec: string | null;
  unit: string;
  quantity: number;
  waste_percent: number | null;
  adjusted_qty: number | null;
  package_size: number | null;
  packages: number | null;
  unit_cost: number | null;
  extended_cost: number | null;
  vendor: string | null;
  phase: string | null;
  notes: string | null;
  sort_order: number | null;
  draft: boolean | null;
}

interface TakeoffBuilderProps {
  projectId: string;
  project: {
    waste_percent: number | null;
    tax_percent: number | null;
  };
}

type PriceStatus = 'verified' | 'stale' | 'unknown';

interface PriceResult {
  source: 'global_cache' | 'price_book' | 'knowledge_base' | 'scraped_fresh';
  status: PriceStatus;
  price: number | null;
  unit: string;
  productName: string;
  confidence: number;
  store?: string;
  productUrl?: string;
  note?: string;
}

// Track price status per item
interface ItemPriceStatus {
  status: PriceStatus;
  price: number | null;
  store?: string;
  lastUpdated?: string;
}

export function TakeoffBuilder({ projectId, project }: TakeoffBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showDrafts, setShowDrafts] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [priceResults, setPriceResults] = useState<Record<string, PriceResult[]>>({});
  const [itemPriceStatus, setItemPriceStatus] = useState<Record<string, ItemPriceStatus>>({});
  const [loadingPriceFor, setLoadingPriceFor] = useState<string | null>(null);
  const [priceLookupItem, setPriceLookupItem] = useState<TakeoffItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['takeoff-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('takeoff_items')
        .select('*')
        .eq('project_id', projectId)
        .order('category')
        .order('sort_order');

      if (error) throw error;
      return data as TakeoffItem[];
    },
  });

  // Fetch project for zip code
  const { data: projectData } = useQuery({
    queryKey: ['project-details', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('zip_code, region')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Initial price check - get cached prices for all items (no scraping)
  const { data: initialPrices, isLoading: isLoadingInitialPrices } = useQuery({
    queryKey: ['initial-prices', projectId, items.map(i => i.description).join(',')],
    queryFn: async () => {
      if (items.length === 0) return null;
      
      const descriptions = items.slice(0, 10).map(i => i.description);
      const { data, error } = await supabase.functions.invoke('price-lookup', {
        body: { 
          items: descriptions,
          zipCode: projectData?.zip_code || undefined,
          forceRefresh: false, // Never auto-scrape
        }
      });
      if (error) throw error;
      return data;
    },
    enabled: items.length > 0 && !!projectData,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Update price status when initial prices load
  useState(() => {
    if (initialPrices?.results) {
      const newStatus: Record<string, ItemPriceStatus> = {};
      for (const [desc, results] of Object.entries(initialPrices.results as Record<string, PriceResult[]>)) {
        const best = results[0];
        if (best) {
          const item = items.find(i => i.description === desc);
          if (item) {
            newStatus[item.id] = {
              status: best.status,
              price: best.price,
              store: best.store,
            };
          }
        }
      }
      setItemPriceStatus(prev => ({ ...prev, ...newStatus }));
    }
  });

  // Single item price refresh (triggers scrape)
  const refreshSinglePrice = async (item: TakeoffItem) => {
    setLoadingPriceFor(item.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('price-lookup', {
        body: { 
          items: [item.description],
          zipCode: projectData?.zip_code || undefined,
          forceRefresh: true, // This triggers scraping
        }
      });
      
      if (error) throw error;
      
      if (data.success && data.results?.[item.description]) {
        const results = data.results[item.description] as PriceResult[];
        setPriceResults(prev => ({ ...prev, [item.description]: results }));
        
        const best = results[0];
        if (best) {
          setItemPriceStatus(prev => ({
            ...prev,
            [item.id]: {
              status: best.status,
              price: best.price,
              store: best.store,
            }
          }));
          
          toast({ 
            title: 'Price Updated', 
            description: best.price 
              ? `$${best.price.toFixed(2)} from ${best.store || 'cache'}` 
              : 'No price found'
          });
        }
        
        // Open dialog to show options
        setPriceLookupItem(item);
      }
    } catch (error: any) {
      toast({ 
        title: 'Price lookup failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setLoadingPriceFor(null);
    }
  };

  // Apply price from lookup
  const applyPrice = (itemId: string, price: number, vendor: string) => {
    updateItemMutation.mutate({ 
      id: itemId, 
      updates: { unit_cost: price, vendor } 
    });
    
    // Mark as verified since user confirmed
    setItemPriceStatus(prev => ({
      ...prev,
      [itemId]: { status: 'verified', price, store: vendor }
    }));
    
    toast({ title: `Applied $${price.toFixed(2)} from ${vendor}` });
  };

  // Fetch blueprint measurements for all items in this project
  const { data: allMeasurements = [] } = useQuery({
    queryKey: ['blueprint-measurements-project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blueprint_measurements')
        .select('id, takeoff_item_id, value, unit, plan_file_id, page_number')
        .eq('project_id', projectId);
      if (error) throw error;
      return data;
    },
  });

  // Fetch plan files for sheet labels
  const { data: planFiles = [] } = useQuery({
    queryKey: ['plan-files', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_files')
        .select('id, sheet_label, filename')
        .eq('project_id', projectId);
      if (error) throw error;
      return data;
    },
  });

  // Build map of takeoff_item_id -> measurements with sheet labels
  const measurementsByItem = allMeasurements.reduce((acc, m) => {
    if (m.takeoff_item_id) {
      if (!acc[m.takeoff_item_id]) acc[m.takeoff_item_id] = [];
      const planFile = planFiles.find(p => p.id === m.plan_file_id);
      acc[m.takeoff_item_id].push({
        ...m,
        sheet_label: planFile?.sheet_label || planFile?.filename || 'Plan'
      });
    }
    return acc;
  }, {} as Record<string, Array<typeof allMeasurements[0] & { sheet_label: string }>>);

  const addItemMutation = useMutation({
    mutationFn: async (category: string) => {
      const { data, error } = await supabase
        .from('takeoff_items')
        .insert({
          project_id: projectId,
          category,
          description: 'New Item',
          unit: 'EA',
          quantity: 0,
          waste_percent: project.waste_percent || 10,
          draft: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TakeoffItem> }) => {
      const { error } = await supabase
        .from('takeoff_items')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('takeoff_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.clear();
        return next;
      });
      toast({ title: 'Item deleted' });
    },
  });

  const promoteDraftsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('takeoff_items')
        .update({ draft: false })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
      setSelectedItems(new Set());
      toast({ title: `Promoted ${ids.length} items to active` });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteDraftsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('takeoff_items')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
      setSelectedItems(new Set());
      toast({ title: `Deleted ${ids.length} items` });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Filter items based on draft visibility
  const filteredItems = showDrafts ? items : items.filter(item => !item.draft);
  
  // Count drafts and active
  const draftCount = items.filter(item => item.draft).length;
  const activeCount = items.filter(item => !item.draft).length;

  // Get draft items for bulk actions
  const draftItems = items.filter(item => item.draft);
  const selectedDrafts = Array.from(selectedItems).filter(id => 
    draftItems.some(item => item.id === id)
  );

  // Group items by category
  const itemsByCategory = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, TakeoffItem[]>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAllDrafts = () => {
    setSelectedItems(new Set(draftItems.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleInputChange = (
    id: string,
    field: keyof TakeoffItem,
    value: string | number
  ) => {
    const numericFields = ['quantity', 'waste_percent', 'package_size', 'unit_cost'];
    const finalValue = numericFields.includes(field) ? Number(value) || 0 : value;
    updateItemMutation.mutate({ id, updates: { [field]: finalValue } });
  };

  const handlePromoteSelected = () => {
    if (selectedDrafts.length > 0) {
      promoteDraftsMutation.mutate(selectedDrafts);
    }
  };

  const handlePromoteAll = () => {
    const allDraftIds = draftItems.map(item => item.id);
    if (allDraftIds.length > 0) {
      promoteDraftsMutation.mutate(allDraftIds);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedDrafts.length > 0) {
      deleteDraftsMutation.mutate(selectedDrafts);
    }
  };

  const handleDeleteAllDrafts = () => {
    const allDraftIds = draftItems.map(item => item.id);
    if (allDraftIds.length > 0) {
      deleteDraftsMutation.mutate(allDraftIds);
    }
  };

  // Get price status icon/color for an item
  const getPriceStatusIndicator = (item: TakeoffItem) => {
    // If user has manually set a price, treat as verified
    if (item.unit_cost && item.unit_cost > 0 && item.vendor) {
      return { status: 'verified' as PriceStatus, icon: Check, color: 'text-green-500' };
    }
    
    const cachedStatus = itemPriceStatus[item.id];
    if (cachedStatus) {
      switch (cachedStatus.status) {
        case 'verified':
          return { status: 'verified' as PriceStatus, icon: Check, color: 'text-green-500' };
        case 'stale':
          return { status: 'stale' as PriceStatus, icon: Clock, color: 'text-muted-foreground' };
        case 'unknown':
          return { status: 'unknown' as PriceStatus, icon: HelpCircle, color: 'text-yellow-500' };
      }
    }
    
    // No status yet
    return { status: 'unknown' as PriceStatus, icon: HelpCircle, color: 'text-muted-foreground' };
  };

  // Calculate totals (only for active items)
  const activeItems = items.filter(item => !item.draft);
  const subtotal = activeItems.reduce((sum, item) => sum + (Number(item.extended_cost) || 0), 0);
  const tax = subtotal * ((project.tax_percent || 0) / 100);
  const total = subtotal + tax;

  // Calculate category totals
  const categoryTotals = Object.entries(itemsByCategory).reduce((acc, [cat, catItems]) => {
    acc[cat] = catItems
      .filter(item => !item.draft)
      .reduce((sum, item) => sum + (Number(item.extended_cost) || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Draft Management Bar */}
      {draftCount > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="bg-warning/20 text-warning border-warning/50">
                  {draftCount} Draft{draftCount !== 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDrafts(!showDrafts)}
                  className="gap-2"
                >
                  {showDrafts ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Hide Drafts
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Show Drafts
                    </>
                  )}
                </Button>
                {showDrafts && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllDrafts}
                    >
                      Select All Drafts
                    </Button>
                    {selectedItems.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                      >
                        Clear ({selectedItems.size})
                      </Button>
                    )}
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {selectedDrafts.length > 0 ? (
                  <>
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={handlePromoteSelected}
                      disabled={promoteDraftsMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Promote Selected ({selectedDrafts.length})
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash className="h-4 w-4 mr-1" />
                          Delete Selected
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {selectedDrafts.length} draft items?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteSelected}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={handlePromoteAll}
                      disabled={promoteDraftsMutation.isPending || draftCount === 0}
                    >
                      <FileUp className="h-4 w-4 mr-1" />
                      Promote All Drafts
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-destructive">
                          <Trash className="h-4 w-4 mr-1" />
                          Delete All Drafts
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete all {draftCount} draft items?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteAllDrafts}>
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Item Section - REMOVED bulk "Check Live Prices" button */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Add Line Item</CardTitle>
              <CardDescription>Select a category to add a new takeoff item</CardDescription>
            </div>
            {/* Price legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" /> Verified
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Stale
              </span>
              <span className="flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-yellow-500" /> Unknown
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TAKEOFF_CATEGORIES.slice(0, 12).map((category) => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                onClick={() => {
                  addItemMutation.mutate(category);
                  setExpandedCategories(new Set([...expandedCategories, category]));
                }}
                disabled={addItemMutation.isPending}
              >
                <Plus className="h-3 w-3 mr-1" />
                {category}
              </Button>
            ))}
            <Select
              onValueChange={(value) => {
                addItemMutation.mutate(value);
                setExpandedCategories(new Set([...expandedCategories, value]));
              }}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="More..." />
              </SelectTrigger>
              <SelectContent>
                {TAKEOFF_CATEGORIES.slice(12).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Price Lookup Dialog */}
      <Dialog open={!!priceLookupItem} onOpenChange={(open) => !open && setPriceLookupItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Price Options: {priceLookupItem?.description}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {priceResults[priceLookupItem?.description || '']?.length > 0 ? (
              priceResults[priceLookupItem?.description || ''].map((result, idx) => (
                <Card key={idx} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {result.status === 'verified' && <Check className="h-4 w-4 text-green-500" />}
                        {result.status === 'stale' && <Clock className="h-4 w-4 text-muted-foreground" />}
                        {result.status === 'unknown' && <HelpCircle className="h-4 w-4 text-yellow-500" />}
                        <span className="font-medium capitalize">{result.store || result.source}</span>
                        <Badge variant={result.status === 'verified' ? 'default' : 'secondary'} className="text-xs">
                          {result.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px] mt-1">
                        {result.productName}
                      </p>
                      {result.price && (
                        <p className="text-lg font-mono font-bold text-primary mt-1">
                          ${result.price.toFixed(2)}/{result.unit}
                        </p>
                      )}
                      {result.note && (
                        <p className="text-xs text-muted-foreground mt-1">{result.note}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {result.price && priceLookupItem && (
                        <Button
                          size="sm"
                          onClick={() => {
                            applyPrice(priceLookupItem.id, result.price!, result.store || 'Cache');
                            setPriceLookupItem(null);
                          }}
                        >
                          Apply
                        </Button>
                      )}
                      {result.productUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(result.productUrl, '_blank')}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No prices found</p>
                <p className="text-xs mt-1">Try editing the description to be more specific</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Takeoff Table by Category */}
      {Object.keys(itemsByCategory).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No takeoff items yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {draftCount > 0 && !showDrafts 
                ? `You have ${draftCount} draft items hidden. Click "Show Drafts" to see them.`
                : 'Add your first line item by selecting a category above, or run the GC Wizard to generate items from your project scope.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(itemsByCategory).map(([category, catItems]) => (
            <Collapsible
              key={category}
              open={expandedCategories.has(category)}
              onOpenChange={() => toggleCategory(category)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${
                            expandedCategories.has(category) ? '' : '-rotate-90'
                          }`}
                        />
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{category}</CardTitle>
                          {catItems.some(item => item.draft) && (
                            <Badge variant="outline" className="bg-warning/20 text-warning border-warning/50 text-xs">
                              {catItems.filter(item => item.draft).length} draft
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{catItems.length} items</CardDescription>
                      </div>
                      <span className="font-mono text-lg font-semibold">
                        {formatCurrency(categoryTotals[category])}
                      </span>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {showDrafts && draftCount > 0 && (
                              <TableHead className="w-[40px]"></TableHead>
                            )}
                            <TableHead className="w-[200px]">Description</TableHead>
                            <TableHead className="w-[100px]">Spec</TableHead>
                            <TableHead className="w-[80px]">Unit</TableHead>
                            <TableHead className="w-[80px] text-right">Qty</TableHead>
                            <TableHead className="w-[70px] text-right">Waste%</TableHead>
                            <TableHead className="w-[80px] text-right">Adj Qty</TableHead>
                            <TableHead className="w-[70px] text-right">Pkg Size</TableHead>
                            <TableHead className="w-[70px] text-right">Pkgs</TableHead>
                            <TableHead className="w-[120px] text-right">Unit $</TableHead>
                            <TableHead className="w-[100px] text-right">Extended</TableHead>
                            <TableHead className="w-[120px]">Vendor</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catItems.map((item) => {
                            const priceIndicator = getPriceStatusIndicator(item);
                            const StatusIcon = priceIndicator.icon;
                            const isLoadingThis = loadingPriceFor === item.id;
                            
                            return (
                              <TableRow 
                                key={item.id}
                                className={item.draft ? 'bg-warning/5' : ''}
                              >
                                {showDrafts && draftCount > 0 && (
                                  <TableCell>
                                    {item.draft && (
                                      <Checkbox
                                        checked={selectedItems.has(item.id)}
                                        onCheckedChange={() => toggleSelectItem(item.id)}
                                      />
                                    )}
                                  </TableCell>
                                )}
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {item.draft && (
                                      <Badge variant="outline" className="bg-warning/20 text-warning border-warning/50 text-xs shrink-0">
                                        Draft
                                      </Badge>
                                    )}
                                    <Input
                                      value={item.description}
                                      onChange={(e) =>
                                        handleInputChange(item.id, 'description', e.target.value)
                                      }
                                      className="h-8"
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={item.spec || ''}
                                    onChange={(e) =>
                                      handleInputChange(item.id, 'spec', e.target.value)
                                    }
                                    className="h-8"
                                    placeholder="..."
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={item.unit}
                                    onValueChange={(value) =>
                                      handleInputChange(item.id, 'unit', value)
                                    }
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {UNITS.map((unit) => (
                                        <SelectItem key={unit} value={unit}>
                                          {unit}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleInputChange(item.id, 'quantity', e.target.value)
                                    }
                                    className="h-8 text-right font-mono"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={item.waste_percent || 0}
                                    onChange={(e) =>
                                      handleInputChange(item.id, 'waste_percent', e.target.value)
                                    }
                                    className="h-8 text-right font-mono"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  {formatNumber(item.adjusted_qty || 0, 2)}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={item.package_size || 1}
                                    onChange={(e) =>
                                      handleInputChange(item.id, 'package_size', e.target.value)
                                    }
                                    className="h-8 text-right font-mono"
                                  />
                                </TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  {item.packages || 0}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {/* Status indicator */}
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className={`shrink-0 ${priceIndicator.color}`}>
                                            <StatusIcon className="h-4 w-4" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {priceIndicator.status === 'verified' && 'Price verified'}
                                          {priceIndicator.status === 'stale' && 'Price may be outdated - click refresh'}
                                          {priceIndicator.status === 'unknown' && 'No price data - click refresh'}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.unit_cost || 0}
                                      onChange={(e) =>
                                        handleInputChange(item.id, 'unit_cost', e.target.value)
                                      }
                                      className="h-8 text-right font-mono w-20"
                                    />
                                    
                                    {/* Refresh button - LAZY LOAD per item */}
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={() => refreshSinglePrice(item)}
                                            disabled={isLoadingThis}
                                          >
                                            {isLoadingThis ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <RefreshCw className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Get live price from stores</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                  {formatCurrency(item.extended_cost || 0)}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={item.vendor || ''}
                                    onChange={(e) =>
                                      handleInputChange(item.id, 'vendor', e.target.value)
                                    }
                                    className="h-8"
                                    placeholder="..."
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteItemMutation.mutate(item.id)}
                                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Summary */}
      {activeCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Items</span>
                  <span className="font-mono">{activeCount}</span>
                </div>
                {draftCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Draft Items</span>
                    <span className="font-mono text-warning">{draftCount}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({project.tax_percent || 0}%)
                  </span>
                  <span className="font-mono">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total</span>
                  <span className="font-mono text-accent">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

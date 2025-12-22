/**
 * Actuals Tab Component
 * Main container for all project actuals features
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Receipt,
  BarChart3,
  BookOpen,
  Plus,
  Upload,
  DollarSign,
  History
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ReceiptUploader } from './ReceiptUploader';
import { VarianceDashboard } from './VarianceDashboard';
import { ProjectReviewFlow } from './ProjectReviewFlow';
import { cn } from '@/lib/utils';

interface ActualsTabProps {
  projectId: string;
  projectName?: string;
  className?: string;
}

export function ActualsTab({ projectId, projectName, className }: ActualsTabProps) {
  const [activeTab, setActiveTab] = useState<'variance' | 'receipts' | 'review'>('variance');
  const [showUploader, setShowUploader] = useState(false);

  // Fetch receipts for this project
  const { data: receipts = [], refetch: refetchReceipts } = useQuery({
    queryKey: ['receipts', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch actuals summary
  const { data: actualsSummary } = useQuery({
    queryKey: ['actuals-summary', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_actuals')
        .select('estimated_amount, actual_amount, variance_amount')
        .eq('project_id', projectId);

      if (error) throw error;
      
      const completed = data.filter(a => a.actual_amount !== null);
      return {
        total: data.length,
        completed: completed.length,
        totalEstimated: data.reduce((sum, a) => sum + (a.estimated_amount || 0), 0),
        totalActual: completed.reduce((sum, a) => sum + (a.actual_amount || 0), 0),
        totalVariance: completed.reduce((sum, a) => sum + (a.variance_amount || 0), 0),
      };
    },
    enabled: !!projectId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const handleUploadComplete = () => {
    setShowUploader(false);
    refetchReceipts();
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Summary Header */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Receipt className="h-3.5 w-3.5" />
            Receipts
          </div>
          <p className="text-lg font-bold">{receipts.length}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            Estimated
          </div>
          <p className="text-lg font-bold">{formatCurrency(actualsSummary?.totalEstimated || 0)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <History className="h-3.5 w-3.5" />
            Actual
          </div>
          <p className="text-lg font-bold">{formatCurrency(actualsSummary?.totalActual || 0)}</p>
        </Card>
        <Card className={cn(
          'p-3',
          (actualsSummary?.totalVariance || 0) > 0 ? 'bg-destructive/5' : 'bg-green-500/5'
        )}>
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <BarChart3 className="h-3.5 w-3.5" />
            Variance
          </div>
          <p className={cn(
            'text-lg font-bold',
            (actualsSummary?.totalVariance || 0) > 0 ? 'text-destructive' : 'text-green-600'
          )}>
            {(actualsSummary?.totalVariance || 0) >= 0 ? '+' : ''}{formatCurrency(actualsSummary?.totalVariance || 0)}
          </p>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs 
        value={activeTab} 
        onValueChange={(v) => setActiveTab(v as typeof activeTab)} 
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="variance" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Variance
            </TabsTrigger>
            <TabsTrigger value="receipts" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Receipts
              {receipts.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {receipts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Review
            </TabsTrigger>
          </TabsList>

          <Dialog open={showUploader} onOpenChange={setShowUploader}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload Receipt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Receipt</DialogTitle>
              </DialogHeader>
              <ReceiptUploader 
                projectId={projectId} 
                onUploadComplete={handleUploadComplete}
              />
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="variance" className="flex-1 m-0 overflow-auto">
          <VarianceDashboard projectId={projectId} />
        </TabsContent>

        <TabsContent value="receipts" className="flex-1 m-0 overflow-auto">
          <ScrollArea className="h-full">
            {receipts.length > 0 ? (
              <div className="space-y-3">
                {receipts.map((receipt) => (
                  <Card key={receipt.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">
                            {receipt.vendor_name || receipt.filename}
                          </p>
                          <Badge 
                            variant={
                              receipt.ocr_status === 'completed' ? 'default' :
                              receipt.ocr_status === 'processing' ? 'secondary' :
                              receipt.ocr_status === 'failed' ? 'destructive' :
                              'outline'
                            }
                            className="text-[10px]"
                          >
                            {receipt.ocr_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {receipt.receipt_date && <span>{receipt.receipt_date}</span>}
                          {receipt.total_amount && (
                            <span className="font-medium text-foreground">
                              {formatCurrency(receipt.total_amount)}
                            </span>
                          )}
                          {receipt.line_items && Array.isArray(receipt.line_items) && (
                            <span>{receipt.line_items.length} items</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium mb-1">No receipts yet</p>
                <p className="text-sm mb-4">Upload receipts to automatically extract costs</p>
                <Button variant="outline" onClick={() => setShowUploader(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload First Receipt
                </Button>
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="review" className="flex-1 m-0 overflow-auto">
          <ProjectReviewFlow 
            projectId={projectId} 
            projectName={projectName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

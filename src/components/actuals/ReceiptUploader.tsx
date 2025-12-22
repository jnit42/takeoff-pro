/**
 * Receipt Uploader Component
 * Upload and OCR receipts/invoices for a project
 */

import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  Camera, 
  FileText, 
  Loader2, 
  Check, 
  X, 
  Receipt,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReceiptUploaderProps {
  projectId: string;
  onUploadComplete?: (receiptId: string) => void;
  className?: string;
}

interface ExtractedData {
  vendor_name: string | null;
  receipt_date: string | null;
  total_amount: number | null;
  line_items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total: number;
  }>;
  confidence: number;
}

export function ReceiptUploader({ projectId, onUploadComplete, className }: ReceiptUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({ 
        title: 'Invalid file type', 
        description: 'Please upload a JPEG, PNG, WebP, or PDF file',
        variant: 'destructive' 
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({ 
        title: 'File too large', 
        description: 'Maximum file size is 10MB',
        variant: 'destructive' 
      });
      return;
    }

    setError(null);
    setExtractedData(null);
    setIsUploading(true);

    try {
      // Create preview
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }

      // Upload to storage
      const filePath = `${projectId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

      if (uploadError) {
        console.error('[ReceiptUploader] Upload error:', uploadError);
        throw new Error('Failed to upload file');
      }

      // Create receipt record
      const { data: receipt, error: insertError } = await supabase
        .from('receipts')
        .insert({
          project_id: projectId,
          file_path: filePath,
          filename: file.name,
          file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
          ocr_status: 'processing',
        })
        .select()
        .single();

      if (insertError) {
        console.error('[ReceiptUploader] Insert error:', insertError);
        throw new Error('Failed to create receipt record');
      }

      setIsUploading(false);
      setIsProcessing(true);

      // Convert file to base64 for OCR
      const base64 = await fileToBase64(file);

      // Call OCR edge function
      const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('receipt-ocr', {
        body: {
          imageBase64: base64,
          projectId,
          receiptId: receipt.id,
        }
      });

      if (ocrError) {
        console.error('[ReceiptUploader] OCR error:', ocrError);
        throw new Error('Failed to process receipt');
      }

      if (ocrResult?.success && ocrResult?.data) {
        setExtractedData(ocrResult.data);
        toast({ title: 'Receipt processed successfully!' });
        onUploadComplete?.(receipt.id);
      } else {
        throw new Error(ocrResult?.error || 'OCR processing failed');
      }

    } catch (err) {
      console.error('[ReceiptUploader] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      toast({ 
        title: 'Processing failed', 
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive' 
      });
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" />
          Upload Receipt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        {!previewUrl && !extractedData && (
          <div 
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">Drop receipt here or click to upload</p>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or PDF up to 10MB</p>
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                Camera
              </Button>
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Browse
              </Button>
            </div>
          </div>
        )}

        {/* Processing state */}
        {(isUploading || isProcessing) && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {isUploading ? 'Uploading...' : 'Processing receipt with AI...'}
            </p>
          </div>
        )}

        {/* Preview */}
        {previewUrl && !isProcessing && !isUploading && (
          <div className="relative">
            <img 
              src={previewUrl} 
              alt="Receipt preview" 
              className="w-full max-h-48 object-contain rounded-lg bg-muted"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={handleClear} className="ml-auto">
              Try Again
            </Button>
          </div>
        )}

        {/* Extracted data */}
        {extractedData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">Extraction Complete</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {Math.round((extractedData.confidence || 0) * 100)}% confidence
              </Badge>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p className="text-sm font-medium truncate">{extractedData.vendor_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium">{extractedData.receipt_date || 'Unknown'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(extractedData.total_amount)}</p>
              </div>
            </div>

            {/* Line items */}
            {extractedData.line_items && extractedData.line_items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {extractedData.line_items.length} Items Extracted
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {extractedData.line_items.map((item, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-background border text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-medium shrink-0 ml-2">{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button className="flex-1" size="sm">
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Add to Actuals
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear}>
                Upload Another
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

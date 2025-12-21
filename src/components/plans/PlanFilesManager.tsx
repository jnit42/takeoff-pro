import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Trash2, Loader2, File, Image, Eye, Ruler, PenTool } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { GuidedTakeoff } from './GuidedTakeoff';
import { BlueprintViewer } from './BlueprintViewer';

interface PlanFile {
  id: string;
  filename: string;
  file_path: string;
  sheet_label: string | null;
  sheet_title: string | null;
  scale: string | null;
  notes: string | null;
  uploaded_at: string;
}

interface PlanFilesManagerProps {
  projectId: string;
  /** Auto-open this plan file when provided (from Command Center navigation) */
  planFileId?: string;
}

export function PlanFilesManager({ projectId, planFileId }: PlanFilesManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [guidedTakeoffFile, setGuidedTakeoffFile] = useState<PlanFile | null>(null);
  const [viewerFile, setViewerFile] = useState<PlanFile | null>(null);

  const { data: planFiles = [], isLoading } = useQuery({
    queryKey: ['plan-files', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_files')
        .select('*')
        .eq('project_id', projectId)
        .order('sheet_label')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data as PlanFile[];
    },
  });

  // Auto-open plan file if planFileId is provided (from Command Center navigation)
  useEffect(() => {
    if (planFileId && planFiles.length > 0) {
      const targetFile = planFiles.find((pf) => pf.id === planFileId);
      if (targetFile && !viewerFile) {
        setViewerFile(targetFile);
      }
    }
  }, [planFileId, planFiles, viewerFile]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${projectId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('plan-files').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data, error } = await supabase
        .from('plan_files')
        .insert({ project_id: projectId, filename: file.name, file_path: filePath })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-files', projectId] });
      toast({ title: 'File uploaded successfully' });
      setUploading(false);
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      setUploading(false);
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PlanFile> }) => {
      const { error } = await supabase.from('plan_files').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan-files', projectId] }),
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (file: PlanFile) => {
      await supabase.storage.from('plan-files').remove([file.file_path]);
      const { error } = await supabase.from('plan_files').delete().eq('id', file.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-files', projectId] });
      toast({ title: 'File deleted' });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach((file) => uploadMutation.mutate(file));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return FileText;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return Image;
    return File;
  };

  const handleViewFile = async (file: PlanFile) => {
    // Open in-app viewer for PDFs, external for images
    if (file.filename.toLowerCase().endsWith('.pdf')) {
      setViewerFile(file);
    } else {
      const { data } = await supabase.storage.from('plan-files').createSignedUrl(file.file_path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    }
  };

  // Show Blueprint Viewer
  if (viewerFile) {
    return (
      <BlueprintViewer
        projectId={projectId}
        planFileId={viewerFile.id}
        filename={viewerFile.filename}
        filePath={viewerFile.file_path}
        onClose={() => setViewerFile(null)}
      />
    );
  }

  if (guidedTakeoffFile) {
    return (
      <GuidedTakeoff
        projectId={projectId}
        planFileId={guidedTakeoffFile.id}
        planFileName={guidedTakeoffFile.sheet_label || guidedTakeoffFile.filename}
        onClose={() => setGuidedTakeoffFile(null)}
      />
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Blueprint & Plan Files</CardTitle>
          <CardDescription>Upload PDFs and images, then run Guided Takeoff per sheet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-accent/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" multiple className="hidden" />
            {uploading ? (
              <div className="flex flex-col items-center"><Loader2 className="h-10 w-10 text-accent animate-spin mb-3" /><p className="text-sm text-muted-foreground">Uploading...</p></div>
            ) : (
              <div className="flex flex-col items-center"><Upload className="h-10 w-10 text-muted-foreground mb-3" /><p className="font-medium mb-1">Drop files here or click to upload</p></div>
            )}
          </div>
        </CardContent>
      </Card>

      {planFiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No plan files yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">Upload blueprints to run guided takeoff.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {planFiles.map((file) => {
            const FileIcon = getFileIcon(file.filename);
            return (
              <Card key={file.id} className="interactive-card">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0"><FileIcon className="h-5 w-5 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.filename}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(file.uploaded_at), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Sheet Label</Label>
                        <Input value={file.sheet_label || ''} onChange={(e) => updateFileMutation.mutate({ id: file.id, updates: { sheet_label: e.target.value } })} placeholder="A1, S1..." className="h-8 mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Scale</Label>
                        <Select value={file.scale || 'unknown'} onValueChange={(v) => updateFileMutation.mutate({ id: file.id, updates: { scale: v } })}>
                          <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unknown">Unknown</SelectItem>
                            <SelectItem value="1/4">1/4" = 1'-0"</SelectItem>
                            <SelectItem value="1/8">1/8" = 1'-0"</SelectItem>
                            <SelectItem value="3/16">3/16" = 1'-0"</SelectItem>
                            <SelectItem value="1/2">1/2" = 1'-0"</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Sheet Title</Label>
                      <Input value={file.sheet_title || ''} onChange={(e) => updateFileMutation.mutate({ id: file.id, updates: { sheet_title: e.target.value } })} placeholder="Floor Plan - Level 1" className="h-8 mt-1" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="accent" size="sm" className="flex-1" onClick={() => setGuidedTakeoffFile(file)}>
                      <Ruler className="h-3 w-3 mr-1" />Guided Takeoff
                    </Button>
                    {file.filename.toLowerCase().endsWith('.pdf') && (
                      <Button variant="outline" size="sm" onClick={() => setViewerFile(file)} title="Open with Measurements">
                        <PenTool className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleViewFile(file)}><Eye className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteFileMutation.mutate(file)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

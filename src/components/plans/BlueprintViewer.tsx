import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PDFViewer } from './PDFViewer';
import { MeasurementOverlay } from './MeasurementOverlay';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface BlueprintViewerProps {
  projectId: string;
  planFileId: string;
  filename: string;
  filePath: string;
  onClose: () => void;
  highlightMeasurementId?: string;
}

interface Point {
  x: number;
  y: number;
}

export function BlueprintViewer({
  projectId,
  planFileId,
  filename,
  filePath,
  onClose,
  highlightMeasurementId,
}: BlueprintViewerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 800, height: 600 });
  const [currentScale, setCurrentScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Get signed URL
  useEffect(() => {
    const getSignedUrl = async () => {
      const { data, error } = await supabase.storage
        .from('plan-files')
        .createSignedUrl(filePath, 3600);
      if (data?.signedUrl) {
        setSignedUrl(data.signedUrl);
      } else if (error) {
        toast({ title: 'Error loading file', description: error.message, variant: 'destructive' });
      }
    };
    getSignedUrl();
  }, [filePath, toast]);

  // Fetch existing measurements
  const { data: measurements = [] } = useQuery({
    queryKey: ['blueprint-measurements', planFileId, currentPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blueprint_measurements')
        .select('*')
        .eq('plan_file_id', planFileId)
        .eq('page_number', currentPage);
      if (error) throw error;
      return data.map((m) => ({
        ...m,
        coordinates_json: m.coordinates_json as unknown as { points: Point[] },
      }));
    },
  });

  // Save measurement mutation
  const saveMeasurementMutation = useMutation({
    mutationFn: async (measurement: {
      type: string;
      value: number;
      unit: string;
      label?: string;
      coordinates: { points: Point[] };
      pageNumber: number;
      scale: number;
    }) => {
      const { data, error } = await supabase
        .from('blueprint_measurements')
        .insert([{
          project_id: projectId,
          plan_file_id: planFileId,
          measurement_type: measurement.type,
          value: measurement.value,
          unit: measurement.unit,
          label: measurement.label,
          page_number: measurement.pageNumber,
          scale: measurement.scale,
          coordinates_json: measurement.coordinates,
        }] as any)
        .select()
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blueprint-measurements', planFileId] });
    },
    onError: (error) => {
      toast({ title: 'Error saving measurement', description: error.message, variant: 'destructive' });
    },
  });

  // Create takeoff item mutation
  const createTakeoffMutation = useMutation({
    mutationFn: async ({
      measurementId,
      data,
    }: {
      measurementId: string;
      data: {
        category: string;
        description: string;
        quantity: number;
        unit: string;
        draft: boolean;
      };
    }) => {
      // Create takeoff item
      const { data: takeoffItem, error: takeoffError } = await supabase
        .from('takeoff_items')
        .insert({
          project_id: projectId,
          plan_file_id: planFileId,
          category: data.category,
          description: data.description,
          quantity: data.quantity,
          unit: data.unit,
          draft: data.draft,
        })
        .select()
        .single();

      if (takeoffError) throw takeoffError;

      // Link measurement to takeoff item
      const { error: linkError } = await supabase
        .from('blueprint_measurements')
        .update({ takeoff_item_id: takeoffItem.id })
        .eq('id', measurementId);

      if (linkError) throw linkError;

      return takeoffItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['takeoff-items', projectId] });
      queryClient.invalidateQueries({ queryKey: ['blueprint-measurements', planFileId] });
      toast({ title: 'Takeoff item created and linked to measurement' });
    },
    onError: (error) => {
      toast({ title: 'Error creating takeoff item', description: error.message, variant: 'destructive' });
    },
  });

  // Delete measurement mutation
  const deleteMeasurementMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blueprint_measurements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blueprint-measurements', planFileId] });
      toast({ title: 'Measurement deleted' });
    },
  });

  if (!signedUrl) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if this is a PDF file
  const isPDF = filename.toLowerCase().endsWith('.pdf');

  if (!isPDF) {
    // For non-PDF files, show a simple image viewer
    return (
      <div className="relative h-[calc(100vh-12rem)] rounded-lg border overflow-hidden">
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={onClose}
            className="bg-background/80 backdrop-blur px-3 py-1 rounded-lg border hover:bg-muted"
          >
            ← Back
          </button>
        </div>
        <img src={signedUrl} alt={filename} className="w-full h-full object-contain" />
      </div>
    );
  }

  return (
    <PDFViewer url={signedUrl} filename={filename} onClose={onClose}>
      <MeasurementOverlay
        width={pdfDimensions.width}
        height={pdfDimensions.height}
        scale={currentScale}
        pageNumber={currentPage}
        projectId={projectId}
        planFileId={planFileId}
        existingMeasurements={measurements}
        onSaveMeasurement={async (m) => {
          const id = await saveMeasurementMutation.mutateAsync(m);
          return id;
        }}
        onCreateTakeoffItem={async (measurementId, data) => {
          await createTakeoffMutation.mutateAsync({ measurementId, data });
        }}
        onDeleteMeasurement={async (id) => {
          await deleteMeasurementMutation.mutateAsync(id);
        }}
        highlightMeasurementId={highlightMeasurementId}
      />
    </PDFViewer>
  );
}

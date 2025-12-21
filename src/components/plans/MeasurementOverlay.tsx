import { useState, useRef, useEffect, useCallback } from 'react';
import { Canvas as FabricCanvas, Line, Circle, Polygon, IText, FabricObject } from 'fabric';
import {
  Ruler,
  Square,
  MousePointer2,
  Hash,
  StickyNote,
  Undo2,
  Redo2,
  Trash2,
  Settings2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { TAKEOFF_CATEGORIES, TRADES } from '@/lib/constants';

type Tool = 'select' | 'scale' | 'linear' | 'area' | 'count' | 'note';

interface Point {
  x: number;
  y: number;
}

interface Measurement {
  id: string;
  type: 'linear' | 'area' | 'count' | 'note';
  value: number;
  unit: string;
  label?: string;
  points: Point[];
  fabricObjects: string[];
}

interface MeasurementOverlayProps {
  width: number;
  height: number;
  scale: number;
  pageNumber: number;
  projectId: string;
  planFileId: string;
  existingMeasurements?: {
    id: string;
    measurement_type: string;
    value: number | null;
    unit: string;
    label: string | null;
    coordinates_json: { points: Point[] };
    takeoff_item_id: string | null;
  }[];
  onSaveMeasurement: (measurement: {
    type: string;
    value: number;
    unit: string;
    label?: string;
    coordinates: { points: Point[] };
    pageNumber: number;
    scale: number;
  }) => Promise<string>;
  onCreateTakeoffItem?: (measurementId: string, data: {
    category: string;
    description: string;
    quantity: number;
    unit: string;
    draft: boolean;
  }) => Promise<void>;
  onDeleteMeasurement?: (id: string) => Promise<void>;
  highlightMeasurementId?: string;
}

export function MeasurementOverlay({
  width,
  height,
  scale: pdfScale,
  pageNumber,
  projectId,
  planFileId,
  existingMeasurements = [],
  onSaveMeasurement,
  onCreateTakeoffItem,
  onDeleteMeasurement,
  highlightMeasurementId,
}: MeasurementOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [calibrationScale, setCalibrationScale] = useState<number | null>(null); // pixels per foot
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [calibrationDistance, setCalibrationDistance] = useState('10');
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [countMarkers, setCountMarkers] = useState<Point[]>([]);
  const [undoStack, setUndoStack] = useState<Measurement[][]>([]);
  const [redoStack, setRedoStack] = useState<Measurement[][]>([]);

  // Takeoff creation dialog
  const [showTakeoffDialog, setShowTakeoffDialog] = useState(false);
  const [pendingMeasurement, setPendingMeasurement] = useState<{
    id: string;
    type: string;
    value: number;
    unit: string;
  } | null>(null);
  const [takeoffCategory, setTakeoffCategory] = useState('');
  const [takeoffDescription, setTakeoffDescription] = useState('');
  const [takeoffDraft, setTakeoffDraft] = useState(true);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: width * pdfScale,
      height: height * pdfScale,
      backgroundColor: 'transparent',
      selection: activeTool === 'select',
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [width, height, pdfScale]);

  // Update canvas size when scale changes
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.setDimensions({
      width: width * pdfScale,
      height: height * pdfScale,
    });
    fabricCanvas.renderAll();
  }, [fabricCanvas, width, height, pdfScale]);

  // Update selection mode based on tool
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.selection = activeTool === 'select';
    fabricCanvas.forEachObject((obj) => {
      obj.selectable = activeTool === 'select';
      obj.evented = activeTool === 'select';
    });
    fabricCanvas.renderAll();
  }, [fabricCanvas, activeTool]);

  // Draw existing measurements
  useEffect(() => {
    if (!fabricCanvas || existingMeasurements.length === 0) return;

    existingMeasurements.forEach((m) => {
      const points = m.coordinates_json?.points || [];
      const isHighlighted = m.id === highlightMeasurementId;
      const color = isHighlighted ? '#f59e0b' : '#3b82f6';

      if (m.measurement_type === 'linear' && points.length >= 2) {
        const line = new Line(
          [points[0].x * pdfScale, points[0].y * pdfScale, points[1].x * pdfScale, points[1].y * pdfScale],
          {
            stroke: color,
            strokeWidth: 2,
            selectable: false,
          }
        );
        fabricCanvas.add(line);

        // Add label
        const midX = (points[0].x + points[1].x) / 2 * pdfScale;
        const midY = (points[0].y + points[1].y) / 2 * pdfScale;
        const label = new IText(`${m.value?.toFixed(1) || 0} ${m.unit}`, {
          left: midX,
          top: midY - 20,
          fontSize: 14,
          fill: color,
          backgroundColor: 'rgba(255,255,255,0.8)',
          selectable: false,
        });
        fabricCanvas.add(label);
      } else if (m.measurement_type === 'area' && points.length >= 3) {
        const flatPoints = points.flatMap((p) => [p.x * pdfScale, p.y * pdfScale]);
        const polygon = new Polygon(
          points.map((p) => ({ x: p.x * pdfScale, y: p.y * pdfScale })),
          {
            fill: `${color}20`,
            stroke: color,
            strokeWidth: 2,
            selectable: false,
          }
        );
        fabricCanvas.add(polygon);

        // Add label at centroid
        const cx = points.reduce((s, p) => s + p.x, 0) / points.length * pdfScale;
        const cy = points.reduce((s, p) => s + p.y, 0) / points.length * pdfScale;
        const label = new IText(`${m.value?.toFixed(1) || 0} ${m.unit}`, {
          left: cx,
          top: cy,
          fontSize: 14,
          fill: color,
          backgroundColor: 'rgba(255,255,255,0.8)',
          selectable: false,
        });
        fabricCanvas.add(label);
      } else if (m.measurement_type === 'count') {
        points.forEach((p, i) => {
          const marker = new Circle({
            left: p.x * pdfScale - 10,
            top: p.y * pdfScale - 10,
            radius: 10,
            fill: color,
            stroke: '#fff',
            strokeWidth: 2,
            selectable: false,
          });
          fabricCanvas.add(marker);

          const num = new IText(`${i + 1}`, {
            left: p.x * pdfScale - 4,
            top: p.y * pdfScale - 8,
            fontSize: 12,
            fill: '#fff',
            selectable: false,
          });
          fabricCanvas.add(num);
        });
      } else if (m.measurement_type === 'note' && points.length > 0) {
        const note = new IText(m.label || 'Note', {
          left: points[0].x * pdfScale,
          top: points[0].y * pdfScale,
          fontSize: 14,
          fill: color,
          backgroundColor: 'rgba(255,255,200,0.9)',
          padding: 5,
          selectable: false,
        });
        fabricCanvas.add(note);
      }
    });

    fabricCanvas.renderAll();
  }, [fabricCanvas, existingMeasurements, pdfScale, highlightMeasurementId]);

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!fabricCanvas) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / pdfScale;
      const y = (e.clientY - rect.top) / pdfScale;
      const point = { x, y };

      if (activeTool === 'scale') {
        if (calibrationPoints.length === 0) {
          setCalibrationPoints([point]);
          // Draw first point
          const circle = new Circle({
            left: x * pdfScale - 5,
            top: y * pdfScale - 5,
            radius: 5,
            fill: '#22c55e',
            stroke: '#fff',
            strokeWidth: 2,
            selectable: false,
          });
          fabricCanvas.add(circle);
          fabricCanvas.renderAll();
        } else if (calibrationPoints.length === 1) {
          setCalibrationPoints([...calibrationPoints, point]);
          // Draw second point and line
          const circle = new Circle({
            left: x * pdfScale - 5,
            top: y * pdfScale - 5,
            radius: 5,
            fill: '#22c55e',
            stroke: '#fff',
            strokeWidth: 2,
            selectable: false,
          });
          const line = new Line(
            [
              calibrationPoints[0].x * pdfScale,
              calibrationPoints[0].y * pdfScale,
              x * pdfScale,
              y * pdfScale,
            ],
            {
              stroke: '#22c55e',
              strokeWidth: 2,
              strokeDashArray: [5, 5],
              selectable: false,
            }
          );
          fabricCanvas.add(line, circle);
          fabricCanvas.renderAll();
          setIsCalibrating(true);
        }
      } else if (activeTool === 'linear') {
        if (currentPoints.length === 0) {
          setCurrentPoints([point]);
          const circle = new Circle({
            left: x * pdfScale - 4,
            top: y * pdfScale - 4,
            radius: 4,
            fill: '#3b82f6',
            selectable: false,
          });
          fabricCanvas.add(circle);
          fabricCanvas.renderAll();
        } else if (currentPoints.length === 1) {
          const points = [...currentPoints, point];
          finishLinearMeasurement(points);
        }
      } else if (activeTool === 'area') {
        const newPoints = [...currentPoints, point];
        setCurrentPoints(newPoints);

        const circle = new Circle({
          left: x * pdfScale - 4,
          top: y * pdfScale - 4,
          radius: 4,
          fill: '#8b5cf6',
          selectable: false,
        });
        fabricCanvas.add(circle);

        if (newPoints.length > 1) {
          const prev = newPoints[newPoints.length - 2];
          const line = new Line(
            [prev.x * pdfScale, prev.y * pdfScale, x * pdfScale, y * pdfScale],
            {
              stroke: '#8b5cf6',
              strokeWidth: 2,
              selectable: false,
            }
          );
          fabricCanvas.add(line);
        }
        fabricCanvas.renderAll();
      } else if (activeTool === 'count') {
        const newMarkers = [...countMarkers, point];
        setCountMarkers(newMarkers);

        const marker = new Circle({
          left: x * pdfScale - 10,
          top: y * pdfScale - 10,
          radius: 10,
          fill: '#f59e0b',
          stroke: '#fff',
          strokeWidth: 2,
          selectable: false,
        });
        const num = new IText(`${newMarkers.length}`, {
          left: x * pdfScale - 4,
          top: y * pdfScale - 8,
          fontSize: 12,
          fill: '#fff',
          selectable: false,
        });
        fabricCanvas.add(marker, num);
        fabricCanvas.renderAll();
      } else if (activeTool === 'note') {
        const note = new IText('Note', {
          left: x * pdfScale,
          top: y * pdfScale,
          fontSize: 14,
          fill: '#3b82f6',
          backgroundColor: 'rgba(255,255,200,0.9)',
          padding: 5,
          editable: true,
          selectable: true,
        });
        fabricCanvas.add(note);
        fabricCanvas.setActiveObject(note);
        fabricCanvas.renderAll();

        // Save note
        saveNoteMeasurement(point, 'Note');
      }
    },
    [fabricCanvas, activeTool, calibrationPoints, currentPoints, countMarkers, pdfScale]
  );

  // Handle double-click to finish area/count
  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'area' && currentPoints.length >= 3) {
      finishAreaMeasurement(currentPoints);
    } else if (activeTool === 'count' && countMarkers.length > 0) {
      finishCountMeasurement(countMarkers);
    }
  }, [activeTool, currentPoints, countMarkers]);

  // Calibration confirmation
  const confirmCalibration = () => {
    if (calibrationPoints.length !== 2) return;

    const dx = calibrationPoints[1].x - calibrationPoints[0].x;
    const dy = calibrationPoints[1].y - calibrationPoints[0].y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    const feetDistance = parseFloat(calibrationDistance);

    if (feetDistance > 0) {
      setCalibrationScale(pixelDistance / feetDistance);
    }

    setIsCalibrating(false);
    setCalibrationPoints([]);
    setActiveTool('select');

    // Clear calibration graphics
    if (fabricCanvas) {
      fabricCanvas.clear();
      fabricCanvas.renderAll();
    }
  };

  // Finish linear measurement
  const finishLinearMeasurement = async (points: Point[]) => {
    if (!calibrationScale || points.length !== 2) {
      setCurrentPoints([]);
      return;
    }

    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    const feet = pixelDistance / calibrationScale;

    const id = await onSaveMeasurement({
      type: 'linear',
      value: feet,
      unit: 'LF',
      coordinates: { points },
      pageNumber,
      scale: calibrationScale,
    });

    setCurrentPoints([]);
    setPendingMeasurement({ id, type: 'linear', value: feet, unit: 'LF' });
    setTakeoffDescription(`Linear measurement: ${feet.toFixed(1)} LF`);
    setShowTakeoffDialog(true);
  };

  // Finish area measurement
  const finishAreaMeasurement = async (points: Point[]) => {
    if (!calibrationScale || points.length < 3) {
      setCurrentPoints([]);
      return;
    }

    // Calculate area using Shoelace formula
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    area = Math.abs(area) / 2;
    const sqFeet = area / (calibrationScale * calibrationScale);

    // Close polygon visually
    if (fabricCanvas) {
      const polygon = new Polygon(
        points.map((p) => ({ x: p.x * pdfScale, y: p.y * pdfScale })),
        {
          fill: 'rgba(139, 92, 246, 0.2)',
          stroke: '#8b5cf6',
          strokeWidth: 2,
          selectable: false,
        }
      );
      fabricCanvas.add(polygon);
      fabricCanvas.renderAll();
    }

    const id = await onSaveMeasurement({
      type: 'area',
      value: sqFeet,
      unit: 'SF',
      coordinates: { points },
      pageNumber,
      scale: calibrationScale,
    });

    setCurrentPoints([]);
    setPendingMeasurement({ id, type: 'area', value: sqFeet, unit: 'SF' });
    setTakeoffDescription(`Area measurement: ${sqFeet.toFixed(1)} SF`);
    setShowTakeoffDialog(true);
  };

  // Finish count measurement
  const finishCountMeasurement = async (points: Point[]) => {
    const count = points.length;

    const id = await onSaveMeasurement({
      type: 'count',
      value: count,
      unit: 'EA',
      coordinates: { points },
      pageNumber,
      scale: calibrationScale || 1,
    });

    setCountMarkers([]);
    setPendingMeasurement({ id, type: 'count', value: count, unit: 'EA' });
    setTakeoffDescription(`Count: ${count} EA`);
    setShowTakeoffDialog(true);
  };

  // Save note measurement
  const saveNoteMeasurement = async (point: Point, label: string) => {
    await onSaveMeasurement({
      type: 'note',
      value: 0,
      unit: 'EA',
      label,
      coordinates: { points: [point] },
      pageNumber,
      scale: calibrationScale || 1,
    });
  };

  // Handle takeoff creation
  const handleCreateTakeoff = async () => {
    if (!pendingMeasurement || !onCreateTakeoffItem) return;

    await onCreateTakeoffItem(pendingMeasurement.id, {
      category: takeoffCategory,
      description: takeoffDescription,
      quantity: pendingMeasurement.value,
      unit: pendingMeasurement.unit,
      draft: takeoffDraft,
    });

    setShowTakeoffDialog(false);
    setPendingMeasurement(null);
    setTakeoffCategory('');
    setTakeoffDescription('');
  };

  // Clear all
  const clearAll = () => {
    if (fabricCanvas) {
      fabricCanvas.clear();
      fabricCanvas.renderAll();
    }
    setCurrentPoints([]);
    setCountMarkers([]);
    setCalibrationPoints([]);
  };

  return (
    <>
      {/* Measurement toolbar */}
      <div className="absolute top-2 left-2 flex flex-wrap gap-1 bg-background/95 backdrop-blur rounded-lg border shadow-lg p-1 z-10">
        <Button
          variant={activeTool === 'select' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTool('select')}
          title="Select"
        >
          <MousePointer2 className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === 'scale' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTool('scale')}
          title="Calibrate Scale"
          className={cn(!calibrationScale && 'text-warning')}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
        <div className="w-px h-8 bg-border" />
        <Button
          variant={activeTool === 'linear' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTool('linear')}
          title="Linear (LF)"
          disabled={!calibrationScale}
        >
          <Ruler className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === 'area' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTool('area')}
          title="Area (SF) - double-click to finish"
          disabled={!calibrationScale}
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === 'count' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTool('count')}
          title="Count (EA) - double-click to finish"
        >
          <Hash className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === 'note' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTool('note')}
          title="Note"
        >
          <StickyNote className="h-4 w-4" />
        </Button>
        <div className="w-px h-8 bg-border" />
        <Button variant="ghost" size="sm" onClick={clearAll} title="Clear All">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Scale indicator */}
      {calibrationScale ? (
        <Badge className="absolute top-2 right-2 bg-green-500/90">
          Scale: {calibrationScale.toFixed(2)} px/ft
        </Badge>
      ) : (
        <Badge variant="outline" className="absolute top-2 right-2 text-warning border-warning">
          No scale set - calibrate first!
        </Badge>
      )}

      {/* Instructions */}
      {activeTool !== 'select' && (
        <div className="absolute bottom-2 left-2 bg-background/95 backdrop-blur rounded-lg border shadow-lg px-3 py-2 text-sm">
          {activeTool === 'scale' && 'Click two points on a known dimension'}
          {activeTool === 'linear' && 'Click start and end points'}
          {activeTool === 'area' && 'Click to add points, double-click to finish polygon'}
          {activeTool === 'count' && 'Click to add markers, double-click to finish'}
          {activeTool === 'note' && 'Click to place a note'}
        </div>
      )}

      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onDoubleClick={handleDoubleClick}
        className="absolute inset-0 cursor-crosshair"
        style={{ width: width * pdfScale, height: height * pdfScale }}
      />

      {/* Calibration dialog */}
      <Dialog open={isCalibrating} onOpenChange={setIsCalibrating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Scale</DialogTitle>
            <DialogDescription>
              Enter the real-world distance between the two points you clicked.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="distance" className="text-right">
                Distance
              </Label>
              <Input
                id="distance"
                type="number"
                value={calibrationDistance}
                onChange={(e) => setCalibrationDistance(e.target.value)}
                className="col-span-2"
              />
              <span>feet</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCalibrating(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCalibration}>Confirm Scale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Takeoff creation dialog */}
      <Dialog open={showTakeoffDialog} onOpenChange={setShowTakeoffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Takeoff Item?</DialogTitle>
            <DialogDescription>
              Create a takeoff item from this measurement and link it to the plan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={takeoffCategory} onValueChange={setTakeoffCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TAKEOFF_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={takeoffDescription}
                onChange={(e) => setTakeoffDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {pendingMeasurement?.value.toFixed(1)} {pendingMeasurement?.unit}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="draft"
                checked={takeoffDraft}
                onCheckedChange={(v) => setTakeoffDraft(!!v)}
              />
              <Label htmlFor="draft">Create as draft</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTakeoffDialog(false);
                setPendingMeasurement(null);
              }}
            >
              Skip
            </Button>
            <Button onClick={handleCreateTakeoff} disabled={!takeoffCategory}>
              <Plus className="h-4 w-4 mr-1" />
              Create Takeoff Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

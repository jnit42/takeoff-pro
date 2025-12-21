import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LinkedMeasurement {
  id: string;
  plan_file_id: string;
  page_number: number | null;
  value: number | null;
  unit: string;
  sheet_label?: string;
}

interface PlanLinkBadgeProps {
  projectId: string;
  measurements: LinkedMeasurement[];
}

export function PlanLinkBadge({ projectId, measurements }: PlanLinkBadgeProps) {
  const navigate = useNavigate();

  if (measurements.length === 0) return null;

  const handleClick = () => {
    const m = measurements[0];
    const params = new URLSearchParams({
      tab: 'plans',
      planFileId: m.plan_file_id,
      page: String(m.page_number || 1),
      highlightMeasurementId: m.id,
    });
    navigate(`/projects/${projectId}?${params.toString()}`);
  };

  const totalValue = measurements.reduce((sum, m) => sum + (m.value || 0), 0);
  const unit = measurements[0]?.unit || '';
  const sheetLabel = measurements[0]?.sheet_label || 'Plan';
  const page = measurements[0]?.page_number || 1;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 gap-1 text-xs text-primary hover:text-primary/80"
          onClick={handleClick}
        >
          <MapPin className="h-3 w-3" />
          {measurements.length > 1 ? `${measurements.length} links` : `${sheetLabel} p${page}`}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Linked: {totalValue.toFixed(1)} {unit}</p>
        <p className="text-xs text-muted-foreground">Click to view on plan</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * ScopeManager - Combined view for RFIs, Assumptions, and Checklist
 * Simplifies the project workflow by grouping scope-related items
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileQuestion, AlertCircle, ListChecks } from 'lucide-react';
import { RFIsManager } from '@/components/wizard/RFIsManager';
import { AssumptionsManager } from '@/components/wizard/AssumptionsManager';
import { ChecklistManager } from '@/components/wizard/ChecklistManager';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ScopeManagerProps {
  projectId: string;
}

export function ScopeManager({ projectId }: ScopeManagerProps) {
  const [activeTab, setActiveTab] = useState('rfis');

  // Fetch counts for badges
  const { data: rfis = [] } = useQuery({
    queryKey: ['rfis', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('rfis').select('status').eq('project_id', projectId);
      return data || [];
    },
  });

  const { data: assumptions = [] } = useQuery({
    queryKey: ['assumptions', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('assumptions').select('status').eq('project_id', projectId);
      return data || [];
    },
  });

  const { data: checklistItems = [] } = useQuery({
    queryKey: ['checklist-items', projectId],
    queryFn: async () => {
      const { data } = await supabase.from('checklist_items').select('status').eq('project_id', projectId);
      return data || [];
    },
  });

  const openRfis = rfis.filter(r => r.status === 'open').length;
  const pendingAssumptions = assumptions.filter(a => a.status === 'pending').length;
  const pendingChecklist = checklistItems.filter(c => c.status === 'pending').length;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rfis" className="gap-2">
            <FileQuestion className="h-4 w-4" />
            <span className="hidden sm:inline">RFIs</span>
            {openRfis > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {openRfis}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="assumptions" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Assumptions</span>
            {pendingAssumptions > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingAssumptions}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Checklist</span>
            {pendingChecklist > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingChecklist}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rfis" className="mt-4">
          <RFIsManager projectId={projectId} />
        </TabsContent>

        <TabsContent value="assumptions" className="mt-4">
          <AssumptionsManager projectId={projectId} />
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <ChecklistManager projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

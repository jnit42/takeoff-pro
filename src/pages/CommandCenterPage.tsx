/**
 * Global Command Center Page - with project picker
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { CommandCenter } from '@/components/command/CommandCenter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Terminal, FolderKanban, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CommandCenterPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <AppLayout>
      <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
        {/* Clean header */}
        <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Terminal className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Command Center</h1>
                <p className="text-sm text-muted-foreground">AI-powered estimating assistant</p>
              </div>
            </div>
            
            {/* Inline project selector */}
            <div className="flex items-center gap-3">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedProjectId || ''}
                onValueChange={(value) => setSelectedProjectId(value || null)}
              >
                <SelectTrigger className="w-64 h-9 text-sm bg-background border-border/50">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span>{project.name}</span>
                        {project.status && (
                          <Badge variant="outline" className="text-[10px] py-0 h-5">
                            {project.status}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Breadcrumb when project selected */}
          {selectedProject && (
            <div className="px-6 pb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Projects</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{selectedProject.name}</span>
            </div>
          )}
        </div>

        {/* Command Center - full remaining height */}
        <div className="flex-1 min-h-0 p-4">
          <CommandCenter
            projectId={selectedProjectId || undefined}
            projectType={undefined}
            className="h-full shadow-sm"
          />
        </div>
      </div>
    </AppLayout>
  );
}

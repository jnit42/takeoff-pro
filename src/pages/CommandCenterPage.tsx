/**
 * Global Command Center Page - with project picker
 * Mobile-optimized layout
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
import { Terminal, FolderKanban } from 'lucide-react';
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
      <div className="h-[calc(100vh-3.5rem)] md:h-screen flex flex-col bg-background">
        {/* Header - compact on mobile */}
        <div className="border-b border-border/50 bg-background/95 backdrop-blur-sm flex-shrink-0">
          <div className="px-4 sm:px-6 py-3 sm:py-4 space-y-3">
            {/* Title row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <Terminal className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">
                    Command Center
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                    AI-powered estimating assistant
                  </p>
                </div>
              </div>
            </div>
            
            {/* Project selector - full width on mobile */}
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Select
                value={selectedProjectId || ''}
                onValueChange={(value) => setSelectedProjectId(value || null)}
              >
                <SelectTrigger className="flex-1 h-9 text-sm bg-background border-border/50">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{project.name}</span>
                        {project.status && (
                          <Badge variant="outline" className="text-[10px] py-0 h-5 flex-shrink-0">
                            {project.status}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected project indicator */}
            {selectedProject && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">Working on:</span>
                <span className="truncate">{selectedProject.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Command Center - fills remaining space */}
        <div className="flex-1 min-h-0 p-2 sm:p-4">
          <CommandCenter
            projectId={selectedProjectId || undefined}
            projectType={undefined}
            className="h-full"
          />
        </div>
      </div>
    </AppLayout>
  );
}

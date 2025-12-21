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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, FolderKanban } from 'lucide-react';

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
      <div className="p-8 h-screen flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <Terminal className="h-8 w-8 text-accent" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Command Center</h1>
            <p className="text-muted-foreground">Voice and text control for your projects</p>
          </div>
        </div>

        {/* Project Picker */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              Select Project
            </CardTitle>
            <CardDescription>
              Choose a project to run commands against
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedProjectId || ''}
              onValueChange={(value) => setSelectedProjectId(value || null)}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                    {project.status && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        ({project.status})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Command Center */}
        <div className="flex-1 min-h-0">
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

import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Template {
  id: string;
  type: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

const templateIcons: Record<string, string> = {
  basement_finish: '🏠',
  kitchen_remodel: '🍳',
  bathroom_remodel: '🚿',
  deck_build: '🪵',
  addition: '🏗️',
};

export default function Templates() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Template[];
    },
  });

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Pre-built takeoff templates for common project types
          </p>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No templates available</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Templates will appear here once they're created.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="interactive-card group">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">
                      {templateIcons[template.type] || '📋'}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="group-hover:text-accent transition-colors">
                        {template.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {template.description || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    {template.is_system && (
                      <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                        System Template
                      </span>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto gap-2">
                      Use Template
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Coming soon:</strong> Apply templates to new projects to automatically
              populate takeoff line items and labor tasks based on project type. You'll be
              able to create and customize your own templates from completed projects.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

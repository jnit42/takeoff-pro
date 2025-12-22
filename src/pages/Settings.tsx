import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, User, Building, Loader2, Brain, BookOpen, Sparkles, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AIAuditLog } from '@/components/ai/AIAuditLog';
import { KnowledgeBaseViewer } from '@/components/ai/KnowledgeBaseViewer';
import { LearningSettings } from '@/components/settings/LearningSettings';
import { CalibrationMode } from '@/components/settings/CalibrationMode';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      return data as Profile;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast({ title: 'Profile updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleChange = (field: keyof Profile, value: string) => {
    updateMutation.mutate({ [field]: value });
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage your account, preferences, and AI learning
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="calibration" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Calibrate</span>
            </TabsTrigger>
            <TabsTrigger value="learning" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Learning</span>
            </TabsTrigger>
            <TabsTrigger value="ai-audit" className="gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">AI Audit</span>
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Knowledge</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {/* Profile */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <User className="h-4 w-4 sm:h-5 sm:w-5" />
                      Profile
                    </CardTitle>
                    <CardDescription className="text-sm">Your personal information</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm">Email</Label>
                      <Input
                        id="email"
                        value={profile?.email || ''}
                        disabled
                        className="bg-muted text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Email cannot be changed
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-sm">Full Name</Label>
                      <Input
                        id="full_name"
                        defaultValue={profile?.full_name || ''}
                        onBlur={(e) => handleChange('full_name', e.target.value)}
                        placeholder="Your full name"
                        className="text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Company */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Building className="h-4 w-4 sm:h-5 sm:w-5" />
                      Company
                    </CardTitle>
                    <CardDescription className="text-sm">Your business information</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="company_name" className="text-sm">Company Name</Label>
                      <Input
                        id="company_name"
                        defaultValue={profile?.company_name || ''}
                        onBlur={(e) => handleChange('company_name', e.target.value)}
                        placeholder="Your company name"
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        This will appear on exported PDFs
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Defaults */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <SettingsIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      Default Settings
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Default values for new projects
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    <p className="text-sm text-muted-foreground">
                      Default project settings can be configured when creating a new project.
                      These include tax rate, waste factor, markup percentage, and labor burden.
                    </p>
                  </CardContent>
                </Card>

                {updateMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calibration">
            <CalibrationMode />
          </TabsContent>

          <TabsContent value="learning">
            <LearningSettings />
          </TabsContent>

          <TabsContent value="ai-audit">
            <AIAuditLog />
          </TabsContent>

          <TabsContent value="knowledge">
            <KnowledgeBaseViewer />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

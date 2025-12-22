-- Learning Loop Tables

-- 1) Generic event logging for analytics and learning
CREATE TABLE public.user_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) Labor rate calibration - remember sub pay baselines per task
CREATE TABLE public.labor_rate_calibration (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  trade TEXT NOT NULL,
  task_key TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'EA',
  base_rate NUMERIC NOT NULL,
  modifiers_json JSONB DEFAULT '{}'::jsonb,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sample_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trade, task_key)
);

-- 3) Assembly presets - remember default assemblies per project type
CREATE TABLE public.assembly_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  project_type TEXT NOT NULL,
  assemblies JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  times_used INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_type)
);

-- 4) User learning preferences (settings)
CREATE TABLE public.user_learning_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  learning_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_rate_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembly_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_learning_settings ENABLE ROW LEVEL SECURITY;

-- user_events policies
CREATE POLICY "Users can view their own events"
  ON public.user_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
  ON public.user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage events"
  ON public.user_events FOR ALL
  USING (auth.role() = 'service_role');

-- labor_rate_calibration policies
CREATE POLICY "Users can view their own calibrations"
  ON public.labor_rate_calibration FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calibrations"
  ON public.labor_rate_calibration FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calibrations"
  ON public.labor_rate_calibration FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calibrations"
  ON public.labor_rate_calibration FOR DELETE
  USING (auth.uid() = user_id);

-- assembly_presets policies
CREATE POLICY "Users can view their own presets"
  ON public.assembly_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own presets"
  ON public.assembly_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presets"
  ON public.assembly_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets"
  ON public.assembly_presets FOR DELETE
  USING (auth.uid() = user_id);

-- user_learning_settings policies
CREATE POLICY "Users can view their own settings"
  ON public.user_learning_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings"
  ON public.user_learning_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_learning_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_user_events_user ON public.user_events(user_id);
CREATE INDEX idx_user_events_type ON public.user_events(event_type);
CREATE INDEX idx_user_events_created ON public.user_events(created_at DESC);
CREATE INDEX idx_labor_calibration_user ON public.labor_rate_calibration(user_id);
CREATE INDEX idx_labor_calibration_task ON public.labor_rate_calibration(trade, task_key);
CREATE INDEX idx_assembly_presets_user ON public.assembly_presets(user_id);
CREATE INDEX idx_assembly_presets_type ON public.assembly_presets(project_type);
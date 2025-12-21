-- Create blueprint_measurements table for storing plan measurements
CREATE TABLE public.blueprint_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  plan_file_id uuid NOT NULL REFERENCES public.plan_files(id) ON DELETE CASCADE,
  takeoff_item_id uuid REFERENCES public.takeoff_items(id) ON DELETE SET NULL,
  measurement_type text NOT NULL CHECK (measurement_type IN ('linear', 'area', 'count', 'note')),
  value numeric,
  unit text NOT NULL DEFAULT 'LF',
  label text,
  trade text,
  scale numeric,
  page_number integer DEFAULT 1,
  coordinates_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.blueprint_measurements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - users can only access measurements for their own projects
CREATE POLICY "Users can view their own blueprint measurements"
ON public.blueprint_measurements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = blueprint_measurements.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create blueprint measurements for their projects"
ON public.blueprint_measurements
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = blueprint_measurements.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own blueprint measurements"
ON public.blueprint_measurements
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = blueprint_measurements.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own blueprint measurements"
ON public.blueprint_measurements
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = blueprint_measurements.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_blueprint_measurements_project ON public.blueprint_measurements(project_id);
CREATE INDEX idx_blueprint_measurements_plan_file ON public.blueprint_measurements(plan_file_id);
CREATE INDEX idx_blueprint_measurements_takeoff_item ON public.blueprint_measurements(takeoff_item_id);
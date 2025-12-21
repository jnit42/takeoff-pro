-- Create action_log table for Command Center audit + undo
CREATE TABLE public.action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('text', 'voice', 'ui')),
  command_text text NOT NULL,
  actions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'undone', 'failed')),
  error text,
  undoable boolean NOT NULL DEFAULT true,
  undo_data jsonb
);

-- Enable RLS
ALTER TABLE public.action_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own project logs
CREATE POLICY "Users can view action logs for their projects"
ON public.action_log FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = action_log.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can create action logs for their projects
CREATE POLICY "Users can create action logs for their projects"
ON public.action_log FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND (
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = action_log.project_id
      AND projects.user_id = auth.uid()
    )
  )
);

-- Users can update their own action logs (for undo)
CREATE POLICY "Users can update their own action logs"
ON public.action_log FOR UPDATE
USING (
  user_id = auth.uid() AND
  (project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = action_log.project_id
      AND projects.user_id = auth.uid()
    )
  )
);

-- Create index for faster lookups
CREATE INDEX idx_action_log_project_id ON public.action_log(project_id);
CREATE INDEX idx_action_log_user_id ON public.action_log(user_id);
CREATE INDEX idx_action_log_created_at ON public.action_log(created_at DESC);
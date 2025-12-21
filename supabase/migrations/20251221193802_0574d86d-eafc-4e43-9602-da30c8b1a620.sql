-- Storage RLS policies for plan-files bucket
-- Users can only access files in folders matching their project IDs

-- First ensure the bucket exists and is private
INSERT INTO storage.buckets (id, name, public)
VALUES ('plan-files', 'plan-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Helper function to check if user owns the project based on path
CREATE OR REPLACE FUNCTION public.owns_plan_file_path(file_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM projects
    WHERE id::text = split_part(file_path, '/', 1)
      AND user_id = auth.uid()
  )
$$;

-- DROP existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own plan files" ON storage.objects;

-- INSERT: Users can upload files only to folders matching their project IDs
CREATE POLICY "Users can upload their own plan files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'plan-files'
  AND public.owns_plan_file_path(name)
);

-- SELECT: Users can read files only from folders matching their project IDs
CREATE POLICY "Users can read their own plan files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'plan-files'
  AND public.owns_plan_file_path(name)
);

-- UPDATE: Users can update files only in folders matching their project IDs
CREATE POLICY "Users can update their own plan files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'plan-files'
  AND public.owns_plan_file_path(name)
);

-- DELETE: Users can delete files only from folders matching their project IDs
CREATE POLICY "Users can delete their own plan files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'plan-files'
  AND public.owns_plan_file_path(name)
);
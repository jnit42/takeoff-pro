-- Drop the old broad storage policies that allow any authenticated user access
DROP POLICY IF EXISTS "Authenticated users can upload plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own plan files" ON storage.objects;

-- The restrictive ownership-based policies remain:
-- "Users can upload their own plan files" (INSERT with owns_plan_file_path check)
-- "Users can read their own plan files" (SELECT with owns_plan_file_path check)
-- "Users can update their own plan files" (UPDATE with owns_plan_file_path check)
-- "Users can delete their own plan files" (DELETE with owns_plan_file_path check)
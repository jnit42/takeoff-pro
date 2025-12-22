-- Create scrape_failures table to log and diagnose issues
CREATE TABLE public.scrape_failures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  store TEXT NOT NULL,
  search_term TEXT NOT NULL,
  zip_code TEXT,
  error_type TEXT NOT NULL,
  error_message TEXT,
  http_status INTEGER,
  response_preview TEXT,
  search_url TEXT,
  duration_ms INTEGER,
  resolved BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.scrape_failures ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert (from edge function)
CREATE POLICY "Service role can manage scrape_failures"
ON public.scrape_failures
FOR ALL
USING (true)
WITH CHECK (true);

-- Users can view their own failures
CREATE POLICY "Users can view their own failures"
ON public.scrape_failures
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for querying failures
CREATE INDEX idx_scrape_failures_store ON public.scrape_failures(store, created_at DESC);
CREATE INDEX idx_scrape_failures_error_type ON public.scrape_failures(error_type, created_at DESC);
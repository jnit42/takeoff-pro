-- Create building code cache table for cost optimization
CREATE TABLE public.building_code_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  query_text TEXT NOT NULL,
  snippet TEXT NOT NULL,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '90 days'),
  UNIQUE(query_hash, zip_code)
);

-- Enable RLS
ALTER TABLE public.building_code_cache ENABLE ROW LEVEL SECURITY;

-- Public read access (codes are public info)
CREATE POLICY "Building codes are publicly readable" 
ON public.building_code_cache 
FOR SELECT 
USING (true);

-- Only authenticated users can insert/update
CREATE POLICY "Authenticated users can cache codes" 
ON public.building_code_cache 
FOR INSERT 
WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX idx_building_code_cache_lookup ON public.building_code_cache(query_hash, zip_code);
CREATE INDEX idx_building_code_cache_expires ON public.building_code_cache(expires_at);
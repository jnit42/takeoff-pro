-- Create AI learning knowledge base for persistent learning
CREATE TABLE public.ai_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- 'terminology', 'pricing', 'preference', 'correction'
  key TEXT NOT NULL, -- The term or item being learned
  value JSONB NOT NULL, -- The learned information
  source TEXT, -- Where this was learned from (user correction, scrape, etc)
  confidence NUMERIC DEFAULT 1.0, -- How confident we are (1.0 = user confirmed)
  usage_count INTEGER DEFAULT 1, -- How often this has been used
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_ai_knowledge_user_key ON public.ai_knowledge(user_id, key);
CREATE INDEX idx_ai_knowledge_category ON public.ai_knowledge(category);

-- Enable RLS
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;

-- Users can only see their own knowledge
CREATE POLICY "Users can view their own AI knowledge"
  ON public.ai_knowledge FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI knowledge"
  ON public.ai_knowledge FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI knowledge"
  ON public.ai_knowledge FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI knowledge"
  ON public.ai_knowledge FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_knowledge_updated_at
  BEFORE UPDATE ON public.ai_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create price cache table for scraped prices
CREATE TABLE public.price_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL, -- Normalized item name
  search_term TEXT NOT NULL, -- What was searched
  store TEXT NOT NULL, -- 'homedepot', 'lowes', etc
  price NUMERIC, -- Unit price found
  unit TEXT, -- Price unit
  product_url TEXT, -- Link to product
  in_stock BOOLEAN DEFAULT true,
  location TEXT, -- Store location/zip
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Index for fast price lookups
CREATE INDEX idx_price_cache_item ON public.price_cache(item_name, store);
CREATE INDEX idx_price_cache_expires ON public.price_cache(expires_at);

-- Price cache is public (no user-specific data)
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read price cache (it's shared data)
CREATE POLICY "Anyone can view price cache"
  ON public.price_cache FOR SELECT
  USING (true);

-- Only backend can insert/update (via service role)
CREATE POLICY "Service role can manage price cache"
  ON public.price_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Add region/zip to projects if not exists
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS zip_code TEXT;
-- Product Catalog: Canonical products with proper naming
CREATE TABLE public.product_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  trade TEXT,
  default_unit TEXT NOT NULL DEFAULT 'EA',
  specifications JSONB DEFAULT '{}'::jsonb,
  common_aliases TEXT[] DEFAULT '{}',
  search_keywords TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_by UUID,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Store SKU Mappings: Links canonical products to store-specific SKUs
CREATE TABLE public.store_sku_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_catalog_id UUID NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  store TEXT NOT NULL,
  sku TEXT,
  store_product_name TEXT NOT NULL,
  product_url TEXT,
  last_price NUMERIC,
  last_price_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  match_confidence NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_catalog_id, store, sku)
);

-- Price Suggestions: Scraped prices as suggestions with full provenance
CREATE TABLE public.price_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  takeoff_item_id UUID REFERENCES public.takeoff_items(id) ON DELETE SET NULL,
  product_catalog_id UUID REFERENCES public.product_catalog(id) ON DELETE SET NULL,
  search_term TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'fuzzy',
  match_confidence NUMERIC DEFAULT 0.5,
  source TEXT NOT NULL,
  store_id TEXT,
  zip_code TEXT,
  price NUMERIC,
  unit TEXT,
  product_name TEXT,
  product_url TEXT,
  sku TEXT,
  in_stock BOOLEAN DEFAULT true,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  raw_response JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_to_price_book_id UUID REFERENCES public.price_book(id) ON DELETE SET NULL,
  rejected_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User lookup limits tracking
CREATE TABLE public.user_lookup_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lookup_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lookup_count INTEGER NOT NULL DEFAULT 0,
  last_lookup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, lookup_date)
);

-- Enable RLS on all tables
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_sku_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lookup_limits ENABLE ROW LEVEL SECURITY;

-- Product Catalog policies (viewable by all, managed by owners/service)
CREATE POLICY "Anyone can view product catalog"
  ON public.product_catalog FOR SELECT
  USING (true);

CREATE POLICY "Users can create catalog entries"
  ON public.product_catalog FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can manage all catalog entries"
  ON public.product_catalog FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Service role can manage catalog"
  ON public.product_catalog FOR ALL
  USING (auth.role() = 'service_role');

-- Store SKU Mappings policies (viewable by all, managed by service)
CREATE POLICY "Anyone can view store mappings"
  ON public.store_sku_mappings FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage store mappings"
  ON public.store_sku_mappings FOR ALL
  USING (auth.role() = 'service_role');

-- Price Suggestions policies (user-scoped)
CREATE POLICY "Users can view their price suggestions"
  ON public.price_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create price suggestions"
  ON public.price_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their price suggestions"
  ON public.price_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their price suggestions"
  ON public.price_suggestions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage price suggestions"
  ON public.price_suggestions FOR ALL
  USING (auth.role() = 'service_role');

-- User Lookup Limits policies
CREATE POLICY "Users can view their own limits"
  ON public.user_lookup_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage lookup limits"
  ON public.user_lookup_limits FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_product_catalog_category ON public.product_catalog(category);
CREATE INDEX idx_product_catalog_trade ON public.product_catalog(trade);
CREATE INDEX idx_product_catalog_search ON public.product_catalog USING gin(search_keywords);
CREATE INDEX idx_store_sku_store ON public.store_sku_mappings(store);
CREATE INDEX idx_price_suggestions_user ON public.price_suggestions(user_id);
CREATE INDEX idx_price_suggestions_status ON public.price_suggestions(status);
CREATE INDEX idx_price_suggestions_expires ON public.price_suggestions(expires_at);

-- Trigger to update product_catalog.updated_at
CREATE TRIGGER update_product_catalog_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
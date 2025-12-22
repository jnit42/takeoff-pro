-- =============================================
-- PROJECT ACTUALS & LEARNING LOOP SCHEMA
-- =============================================

-- 1. Project Actuals - Track what was actually paid vs estimated
CREATE TABLE public.project_actuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  takeoff_item_id UUID REFERENCES public.takeoff_items(id) ON DELETE SET NULL,
  labor_line_item_id UUID REFERENCES public.labor_line_items(id) ON DELETE SET NULL,
  
  -- What we estimated
  estimated_amount NUMERIC NOT NULL DEFAULT 0,
  estimated_unit TEXT NOT NULL DEFAULT 'EA',
  estimated_qty NUMERIC NOT NULL DEFAULT 0,
  
  -- What actually happened
  actual_amount NUMERIC,
  actual_unit TEXT,
  actual_qty NUMERIC,
  
  -- Variance tracking
  variance_amount NUMERIC GENERATED ALWAYS AS (actual_amount - estimated_amount) STORED,
  variance_percent NUMERIC GENERATED ALWAYS AS (
    CASE WHEN estimated_amount > 0 
    THEN ROUND(((actual_amount - estimated_amount) / estimated_amount) * 100, 2)
    ELSE NULL END
  ) STORED,
  
  -- Metadata
  category TEXT NOT NULL DEFAULT 'material',
  description TEXT,
  vendor TEXT,
  paid_to TEXT, -- subcontractor name, supplier, etc.
  paid_date DATE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Receipts - Store uploaded receipt/invoice metadata
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  
  -- File storage
  file_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT DEFAULT 'image',
  
  -- OCR extracted data
  vendor_name TEXT,
  total_amount NUMERIC,
  tax_amount NUMERIC,
  subtotal NUMERIC,
  receipt_date DATE,
  receipt_number TEXT,
  
  -- Extracted line items as JSON
  line_items JSONB DEFAULT '[]'::jsonb,
  
  -- Processing status
  ocr_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  ocr_confidence NUMERIC,
  ocr_raw_text TEXT,
  
  -- Linking to actuals
  linked_actual_id UUID REFERENCES public.project_actuals(id) ON DELETE SET NULL,
  
  -- Metadata
  notes TEXT,
  tags TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Global Knowledge - Anonymized collective learning (all users benefit)
CREATE TABLE public.global_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Knowledge type
  knowledge_type TEXT NOT NULL, -- 'labor_rate', 'material_cost', 'productivity', 'waste_factor', 'markup'
  
  -- Categorization
  trade TEXT,
  category TEXT,
  region TEXT,
  project_type TEXT,
  
  -- The knowledge itself
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  
  -- Statistical data
  sample_count INTEGER NOT NULL DEFAULT 1,
  min_value NUMERIC,
  max_value NUMERIC,
  avg_value NUMERIC,
  std_dev NUMERIC,
  
  -- Confidence and source
  confidence NUMERIC DEFAULT 0.5,
  last_updated_by_project UUID, -- anonymized reference
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Project Reviews - Post-project lessons learned
CREATE TABLE public.project_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  
  -- Overall assessment
  overall_accuracy_rating INTEGER, -- 1-5 scale
  on_time BOOLEAN,
  on_budget BOOLEAN,
  
  -- What went different
  scope_changes JSONB DEFAULT '[]'::jsonb, -- [{description, impact_amount, reason}]
  pricing_variances JSONB DEFAULT '[]'::jsonb, -- [{item, estimated, actual, reason}]
  labor_variances JSONB DEFAULT '[]'::jsonb,
  
  -- Lessons learned
  what_worked TEXT,
  what_didnt_work TEXT,
  recommendations TEXT,
  
  -- Specific learnings to feed back
  learned_rates JSONB DEFAULT '[]'::jsonb, -- [{trade, task, actual_rate, notes}]
  learned_productivities JSONB DEFAULT '[]'::jsonb,
  
  -- Contribute to global knowledge?
  contribute_to_global BOOLEAN DEFAULT true,
  
  -- Status
  status TEXT DEFAULT 'draft', -- draft, completed
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_project_actuals_project ON public.project_actuals(project_id);
CREATE INDEX idx_project_actuals_category ON public.project_actuals(category);
CREATE INDEX idx_receipts_project ON public.receipts(project_id);
CREATE INDEX idx_receipts_user ON public.receipts(user_id);
CREATE INDEX idx_receipts_ocr_status ON public.receipts(ocr_status);
CREATE INDEX idx_global_knowledge_type ON public.global_knowledge(knowledge_type);
CREATE INDEX idx_global_knowledge_trade ON public.global_knowledge(trade);
CREATE INDEX idx_global_knowledge_key ON public.global_knowledge(key);
CREATE INDEX idx_project_reviews_project ON public.project_reviews(project_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Project Actuals RLS
ALTER TABLE public.project_actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view actuals for their projects"
  ON public.project_actuals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_actuals.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create actuals for their projects"
  ON public.project_actuals FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_actuals.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update actuals for their projects"
  ON public.project_actuals FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_actuals.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete actuals for their projects"
  ON public.project_actuals FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_actuals.project_id 
    AND projects.user_id = auth.uid()
  ));

-- Receipts RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipts for their projects"
  ON public.receipts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = receipts.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create receipts for their projects"
  ON public.receipts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = receipts.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update receipts for their projects"
  ON public.receipts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = receipts.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete receipts for their projects"
  ON public.receipts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = receipts.project_id 
    AND projects.user_id = auth.uid()
  ));

-- Global Knowledge RLS (public read, service role write)
ALTER TABLE public.global_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global knowledge"
  ON public.global_knowledge FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage global knowledge"
  ON public.global_knowledge FOR ALL
  USING (auth.role() = 'service_role');

-- Project Reviews RLS
ALTER TABLE public.project_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews for their projects"
  ON public.project_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_reviews.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create reviews for their projects"
  ON public.project_reviews FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_reviews.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update reviews for their projects"
  ON public.project_reviews FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_reviews.project_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete reviews for their projects"
  ON public.project_reviews FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_reviews.project_id 
    AND projects.user_id = auth.uid()
  ));

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================

CREATE TRIGGER update_project_actuals_updated_at
  BEFORE UPDATE ON public.project_actuals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_global_knowledge_updated_at
  BEFORE UPDATE ON public.global_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_reviews_updated_at
  BEFORE UPDATE ON public.project_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STORAGE BUCKET FOR RECEIPTS
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts', 
  'receipts', 
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
);

-- Storage policies for receipts bucket
CREATE POLICY "Users can upload receipts to their project folders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts' 
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view receipts from their project folders"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete receipts from their project folders"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM projects WHERE user_id = auth.uid()
    )
  );
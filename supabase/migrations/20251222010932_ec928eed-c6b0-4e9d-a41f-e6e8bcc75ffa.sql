-- =============================================
-- CONSTRUCTION BRAIN - AI INTELLIGENCE LAYER
-- =============================================

-- 1. Subcontractors - Track individual subs and their patterns
CREATE TABLE public.subcontractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  
  -- Basic info
  name TEXT NOT NULL,
  company_name TEXT,
  trade TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  
  -- Location
  region TEXT,
  service_area TEXT[],
  
  -- Performance metrics (calculated from actuals)
  total_projects INTEGER DEFAULT 0,
  avg_quote_accuracy NUMERIC, -- How close quotes are to actuals (%)
  avg_vs_market NUMERIC, -- Typically above/below market (%)
  reliability_score NUMERIC, -- 0-100 based on accuracy and on-time
  
  -- Pricing patterns
  typical_markup NUMERIC,
  price_trend TEXT, -- 'stable', 'increasing', 'decreasing'
  last_quote_date DATE,
  
  -- Notes
  notes TEXT,
  tags TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Subcontractor Quotes - Historical quote data
CREATE TABLE public.subcontractor_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  
  -- Quote details
  scope_description TEXT NOT NULL,
  trade TEXT NOT NULL,
  quoted_amount NUMERIC NOT NULL,
  actual_amount NUMERIC, -- Filled in after project completion
  
  -- Comparison
  market_rate_estimate NUMERIC, -- What AI thought market rate was
  variance_vs_market NUMERIC, -- % difference from market
  variance_vs_actual NUMERIC, -- % difference from what was actually paid
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected, completed
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_date DATE,
  
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Data Sources - Registry of where AI learns from
CREATE TABLE public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Source identification
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'retailer', 'forum', 'publication', 'user_data', 'api'
  url TEXT,
  
  -- Credibility
  credibility_score NUMERIC NOT NULL DEFAULT 0.5, -- 0-1 scale
  credibility_factors JSONB DEFAULT '{}'::jsonb, -- Why this score
  
  -- Scraping config
  scrape_enabled BOOLEAN DEFAULT true,
  scrape_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'monthly'
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  scrape_config JSONB DEFAULT '{}'::jsonb, -- URLs, selectors, etc.
  
  -- Stats
  total_imports INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Knowledge Imports - Raw scraped data before validation
CREATE TABLE public.knowledge_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  
  -- What was imported
  import_type TEXT NOT NULL, -- 'material_price', 'labor_rate', 'forum_discussion', 'article'
  raw_data JSONB NOT NULL,
  
  -- Extracted knowledge
  extracted_key TEXT, -- e.g., '2x4x8_stud_price'
  extracted_value NUMERIC,
  extracted_unit TEXT,
  extracted_region TEXT,
  extracted_trade TEXT,
  
  -- Validation status
  validation_status TEXT DEFAULT 'pending', -- pending, validated, rejected, outlier
  validation_reason TEXT,
  confidence_score NUMERIC,
  
  -- Cross-validation
  corroborating_sources INTEGER DEFAULT 0,
  contradicting_sources INTEGER DEFAULT 0,
  
  -- Timestamps
  source_date DATE, -- When the original data was published
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  validated_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. AI Decisions - Audit log of every AI suggestion
CREATE TABLE public.ai_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  conversation_id UUID, -- Links related decisions
  
  -- What was asked
  input_text TEXT NOT NULL,
  input_context JSONB, -- Project state, conversation history, etc.
  
  -- What AI decided
  decision_type TEXT NOT NULL, -- 'price_suggestion', 'item_addition', 'correction', 'explanation'
  output_actions JSONB, -- The actions AI proposed
  output_reasoning TEXT, -- Human-readable explanation
  
  -- Confidence and sources
  confidence_score NUMERIC, -- 0-100
  confidence_factors JSONB, -- What contributed to confidence
  data_sources_used JSONB, -- Which sources informed this decision
  
  -- Outcome tracking
  user_response TEXT, -- 'accepted', 'modified', 'rejected', 'ignored'
  user_modification JSONB, -- What user changed
  was_accurate BOOLEAN, -- Determined later from actuals
  
  -- Timestamps
  decided_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  accuracy_determined_at TIMESTAMP WITH TIME ZONE
);

-- 6. AI Conversations - Persistent memory across sessions
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Conversation state
  status TEXT DEFAULT 'active', -- active, archived
  title TEXT, -- Auto-generated summary
  
  -- Memory
  messages JSONB DEFAULT '[]'::jsonb, -- Full conversation history
  context_summary TEXT, -- AI-generated summary of key points
  learned_preferences JSONB DEFAULT '{}'::jsonb, -- What AI learned from this conversation
  
  -- Stats
  message_count INTEGER DEFAULT 0,
  decisions_made INTEGER DEFAULT 0,
  corrections_received INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE
);

-- 7. Construction Knowledge Base - Validated, AI-ready knowledge
CREATE TABLE public.construction_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Categorization
  knowledge_type TEXT NOT NULL, -- 'material_cost', 'labor_rate', 'productivity', 'waste_factor', 'rule'
  trade TEXT,
  category TEXT,
  subcategory TEXT,
  
  -- The knowledge
  key TEXT NOT NULL, -- e.g., 'framing_labor_rate_per_sf'
  display_name TEXT NOT NULL, -- Human-readable name
  description TEXT,
  
  -- Values with statistical backing
  value NUMERIC,
  unit TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  avg_value NUMERIC,
  std_deviation NUMERIC,
  
  -- Regional variations
  region TEXT, -- NULL means national average
  regional_multipliers JSONB DEFAULT '{}'::jsonb, -- {"CA": 1.3, "TX": 0.85}
  
  -- Confidence and freshness
  sample_count INTEGER DEFAULT 0,
  confidence_score NUMERIC DEFAULT 0.5,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  data_freshness_days INTEGER, -- How old the underlying data is
  
  -- Source tracking
  primary_sources JSONB DEFAULT '[]'::jsonb, -- Source IDs that contribute
  is_user_contributed BOOLEAN DEFAULT false,
  is_system_seeded BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_knowledge_key UNIQUE (knowledge_type, key, trade, region)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_subcontractors_user ON public.subcontractors(user_id);
CREATE INDEX idx_subcontractors_trade ON public.subcontractors(trade);
CREATE INDEX idx_subcontractor_quotes_sub ON public.subcontractor_quotes(subcontractor_id);
CREATE INDEX idx_subcontractor_quotes_project ON public.subcontractor_quotes(project_id);
CREATE INDEX idx_data_sources_type ON public.data_sources(source_type);
CREATE INDEX idx_knowledge_imports_status ON public.knowledge_imports(validation_status);
CREATE INDEX idx_knowledge_imports_type ON public.knowledge_imports(import_type);
CREATE INDEX idx_ai_decisions_user ON public.ai_decisions(user_id);
CREATE INDEX idx_ai_decisions_project ON public.ai_decisions(project_id);
CREATE INDEX idx_ai_decisions_conversation ON public.ai_decisions(conversation_id);
CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_project ON public.ai_conversations(project_id);
CREATE INDEX idx_construction_knowledge_type ON public.construction_knowledge(knowledge_type);
CREATE INDEX idx_construction_knowledge_trade ON public.construction_knowledge(trade);
CREATE INDEX idx_construction_knowledge_key ON public.construction_knowledge(key);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Subcontractors RLS
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subcontractors"
  ON public.subcontractors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subcontractors"
  ON public.subcontractors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subcontractors"
  ON public.subcontractors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subcontractors"
  ON public.subcontractors FOR DELETE
  USING (auth.uid() = user_id);

-- Subcontractor Quotes RLS
ALTER TABLE public.subcontractor_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotes for their subs"
  ON public.subcontractor_quotes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM subcontractors 
    WHERE subcontractors.id = subcontractor_quotes.subcontractor_id 
    AND subcontractors.user_id = auth.uid()
  ));

CREATE POLICY "Users can create quotes for their subs"
  ON public.subcontractor_quotes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM subcontractors 
    WHERE subcontractors.id = subcontractor_quotes.subcontractor_id 
    AND subcontractors.user_id = auth.uid()
  ));

CREATE POLICY "Users can update quotes for their subs"
  ON public.subcontractor_quotes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM subcontractors 
    WHERE subcontractors.id = subcontractor_quotes.subcontractor_id 
    AND subcontractors.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete quotes for their subs"
  ON public.subcontractor_quotes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM subcontractors 
    WHERE subcontractors.id = subcontractor_quotes.subcontractor_id 
    AND subcontractors.user_id = auth.uid()
  ));

-- Data Sources RLS (public read, service role write)
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view data sources"
  ON public.data_sources FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage data sources"
  ON public.data_sources FOR ALL
  USING (auth.role() = 'service_role');

-- Knowledge Imports RLS (service role only)
ALTER TABLE public.knowledge_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage knowledge imports"
  ON public.knowledge_imports FOR ALL
  USING (auth.role() = 'service_role');

-- AI Decisions RLS
ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI decisions"
  ON public.ai_decisions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI decisions"
  ON public.ai_decisions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI decisions"
  ON public.ai_decisions FOR UPDATE
  USING (auth.uid() = user_id);

-- AI Conversations RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON public.ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.ai_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.ai_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Construction Knowledge RLS (public read, service role write)
ALTER TABLE public.construction_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view construction knowledge"
  ON public.construction_knowledge FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage construction knowledge"
  ON public.construction_knowledge FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- TRIGGERS
-- =============================================

CREATE TRIGGER update_subcontractors_updated_at
  BEFORE UPDATE ON public.subcontractors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON public.data_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_construction_knowledge_updated_at
  BEFORE UPDATE ON public.construction_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
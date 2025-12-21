
-- Add new columns to plan_files
ALTER TABLE public.plan_files 
ADD COLUMN IF NOT EXISTS sheet_title TEXT,
ADD COLUMN IF NOT EXISTS scale TEXT DEFAULT 'unknown';

-- Add draft column to takeoff_items
ALTER TABLE public.takeoff_items 
ADD COLUMN IF NOT EXISTS draft BOOLEAN DEFAULT false;

-- Create wizard_runs table
CREATE TABLE public.wizard_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  project_type TEXT NOT NULL,
  answers JSONB DEFAULT '{}',
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rfis table
CREATE TABLE public.rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'open',
  question TEXT NOT NULL,
  trade TEXT,
  answer TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create assumptions table
CREATE TABLE public.assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'active',
  statement TEXT NOT NULL,
  trade TEXT,
  is_exclusion BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checklist_items table
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  trade TEXT NOT NULL,
  item TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price_book table
CREATE TABLE public.price_book (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'EA',
  unit_cost NUMERIC(12,4) DEFAULT 0,
  vendor TEXT,
  notes TEXT,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assemblies table
CREATE TABLE public.assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  project_type TEXT NOT NULL,
  trade TEXT NOT NULL,
  description TEXT,
  items JSONB DEFAULT '[]',
  checklist_items JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.wizard_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assemblies ENABLE ROW LEVEL SECURITY;

-- RLS for wizard_runs
CREATE POLICY "Users can view wizard runs for their projects"
  ON public.wizard_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = wizard_runs.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can create wizard runs for their projects"
  ON public.wizard_runs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = wizard_runs.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete wizard runs for their projects"
  ON public.wizard_runs FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = wizard_runs.project_id AND user_id = auth.uid()));

-- RLS for rfis
CREATE POLICY "Users can view rfis for their projects"
  ON public.rfis FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = rfis.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can create rfis for their projects"
  ON public.rfis FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = rfis.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can update rfis for their projects"
  ON public.rfis FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = rfis.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete rfis for their projects"
  ON public.rfis FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = rfis.project_id AND user_id = auth.uid()));

-- RLS for assumptions
CREATE POLICY "Users can view assumptions for their projects"
  ON public.assumptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = assumptions.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can create assumptions for their projects"
  ON public.assumptions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = assumptions.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can update assumptions for their projects"
  ON public.assumptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = assumptions.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete assumptions for their projects"
  ON public.assumptions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = assumptions.project_id AND user_id = auth.uid()));

-- RLS for checklist_items
CREATE POLICY "Users can view checklist items for their projects"
  ON public.checklist_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = checklist_items.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can create checklist items for their projects"
  ON public.checklist_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = checklist_items.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can update checklist items for their projects"
  ON public.checklist_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = checklist_items.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete checklist items for their projects"
  ON public.checklist_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = checklist_items.project_id AND user_id = auth.uid()));

-- RLS for price_book
CREATE POLICY "Anyone can view system price book items"
  ON public.price_book FOR SELECT
  USING (is_system = true OR created_by = auth.uid());

CREATE POLICY "Users can create price book items"
  ON public.price_book FOR INSERT
  WITH CHECK (auth.uid() = created_by AND is_system = false);

CREATE POLICY "Users can update their price book items"
  ON public.price_book FOR UPDATE
  USING (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Owners can manage all price book items"
  ON public.price_book FOR ALL
  USING (public.has_role(auth.uid(), 'owner'));

-- RLS for assemblies
CREATE POLICY "Anyone can view system assemblies"
  ON public.assemblies FOR SELECT
  USING (is_system = true OR created_by = auth.uid());

CREATE POLICY "Owners can manage assemblies"
  ON public.assemblies FOR ALL
  USING (public.has_role(auth.uid(), 'owner'));

-- Seed assemblies with commonly missed items
INSERT INTO public.assemblies (name, project_type, trade, description, items, checklist_items, is_system) VALUES
-- Basement Wall Assembly
('Basement Wall Assembly', 'basement_remodel', 'Framing', 'Standard basement wall framing with insulation', 
 '[{"description": "2x4 Studs 16\" OC", "unit": "EA", "formula": "wall_lf * 0.75"},
   {"description": "2x4 Top/Bottom Plates", "unit": "LF", "formula": "wall_lf * 2"},
   {"description": "Pressure Treated Bottom Plate", "unit": "LF", "formula": "wall_lf"},
   {"description": "Foam Sill Seal", "unit": "LF", "formula": "wall_lf"},
   {"description": "Tapcon Anchors", "unit": "EA", "formula": "wall_lf / 2"},
   {"description": "R-15 Batt Insulation", "unit": "SF", "formula": "wall_sf"},
   {"description": "Vapor Barrier 6mil Poly", "unit": "SF", "formula": "wall_sf * 1.1"}]',
 '[{"item": "Fireblocking at top plate", "trade": "Framing"},
   {"item": "Blocking for TV/cabinet mounting", "trade": "Framing"},
   {"item": "Anchor adhesive for masonry", "trade": "Framing"},
   {"item": "Dehumidifier/moisture mitigation plan", "trade": "General"}]',
 true),

-- Drywall Assembly
('Drywall Finish Assembly', 'basement_remodel', 'Drywall', 'Complete drywall hang and finish',
 '[{"description": "1/2\" Drywall Sheets (4x8)", "unit": "EA", "formula": "ceiling_sf / 32 + wall_sf / 32"},
   {"description": "5/8\" Fire-Rated Drywall", "unit": "EA", "formula": "garage_ceiling_sf / 32"},
   {"description": "Drywall Screws (#6 1-5/8)", "unit": "LB", "formula": "(wall_sf + ceiling_sf) / 100"},
   {"description": "Paper Tape", "unit": "ROLL", "formula": "(wall_sf + ceiling_sf) / 500"},
   {"description": "Joint Compound (5gal)", "unit": "EA", "formula": "(wall_sf + ceiling_sf) / 400"},
   {"description": "Corner Bead", "unit": "LF", "formula": "outside_corners * ceiling_height"}]',
 '[{"item": "Paper or metal corner bead at all outside corners", "trade": "Drywall"},
   {"item": "J-bead at exposed edges", "trade": "Drywall"},
   {"item": "Sanding dust protection", "trade": "Drywall"},
   {"item": "Prime coat before paint", "trade": "Painting"}]',
 true),

-- Deck Framing Package
('Deck Framing Package', 'deck', 'Framing', 'Standard deck framing with ledger',
 '[{"description": "2x10 Joists 16\" OC", "unit": "EA", "formula": "deck_width / 1.33"},
   {"description": "2x10 Rim/Band Board", "unit": "LF", "formula": "deck_perimeter"},
   {"description": "2x10 Ledger Board", "unit": "LF", "formula": "deck_width"},
   {"description": "4x4 or 6x6 Posts", "unit": "EA", "formula": "post_count"},
   {"description": "Post Bases (Simpson)", "unit": "EA", "formula": "post_count"},
   {"description": "Joist Hangers", "unit": "EA", "formula": "joist_count"},
   {"description": "Ledger Lag Bolts 1/2x4", "unit": "EA", "formula": "deck_width / 2"},
   {"description": "Flashing Tape (Self-Adhered)", "unit": "LF", "formula": "deck_width * 1.2"},
   {"description": "Concrete Footings", "unit": "EA", "formula": "post_count"}]',
 '[{"item": "Ledger flashing tape BEFORE ledger install", "trade": "Framing"},
   {"item": "Galvanized/stainless hardware in pressure treat contact", "trade": "Framing"},
   {"item": "Blocking for stair attachment", "trade": "Framing"},
   {"item": "Post-to-beam connection hardware", "trade": "Framing"},
   {"item": "Permit inspection at framing", "trade": "General"}]',
 true),

-- Deck Surface Package
('Deck Surface Package', 'deck', 'Decking', 'Composite or wood decking with rails',
 '[{"description": "Composite Decking Boards", "unit": "SF", "formula": "deck_sf * 1.1"},
   {"description": "Hidden Fastener Clips", "unit": "EA", "formula": "deck_sf / 2"},
   {"description": "Stainless Screws for Clips", "unit": "LB", "formula": "deck_sf / 50"},
   {"description": "Rail Posts", "unit": "EA", "formula": "rail_lf / 6"},
   {"description": "Rail Sections", "unit": "LF", "formula": "rail_lf"},
   {"description": "Post Caps", "unit": "EA", "formula": "post_count"},
   {"description": "Post Sleeves", "unit": "EA", "formula": "post_count"}]',
 '[{"item": "End-seal treatment for cut composite", "trade": "Decking"},
   {"item": "Gapping tool for proper board spacing", "trade": "Decking"},
   {"item": "Color-matched screws for face-fastening", "trade": "Decking"},
   {"item": "Stair tread nosing/bullnose", "trade": "Decking"}]',
 true),

-- Trim Package
('Interior Trim Package', 'basement_remodel', 'Trim', 'Baseboard, casing, and crown',
 '[{"description": "Baseboard 3-1/4\"", "unit": "LF", "formula": "room_perimeter - door_openings_lf"},
   {"description": "Door Casing Sets", "unit": "EA", "formula": "door_count"},
   {"description": "Window Casing/Stool/Apron", "unit": "EA", "formula": "window_count"},
   {"description": "Finish Nails 15ga", "unit": "BOX", "formula": "1"},
   {"description": "Wood Filler", "unit": "TUBE", "formula": "1"},
   {"description": "Caulk (Paintable)", "unit": "TUBE", "formula": "room_count"}]',
 '[{"item": "Inside corner returns", "trade": "Trim"},
   {"item": "Scarf joints on long runs (not butt)", "trade": "Trim"},
   {"item": "Caulk top edge of base before paint", "trade": "Trim"},
   {"item": "Pre-prime back of trim for moisture areas", "trade": "Trim"}]',
 true),

-- Roofing Package
('Asphalt Shingle Roofing', 'addition', 'Roofing', 'Complete shingle roof system',
 '[{"description": "Architectural Shingles", "unit": "SQ", "formula": "roof_sf / 100 * 1.15"},
   {"description": "Bundles (3 per SQ)", "unit": "EA", "formula": "squares * 3"},
   {"description": "Synthetic Underlayment", "unit": "ROLL", "formula": "roof_sf / 1000 * 1.1"},
   {"description": "Ice & Water Shield", "unit": "ROLL", "formula": "eave_lf / 66 + valley_lf / 66"},
   {"description": "Drip Edge", "unit": "LF", "formula": "eave_lf + rake_lf"},
   {"description": "Ridge Vent", "unit": "LF", "formula": "ridge_lf"},
   {"description": "Ridge Cap Shingles", "unit": "BUNDLE", "formula": "ridge_lf / 33"},
   {"description": "Step Flashing", "unit": "EA", "formula": "wall_tie_in_lf / 0.67"},
   {"description": "Roofing Nails", "unit": "LB", "formula": "squares * 2.5"}]',
 '[{"item": "Ice & water at all eaves, valleys, penetrations", "trade": "Roofing"},
   {"item": "Kick-out flashing at wall terminations", "trade": "Roofing"},
   {"item": "Pipe boots/collars for plumbing vents", "trade": "Roofing"},
   {"item": "Counter-flashing at chimneys", "trade": "Roofing"},
   {"item": "Attic ventilation calculation", "trade": "Roofing"}]',
 true),

-- Siding Package
('Vinyl/Fiber Cement Siding', 'addition', 'Siding', 'Complete siding system',
 '[{"description": "Siding (Squares)", "unit": "SQ", "formula": "wall_sf / 100 * 1.15"},
   {"description": "House Wrap/WRB", "unit": "ROLL", "formula": "wall_sf / 1000"},
   {"description": "Seam Tape", "unit": "ROLL", "formula": "wall_sf / 500"},
   {"description": "J-Channel", "unit": "LF", "formula": "window_perimeter + door_perimeter"},
   {"description": "Starter Strip", "unit": "LF", "formula": "base_lf"},
   {"description": "Outside Corners", "unit": "EA", "formula": "corner_count"},
   {"description": "Inside Corners", "unit": "EA", "formula": "inside_corner_count"},
   {"description": "Trim Coil", "unit": "ROLL", "formula": "2"}]',
 '[{"item": "WRB lapped correctly (shingle fashion)", "trade": "Siding"},
   {"item": "All penetrations sealed/flashed", "trade": "Siding"},
   {"item": "Z-flashing above windows/doors", "trade": "Siding"},
   {"item": "Utility block for outlets/vents", "trade": "Siding"},
   {"item": "Nail hem - not face nail", "trade": "Siding"}]',
 true),

-- Window/Door Package
('Window & Door Installation', 'addition', 'Windows/Doors', 'Window and door rough-in and install',
 '[{"description": "Windows", "unit": "EA", "formula": "window_count"},
   {"description": "Exterior Doors", "unit": "EA", "formula": "ext_door_count"},
   {"description": "Interior Prehung Doors", "unit": "EA", "formula": "int_door_count"},
   {"description": "Flashing Tape (4\" wide)", "unit": "ROLL", "formula": "window_count + door_count"},
   {"description": "Shims", "unit": "PACK", "formula": "1"},
   {"description": "Low-Expand Foam", "unit": "CAN", "formula": "window_count + door_count"},
   {"description": "Exterior Caulk", "unit": "TUBE", "formula": "window_count + door_count"}]',
 '[{"item": "Sill pan flashing (sloped to exterior)", "trade": "Windows/Doors"},
   {"item": "Jamb flashing lapped correctly", "trade": "Windows/Doors"},
   {"item": "Head flashing integrated with WRB", "trade": "Windows/Doors"},
   {"item": "Low-expand foam only (not regular)", "trade": "Windows/Doors"},
   {"item": "Check for plumb/level/square", "trade": "Windows/Doors"}]',
 true);

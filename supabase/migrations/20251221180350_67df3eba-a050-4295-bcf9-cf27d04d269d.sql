
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'estimator');

-- Create user_roles table for RBAC
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'estimator',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  region TEXT DEFAULT 'Rhode Island',
  tax_percent NUMERIC(5,2) DEFAULT 7.00,
  waste_percent NUMERIC(5,2) DEFAULT 10.00,
  markup_percent NUMERIC(5,2) DEFAULT 15.00,
  labor_burden_percent NUMERIC(5,2) DEFAULT 35.00,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plan_files table for blueprint uploads
CREATE TABLE public.plan_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  sheet_label TEXT,
  notes TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create takeoff_items table
CREATE TABLE public.takeoff_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  plan_file_id UUID REFERENCES public.plan_files(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  spec TEXT,
  unit TEXT NOT NULL DEFAULT 'EA',
  quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  waste_percent NUMERIC(5,2) DEFAULT 10.00,
  adjusted_qty NUMERIC(12,4) GENERATED ALWAYS AS (quantity * (1 + waste_percent / 100)) STORED,
  package_size NUMERIC(10,2) DEFAULT 1,
  packages INTEGER GENERATED ALWAYS AS (CEIL((quantity * (1 + waste_percent / 100)) / NULLIF(package_size, 0))) STORED,
  unit_cost NUMERIC(12,4) DEFAULT 0,
  extended_cost NUMERIC(14,4) GENERATED ALWAYS AS (CEIL((quantity * (1 + waste_percent / 100)) / NULLIF(package_size, 0)) * unit_cost * package_size) STORED,
  vendor TEXT,
  phase TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create labor_tasks library table
CREATE TABLE public.labor_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trade TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'EA',
  base_rate NUMERIC(10,4) NOT NULL DEFAULT 0,
  min_rate NUMERIC(10,4),
  max_rate NUMERIC(10,4),
  default_modifiers JSONB DEFAULT '{}',
  notes TEXT,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create labor_estimates table
CREATE TABLE public.labor_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  subcontractor_name TEXT,
  assumptions JSONB DEFAULT '{}',
  total NUMERIC(14,4) DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create labor_line_items table
CREATE TABLE public.labor_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labor_estimate_id UUID REFERENCES public.labor_estimates(id) ON DELETE CASCADE NOT NULL,
  labor_task_id UUID REFERENCES public.labor_tasks(id) ON DELETE SET NULL,
  task_name TEXT NOT NULL,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'EA',
  base_rate NUMERIC(10,4) NOT NULL DEFAULT 0,
  modifiers JSONB DEFAULT '{}',
  modifier_multiplier NUMERIC(6,4) DEFAULT 1.0000,
  final_rate NUMERIC(10,4) GENERATED ALWAYS AS (base_rate * modifier_multiplier) STORED,
  extended NUMERIC(14,4) GENERATED ALWAYS AS (quantity * base_rate * modifier_multiplier) STORED,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create templates table
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create template_items table
CREATE TABLE public.template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.templates(id) ON DELETE CASCADE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('takeoff', 'labor')),
  payload JSONB NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takeoff_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'owner'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for plan_files (through project ownership)
CREATE POLICY "Users can view plan files for their projects"
  ON public.plan_files FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = plan_files.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can create plan files for their projects"
  ON public.plan_files FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = plan_files.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can update plan files for their projects"
  ON public.plan_files FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = plan_files.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete plan files for their projects"
  ON public.plan_files FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = plan_files.project_id AND user_id = auth.uid()));

-- RLS Policies for takeoff_items (through project ownership)
CREATE POLICY "Users can view takeoff items for their projects"
  ON public.takeoff_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = takeoff_items.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can create takeoff items for their projects"
  ON public.takeoff_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = takeoff_items.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can update takeoff items for their projects"
  ON public.takeoff_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = takeoff_items.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete takeoff items for their projects"
  ON public.takeoff_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = takeoff_items.project_id AND user_id = auth.uid()));

-- RLS Policies for labor_tasks (system tasks visible to all, user tasks to creator)
CREATE POLICY "Anyone can view system labor tasks"
  ON public.labor_tasks FOR SELECT
  USING (is_system = true OR created_by = auth.uid());

CREATE POLICY "Users can create custom labor tasks"
  ON public.labor_tasks FOR INSERT
  WITH CHECK (auth.uid() = created_by AND is_system = false);

CREATE POLICY "Users can update their own labor tasks"
  ON public.labor_tasks FOR UPDATE
  USING (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Owners can manage all labor tasks"
  ON public.labor_tasks FOR ALL
  USING (public.has_role(auth.uid(), 'owner'));

-- RLS Policies for labor_estimates (through project ownership)
CREATE POLICY "Users can view labor estimates for their projects"
  ON public.labor_estimates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = labor_estimates.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can create labor estimates for their projects"
  ON public.labor_estimates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = labor_estimates.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can update labor estimates for their projects"
  ON public.labor_estimates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = labor_estimates.project_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete labor estimates for their projects"
  ON public.labor_estimates FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = labor_estimates.project_id AND user_id = auth.uid()));

-- RLS Policies for labor_line_items (through labor_estimate -> project ownership)
CREATE POLICY "Users can view labor line items"
  ON public.labor_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.labor_estimates le
    JOIN public.projects p ON le.project_id = p.id
    WHERE le.id = labor_line_items.labor_estimate_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can create labor line items"
  ON public.labor_line_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.labor_estimates le
    JOIN public.projects p ON le.project_id = p.id
    WHERE le.id = labor_line_items.labor_estimate_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can update labor line items"
  ON public.labor_line_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.labor_estimates le
    JOIN public.projects p ON le.project_id = p.id
    WHERE le.id = labor_line_items.labor_estimate_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete labor line items"
  ON public.labor_line_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.labor_estimates le
    JOIN public.projects p ON le.project_id = p.id
    WHERE le.id = labor_line_items.labor_estimate_id AND p.user_id = auth.uid()
  ));

-- RLS Policies for templates
CREATE POLICY "Anyone can view system templates"
  ON public.templates FOR SELECT
  USING (is_system = true OR created_by = auth.uid());

CREATE POLICY "Users can create custom templates"
  ON public.templates FOR INSERT
  WITH CHECK (auth.uid() = created_by AND is_system = false);

CREATE POLICY "Users can update their own templates"
  ON public.templates FOR UPDATE
  USING (created_by = auth.uid() AND is_system = false);

CREATE POLICY "Owners can manage all templates"
  ON public.templates FOR ALL
  USING (public.has_role(auth.uid(), 'owner'));

-- RLS Policies for template_items
CREATE POLICY "Anyone can view system template items"
  ON public.template_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.templates WHERE id = template_items.template_id
    AND (is_system = true OR created_by = auth.uid())
  ));

CREATE POLICY "Users can manage their template items"
  ON public.template_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.templates WHERE id = template_items.template_id
    AND created_by = auth.uid() AND is_system = false
  ));

-- Create function for handling new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- First user gets owner role, others get estimator
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'estimator');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_estimates_updated_at
  BEFORE UPDATE ON public.labor_estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for plan files
INSERT INTO storage.buckets (id, name, public) VALUES ('plan-files', 'plan-files', false);

-- Storage policies for plan files
CREATE POLICY "Authenticated users can upload plan files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'plan-files' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their own plan files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'plan-files' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own plan files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'plan-files' AND auth.role() = 'authenticated');

-- Seed initial labor tasks library
INSERT INTO public.labor_tasks (name, trade, unit, base_rate, min_rate, max_rate, is_system, notes) VALUES
-- Drywall
('Hang 1/2" drywall - walls', 'Drywall', 'SF', 0.45, 0.35, 0.65, true, 'Standard wall installation'),
('Hang 1/2" drywall - ceilings', 'Drywall', 'SF', 0.55, 0.45, 0.75, true, 'Ceiling installation, more difficult'),
('Hang 5/8" drywall - walls', 'Drywall', 'SF', 0.50, 0.40, 0.70, true, 'Fire-rated wall installation'),
('Tape and mud - Level 4', 'Drywall', 'SF', 0.35, 0.28, 0.50, true, 'Standard finish for paint'),
('Tape and mud - Level 5', 'Drywall', 'SF', 0.50, 0.40, 0.70, true, 'Premium smooth finish'),
-- Framing
('Frame interior wall', 'Framing', 'LF', 8.50, 6.00, 12.00, true, '2x4 stud wall, 16" OC'),
('Frame exterior wall', 'Framing', 'LF', 12.00, 9.00, 16.00, true, '2x6 stud wall with sheathing'),
('Install ceiling joists', 'Framing', 'SF', 2.25, 1.75, 3.00, true, 'Standard ceiling framing'),
('Install floor joists', 'Framing', 'SF', 2.50, 2.00, 3.50, true, 'Standard floor framing'),
('Install rafters', 'Framing', 'SF', 3.50, 2.75, 5.00, true, 'Roof rafter installation'),
-- Trim/Finish
('Install baseboard', 'Trim', 'LF', 2.50, 1.75, 4.00, true, 'Standard baseboard installation'),
('Install crown molding', 'Trim', 'LF', 4.50, 3.00, 7.00, true, 'Crown molding installation'),
('Install casing - door', 'Trim', 'EA', 45.00, 35.00, 65.00, true, 'Per door opening'),
('Install casing - window', 'Trim', 'EA', 55.00, 40.00, 80.00, true, 'Per window'),
('Install interior door', 'Trim', 'EA', 125.00, 85.00, 185.00, true, 'Prehung interior door'),
('Install exterior door', 'Trim', 'EA', 350.00, 250.00, 500.00, true, 'Entry door installation'),
-- Flooring
('Install LVP/LVT flooring', 'Flooring', 'SF', 2.25, 1.50, 3.50, true, 'Click-lock vinyl plank'),
('Install hardwood flooring', 'Flooring', 'SF', 4.50, 3.00, 7.00, true, 'Nail-down hardwood'),
('Install tile flooring', 'Flooring', 'SF', 8.00, 5.00, 14.00, true, 'Ceramic/porcelain tile'),
('Install carpet', 'Flooring', 'SF', 1.25, 0.85, 2.00, true, 'Standard carpet with pad'),
-- Painting
('Paint walls - 2 coats', 'Painting', 'SF', 0.75, 0.50, 1.25, true, 'Brush/roll, primer + 2 coats'),
('Paint ceilings', 'Painting', 'SF', 0.85, 0.60, 1.35, true, 'Ceiling paint, 2 coats'),
('Paint trim', 'Painting', 'LF', 1.50, 1.00, 2.50, true, 'Trim paint, 2 coats'),
('Paint doors', 'Painting', 'EA', 65.00, 45.00, 95.00, true, 'Both sides, 2 coats'),
-- Demo
('Demo drywall', 'Demo', 'SF', 0.75, 0.50, 1.25, true, 'Remove and dispose'),
('Demo flooring', 'Demo', 'SF', 1.00, 0.65, 1.75, true, 'Remove and dispose'),
('Demo framing', 'Demo', 'LF', 3.50, 2.00, 5.50, true, 'Non-bearing wall demo'),
-- Insulation
('Install batt insulation - walls', 'Insulation', 'SF', 0.65, 0.45, 0.95, true, 'R-13 or R-15'),
('Install batt insulation - ceiling', 'Insulation', 'SF', 0.55, 0.40, 0.80, true, 'R-30 or R-38'),
('Install spray foam', 'Insulation', 'SF', 2.50, 1.75, 4.00, true, 'Closed cell spray foam');

-- Seed initial templates
INSERT INTO public.templates (type, name, description, is_system) VALUES
('basement_finish', 'Basement Finish', 'Complete basement finishing with bathroom option', true),
('kitchen_remodel', 'Kitchen Remodel', 'Full kitchen renovation including cabinets and appliances', true),
('bathroom_remodel', 'Bathroom Remodel', 'Complete bathroom renovation', true),
('deck_build', 'Deck Build', 'New deck construction', true),
('addition', 'Room Addition', 'Second floor or bump-out addition', true);

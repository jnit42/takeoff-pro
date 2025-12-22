-- Add product_url column to takeoff_items for storing verified product links
ALTER TABLE public.takeoff_items 
ADD COLUMN product_url TEXT;

-- Add index for items with URLs (useful for price refresh workflows)
CREATE INDEX idx_takeoff_items_has_url ON public.takeoff_items (project_id) 
WHERE product_url IS NOT NULL;
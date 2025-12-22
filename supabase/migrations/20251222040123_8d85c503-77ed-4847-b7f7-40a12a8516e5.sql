-- Add Site Conditions columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS site_access TEXT DEFAULT 'ground_level',
ADD COLUMN IF NOT EXISTS site_occupancy TEXT DEFAULT 'vacant',
ADD COLUMN IF NOT EXISTS site_parking TEXT DEFAULT 'driveway';

-- Add comments for clarity
COMMENT ON COLUMN public.projects.site_access IS 'Site access difficulty: ground_level (1.0x), stairs_only (1.15x), elevator (1.05x)';
COMMENT ON COLUMN public.projects.site_occupancy IS 'Site occupancy: vacant (1.0x), occupied (1.15x)';
COMMENT ON COLUMN public.projects.site_parking IS 'Parking situation: driveway (1.0x), street (1.10x)';
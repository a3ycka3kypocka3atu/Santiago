-- Migration: Add category, format, and instructor_name to services
-- Date: 2026-05-09
-- Purpose: Enable service filtering by category (body/mind/incubator/space) and format (individual/group)

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'body'
    CHECK (category IN ('body', 'mind', 'incubator', 'space')),
  ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'individual'
    CHECK (format IN ('individual', 'group')),
  ADD COLUMN IF NOT EXISTS instructor_name TEXT;

COMMENT ON COLUMN public.services.category IS 'Service category: body (massage/spa), mind (yoga/meditation), incubator (business/networking), space (rent)';
COMMENT ON COLUMN public.services.format IS 'Delivery format: individual or group';
COMMENT ON COLUMN public.services.instructor_name IS 'Human-readable instructor name for display purposes';

-- Backfill existing services with reasonable defaults
UPDATE public.services SET category = 'body', format = 'individual' WHERE category IS NULL;
UPDATE public.services SET instructor_name = 'Иван Протиняк' WHERE instructor_id IS NOT NULL;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_format ON public.services(format);
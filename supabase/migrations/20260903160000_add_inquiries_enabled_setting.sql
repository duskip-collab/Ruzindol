-- Add inquiries_enabled setting to app_settings table
BEGIN;

-- Add column if it doesn't exist
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS inquiries_enabled BOOLEAN DEFAULT true NOT NULL;

-- Set default value for existing rows
UPDATE public.app_settings
SET inquiries_enabled = true
WHERE inquiries_enabled IS NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_app_settings_inquiries_enabled
  ON public.app_settings(inquiries_enabled);

COMMIT;

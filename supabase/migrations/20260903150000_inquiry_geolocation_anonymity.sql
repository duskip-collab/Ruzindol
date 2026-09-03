-- Upgrade mayor_inquiries table with geolocation and anonymity support
BEGIN;

-- Add missing columns to mayor_inquiries
ALTER TABLE public.mayor_inquiries
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
  ADD COLUMN IF NOT EXISTS is_anonymous_public BOOLEAN DEFAULT false NOT NULL;

-- Add index for geographic queries
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_location
  ON public.mayor_inquiries(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add index for anonymous filter
CREATE INDEX IF NOT EXISTS idx_mayor_inquiries_anonymous
  ON public.mayor_inquiries(is_anonymous_public);

-- Ensure storage bucket exists for inquiry images
INSERT INTO storage.buckets (id, name, public)
  VALUES ('inquiry-images', 'inquiry-images', true)
  ON CONFLICT (id) DO NOTHING;

-- Drop and recreate storage policies for inquiry images
DROP POLICY IF EXISTS inquiry_images_read ON storage.objects;
CREATE POLICY inquiry_images_read
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'inquiry-images');

DROP POLICY IF EXISTS inquiry_images_insert ON storage.objects;
CREATE POLICY inquiry_images_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inquiry-images'
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS inquiry_images_delete ON storage.objects;
CREATE POLICY inquiry_images_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inquiry-images'
    AND owner = auth.uid()
  );

COMMIT;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS identity_number text,
  ADD COLUMN IF NOT EXISTS medical_history text,
  ADD COLUMN IF NOT EXISTS dental_history text,
  ADD COLUMN IF NOT EXISTS clinical_examination text,
  ADD COLUMN IF NOT EXISTS treatment_progress text,
  ADD COLUMN IF NOT EXISTS surgery_consent text,
  ADD COLUMN IF NOT EXISTS treatment_result text,
  ADD COLUMN IF NOT EXISTS xray_image text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-xrays',
  'patient-xrays',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can upload patient xray images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'patient-xrays');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can update patient xray images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'patient-xrays')
  WITH CHECK (bucket_id = 'patient-xrays');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can read patient xray images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'patient-xrays');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

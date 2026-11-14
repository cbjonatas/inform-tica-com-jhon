-- ==============================================================================
-- CRIAÇÃO DO BUCKET 'materiais' E POLÍTICAS RLS NO SUPABASE STORAGE
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materiais',
  'materiais',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4'];

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read materiais" ON storage.objects;
DROP POLICY IF EXISTS "curso files read" ON storage.objects;
DROP POLICY IF EXISTS "public read materiais videoaulas capas" ON storage.objects;
CREATE POLICY "public read materiais" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'materiais');

DROP POLICY IF EXISTS "curso files insert" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload materiais" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload materiais e capas" ON storage.objects;
CREATE POLICY "authenticated upload materiais" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materiais');

DROP POLICY IF EXISTS "anon upload materiais" ON storage.objects;
CREATE POLICY "anon upload materiais" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'materiais');

DROP POLICY IF EXISTS "curso files update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update materiais" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update materiais e capas" ON storage.objects;
CREATE POLICY "authenticated update materiais" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'materiais');

DROP POLICY IF EXISTS "anon update materiais" ON storage.objects;
CREATE POLICY "anon update materiais" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'materiais');

DROP POLICY IF EXISTS "curso files delete" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete materiais" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete materiais e capas" ON storage.objects;
CREATE POLICY "authenticated delete materiais" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'materiais');

DROP POLICY IF EXISTS "anon delete materiais" ON storage.objects;
CREATE POLICY "anon delete materiais" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'materiais');

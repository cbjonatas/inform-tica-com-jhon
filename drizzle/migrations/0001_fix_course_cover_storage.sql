-- Migração Drizzle para liberação de acesso público e upload no Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materiais',
  'materiais',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'capas',
  'capas',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "curso files read" ON storage.objects;
DROP POLICY IF EXISTS "capas read" ON storage.objects;
DROP POLICY IF EXISTS "public read materiais videoaulas capas" ON storage.objects;
CREATE POLICY "public read materiais videoaulas capas" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('materiais', 'videoaulas', 'capas'));

DROP POLICY IF EXISTS "curso files insert" ON storage.objects;
DROP POLICY IF EXISTS "capas admin write" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload materiais e capas" ON storage.objects;
CREATE POLICY "authenticated upload materiais e capas" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id IN ('materiais', 'capas'));

DROP POLICY IF EXISTS "curso files update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update materiais e capas" ON storage.objects;
CREATE POLICY "authenticated update materiais e capas" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id IN ('materiais', 'capas'));

DROP POLICY IF EXISTS "curso files delete" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete materiais e capas" ON storage.objects;
CREATE POLICY "authenticated delete materiais e capas" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id IN ('materiais', 'capas'));

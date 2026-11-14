-- ==============================================================================
-- MIGRAÇÃO DEFINITIVA: LIBERAÇÃO DE ACESSO PÚBLICO E UPLOAD NO STORAGE
-- Plataforma: "Informática com Jhon para Concursos"
-- ==============================================================================

-- 1. Assegurar que os buckets 'materiais' e 'capas' existem no storage e estão configurados como públicos (public = true)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materiais',
  'materiais',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'capas',
  'capas',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- 2. Garantir que as tags <img> e navegadores possam ler/exibir as capas sem erro 403 / 400
DROP POLICY IF EXISTS "curso files read" ON storage.objects;
DROP POLICY IF EXISTS "capas read" ON storage.objects;
DROP POLICY IF EXISTS "public read materiais" ON storage.objects;
DROP POLICY IF EXISTS "public read materiais and videoaulas" ON storage.objects;
DROP POLICY IF EXISTS "public read materiais videoaulas capas" ON storage.objects;
CREATE POLICY "public read materiais videoaulas capas" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('materiais', 'videoaulas', 'capas'));

-- 3. Permitir upload direto de imagens para os buckets 'materiais' e 'capas'
DROP POLICY IF EXISTS "curso files insert" ON storage.objects;
DROP POLICY IF EXISTS "capas admin write" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload materiais" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload materiais e capas" ON storage.objects;
CREATE POLICY "authenticated upload materiais e capas" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id IN ('materiais', 'capas'));

-- 4. Permitir atualização / substituição de arquivos nos buckets 'materiais' e 'capas'
DROP POLICY IF EXISTS "curso files update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update materiais" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update materiais e capas" ON storage.objects;
CREATE POLICY "authenticated update materiais e capas" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id IN ('materiais', 'capas'));

-- 5. Permitir deleção
DROP POLICY IF EXISTS "curso files delete" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete materiais e capas" ON storage.objects;
CREATE POLICY "authenticated delete materiais e capas" ON storage.objects
  FOR DELETE TO public
  USING (bucket_id IN ('materiais', 'capas'));

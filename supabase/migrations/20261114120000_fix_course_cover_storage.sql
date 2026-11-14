-- ==============================================================================
-- MIGRAÇÃO: LIBERAÇÃO DE ACESSO PÚBLICO E UPLOAD DE CAPAS E MATERIAIS
-- Plataforma: "Informática com Jhon para Concursos"
-- ==============================================================================

-- 1. Assegurar que o bucket 'materiais' existe no storage e está configurado como público (public = true)
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

-- 2. Garantir que as tags <img> e navegadores possam ler/exibir as capas sem erro 403 / 400
DROP POLICY IF EXISTS "public read materiais" ON storage.objects;
DROP POLICY IF EXISTS "public read materiais and videoaulas" ON storage.objects;
CREATE POLICY "public read materiais and videoaulas" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('materiais', 'videoaulas'));

-- 3. Permitir que administradores e usuários autenticados realizem upload no bucket 'materiais'
DROP POLICY IF EXISTS "authenticated upload materiais" ON storage.objects;
CREATE POLICY "authenticated upload materiais" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materiais');

-- 4. Permitir atualização / substituição de arquivos no bucket 'materiais'
DROP POLICY IF EXISTS "authenticated update materiais" ON storage.objects;
CREATE POLICY "authenticated update materiais" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'materiais');

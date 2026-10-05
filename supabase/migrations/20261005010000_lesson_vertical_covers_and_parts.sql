-- ==============================================================================
-- MIGRAÇÃO: CAPAS VERTICAIS DE AULAS E SUPORTE A MÚLTIPLAS PARTES POR ASSUNTO
-- Plataforma: "Informática com Jhon para Concursos"
-- ==============================================================================

-- 1. Adicionar colunas de capa vertical, assunto e parte na tabela lessons
ALTER TABLE public.lessons 
  ADD COLUMN IF NOT EXISTS cover_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS subject text DEFAULT '',
  ADD COLUMN IF NOT EXISTS part text DEFAULT '';

-- 2. Atualizar aulas existentes para preencher assunto e parte com base no título
UPDATE public.lessons
SET 
  subject = CASE 
    WHEN title LIKE '% — Parte%' THEN split_part(title, ' — Parte', 1)
    WHEN title LIKE '% - Parte%' THEN split_part(title, ' - Parte', 1)
    ELSE title
  END,
  part = CASE 
    WHEN title LIKE '%Parte 1%' THEN 'Parte 1'
    WHEN title LIKE '%Parte 2%' THEN 'Parte 2'
    WHEN title LIKE '%Parte 3%' THEN 'Parte 3'
    WHEN title LIKE '%Parte 4%' THEN 'Parte 4'
    ELSE 'Parte 1'
  END
WHERE subject IS NULL OR subject = '';

-- 3. Assegurar índices para busca ágil
CREATE INDEX IF NOT EXISTS idx_lessons_subject ON public.lessons(subject);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id_pos ON public.lessons(module_id, position);

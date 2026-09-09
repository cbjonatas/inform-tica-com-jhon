-- Expansão da Plataforma: Notas, Favoritos, Resumos e Atributos Avançados

-- 1. Novas colunas em lessons
ALTER TABLE public.lessons 
  ADD COLUMN IF NOT EXISTS transcription_status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS transcript_timestamps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '';

-- 2. Novas colunas em questions
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medio',
  ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'Informática Geral',
  ADD COLUMN IF NOT EXISTS subtopic text NOT NULL DEFAULT '';

-- 3. Tabela de Anotações do Aluno vinculadas a aulas e timestamps
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  timestamp_seconds int NOT NULL DEFAULT 0,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notes" ON public.notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Tabela de Favoritos do Aluno (aulas, questões, materiais, resumos)
CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL, -- 'lesson', 'question', 'material', 'summary'
  item_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  subtitle text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own favorites" ON public.favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Tabela de Resumos de Aulas gerados por IA
CREATE TABLE IF NOT EXISTS public.summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  summary_text text NOT NULL DEFAULT '',
  key_concepts jsonb NOT NULL DEFAULT '[]'::jsonb,
  important_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  exam_traps jsonb NOT NULL DEFAULT '[]'::jsonb,
  likely_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.summaries TO authenticated;
GRANT ALL ON public.summaries TO service_role;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "summaries read" ON public.summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "summaries admin" ON public.summaries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 6. Garantir políticas de storage para os buckets adicionais
CREATE POLICY "storage files read extended" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('videoaulas', 'materiais', 'videos', 'pdfs', 'materials'));

CREATE POLICY "storage files admin extended" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('videoaulas', 'materiais', 'videos', 'pdfs', 'materials') AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id IN ('videoaulas', 'materiais', 'videos', 'pdfs', 'materials') AND public.has_role(auth.uid(),'admin'));

-- 7. Seed de timestamps inteligentes nas aulas existentes
UPDATE public.lessons
SET transcript_timestamps = '[
  {"time": 0, "label": "Introdução e Visão Geral da Matéria", "text": "Bem-vindo a esta aula de Informática para Concursos. Vamos abordar o que as bancas mais cobram."},
  {"time": 120, "label": "Conceitos Fundamentais e Classificações", "text": "Observe com atenção as definições técnicas que as bancas costumam trocar."},
  {"time": 300, "label": "Pontos Críticos e Pegadinhas de Prova", "text": "Aqui está uma armadilha clássica da FGV e do Cebraspe em questões recentes."},
  {"time": 480, "label": "Resumo e Prática com Questões", "text": "Agora vamos sintetizar os tópicos essenciais para a sua revisão final."}
]'::jsonb
WHERE transcript_timestamps = '[]'::jsonb;

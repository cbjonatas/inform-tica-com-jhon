-- ==============================================================================
-- MIGRAÇÃO: SISTEMA MULTICURSOS DINÂMICO E INDEPENDENTE
-- Plataforma: "Informática com Jhon para Concursos"
-- ==============================================================================

-- 1. TABELA DE CURSOS (courses)
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Carreiras Policiais',
  status text NOT NULL DEFAULT 'published', -- 'draft' | 'published'
  position int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses read" ON public.courses FOR SELECT TO authenticated
  USING (
    status = 'published' OR 
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.student_courses 
      WHERE student_id = auth.uid() AND course_id = public.courses.id AND status = 'active'
    )
  );

CREATE POLICY "courses admin" ON public.courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 2. TABELA DE MATRÍCULAS / CONTROLE DE ACESSO DOS ALUNOS (student_courses)
CREATE TABLE IF NOT EXISTS public.student_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'blocked'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_courses TO authenticated;
GRANT ALL ON public.student_courses TO service_role;
ALTER TABLE public.student_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_courses read own" ON public.student_courses FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "student_courses admin" ON public.student_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 3. VINCULAR course_id NAS TABELAS FILHAS (Módulos, Questões e Progresso)
ALTER TABLE public.modules 
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_modules_course_id ON public.modules(course_id);

ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_questions_course_id ON public.questions(course_id);

ALTER TABLE public.lesson_progress 
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lesson_progress_course_id ON public.lesson_progress(course_id);


-- 4. POVOAMENTO INICIAL DE CURSOS INDEPENDENTES (Exemplos Reais da Plataforma)
INSERT INTO public.courses (id, title, description, cover_url, category, status, position)
VALUES 
  (
    'c1111111-1111-4111-8111-111111111111',
    'Informática para PMBA',
    'Preparação completa para o concurso da Polícia Militar da Bahia. Foco no edital FCC / IBFC, Hardware, Redes, Segurança e Pacote Office.',
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80',
    'Carreiras Policiais',
    'published',
    1
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    'Informática para PCBA',
    'Curso intensivo para Investigador e Escrivão da Polícia Civil da Bahia. Conteúdo aprofundado em Sistemas Operacionais, Redes e Segurança Cibernética.',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
    'Carreiras Policiais',
    'published',
    2
  ),
  (
    'c3333333-3333-4333-8333-333333333333',
    'Informática para BMBA',
    'Curso direcionado para o Corpo de Bombeiros Militar da Bahia. Fundamentos de TI, Internet, Correio Eletrônico e Softwares Utilitários.',
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
    'Carreiras Militares',
    'published',
    3
  ),
  (
    'c4444444-4444-4444-8444-444444444444',
    'Informática para Polícia Federal',
    'Nível avançado para Agente e Escrivão da Polícia Federal (Banca Cebraspe). Banco de dados, Python, R, Redes de Computadores e Teoria da Informação.',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
    'Carreiras Federais',
    'published',
    4
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cover_url = EXCLUDED.cover_url,
  category = EXCLUDED.category,
  status = EXCLUDED.status;


-- 5. VINCULAR MÓDULOS EXISTENTES AO PRIMEIRO CURSO (PMBA)
UPDATE public.modules 
SET course_id = 'c1111111-1111-4111-8111-111111111111'
WHERE course_id IS NULL;

-- 6. VINCULAR QUESTÕES EXISTENTES AO CURSO CORRESPONDENTE
UPDATE public.questions q
SET course_id = m.course_id
FROM public.modules m
WHERE q.module_id = m.id AND q.course_id IS NULL;

UPDATE public.questions
SET course_id = 'c1111111-1111-4111-8111-111111111111'
WHERE course_id IS NULL;

-- 7. CRIAR MÓDULOS INDEPENDENTES PARA O CURSO PCBA
INSERT INTO public.modules (id, course_id, title, description, position, published)
VALUES
  (
    'd2222222-0001-4000-8000-000000000001',
    'c2222222-2222-4222-8222-222222222222',
    'Módulo 01 — Hardware e Dispositivos de Armazenamento',
    'Conceitos fundamentais de arquitetura de computadores para a PCBA.',
    1,
    true
  ),
  (
    'd2222222-0002-4000-8000-000000000002',
    'c2222222-2222-4222-8222-222222222222',
    'Módulo 02 — Sistemas Operacionais (Windows 11 e Linux)',
    'Comandos do terminal Linux, distribuições e recursos do Windows voltados para a Polícia Civil.',
    2,
    true
  ),
  (
    'd2222222-0003-4000-8000-000000000003',
    'c2222222-2222-4222-8222-222222222222',
    'Módulo 03 — Redes de Computadores e Internet',
    'Protocolos TCP/IP, DNS, DHCP, ferramentas de navegação e conceitos de nuvem.',
    3,
    true
  ),
  (
    'd2222222-0004-4000-8000-000000000004',
    'c2222222-2222-4222-8222-222222222222',
    'Módulo 04 — Segurança da Informação e Crimes Cibernéticos',
    'Malwares, criptografia, assinatura digital e noções de perícia digital para concurso policial.',
    4,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Aulas do Módulo 01 e 02 da PCBA
INSERT INTO public.lessons (id, module_id, title, description, transcript, duration_seconds, position, published, transcription_status)
VALUES
  (
    'e2222222-0001-4000-8000-000000000001',
    'd2222222-0001-4000-8000-000000000001',
    'Aula 01 — Fundamentos de Hardware para a Polícia Civil',
    'Revisão dos componentes essenciais cobrados nas últimas provas de Investigador.',
    'Olá, futuros policiais civis! Nesta aula vamos focar exatamente no perfil de questões cobradas para a PCBA sobre arquitetura de computadores.',
    1150,
    1,
    true,
    'completed'
  ),
  (
    'e2222222-0002-4000-8000-000000000002',
    'd2222222-0002-4000-8000-000000000002',
    'Aula 01 — Linux para Investigador e Escrivão',
    'Estrutura de diretórios (/bin, /etc, /var), permissões chmod e comandos fundamentais.',
    'O Linux é figurinha carimbada nos concursos da Polícia Civil. Vamos dissecar os principais comandos de busca e manipulação de arquivos.',
    1420,
    1,
    true,
    'completed'
  )
ON CONFLICT (id) DO NOTHING;

-- Questões da PCBA
INSERT INTO public.questions (course_id, module_id, lesson_id, statement, options, correct_index, explanation, banca, ano, difficulty, subject)
VALUES
  (
    'c2222222-2222-4222-8222-222222222222',
    'd2222222-0002-4000-8000-000000000002',
    'e2222222-0002-4000-8000-000000000002',
    'No sistema operacional Linux, qual comando é utilizado para alterar as permissões de acesso de um arquivo?',
    '["chown", "chmod", "ps -ef", "grep", "top"]'::jsonb,
    1,
    'O comando chmod (change mode) é utilizado para alterar permissões de arquivos e pastas no Linux.',
    'IBFC',
    2023,
    'facil',
    'Sistemas Operacionais'
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    'd2222222-0002-4000-8000-000000000002',
    'e2222222-0002-4000-8000-000000000002',
    'Em um ambiente Linux, o diretório onde ficam concentrados os arquivos de configuração do sistema operacional é:',
    '["/bin", "/home", "/etc", "/dev", "/usr"]'::jsonb,
    2,
    'O diretório /etc armazena arquivos e scripts de configuração estáticos do sistema Linux.',
    'IBFC',
    2022,
    'medio',
    'Sistemas Operacionais'
  )
ON CONFLICT DO NOTHING;


-- 8. MATRICULAR AUTOMATICAMENTE TODOS OS USUÁRIOS EXISTENTES NOS DOIS CURSOS DEMO
INSERT INTO public.student_courses (student_id, course_id, status)
SELECT p.id, c.id, 'active'
FROM public.profiles p
CROSS JOIN (
  SELECT id FROM public.courses WHERE id IN (
    'c1111111-1111-4111-8111-111111111111', 
    'c2222222-2222-4222-8222-222222222222'
  )
) c
ON CONFLICT (student_id, course_id) DO NOTHING;

-- Atualizar trigger de novo usuário para conceder os cursos padrão automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp','')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'student')
  ON CONFLICT DO NOTHING;

  -- Matricular automaticamente nos cursos de demonstração
  INSERT INTO public.student_courses (student_id, course_id, status)
  VALUES 
    (NEW.id, 'c1111111-1111-4111-8111-111111111111', 'active'),
    (NEW.id, 'c2222222-2222-4222-8222-222222222222', 'active')
  ON CONFLICT (student_id, course_id) DO NOTHING;

  RETURN NEW;
END; $$;

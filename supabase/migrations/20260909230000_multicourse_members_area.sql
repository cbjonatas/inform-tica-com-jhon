-- ==============================================================================
-- MIGRAÇÃO: ÁREA DE MEMBROS MULTICURSOS COMPLETA E POLÍTICAS DE SEGURANÇA (RLS)
-- Plataforma: "Informática com Jhon para Concursos"
-- ==============================================================================

-- 1. Assegurar privilégio de administrador para professorjonatasg@gmail.com no backend
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE lower(email) = 'professorjonatasg@gmail.com' LIMIT 1;
  
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
    SET full_name = 'Prof. Jônatas Gomes'
    WHERE id = v_admin_id;
  END IF;
END $$;

-- 2. Atualizar função de verificação has_role para validação estrita no backend
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = _role
  ) OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND lower(email) = 'professorjonatasg@gmail.com' AND _role = 'admin'
  );
$$;

-- 3. Atualizar cursos oficiais com os nomes solicitados e capas oficiais
INSERT INTO public.courses (id, title, description, cover_url, category, status, position)
VALUES 
  (
    'c1111111-1111-4111-8111-111111111111',
    'Informática com Jhon — PMBA',
    'Preparação completa e direcionada para o concurso da Polícia Militar da Bahia.',
    '/images/capa-padrao.png',
    'Informática - PMBA',
    'published',
    1
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    'Informática com Jhon — PCBA',
    'Curso intensivo e aprofundado para Investigador e Escrivão da Polícia Civil da Bahia.',
    '/images/capa-padrao.png',
    'Informática - PCBA',
    'published',
    2
  ),
  (
    'c4444444-4444-4444-8444-444444444444',
    'Informática com Jhon — PF',
    'Nível avançado com foco total no edital da Polícia Federal (Banca Cebraspe).',
    '/images/capa-padrao.png',
    'Carreiras Policiais',
    'published',
    3
  ),
  (
    'c5555555-5555-5555-8555-555555555555',
    'Informática — Questões',
    'Treinamento intensivo através de resolução comentada de baterias de questões.',
    '/images/capa-padrao.png',
    'Informática - PMBA',
    'published',
    4
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cover_url = EXCLUDED.cover_url,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  position = EXCLUDED.position;

-- 4. Matricular automaticamente todos os alunos nos cursos oficiais
INSERT INTO public.student_courses (student_id, course_id, status)
SELECT p.id, c.id, 'active'
FROM public.profiles p
CROSS JOIN public.courses c
ON CONFLICT (student_id, course_id) DO NOTHING;

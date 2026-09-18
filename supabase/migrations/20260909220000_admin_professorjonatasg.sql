-- Migration: Definir professorjonatasg@gmail.com como Administrador da Plataforma e configurar cursos oficiais com posters

-- 1. Promover professorjonatasg@gmail.com se já existir no banco de dados auth.users
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

-- 2. Atualizar função handle_new_user para garantir privilégios de admin no registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin_email boolean;
BEGIN
  is_admin_email := (lower(NEW.email) = 'professorjonatasg@gmail.com');

  INSERT INTO public.profiles (id, full_name, email, whatsapp)
  VALUES (
    NEW.id,
    CASE 
      WHEN is_admin_email AND COALESCE(NEW.raw_user_meta_data->>'full_name','') = '' THEN 'Prof. Jônatas Gomes'
      ELSE COALESCE(NEW.raw_user_meta_data->>'full_name','')
    END,
    COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp','')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = CASE 
      WHEN is_admin_email AND public.profiles.full_name = '' THEN 'Prof. Jônatas Gomes'
      ELSE EXCLUDED.full_name
    END,
    email = EXCLUDED.email;

  -- Se for o professor, adiciona a role 'admin'
  IF is_admin_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Todos os usuários também têm a role student
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Matricular nos cursos padrão
  INSERT INTO public.student_courses (student_id, course_id, status)
  VALUES 
    (NEW.id, 'c1111111-1111-4111-8111-111111111111', 'active'),
    (NEW.id, 'c5555555-5555-5555-8555-555555555555', 'active'),
    (NEW.id, 'c2222222-2222-4222-8222-222222222222', 'active')
  ON CONFLICT (student_id, course_id) DO NOTHING;

  RETURN NEW;
END; $$;

-- 3. Atualizar cursos existentes com o poster oficial e títulos correspondentes
UPDATE public.courses
SET 
  title = 'Informática - PMBA',
  cover_url = '/images/capa-padrao.png',
  category = 'Informática - PMBA'
WHERE id = 'c1111111-1111-4111-8111-111111111111';

-- Inserir curso de Informática - Questões se ainda não existir
INSERT INTO public.courses (id, title, description, cover_url, category, status, position)
VALUES (
  'c5555555-5555-5555-8555-555555555555',
  'Informática - Questões',
  'Treinamento intensivo através de resolução comentada de questões de bancas de concursos (FCC, Cebraspe, IBFC, FGV).',
  '/images/capa-padrao.png',
  'Informática - PMBA',
  'published',
  2
)
ON CONFLICT (id) DO UPDATE SET
  title = 'Informática - Questões',
  cover_url = '/images/capa-padrao.png',
  category = 'Informática - PMBA';

-- 4. Criar módulos e aulas para o curso Informática - Questões se necessário
INSERT INTO public.modules (id, title, description, position, course_id, published)
VALUES (
  'm5555555-5555-5555-8555-555555555551',
  'Módulo 01 — Questões Comentadas de Hardware & Periféricos',
  'Resolução passo a passo de questões recentes de provas policiais e administrativas.',
  1,
  'c5555555-5555-5555-8555-555555555555',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, module_id, title, description, video_url, duration_seconds, position, published)
VALUES 
  (
    'l5555555-5555-5555-8555-555555555501',
    'm5555555-5555-5555-8555-555555555551',
    'Bateria 01 — Memórias e Processadores (FCC/IBFC)',
    'Análise de pegadinhas frequentes em provas sobre memória RAM, ROM e Cache.',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    1800,
    1,
    true
  ),
  (
    'l5555555-5555-5555-8555-555555555502',
    'm5555555-5555-5555-8555-555555555551',
    'Bateria 02 — Dispositivos de Armazenamento SSD vs HD',
    'Questões sobre barramentos NVMe, SATA e tipos de portas.',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    1650,
    2,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- 5. Vincular alunos existentes ao novo curso de Questões
INSERT INTO public.student_courses (student_id, course_id, status)
SELECT DISTINCT student_id, 'c5555555-5555-5555-8555-555555555555', 'active'
FROM public.student_courses
ON CONFLICT (student_id, course_id) DO NOTHING;

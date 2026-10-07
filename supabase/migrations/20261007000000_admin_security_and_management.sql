-- ==============================================================================
-- MIGRAÇÃO DE SEGURANÇA E GERENCIAMENTO ADMINISTRATIVO
-- Administrador Principal: professorjonatasg@gmail.com
-- ==============================================================================

-- 1. Criação das tabelas centrais caso não existam
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Carreiras Policiais',
  position int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

-- Garantir colunas de capa vertical, assunto e parte na tabela lessons
ALTER TABLE public.lessons 
  ADD COLUMN IF NOT EXISTS cover_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS subject text DEFAULT '',
  ADD COLUMN IF NOT EXISTS part text DEFAULT '';

-- 2. Função has_role com verificação segura do professorjonatasg@gmail.com e de user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = _user_id AND user_roles.role = _role
  ) OR (
    _role = 'admin'::public.app_role AND lower(coalesce(auth.jwt()->>'email', '')) = 'professorjonatasg@gmail.com'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Sobrecarga com tipo text para compatibilidade com chamadas diretas
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = _user_id AND user_roles.role::text = _role
  ) OR (
    _role = 'admin' AND lower(coalesce(auth.jwt()->>'email', '')) = 'professorjonatasg@gmail.com'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;

-- 3. Garantir role de admin para professorjonatasg@gmail.com
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'professorjonatasg@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN
    SELECT id INTO v_uid FROM public.profiles WHERE lower(email) = 'professorjonatasg@gmail.com' LIMIT 1;
  END IF;

  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- 4. Permitir criação de perfis de alunos diretamente e sincronizar com cadastros futuros
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing_profile_id uuid;
BEGIN
  -- Se o administrador já pré-cadastrou este aluno pelo e-mail
  SELECT id INTO v_existing_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_existing_profile_id IS NOT NULL AND v_existing_profile_id <> NEW.id THEN
    -- Migrar matrículas para o ID autenticado definitivo
    UPDATE public.student_courses SET student_id = NEW.id WHERE student_id = v_existing_profile_id;
    UPDATE public.lesson_progress SET user_id = NEW.id WHERE user_id = v_existing_profile_id;
    UPDATE public.question_attempts SET user_id = NEW.id WHERE user_id = v_existing_profile_id;
    DELETE FROM public.profiles WHERE id = v_existing_profile_id;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END,
    whatsapp = CASE WHEN profiles.whatsapp = '' THEN EXCLUDED.whatsapp ELSE profiles.whatsapp END;

  -- Se for o administrador principal, atribuir papel de admin
  IF lower(NEW.email) = 'professorjonatasg@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Políticas RLS para PROFILES (Alunos)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
CREATE POLICY "profiles_admin_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. Políticas RLS para COURSES
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;

DROP POLICY IF EXISTS "courses_select" ON public.courses;
CREATE POLICY "courses_select" ON public.courses
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "courses_admin_all" ON public.courses;
CREATE POLICY "courses_admin_all" ON public.courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 7. Políticas RLS para STUDENT_COURSES (Matrículas)
ALTER TABLE public.student_courses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_courses TO authenticated;

DROP POLICY IF EXISTS "student_courses_select" ON public.student_courses;
CREATE POLICY "student_courses_select" ON public.student_courses
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "student_courses_admin_all" ON public.student_courses;
CREATE POLICY "student_courses_admin_all" ON public.student_courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

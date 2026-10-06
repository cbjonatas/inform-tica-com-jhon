-- ==============================================================================
-- DEFINIR PROFESSORJONATASG@GMAIL.COM COMO ADMINISTRADOR PRINCIPAL
-- ==============================================================================

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- 1. Buscar ID pelo auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'professorjonatasg@gmail.com'
  LIMIT 1;

  -- 2. Se não encontrou em auth.users, buscar em public.profiles
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE lower(email) = 'professorjonatasg@gmail.com'
    LIMIT 1;
  END IF;

  -- 3. Inserir a permissão de administrador em user_roles se o usuário existir
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- ========================================================
-- CREAR USUARIO EN SUPABASE (Método SQL directo)
-- ========================================================
-- Ejecuta esto en: Supabase Dashboard → SQL Editor
-- Cambia los valores entre '' según necesites

BEGIN;

-- 1. Crear usuario en auth
SELECT auth.create_user(
  email := 'subsistema.pai@mspbs.gov.py',
  password := 'TuContraseña123!',
  email_confirm := true
);

-- 2. Insertar en profiles (espera 2 segundos a que se cree el auth user)
INSERT INTO profiles(
  email,
  display_name,
  username,
  updated_at
) VALUES (
  'subsistema.pai@mspbs.gov.py',
  'Sistema PAI',
  '6823848',
  NOW()
);

-- 3. Insertar en user_roles (asignar rol 'user')
INSERT INTO user_roles(user_id, role_name)
SELECT id, 'user'
FROM auth.users
WHERE email = 'subsistema.pai@mspbs.gov.py';

-- 4. Verificar que se creó
SELECT 'Usuario creado' as resultado;
SELECT * FROM profiles WHERE email = 'subsistema.pai@mspbs.gov.py';

COMMIT;

-- ========================================================
-- CAMBIOS NECESARIOS (reemplaza estos valores):
-- ========================================================
-- 'subsistema.pai@mspbs.gov.py' → tu email
-- 'TuContraseña123!' → tu contraseña (mínimo 8 caracteres)
-- 'Sistema PAI' → tu nombre completo
-- '6823848' → tu CI/usuario

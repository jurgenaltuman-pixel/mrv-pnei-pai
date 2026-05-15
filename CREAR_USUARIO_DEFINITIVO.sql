-- ========================================================
-- CREAR USUARIO + VERIFICAR RLS (SOLUCIÓN DEFINITIVA)
-- ========================================================

-- 1. Crear usuario en auth
SELECT auth.create_user(
  email := 'subsistema.pai@mspbs.gov.py',
  password := 'Sistema2026!',
  email_confirm := true
);

-- 2. Esperar 2 segundos, luego insertar en profiles
-- (en la práctica, haz esto en dos pasos: primero el auth.create_user, luego esto)
INSERT INTO profiles(
  id,
  email,
  display_name,
  username,
  updated_at
) 
SELECT 
  id,
  'subsistema.pai@mspbs.gov.py',
  'Sistema PAI',
  '6823848',
  NOW()
FROM auth.users 
WHERE email = 'subsistema.pai@mspbs.gov.py'
ON CONFLICT DO NOTHING;

-- 3. Asignar rol user
INSERT INTO user_roles(user_id, role_name)
SELECT 
  id,
  'user'
FROM auth.users
WHERE email = 'subsistema.pai@mspbs.gov.py'
ON CONFLICT DO NOTHING;

-- 4. VERIFICAR RLS - Ver si hay políticas bloqueando
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('base_personas', 'profiles', 'user_roles')
ORDER BY tablename;

-- 5. Ver RLS habilitado en tablas
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('base_personas', 'profiles', 'user_roles');

-- 6. Verificar que el usuario se creó
SELECT 
  id,
  email,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'subsistema.pai@mspbs.gov.py';

SELECT 
  id,
  email,
  display_name,
  username
FROM profiles
WHERE email = 'subsistema.pai@mspbs.gov.py';

SELECT 
  ur.user_id,
  ur.role_name,
  p.email
FROM user_roles ur
LEFT JOIN profiles p ON ur.user_id = p.id
WHERE p.email = 'subsistema.pai@mspbs.gov.py';

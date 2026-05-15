-- SQL para crear usuarios manualmente en Supabase
-- Ejecutar en: https://app.supabase.com/project/[PROJECT]/sql/new

-- 1. CREAR USUARIO EN AUTH (como admin)
SELECT auth.create_user(
  email := 'subsistema.pai@mspbs.gov.py',
  password := 'Contraseña123',
  email_confirm := true,
  user_metadata := '{"display_name":"Subsistema PAI","username":"subsistema.pai"}'::jsonb
);

-- 2. Obtener el user_id del usuario recién creado
-- (Reemplazar USER_ID_AQUI con el ID que se obtiene arriba)
-- SELECT id FROM auth.users WHERE email = 'subsistema.pai@mspbs.gov.py';

-- 3. CREAR PROFILE
INSERT INTO public.profiles (
  user_id, 
  email, 
  display_name, 
  username, 
  is_active, 
  is_approved
) SELECT 
  id, 
  email, 
  'Subsistema PAI', 
  'subsistema.pai', 
  true, 
  false
FROM auth.users
WHERE email = 'subsistema.pai@mspbs.gov.py'
ON CONFLICT (user_id) DO NOTHING;

-- 4. ASIGNAR ROL
INSERT INTO public.user_roles (user_id, role)
SELECT 
  id, 
  'user'
FROM auth.users
WHERE email = 'subsistema.pai@mspbs.gov.py'
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. VER USUARIOS CREADOS
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  p.display_name,
  p.username,
  p.is_active,
  p.is_approved,
  r.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
LEFT JOIN public.user_roles r ON u.id = r.user_id
ORDER BY u.created_at DESC;

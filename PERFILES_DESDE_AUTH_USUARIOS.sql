-- ================================================================
-- Crear profiles para usuarios que SOLO están en auth.users (Dashboard Authentication)
-- La app MRV muestra usuarios desde public.profiles, no desde Auth.
--
-- Ejecutar en Supabase → SQL Editor (rol con acceso a auth).
-- Ejecutá una vez o cuando cargues usuarios manualmente desde "Authentication".
-- ================================================================

-- 1) Perfiles faltantes (email, nombre y usuario desde metadata o email local)
INSERT INTO public.profiles (
  user_id,
  email,
  display_name,
  username,
  is_active,
  is_approved,
  must_change_password,
  scope_locked,
  created_at,
  updated_at
)
SELECT
  u.id AS user_id,
  NULLIF(trim(lower(coalesce(u.email::text, ''))), ''),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    split_part(trim(coalesce(u.email::text, '')), '@', 1)
  ),
  coalesce(
    nullif(trim(lower(coalesce(u.raw_user_meta_data->>'username', ''))), ''),
    regexp_replace(lower(split_part(trim(coalesce(u.email::text, '')), '@', 1)), '[^a-z0-9._-]', '', 'g')
  ),
  true,
  false,
  false,
  false,
  timezone('utc'::text, coalesce(u.created_at, now())),
  now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);

-- 2) Rol "user" para quien tenga perfil pero sin ningún rol
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'user'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id);

-- Verificación rápida: Auth sin perfil (debe quedar vacío después)
SELECT u.id, u.email, u.created_at AS auth_created
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ORDER BY u.created_at DESC;

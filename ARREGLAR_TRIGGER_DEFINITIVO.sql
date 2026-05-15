-- ========================================================
-- ARREGLAR TRIGGER Y PERMISOS (SOLUCIÓN DEFINITIVA)
-- ========================================================

-- 1. Eliminar trigger anterior
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- 2. Crear función SIMPLE que NO usa búsquedas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo insertar datos básicos del auth user
  INSERT INTO public.profiles(
    id,
    email,
    updated_at
  )
  VALUES(
    NEW.id,
    NEW.email,
    NOW()
  )
  ON CONFLICT(id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Crear trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Permitir a usuarios anon insertar en profiles (para signup)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert on signup" ON profiles;
CREATE POLICY "Allow insert on signup"
  ON profiles
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select own profile" ON profiles;
CREATE POLICY "Allow select own profile"
  ON profiles
  FOR SELECT
  USING (true);

-- 5. Permitir actualizar profile propio
DROP POLICY IF EXISTS "Allow update own profile" ON profiles;
CREATE POLICY "Allow update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Verificar que el trigger existe
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

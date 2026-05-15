-- ========================================================
-- SINCRONIZAR DATOS: usuarios → base_personas
-- ========================================================
-- Ejecuta esto en: Supabase Dashboard → SQL Editor

-- 1. Verificar cuál tabla tiene los datos (750K registros)
SELECT 
  table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS tamaño
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 2. Ver estructura de tabla "usuarios"
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'usuarios' AND table_schema = 'public';

-- 3. Copiar datos de usuarios a base_personas (si no existen)
INSERT INTO base_personas(documento, nombre, fecha_nacimiento)
SELECT DISTINCT 
  COALESCE(documento, ''),
  COALESCE(nombre, ''),
  COALESCE(fecha_nacimiento::date, NULL)
FROM usuarios
WHERE documento IS NOT NULL 
  AND documento != ''
  AND NOT EXISTS (
    SELECT 1 FROM base_personas bp 
    WHERE bp.documento = usuarios.documento
  )
ON CONFLICT DO NOTHING;

-- 4. Verificar si 6823848 existe ahora
SELECT * FROM base_personas WHERE documento = '6823848';

-- 5. Verificar total después de sincronizar
SELECT COUNT(*) as total_base_personas FROM base_personas;
SELECT COUNT(*) as total_usuarios FROM usuarios;

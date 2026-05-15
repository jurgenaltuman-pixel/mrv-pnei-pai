-- ========================================================
-- DIAGNÓSTICO DE DATOS EN SUPABASE
-- ========================================================
-- Ejecuta esto en: Supabase Dashboard → SQL Editor

-- 1. Verificar si la tabla existe y tiene datos
SELECT 
  'base_personas'::text as tabla,
  COUNT(*) as total_registros,
  COUNT(DISTINCT documento) as documentos_unicos
FROM base_personas;

-- 2. Ver primeros 10 registros
SELECT documento, nombre, fecha_nacimiento 
FROM base_personas 
LIMIT 10;

-- 3. Verificar si 6823848 existe
SELECT * FROM base_personas WHERE documento = '6823848';

-- 4. Contar por prefijo (si es que hay datos)
SELECT 
  SUBSTRING(documento, 1, 3) as prefijo,
  COUNT(*) as cantidad
FROM base_personas
GROUP BY SUBSTRING(documento, 1, 3)
ORDER BY cantidad DESC
LIMIT 10;

-- 5. Verificar si hay tablas alternativas con datos de usuarios
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.tables t2 WHERE t2.table_name = t.table_name)
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name LIKE '%persona%' OR table_name LIKE '%usuario%' OR table_name LIKE '%profile%'
ORDER BY table_name;

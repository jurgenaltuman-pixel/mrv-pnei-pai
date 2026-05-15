-- ========================================================
-- INSPECCIONAR ESTRUCTURA DE TABLA "usuarios"
-- ========================================================
-- Ejecuta esto para ver qué columnas tiene

-- Ver todas las columnas de la tabla usuarios
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'usuarios' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver primeros 5 registros de usuarios
SELECT * FROM usuarios LIMIT 5;

-- Ver estructura de base_personas para comparar
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'base_personas' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

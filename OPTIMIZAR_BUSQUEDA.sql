-- ===================================================================
-- OPTIMIZAR BÚSQUEDA DE USUARIOS EN SUPABASE
-- ===================================================================

-- 1. Habilitar extensión trigram (búsqueda difusa)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Crear índices de búsqueda en base_personas
CREATE INDEX IF NOT EXISTS idx_base_personas_documento_trgm 
  ON base_personas USING GIST(documento gist_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_base_personas_nombre_trgm 
  ON base_personas USING GIST(nombre gist_trgm_ops);

-- Índice compuesto para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_base_personas_search 
  ON base_personas (documento, nombre);

-- 3. Crear RPC optimizada para búsqueda de usuarios
-- Busca por documento (CI) O nombre con relevancia
DROP FUNCTION IF EXISTS search_personas_mejorada(text) CASCADE;

CREATE OR REPLACE FUNCTION search_personas_mejorada(search_term text)
RETURNS TABLE (
  documento text,
  nombre text,
  fecha_nacimiento date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.documento,
    bp.nombre,
    bp.fecha_nacimiento
  FROM base_personas bp
  WHERE 
    -- Búsqueda exacta o prefijo (más rápida, máxima prioridad)
    (documento ILIKE (search_term || '%'))
    OR
    (nombre ILIKE (search_term || '%'))
    OR
    -- Búsqueda trigram para coincidencias parciales
    (documento % search_term OR nombre % search_term)
  ORDER BY
    -- Priorizar coincidencias exactas/prefijo
    CASE 
      WHEN documento ILIKE (search_term || '%') THEN 1
      WHEN nombre ILIKE (search_term || '%') THEN 2
      ELSE 3
    END,
    -- Ordenar por relevancia (documento > nombre)
    CASE 
      WHEN documento = search_term THEN 1
      WHEN nombre ILIKE (search_term || '%') THEN 2
      ELSE 3
    END,
    nombre ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Crear RPC rápida para búsqueda por documento exacto
DROP FUNCTION IF EXISTS search_persona_by_documento(text) CASCADE;

CREATE OR REPLACE FUNCTION search_persona_by_documento(p_documento text)
RETURNS TABLE (
  documento text,
  nombre text,
  fecha_nacimiento date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bp.documento,
    bp.nombre,
    bp.fecha_nacimiento
  FROM base_personas bp
  WHERE documento = TRIM(UPPER(p_documento))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Análisis de rendimiento
-- Ejecutar después de crear índices: ANALYZE base_personas;

-- ===================================================================
-- NOTAS:
-- - Los índices trigram pueden tardar tiempo en crearse (ver ANALYZE)
-- - La RPC devuelve máximo 20 resultados
-- - Prioriza búsqueda por documento (CI) sobre nombre
-- - Soporta búsqueda difusa (ILIKE, %)
-- ===================================================================

-- 6. Analizar tabla para optimizar planner
ANALYZE base_personas;

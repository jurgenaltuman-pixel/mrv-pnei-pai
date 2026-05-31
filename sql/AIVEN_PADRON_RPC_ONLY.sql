-- RPC solo padrón (instancia dedicada Aiven, sin roles Supabase)
SET statement_timeout = '120s';

DROP FUNCTION IF EXISTS buscar_padron_documento(text, int) CASCADE;
CREATE OR REPLACE FUNCTION buscar_padron_documento(p_documento text, p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid, documento text, nombre text, tipo_documento text, fecha_nacimiento date,
  sexo text, region_sanitaria text, distrito text, servicio_salud text,
  documento_madre text, nombre_madre text, edad_anos smallint, edad_meses smallint, historial_spr jsonb
)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT bp.id, bp.documento, bp.nombre, bp.tipo_documento, bp.fecha_nacimiento,
    bp.sexo, bp.region_sanitaria, bp.distrito, bp.servicio_salud, bp.documento_madre, bp.nombre_madre,
    bp.edad_anos, bp.edad_meses, bp.historial_spr
  FROM base_personas bp
  WHERE bp.documento = btrim(p_documento)
     OR (p_documento ~ '^\d+$' AND bp.documento LIKE btrim(p_documento) || '%')
  ORDER BY CASE WHEN bp.documento = btrim(p_documento) THEN 0 ELSE 1 END, length(bp.documento), bp.nombre
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;

DROP FUNCTION IF EXISTS search_personas_mejorada(text) CASCADE;
CREATE OR REPLACE FUNCTION search_personas_mejorada(search_term text)
RETURNS TABLE (documento text, nombre text, fecha_nacimiento date)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT bp.documento, bp.nombre, bp.fecha_nacimiento FROM base_personas bp
  WHERE length(btrim(search_term)) >= 2 AND (
    bp.documento = btrim(search_term) OR bp.documento LIKE btrim(search_term) || '%'
    OR bp.nombre ILIKE btrim(search_term) || '%'
    OR (length(btrim(search_term)) >= 3 AND bp.nombre % btrim(search_term))
  )
  ORDER BY CASE WHEN bp.documento = btrim(search_term) THEN 0
    WHEN bp.documento LIKE btrim(search_term) || '%' THEN 1
    WHEN bp.nombre ILIKE btrim(search_term) || '%' THEN 2 ELSE 3 END, bp.nombre
  LIMIT 20;
$$;

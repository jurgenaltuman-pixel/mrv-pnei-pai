-- Campos de nómina nominal + historial SPR (ejecutar en Aiven después de AIVEN_SCHEMA.sql)
ALTER TABLE base_personas ADD COLUMN IF NOT EXISTS edad_anos smallint;
ALTER TABLE base_personas ADD COLUMN IF NOT EXISTS edad_meses smallint;
ALTER TABLE base_personas ADD COLUMN IF NOT EXISTS historial_spr jsonb;

CREATE INDEX IF NOT EXISTS base_personas_historial_spr_gin ON base_personas USING gin (historial_spr);

DROP FUNCTION IF EXISTS buscar_padron_documento(text, int) CASCADE;

CREATE OR REPLACE FUNCTION buscar_padron_documento(p_documento text, p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid, documento text, nombre text, tipo_documento text, fecha_nacimiento date,
  sexo text, region_sanitaria text, distrito text, servicio_salud text,
  documento_madre text, nombre_madre text, edad_anos smallint, edad_meses smallint, historial_spr jsonb
)
LANGUAGE sql STABLE AS $$
  SELECT bp.id, bp.documento, bp.nombre, bp.tipo_documento, bp.fecha_nacimiento,
    bp.sexo, bp.region_sanitaria, bp.distrito, bp.servicio_salud, bp.documento_madre, bp.nombre_madre,
    bp.edad_anos, bp.edad_meses, bp.historial_spr
  FROM base_personas bp
  WHERE bp.documento = btrim(p_documento)
     OR (p_documento ~ '^\d+$' AND bp.documento LIKE btrim(p_documento) || '%')
  ORDER BY CASE WHEN bp.documento = btrim(p_documento) THEN 0 ELSE 1 END, length(bp.documento), bp.nombre
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;

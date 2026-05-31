-- Solo padrón nominal en instancia dedicada (sin auth ni registros).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS base_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo_documento text NOT NULL DEFAULT 'CI',
  documento text NOT NULL,
  fecha_nacimiento date,
  sexo text,
  region_sanitaria text,
  distrito text,
  servicio_salud text,
  documento_madre text,
  nombre_madre text,
  edad_anos int,
  edad_meses int,
  historial_spr jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS base_personas_documento_key ON base_personas (documento);
CREATE INDEX IF NOT EXISTS idx_base_personas_nombre_trgm ON base_personas USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_base_personas_doc ON base_personas (documento text_pattern_ops);

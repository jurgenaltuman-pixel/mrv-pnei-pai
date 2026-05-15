-- Ejecutar en Supabase SQL Editor para campos del informe MRV en terreno
ALTER TABLE registros_vacunacion
  ADD COLUMN IF NOT EXISTS fuente_verificacion text,
  ADD COLUMN IF NOT EXISTS accion_tomada text,
  ADD COLUMN IF NOT EXISTS observaciones text,
  ADD COLUMN IF NOT EXISTS fecha_dosis_spr date,
  ADD COLUMN IF NOT EXISTS dosis_spr text,
  ADD COLUMN IF NOT EXISTS estado_intervencion text;

CREATE INDEX IF NOT EXISTS idx_base_personas_doc_madre ON base_personas (documento_madre);
CREATE INDEX IF NOT EXISTS idx_base_personas_fecha_nac ON base_personas (fecha_nacimiento);

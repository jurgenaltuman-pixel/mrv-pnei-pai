-- Adjuntos clip / Drive por registro (ejecutar en Aiven operativa)
ALTER TABLE registros_vacunacion
  ADD COLUMN IF NOT EXISTS transcripcion_clip text,
  ADD COLUMN IF NOT EXISTS enlace_imagen_1 text,
  ADD COLUMN IF NOT EXISTS enlace_imagen_2 text;

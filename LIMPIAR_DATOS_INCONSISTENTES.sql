-- LIMPIAR DATOS INCONSISTENTES
-- Cuando esquema_completo = true, DEBE estar como 'vacunado'

UPDATE public.registros_vacunacion
SET estado_vacunacion = 'vacunado'
WHERE esquema_completo = true AND estado_vacunacion != 'vacunado';

-- Cuando esquema_completo = false, DEBE estar como 'no_vacunado'
UPDATE public.registros_vacunacion
SET estado_vacunacion = 'no_vacunado'
WHERE esquema_completo = false AND estado_vacunacion != 'no_vacunado';

-- Alternativa: Si hay NULL values, convertirlos a 'no_vacunado'
UPDATE public.registros_vacunacion
SET estado_vacunacion = 'no_vacunado'
WHERE estado_vacunacion IS NULL;

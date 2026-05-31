import type { HistorialSprCompleto } from '@/lib/padron-spr';
import { formatEdadPersona } from '@/lib/padron-spr';

/** Sin dosis SPR en nómina ni visitas MRV previas. */
export function historialSprSinDatos(historial: HistorialSprCompleto | null): boolean {
  if (!historial) return true;
  const padron = historial.padron;
  const visitas = historial.visitas_mrv || [];
  const edadTxt = formatEdadPersona(
    { edad_anos: padron?.edad_anos, edad_meses: padron?.edad_meses },
    undefined
  );
  return !padron?.dosis?.length && !padron?.resumen && visitas.length === 0 && !edadTxt;
}

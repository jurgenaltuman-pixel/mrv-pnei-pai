/** Código temporal / documento sustituto según lineamientos RVe (editable en app). */

export function generarCodigoTemporalRve(regionCodigo?: string, distritoCodigo?: string): string {
  const reg = (regionCodigo || 'XX').replace(/\W/g, '').slice(0, 3).toUpperCase();
  const dis = (distritoCodigo || '00').replace(/\W/g, '').slice(0, 2).toUpperCase();
  const seq = Date.now().toString(36).toUpperCase().slice(-5);
  return `TMP-${reg}${dis}-${seq}`;
}

export function esCodigoTemporal(doc: string): boolean {
  return /^TMP-/i.test(doc.trim());
}

/**
 * Valida formato de código temporal o documento numérico provisional.
 * - Prefijo TMP- + bloque alfanumérico + guion + sufijo (propuesta autogenerada).
 * - O CI numérica 6–8 dígitos cuando aplica registro sin formato TMP.
 */
export function validarFormatoCodigoTemporal(doc: string): boolean {
  const t = doc.trim();
  if (!t) return false;
  if (/^\d{6,8}$/.test(t)) return true;
  return /^TMP-[A-Z0-9]{2,12}-[A-Z0-9]{4,8}$/i.test(t);
}

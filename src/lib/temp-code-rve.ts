/** Código temporal alineado a convención RVe (editable por el encuestador) */

export function generarCodigoTemporalRve(regionCodigo?: string, distritoCodigo?: string): string {
  const reg = (regionCodigo || 'XX').replace(/\W/g, '').slice(0, 3).toUpperCase();
  const dis = (distritoCodigo || '00').replace(/\W/g, '').slice(0, 2).toUpperCase();
  const seq = Date.now().toString(36).toUpperCase().slice(-5);
  return `TMP-${reg}${dis}-${seq}`;
}

export function esCodigoTemporal(doc: string): boolean {
  return /^TMP-/i.test(doc.trim());
}

export function validarFormatoCodigoTemporal(doc: string): boolean {
  const t = doc.trim();
  if (!t) return false;
  if (/^\d{6,8}$/.test(t)) return true;
  return /^TMP-[A-Z0-9]{2,12}-[A-Z0-9]{4,8}$/i.test(t);
}

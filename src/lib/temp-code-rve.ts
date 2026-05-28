/** Código sustituto sin CI: iniciales del niño/a + fecha de nacimiento (DDMMAAAA). */

import { isoToDDMMAAAA, parseDDMMAAAA } from '@/lib/format-fecha';

const CONECTORES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'E']);

/** Iniciales desde nombre completo (ej. «MARIA ELENA GONZALEZ» → MEG). */
export function inicialesDesdeNombre(nombre: string): string {
  const tokens = (nombre || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Z]/g, ''))
    .filter((t) => t.length >= 2 && !CONECTORES.has(t));

  if (tokens.length === 0) {
    const raw = (nombre || '').replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ]/g, '').toUpperCase();
    return raw.slice(0, 3) || 'NN';
  }

  const iniciales = tokens.map((t) => t.charAt(0)).join('');
  return iniciales.slice(0, 10) || 'NN';
}

/** Fecha ISO o dd/mm/aaaa → DDMMAAAA (ej. 15032015). */
export function fechaNacimientoACodigo(fecha: string | null | undefined): string | null {
  if (!fecha?.trim()) return null;
  const iso = parseDDMMAAAA(fecha);
  if (!iso) return null;
  return isoToDDMMAAAA(iso);
}

/** Código temporal: INICIALES + DDMMAAAA (ej. MEG15032015). */
export function generarCodigoTemporalDesdePersona(
  nombre: string,
  fechaNacimiento: string | null | undefined
): string | null {
  if ((nombre || '').trim().length < 3) return null;
  const ini = inicialesDesdeNombre(nombre);
  const f = fechaNacimientoACodigo(fechaNacimiento);
  if (!ini || ini === 'NN' || !f || f.length !== 8) return null;
  return `${ini}${f}`;
}

/** @deprecated Usar generarCodigoTemporalDesdePersona con nombre y fecha. */
export function generarCodigoTemporalRve(_regionCodigo?: string, _distritoCodigo?: string): string {
  return `TMP-XX00-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

const PATRON_INICIALES_FECHA = /^[A-Z]{2,10}\d{8}$/;

export function esCodigoTemporal(doc: string): boolean {
  const t = doc.trim().toUpperCase();
  if (/^TMP-/i.test(t)) return true;
  return PATRON_INICIALES_FECHA.test(t);
}

export function validarFormatoCodigoTemporal(doc: string): boolean {
  const t = doc.trim().toUpperCase();
  if (!t) return false;
  if (/^\d{6,8}$/.test(t)) return true;
  if (PATRON_INICIALES_FECHA.test(t)) return true;
  return /^TMP-[A-Z0-9]{2,12}-[A-Z0-9]{4,8}$/i.test(t);
}

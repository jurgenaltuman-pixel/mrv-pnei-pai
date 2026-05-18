/**
 * Catálogo oficial de `tipo_documento` en búsqueda y nómina (PNEI / MRV).
 */
export const TIPOS_DOCUMENTO_MRV = [
  { value: 'CI', label: 'CI', descripcion: 'Cédula de identidad' },
  { value: 'DEX', label: 'DEX', descripcion: 'Documento de identidad extranjero' },
  { value: 'OTR', label: 'OTR', descripcion: 'Otro documento' },
] as const;

export type TipoDocumentoMrv = (typeof TIPOS_DOCUMENTO_MRV)[number]['value'];

/** Solo CI se ingresa numérico; DEX/OTR permiten alfanumérico. */
export function tipoDocumentoSoloDigitos(tipo: string): boolean {
  return (tipo || 'CI').trim().toUpperCase() === 'CI';
}

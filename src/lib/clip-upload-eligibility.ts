/** Reglas de habilitación para guardar adjuntos Drive (APK / web). */
export function puedeGuardarClipDrive(documento: string): boolean {
  return documento.trim().length >= 4;
}

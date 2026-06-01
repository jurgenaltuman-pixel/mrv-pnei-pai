/** Detecta respuesta del API cuando Drive no está configurado en el servidor (Vercel). */
export function isGoogleDriveNotConfiguredMessage(message: string): boolean {
  return /google drive no configurado/i.test(message);
}

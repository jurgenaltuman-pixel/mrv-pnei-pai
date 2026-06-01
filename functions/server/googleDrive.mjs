/**
 * Subida a Google Drive (cuenta OAuth configurada en env).
 * Requiere: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET,
 * GOOGLE_DRIVE_REFRESH_TOKEN. Carpeta destino: GOOGLE_DRIVE_FOLDER_ID o MRV por defecto.
 */
import { Readable } from 'stream';
import { google } from 'googleapis';

/** Carpeta MRV: https://drive.google.com/drive/folders/1TVTxNvx2jNrDK1b0dAGmSeFpsJONWqP7 */
export const MRV_DEFAULT_DRIVE_FOLDER_ID = '1TVTxNvx2jNrDK1b0dAGmSeFpsJONWqP7';

export function resolveDriveFolderId() {
  const fromEnv = String(process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  return fromEnv || MRV_DEFAULT_DRIVE_FOLDER_ID;
}

function getOAuthClient() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Drive no configurado en el servidor. Definí GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET y GOOGLE_DRIVE_REFRESH_TOKEN (ver docs/GOOGLE-DRIVE-ADJUNTOS.md).'
    );
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

/** Hace el archivo visible con enlace para quien tenga el link. */
async function makeFilePublic(drive, fileId) {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch (e) {
    console.warn('[google-drive] permissions:', e.message);
  }
}

/**
 * @param {{ buffer: Buffer, mimeType: string, filename: string, documento?: string }} opts
 * @returns {Promise<{ fileId: string, viewUrl: string }>}
 */
export async function uploadBufferToGoogleDrive(opts) {
  const { buffer, mimeType, filename, documento } = opts;
  const auth = getOAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const safeDoc = String(documento || 'sin-doc').replace(/[^\w.-]+/g, '_').slice(0, 40);
  const name = `MRV_${safeDoc}_${Date.now()}_${filename.replace(/[^\w.-]+/g, '_')}`.slice(0, 120);

  const parents = [resolveDriveFolderId()];

  const created = await drive.files.create({
    requestBody: { name, parents },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, webViewLink',
  });

  const fileId = created.data.id;
  if (!fileId) throw new Error('Drive no devolvió id de archivo');

  await makeFilePublic(drive, fileId);

  const viewUrl = created.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  return { fileId, viewUrl };
}

export function isGoogleDriveConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );
}

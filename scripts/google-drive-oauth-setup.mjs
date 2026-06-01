#!/usr/bin/env node
/**
 * Genera GOOGLE_DRIVE_REFRESH_TOKEN (una sola vez).
 * 1. Creá credencial OAuth "Desktop" en Google Cloud Console
 * 2. Activá Google Drive API
 * 3. node scripts/google-drive-oauth-setup.mjs
 */
import http from 'http';
import { google } from 'googleapis';
import { loadEnv } from './lib/load-env.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Definí GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET en .env.local');
  process.exit(1);
}

const PORT = Number(process.env.GOOGLE_DRIVE_OAUTH_PORT || 53682);
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;
const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
const scopes = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes });

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth2callback')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const q = new URL(req.url, REDIRECT);
  const code = q.searchParams.get('code');
  if (!code) {
    res.end('Sin código');
    server.close();
    return;
  }
  const { tokens } = await oauth2.getToken(code);
  res.end('Listo. Copiá GOOGLE_DRIVE_REFRESH_TOKEN a .env.local y Vercel. Podés cerrar esta pestaña.');
  console.log('\nGOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
  server.close();
  process.exit(0);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPuerto ${PORT} en uso. Cerrá otras terminales con google-drive-oauth-setup o ejecutá:\n` +
        `  $env:GOOGLE_DRIVE_OAUTH_PORT=53683; node scripts/google-drive-oauth-setup.mjs\n` +
        `(y agregá http://127.0.0.1:53683/oauth2callback en Google Cloud → cliente OAuth Escritorio, si usás otro puerto)\n`
    );
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Escuchando en ${REDIRECT}\n`);
  console.log('Abrí en el navegador (cuenta de prueba en Google Cloud → Público):\n');
  console.log(authUrl);
});

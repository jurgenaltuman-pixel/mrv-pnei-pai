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

const REDIRECT = 'http://127.0.0.1:53682/oauth2callback';
const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
const scopes = ['https://www.googleapis.com/auth/drive.file'];

const url = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes });

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

server.listen(53682, () => {
  console.log('Abrí en el navegador (cuenta jurgenaltuman@gmail.com o la que uses para Drive):\n');
  console.log(url);
});

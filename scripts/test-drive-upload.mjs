#!/usr/bin/env node
import { loadEnv } from './lib/load-env.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

loadEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

const base = (
  process.env.MRV_API_URL ||
  'https://rapid-vaccinator-main.vercel.app'
).replace(/\/$/, '');
const email = process.env.TEST_EMAIL || process.env.ADMIN_EMAIL;
const password = process.env.TEST_PASSWORD || process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Falta TEST_EMAIL/TEST_PASSWORD en .env.local');
  process.exit(1);
}

const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginBody = await login.json();
if (!loginBody.token) {
  console.error('Login falló', login.status, loginBody);
  process.exit(1);
}
console.log('Login OK', email);

const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const up = await fetch(`${base}/api/padron/busqueda-adjuntos`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${loginBody.token}`,
  },
  body: JSON.stringify({
    documento: '99990001',
    tipoDocumento: 'CI',
    nombre: 'TEST DRIVE MRV',
    images: [{ filename: 'test.png', mimeType: 'image/png', dataBase64: tinyPng }],
  }),
});
const text = await up.text();
console.log('Upload status', up.status);
console.log(text.slice(0, 500));

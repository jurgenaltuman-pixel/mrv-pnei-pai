/** Usuario con cuenta real: no pisar perfil ni contraseña en import/sync de nómina. */
export function isImportPlaceholderEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e.endsWith('@mrv.import') || e.endsWith('@system.vaccinator.local') || e.includes('@system.');
}

/** Fila de profiles + flag desde SQL. */
export function hasProtectedCredentials(row) {
  if (!row) return false;
  if (row.credenciales_protegidas === true) return true;
  const hasBcrypt = row.has_bcrypt === true || String(row.password_hash || '').startsWith('$2');
  const email = String(row.email || row.ac_email || '').trim().toLowerCase();
  if (!hasBcrypt || !email.includes('@')) return false;
  return !isImportPlaceholderEmail(email);
}

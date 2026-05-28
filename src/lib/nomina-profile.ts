/** Correos/valores técnicos de la nómina importada — no usar como nombre visible. */
export function isPlaceholderEmail(value: string | null | undefined): boolean {
  const v = String(value || '').trim().toLowerCase();
  if (!v.includes('@')) return false;
  return (
    v.endsWith('@system.vaccinator.local') ||
    v.endsWith('@mrv.import') ||
    v.includes('@system.')
  );
}

export function isRealUserEmail(value: string | null | undefined): boolean {
  const v = String(value || '').trim().toLowerCase();
  if (!v.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return false;
  return !isPlaceholderEmail(v);
}

/** Nombre que no es persona real (correo técnico, «CI 123…», solo dígitos). */
export function isNominaPlaceholderName(
  value: string | null | undefined,
  documento?: string
): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  if (isPlaceholderEmail(v)) return true;
  if (/^CI\s*[\d.\s-]+$/i.test(v)) return true;
  const soloDigitos = v.replace(/\D/g, '');
  if (soloDigitos.length >= 5 && soloDigitos.length === v.replace(/[\s.-]/g, '').length) return true;
  if (documento) {
    const doc = normalizeNominaDocumento(documento);
    if (doc && normalizeNominaDocumento(v) === doc) return true;
  }
  return false;
}

/** Nombre legible para formulario (nunca un correo técnico ni el CI repetido). */
export function cleanNominaDisplayName(
  displayName: string | null | undefined,
  username: string | null | undefined,
  documento?: string
): string {
  const doc = documento ? normalizeNominaDocumento(documento) : '';
  const dn = String(displayName || '').trim();
  if (dn && !isNominaPlaceholderName(dn, doc)) return dn;
  const un = String(username || '').trim();
  if (un && !isNominaPlaceholderName(un, doc)) return un;
  return '';
}

export function cleanNominaUsername(username: string | null | undefined, documento: string): string {
  const un = String(username || '').trim().toLowerCase();
  if (un && !un.includes('@')) return un;
  const digits = documento.replace(/\D/g, '');
  return digits || un.replace(/@.*/, '');
}

export function normalizeNominaDocumento(value: string): string {
  return value.replace(/\D/g, '');
}

export function mapNominaApiRow(o: Record<string, unknown>) {
  const documento =
    normalizeNominaDocumento(String(o.nomina_documento ?? o.documento ?? '')) ||
    String(o.documento ?? '').trim();
  const nombre = cleanNominaDisplayName(
    String(o.nombre ?? o.display_name ?? ''),
    String(o.username ?? ''),
    documento
  );
  const username = cleanNominaUsername(String(o.username ?? ''), documento);
  const emailRaw = String(o.email ?? '').trim().toLowerCase();
  return {
    documento,
    nombre,
    username,
    email: isRealUserEmail(emailRaw) ? emailRaw : null,
    fecha_nacimiento: null as string | null,
    assigned_region: (o.assigned_region as string | null) ?? null,
    assigned_distrito: (o.assigned_distrito as string | null) ?? null,
    assigned_servicio: (o.assigned_servicio as string | null) ?? null,
  };
}

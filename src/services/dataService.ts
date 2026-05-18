import { supabase } from '@/integrations/supabase/client';
import { SearchQuerySchema } from '@/lib/validation-schemas';
import { mrvAppCache } from '@/services/mrvAppCache';
import { mrvPadronIndexed } from '@/services/mrvPadronIndexed';

function asPersonaRows(raw: unknown): PersonaBase[] {
  if (!Array.isArray(raw)) return [];
  const out: PersonaBase[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.documento !== 'string' || typeof o.nombre !== 'string') continue;
    out.push({
      id: typeof o.id === 'string' ? o.id : undefined,
      nombre: o.nombre,
      tipo_documento: String(o.tipo_documento ?? ''),
      documento: o.documento,
      fecha_nacimiento: (o.fecha_nacimiento as string | null) ?? null,
      sexo: (o.sexo as string | null) ?? null,
      region_sanitaria: (o.region_sanitaria as string | null) ?? null,
      distrito: (o.distrito as string | null) ?? null,
      servicio_salud: (o.servicio_salud as string | null) ?? null,
      documento_madre: (o.documento_madre as string | null) ?? null,
      nombre_madre: (o.nombre_madre as string | null) ?? null,
    });
  }
  return out;
}

async function loadCachedPersonas(key: string): Promise<PersonaBase[]> {
  const rows = await mrvAppCache.getPersonaSearch(key);
  return asPersonaRows(rows);
}

function persistPersonasCache(key: string, rows: PersonaBase[]) {
  if (rows.length > 0) void mrvAppCache.savePersonaSearch(key, rows);
}

function personaBaseQueryCacheKey(maxResults: number, normalized: string) {
  return `base:${maxResults}:${normalized}`;
}

export interface PersonaBase {
  id?: string;
  nombre: string;
  tipo_documento: string;
  documento: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
  region_sanitaria: string | null;
  distrito: string | null;
  servicio_salud: string | null;
  documento_madre: string | null;
  nombre_madre: string | null;
}

export interface RegistroMRV {
  id?: string;
  user_id?: string;
  fecha_hora?: string;
  region: string;
  distrito: string;
  servicio: string | null;
  barrio: string | null;
  responsable: string | null;
  nombre: string;
  documento: string;
  fecha_nacimiento: string;
  edad?: string | null;
  sexo: string;
  libreta?: boolean;
  estado_vacuna: 'vacunado' | 'no_vacunado';
  motivo: string | null;
  latitud: number | null;
  longitud: number | null;
  tipo_vivienda?: 'efectiva' | 'revisitada' | 'sin_adulto_responsable' | 'renuente' | null;
  esquema_completo?: boolean | null;
  fuente_verificacion?: string | null;
  accion_tomada?: string | null;
  observaciones?: string | null;
  fecha_dosis_spr?: string | null;
  dosis_spr?: string | null;
  estado_intervencion?: string | null;
  tiene_cvs?: boolean | null;
}

export interface BusquedaAvanzadaFiltros {
  inicialesNombre?: string;
  inicialesApellido?: string;
  fechaNacimiento?: string;
  documentoMadre?: string;
}

/** Búsqueda nominal (campos tipo planilla / RVe). */
export interface BusquedaDatosPersonalesFiltros {
  nombre1?: string;
  nombre2?: string;
  apellido1?: string;
  apellido2?: string;
  documentoMadrePadre?: string;
  fechaNacimiento?: string;
  sexo?: string;
}

function personalSearchCacheKey(filtros: BusquedaDatosPersonalesFiltros): string {
  const pack = [
    filtros.nombre1,
    filtros.nombre2,
    filtros.apellido1,
    filtros.apellido2,
    filtros.documentoMadrePadre,
    filtros.fechaNacimiento,
    filtros.sexo,
  ]
    .map((x) => (x || '').trim().toLowerCase())
    .join('|');
  return `pers:${pack}`;
}

export type BusquedaAvanzadaFiltrosInput = BusquedaAvanzadaFiltros;

function composeMotivoDetalle(reg: Omit<RegistroMRV, 'id' | 'fecha_hora'>): string | null {
  const parts: string[] = [];
  if (reg.motivo?.trim()) parts.push(reg.motivo.trim());
  if (reg.fuente_verificacion) parts.push(`Fuente: ${reg.fuente_verificacion}`);
  if (reg.dosis_spr) parts.push(`SPR: ${reg.dosis_spr}`);
  if (reg.fecha_dosis_spr) parts.push(`Fecha SPR: ${reg.fecha_dosis_spr}`);
  if (reg.accion_tomada) parts.push(`Acción: ${reg.accion_tomada}`);
  if (reg.estado_intervencion === 'rechazo_vacunacion') parts.push('Rechazo a la vacunación');
  if (reg.observaciones?.trim()) parts.push(`Obs: ${reg.observaciones.trim().slice(0, 200)}`);
  return parts.length ? parts.join(' | ') : null;
}

export interface DashboardData {
  totalVacunados: number;
  totalNoVacunados: number;
  porDistrito: Record<string, { vacunados: number; noVacunados: number }>;
  viviendas: {
    efectiva: number;
    revisitada: number;
    sin_adulto_responsable: number;
    renuente: number;
    sin_dato: number;
  };
  esquema?: {
    completo: number;
    incompleto: number;
  };
}

function escapeILike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function normalizeText(text: string | null | undefined): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function dedupePersonasPorDocumento(rows: PersonaBase[]): PersonaBase[] {
  const seen = new Set<string>();
  const out: PersonaBase[] = [];
  for (const r of rows) {
    const k = (r.documento || '').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Búsqueda por datos personales: acepta fragmentos o iniciales por campo
 * (p. ej. «Ju» + «P» sin completar apellidos). Cada parte debe coincidir con
 * alguna palabra del nombre completo (inicio de palabra si 1 carácter; prefijo o subcadena si ≥2).
 */
export function nombreCoincidePartes(nombreCompleto: string, partesNormalizadas: string[]): boolean {
  if (partesNormalizadas.length === 0) return false;
  const hay = normalizeText(nombreCompleto);
  const words = hay.split(/\s+/).filter(Boolean);
  for (const p of partesNormalizadas) {
    if (!p) continue;
    if (p.length >= 2) {
      const ok = words.some((w) => w.startsWith(p)) || hay.includes(p);
      if (!ok) return false;
    } else {
      if (!words.some((w) => w.startsWith(p))) return false;
    }
  }
  return true;
}

function normalizeTipoVivienda(value: string | null | undefined): RegistroMRV['tipo_vivienda'] {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.includes('efect')) return 'efectiva';
  if (normalized.includes('revisit')) return 'revisitada';
  if (normalized.includes('sin') && normalized.includes('adulto')) return 'sin_adulto_responsable';
  if (normalized.includes('renuente')) return 'renuente';
  return null;
}

export type GetBasePersonasOptions = {
  limit?: number;
  signal?: AbortSignal;
};

export const dataService = {
  /**
   * Búsqueda en base_personas: CI parcial/exacto; por nombre permite varias palabras
   * (ej. apellido + nombre sin orden fijo) usando filtro en cliente.
   */
  async getBasePersonas(query: string, options?: GetBasePersonasOptions): Promise<PersonaBase[]> {
    try {
      const parsed = SearchQuerySchema.safeParse(typeof query === 'string' ? query : '');
      if (!parsed.success) return [];

      const normalized = parsed.data.trim().slice(0, 60);
      if (!normalized) return [];

      const maxResults = Math.max(5, Math.min(options?.limit ?? 20, 50));
      const pCacheKey = personaBaseQueryCacheKey(maxResults, normalized);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (await mrvPadronIndexed.isReady()) {
          const local = await mrvPadronIndexed.searchGeneral(normalized, {
            maxResults,
            isNumeric,
            needleTokens,
            normalize: normalizeText,
          });
          return local as PersonaBase[];
        }
        return await loadCachedPersonas(pCacheKey);
      }

      const fetchCap = Math.min(80, maxResults * 4);
      const signal = options?.signal;

      const rawTokens = normalized.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      const needleTokens = rawTokens.map((t) => normalizeText(t)).filter(Boolean);
      const isNumeric = /^\d+$/.test(normalized);

      if (!isNumeric && rawTokens.length === 1 && normalized.length >= 3) {
        try {
          let rpcReq = supabase.rpc('search_personas_mejorada', { search_term: normalized });
          if (signal) rpcReq = rpcReq.abortSignal(signal);
          const { data: rpcRows, error: rpcErr } = await rpcReq;
          if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
            const mapped: PersonaBase[] = (rpcRows as { documento?: string; nombre?: string; fecha_nacimiento?: string | null }[])
              .map((row) => ({
                documento: String(row.documento ?? ''),
                nombre: String(row.nombre ?? ''),
                fecha_nacimiento: row.fecha_nacimiento ?? null,
                tipo_documento: '',
                sexo: null,
                region_sanitaria: null,
                distrito: null,
                servicio_salud: null,
                documento_madre: null,
                nombre_madre: null,
              }))
              .filter((p) => p.documento.length > 0);
            if (mapped.length > 0) {
              const sliced = mapped.slice(0, maxResults);
              persistPersonasCache(pCacheKey, sliced);
              return sliced;
            }
          }
        } catch {
          /* continuar con consulta directa */
        }
      }

      let queryBuilder = supabase
        .from('base_personas')
        .select('id, nombre, tipo_documento, documento, fecha_nacimiento, sexo, region_sanitaria, distrito, servicio_salud, documento_madre, nombre_madre');

      if (isNumeric) {
        const safe = escapeILike(normalized);
        queryBuilder = queryBuilder.or(
          `documento.eq.${normalized},documento.ilike.${safe}%,documento.ilike.%${safe}%`
        );
      } else {
        if (rawTokens.length === 0) {
          return [];
        }

        const escapedAll = rawTokens.map((t) => escapeILike(t)).filter(Boolean);
        const longTokens = escapedAll.filter((t) => t.length >= 2);
        const tokensForServer = (longTokens.length > 0 ? longTokens : escapedAll).slice(0, 6);

        if (tokensForServer.length === 0) {
          return [];
        }

        if (rawTokens.length === 1 && rawTokens[0].length === 1) {
          const t = tokensForServer[0];
          queryBuilder = queryBuilder.or(`nombre.ilike.${t}%,documento.ilike.${t}%`);
        } else {
          for (const t of tokensForServer) {
            queryBuilder = queryBuilder.ilike('nombre', `%${t}%`);
          }
        }
      }

      let request = queryBuilder.limit(fetchCap);
      if (signal) request = request.abortSignal(signal);

      const { data, error } = await request;

      if (error) {
        console.error('Error en getBasePersonas:', error);
        const cached = await loadCachedPersonas(pCacheKey);
        if (cached.length) return cached;
        if (await mrvPadronIndexed.isReady()) {
          const local = await mrvPadronIndexed.searchGeneral(normalized, {
            maxResults,
            isNumeric,
            needleTokens,
            normalize: normalizeText,
          });
          return local as PersonaBase[];
        }
        return cached;
      }

      let results = (data || []) as PersonaBase[];

      if (!isNumeric && needleTokens.length > 0) {
        results = results.filter((row) => {
          const hay = normalizeText(row.nombre);
          return needleTokens.every((nt) => nt.length > 0 && hay.includes(nt));
        });
      }

      const seen = new Set<string>();
      results = results.filter((r) => {
        const k = r.documento || '';
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      const queryNormal = normalizeText(normalized);
      results.sort((a, b) => {
        const aIsExact = a.documento === normalized;
        const bIsExact = b.documento === normalized;
        if (aIsExact !== bIsExact) return aIsExact ? -1 : 1;

        const aNormal = normalizeText(a.nombre);
        const bNormal = normalizeText(b.nombre);

        if (!isNumeric && needleTokens.length > 0) {
          const score = (hay: string) =>
            needleTokens.reduce((acc, nt) => acc + (hay.includes(nt) ? nt.length : 0), 0);
          const diff = score(bNormal) - score(aNormal);
          if (diff !== 0) return diff;
        }

        const aStartsWith = aNormal.startsWith(queryNormal) ? 0 : 1;
        const bStartsWith = bNormal.startsWith(queryNormal) ? 0 : 1;
        if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith;

        return aNormal.localeCompare(bNormal);
      });

      const out = results.slice(0, maxResults);
      persistPersonasCache(pCacheKey, out);
      return out;
    } catch (err) {
      console.error('Validación en búsqueda:', err);
      const parsed = SearchQuerySchema.safeParse(typeof query === 'string' ? query : '');
      if (!parsed.success) return [];
      const norm = parsed.data.trim().slice(0, 60);
      if (!norm) return [];
      const maxRes = Math.max(5, Math.min(options?.limit ?? 20, 50));
      const rawTokens = norm.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      const needleTokens = rawTokens.map((t) => normalizeText(t)).filter(Boolean);
      const isNumeric = /^\d+$/.test(norm);
      if (await mrvPadronIndexed.isReady()) {
        const local = await mrvPadronIndexed.searchGeneral(norm, {
          maxResults: maxRes,
          isNumeric,
          needleTokens,
          normalize: normalizeText,
        });
        return local as PersonaBase[];
      }
      return await loadCachedPersonas(personaBaseQueryCacheKey(maxRes, norm));
    }
  },

  /**
   * Búsqueda por documento (número + tipo opcional en base_personas).
   */
  async buscarPersonasPorDocumento(
    documentoRaw: string,
    tipoDocumento = 'CI',
    limit = 25,
    opts?: { signal?: AbortSignal }
  ): Promise<PersonaBase[]> {
    const tipo = (tipoDocumento || 'CI').trim().toUpperCase();
    const soloDigitos = tipo === 'CI';
    const doc = soloDigitos
      ? documentoRaw.replace(/\D/g, '').trim()
      : documentoRaw.trim().replace(/\s+/g, '').toUpperCase();
    const minLen = soloDigitos ? 4 : 3;
    if (!doc || doc.length < minLen) return [];
    const cacheKey = `doc:${tipo}:${doc}`;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (await mrvPadronIndexed.isReady()) {
        const local = await mrvPadronIndexed.searchByDocument(doc, tipo, limit);
        return local as PersonaBase[];
      }
      return await loadCachedPersonas(cacheKey);
    }
    try {
      let q = supabase
        .from('base_personas')
        .select('id, nombre, tipo_documento, documento, fecha_nacimiento, sexo, region_sanitaria, distrito, servicio_salud, documento_madre, nombre_madre')
        .eq('documento', doc);
      if (tipo) {
        q = q.ilike('tipo_documento', tipo);
      }
      let request = q.limit(limit);
      if (opts?.signal) request = request.abortSignal(opts.signal);
      const { data, error } = await request;
      if (!error && data?.length) {
        const rows = data as PersonaBase[];
        persistPersonasCache(cacheKey, rows);
        return rows;
      }
      if (await mrvPadronIndexed.isReady()) {
        const local = await mrvPadronIndexed.searchByDocument(doc, tipo, limit);
        if (local.length) {
          persistPersonasCache(cacheKey, local as PersonaBase[]);
          return local as PersonaBase[];
        }
      }
      const fallback = await this.getBasePersonas(doc, { limit, signal: opts?.signal });
      persistPersonasCache(cacheKey, fallback);
      return fallback;
    } catch {
      const fallback = await this.getBasePersonas(soloDigitos ? documentoRaw.replace(/\D/g, '') : documentoRaw.trim(), {
        limit,
        signal: opts?.signal,
      });
      persistPersonasCache(cacheKey, fallback);
      return fallback;
    }
  },

  /**
   * Búsqueda para registro de usuario: prioriza CI exacto (sin letras en la consulta);
   * por nombre exige ≥3 caracteres para menos ruido. Resultados deduplicados por documento.
   */
  async buscarPersonasAltaUsuario(
    query: string,
    options?: { limit?: number; signal?: AbortSignal }
  ): Promise<PersonaBase[]> {
    const trimmed = (query || '').trim();
    const signal = options?.signal;
    const limit = Math.min(20, Math.max(6, options?.limit ?? 15));
    if (!trimmed) return [];

    const digitRun = trimmed.replace(/\D/g, '');
    const hasLetter = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(trimmed);

    if (!hasLetter && digitRun.length >= 4) {
      const rows = await this.buscarPersonasPorDocumento(digitRun, 'CI', limit, { signal });
      return dedupePersonasPorDocumento(rows);
    }

    if (normalizeText(trimmed).length < 3) return [];
    const rows = await this.getBasePersonas(trimmed, { limit, signal });
    return dedupePersonasPorDocumento(rows);
  },

  /**
   * Búsqueda por datos personales (nombre/apellidos, CI madre/padre, fecha nac., sexo).
   * `nombre` en BD es un solo campo: se exige coincidencia aproximada por tokens.
   */
  async buscarPersonasDatosPersonales(filtros: BusquedaDatosPersonalesFiltros, limit = 25): Promise<PersonaBase[]> {
    const madre = filtros.documentoMadrePadre?.replace(/\D/g, '').trim();
    const fecha = filtros.fechaNacimiento?.trim();
    const sexo = filtros.sexo?.trim().toUpperCase();
    const pKey = personalSearchCacheKey(filtros);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (await mrvPadronIndexed.isReady()) {
        const local = await mrvPadronIndexed.searchDatosPersonales(filtros, nombreCoincidePartes, normalizeText, limit);
        return local as PersonaBase[];
      }
      return await loadCachedPersonas(pKey);
    }

    const parts = [filtros.nombre1, filtros.nombre2, filtros.apellido1, filtros.apellido2]
      .map((s) => normalizeText(s))
      .filter((s) => s.length >= 1);
    const hasServerFilter =
      (madre && madre.length >= 4) || Boolean(fecha) || sexo === 'M' || sexo === 'F';

    if (parts.length > 0 && !hasServerFilter) {
      const q = [filtros.nombre1, filtros.nombre2, filtros.apellido1, filtros.apellido2]
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .join(' ');
      if (q.length < 1) return [];
      const broad = await this.getBasePersonas(q, { limit: 80 });
      const out = broad.filter((row) => nombreCoincidePartes(row.nombre, parts)).slice(0, limit);
      persistPersonasCache(pKey, out);
      return out;
    }

    if (!hasServerFilter && parts.length === 0) return [];

    try {
      let q = supabase
        .from('base_personas')
        .select('id, nombre, tipo_documento, documento, fecha_nacimiento, sexo, region_sanitaria, distrito, servicio_salud, documento_madre, nombre_madre');

      if (madre && madre.length >= 4) {
        q = q.eq('documento_madre', madre);
      }
      if (fecha) {
        q = q.eq('fecha_nacimiento', fecha);
      }
      if (sexo === 'M' || sexo === 'F') {
        q = q.eq('sexo', sexo);
      }

      const { data, error } = await q.limit(120);
      if (error || !data?.length) {
        return await loadCachedPersonas(pKey);
      }

      let results = data as PersonaBase[];
      if (parts.length > 0) {
        results = results.filter((row) => nombreCoincidePartes(row.nombre, parts));
      }

      const seen = new Set<string>();
      const out = results
        .filter((r) => {
          const k = r.documento || '';
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, limit);
      persistPersonasCache(pKey, out);
      return out;
    } catch (err) {
      console.error('buscarPersonasDatosPersonales:', err);
      return await loadCachedPersonas(pKey);
    }
  },

  /** Búsqueda combinada: iniciales + fecha nac. o CI de la madre (homogeneidad RVe) */
  async buscarPersonasAvanzada(filtros: BusquedaAvanzadaFiltros, limit = 20): Promise<PersonaBase[]> {
    const madre = filtros.documentoMadre?.replace(/\D/g, '').trim();
    const fecha = filtros.fechaNacimiento?.trim();
    const iniNom = filtros.inicialesNombre?.trim();
    const iniApe = filtros.inicialesApellido?.trim();

    if (!madre && !fecha && !iniNom && !iniApe) return [];

    try {
      let q = supabase
        .from('base_personas')
        .select('id, nombre, tipo_documento, documento, fecha_nacimiento, sexo, region_sanitaria, distrito, servicio_salud, documento_madre, nombre_madre');

      if (madre && madre.length >= 6) {
        q = q.eq('documento_madre', madre);
      }
      if (fecha) {
        q = q.eq('fecha_nacimiento', fecha);
      }

      const { data, error } = await q.limit(Math.min(limit * 3, 60));
      if (error || !data?.length) return [];

      let results = data as PersonaBase[];
      const tokens: string[] = [];
      if (iniNom) tokens.push(normalizeText(iniNom));
      if (iniApe) tokens.push(normalizeText(iniApe));

      if (tokens.length > 0) {
        results = results.filter((row) => {
          const hay = normalizeText(row.nombre);
          return tokens.every((t) => t.length > 0 && hay.includes(t));
        });
      }

      const seen = new Set<string>();
      return results
        .filter((r) => {
          const k = r.documento || '';
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, limit);
    } catch (err) {
      console.error('buscarPersonasAvanzada:', err);
      return [];
    }
  },

  async guardarRegistro(registro: Omit<RegistroMRV, 'id' | 'fecha_hora'>): Promise<boolean> {
    // Normalización estricta: solo 'vacunado' o 'no_vacunado' como string
    let estado = registro.estado_vacuna;
    if (typeof estado !== 'string' || (estado !== 'vacunado' && estado !== 'no_vacunado')) {
      console.warn('⚠️ Valor de estado_vacuna inválido al guardar:', estado, '-> Se fuerza a "no_vacunado"');
      estado = 'no_vacunado';
    }
    const motivoCompuesto = composeMotivoDetalle(registro);
    const payloadBase: Record<string, unknown> = {
      user_id: registro.user_id,
      region: registro.region,
      distrito: registro.distrito,
      servicio: registro.servicio || null,
      barrio: registro.barrio || null,
      responsable: registro.responsable || null,
      nombre: registro.nombre,
      documento: registro.documento,
      fecha_nacimiento: registro.fecha_nacimiento,
      edad: registro.edad ? parseInt(String(registro.edad), 10) : null,
      sexo: registro.sexo,
      libreta: registro.libreta,
      estado_vacunacion: estado,
      motivo: motivoCompuesto,
      latitud: registro.latitud,
      longitud: registro.longitud,
      tipo_vivienda: normalizeTipoVivienda(registro.tipo_vivienda ?? null),
      esquema_completo: registro.esquema_completo ?? null,
      fuente_verificacion: registro.fuente_verificacion ?? null,
      accion_tomada: registro.accion_tomada ?? null,
      observaciones: registro.observaciones?.trim() || null,
      fecha_dosis_spr: registro.fecha_dosis_spr || null,
      dosis_spr: registro.dosis_spr ?? null,
      estado_intervencion: registro.estado_intervencion ?? null,
    };

    let { error } = await supabase.from('registros_vacunacion').insert(payloadBase);
    if (!error) return true;

    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('column') || msg.includes('schema')) {
      const fallback = { ...payloadBase };
      delete fallback.fuente_verificacion;
      delete fallback.accion_tomada;
      delete fallback.observaciones;
      delete fallback.fecha_dosis_spr;
      delete fallback.dosis_spr;
      delete fallback.estado_intervencion;
      const retry = await supabase.from('registros_vacunacion').insert(fallback);
      if (!retry.error) return true;
      console.error('Error guardando registro (fallback):', retry.error);
      return false;
    }
    console.error('Error guardando registro:', error);
    return false;
  },

  async getDashboard(): Promise<DashboardData> {
    let hasTipoVivienda = true;
    let hasEsquemaCompleto = true;
    let { data, error } = await supabase
      .from('registros_vacunacion')
      .select('estado_vacunacion, distrito, tipo_vivienda, esquema_completo');

    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (message.includes('tipo_vivienda')) hasTipoVivienda = false;
      if (message.includes('esquema_completo')) hasEsquemaCompleto = false;

      const fields = ['estado_vacunacion', 'distrito'];
      if (hasTipoVivienda) fields.push('tipo_vivienda');
      if (hasEsquemaCompleto) fields.push('esquema_completo');

      const fallback = await supabase
        .from('registros_vacunacion')
        .select(fields.join(', '));
      data = fallback.data as any[] | null;
      error = fallback.error;

      // Segundo fallback si aún falla por falta de columna
      if (error && (error.message || '').toLowerCase().includes('column')) {
        const fallback2 = await supabase
          .from('registros_vacunacion')
          .select('estado_vacunacion, distrito');
        data = fallback2.data as any[] | null;
        error = fallback2.error;
        hasTipoVivienda = false;
        hasEsquemaCompleto = false;
      }
    }

    if (error || !data) {
      return {
        totalVacunados: 0, totalNoVacunados: 0, porDistrito: {},
        viviendas: { efectiva: 0, revisitada: 0, sin_adulto_responsable: 0, renuente: 0, sin_dato: 0 },
        esquema: { completo: 0, incompleto: 0 },
      };
    }

    let totalVacunados = 0;
    let totalNoVacunados = 0;
    const porDistrito: Record<string, { vacunados: number; noVacunados: number }> = {};
    const viviendas = { efectiva: 0, revisitada: 0, sin_adulto_responsable: 0, renuente: 0, sin_dato: 0 };
    const esquema = { completo: 0, incompleto: 0 };
    let nullCount = 0;

    data.forEach((r: any) => {
      // Debug: detectar valores null o inválidos
      if (r.estado_vacunacion === null || r.estado_vacunacion === undefined) {
        console.warn('Registro con estado_vacunacion null/undefined:', { nombre: r.nombre, documento: r.documento });
        nullCount++;
        totalNoVacunados++; // Asumir no_vacunado si está null
      } else if (r.estado_vacunacion === 'vacunado') {
        totalVacunados++;
      } else {
        totalNoVacunados++;
      }

      const distrito = r.distrito || 'Sin distrito';
      if (!porDistrito[distrito]) porDistrito[distrito] = { vacunados: 0, noVacunados: 0 };
      if (r.estado_vacunacion === 'vacunado') porDistrito[distrito].vacunados++;
      else porDistrito[distrito].noVacunados++;

      const tipo = normalizeTipoVivienda(r.tipo_vivienda ?? null);
      if (hasTipoVivienda && tipo) {
        viviendas[tipo]++;
      } else {
        viviendas.sin_dato++;
      }

      if (hasEsquemaCompleto) {
        if (r.esquema_completo === true) esquema.completo++;
        else esquema.incompleto++;
      }
    });

    // Logging para diagnóstico
    console.log('getDashboard - Resultado final:', {
      totalRegistros: data.length,
      totalVacunados,
      totalNoVacunados,
      registrosConEstadoNull: nullCount,
      cobertura: data.length > 0 ? ((totalVacunados / data.length) * 100).toFixed(1) + '%' : '0%'
    });

    return { totalVacunados, totalNoVacunados, porDistrito, viviendas, esquema };
  },

  async getRegistros(limit = 3000): Promise<RegistroMRV[]> {
    const lim = Math.max(100, Math.min(limit, 10000));

    const mapRows = (rows: any[]): RegistroMRV[] =>
      (rows || []).map((row) => {
        let estado = row.estado_vacunacion;
        if (row.esquema_completo === true) {
          estado = 'vacunado';
        }
        if (typeof estado !== 'string' || estado !== 'vacunado') {
          estado = 'no_vacunado';
        }
        return {
          id: row.id,
          user_id: row.user_id,
          fecha_hora: row.fecha_hora,
          region: row.region || '',
          distrito: row.distrito || '',
          servicio: row.servicio ?? null,
          barrio: row.barrio ?? null,
          responsable: row.responsable ?? null,
          nombre: row.nombre || '',
          documento: row.documento || '',
          fecha_nacimiento: row.fecha_nacimiento || '',
          edad: row.edad ?? null,
          sexo: row.sexo || '',
          libreta: row.libreta ?? false,
          estado_vacuna: estado,
          motivo: row.motivo ?? null,
          latitud: row.latitud ?? null,
          longitud: row.longitud ?? null,
          tipo_vivienda: normalizeTipoVivienda(row.tipo_vivienda ?? null),
          esquema_completo: row.esquema_completo ?? null,
        };
      }) as RegistroMRV[];

    const loadSnapshot = async (): Promise<RegistroMRV[]> => {
      const raw = await mrvAppCache.getRegistrosSnapshot();
      return Array.isArray(raw) ? (raw as RegistroMRV[]) : [];
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return await loadSnapshot();
    }

    try {
      const { data, error } = await supabase
        .from('registros_vacunacion')
        .select('*')
        .order('fecha_hora', { ascending: false })
        .limit(lim);

      if (error) {
        console.error('❌ Error en getRegistros:', error);
        return await loadSnapshot();
      }

      const mapped = mapRows(data || []);
      if (mapped.length > 0) {
        void mrvAppCache.saveRegistrosSnapshot(mapped);
      }
      console.log('🟢 [getRegistros] Primeros registros normalizados:', mapped.slice(0, 3));

      if (mapped.length > 0) {
        const nullStates = mapped.filter((r) => r.estado_vacuna === null);
        const vacunados = mapped.filter((r) => r.estado_vacuna === 'vacunado');
        const noVacunados = mapped.filter((r) => r.estado_vacuna === 'no_vacunado');

        console.log('getRegistros - Análisis de datos:', {
          total: mapped.length,
          vacunados: vacunados.length,
          noVacunados: noVacunados.length,
          conEstadoNull: nullStates.length,
          primerosRegistros: mapped.slice(0, 2).map((r) => ({
            nombre: r.nombre,
            estado_vacuna: r.estado_vacuna,
            esquema: r.esquema_completo,
            tipo_vivienda: r.tipo_vivienda,
          })),
        });

        if (nullStates.length > 0) {
          console.warn('Advertencia: Hay registros con estado_vacuna = null. Esto es anómalo.');
        }
      }

      return mapped;
    } catch (e) {
      console.error('getRegistros (red):', e);
      return await loadSnapshot();
    }
  },

  async addPersonaBase(persona: PersonaBase): Promise<boolean> {
    const { error } = await supabase
      .from('base_personas')
      .insert({
        nombre: persona.nombre,
        tipo_documento: persona.tipo_documento,
        documento: persona.documento,
        fecha_nacimiento: persona.fecha_nacimiento,
        sexo: persona.sexo,
        region_sanitaria: persona.region_sanitaria,
        distrito: persona.distrito,
        servicio_salud: persona.servicio_salud,
        documento_madre: persona.documento_madre,
        nombre_madre: persona.nombre_madre,
      });
    if (error) {
      console.error('Error adding persona to base_personas:', error);
      return false;
    }
    return true;
  },
};

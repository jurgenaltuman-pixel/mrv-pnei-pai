/**
 * 📊 SERVICIO DE IMPORTACIÓN DE EXCEL
 * 
 * Funciones para:
 * - Importar usuarios
 * - Importar catálogos (regiones/distritos/servicios/barrios)
 * - Importar personas
 */

import { supabase } from '@/integrations/supabase/client';

// Tipos para la importación
export interface UserImportRow {
  ci: string;
  nombres_completos: string;
  fecha_nacimiento: string;
  nombre_usuario: string;
}

export interface UnitImportRow {
  region: string;
  distrito: string;
  servicio_salud: string;
  barrio?: string;
}

export interface PersonaImportRow {
  nombre: string;
  tipo_documento: string;
  documento: string;
  fecha_nacimiento: string;
  sexo: string;
  region_sanitaria: string;
  distrito: string;
  servicio_salud: string;
  documento_madre?: string;
  nombre_madre?: string;
}

// Función para generar contraseña temporal
function generarContrasenaTemporal(): string {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let contrasena = '';
  for (let i = 0; i < 12; i++) {
    contrasena += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return contrasena;
}

// Validar datos de usuario
export function validarUsuario(row: any): { valido: boolean; errores: string[] } {
  const errores: string[] = [];

  if (!row.ci || row.ci.toString().trim() === '') {
    errores.push('CI es requerido');
  }

  if (!row.nombres_completos || row.nombres_completos.toString().trim() === '') {
    errores.push('Nombres Completos es requerido');
  }

  if (!row.fecha_nacimiento || row.fecha_nacimiento.toString().trim() === '') {
    errores.push('Fecha de Nacimiento es requerida');
  }

  if (!row.nombre_usuario || row.nombre_usuario.toString().trim() === '') {
    errores.push('Nombre de Usuario es requerido');
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

// Validar datos de unidad
export function validarUnidad(row: any): { valido: boolean; errores: string[] } {
  const errores: string[] = [];

  if (!row.region || row.region.toString().trim() === '') {
    errores.push('Región es requerida');
  }

  if (!row.distrito || row.distrito.toString().trim() === '') {
    errores.push('Distrito es requerido');
  }

  if (!row.servicio_salud || row.servicio_salud.toString().trim() === '') {
    errores.push('Servicio de Salud es requerido');
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

// Validar datos de persona
export function validarPersona(row: any): { valido: boolean; errores: string[] } {
  const errores: string[] = [];

  if (!row.nombre || row.nombre.toString().trim() === '') {
    errores.push('Nombre es requerido');
  }

  if (!row.tipo_documento || row.tipo_documento.toString().trim() === '') {
    errores.push('Tipo Documento es requerido');
  }

  if (!row.documento || row.documento.toString().trim() === '') {
    errores.push('Documento es requerido');
  }

  if (!row.fecha_nacimiento || row.fecha_nacimiento.toString().trim() === '') {
    errores.push('Fecha de Nacimiento es requerida');
  }

  if (!row.sexo || row.sexo.toString().trim() === '') {
    errores.push('Sexo es requerido');
  }

  if (!row.region_sanitaria || row.region_sanitaria.toString().trim() === '') {
    errores.push('Región Sanitaria es requerida');
  }

  if (!row.distrito || row.distrito.toString().trim() === '') {
    errores.push('Distrito es requerido');
  }

  if (!row.servicio_salud || row.servicio_salud.toString().trim() === '') {
    errores.push('Servicio de Salud es requerido');
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

// Importar Usuarios
export async function importarUsuarios(usuarios: UserImportRow[]): Promise<{
  exitosos: number;
  fallidos: number;
  errores: Array<{ fila: number; mensaje: string }>;
  usuarios_creados: Array<{ ci: string; usuario: string; contrasena: string }>;
}> {
  const resultados = {
    exitosos: 0,
    fallidos: 0,
    errores: [] as Array<{ fila: number; mensaje: string }>,
    usuarios_creados: [] as Array<{ ci: string; usuario: string; contrasena: string }>
  };

  for (let i = 0; i < usuarios.length; i++) {
    const usuario = usuarios[i];
    const fila = i + 2; // +2 porque empieza en 1 y suma header

    // Validar
    const validacion = validarUsuario(usuario);
    if (!validacion.valido) {
      resultados.fallidos++;
      resultados.errores.push({
        fila,
        mensaje: validacion.errores.join('; ')
      });
      continue;
    }

    try {
      const contrasenaTemporal = generarContrasenaTemporal();

      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `${usuario.nombre_usuario}@system.vaccinator.local`,
        password: contrasenaTemporal,
      });

      if (authError) {
        resultados.fallidos++;
        resultados.errores.push({
          fila,
          mensaje: authError.message
        });
        continue;
      }

      // Guardar datos del usuario en tabla
      const { error: insertError } = await supabase
        .from('usuarios')
        .insert({
          user_id: authData.user?.id,
          ci: usuario.ci.toString().trim(),
          nombres_completos: usuario.nombres_completos.toString().trim(),
          fecha_nacimiento: usuario.fecha_nacimiento.toString().trim(),
          nombre_usuario: usuario.nombre_usuario.toString().trim(),
          email: `${usuario.nombre_usuario}@system.vaccinator.local`,
          activo: true
        });

      if (insertError) {
        resultados.fallidos++;
        resultados.errores.push({
          fila,
          mensaje: insertError.message
        });
        continue;
      }

      resultados.exitosos++;
      resultados.usuarios_creados.push({
        ci: usuario.ci.toString(),
        usuario: usuario.nombre_usuario.toString(),
        contrasena: contrasenaTemporal
      });

    } catch (error) {
      resultados.fallidos++;
      resultados.errores.push({
        fila,
        mensaje: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return resultados;
}

type CatalogNode = { servicios: Set<string>; barrios: Set<string> };

/** Importar catálogo: deduplica región/distrito/servicio/barrio antes de insertar. */
export async function importarCatalogo(
  unidades: UnitImportRow[],
  onProgress?: (pct: number, label: string) => void
): Promise<{
  exitosos: number;
  fallidos: number;
  errores: Array<{ fila: number; mensaje: string }>;
  resumen?: { regiones: number; distritos: number; servicios: number; barrios: number };
}> {
  const resultados = {
    exitosos: 0,
    fallidos: 0,
    errores: [] as Array<{ fila: number; mensaje: string }>,
  };

  const tree = new Map<string, Map<string, CatalogNode>>();

  for (let i = 0; i < unidades.length; i++) {
    const unidad = unidades[i];
    const fila = i + 2;
    const validacion = validarUnidad(unidad);
    if (!validacion.valido) {
      resultados.fallidos++;
      resultados.errores.push({ fila, mensaje: validacion.errores.join('; ') });
      continue;
    }

    const region = unidad.region.toString().trim();
    const distrito = unidad.distrito.toString().trim();
    const servicio = unidad.servicio_salud.toString().trim();
    const barrio = unidad.barrio?.toString().trim();

    if (!tree.has(region)) tree.set(region, new Map());
    const distMap = tree.get(region)!;
    if (!distMap.has(distrito)) distMap.set(distrito, { servicios: new Set(), barrios: new Set() });
    const node = distMap.get(distrito)!;
    node.servicios.add(servicio);
    if (barrio) node.barrios.add(barrio);
    resultados.exitosos++;
  }

  onProgress?.(5, 'Limpiando catálogo anterior…');
  try {
    await supabase.from('barrios').delete().neq('id', 0);
    await supabase.from('servicios_salud').delete().neq('id', 0);
    await supabase.from('distritos').delete().neq('id', 0);
    await supabase.from('regiones_sanitarias').delete().neq('id', 0);
  } catch (error) {
    console.warn('Error limpiando catálogos:', error);
  }

  const regionIdByName = new Map<string, number>();
  const distritoIdByKey = new Map<string, number>();
  const servicioKeySeen = new Set<string>();
  const barrioKeySeen = new Set<string>();

  let regionCount = 0;
  let distritoCount = 0;
  let servicioCount = 0;
  let barrioCount = 0;

  const regionNames = [...tree.keys()];
  for (let ri = 0; ri < regionNames.length; ri++) {
    const nombreRegion = regionNames[ri];
    onProgress?.(10 + Math.round((ri / Math.max(regionNames.length, 1)) * 25), `Región: ${nombreRegion}`);
    const { data, error } = await supabase
      .from('regiones_sanitarias')
      .insert({
        nombre: nombreRegion,
        codigo: nombreRegion.replace(/[^A-Za-z]/g, '').substring(0, 6).toUpperCase() || 'REG',
      })
      .select('id')
      .single();
    if (error || !data) {
      resultados.errores.push({ fila: 0, mensaje: `Región «${nombreRegion}»: ${error?.message ?? 'sin id'}` });
      continue;
    }
    regionIdByName.set(nombreRegion, data.id);
    regionCount++;
  }

  let distritosTotal = 0;
  for (const distMap of tree.values()) distritosTotal += distMap.size;
  let distritosDone = 0;

  for (const [nombreRegion, distMap] of tree) {
    const regionId = regionIdByName.get(nombreRegion);
    if (!regionId) continue;

    for (const [nombreDistrito, node] of distMap) {
      distritosDone++;
      onProgress?.(
        35 + Math.round((distritosDone / Math.max(distritosTotal, 1)) * 30),
        `Distrito: ${nombreDistrito}`
      );

      const distKey = `${regionId}|${nombreDistrito}`;
      let distritoId = distritoIdByKey.get(distKey);
      if (!distritoId) {
        const { data, error } = await supabase
          .from('distritos')
          .insert({ nombre: nombreDistrito, region_id: regionId })
          .select('id')
          .single();
        if (error || !data) {
          resultados.errores.push({
            fila: 0,
            mensaje: `Distrito «${nombreDistrito}»: ${error?.message ?? 'sin id'}`,
          });
          continue;
        }
        distritoId = data.id;
        distritoIdByKey.set(distKey, distritoId);
        distritoCount++;
      }

      for (const nombreServicio of node.servicios) {
        const sKey = `${distritoId}|${nombreServicio}`;
        if (servicioKeySeen.has(sKey)) continue;
        servicioKeySeen.add(sKey);
        const { error } = await supabase.from('servicios_salud').insert({
          nombre: nombreServicio,
          distrito_id: distritoId,
          tipo: 'Servicio',
        });
        if (error) {
          resultados.errores.push({ fila: 0, mensaje: `Servicio «${nombreServicio}»: ${error.message}` });
        } else {
          servicioCount++;
        }
      }

      for (const nombreBarrio of node.barrios) {
        const bKey = `${distritoId}|${nombreBarrio}`;
        if (barrioKeySeen.has(bKey)) continue;
        barrioKeySeen.add(bKey);
        const { error } = await supabase.from('barrios').insert({
          nombre: nombreBarrio,
          distrito_id: distritoId,
        });
        if (error) {
          resultados.errores.push({ fila: 0, mensaje: `Barrio «${nombreBarrio}»: ${error.message}` });
        } else {
          barrioCount++;
        }
      }
    }
  }

  onProgress?.(100, 'Catálogo listo');
  return {
    ...resultados,
    resumen: { regiones: regionCount, distritos: distritoCount, servicios: servicioCount, barrios: barrioCount },
  };
}

const PERSONAS_BATCH = 400;

function personaToRecord(persona: PersonaImportRow) {
  return {
    nombre: persona.nombre.toString().trim(),
    tipo_documento: persona.tipo_documento.toString().trim().toUpperCase(),
    documento: persona.documento.toString().trim(),
    fecha_nacimiento: persona.fecha_nacimiento.toString().trim(),
    sexo: persona.sexo.toString().trim().toUpperCase(),
    region_sanitaria: persona.region_sanitaria.toString().trim(),
    distrito: persona.distrito.toString().trim(),
    servicio_salud: persona.servicio_salud.toString().trim(),
    documento_madre: persona.documento_madre?.toString().trim() || null,
    nombre_madre: persona.nombre_madre?.toString().trim() || null,
  };
}

/** Importar personas en lotes; opcionalmente vacía base_personas antes. */
export async function importarPersonas(
  personas: PersonaImportRow[],
  options?: { reemplazar?: boolean; onProgress?: (pct: number, label: string) => void }
): Promise<{
  exitosos: number;
  fallidos: number;
  errores: Array<{ fila: number; mensaje: string }>;
}> {
  const resultados = {
    exitosos: 0,
    fallidos: 0,
    errores: [] as Array<{ fila: number; mensaje: string }>,
  };

  const validRows: { fila: number; record: ReturnType<typeof personaToRecord> }[] = [];

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i];
    const fila = i + 2;
    const validacion = validarPersona(persona);
    if (!validacion.valido) {
      resultados.fallidos++;
      if (resultados.errores.length < 200) {
        resultados.errores.push({ fila, mensaje: validacion.errores.join('; ') });
      }
      continue;
    }
    validRows.push({ fila, record: personaToRecord(persona) });
  }

  if (options?.reemplazar) {
    options.onProgress?.(2, 'Eliminando padrón anterior…');
    const { error } = await supabase
      .from('base_personas')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      resultados.errores.push({ fila: 0, mensaje: `No se pudo vaciar base_personas: ${error.message}` });
    }
  }

  const total = validRows.length;
  for (let i = 0; i < validRows.length; i += PERSONAS_BATCH) {
    const chunk = validRows.slice(i, i + PERSONAS_BATCH);
    const pct = 5 + Math.round(((i + chunk.length) / Math.max(total, 1)) * 94);
    options?.onProgress?.(pct, `${i + chunk.length} / ${total} personas`);

    const { error } = await supabase.from('base_personas').insert(chunk.map((c) => c.record));
    if (error) {
      resultados.fallidos += chunk.length;
      if (resultados.errores.length < 200) {
        resultados.errores.push({
          fila: chunk[0]?.fila ?? 0,
          mensaje: `Lote ${i / PERSONAS_BATCH + 1}: ${error.message}`,
        });
      }
    } else {
      resultados.exitosos += chunk.length;
    }
  }

  options?.onProgress?.(100, 'Importación finalizada');
  return resultados;
}

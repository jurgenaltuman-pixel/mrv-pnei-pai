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

// Importar Catálogo (Regiones/Distritos/Servicios/Barrios)
export async function importarCatalogo(unidades: UnitImportRow[]): Promise<{
  exitosos: number;
  fallidos: number;
  errores: Array<{ fila: number; mensaje: string }>;
}> {
  const resultados = {
    exitosos: 0,
    fallidos: 0,
    errores: [] as Array<{ fila: number; mensaje: string }>
  };

  // Primero, limpiar catálogos existentes
  try {
    await supabase.from('barrios').delete().neq('id', 0);
    await supabase.from('servicios_salud').delete().neq('id', 0);
    await supabase.from('distritos').delete().neq('id', 0);
    await supabase.from('regiones_sanitarias').delete().neq('id', 0);
  } catch (error) {
    console.warn('Error limpiando catálogos:', error);
  }

  // Obtener o crear regiones
  const regiones = new Map<string, number>();
  
  for (let i = 0; i < unidades.length; i++) {
    const unidad = unidades[i];
    const fila = i + 2;

    const validacion = validarUnidad(unidad);
    if (!validacion.valido) {
      resultados.fallidos++;
      resultados.errores.push({
        fila,
        mensaje: validacion.errores.join('; ')
      });
      continue;
    }

    try {
      const nombreRegion = unidad.region.toString().trim();
      
      // Si la región no existe, crearla
      if (!regiones.has(nombreRegion)) {
        const { data: regionData, error: regionError } = await supabase
          .from('regiones_sanitarias')
          .insert({
            nombre: nombreRegion,
            codigo: nombreRegion.substring(0, 3).toUpperCase()
          })
          .select('id')
          .single();

        if (regionError) {
          resultados.fallidos++;
          resultados.errores.push({
            fila,
            mensaje: `Error creando región: ${regionError.message}`
          });
          continue;
        }

        regiones.set(nombreRegion, regionData.id);
      }

      const regionId = regiones.get(nombreRegion)!;

      // Crear o actualizar distrito
      const { data: distritoData, error: distritoError } = await supabase
        .from('distritos')
        .insert({
          nombre: unidad.distrito.toString().trim(),
          region_id: regionId
        })
        .select('id')
        .single();

      if (distritoError) {
        resultados.fallidos++;
        resultados.errores.push({
          fila,
          mensaje: `Error creando distrito: ${distritoError.message}`
        });
        continue;
      }

      const distritoId = distritoData.id;

      // Crear servicio de salud
      const { error: servicioError } = await supabase
        .from('servicios_salud')
        .insert({
          nombre: unidad.servicio_salud.toString().trim(),
          distrito_id: distritoId,
          tipo: 'Servicio'
        });

      if (servicioError) {
        resultados.fallidos++;
        resultados.errores.push({
          fila,
          mensaje: `Error creando servicio: ${servicioError.message}`
        });
        continue;
      }

      // Crear barrio si existe
      if (unidad.barrio && unidad.barrio.toString().trim() !== '') {
        await supabase
          .from('barrios')
          .insert({
            nombre: unidad.barrio.toString().trim(),
            distrito_id: distritoId
          });
      }

      resultados.exitosos++;

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

// Importar Personas
export async function importarPersonas(personas: PersonaImportRow[]): Promise<{
  exitosos: number;
  fallidos: number;
  errores: Array<{ fila: number; mensaje: string }>;
}> {
  const resultados = {
    exitosos: 0,
    fallidos: 0,
    errores: [] as Array<{ fila: number; mensaje: string }>
  };

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i];
    const fila = i + 2;

    const validacion = validarPersona(persona);
    if (!validacion.valido) {
      resultados.fallidos++;
      resultados.errores.push({
        fila,
        mensaje: validacion.errores.join('; ')
      });
      continue;
    }

    try {
      const { error } = await supabase
        .from('base_personas')
        .insert({
          nombre: persona.nombre.toString().trim(),
          tipo_documento: persona.tipo_documento.toString().trim(),
          documento: persona.documento.toString().trim(),
          fecha_nacimiento: persona.fecha_nacimiento.toString().trim(),
          sexo: persona.sexo.toString().trim(),
          region_sanitaria: persona.region_sanitaria.toString().trim(),
          distrito: persona.distrito.toString().trim(),
          servicio_salud: persona.servicio_salud.toString().trim(),
          documento_madre: persona.documento_madre?.toString().trim() || null,
          nombre_madre: persona.nombre_madre?.toString().trim() || null
        });

      if (error) {
        resultados.fallidos++;
        resultados.errores.push({
          fila,
          mensaje: error.message
        });
        continue;
      }

      resultados.exitosos++;

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

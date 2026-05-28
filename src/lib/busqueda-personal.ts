import { parseFechaPyToIso } from '@/lib/format-fecha';
import type { BusquedaDatosPersonalesFiltros } from '@/services/dataService';

export interface ValidacionBusquedaPersonal {
  ok: boolean;
  error?: string;
  filtros?: BusquedaDatosPersonalesFiltros;
}

function limpiaNombre(v: string | undefined): string {
  return (v || '').trim().replace(/\s+/g, ' ');
}

/**
 * Cualquier criterio válido por sí solo basta: un nombre, dos nombres, solo apellido,
 * solo fecha de nacimiento, solo CI de la madre/padre, o sexo.
 */
export function validarBusquedaPersonal(raw: BusquedaDatosPersonalesFiltros): ValidacionBusquedaPersonal {
  const nombre1 = limpiaNombre(raw.nombre1);
  const nombre2 = limpiaNombre(raw.nombre2);
  const apellido1 = limpiaNombre(raw.apellido1);
  const apellido2 = limpiaNombre(raw.apellido2);
  const madreRaw = (raw.documentoMadrePadre || '').replace(/\D/g, '').trim();
  const fechaRaw = (raw.fechaNacimiento || '').trim();
  const sexoRaw = (raw.sexo || '').trim().toUpperCase();

  const errores: string[] = [];
  let criterios = 0;

  const validaNombre = (label: string, val: string, min = 2) => {
    if (!val) return;
    if (val.length < min) {
      errores.push(`${label}: mínimo ${min} caracteres`);
      return;
    }
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s'-]+$/.test(val)) {
      errores.push(`${label}: solo letras`);
      return;
    }
    criterios++;
  };

  validaNombre('Primer nombre', nombre1);
  validaNombre('Segundo nombre', nombre2);
  validaNombre('Primer apellido', apellido1);
  validaNombre('Segundo apellido', apellido2);

  let fechaIso: string | undefined;
  if (fechaRaw) {
    const iso = parseFechaPyToIso(fechaRaw);
    if (!iso) errores.push('Fecha de nacimiento: use dd/mm/aaaa o DDMMAAAA (ej. 15032015)');
    else {
      fechaIso = iso;
      criterios++;
    }
  }

  if (madreRaw) {
    if (madreRaw.length < 6) errores.push('CI madre/padre: mínimo 6 dígitos');
    else criterios++;
  }

  if (sexoRaw) {
    if (sexoRaw !== 'M' && sexoRaw !== 'F') errores.push('Sexo: seleccione M o F');
    else criterios++;
  }

  if (errores.length) return { ok: false, error: errores.join(' · ') };
  if (criterios < 1) {
    return {
      ok: false,
      error:
        'Indique al menos un criterio: nombre, apellido, fecha de nacimiento, CI de la madre/padre o sexo.',
    };
  }

  return {
    ok: true,
    filtros: {
      nombre1: nombre1 || undefined,
      nombre2: nombre2 || undefined,
      apellido1: apellido1 || undefined,
      apellido2: apellido2 || undefined,
      documentoMadrePadre: madreRaw || undefined,
      fechaNacimiento: fechaIso,
      sexo: sexoRaw === 'M' || sexoRaw === 'F' ? sexoRaw : undefined,
    },
  };
}

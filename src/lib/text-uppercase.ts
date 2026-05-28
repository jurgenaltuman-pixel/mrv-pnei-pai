/** Normaliza texto de formulario a mayúsculas (criterio MRV en terreno). */
export function upperText(value: string): string {
  return value.toLocaleUpperCase('es-PY');
}

export function upperTextOptional(value: string | undefined | null): string {
  return value ? upperText(value) : '';
}

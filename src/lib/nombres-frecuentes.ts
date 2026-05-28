/** Nombres frecuentes (español latinoamericano) — autocompletado 100% offline */
export const NOMBRES_FRECUENTES: string[] = [
  'Juan', 'María', 'José', 'Ana', 'Luis', 'Carmen', 'Pedro', 'Rosa', 'Carlos', 'Laura',
  'Miguel', 'Elena', 'Francisco', 'Lucía', 'Antonio', 'Isabel', 'Manuel', 'Patricia',
  'Jorge', 'Sofía', 'Roberto', 'Andrea', 'Fernando', 'Valentina', 'Ricardo', 'Camila',
  'Diego', 'Daniela', 'Alejandro', 'Gabriela', 'Óscar', 'Paula', 'Raúl', 'Natalia',
  'Sergio', 'Verónica', 'Héctor', 'Claudia', 'Mario', 'Adriana', 'Julio', 'Silvia',
  'Ramón', 'Beatriz', 'Arturo', 'Mónica', 'Enrique', 'Teresa', 'Víctor', 'Gladys',
  'Guadalupe', 'Jesús', 'Margarita', 'Felipe', 'Rocío', 'Alberto', 'Diana', 'Eduardo',
  'Liliana', 'Gustavo', 'Mariana', 'Hugo', 'Carolina', 'Iván', 'Jimena', 'Rodrigo',
  'Ximena', 'Pablo', 'Renata', 'Andrés', 'Emilia', 'Sebastián', 'Antonella', 'Matías',
  'Agustina', 'Nicolás', 'Florencia', 'Tomás', 'Constanza', 'Benjamín', 'Julieta',
  'Emilio', 'Martina', 'Cristian', 'Victoria', 'Leonardo', 'Bianca', 'Maximiliano',
  'Abigail', 'Facundo', 'Mía', 'Thiago', 'Emma', 'Bruno', 'Olivia', 'Mateo', 'Zoe',
];

export function filtrarNombres(query: string, extra: string[] = [], max = 12): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pool = new Set<string>();
  for (const n of NOMBRES_FRECUENTES) pool.add(n);
  for (const n of extra) if (n.trim()) pool.add(n.trim());
  const out: string[] = [];
  for (const nombre of pool) {
    if (nombre.toLowerCase().includes(q)) out.push(nombre);
    if (out.length >= max) break;
  }
  return out.sort((a, b) => {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    const aStarts = al.startsWith(q) ? 0 : 1;
    const bStarts = bl.startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return al.localeCompare(bl);
  });
}

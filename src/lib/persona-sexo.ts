/** Lee sexo/género de una fila del padrón (varios nombres de columna en imports). */
export function extractSexoFromPadronRow(row: Record<string, unknown>): 'M' | 'F' | '' {
  const raw =
    row.sexo ?? row.genero ?? row.género ?? row.GENERO ?? row.Genero ?? row.gender ?? row.SEXO;
  const fromDb = normalizeSexoForForm(raw == null ? null : String(raw));
  if (fromDb) return fromDb;
  return inferSexoFromNombre(String(row.nombre ?? ''));
}

/** Normaliza sexo del padrón/API a M o F para el formulario. */
export function normalizeSexoForForm(raw: string | null | undefined): 'M' | 'F' | '' {
  if (raw == null) return '';
  const t = String(raw).trim().toUpperCase();
  if (!t) return '';
  if (
    t === 'M' ||
    t === '1' ||
    t === '01' ||
    t.startsWith('MASC') ||
    t === 'H' ||
    t === 'HOMBRE' ||
    t === 'VARON' ||
    t === 'VARÓN' ||
    t === 'MALE'
  ) {
    return 'M';
  }
  if (t === 'F' || t === '2' || t === '02' || t.startsWith('FEM') || t === 'MUJER' || t === 'FEMALE') {
    return 'F';
  }
  const c = t.charAt(0);
  if (c === 'M') return 'M';
  if (c === 'F') return 'F';
  return '';
}

const NOMBRES_MASC = new Set([
  'JOSE', 'JOSÉ', 'JUAN', 'CARLOS', 'LUIS', 'PEDRO', 'MIGUEL', 'ANTONIO', 'FRANCISCO', 'ESTEBAN',
  'NICOLAS', 'NICOLÁS', 'SANTIAGO', 'MATIAS', 'MATÍAS', 'DIEGO', 'ANDRES', 'ANDRÉS', 'MARCOS',
  'PABLO', 'JORGE', 'MARIO', 'OSCAR', 'ÓSCAR', 'RAMON', 'RAMÓN', 'RICARDO', 'ROBERTO', 'SERGIO',
  'VICTOR', 'VÍCTOR', 'GABRIEL', 'EMANUEL', 'EMMANUEL', 'FERNANDO', 'GUSTAVO', 'HECTOR', 'HÉCTOR',
  'HUGO', 'IVAN', 'IVÁN', 'JAVIER', 'JESUS', 'JESÚS', 'JOAQUIN', 'JOAQUÍN', 'JULIO', 'LEONARDO',
  'MANUEL', 'MARTIN', 'MARTÍN', 'MAURICIO', 'NELSON', 'OMAR', 'RAFAEL', 'RAUL', 'RAÚL', 'RODRIGO',
  'RUBEN', 'RUBÉN', 'SAMUEL', 'SEBASTIAN', 'SEBASTIÁN', 'TOMAS', 'TOMÁS', 'WALTER', 'ALEX', 'ALEXIS',
  'BRAHIAN', 'BRIAN', 'CRISTIAN', 'CRISTIÁN', 'DANIEL', 'DAVID', 'EDGAR', 'EDUARDO', 'ENRIQUE',
  'ERICK', 'ERIK', 'FABIAN', 'FABIAN', 'FELIPE', 'GONZALO', 'GUILLERMO', 'HERNAN', 'HERNÁN',
  'IGNACIO', 'ISMAEL', 'JAIME', 'JONATHAN', 'JONATAN', 'KEVIN', 'LEANDRO', 'LORENZO', 'LUCIANO',
  'MARCELO', 'MAXIMILIANO', 'NAHUEL', 'NESTOR', 'NÉSTOR', 'PATRICIO', 'RAIMUNDO', 'RENE', 'RENÉ',
  'ROLANDO', 'ROMAN', 'ROMÁN', 'RONALD', 'RONALDO', 'SILVANO', 'SIMON', 'SIMÓN', 'TEODORO', 'ULISES',
]);

const NOMBRES_FEM = new Set([
  'MARIA', 'MARÍA', 'ANA', 'ROSA', 'GLORIA', 'CARMEN', 'PATRICIA', 'LAURA', 'SILVIA', 'ELENA',
  'LUCIA', 'LUCÍA', 'BEATRIZ', 'CLAUDIA', 'VERONICA', 'VERÓNICA', 'ANDREA', 'CAROLINA', 'DANIELA',
  'GABRIELA', 'VALENTINA', 'SOFIA', 'SOFÍA', 'CAMILA', 'FLORENCIA', 'JULIETA', 'MARTINA', 'PAULA',
  'ROMINA', 'VICTORIA', 'YANINA', 'YASMIN', 'YASMÍN', 'ZULMA', 'ADRIANA', 'ALICIA', 'AMANDA',
  'ANGELICA', 'ANGÉLICA', 'ANTONIA', 'BELEN', 'BELÉN', 'BRENDA', 'CECILIA', 'CRISTINA', 'DEBORA',
  'DÉBORA', 'DIANA', 'DORA', 'EDITH', 'ELISA', 'EMILIA', 'ESPERANZA', 'ESTHER', 'EUGENIA', 'FABIANA',
  'FABIOLA', 'FATIMA', 'FÁTIMA', 'FERNANDA', 'FRANCISCA', 'GRACIELA', 'GUADALUPE', 'INES', 'INÉS',
  'IRENE', 'IRMA', 'ISABEL', 'JAZMIN', 'JAZMÍN', 'JESSICA', 'JÉSSICA', 'JIMENA', 'JOANA', 'JORGELINA',
  'JUANA', 'JULIA', 'KARINA', 'LILIAN', 'LILIANA', 'LORENA', 'LORETA', 'LOURDES', 'LUCIANA', 'LUZ',
  'MARGARITA', 'MARIANA', 'MARIEL', 'MARIELA', 'MARINA', 'MIRIAM', 'MONICA', 'MÓNICA', 'NATALIA',
  'NELLY', 'NIDIA', 'NORMA', 'NOEMI', 'NOEMÍ', 'OLGA', 'ORLANDA', 'PAMELA', 'PAOLA', 'RAQUEL',
  'REBECA', 'REGINA', 'RITA', 'ROCIO', 'ROCÍO', 'RUTH', 'SANDRA', 'SARA', 'SUSANA', 'TERESA',
  'VANESA', 'VANESSA', 'VIVIANA', 'XIMENA', 'YANINA', 'YESICA', 'YÉSICA', 'ZULEMA', 'ABIGAIL', 'AGUSTINA',
]);

/** Inferencia por primer nombre cuando el padrón no trae sexo (import legacy). */
export function inferSexoFromNombre(nombre: string | null | undefined): 'M' | 'F' | '' {
  if (!nombre?.trim()) return '';
  const tokens = nombre
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  for (const t of tokens) {
    if (NOMBRES_FEM.has(t)) return 'F';
    if (NOMBRES_MASC.has(t)) return 'M';
  }
  const primero = tokens[0];
  if (!primero) return '';
  if (primero.endsWith('O') && primero.length >= 4) return 'M';
  if (primero.endsWith('A') && primero.length >= 4 && !primero.endsWith('IA')) return 'F';
  return '';
}

/** Sexo para el formulario: BD → inferencia por nombre. */
export function resolveSexoPersona(persona: {
  sexo?: string | null;
  nombre?: string | null;
  [key: string]: unknown;
}): 'M' | 'F' | '' {
  return extractSexoFromPadronRow(persona as Record<string, unknown>);
}

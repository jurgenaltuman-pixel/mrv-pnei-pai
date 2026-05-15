import { z } from 'zod';

/**
 * Esquemas de validación para garantizar seguridad en entrada de datos
 * Previene SQL injection, XSS y otros ataques
 */

// CI/Documento: 6-8 dígitos
export const CISchema = z.string()
  .trim()
  .regex(/^\d{6,8}$/, 'CI debe tener 6-8 dígitos')
  .max(8, 'CI inválido');

// Nombre: 2-100 caracteres, sin caracteres especiales peligrosos
export const NombreSchema = z.string()
  .trim()
  .min(2, 'Nombre muy corto')
  .max(100, 'Nombre muy largo')
  .regex(/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s'-]+$/, 'Nombre contiene caracteres inválidos');

// Email con validación
export const EmailSchema = z.string()
  .email('Email inválido')
  .toLowerCase()
  .max(254, 'Email muy largo');

// Username: 3-20 caracteres alfanuméricos + guión
export const UsernameSchema = z.string()
  .trim()
  .min(3, 'Username muy corto')
  .max(20, 'Username muy largo')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Username contiene caracteres inválidos');

// Búsqueda de personas: máximo 60 caracteres (permite apóstrofe en nombres compuestos)
export const SearchQuerySchema = z.string()
  .trim()
  .min(1, 'Búsqueda requerida')
  .max(60, 'Búsqueda muy larga')
  .regex(/^[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s'.-]*$/, 'Búsqueda contiene caracteres inválidos');

// Región: 1-50 caracteres
export const RegionSchema = z.string()
  .trim()
  .min(1, 'Región requerida')
  .max(50, 'Región muy larga');

// Distrito: 1-50 caracteres
export const DistritoSchema = z.string()
  .trim()
  .min(1, 'Distrito requerido')
  .max(50, 'Distrito muy largo');

// Barrio: 1-100 caracteres
export const BarrioSchema = z.string()
  .trim()
  .min(1, 'Barrio requerido')
  .max(100, 'Barrio muy largo');

// Viviendas: número positivo entre 0-9999
export const ViviendasSchema = z.number()
  .int('Viviendas debe ser número entero')
  .min(0, 'Viviendas no puede ser negativo')
  .max(9999, 'Viviendas muy alto');

// Edad en años: 0-120
export const EdadSchema = z.number()
  .int('Edad debe ser número entero')
  .min(0, 'Edad inválida')
  .max(120, 'Edad inválida');

// Sexo: M o F
export const SexoSchema = z.enum(['M', 'F'], {
  errorMap: () => ({ message: 'Sexo debe ser M o F' })
});

// Estado vacunación
export const EstadoVacunaSchema = z.enum(['vacunado', 'no_vacunado', 'renuente'], {
  errorMap: () => ({ message: 'Estado inválido' })
});

// Tipo vivienda
export const TipoViviendaSchema = z.enum(['efectiva', 'revisitada', 'sin_adulto', 'renuente'], {
  errorMap: () => ({ message: 'Tipo vivienda inválido' })
});

// Esquema vacunación
export const EsquemaSchema = z.enum(['completo', 'incompleto'], {
  errorMap: () => ({ message: 'Esquema inválido' })
});

// Rol de usuario
export const RolSchema = z.enum(['super_admin', 'admin', 'vacunador'], {
  errorMap: () => ({ message: 'Rol inválido' })
});

// Schemas para operaciones completas
export const PersonaBaseSchema = z.object({
  documento: CISchema,
  nombre: NombreSchema,
  sexo: SexoSchema,
  fecha_nacimiento: z.string().datetime(),
});

export const RegistroVacunacionSchema = z.object({
  documento: CISchema,
  nombre: NombreSchema,
  sexo: SexoSchema,
  edad: EdadSchema,
  region: RegionSchema,
  distrito: DistritoSchema,
  barrio: BarrioSchema,
  viviendas: ViviendasSchema,
  tipo_vivienda: TipoViviendaSchema,
  menores: z.array(z.object({
    nombre: NombreSchema,
    edad: EdadSchema,
    sexo: SexoSchema,
    estado_vacuna: EstadoVacunaSchema,
    esquema: EsquemaSchema,
  })).optional(),
  casa_cerrada: z.boolean().optional(),
  observaciones: z.string().max(500, 'Observaciones muy largas').optional(),
});

export const ImportUsuariosSchema = z.object({
  email: EmailSchema,
  username: UsernameSchema,
  nombre: NombreSchema,
  rol: RolSchema,
  ci: CISchema.optional(),
});

/** Payload cola offline / sync — alineado con guardarRegistro (no uses RegistroVacunacionSchema antiguo) */
export const PendingRegistroPayloadSchema = z.object({
  user_id: z.string().uuid().optional(),
  region: z.string().min(1),
  distrito: z.string().min(1),
  servicio: z.string().nullable().optional(),
  barrio: z.string().min(1),
  responsable: z.string().nullable().optional(),
  nombre: z.string().min(1),
  documento: z.string().min(1),
  fecha_nacimiento: z.string().min(1),
  edad: z.union([z.string(), z.number()]).nullable().optional(),
  sexo: z.string().min(1),
  libreta: z.boolean().optional(),
  estado_vacuna: z.enum(['vacunado', 'no_vacunado']),
  motivo: z.string().nullable().optional(),
  latitud: z.number().nullable(),
  longitud: z.number().nullable(),
  tipo_vivienda: z
    .enum(['efectiva', 'revisitada', 'sin_adulto_responsable', 'renuente'])
    .nullable()
    .optional(),
  esquema_completo: z.boolean().nullable().optional(),
  fuente_verificacion: z.string().nullable().optional(),
  accion_tomada: z.string().nullable().optional(),
  observaciones: z.string().max(500).nullable().optional(),
  fecha_dosis_spr: z.string().nullable().optional(),
  dosis_spr: z.string().nullable().optional(),
  estado_intervencion: z.string().nullable().optional(),
  tiene_cvs: z.boolean().nullable().optional(),
});

/**
 * Helper para validar o lanzar error
 */
export function validarOLanzar<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const resultado = schema.safeParse(data);
  if (!resultado.success) {
    const errores = resultado.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new Error(`Validación fallida: ${errores}`);
  }
  return resultado.data;
}

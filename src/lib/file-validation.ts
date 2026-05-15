/**
 * Utilidades para validación y sanitización de archivos
 */

export const ALLOWED_MIME_TYPES = {
  excel: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/x-excel',
    'application/x-msexcel',
  ],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  pdf: ['application/pdf'],
};

export const ALLOWED_EXTENSIONS = {
  excel: ['.xlsx', '.xls'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  pdf: ['.pdf'],
};

export const MAX_FILE_SIZES = {
  excel: 5 * 1024 * 1024, // 5 MB
  image: 2 * 1024 * 1024, // 2 MB
  pdf: 10 * 1024 * 1024, // 10 MB
};

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Validar archivo de Excel
 */
export function validarArchivoExcel(file: File): void {
  // Validar nombre
  if (!file.name) {
    throw new FileValidationError('Archivo no tiene nombre');
  }

  // Validar extensión
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.excel.includes(extension)) {
    throw new FileValidationError(
      `Extensión no permitida. Usa: ${ALLOWED_EXTENSIONS.excel.join(', ')}`
    );
  }

  // Validar MIME type
  if (!ALLOWED_MIME_TYPES.excel.includes(file.type)) {
    throw new FileValidationError(
      `Tipo de archivo no permitido. MIME: ${file.type}`
    );
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZES.excel) {
    throw new FileValidationError(
      `Archivo muy grande. Máximo: ${MAX_FILE_SIZES.excel / 1024 / 1024}MB, Actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    );
  }
}

/**
 * Validar archivo de imagen
 */
export function validarArchivoImagen(file: File): void {
  // Validar nombre
  if (!file.name) {
    throw new FileValidationError('Archivo no tiene nombre');
  }

  // Validar extensión
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.image.includes(extension)) {
    throw new FileValidationError(
      `Extensión no permitida. Usa: ${ALLOWED_EXTENSIONS.image.join(', ')}`
    );
  }

  // Validar MIME type
  if (!ALLOWED_MIME_TYPES.image.includes(file.type)) {
    throw new FileValidationError(
      `Tipo de archivo no permitido. MIME: ${file.type}`
    );
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZES.image) {
    throw new FileValidationError(
      `Imagen muy grande. Máximo: ${MAX_FILE_SIZES.image / 1024 / 1024}MB, Actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    );
  }
}

/**
 * Validar archivo PDF
 */
export function validarArchivoPDF(file: File): void {
  // Validar nombre
  if (!file.name) {
    throw new FileValidationError('Archivo no tiene nombre');
  }

  // Validar extensión
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.pdf.includes(extension)) {
    throw new FileValidationError(
      `Extensión no permitida. Usa: ${ALLOWED_EXTENSIONS.pdf.join(', ')}`
    );
  }

  // Validar MIME type
  if (!ALLOWED_MIME_TYPES.pdf.includes(file.type)) {
    throw new FileValidationError(
      `Tipo de archivo no permitido. MIME: ${file.type}`
    );
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZES.pdf) {
    throw new FileValidationError(
      `PDF muy grande. Máximo: ${MAX_FILE_SIZES.pdf / 1024 / 1024}MB, Actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    );
  }
}

/**
 * Sanitizar nombre de archivo
 */
export function sanitizarNombreArchivo(filename: string): string {
  // Remover caracteres peligrosos
  return filename
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 255);
}

/**
 * Generar nombre único para archivo
 */
export function generarNombreUnicoArchivo(extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}${extension}`;
}

/**
 * Obtener tipo de archivo de forma segura
 */
export function obtenerTipoArchivo(
  file: File
): 'excel' | 'image' | 'pdf' | 'unknown' {
  if (ALLOWED_MIME_TYPES.excel.includes(file.type)) return 'excel';
  if (ALLOWED_MIME_TYPES.image.includes(file.type)) return 'image';
  if (ALLOWED_MIME_TYPES.pdf.includes(file.type)) return 'pdf';
  return 'unknown';
}

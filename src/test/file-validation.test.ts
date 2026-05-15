import { describe, it, expect, vi, beforeAll } from 'vitest';
import { validarArchivoExcel, FileValidationError, sanitizarNombreArchivo, generarNombreUnicoArchivo } from '@/lib/file-validation';

describe('File Validation', () => {
  describe('validarArchivoExcel', () => {
    it('debe aceptar archivos Excel válidos', () => {
      const file = new File([], 'usuarios.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      expect(() => validarArchivoExcel(file)).not.toThrow();
    });

    it('debe rechazar archivos sin nombre', () => {
      const file = new File([], '', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      expect(() => validarArchivoExcel(file)).toThrow(FileValidationError);
    });

    it('debe rechazar extensiones no permitidas', () => {
      const file = new File([], 'usuarios.txt', { type: 'text/plain' });
      expect(() => validarArchivoExcel(file)).toThrow(/Extensión no permitida/);
    });

    it('debe rechazar archivos muy grandes', () => {
      const largeContent = new Uint8Array(6 * 1024 * 1024); // 6 MB
      const file = new File([largeContent], 'usuarios.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect(() => validarArchivoExcel(file)).toThrow(/muy grande/);
    });
  });

  describe('sanitizarNombreArchivo', () => {
    it('debe remover caracteres especiales', () => {
      expect(sanitizarNombreArchivo('archivo@#$%.txt')).toBe('archivo_.txt');
    });

    it('debe remover múltiples guiones bajos seguidos', () => {
      expect(sanitizarNombreArchivo('archivo___test.txt')).toBe('archivo_test.txt');
    });

    it('debe permitir caracteres válidos', () => {
      expect(sanitizarNombreArchivo('archivo-válido_123.txt')).toBe('archivo-v_lido_123.txt');
    });

    it('debe truncar nombres muy largos', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizarNombreArchivo(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });

  describe('generarNombreUnicoArchivo', () => {
    it('debe generar nombres únicos', () => {
      const nombre1 = generarNombreUnicoArchivo('.xlsx');
      const nombre2 = generarNombreUnicoArchivo('.xlsx');
      expect(nombre1).not.toBe(nombre2);
    });

    it('debe incluir la extensión', () => {
      const nombre = generarNombreUnicoArchivo('.xlsx');
      expect(nombre).toMatch(/\.xlsx$/);
    });

    it('debe tener formato timestamp-random', () => {
      const nombre = generarNombreUnicoArchivo('.xlsx');
      expect(nombre).toMatch(/^\d+-[a-z0-9]+\.xlsx$/);
    });
  });
});

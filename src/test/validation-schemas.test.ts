import { describe, it, expect } from 'vitest';
import {
  SearchQuerySchema,
  CISchema,
  NombreSchema,
  EmailSchema,
  validarOLanzar,
} from '@/lib/validation-schemas';

describe('Validation Schemas', () => {
  describe('CISchema', () => {
    it('debe aceptar CI válida de 6-8 dígitos', () => {
      expect(CISchema.parse('123456')).toBe('123456');
      expect(CISchema.parse('12345678')).toBe('12345678');
    });

    it('debe rechazar CI con menos de 6 dígitos', () => {
      expect(() => CISchema.parse('12345')).toThrow();
    });

    it('debe rechazar CI con más de 8 dígitos', () => {
      expect(() => CISchema.parse('123456789')).toThrow();
    });

    it('debe rechazar CI no numérica', () => {
      expect(() => CISchema.parse('1234AB')).toThrow();
    });

    it('debe trim espacios', () => {
      expect(CISchema.parse('  123456  ')).toBe('123456');
    });
  });

  describe('NombreSchema', () => {
    it('debe aceptar nombres válidos', () => {
      expect(NombreSchema.parse('Juan Pérez')).toBe('Juan Pérez');
      expect(NombreSchema.parse("O'Connor")).toBe("O'Connor");
      expect(NombreSchema.parse('María José')).toBe('María José');
    });

    it('debe rechazar nombres muy cortos', () => {
      expect(() => NombreSchema.parse('J')).toThrow();
    });

    it('debe rechazar nombres muy largos', () => {
      expect(() => NombreSchema.parse('a'.repeat(101))).toThrow();
    });

    it('debe rechazar caracteres especiales', () => {
      expect(() => NombreSchema.parse('Juan@Pérez')).toThrow();
      expect(() => NombreSchema.parse('Juan#Pérez')).toThrow();
    });
  });

  describe('EmailSchema', () => {
    it('debe aceptar emails válidos', () => {
      const result = EmailSchema.parse('usuario@domain.com');
      expect(result).toBe('usuario@domain.com');
    });

    it('debe convertir a minúsculas', () => {
      expect(EmailSchema.parse('USUARIO@DOMAIN.COM')).toBe('usuario@domain.com');
    });

    it('debe rechazar emails inválidos', () => {
      expect(() => EmailSchema.parse('notanemail')).toThrow();
      expect(() => EmailSchema.parse('user@')).toThrow();
    });
  });

  describe('SearchQuerySchema', () => {
    it('debe aceptar búsquedas válidas', () => {
      expect(SearchQuerySchema.parse('Juan')).toBe('Juan');
      expect(SearchQuerySchema.parse('123456')).toBe('123456');
    });

    it('debe rechazar búsquedas vacías', () => {
      expect(() => SearchQuerySchema.parse('')).toThrow();
    });

    it('debe rechazar búsquedas muy largas', () => {
      expect(() => SearchQuerySchema.parse('a'.repeat(61))).toThrow();
    });

    it('debe rechazar caracteres especiales', () => {
      expect(() => SearchQuerySchema.parse('Juan@#')).toThrow();
    });
  });

  describe('validarOLanzar', () => {
    it('debe retornar datos validados', () => {
      const result = validarOLanzar(CISchema, '123456');
      expect(result).toBe('123456');
    });

    it('debe lanzar error con descripción clara', () => {
      expect(() => validarOLanzar(CISchema, 'invalid')).toThrow(
        /Validación fallida/
      );
    });

    it('debe incluir el nombre del campo en el error', () => {
      try {
        validarOLanzar(CISchema, '123');
      } catch (err) {
        expect(String(err)).toContain('6-8 dígitos');
      }
    });
  });
});

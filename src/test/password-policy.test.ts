import { describe, expect, it } from 'vitest';
import { validateStrongPassword } from '@/lib/password-policy';

describe('validateStrongPassword', () => {
  it('rechaza contraseñas cortas', () => {
    expect(validateStrongPassword('Ab1')).not.toBeNull();
  });

  it('acepta contraseña segura', () => {
    expect(validateStrongPassword('Mrv2026!x')).toBeNull();
  });

  it('exige mayúscula, minúscula y número', () => {
    expect(validateStrongPassword('abcdefgh1')).toMatch(/mayúscula/i);
    expect(validateStrongPassword('ABCDEFGH1')).toMatch(/minúscula/i);
    expect(validateStrongPassword('Abcdefgh')).toMatch(/número/i);
  });
});

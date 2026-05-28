import { describe, expect, it } from 'vitest';
import {
  cleanNominaDisplayName,
  isPlaceholderEmail,
  isRealUserEmail,
  mapNominaApiRow,
} from '@/lib/nomina-profile';

describe('nomina-profile', () => {
  it('detecta correos técnicos', () => {
    expect(isPlaceholderEmail('revodiego@system.vaccinator.local')).toBe(true);
    expect(isRealUserEmail('revodiego@system.vaccinator.local')).toBe(false);
    expect(isRealUserEmail('juan@mspbs.gov.py')).toBe(true);
  });

  it('no usa email como nombre', () => {
    expect(cleanNominaDisplayName('revodiego@system.vaccinator.local', 'revodiego', '1234567')).toBe(
      'revodiego'
    );
    expect(mapNominaApiRow({
      documento: '1234567',
      nombre: 'revodiego@system.vaccinator.local',
      username: 'revodiego',
      email: 'revodiego@system.vaccinator.local',
    }).nombre).toBe('revodiego');
  });

  it('no usa CI repetido como nombre', () => {
    expect(cleanNominaDisplayName('CI 4731479', '4731479', '4731479')).toBe('');
    expect(mapNominaApiRow({ documento: '4731479', nombre: 'CI 4731479', username: '4731479' }).nombre).toBe(
      ''
    );
  });
});

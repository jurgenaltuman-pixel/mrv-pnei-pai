import { describe, expect, it } from 'vitest';
import { isGoogleDriveNotConfiguredMessage } from '@/lib/drive-upload-errors';

describe('drive-upload-errors', () => {
  it('detecta error de Drive no configurado en servidor', () => {
    expect(
      isGoogleDriveNotConfiguredMessage(
        'Google Drive no configurado. Ver docs/GOOGLE-DRIVE-ADJUNTOS.md'
      )
    ).toBe(true);
    expect(isGoogleDriveNotConfiguredMessage('Error de red')).toBe(false);
  });
});

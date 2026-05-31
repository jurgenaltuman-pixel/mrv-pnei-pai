import { describe, it, expect } from 'vitest';
import { isPendingDriveUrl, pendingDriveId, pendingDriveUrl } from '@/lib/pending-drive-url';

describe('pending-drive-url', () => {
  it('detecta y resuelve URLs pendientes', () => {
    const id = 'abc-123';
    const url = pendingDriveUrl(id);
    expect(isPendingDriveUrl(url)).toBe(true);
    expect(isPendingDriveUrl('https://drive.google.com/x')).toBe(false);
    expect(pendingDriveId(url)).toBe(id);
  });
});

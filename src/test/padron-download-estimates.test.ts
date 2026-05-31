import { describe, expect, it } from 'vitest';
import {
  estimateOrgDownload,
  estimatePadronDownload,
  formatDurationEs,
} from '@/lib/padron-download-estimates';

describe('padron-download-estimates', () => {
  it('formatea duración en español', () => {
    expect(formatDurationEs(45)).toContain('45');
    expect(formatDurationEs(4000)).toContain('h');
  });

  it('org es más rápido que padrón', () => {
    const org = estimateOrgDownload('wifi');
    const pad = estimatePadronDownload('wifi');
    expect(pad.typicalSec).toBeGreaterThan(org.typicalSec);
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatPadronSearchDuration,
  padronSearchDurationLine,
  padronSearchEtaHint,
  padronSearchSpeedLabel,
} from '@/lib/padron-search-timing';

describe('padron-search-timing', () => {
  it('hint documento', () => {
    expect(padronSearchEtaHint('documento', 2)).toContain('2 bases');
  });
  it('duration line', () => {
    expect(padronSearchDurationLine(800)).toContain('rápida');
    expect(padronSearchSpeedLabel(800)).toBe('rápida');
  });
  it('format ms and s', () => {
    expect(formatPadronSearchDuration(450)).toBe('450 ms');
    expect(formatPadronSearchDuration(2100)).toBe('2.1 s');
  });
});

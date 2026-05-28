import { describe, expect, it } from 'vitest';
import { evaluateRoundMonitoring, UMBRAL_COBERTURA_APROBADO } from '@/lib/round-evaluation';
import type { RoundSummary } from '@/types/round-monitoring';

function summary(partial: Partial<RoundSummary>): RoundSummary {
  return {
    totalCasas: 20,
    visitadas: 20,
    efectivas: 18,
    noEfectivas: 2,
    fallidas: 0,
    renuentes: 0,
    totalNinos: 10,
    vacunados: 10,
    noVacunados: 0,
    ...partial,
  };
}

describe('evaluateRoundMonitoring', () => {
  it('aprueba con cobertura >= 95% y 20 casas', () => {
    const ev = evaluateRoundMonitoring(summary({ vacunados: 19, totalNinos: 20, noVacunados: 1 }));
    expect(ev.aprobado).toBe(true);
    expect(ev.coberturaVacunacion).toBeGreaterThanOrEqual(UMBRAL_COBERTURA_APROBADO);
    expect(ev.titulo).toBe('MONITOREO APROBADO');
  });

  it('cae con cobertura < 95%', () => {
    const ev = evaluateRoundMonitoring(summary({ vacunados: 18, totalNinos: 20, noVacunados: 2 }));
    expect(ev.aprobado).toBe(false);
    expect(ev.titulo).toBe('MONITOREO CAÍDO');
  });

  it('cae sin niños registrados', () => {
    const ev = evaluateRoundMonitoring(
      summary({ totalNinos: 0, vacunados: 0, noVacunados: 0, efectivas: 0 })
    );
    expect(ev.aprobado).toBe(false);
    expect(ev.coberturaVacunacion).toBeNull();
  });
});

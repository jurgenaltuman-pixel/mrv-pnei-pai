import { describe, expect, it } from 'vitest';
import {
  buildFridayAlertMessage,
  countFridayAlertasFromRegistros,
  fridayAlertNeedsAttention,
  isFridayReminderProcessed,
  markFridayReminderProcessed,
  fridayWeekKey,
} from '@/lib/friday-reminder';

describe('friday-reminder', () => {
  it('cuenta foto sin transcripción', () => {
    const a = countFridayAlertasFromRegistros([
      {
        fecha_hora: new Date().toISOString(),
        enlace_imagen_1: 'https://drive.google.com/x',
        transcripcion_clip: '',
        observaciones: '',
      },
    ]);
    expect(a.pendientesTranscripcion).toBe(1);
    expect(fridayAlertNeedsAttention(a)).toBe(true);
  });

  it('marca procesado por semana', () => {
    const key = fridayWeekKey(new Date('2026-05-29T12:00:00'));
    localStorage.removeItem('mrv_friday_processed_' + key);
    expect(isFridayReminderProcessed(new Date('2026-05-29T12:00:00'))).toBe(false);
    markFridayReminderProcessed(new Date('2026-05-29T12:00:00'));
    expect(isFridayReminderProcessed(new Date('2026-05-29T12:00:00'))).toBe(true);
  });

  it('cuenta cambio de residencia', () => {
    const a = countFridayAlertasFromRegistros([
      {
        fecha_hora: new Date().toISOString(),
        observaciones: '[Cambio de residencia] · nota',
      },
    ]);
    expect(a.cambiosResidencia).toBe(1);
    expect(buildFridayAlertMessage(a)).toContain('cambio');
  });
});

import type { RegistroMRV } from '@/services/dataService';

export type DateRangePreset = 'hoy' | '7d' | '15d' | '30d' | 'custom' | 'todos';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function getDateRangeBounds(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string
): { start: Date | null; end: Date | null } {
  if (preset === 'todos') return { start: null, end: null };

  const now = new Date();
  const end = endOfDay(now);

  if (preset === 'hoy') {
    return { start: startOfDay(now), end };
  }

  if (preset === 'custom') {
    const start = customFrom ? startOfDay(new Date(customFrom + 'T00:00:00')) : null;
    const endCustom = customTo ? endOfDay(new Date(customTo + 'T00:00:00')) : end;
    return { start, end: endCustom };
  }

  const days = preset === '7d' ? 7 : preset === '15d' ? 15 : 30;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export function filterRegistrosByDate(
  registros: RegistroMRV[],
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string
): RegistroMRV[] {
  const { start, end } = getDateRangeBounds(preset, customFrom, customTo);
  if (!start && !end) return registros;

  return registros.filter((r) => {
    if (!r.fecha_hora) return preset === 'todos';
    const t = new Date(r.fecha_hora).getTime();
    if (Number.isNaN(t)) return false;
    if (start && t < start.getTime()) return false;
    if (end && t > end.getTime()) return false;
    return true;
  });
}

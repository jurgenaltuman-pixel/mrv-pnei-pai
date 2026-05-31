import { mrvApiFetch } from '@/lib/api-config';
import type { FridayAlertas } from '@/lib/friday-reminder';

export async function fetchAlertasViernes(): Promise<FridayAlertas | null> {
  const { data, error, status } = await mrvApiFetch<FridayAlertas>('/api/registros/alertas-viernes');
  if (error || status >= 400 || !data) return null;
  return {
    pendientesTranscripcion: Number(data.pendientesTranscripcion) || 0,
    cambiosResidencia: Number(data.cambiosResidencia) || 0,
  };
}

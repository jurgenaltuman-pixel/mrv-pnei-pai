import { mrvApiFetch } from '@/lib/api-config';
import type { RegistroMRV } from '@/services/dataService';

export type GuardarRegistroPayload = Omit<RegistroMRV, 'id' | 'fecha_hora'>;

export type GuardarRegistroResult = {
  ok: boolean;
  id?: string;
  error?: string;
  persistedIn?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST /api/registros con reintentos y validación de id devuelto por Aiven. */
export async function guardarRegistroEnApi(
  body: Record<string, unknown>,
  opts?: { retries?: number }
): Promise<GuardarRegistroResult> {
  const retries = opts?.retries ?? 2;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error, status } = await mrvApiFetch<{
      ok?: boolean;
      id?: string;
      persisted?: boolean;
      storage?: string;
    }>('/api/registros', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!error && data?.ok && data.id) {
      return {
        ok: true,
        id: String(data.id),
        persistedIn: data.storage || 'aiven',
      };
    }

    lastError = error || (status >= 400 ? `Error del servidor (${status})` : 'Respuesta inválida sin id');
    const reintentable = /fetch|network|ECONNREFUSED|ETIMEDOUT|502|503|504/i.test(lastError);
    if (!reintentable || attempt === retries) break;
    await sleep(400 * (attempt + 1));
  }

  return { ok: false, error: lastError || 'No se pudo confirmar el guardado en el servidor' };
}

import { mrvApiFetch } from '@/lib/api-config';

export interface UploadedAdjunto {
  viewUrl: string;
  fileId: string;
}

export async function uploadPersonSearchImages(opts: {
  documento: string;
  tipoDocumento?: string;
  nombre?: string;
  images: { filename: string; mimeType: string; dataBase64: string }[];
}): Promise<{ urls: string[]; error?: string }> {
  const { data, error } = await mrvApiFetch<{ urls?: UploadedAdjunto[]; error?: string }>(
    '/api/padron/busqueda-adjuntos',
    {
      method: 'POST',
      body: JSON.stringify(opts),
    }
  );
  if (error) return { urls: [], error };
  if (data?.error) return { urls: [], error: data.error };
  const urls = (data?.urls || []).map((u) => u.viewUrl).filter(Boolean);
  return { urls };
}

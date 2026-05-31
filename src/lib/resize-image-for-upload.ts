const MAX_SIDE = 1600;
const MAX_BYTES = 3_500_000;

export async function resizeImageFileForUpload(file: File): Promise<{ base64: string; mimeType: string; filename: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes');
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let quality = 0.88;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size > MAX_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  if (!blob) throw new Error('No se pudo comprimir la imagen');

  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const base64 = btoa(binary);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagen';
  return { base64, mimeType: 'image/jpeg', filename: `${baseName}.jpg` };
}

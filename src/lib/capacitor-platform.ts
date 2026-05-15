/** Detección nativa sin importar @capacitor/core en el bundle web de forma síncrona problemática. */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (/Capacitor/i.test(navigator.userAgent || '')) return true;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function isIosNative(): boolean {
  if (!isNativeApp()) return false;
  const cap = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() === 'ios';
}

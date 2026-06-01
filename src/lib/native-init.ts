import { isNativeApp } from '@/lib/capacitor-platform';
import { preloadCedulaOcr } from '@/lib/cedula-ocr';

/** Splash, barra de estado y red nativa — solo en app Capacitor. */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return;

  void preloadCedulaOcr().catch((e) => console.warn('OCR preload:', e));

  try {
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
    ]);
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#0055A4' });
    await SplashScreen.hide();
  } catch (e) {
    console.warn('Native shell init:', e);
  }
}

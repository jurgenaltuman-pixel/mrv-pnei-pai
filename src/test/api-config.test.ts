import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resolveMrvApiBaseUrl, MRV_API_PRODUCTION_DEFAULT } from '@/lib/api-config';

describe('resolveMrvApiBaseUrl', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MRV_API_URL', '');
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', protocol: 'https:' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa API Vercel en app nativa Capacitor (localhost en WebView)', () => {
    vi.stubGlobal('navigator', { userAgent: 'Capacitor Android' });
    (window as Window & { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor = {
      isNativePlatform: () => true,
    };
    expect(resolveMrvApiBaseUrl()).toBe(MRV_API_PRODUCTION_DEFAULT);
  });

  it('usa mismo origen en localhost web', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0' });
    expect(resolveMrvApiBaseUrl()).toBe('');
  });
});

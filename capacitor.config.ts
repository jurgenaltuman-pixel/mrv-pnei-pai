import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'py.gov.mspbs.mrv2026',
  appName: 'M R V PNEI',
  webDir: 'dist-vite',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0055A4',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0055A4',
    scheme: 'mrv2026',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0055A4',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0055A4',
    },
  },
};

export default config;

import { isNativeApp } from '@/lib/capacitor-platform';

type NativeBiometricModule = {
  NativeBiometric: {
    isAvailable: () => Promise<{ isAvailable: boolean }>;
    verifyIdentity: (options: { reason: string; title?: string; subtitle?: string; description?: string }) => Promise<void>;
    setCredentials: (options: { username: string; password: string; server: string }) => Promise<void>;
    getCredentials: (options: { server: string }) => Promise<{ username: string; password: string }>;
    deleteCredentials: (options: { server: string }) => Promise<void>;
  };
};

const BIOMETRIC_SERVER_KEY = 'mrvpai.app.auth';

async function getBiometricModule(): Promise<NativeBiometricModule | null> {
  if (!isNativeApp()) return null;
  try {
    return (await import('capacitor-native-biometric')) as NativeBiometricModule;
  } catch {
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const mod = await getBiometricModule();
  if (!mod) return false;
  try {
    const res = await mod.NativeBiometric.isAvailable();
    return Boolean(res?.isAvailable);
  } catch {
    return false;
  }
}

export async function hasBiometricCredentials(): Promise<boolean> {
  const mod = await getBiometricModule();
  if (!mod) return false;
  try {
    const creds = await mod.NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER_KEY });
    return Boolean(creds?.username && creds?.password);
  } catch {
    return false;
  }
}

export async function saveBiometricCredentials(username: string, password: string): Promise<void> {
  const mod = await getBiometricModule();
  if (!mod) return;
  await mod.NativeBiometric.setCredentials({
    username,
    password,
    server: BIOMETRIC_SERVER_KEY,
  });
}

export async function clearBiometricCredentials(): Promise<void> {
  const mod = await getBiometricModule();
  if (!mod) return;
  try {
    await mod.NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER_KEY });
  } catch {
    // ignore: no credentials configured
  }
}

export async function getBiometricCredentialsVerified(): Promise<{ username: string; password: string } | null> {
  const mod = await getBiometricModule();
  if (!mod) return null;
  await mod.NativeBiometric.verifyIdentity({
    reason: 'Ingresar de forma segura al MRV',
    title: 'Autenticación biométrica',
    subtitle: 'Usá tu huella o biometría',
    description: 'Confirmá tu identidad para continuar',
  });
  const creds = await mod.NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER_KEY });
  if (!creds?.username || !creds?.password) return null;
  return creds;
}

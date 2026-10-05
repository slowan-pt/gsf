import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Armazenamento sensível deste aparelho:
 *  - login por biometria/reconhecimento facial (e-mail + senha no cofre do sistema:
 *    Keychain no iOS, Keystore no Android — só nativo, nunca na web);
 *  - "não perguntar o código MFA neste dispositivo" (por usuário).
 *
 * A senha só é gravada quando a pessoa ativa a biometria e só é lida depois que
 * o sistema confirma a digital/rosto.
 */

const CHAVE_BIOMETRIA = 'dbv_login_biometria_v1';
const PREFIXO_MFA = 'dbv_mfa_confiavel_';
const OPCOES_COFRE: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function auth(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    // Carregado sob demanda: na web o módulo nativo não existe.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-local-authentication');
  } catch {
    return null;
  }
}

/** O aparelho tem biometria/reconhecimento facial cadastrado e disponível? */
export async function biometriaDisponivel(): Promise<boolean> {
  const la = auth();
  if (!la) return false;
  try {
    const [temHardware, cadastrada] = await Promise.all([la.hasHardwareAsync(), la.isEnrolledAsync()]);
    return !!temHardware && !!cadastrada;
  } catch {
    return false;
  }
}

/** Nome amigável do método disponível ("Face ID", "digital"...). */
export async function nomeBiometria(): Promise<string> {
  const la = auth();
  if (!la) return 'biometria';
  try {
    const tipos: number[] = await la.supportedAuthenticationTypesAsync();
    if (tipos.includes(la.AuthenticationType.FACIAL_RECOGNITION)) return Platform.OS === 'ios' ? 'Face ID' : 'reconhecimento facial';
    if (tipos.includes(la.AuthenticationType.FINGERPRINT)) return Platform.OS === 'ios' ? 'Touch ID' : 'digital';
  } catch {}
  return 'biometria';
}

/** Pede a biometria ao sistema. Devolve true só se a pessoa foi reconhecida. */
export async function autenticarBiometria(motivo: string): Promise<boolean> {
  const la = auth();
  if (!la) return false;
  try {
    const r = await la.authenticateAsync({ promptMessage: motivo, cancelLabel: 'Cancelar', disableDeviceFallback: false });
    return !!r.success;
  } catch {
    return false;
  }
}

export interface CredenciaisSalvas { email: string; senha: string }

export async function biometriaAtivada(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return !!(await SecureStore.getItemAsync(CHAVE_BIOMETRIA, OPCOES_COFRE));
  } catch {
    return false;
  }
}

export async function salvarCredenciaisBiometria(email: string, senha: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await SecureStore.setItemAsync(CHAVE_BIOMETRIA, JSON.stringify({ email, senha }), OPCOES_COFRE);
    return true;
  } catch {
    return false;
  }
}

/** Lê as credenciais (o chamador deve ter confirmado a biometria antes). */
export async function lerCredenciaisBiometria(): Promise<CredenciaisSalvas | null> {
  if (Platform.OS === 'web') return null;
  try {
    const bruto = await SecureStore.getItemAsync(CHAVE_BIOMETRIA, OPCOES_COFRE);
    if (!bruto) return null;
    const c = JSON.parse(bruto);
    return c?.email && c?.senha ? { email: c.email, senha: c.senha } : null;
  } catch {
    return null;
  }
}

export async function removerCredenciaisBiometria(): Promise<void> {
  if (Platform.OS === 'web') return;
  try { await SecureStore.deleteItemAsync(CHAVE_BIOMETRIA, OPCOES_COFRE); } catch {}
}

/* ─── Dispositivo confiável para o código MFA ─────────────────────────────── */

async function lerFlag(chave: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return await AsyncStorage.getItem(chave);
    return await SecureStore.getItemAsync(chave, OPCOES_COFRE);
  } catch {
    return null;
  }
}

export async function mfaDispositivoConfiavel(usuarioId: string): Promise<boolean> {
  return (await lerFlag(PREFIXO_MFA + usuarioId)) === '1';
}

export async function definirMfaDispositivoConfiavel(usuarioId: string, confiavel: boolean): Promise<void> {
  const chave = PREFIXO_MFA + usuarioId;
  try {
    if (Platform.OS === 'web') {
      if (confiavel) await AsyncStorage.setItem(chave, '1');
      else await AsyncStorage.removeItem(chave);
      return;
    }
    if (confiavel) await SecureStore.setItemAsync(chave, '1', OPCOES_COFRE);
    else await SecureStore.deleteItemAsync(chave, OPCOES_COFRE);
  } catch {}
}

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { autenticarBiometria, biometriaDisponivel } from './dispositivoSeguro';
import {
  FALHAS_PARA_APAGAR, TENTATIVAS_ZERADAS,
  concessaoValida, derivarHashPin, iguaisConstante, novaConcessao, registrarFalha, registrarUso,
  renovarConcessao, tentativaPermitida, validarFormatoPin, RODADAS_HASH_PIN,
  type ConcessaoOffline, type EstadoTentativas, type MotivoInvalida,
} from './acessoOfflineNucleo';

/**
 * Acesso offline ao AcampClasses. Depois de um login online e da preparação, o aparelho guarda — no cofre do
 * sistema (Keychain/Keystore, só neste aparelho) — uma autorização com prazo e o resumo (hash com sal) de um PIN.
 * Nas aberturas seguintes, sem internet, o módulo abre com biometria ou PIN; nada disso usa a sessão do Supabase,
 * então sessão vencida ou deslogada por tempo não impede o acesso nem apaga os dados do módulo.
 *
 * Só nativo: na web o PWA já abre offline pelo service worker e não há cofre do sistema.
 * Esta autorização libera ABRIR o módulo. Sincronizar continua exigindo sessão online válida.
 */

const CHAVE_CONCESSAO = 'dbv_acamp_concessao_v1';
const CHAVE_PIN = 'dbv_acamp_pin_v1';
const CHAVE_TENTATIVAS = 'dbv_acamp_tentativas_v1';
const OPCOES_COFRE: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

interface PinGuardado { sal: string; hash: string; rodadas: number }

export const acessoOfflineSuportado = Platform.OS !== 'web';

// Só em memória: ao fechar o app (ou reiniciar o celular) o módulo volta a pedir biometria/PIN.
let desbloqueadoEm: number | null = null;
export const estaDesbloqueado = () => desbloqueadoEm !== null;
export const bloquearAcessoOffline = () => { desbloqueadoEm = null; };

async function ler<T>(chave: string): Promise<T | null> {
  if (!acessoOfflineSuportado) return null;
  try {
    const bruto = await SecureStore.getItemAsync(chave, OPCOES_COFRE);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

async function gravar(chave: string, valor: unknown): Promise<void> {
  await SecureStore.setItemAsync(chave, JSON.stringify(valor), OPCOES_COFRE);
}

async function apagar(chave: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(chave, OPCOES_COFRE); } catch { /* já não existia */ }
}

const sha256 = (texto: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, texto);

function novoSal(): string {
  return Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SituacaoAcessoOffline {
  suportado: boolean;
  concessao: ConcessaoOffline | null;
  valida: boolean;
  motivoInvalida?: MotivoInvalida;
  temPin: boolean;
  tentativas: EstadoTentativas;
}

export async function situacaoAcessoOffline(agora = Date.now()): Promise<SituacaoAcessoOffline> {
  if (!acessoOfflineSuportado) {
    return { suportado: false, concessao: null, valida: false, motivoInvalida: 'ausente', temPin: false, tentativas: TENTATIVAS_ZERADAS };
  }
  const [concessao, pin, tentativas] = await Promise.all([
    ler<ConcessaoOffline>(CHAVE_CONCESSAO),
    ler<PinGuardado>(CHAVE_PIN),
    ler<EstadoTentativas>(CHAVE_TENTATIVAS),
  ]);
  const validade = concessaoValida(concessao, agora);
  return {
    suportado: true,
    concessao,
    valida: validade.ok && !!pin,
    motivoInvalida: validade.ok ? (pin ? undefined : 'ausente') : validade.motivo,
    temPin: !!pin,
    tentativas: tentativas ?? TENTATIVAS_ZERADAS,
  };
}

/** Atalho leve para telas que só precisam saber se existe uma autorização utilizável (ex.: o botão do login). */
export async function temAcessoOfflineValido(): Promise<boolean> {
  return (await situacaoAcessoOffline()).valida;
}

export interface DadosUsuarioOffline { usuarioId: string; nome: string; perfil: string; clubeId: number | null }

/**
 * Preparação (exige estar online e logado — quem chama garante isso): grava a autorização e o PIN.
 * O PIN é avaliado aqui e guardado apenas como hash com sal.
 */
export async function prepararAcessoOffline(dados: DadosUsuarioOffline, pin: string, usarBiometria: boolean): Promise<void> {
  if (!acessoOfflineSuportado) throw new Error('O acesso offline com PIN só está disponível no aplicativo instalado.');
  const erroPin = validarFormatoPin(pin);
  if (erroPin) throw new Error(erroPin);
  const sal = novoSal();
  const hash = await derivarHashPin(pin, sal, sha256, RODADAS_HASH_PIN);
  const biometria = usarBiometria && (await biometriaDisponivel());
  await gravar(CHAVE_PIN, { sal, hash, rodadas: RODADAS_HASH_PIN } satisfies PinGuardado);
  await gravar(CHAVE_TENTATIVAS, TENTATIVAS_ZERADAS);
  await gravar(CHAVE_CONCESSAO, novaConcessao(dados, Date.now(), biometria));
}

/** Estende o prazo (online, com sessão válida) sem pedir um PIN novo. Devolve false se não havia o que renovar. */
export async function renovarAcessoOffline(dados: Omit<DadosUsuarioOffline, 'usuarioId'> & { usuarioId: string }): Promise<boolean> {
  const atual = await ler<ConcessaoOffline>(CHAVE_CONCESSAO);
  if (!atual || atual.usuarioId !== dados.usuarioId) return false;
  await gravar(CHAVE_CONCESSAO, renovarConcessao(atual, { nome: dados.nome, perfil: dados.perfil, clubeId: dados.clubeId }, Date.now()));
  return true;
}

export type ResultadoDesbloqueio =
  | { ok: true }
  | { ok: false; motivo: 'sem_autorizacao' | 'bloqueado' | 'incorreto' | 'apagado'; restanteMs?: number; tentativasRestantes?: number };

async function liberar(concessao: ConcessaoOffline): Promise<void> {
  const agora = Date.now();
  await gravar(CHAVE_CONCESSAO, registrarUso(concessao, agora)).catch(() => {});
  await gravar(CHAVE_TENTATIVAS, TENTATIVAS_ZERADAS).catch(() => {});
  desbloqueadoEm = agora;
}

export async function desbloquearComPin(pin: string): Promise<ResultadoDesbloqueio> {
  const agora = Date.now();
  const s = await situacaoAcessoOffline(agora);
  if (!s.valida || !s.concessao) return { ok: false, motivo: 'sem_autorizacao' };

  const permitido = tentativaPermitida(s.tentativas, agora);
  if (!permitido.ok) return { ok: false, motivo: 'bloqueado', restanteMs: permitido.restanteMs };

  const guardado = await ler<PinGuardado>(CHAVE_PIN);
  const confere = !!guardado
    && iguaisConstante(await derivarHashPin(pin, guardado.sal, sha256, guardado.rodadas), guardado.hash);
  if (confere) {
    await liberar(s.concessao);
    return { ok: true };
  }

  const { estado, apagar: devApagar } = registrarFalha(s.tentativas, agora);
  if (devApagar) {
    await revogarAcessoOffline();
    return { ok: false, motivo: 'apagado' };
  }
  await gravar(CHAVE_TENTATIVAS, estado).catch(() => {});
  // Também avança o "último uso": tentar com o relógio atrasado não burla a espera.
  await gravar(CHAVE_CONCESSAO, registrarUso(s.concessao, agora)).catch(() => {});
  return {
    ok: false,
    motivo: estado.bloqueadoAte ? 'bloqueado' : 'incorreto',
    restanteMs: estado.bloqueadoAte ? estado.bloqueadoAte - agora : undefined,
    tentativasRestantes: FALHAS_PARA_APAGAR - estado.falhas,
  };
}

/** Biometria nativa (a confirmação é do sistema). Só vale se foi ativada na preparação e ainda está disponível. */
export async function desbloquearComBiometria(motivo = 'Abrir o AcampClasses'): Promise<boolean> {
  const s = await situacaoAcessoOffline();
  if (!s.valida || !s.concessao?.biometria || !(await biometriaDisponivel())) return false;
  if (!(await autenticarBiometria(motivo))) return false;
  await liberar(s.concessao);
  return true;
}

/** Apaga a autorização, o PIN e o contador. Os dados do módulo NÃO são tocados. */
export async function revogarAcessoOffline(): Promise<void> {
  desbloqueadoEm = null;
  if (!acessoOfflineSuportado) return;
  await Promise.all([apagar(CHAVE_CONCESSAO), apagar(CHAVE_PIN), apagar(CHAVE_TENTATIVAS)]);
}

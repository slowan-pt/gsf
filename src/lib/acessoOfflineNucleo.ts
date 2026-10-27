/**
 * Regras puras do acesso offline ao AcampClasses (sem React Native, sem rede): validade da autorização,
 * formato e hash do PIN e limite de tentativas. A camada que guarda e lê no aparelho é acessoOffline.ts;
 * ficar separado permite testar tudo com "node --test" (ver "npm run test:acesso-offline").
 *
 * A autorização offline só LIBERA ABRIR o módulo neste aparelho. Ela não é um token do servidor:
 * a sincronização continua exigindo uma sessão online válida.
 */

/** Por quanto tempo, depois de preparado online, o módulo abre sem internet. */
export const PERIODO_AUTORIZACAO_MS = 14 * 24 * 60 * 60 * 1000;
/** Folga para pequenos acertos de relógio; além disso o relógio é tratado como adulterado. */
export const TOLERANCIA_RELOGIO_MS = 5 * 60 * 1000;
export const TAMANHO_PIN = 6;
export const RODADAS_HASH_PIN = 2000;
/** Ao chegar a este total de erros seguidos o PIN e a autorização são apagados (exige novo login online). */
export const FALHAS_PARA_APAGAR = 10;

export interface ConcessaoOffline {
  versao: 1;
  usuarioId: string;
  nome: string;
  perfil: string;
  clubeId: number | null;
  concedidoEm: number;
  expiraEm: number;
  /** Maior instante já visto: voltar o relógio do aparelho não estende a autorização. */
  ultimoUsoEm: number;
  biometria: boolean;
}

export interface EstadoTentativas {
  falhas: number;
  bloqueadoAte: number;
}

export const TENTATIVAS_ZERADAS: EstadoTentativas = { falhas: 0, bloqueadoAte: 0 };

export type MotivoInvalida = 'ausente' | 'expirada' | 'relogio';
export type ResultadoValidade = { ok: true } | { ok: false; motivo: MotivoInvalida };

export function novaConcessao(
  dados: { usuarioId: string; nome: string; perfil: string; clubeId: number | null },
  agora: number,
  biometria: boolean,
): ConcessaoOffline {
  return {
    versao: 1,
    usuarioId: dados.usuarioId,
    nome: dados.nome,
    perfil: dados.perfil,
    clubeId: dados.clubeId,
    concedidoEm: agora,
    expiraEm: agora + PERIODO_AUTORIZACAO_MS,
    ultimoUsoEm: agora,
    biometria,
  };
}

export function concessaoValida(c: ConcessaoOffline | null | undefined, agora: number): ResultadoValidade {
  if (!c || c.versao !== 1 || typeof c.expiraEm !== 'number') return { ok: false, motivo: 'ausente' };
  if (agora + TOLERANCIA_RELOGIO_MS < c.ultimoUsoEm || agora + TOLERANCIA_RELOGIO_MS < c.concedidoEm) {
    return { ok: false, motivo: 'relogio' };
  }
  if (agora > c.expiraEm) return { ok: false, motivo: 'expirada' };
  return { ok: true };
}

export function registrarUso(c: ConcessaoOffline, agora: number): ConcessaoOffline {
  return agora > c.ultimoUsoEm ? { ...c, ultimoUsoEm: agora } : c;
}

/** Novo prazo a partir de agora (feito online, com sessão válida). Mantém o PIN e a escolha de biometria. */
export function renovarConcessao(
  c: ConcessaoOffline,
  dados: { nome: string; perfil: string; clubeId: number | null },
  agora: number,
): ConcessaoOffline {
  return { ...c, ...dados, concedidoEm: agora, expiraEm: agora + PERIODO_AUTORIZACAO_MS, ultimoUsoEm: Math.max(agora, c.ultimoUsoEm) };
}

/** null = PIN aceito; senão a mensagem do problema. */
export function validarFormatoPin(pin: string): string | null {
  if (!new RegExp(`^\\d{${TAMANHO_PIN}}$`).test(pin)) return `O PIN deve ter exatamente ${TAMANHO_PIN} números.`;
  if (/^(\d)\1+$/.test(pin)) return 'Escolha um PIN sem todos os números iguais.';
  const passos = pin.split('').map((d, i, a) => (i ? Number(d) - Number(a[i - 1]) : 0)).slice(1);
  if (passos.every((p) => p === 1) || passos.every((p) => p === -1)) return 'Escolha um PIN que não seja uma sequência.';
  return null;
}

/** Espera depois de cada erro seguido: sem espera até o 4º, depois 30 s, 2 min, 10 min, 30 min, 1 h. */
export function calcularBloqueio(falhas: number): { bloqueioMs: number; apagar: boolean } {
  if (falhas >= FALHAS_PARA_APAGAR) return { bloqueioMs: 0, apagar: true };
  const escada: Record<number, number> = { 5: 30_000, 6: 120_000, 7: 600_000, 8: 1_800_000, 9: 3_600_000 };
  return { bloqueioMs: escada[falhas] ?? 0, apagar: false };
}

export function registrarFalha(est: EstadoTentativas, agora: number): { estado: EstadoTentativas; apagar: boolean } {
  const falhas = est.falhas + 1;
  const { bloqueioMs, apagar } = calcularBloqueio(falhas);
  return { estado: { falhas, bloqueadoAte: bloqueioMs ? agora + bloqueioMs : 0 }, apagar };
}

export function tentativaPermitida(est: EstadoTentativas, agora: number): { ok: true } | { ok: false; restanteMs: number } {
  return est.bloqueadoAte > agora ? { ok: false, restanteMs: est.bloqueadoAte - agora } : { ok: true };
}

/** Hash do PIN com sal e várias rodadas. O PIN nunca é guardado, só este resumo. */
export async function derivarHashPin(
  pin: string,
  sal: string,
  sha256: (texto: string) => Promise<string>,
  rodadas: number = RODADAS_HASH_PIN,
): Promise<string> {
  let h = await sha256(`${sal}:${pin}`);
  for (let i = 1; i < rodadas; i++) h = await sha256(`${h}:${sal}:${pin}`);
  return h;
}

export function iguaisConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

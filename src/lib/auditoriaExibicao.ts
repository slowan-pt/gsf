/**
 * Apresentação dos eventos de auditoria: rótulos em português, categorias e
 * diferenças "antes → depois" legíveis. Nada aqui acessa o banco.
 */

export type CategoriaAuditoria = 'acesso' | 'membros' | 'pontuacao' | 'documentos' | 'importacao' | 'clube' | 'outros';

export const CATEGORIAS_AUDITORIA: { chave: CategoriaAuditoria; rotulo: string; icone: string; cor: string }[] = [
  { chave: 'acesso', rotulo: 'Acessos', icone: 'key-outline', cor: '#e65100' },
  { chave: 'membros', rotulo: 'Membros', icone: 'people-outline', cor: '#1565c0' },
  { chave: 'pontuacao', rotulo: 'Pontuação', icone: 'trophy-outline', cor: '#2e7d32' },
  { chave: 'documentos', rotulo: 'Documentos', icone: 'document-text-outline', cor: '#6a1b9a' },
  { chave: 'importacao', rotulo: 'Importações', icone: 'cloud-upload-outline', cor: '#00838f' },
  { chave: 'clube', rotulo: 'Clube', icone: 'shield-outline', cor: '#455a64' },
  { chave: 'outros', rotulo: 'Outros', icone: 'ellipsis-horizontal-circle-outline', cor: '#78909c' },
];

const ROTULOS_ACAO: Record<string, string> = {
  vincular_login_membro: 'Login vinculado a um membro',
  remover_acesso: 'Acesso removido',
  onboarding_clube: 'Clube configurado',
  importar_excel: 'Importação de planilha',
  atualizar_email_login: 'E-mail de login alterado',
  atualizar_email_senha_login: 'E-mail e senha de login alterados',
  atualizar_senha_login: 'Senha de login alterada',
  resetar_mfa: 'Verificação em duas etapas redefinida',
  resetar_mfa_usuario: 'Verificação em duas etapas redefinida',
};

const ROTULOS_ENTIDADE: Record<string, string> = {
  usuarios: 'Usuário',
  usuario_clubes: 'Vínculo com o clube',
  desbravadores: 'Membro',
  membros: 'Membro',
  clubes: 'Clube',
  pontuacoes: 'Pontuação',
  documentos: 'Documento',
  importacoes_lote: 'Importação',
};

const ROTULOS_CAMPO: Record<string, string> = {
  nome: 'Nome',
  email: 'E-mail',
  perfil: 'Perfil',
  cargo: 'Cargo',
  unidade_nome: 'Unidade',
  unidade_id: 'Unidade',
  ativo: 'Ativo',
  contato: 'Contato',
  data_nascimento: 'Nascimento',
  clube_id: 'Clube',
  membro_id: 'Membro',
  arquivo: 'Arquivo',
  aba: 'Aba',
  total: 'Total',
  inseridos: 'Inseridos',
  atualizados: 'Atualizados',
  erros: 'Erros',
};

const CAMPOS_SENSIVEIS = /senha|password|token|hash|secret|segredo|codigo_mfa|otp/i;

function humanizar(texto: string): string {
  const limpo = texto.replace(/[_.]+/g, ' ').trim();
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : texto;
}

export function rotuloAcao(acao: string): string {
  return ROTULOS_ACAO[acao] ?? humanizar(acao);
}

export function rotuloEntidade(entidade: string | null | undefined): string | null {
  if (!entidade) return null;
  return ROTULOS_ENTIDADE[entidade] ?? humanizar(entidade);
}

export function categoriaDoEvento(acao: string, entidade?: string | null): CategoriaAuditoria {
  const texto = `${acao} ${entidade ?? ''}`.toLowerCase();
  if (/importar|importacao/.test(texto)) return 'importacao';
  if (/login|senha|email|mfa|acesso|vincular|usuario/.test(texto)) return 'acesso';
  if (/pontu|extra|ranking/.test(texto)) return 'pontuacao';
  if (/document/.test(texto)) return 'documentos';
  if (/membro|desbravador|unidade|ficha/.test(texto)) return 'membros';
  if (/clube|onboarding|config|modelo/.test(texto)) return 'clube';
  return 'outros';
}

export function rotuloCampo(campo: string): string {
  return ROTULOS_CAMPO[campo] ?? humanizar(campo);
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

export interface AlteracaoAuditoria {
  campo: string;
  antes: string;
  depois: string;
}

/** Só os campos que mudaram (ou foram definidos), com campos sensíveis mascarados. */
export function alteracoesDoEvento(antes: unknown, depois: unknown): AlteracaoAuditoria[] {
  const a = (antes && typeof antes === 'object' ? antes : {}) as Record<string, unknown>;
  const d = (depois && typeof depois === 'object' ? depois : {}) as Record<string, unknown>;
  const campos = Array.from(new Set([...Object.keys(a), ...Object.keys(d)]));
  const lista: AlteracaoAuditoria[] = [];
  for (const campo of campos) {
    if (JSON.stringify(a[campo]) === JSON.stringify(d[campo])) continue;
    const sensivel = CAMPOS_SENSIVEIS.test(campo);
    lista.push({
      campo: rotuloCampo(campo),
      antes: sensivel ? '••••' : formatarValor(a[campo]),
      depois: sensivel ? '••••' : formatarValor(d[campo]),
    });
  }
  return lista;
}

/** Informações extras (metadata) em pares legíveis, sem campos sensíveis. */
export function detalhesDoEvento(metadata: Record<string, unknown> | null | undefined): { campo: string; valor: string }[] {
  if (!metadata) return [];
  return Object.entries(metadata)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => ({
      campo: rotuloCampo(k),
      valor: CAMPOS_SENSIVEIS.test(k) ? '••••' : formatarValor(v),
    }));
}

/** "Chrome no Windows", "Android"... a partir do user agent; null se não houver. */
export function dispositivoDoEvento(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  const so = /android/.test(ua) ? 'Android' : /iphone|ipad|ios/.test(ua) ? 'iOS' : /windows/.test(ua) ? 'Windows' : /mac os/.test(ua) ? 'macOS' : /linux/.test(ua) ? 'Linux' : null;
  const nav = /edg\//.test(ua) ? 'Edge' : /chrome\//.test(ua) ? 'Chrome' : /firefox\//.test(ua) ? 'Firefox' : /safari\//.test(ua) ? 'Safari' : null;
  if (nav && so) return `${nav} no ${so}`;
  return nav ?? so ?? (ua.length < 20 ? userAgent : 'Aplicativo');
}

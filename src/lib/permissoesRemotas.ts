import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { definirMatrizRemota, MATRIZ_PADRAO, type Permissao } from './permissoes';

/**
 * Matriz de permissões por perfil, editável pelo Admin TI (tabela
 * perfil_permissoes). Perfil sem linhas na tabela usa o padrão de fábrica.
 * A última matriz lida fica no aparelho para funcionar offline.
 */
const CHAVE_CACHE = 'perfil_permissoes_v1';
/** Linha-marca: o perfil foi personalizado (mesmo que fique sem nenhuma permissão). */
const MARCA_PERSONALIZADO = '_personalizado';

export interface PermissaoEditavel {
  chave: Permissao;
  rotulo: string;
  descricao: string;
  /** true = o banco também usa esta permissão (RLS); false = vale só na interface do app. */
  noBanco: boolean;
}

/** Permissões de plataforma (admin_plataforma, gerenciar_clubes) só o Admin TI tem e não aparecem aqui. */
export const PERMISSOES_EDITAVEIS: PermissaoEditavel[] = [
  { chave: 'admin_clube', rotulo: 'Administrar o clube', descricao: 'Modelos do clube, ranking, aparência e configurações gerais.', noBanco: false },
  { chave: 'gerenciar_acessos', rotulo: 'Gerenciar acessos', descricao: 'Vincular usuários, criar e redefinir logins.', noBanco: false },
  { chave: 'gerenciar_membros', rotulo: 'Gerenciar membros', descricao: 'Cadastrar, editar, inativar e excluir membros; importar planilha de membros.', noBanco: true },
  { chave: 'gerenciar_documentos', rotulo: 'Gerenciar documentos', descricao: 'Validar e anexar documentos de qualquer membro do clube.', noBanco: true },
  { chave: 'gerenciar_pontuacao', rotulo: 'Lançar pontuação', descricao: 'Lançar e editar pontuação e pontos extras.', noBanco: false },
  { chave: 'gerenciar_unidades', rotulo: 'Gerenciar unidades', descricao: 'Criar, editar e excluir unidades.', noBanco: false },
  { chave: 'gerenciar_agenda', rotulo: 'Gerenciar agenda', descricao: 'Criar e editar eventos do calendário.', noBanco: false },
  { chave: 'gerenciar_atividades', rotulo: 'Gerenciar atividades', descricao: 'Criar e acompanhar atividades.', noBanco: false },
  { chave: 'enviar_mensagens', rotulo: 'Enviar avisos', descricao: 'Enviar mensagens e notificações para o clube.', noBanco: false },
  { chave: 'ver_relatorios', rotulo: 'Ver relatórios', descricao: 'Abrir a tela de relatórios.', noBanco: false },
  { chave: 'ver_financeiro', rotulo: 'Ver financeiro', descricao: 'Acompanhar valores e pagamentos.', noBanco: false },
  { chave: 'ver_unidade', rotulo: 'Ver dados da unidade', descricao: 'Ver as informações da própria unidade.', noBanco: false },
  { chave: 'validar_classes', rotulo: 'Validar classes e especialidades', descricao: 'Acompanhar e aprovar classes e especialidades.', noBanco: false },
  { chave: 'ver_filhos', rotulo: 'Ver filhos vinculados', descricao: 'Acompanhar os membros vinculados (pais e responsáveis).', noBanco: false },
];

export interface PerfilEditavel {
  chave: string;
  rotulo: string;
}

/** admin_ti fica de fora: tem acesso total e não pode ser reduzido. */
export const PERFIS_EDITAVEIS: PerfilEditavel[] = [
  { chave: 'admin_clube', rotulo: 'Admin do clube' },
  { chave: 'usuario_secretaria', rotulo: 'Secretaria' },
  { chave: 'usuario_diretoria', rotulo: 'Diretoria' },
  { chave: 'usuario_conselheiro', rotulo: 'Conselheiro' },
  { chave: 'usuario_instrutor', rotulo: 'Instrutor' },
  { chave: 'usuario_tesouraria', rotulo: 'Tesouraria' },
  { chave: 'usuario_capelao', rotulo: 'Capelão' },
  { chave: 'usuario_pastor', rotulo: 'Pastor' },
  { chave: 'usuario_distrital', rotulo: 'Distrital' },
  { chave: 'usuario_regional', rotulo: 'Regional' },
  { chave: 'usuario_pais', rotulo: 'Pais' },
  { chave: 'responsavel', rotulo: 'Responsável' },
  { chave: 'usuario_desbravador', rotulo: 'Desbravador' },
];

/** Permissões que não podem ser tiradas por trava de segurança (o clube ficaria sem administração). */
export const PERMISSOES_TRAVADAS: Record<string, Permissao[]> = {
  admin_clube: ['admin_clube', 'gerenciar_acessos', 'gerenciar_membros'],
};

const CHAVES_VALIDAS = new Set<string>(PERMISSOES_EDITAVEIS.map((p) => p.chave));

function montarMatriz(linhas: { perfil: string; permissao: string }[]): Record<string, Permissao[]> {
  const matriz: Record<string, Permissao[]> = {};
  for (const l of linhas) {
    if (l.permissao === MARCA_PERSONALIZADO) { matriz[l.perfil] ??= []; continue; }
    if (!CHAVES_VALIDAS.has(l.permissao) && l.permissao !== 'admin_plataforma' && l.permissao !== 'gerenciar_clubes') continue;
    (matriz[l.perfil] ??= []).push(l.permissao as Permissao);
  }
  return matriz;
}

/**
 * Lê a matriz do banco e aplica. Sem rede, usa a última cópia do aparelho.
 * Só perfis que têm linhas na tabela sobrescrevem o padrão de fábrica.
 */
export async function carregarMatrizPermissoes(): Promise<void> {
  try {
    const { data, error } = await supabase.from('perfil_permissoes').select('perfil,permissao');
    if (error) throw error;
    const linhas = (data ?? []) as { perfil: string; permissao: string }[];
    await AsyncStorage.setItem(CHAVE_CACHE, JSON.stringify(linhas)).catch(() => {});
    definirMatrizRemota(linhas.length > 0 ? montarMatriz(linhas) : null);
  } catch {
    try {
      const bruto = await AsyncStorage.getItem(CHAVE_CACHE);
      if (bruto) definirMatrizRemota(montarMatriz(JSON.parse(bruto)));
    } catch { /* fica com o padrão de fábrica */ }
  }
}

/** Permissões atuais de cada perfil editável (banco, ou padrão de fábrica se ainda não há linhas). */
export async function lerMatrizParaEdicao(): Promise<Record<string, Permissao[]>> {
  const { data, error } = await supabase.from('perfil_permissoes').select('perfil,permissao');
  if (error) throw error;
  const doBanco = montarMatriz((data ?? []) as { perfil: string; permissao: string }[]);
  const resultado: Record<string, Permissao[]> = {};
  for (const p of PERFIS_EDITAVEIS) resultado[p.chave] = doBanco[p.chave] ?? [...(MATRIZ_PADRAO[p.chave] ?? [])];
  return resultado;
}

export function padraoDoPerfil(perfil: string): Permissao[] {
  return [...(MATRIZ_PADRAO[perfil] ?? [])];
}

/** Grava as permissões de um perfil (substitui as linhas dele) e recarrega a matriz do app. */
export async function salvarPermissoesDoPerfil(perfil: string, permissoes: Permissao[]): Promise<void> {
  const travadas = PERMISSOES_TRAVADAS[perfil] ?? [];
  const finais = Array.from(new Set([...permissoes, ...travadas]));

  const { error: erroDel } = await supabase.from('perfil_permissoes').delete().eq('perfil', perfil);
  if (erroDel) throw erroDel;
  const { error } = await supabase
    .from('perfil_permissoes')
    .insert([MARCA_PERSONALIZADO, ...finais].map((permissao) => ({ perfil, permissao })));
  if (error) throw error;
  await carregarMatrizPermissoes();
}

/**
 * Volta o perfil ao padrão de fábrica. Regrava as permissões padrão (em vez de
 * apagar) porque o banco só enxerga as linhas da tabela.
 */
export async function restaurarPadraoDoPerfil(perfil: string): Promise<void> {
  await salvarPermissoesDoPerfil(perfil, padraoDoPerfil(perfil));
}

import { supabase } from './supabase';
import { getClubeAtivoId, getProgramaAtivoId } from './contextoAtual';

/** Uma especialidade do catálogo do programa (Desbravadores/Aventureiros). */
export interface EspecialidadeCatalogo {
  id: string;
  nome: string;
  codigo: string | null;
  categoria: string | null;
  requisitos: string | null;
  pre_requisitos: string | null;
  observacoes: string | null;
  /** Imagem da insígnia (bucket público). */
  insignia_url: string | null;
  ativo: boolean;
  status: string | null;
}

/** Uma especialidade já conquistada por um membro. */
export interface EspecialidadeConquistada {
  id: number;
  dbv_id: number;
  nome: string;
  status: string | null;
  atividade_origem_id: number | null;
  plano_formativo_id: number | null;
  atividade_origem_titulo: string | null;
  marcado_por_nome: string | null;
  marcado_em: string | null;
  updated_at: string | null;
}

export interface MembroResumo {
  id: number;
  nome: string;
  unidade_nome: string | null;
  foto_url: string | null;
}

export const SEM_CATEGORIA = 'Sem categoria';

/** Rótulo de origem exibido na ficha: quem marcou, ou que veio de atividade. */
export function origemDaEspecialidade(e: {
  atividade_origem_id?: number | null;
  plano_formativo_id?: number | null;
  atividade_origem_titulo?: string | null;
  marcado_por_nome?: string | null;
}): { texto: string; automatica: boolean } {
  const veioDeAtividade = e.atividade_origem_id != null || e.plano_formativo_id != null;
  if (veioDeAtividade) {
    return {
      texto: e.atividade_origem_titulo
        ? `Concluída via atividade: ${e.atividade_origem_titulo}`
        : 'Concluída via atividade no sistema',
      automatica: true,
    };
  }
  if (e.marcado_por_nome) {
    return { texto: `Marcada por ${e.marcado_por_nome}`, automatica: false };
  }
  return { texto: 'Marcada manualmente', automatica: false };
}

/** Catálogo do programa ativo. Traz também as inativas para a tela de gestão. */
export async function carregarCatalogoEspecialidades(
  incluirInativas = false
): Promise<EspecialidadeCatalogo[]> {
  let query = supabase
    .from('especialidades_modelo')
    .select('id,nome,codigo,categoria,requisitos,pre_requisitos,observacoes,insignia_url,ativo,status')
    .eq('programa_id', getProgramaAtivoId())
    .order('nome');
  if (!incluirInativas) query = query.eq('ativo', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EspecialidadeCatalogo[];
}

/** Todas as especialidades concluídas no clube, de todos os membros. */
export async function carregarConquistasClube(): Promise<EspecialidadeConquistada[]> {
  const { data, error } = await supabase
    .from('especialidades')
    .select('id,dbv_id,nome,status,atividade_origem_id,plano_formativo_id,atividade_origem_titulo,marcado_por_nome,marcado_em,updated_at')
    .eq('clube_id', getClubeAtivoId())
    .eq('status', 'OK')
    .order('nome');
  if (error) throw error;
  return (data ?? []) as EspecialidadeConquistada[];
}

export async function carregarMembrosClube(): Promise<MembroResumo[]> {
  const { data, error } = await supabase
    .from('desbravadores')
    .select('id,nome,unidade_nome,foto_url')
    .eq('clube_id', getClubeAtivoId())
    .neq('ativo', false)
    .order('nome');
  if (error) throw error;
  return (data ?? []) as MembroResumo[];
}

/** Agrupa o catálogo por categoria, em ordem alfabética. */
export function agruparPorCategoria(
  itens: EspecialidadeCatalogo[]
): Array<{ categoria: string; itens: EspecialidadeCatalogo[] }> {
  const mapa = new Map<string, EspecialidadeCatalogo[]>();
  for (const item of itens) {
    const cat = (item.categoria ?? '').trim() || SEM_CATEGORIA;
    if (!mapa.has(cat)) mapa.set(cat, []);
    mapa.get(cat)!.push(item);
  }
  return Array.from(mapa.entries())
    .map(([categoria, lista]) => ({
      categoria,
      itens: lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }))
    .sort((a, b) => {
      // "Sem categoria" sempre por último.
      if (a.categoria === SEM_CATEGORIA) return 1;
      if (b.categoria === SEM_CATEGORIA) return -1;
      return a.categoria.localeCompare(b.categoria, 'pt-BR');
    });
}

/** Lista de categorias distintas já usadas no catálogo (para o seletor). */
export function categoriasDoCatalogo(itens: EspecialidadeCatalogo[]): string[] {
  const set = new Set<string>();
  for (const item of itens) {
    const cat = (item.categoria ?? '').trim();
    if (cat) set.add(cat);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Marca uma especialidade como concluída manualmente, registrando o
 * responsável. Não sobrescreve a origem quando a conquista já veio de uma
 * atividade — nesse caso a atividade continua sendo a origem oficial.
 */
export async function marcarEspecialidadeManual(params: {
  dbvId: number;
  nome: string;
  usuarioId?: string | null;
  usuarioNome?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('especialidades').upsert(
    {
      clube_id: getClubeAtivoId(),
      dbv_id: params.dbvId,
      nome: params.nome,
      status: 'OK',
      atividade_origem_id: null,
      plano_formativo_id: null,
      atividade_origem_titulo: null,
      atividade_origem_excluida: false,
      atividade_origem_excluida_em: null,
      marcado_por_usuario_id: params.usuarioId ?? null,
      marcado_por_nome: params.usuarioNome ?? null,
      marcado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dbv_id,nome' }
  );
  if (error) throw error;
}

export async function removerEspecialidadeDoMembro(dbvId: number, nome: string): Promise<void> {
  const { error } = await supabase
    .from('especialidades')
    .delete()
    .eq('clube_id', getClubeAtivoId())
    .eq('dbv_id', dbvId)
    .eq('nome', nome);
  if (error) throw error;
}

/* ── Gestão do catálogo (apenas Admin TI, conforme a regra do banco) ──────── */

/**
 * Envia a imagem da insígnia e devolve a URL pública.
 * Reaproveita o bucket `atividades` (já público e com permissões prontas),
 * numa pasta separada — evita depender de criar bucket novo no Supabase.
 */
export async function enviarInsigniaEspecialidade(
  arquivo: Blob | File,
  nomeArquivo: string
): Promise<string> {
  const extensao = (nomeArquivo.split('.').pop() ?? 'png').toLowerCase().slice(0, 5);
  const caminho = `especialidades/insignia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
  const { error } = await supabase.storage.from('atividades').upload(caminho, arquivo, {
    contentType: (arquivo as File).type || 'image/png',
    upsert: true,
  });
  if (error) throw error;
  return supabase.storage.from('atividades').getPublicUrl(caminho).data.publicUrl;
}

export async function salvarEspecialidadeCatalogo(dados: {
  id?: string | null;
  nome: string;
  codigo?: string | null;
  categoria?: string | null;
  requisitos?: string | null;
  pre_requisitos?: string | null;
  observacoes?: string | null;
  insignia_url?: string | null;
}): Promise<void> {
  const nome = dados.nome.trim();
  if (!nome) throw new Error('Informe o nome da especialidade.');

  const payload = {
    programa_id: getProgramaAtivoId(),
    nome,
    codigo: dados.codigo?.trim() || null,
    categoria: dados.categoria?.trim() || null,
    requisitos: dados.requisitos?.trim() || null,
    pre_requisitos: dados.pre_requisitos?.trim() || null,
    observacoes: dados.observacoes?.trim() || null,
    insignia_url: dados.insignia_url?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = dados.id
    ? await supabase.from('especialidades_modelo').update(payload).eq('id', dados.id)
    : await supabase.from('especialidades_modelo').insert({ ...payload, ativo: true, status: 'Ativa' });
  if (error) throw error;
}

export async function definirEspecialidadeAtiva(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from('especialidades_modelo')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Exclui do catálogo. Não apaga o histórico de quem já conquistou — a tabela
 * `especialidades` guarda o nome, não uma referência ao catálogo.
 */
export async function excluirEspecialidadeCatalogo(id: string): Promise<void> {
  const { error } = await supabase.from('especialidades_modelo').delete().eq('id', id);
  if (error) throw error;
}

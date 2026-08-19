import { supabase } from './supabase';
import { getClubeAtivoId, getProgramaAtivoId } from './contextoAtual';

/** Uma especialidade do catálogo do programa (Desbravadores/Aventureiros). */
export interface EspecialidadeCatalogo {
  id: string;
  nome: string;
  codigo: string | null;
  categoria: string | null;
  /** Subdivisão dentro da categoria (ex.: em "Ciência e Tecnologia" → "Informática", "Elétrica"). */
  subcategoria: string | null;
  requisitos: string | null;
  pre_requisitos: string | null;
  observacoes: string | null;
  /** Imagem da insígnia (bucket público). */
  insignia_url: string | null;
  ativo: boolean;
  status: string | null;
}

interface RequisitoEspecialidadeCatalogo {
  especialidade_id: string | null;
  item_url: string | null;
  ordem: number | null;
  texto: string;
}

function juntarRequisitos(textos: string[]): string | null {
  const limpos = textos
    .map((texto) => texto.trim())
    .filter(Boolean);
  return limpos.length ? limpos.join('\n') : null;
}

async function carregarRequisitosEspecialidadesCatalogo(): Promise<RequisitoEspecialidadeCatalogo[]> {
  const todos: RequisitoEspecialidadeCatalogo[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('mda_requisitos_modelo')
      .select('especialidade_id,item_url,ordem,texto')
      .eq('programa_id', getProgramaAtivoId())
      .eq('item_tipo', 'Especialidade')
      .order('ordem')
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const pagina = (data ?? []) as RequisitoEspecialidadeCatalogo[];
    todos.push(...pagina);
    if (pagina.length < pageSize) break;
  }

  return todos;
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
export const SEM_SUBCATEGORIA = 'Sem subcategoria';

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
    .select('id,nome,codigo,categoria,subcategoria,requisitos,pre_requisitos,observacoes,insignia_url,ativo,status,item_url')
    .eq('programa_id', getProgramaAtivoId())
    .order('nome');
  if (!incluirInativas) query = query.eq('ativo', true);
  const { data, error } = await query;
  if (error) throw error;

  const itens = (data ?? []) as (EspecialidadeCatalogo & { item_url?: string | null })[];
  if (itens.length === 0) return itens;

  const requisitos = await carregarRequisitosEspecialidadesCatalogo();

  const porId = new Map<string, RequisitoEspecialidadeCatalogo[]>();
  const porUrl = new Map<string, RequisitoEspecialidadeCatalogo[]>();
  for (const req of requisitos) {
    if (req.especialidade_id) {
      if (!porId.has(req.especialidade_id)) porId.set(req.especialidade_id, []);
      porId.get(req.especialidade_id)!.push(req);
    }
    const url = req.item_url?.trim();
    if (url) {
      if (!porUrl.has(url)) porUrl.set(url, []);
      porUrl.get(url)!.push(req);
    }
  }

  return itens.map((item) => {
    const importados = porId.get(item.id) ?? (item.item_url ? porUrl.get(item.item_url) : undefined) ?? [];
    const requisitosImportados = juntarRequisitos(
      importados
        .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .map((req) => req.texto)
    );
    return {
      ...item,
      requisitos: requisitosImportados ?? item.requisitos ?? null,
    };
  });
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

export interface SubgrupoEspecialidades {
  subcategoria: string;
  itens: EspecialidadeCatalogo[];
}

export interface GrupoCategoriaEspecialidades {
  categoria: string;
  itens: EspecialidadeCatalogo[];
  /**
   * Subdivisões dentro da categoria. Quando a categoria não usa subcategoria
   * nenhuma, vem sempre com um único subgrupo "Sem subcategoria" — a tela
   * decide, com base em `itens.length === subgrupos[0].itens.length`, se vale
   * a pena mostrar o dropdown do subtópico ou só a lista direto.
   */
  subgrupos: SubgrupoEspecialidades[];
}

/** Agrupa o catálogo por categoria e, dentro dela, por subcategoria. */
export function agruparPorCategoria(
  itens: EspecialidadeCatalogo[]
): GrupoCategoriaEspecialidades[] {
  const mapa = new Map<string, EspecialidadeCatalogo[]>();
  for (const item of itens) {
    const cat = (item.categoria ?? '').trim() || SEM_CATEGORIA;
    if (!mapa.has(cat)) mapa.set(cat, []);
    mapa.get(cat)!.push(item);
  }
  return Array.from(mapa.entries())
    .map(([categoria, lista]) => {
      const ordenados = lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const mapaSub = new Map<string, EspecialidadeCatalogo[]>();
      for (const item of ordenados) {
        const sub = (item.subcategoria ?? '').trim() || SEM_SUBCATEGORIA;
        if (!mapaSub.has(sub)) mapaSub.set(sub, []);
        mapaSub.get(sub)!.push(item);
      }
      const subgrupos = Array.from(mapaSub.entries())
        .map(([subcategoria, subItens]) => ({ subcategoria, itens: subItens }))
        .sort((a, b) => {
          if (a.subcategoria === SEM_SUBCATEGORIA) return 1;
          if (b.subcategoria === SEM_SUBCATEGORIA) return -1;
          return a.subcategoria.localeCompare(b.subcategoria, 'pt-BR');
        });
      return { categoria, itens: ordenados, subgrupos };
    })
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

/** Subcategorias já usadas dentro de uma categoria específica (para o seletor). */
export function subcategoriasDoCatalogo(itens: EspecialidadeCatalogo[], categoria: string): string[] {
  const alvo = categoria.trim();
  const set = new Set<string>();
  for (const item of itens) {
    if ((item.categoria ?? '').trim() !== alvo) continue;
    const sub = (item.subcategoria ?? '').trim();
    if (sub) set.add(sub);
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
 *
 * ContentType fixo em image/jpeg: igual ao upload de foto de membro (que já
 * funciona), em vez de confiar no tipo relatado pelo picker — inferir errado
 * (ex.: HEIC do iPhone, ou tipo vazio no navegador) faz o bucket rejeitar o envio.
 */
export async function enviarInsigniaEspecialidade(arquivo: Blob | File): Promise<string> {
  const caminho = `especialidades/insignia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { data, error } = await supabase.storage.from('atividades').upload(caminho, arquivo, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return supabase.storage.from('atividades').getPublicUrl(data.path).data.publicUrl;
}

export async function salvarEspecialidadeCatalogo(dados: {
  id?: string | null;
  nome: string;
  codigo?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
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
    subcategoria: dados.subcategoria?.trim() || null,
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

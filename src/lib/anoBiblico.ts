import { Platform } from 'react-native';
import { getDB } from './database';
import { supabase } from './supabase';
import { buscarPaginado } from './supabasePaginado';
import { adicionarFilaSync } from './sync';
import { getClubeAtivoId } from './contextoAtual';

export type Idioma = 'pt' | 'en' | 'fr' | 'es';

export const IDIOMAS: { codigo: Idioma; rotulo: string; localeSpeech: string }[] = [
  { codigo: 'pt', rotulo: 'Português (Almeida)', localeSpeech: 'pt-BR' },
  { codigo: 'en', rotulo: 'English (KJV)', localeSpeech: 'en-US' },
  { codigo: 'fr', rotulo: 'Français (Segond 1910)', localeSpeech: 'fr-FR' },
  { codigo: 'es', rotulo: 'Español (Reina-Valera 1909)', localeSpeech: 'es-ES' },
];

export interface Passagem {
  livro_abrev: string;
  capitulo: number;
  verso_ini: number | null;
  verso_fim: number | null;
}

export interface DiaAnoBiblico {
  id: number;
  mes: number;
  dia: number;
  ano_bissexto: boolean;
  ordem_no_ano: number;
  livro_abrev: string;
  livro_nome: string;
  referencia: string;
  passagens: Passagem[];
}

export interface Versiculo {
  numero: number;
  texto: string;
}

export function isAnoBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function linhaParaDia(row: any): DiaAnoBiblico {
  return {
    id: Number(row.id),
    mes: Number(row.mes),
    dia: Number(row.dia),
    ano_bissexto: !!(row.ano_bissexto === true || row.ano_bissexto === 1),
    ordem_no_ano: Number(row.ordem_no_ano),
    livro_abrev: row.livro_abrev,
    livro_nome: row.livro_nome,
    referencia: row.referencia,
    passagens: typeof row.passagens === 'string' ? JSON.parse(row.passagens) : row.passagens,
  };
}

/** Todo o catálogo (365/366 dias), ordenado por dia do ano. */
export async function obterAnoCompleto(): Promise<DiaAnoBiblico[]> {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('ano_biblico_catalogo')
      .select('*')
      .eq('ativo', true)
      .order('ordem_no_ano');
    if (error) throw error;
    return (data ?? []).map(linhaParaDia);
  }
  const db = await getDB();
  const rows = await db.getAllAsync<any>('SELECT * FROM ano_biblico_catalogo ORDER BY ordem_no_ano');
  return rows.map(linhaParaDia);
}

/** Um dia específico do catálogo, pelo id. */
export async function obterDiaPorId(id: number): Promise<DiaAnoBiblico | null> {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase.from('ano_biblico_catalogo').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? linhaParaDia(data) : null;
  }
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM ano_biblico_catalogo WHERE id = ?', [id]);
  return row ? linhaParaDia(row) : null;
}

/**
 * Resolve o dia de hoje, escolhendo a variante bissexta de 28-29/fev quando
 * o ano corrente for bissexto (ver migração 090: 28/fev tem duas linhas, e
 * 29/fev só existe na variante bissexta).
 */
export async function obterDiaDeHoje(): Promise<DiaAnoBiblico | null> {
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const dia = agora.getDate();
  const bissexto = isAnoBissexto(agora.getFullYear());

  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('ano_biblico_catalogo')
      .select('*')
      .eq('mes', mes).eq('dia', dia).eq('ano_bissexto', bissexto)
      .maybeSingle();
    if (error) throw error;
    return data ? linhaParaDia(data) : null;
  }
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM ano_biblico_catalogo WHERE mes = ? AND dia = ? AND ano_bissexto = ?',
    [mes, dia, bissexto ? 1 : 0]
  );
  return row ? linhaParaDia(row) : null;
}

/** Texto do capítulo inteiro, num idioma. Recorte por versículo fica a cargo de quem chama. */
export async function obterTextoCapitulo(
  livroAbrev: string,
  capitulo: number,
  idioma: Idioma
): Promise<Versiculo[] | null> {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase
      .from('ano_biblico_textos')
      .select('versiculos')
      .eq('livro_abrev', livroAbrev).eq('capitulo', capitulo).eq('idioma', idioma)
      .maybeSingle();
    if (error) throw error;
    return data ? (data.versiculos as Versiculo[]) : null;
  }
  const db = await getDB();
  const row = await db.getFirstAsync<{ versiculos: string }>(
    'SELECT versiculos FROM ano_biblico_textos WHERE livro_abrev = ? AND capitulo = ? AND idioma = ?',
    [livroAbrev, capitulo, idioma]
  );
  return row ? JSON.parse(row.versiculos) : null;
}

let mapaLivrosCache: Map<string, string> | null = null;

/** Abreviação (ex.: "Mc") -> nome completo (ex.: "Marcos"), lido direto do
 * catálogo (fonte única, sem lista embutida que possa ficar desatualizada). */
export async function obterMapaLivros(): Promise<Map<string, string>> {
  if (mapaLivrosCache) return mapaLivrosCache;
  if (Platform.OS === 'web') {
    const { data, error } = await supabase.from('ano_biblico_catalogo').select('livro_abrev, livro_nome');
    if (error) throw error;
    mapaLivrosCache = new Map((data ?? []).map((r: any) => [r.livro_abrev, r.livro_nome]));
  } else {
    const db = await getDB();
    const rows = await db.getAllAsync<{ livro_abrev: string; livro_nome: string }>(
      'SELECT DISTINCT livro_abrev, livro_nome FROM ano_biblico_catalogo'
    );
    mapaLivrosCache = new Map(rows.map((r) => [r.livro_abrev, r.livro_nome]));
  }
  return mapaLivrosCache;
}

/** "4:1-16" / "11:1-19, 12:1-13" — capítulo(s) e versículo(s) da passagem, sem o nome do livro. */
export function formatarCapitulos(dia: DiaAnoBiblico): string {
  return dia.passagens
    .map((p) => `${p.capitulo}${p.verso_ini ? `:${p.verso_ini}-${p.verso_fim}` : ''}`)
    .join(', ');
}

export interface Marcacao {
  id: number;
  livro_abrev: string;
  livro_nome: string;
  capitulo: number;
  verso: number;
  criado_em: string;
}

/** Marcações de um capítulo específico, pra tela de leitura saber quais versos destacar. */
export async function obterMarcacoesDoCapitulo(
  usuarioId: string,
  livroAbrev: string,
  capitulo: number
): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('ano_biblico_marcacoes')
    .select('verso')
    .eq('usuario_id', usuarioId).eq('livro_abrev', livroAbrev).eq('capitulo', capitulo);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => Number(r.verso)));
}

/** Liga/desliga a marcação de um verso. Devolve o novo estado (true = marcado). */
export async function alternarMarcacao(
  usuarioId: string,
  livroAbrev: string,
  livroNome: string,
  capitulo: number,
  verso: number
): Promise<boolean> {
  const { data: existente, error: erroBusca } = await supabase
    .from('ano_biblico_marcacoes')
    .select('id')
    .eq('usuario_id', usuarioId).eq('livro_abrev', livroAbrev).eq('capitulo', capitulo).eq('verso', verso)
    .maybeSingle();
  if (erroBusca) throw erroBusca;

  if (existente) {
    const { error } = await supabase.from('ano_biblico_marcacoes').delete().eq('id', existente.id);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from('ano_biblico_marcacoes').insert({
    usuario_id: usuarioId, livro_abrev: livroAbrev, livro_nome: livroNome, capitulo, verso,
  });
  if (error) throw error;
  return true;
}

/** Todas as marcações do usuário, opcionalmente filtradas por livro(s). Sem filtro = todas. */
export async function obterMarcacoes(usuarioId: string, livrosFiltro?: string[]): Promise<Marcacao[]> {
  let query = supabase
    .from('ano_biblico_marcacoes')
    .select('id, livro_abrev, livro_nome, capitulo, verso, criado_em')
    .eq('usuario_id', usuarioId)
    .order('livro_abrev').order('capitulo').order('verso');
  if (livrosFiltro && livrosFiltro.length > 0) query = query.in('livro_abrev', livrosFiltro);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Marcacao[];
}

/** Livros (abreviação + nome) que têm pelo menos uma marcação — popula a lista do filtro. */
export async function obterLivrosComMarcacoes(usuarioId: string): Promise<{ livro_abrev: string; livro_nome: string }[]> {
  const { data, error } = await supabase
    .from('ano_biblico_marcacoes')
    .select('livro_abrev, livro_nome')
    .eq('usuario_id', usuarioId);
  if (error) throw error;
  const mapa = new Map<string, string>();
  for (const r of (data ?? []) as any[]) mapa.set(r.livro_abrev, r.livro_nome);
  return Array.from(mapa.entries()).map(([livro_abrev, livro_nome]) => ({ livro_abrev, livro_nome }));
}

/** Recorta o texto do capítulo pelo range de uma passagem (ou devolve tudo, se não houver range). */
export function recortarVersiculos(versiculos: Versiculo[], passagem: Passagem): Versiculo[] {
  if (passagem.verso_ini == null) return versiculos;
  const fim = passagem.verso_fim ?? passagem.verso_ini;
  return versiculos.filter((v) => v.numero >= passagem.verso_ini! && v.numero <= fim);
}

/** ids de ano_biblico_catalogo já lidos por esse dbv, no ano informado. */
export async function obterDiasLidos(dbvId: number, ano: number): Promise<Set<number>> {
  if (Platform.OS === 'web') {
    // Paginado: um ano inteiro de leituras por membro chega perto do teto.
    const data = await buscarPaginado(
      (q) => q.eq('dbv_id', dbvId).eq('ano', ano).eq('lido', true),
      'ano_biblico_progresso',
      'ano_biblico_catalogo_id',
    );
    return new Set(data.map((r: any) => Number(r.ano_biblico_catalogo_id)));
  }
  const db = await getDB();
  const rows = await db.getAllAsync<{ ano_biblico_catalogo_id: number }>(
    'SELECT ano_biblico_catalogo_id FROM ano_biblico_progresso WHERE dbv_id = ? AND ano = ? AND lido = 1',
    [dbvId, ano]
  );
  return new Set(rows.map((r) => Number(r.ano_biblico_catalogo_id)));
}

/**
 * Marca um dia como lido (regra: 15s na tela + rolagem até o fim, já
 * validada por quem chama). Tenta gravar direto no Supabase primeiro — só
 * cai para o modo offline (grava local + enfileira) se estiver sem conexão
 * no app instalado, seguindo o mesmo padrão de
 * `dbvStore.ts::atualizarCampoProgressoClasse` e
 * `especialidades.ts::marcarEspecialidadeManual`.
 */
export async function marcarComoLido(params: {
  dbvId: number;
  catalogoId: number;
  ano: number;
  tempoTelaSegundos: number;
  chegouAoFim: boolean;
}): Promise<void> {
  const { dbvId, catalogoId, ano, tempoTelaSegundos, chegouAoFim } = params;
  const clubeId = getClubeAtivoId();
  const agora = new Date().toISOString();
  const payload = {
    clube_id: clubeId,
    dbv_id: dbvId,
    ano_biblico_catalogo_id: catalogoId,
    ano,
    lido: true,
    tempo_tela_segundos: tempoTelaSegundos,
    chegou_ao_fim: chegouAoFim,
    lido_em: agora,
    updated_at: agora,
  };

  try {
    const { error } = await supabase
      .from('ano_biblico_progresso')
      .upsert(payload, { onConflict: 'clube_id,dbv_id,ano_biblico_catalogo_id,ano' });
    if (error) throw error;
    if (Platform.OS !== 'web') {
      const db = await getDB();
      const existente = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM ano_biblico_progresso WHERE dbv_id = ? AND ano_biblico_catalogo_id = ? AND ano = ?',
        [dbvId, catalogoId, ano]
      );
      if (!existente) {
        await db.runAsync(
          `INSERT INTO ano_biblico_progresso
           (dbv_id, ano_biblico_catalogo_id, ano, lido, tempo_tela_segundos, chegou_ao_fim, lido_em, updated_at, sincronizado)
           VALUES (?,?,?,1,?,?,?,?,1)`,
          [dbvId, catalogoId, ano, tempoTelaSegundos, chegouAoFim ? 1 : 0, agora, agora]
        );
      }
    }
    return;
  } catch (erro) {
    if (Platform.OS === 'web') throw erro;
    // Offline no app instalado: grava local e enfileira para reenviar depois.
  }

  const db = await getDB();
  const existente = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM ano_biblico_progresso WHERE dbv_id = ? AND ano_biblico_catalogo_id = ? AND ano = ?',
    [dbvId, catalogoId, ano]
  );
  if (existente) return; // já registrado localmente — regra de conclusão só grava uma vez.

  await db.runAsync(
    `INSERT INTO ano_biblico_progresso
     (dbv_id, ano_biblico_catalogo_id, ano, lido, tempo_tela_segundos, chegou_ao_fim, lido_em, updated_at, sincronizado)
     VALUES (?,?,?,1,?,?,?,?,0)`,
    [dbvId, catalogoId, ano, tempoTelaSegundos, chegouAoFim ? 1 : 0, agora, agora]
  );
  // Sem 'id': fica para o servidor gerar, igual a progresso_classes/especialidades.
  await adicionarFilaSync('ano_biblico_progresso', 'INSERT', {
    clube_id: clubeId,
    dbv_id: dbvId,
    ano_biblico_catalogo_id: catalogoId,
    ano,
    lido: true,
    tempo_tela_segundos: tempoTelaSegundos,
    chegou_ao_fim: chegouAoFim,
    lido_em: agora,
  });
}

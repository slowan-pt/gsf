import { supabase } from './supabase';

export type FormatoResposta = 'nenhum' | 'texto' | 'upload' | 'texto_upload' | 'checkbox';

export interface RequisitoCatalogo {
  id: number;
  classe_nome: string;
  secao: string;
  secao_ordem: number;
  ordem: number;
  codigo: string;
  codigo_raiz: string;
  subitem: string | null;
  texto: string;
  tipo: string;
  pagina: number | null;
  especialidade_nome: string | null;
  avancada: boolean;
  pontua: boolean;
  formato_resposta: FormatoResposta;
  max_arquivos: number;
  idade_minima: number | null;
  chave_compartilhada: string | null;
  grupo_escolha: string | null;
  escolhas_necessarias: number | null;
  rotulo: string | null;
  documento_campo: string | null;
  /** Só usado em "Classes agrupadas": faixa de idade a que o requisito se aplica. */
  idade_agrupada_min: number | null;
  idade_agrupada_max: number | null;
}

/** Idade atual a partir da data de nascimento (mesmo cálculo usado na ficha do membro). */
export function idadePorNascimento(dataNascimento?: string | null): number | null {
  if (!dataNascimento || dataNascimento.length < 10) return null;
  const nasc = new Date(`${dataNascimento.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

/** Verdadeiro se o requisito se aplica à idade informada (ou se não é restrito por idade). */
export function requisitoAplicavelIdade(req: RequisitoCatalogo, idade: number | null): boolean {
  if (req.idade_agrupada_min == null) return true;
  if (idade == null) return false;
  if (idade < req.idade_agrupada_min) return false;
  if (req.idade_agrupada_max != null && idade > req.idade_agrupada_max) return false;
  return true;
}

export interface RespostaRequisito {
  requisito_id: number;
  dbv_id: number;
  texto: string | null;
}

export interface ArquivoRequisito {
  id: number;
  requisito_id: number;
  dbv_id: number;
  nome: string;
  url: string;
  tipo: string;
  origem: 'upload' | 'documento';
}

export function aceitaTexto(r: RequisitoCatalogo) {
  return r.formato_resposta === 'texto' || r.formato_resposta === 'texto_upload';
}

export function aceitaArquivo(r: RequisitoCatalogo) {
  return r.formato_resposta === 'upload' || r.formato_resposta === 'texto_upload';
}

export function temPreenchimento(r: RequisitoCatalogo) {
  return aceitaTexto(r) || aceitaArquivo(r);
}

export interface ProgressoRequisito {
  id?: number;
  dbv_id: number;
  requisito_id: number;
  classe_nome: string;
  concluido: boolean;
  origem: 'manual' | 'atividade' | 'especialidade';
  observacao?: string | null;
  concluido_em?: string | null;
}

export interface ResumoClasse {
  classe: string;
  total: number;
  concluidos: number;
  pct: number;
  nivel: NivelGamificado;
}

export interface NivelGamificado {
  id: string;
  titulo: string;
  emoji: string;
  cor: string;
  minPct: number;
}

/** Trilha de progressão exibida nas barras/medalhas. */
export const NIVEIS: NivelGamificado[] = [
  { id: 'inicio', titulo: 'Começando a jornada', emoji: '🌱', cor: '#94a3b8', minPct: 0 },
  { id: 'explorador', titulo: 'Explorador', emoji: '🧭', cor: '#0ea5e9', minPct: 20 },
  { id: 'trilheiro', titulo: 'Trilheiro', emoji: '🥾', cor: '#6366f1', minPct: 40 },
  { id: 'veterano', titulo: 'Veterano', emoji: '🔥', cor: '#f59e0b', minPct: 60 },
  { id: 'quase', titulo: 'Reta final', emoji: '⚡', cor: '#ea580c', minPct: 80 },
  { id: 'investido', titulo: 'Pronto para investidura!', emoji: '🏅', cor: '#16a34a', minPct: 100 },
];

export function nivelPara(pct: number): NivelGamificado {
  let atual = NIVEIS[0];
  for (const n of NIVEIS) if (pct >= n.minPct) atual = n;
  return atual;
}

export function corProgresso(pct: number) {
  return nivelPara(pct).cor;
}

export async function carregarCatalogoClasses(): Promise<RequisitoCatalogo[]> {
  const { data, error } = await supabase
    .from('classes_requisitos_catalogo')
    .select(
      'id,classe_nome,secao,secao_ordem,ordem,codigo,codigo_raiz,subitem,texto,tipo,pagina,especialidade_nome,avancada,pontua,' +
      'formato_resposta,max_arquivos,idade_minima,chave_compartilhada,grupo_escolha,escolhas_necessarias,rotulo,documento_campo,' +
      'idade_agrupada_min,idade_agrupada_max'
    )
    .eq('ativo', true)
    .order('classe_nome', { ascending: true })
    .order('secao_ordem', { ascending: true })
    .order('ordem', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as RequisitoCatalogo[];
}

export async function carregarProgressoClube(clubeId: number, dbvIds?: number[]): Promise<ProgressoRequisito[]> {
  let query = supabase
    .from('classes_requisitos_progresso')
    .select('id,dbv_id,requisito_id,classe_nome,concluido,origem,observacao,concluido_em')
    .eq('clube_id', clubeId)
    .eq('concluido', true);
  if (dbvIds && dbvIds.length > 0) query = query.in('dbv_id', dbvIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProgressoRequisito[];
}

/** Marca ou desmarca um requisito para um membro. */
export async function definirRequisito(params: {
  clubeId: number;
  dbvId: number;
  requisito: RequisitoCatalogo;
  concluido: boolean;
  usuarioId?: string | null;
}) {
  const { clubeId, dbvId, requisito, concluido, usuarioId } = params;
  if (!concluido) {
    const { error } = await supabase
      .from('classes_requisitos_progresso')
      .delete()
      .eq('clube_id', clubeId)
      .eq('dbv_id', dbvId)
      .eq('requisito_id', requisito.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('classes_requisitos_progresso').upsert(
    {
      clube_id: clubeId,
      dbv_id: dbvId,
      requisito_id: requisito.id,
      classe_nome: requisito.classe_nome,
      concluido: true,
      origem: 'manual',
      concluido_por: usuarioId ?? null,
      concluido_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clube_id,dbv_id,requisito_id' }
  );
  if (error) throw error;
}

/* ── Respostas em texto ─────────────────────────────────────────────────── */

export async function carregarRespostas(clubeId: number, dbvId: number): Promise<RespostaRequisito[]> {
  const { data, error } = await supabase
    .from('classes_requisitos_respostas')
    .select('requisito_id,dbv_id,texto')
    .eq('clube_id', clubeId)
    .eq('dbv_id', dbvId);
  if (error) throw error;
  return (data ?? []) as RespostaRequisito[];
}

export async function salvarResposta(params: {
  clubeId: number;
  dbvId: number;
  requisitoId: number;
  texto: string;
  usuarioId?: string | null;
}) {
  const { error } = await supabase.from('classes_requisitos_respostas').upsert(
    {
      clube_id: params.clubeId,
      dbv_id: params.dbvId,
      requisito_id: params.requisitoId,
      texto: params.texto,
      atualizado_por: params.usuarioId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clube_id,dbv_id,requisito_id' }
  );
  if (error) throw error;
}

/* ── Arquivos ───────────────────────────────────────────────────────────── */

const BUCKET = 'documentos_fotos';

export async function carregarArquivos(clubeId: number, dbvId: number): Promise<ArquivoRequisito[]> {
  const { data, error } = await supabase
    .from('classes_requisitos_arquivos')
    .select('id,requisito_id,dbv_id,nome,url,tipo,origem')
    .eq('clube_id', clubeId)
    .eq('dbv_id', dbvId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ArquivoRequisito[];
}

/** Gera URL assinada para exibir/baixar um arquivo guardado no bucket privado. */
export async function assinarArquivo(path: string): Promise<string | null> {
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600 * 6);
  return data?.signedUrl ?? null;
}

export async function enviarArquivoRequisito(params: {
  clubeId: number;
  dbvId: number;
  requisito: RequisitoCatalogo;
  uri: string;
  nome: string;
  mime: string;
  usuarioId?: string | null;
}) {
  const { clubeId, dbvId, requisito, uri, nome, mime, usuarioId } = params;

  // O documento de identidade sincroniza com a ficha do membro — só aceita imagem.
  if (requisito.documento_campo === 'rg' && !mime.startsWith('image/')) {
    throw new Error('O documento de identidade aceita apenas foto (imagem), não PDF.');
  }

  const resposta = await fetch(uri);
  const blob = await resposta.blob();
  const seguro = nome.replace(/[^\w.-]+/g, '_').slice(-70) || 'arquivo';
  const path = `classes/${dbvId}/${requisito.id}_${Date.now()}_${seguro}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: false, contentType: mime || 'application/octet-stream' });
  if (error) throw error;

  const tipo = mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : 'outro';

  const { error: erroBanco } = await supabase.from('classes_requisitos_arquivos').insert({
    clube_id: clubeId,
    dbv_id: dbvId,
    requisito_id: requisito.id,
    nome,
    url: data.path,
    tipo,
    origem: 'upload',
    enviado_por: usuarioId ?? null,
  });
  if (erroBanco) throw erroBanco;

  // Sincroniza de volta para a ficha do membro (aba Documentos), como se tivesse
  // sido enviado por lá — a foto é a mesma, só passa a existir nos dois lugares.
  // A ficha de documentos só aceita escrita de admin/secretaria ou pai com edição
  // liberada (mesma regra de sempre); se quem enviou aqui não tiver essa permissão,
  // o requisito da classe é salvo normalmente e só a cópia na ficha não ocorre.
  if (requisito.documento_campo) {
    await supabase
      .from('documento_imagens')
      .delete()
      .eq('clube_id', clubeId)
      .eq('dbv_id', dbvId)
      .eq('campo', requisito.documento_campo);
    const { error: erroFicha } = await supabase.from('documento_imagens').insert({
      clube_id: clubeId,
      dbv_id: dbvId,
      campo: requisito.documento_campo,
      url: data.path,
      nome,
      tipo,
    });
    if (!erroFicha) {
      await supabase.from('documento_status').upsert(
        { clube_id: clubeId, dbv_id: dbvId, campo: requisito.documento_campo, status: 'OK', updated_at: new Date().toISOString() },
        { onConflict: 'dbv_id,campo' }
      );
    }
  }
}

export async function removerArquivoRequisito(arquivoId: number) {
  const { error } = await supabase.from('classes_requisitos_arquivos').delete().eq('id', arquivoId);
  if (error) throw error;
}

/* ── Atividades geradas a partir de requisitos ──────────────────────────── */

export interface AtividadeDeRequisito {
  id: number;
  classe_requisito_id: number;
  dbv_id: number | null;
  data: string | null;
  titulo: string;
}

/** Atividades já enviadas para estes membros, indexadas por requisito. */
export async function carregarAtividadesDeRequisitos(
  clubeId: number,
  dbvIds: number[]
): Promise<AtividadeDeRequisito[]> {
  if (dbvIds.length === 0) return [];
  const { data, error } = await supabase
    .from('atividades')
    .select('id,classe_requisito_id,dbv_id,data,titulo')
    .eq('clube_id', clubeId)
    .not('classe_requisito_id', 'is', null)
    .in('dbv_id', dbvIds);
  if (error) throw error;
  return (data ?? []) as AtividadeDeRequisito[];
}

export interface AlvoEnvio {
  id: number;
  nome: string;
}

/**
 * Envia requisitos como atividade individual para cada membro escolhido.
 * Ignora pares (requisito, membro) que já tenham atividade aberta.
 */
export async function enviarRequisitosComoAtividade(params: {
  clubeId: number;
  requisitos: RequisitoCatalogo[];
  membros: AlvoEnvio[];
  prazo?: string | null;
  criadoPor?: string | null;
}): Promise<{ criadas: number; ignoradas: number }> {
  const { clubeId, requisitos, membros, prazo, criadoPor } = params;
  if (requisitos.length === 0 || membros.length === 0) return { criadas: 0, ignoradas: 0 };

  const existentes = await carregarAtividadesDeRequisitos(clubeId, membros.map((m) => m.id));
  const jaTem = new Set(existentes.map((a) => `${a.classe_requisito_id}:${a.dbv_id}`));

  const novas: any[] = [];
  let ignoradas = 0;
  for (const req of requisitos) {
    for (const membro of membros) {
      if (jaTem.has(`${req.id}:${membro.id}`)) { ignoradas += 1; continue; }
      const rotulo = `${req.codigo}${req.subitem ? `.${req.subitem}` : ''}`;
      novas.push({
        clube_id: clubeId,
        titulo: `${req.classe_nome} · ${rotulo} — ${req.texto}`.slice(0, 180),
        descricao: req.texto,
        destino: 'desbravador',
        dbv_id: membro.id,
        dbv_nome: membro.nome,
        data: prazo || null,
        criado_por: criadoPor ?? null,
        item_formativo_tipo: 'classe',
        item_formativo_nome: req.classe_nome,
        classe_requisito_id: req.id,
        gera_investidura: false,
      });
    }
  }
  if (novas.length === 0) return { criadas: 0, ignoradas };

  const { data, error } = await supabase.from('atividades').insert(novas).select('id,dbv_id');
  if (error) throw error;

  const alvos = (data ?? []).map((a: any) => ({
    clube_id: clubeId,
    atividade_id: a.id,
    tipo: 'membro',
    membro_id: a.dbv_id,
  }));
  if (alvos.length > 0) await supabase.from('atividades_alvos').insert(alvos);

  return { criadas: novas.length, ignoradas };
}

export async function cancelarAtividadeDeRequisito(atividadeId: number) {
  const { error } = await supabase.from('atividades').delete().eq('id', atividadeId);
  if (error) throw error;
}

/**
 * Envia a resposta preenchida no painel (texto/arquivos já salvos em
 * classes_requisitos_respostas/arquivos) para a fila de avaliação da atividade
 * vinculada. Quem avalia aprova pela tela de Atividades, e a aprovação já
 * conclui o requisito automaticamente.
 */
export async function enviarRespostaParaAvaliacao(params: {
  clubeId: number;
  atividadeId: number;
  dbvId: number;
  dbvNome: string;
  texto: string;
  arquivos: ArquivoRequisito[];
}) {
  const { clubeId, atividadeId, dbvId, dbvNome, texto, arquivos } = params;
  // Os anexos ficam no bucket privado de Classes (fotos, PDF); a tela de Atividades
  // só sabe exibir arquivos do bucket público dela. Por isso o texto aponta o
  // avaliador para abrir a resposta em Classes, onde os anexos aparecem de fato.
  const nota = arquivos.length > 0
    ? `\n\n📎 ${arquivos.length} anexo(s) — abra em Classes → ${dbvNome} para ver.`
    : '';

  const { error } = await supabase.from('atividades_respostas').upsert(
    {
      clube_id: clubeId,
      atividade_id: atividadeId,
      dbv_id: dbvId,
      dbv_nome: dbvNome,
      texto: (texto || '(sem texto — ver anexos)') + nota,
      status: 'entregue',
      entregue_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'atividade_id,dbv_id' }
  );
  if (error) throw error;
}

/* ── Grupos de escolha ("faça duas destas") ─────────────────────────────── */

export interface EstadoGrupoEscolha {
  grupo: string;
  necessarias: number;
  marcadas: number;
  completo: boolean;
}

export function estadoGrupos(
  catalogo: RequisitoCatalogo[],
  concluidos: Set<number>
): Map<string, EstadoGrupoEscolha> {
  const mapa = new Map<string, EstadoGrupoEscolha>();
  for (const req of catalogo) {
    if (!req.grupo_escolha) continue;
    const atual = mapa.get(req.grupo_escolha) ?? {
      grupo: req.grupo_escolha,
      necessarias: req.escolhas_necessarias ?? 1,
      marcadas: 0,
      completo: false,
    };
    if (concluidos.has(req.id)) atual.marcadas += 1;
    atual.completo = atual.marcadas >= atual.necessarias;
    mapa.set(req.grupo_escolha, atual);
  }
  return mapa;
}

/* ── Marcação em massa (checkbox mestre da classe) ──────────────────────── */

/**
 * Marca ou desmarca todos os requisitos de uma classe de uma vez, via RPC
 * atômica no banco. Some/aparece em "Receber" automaticamente (gatilho).
 */
export async function marcarClasseCompleta(params: {
  clubeId: number;
  dbvId: number;
  classeNome: string;
  avancada: boolean;
  concluir: boolean;
}) {
  const { error } = await supabase.rpc('marcar_classe_completa', {
    p_clube_id: params.clubeId,
    p_dbv_id: params.dbvId,
    p_classe_nome: params.classeNome,
    p_avancada: params.avancada,
    p_concluir: params.concluir,
  });
  if (error) throw error;
}

export interface ValidacaoClasse {
  /** Todos os requisitos concluídos, mas ainda não validada pela diretoria. */
  aguardandoValidacao: boolean;
  /** Classe concluída e entregue (investidura_itens.entregue = true). */
  validada: boolean;
}

/**
 * Situação de validação (aguardando/validada) por membro+classe, lida de
 * investidura_itens e da atividade sintética criada pelo gatilho de conclusão.
 */
export async function carregarValidacaoClasses(
  clubeId: number,
  dbvIds: number[]
): Promise<Map<string, ValidacaoClasse>> {
  const mapa = new Map<string, ValidacaoClasse>();
  if (dbvIds.length === 0) return mapa;

  const [entregues, aprovadas] = await Promise.all([
    supabase
      .from('investidura_itens')
      .select('dbv_id,item_nome,entregue')
      .eq('clube_id', clubeId)
      .eq('tipo', 'classe')
      .in('dbv_id', dbvIds),
    supabase
      .from('atividades')
      .select('dbv_id,item_formativo_nome,atividades_respostas!inner(status)')
      .eq('clube_id', clubeId)
      .eq('item_formativo_tipo', 'classe')
      .eq('criado_por', '__sistema_classes__')
      .eq('atividades_respostas.status', 'aprovada')
      .in('dbv_id', dbvIds),
  ]);
  if (entregues.error) throw entregues.error;

  for (const row of (entregues.data ?? []) as any[]) {
    if (!row.entregue) continue;
    mapa.set(`${row.dbv_id}|${row.item_nome}`, { aguardandoValidacao: false, validada: true });
  }
  if (!aprovadas.error) {
    for (const row of (aprovadas.data ?? []) as any[]) {
      const chave = `${row.dbv_id}|${row.item_formativo_nome}`;
      if (mapa.has(chave)) continue;
      mapa.set(chave, { aguardandoValidacao: true, validada: false });
    }
  }
  return mapa;
}

/** Lista de classes distintas no catálogo, em ordem de progressão. */
export function classesDoCatalogo(catalogo: RequisitoCatalogo[]): string[] {
  return Array.from(new Set(catalogo.map((r) => r.classe_nome)));
}

/** Cor de identidade de cada classe (mesmas cores dos brasões oficiais). */
export const CORES_CLASSE: Record<string, string> = {
  Amigo: '#1e88e5',
  Companheiro: '#e53935',
  Pesquisador: '#43a047',
  Pioneiro: '#78909c',
  Excursionista: '#8e24aa',
  Guia: '#fbc02d',
  'Líder': '#0d3b66',
  'Líder Máster': '#b8860b',
  'Classes agrupadas': '#0f766e',
};

/** Nome de exibição da classe avançada de cada classe regular. */
export const NOME_AVANCADA: Record<string, string> = {
  Amigo: 'Amigo da Natureza',
  Companheiro: 'Companheiro de Excursionismo',
  Pesquisador: 'Pesquisador de Campos e Bosques',
  Pioneiro: 'Pioneiro de Novas Fronteiras',
  Excursionista: 'Excursionista na Mata',
  Guia: 'Guia de Exploração',
};

export function corDaClasse(classeNome: string): string {
  return CORES_CLASSE[classeNome] ?? '#64748b';
}

/**
 * Imagem oficial do brasão/faixa de cada classe (regular e avançada). Classes
 * sem imagem própria ainda (Agrupadas, Líder, Líder Máster) caem no fallback
 * de cor (`CORES_CLASSE`/`corDaClasse`).
 */
export const IMAGEM_CLASSE: Record<string, { regular: any; avancada: any }> = {
  Amigo: {
    regular: require('../../assets/classes/10-anos-amigo.png'),
    avancada: require('../../assets/classes/10-anos-avancado-amigo.png'),
  },
  Companheiro: {
    regular: require('../../assets/classes/11-anos-companheiro.png'),
    avancada: require('../../assets/classes/11-anos-avancado-companheiro.png'),
  },
  Pesquisador: {
    regular: require('../../assets/classes/12-anos-pesquisador.png'),
    avancada: require('../../assets/classes/12-anos-avancado-pesquisador.png'),
  },
  Pioneiro: {
    regular: require('../../assets/classes/13-anos-pioneiro.png'),
    avancada: require('../../assets/classes/13-anos-avancado-pioneiro.png'),
  },
  Excursionista: {
    regular: require('../../assets/classes/14-anos-excursionista.png'),
    avancada: require('../../assets/classes/14-anos-avancado-excursionista.png'),
  },
  Guia: {
    regular: require('../../assets/classes/15-anos-guia.png'),
    avancada: require('../../assets/classes/15-anos-avancado-guia.png'),
  },
};

/** Imagem de identidade da classe, se existir (usar como logo no lugar do ponto colorido). */
export function imagemDaClasse(classeNome: string, avancada: boolean): any | null {
  const par = IMAGEM_CLASSE[classeNome];
  if (!par) return null;
  return avancada ? par.avancada : par.regular;
}

export interface ClasseSeparada {
  /** Chave única (classe_nome + regular/avançada) usada para navegação/seleção. */
  chave: string;
  classeNome: string;
  avancada: boolean;
  label: string;
  cor: string;
}

/**
 * Lista as classes do catálogo separando regular de avançada — ex.: "Amigo" e
 * "Amigo da Natureza" viram entradas distintas, cada uma com seu progresso.
 */
export function classesSeparadas(catalogo: RequisitoCatalogo[], idadeMembro?: number | null): ClasseSeparada[] {
  const vistos = new Set<string>();
  const resultado: ClasseSeparada[] = [];
  for (const req of catalogo) {
    if (!requisitoAplicavelIdade(req, idadeMembro ?? null)) continue;
    const chave = `${req.classe_nome}::${req.avancada ? 'av' : 'reg'}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push({
      chave,
      classeNome: req.classe_nome,
      avancada: req.avancada,
      label: req.avancada ? (NOME_AVANCADA[req.classe_nome] ?? `${req.classe_nome} (avançada)`) : req.classe_nome,
      cor: corDaClasse(req.classe_nome),
    });
  }
  return resultado.sort((a, b) => (a.avancada === b.avancada ? 0 : a.avancada ? 1 : -1));
}

/**
 * Resume o progresso de um membro por classe. Só requisitos com `pontua = true`
 * (os requisitos-raiz) entram na conta — subitens são detalhamento.
 */
export function resumirPorClasse(
  catalogo: RequisitoCatalogo[],
  concluidos: Set<number>
): ResumoClasse[] {
  const porClasse = new Map<string, { total: number; feitos: number }>();
  for (const req of catalogo) {
    if (!req.pontua) continue;
    const atual = porClasse.get(req.classe_nome) ?? { total: 0, feitos: 0 };
    atual.total += 1;
    if (concluidos.has(req.id)) atual.feitos += 1;
    porClasse.set(req.classe_nome, atual);
  }
  return Array.from(porClasse.entries()).map(([classe, { total, feitos }]) => {
    const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
    return { classe, total, concluidos: feitos, pct, nivel: nivelPara(pct) };
  });
}

export interface ResumoClasseSeparado extends ResumoClasse {
  chave: string;
  avancada: boolean;
  label: string;
  cor: string;
}

/** Mesmo cálculo de `resumirPorClasse`, mas separando regular de avançada. */
export function resumirPorClasseSeparado(
  catalogo: RequisitoCatalogo[],
  concluidos: Set<number>,
  idadeMembro?: number | null
): ResumoClasseSeparado[] {
  const porChave = new Map<string, { total: number; feitos: number }>();
  for (const req of catalogo) {
    if (!req.pontua) continue;
    if (!requisitoAplicavelIdade(req, idadeMembro ?? null)) continue;
    const chave = `${req.classe_nome}::${req.avancada ? 'av' : 'reg'}`;
    const atual = porChave.get(chave) ?? { total: 0, feitos: 0 };
    atual.total += 1;
    if (concluidos.has(req.id)) atual.feitos += 1;
    porChave.set(chave, atual);
  }
  const infos = classesSeparadas(catalogo, idadeMembro);
  return infos.map((info) => {
    const { total, feitos } = porChave.get(info.chave) ?? { total: 0, feitos: 0 };
    const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
    return {
      chave: info.chave, classe: info.classeNome, avancada: info.avancada,
      label: info.label, cor: info.cor,
      total, concluidos: feitos, pct, nivel: nivelPara(pct),
    };
  });
}

/** Agrupa o catálogo de uma classe em seções → requisitos-raiz → subitens. */
export interface SecaoAgrupada {
  secao: string;
  avancada: boolean;
  raizes: { raiz: RequisitoCatalogo; filhos: RequisitoCatalogo[] }[];
}

export function agruparClasse(
  catalogo: RequisitoCatalogo[],
  classe: string,
  avancada?: boolean,
  idadeMembro?: number | null
): SecaoAgrupada[] {
  const daClasse = catalogo.filter(
    (r) =>
      r.classe_nome === classe &&
      (avancada === undefined || r.avancada === avancada) &&
      requisitoAplicavelIdade(r, idadeMembro ?? null)
  );
  const secoes: SecaoAgrupada[] = [];
  for (const req of daClasse) {
    let secao = secoes.find((s) => s.secao === req.secao);
    if (!secao) {
      secao = { secao: req.secao, avancada: req.avancada, raizes: [] };
      secoes.push(secao);
    }
    if (req.pontua) {
      secao.raizes.push({ raiz: req, filhos: [] });
      continue;
    }
    const pai = [...secao.raizes].reverse().find((r) => r.raiz.codigo === req.codigo_raiz);
    if (pai) pai.filhos.push(req);
    // Subitem sem raiz correspondente vira um requisito próprio para não sumir da tela.
    else secao.raizes.push({ raiz: req, filhos: [] });
  }
  return secoes;
}

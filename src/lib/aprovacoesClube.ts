import { supabase } from './supabase';

// Espelha CLASSES_LABELS/campoClassePorNome de app/membro/[id].tsx — duplicado
// aqui porque essa tela é por-membro e não exporta esses mapas. Mantenha os
// dois em sincronia se uma classe nova for adicionada.
const CLASSES_LABELS: Record<string, string> = {
  amigo: 'Amigo', amigo_nat: 'Amigo da Natureza', companheiro: 'Companheiro',
  comp_exc: 'Comp. Excursionista', pesquisador: 'Pesquisador', pesquisador_cb: 'Pesquisador C.B.',
  pioneiro: 'Pioneiro', pioneiro_nf: 'Pioneiro N.F.', excursionista: 'Excursionista',
  exc_mata: 'Exc. da Mata', guia: 'Guia', guia_exp: 'Guia Exploração',
  agrupada: 'Agrupada', lider: 'Líder', lider_master: 'Líder Master', lider_ma: 'Líder MA',
};

const ALIAS_CAMPO_CLASSE: Record<string, string> = {
  'amigo da natureza': 'amigo_nat',
  'companheiro de excursionismo': 'comp_exc',
  'pesquisador de campos e bosques': 'pesquisador_cb',
  'pesquisador de campo e bosque': 'pesquisador_cb',
  'pioneiro de novas fronteiras': 'pioneiro_nf',
  'excursionista na mata': 'exc_mata',
  'guia de exploração': 'guia_exp',
};

function normalizarTextoBusca(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function campoClassePorNome(nome: string): string | null {
  const semSufixo = nome.replace(/\s*-\s*Agrupadas\s*$/i, '');
  const alvo = normalizarTextoBusca(semSufixo);
  const alias = ALIAS_CAMPO_CLASSE[alvo];
  if (alias) return alias;
  return Object.entries(CLASSES_LABELS).find(([, label]) => normalizarTextoBusca(label) === alvo)?.[0] ?? null;
}

export interface ItemParaAprovar {
  dbvId: number;
  dbvNome: string;
  unidadeNome: string;
  tipo: 'classe' | 'especialidade';
  nome: string;
  aprovadas: number;
  necessarias: number;
  atividadeId: number;
  planoId: number | null;
  titulo: string;
}

export interface ItemConcluido {
  dbvId: number;
  dbvNome: string;
  unidadeNome: string;
  tipo: 'classe' | 'especialidade';
  nome: string;
}

/** Classes/especialidades aprovadas (via atividade) mas ainda não entregues — mesma lógica da aba Receber, agregada para o clube todo. */
export async function carregarItensParaAprovar(clubeId: number): Promise<ItemParaAprovar[]> {
  const { data: atividades, error: erroAtiv } = await supabase
    .from('atividades')
    .select('id,titulo,item_formativo_tipo,item_formativo_nome,plano_formativo_id')
    .eq('clube_id', clubeId)
    .not('item_formativo_tipo', 'is', null);
  if (erroAtiv) throw erroAtiv;
  const atividadesMap = new Map((atividades ?? []).map((a: any) => [a.id, a]));
  const ids = (atividades ?? []).map((a: any) => a.id);
  if (ids.length === 0) return [];

  const planoIds = [...new Set((atividades ?? []).map((a: any) => a.plano_formativo_id).filter(Boolean))];

  const [{ data: respostas, error: erroResp }, planosRes, especRes, progRes, dbvRes] = await Promise.all([
    supabase.from('atividades_respostas').select('atividade_id,dbv_id,dbv_nome,status').eq('clube_id', clubeId).in('atividade_id', ids),
    planoIds.length > 0
      ? supabase.from('planos_formativos').select('id,titulo,avaliacoes_necessarias').in('id', planoIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('especialidades').select('dbv_id,nome').eq('clube_id', clubeId).eq('status', 'OK'),
    supabase.from('progresso_classes').select('*').eq('clube_id', clubeId),
    supabase.from('desbravadores').select('id,nome,unidade_nome').eq('clube_id', clubeId),
  ]);
  if (erroResp) throw erroResp;

  const planosMap = new Map(((planosRes.data ?? []) as any[]).map((p) => [p.id, p]));
  const especsOK = new Set(
    ((especRes.data ?? []) as any[]).map((e) => `${e.dbv_id}|${normalizarTextoBusca(e.nome)}`)
  );
  const progressoPorDbv = new Map<number, any>(((progRes.data ?? []) as any[]).map((p) => [p.dbv_id, p]));
  const dbvsMap = new Map(((dbvRes.data ?? []) as any[]).map((d) => [d.id, d]));

  const grupos = new Map<string, { atividade: any; statuses: { dbv_id: number; dbv_nome: string; status: string }[] }>();
  for (const resp of (respostas ?? []) as any[]) {
    const atividade = atividadesMap.get(resp.atividade_id);
    if (!atividade) continue;
    const chave = `${resp.dbv_id}|${atividade.item_formativo_tipo}|${atividade.item_formativo_nome}|${atividade.plano_formativo_id ?? ''}`;
    const atual = grupos.get(chave) ?? { atividade, statuses: [] };
    atual.statuses.push(resp);
    grupos.set(chave, atual);
  }

  const resultado: ItemParaAprovar[] = [];
  for (const { atividade, statuses } of grupos.values()) {
    const dbvId = statuses[0].dbv_id;
    const aprovadas = statuses.filter((s) => s.status === 'aprovada').length;
    const necessarias = atividade.plano_formativo_id
      ? (planosMap.get(atividade.plano_formativo_id)?.avaliacoes_necessarias ?? 1)
      : 1;
    if (aprovadas < necessarias) continue;

    const nome = atividade.item_formativo_nome as string;
    const tipo = atividade.item_formativo_tipo as 'classe' | 'especialidade';
    if (tipo === 'especialidade') {
      if (especsOK.has(`${dbvId}|${normalizarTextoBusca(nome)}`)) continue;
    } else {
      const campo = campoClassePorNome(nome);
      if (campo && progressoPorDbv.get(dbvId)?.[campo] === 'OK') continue;
    }

    const dbv = dbvsMap.get(dbvId);
    const plano = atividade.plano_formativo_id ? planosMap.get(atividade.plano_formativo_id) : null;
    resultado.push({
      dbvId,
      dbvNome: dbv?.nome ?? statuses[0].dbv_nome ?? 'Membro',
      unidadeNome: dbv?.unidade_nome || 'Sem unidade',
      tipo,
      nome,
      aprovadas,
      necessarias,
      atividadeId: atividade.id,
      planoId: atividade.plano_formativo_id ?? null,
      titulo: plano?.titulo ?? atividade.titulo ?? nome,
    });
  }

  return resultado.sort(
    (a, b) => a.unidadeNome.localeCompare(b.unidadeNome, 'pt-BR') || a.dbvNome.localeCompare(b.dbvNome, 'pt-BR')
  );
}

/**
 * Registra a entrega/validação de um item aprovado — mesma mutação de
 * registrarEntregaInvestidura em app/membro/[id].tsx, reaproveitada aqui para
 * permitir aprovar direto da visão geral do clube, sem abrir a ficha do membro.
 */
export async function aprovarItem(clubeId: number, item: ItemParaAprovar): Promise<void> {
  if (item.tipo === 'especialidade') {
    const { error } = await supabase.from('especialidades').upsert(
      {
        clube_id: clubeId,
        dbv_id: item.dbvId,
        nome: item.nome,
        status: 'OK',
        atividade_origem_id: item.planoId ? null : item.atividadeId,
        plano_formativo_id: item.planoId,
        atividade_origem_titulo: item.titulo,
        atividade_origem_excluida: false,
        atividade_origem_excluida_em: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'dbv_id,nome' }
    );
    if (error) throw error;
  } else {
    const campo = campoClassePorNome(item.nome);
    if (!campo) throw new Error('Não consegui relacionar essa classe ao cadastro de classes do programa.');
    const { data: existente } = await supabase
      .from('progresso_classes')
      .select('id')
      .eq('clube_id', clubeId)
      .eq('dbv_id', item.dbvId)
      .maybeSingle();
    const payload = { clube_id: clubeId, dbv_id: item.dbvId, [campo]: 'OK', updated_at: new Date().toISOString() };
    const { error } = existente?.id
      ? await supabase.from('progresso_classes').update(payload).eq('id', existente.id)
      : await supabase.from('progresso_classes').insert(payload);
    if (error) throw error;
  }

  const { error: erroInvestidura } = await supabase.from('investidura_itens').upsert(
    {
      clube_id: clubeId,
      dbv_id: item.dbvId,
      atividade_id: item.atividadeId,
      plano_formativo_id: item.planoId,
      tipo: item.tipo,
      item_nome: item.nome,
      marcado: false,
      entregue: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clube_id,dbv_id,tipo,item_nome' }
  );
  if (erroInvestidura) throw erroInvestidura;
}

export interface PendenteAtividade {
  dbvId: number;
  nome: string;
  unidadeNome: string;
}

export interface AtividadeEmAndamento {
  atividadeId: number;
  titulo: string;
  data: string | null;
  itemFormativoTipo: 'classe' | 'especialidade' | null;
  itemFormativoNome: string | null;
  totalEsperado: number;
  entregues: number;
  pendentes: PendenteAtividade[];
}

/** Atividades com pelo menos um destinatário que ainda não entregou nada. */
export async function carregarAtividadesEmAndamento(clubeId: number): Promise<AtividadeEmAndamento[]> {
  const { data: atividades, error: erroAtiv } = await supabase
    .from('atividades')
    .select('id,titulo,data,destino,unidade_id,dbv_id,item_formativo_tipo,item_formativo_nome,criado_por')
    .eq('clube_id', clubeId);
  if (erroAtiv) throw erroAtiv;

  const reais = ((atividades ?? []) as any[]).filter((a) => a.criado_por !== '__sistema_classes__');
  if (reais.length === 0) return [];
  const ids = reais.map((a) => a.id);

  const [{ data: alvos, error: erroAlvos }, { data: respostas, error: erroResp }, { data: dbvs, error: erroDbv }] =
    await Promise.all([
      supabase.from('atividades_alvos').select('atividade_id,tipo,unidade_id,membro_id').eq('clube_id', clubeId).in('atividade_id', ids),
      supabase.from('atividades_respostas').select('atividade_id,dbv_id').eq('clube_id', clubeId).in('atividade_id', ids),
      supabase.from('desbravadores').select('id,nome,unidade_id,unidade_nome').eq('clube_id', clubeId).neq('ativo', false),
    ]);
  if (erroAlvos) throw erroAlvos;
  if (erroResp) throw erroResp;
  if (erroDbv) throw erroDbv;

  const alvosPorAtividade = new Map<number, any[]>();
  for (const alvo of (alvos ?? []) as any[]) {
    if (!alvosPorAtividade.has(alvo.atividade_id)) alvosPorAtividade.set(alvo.atividade_id, []);
    alvosPorAtividade.get(alvo.atividade_id)!.push(alvo);
  }
  const respondidosPorAtividade = new Map<number, Set<number>>();
  for (const r of (respostas ?? []) as any[]) {
    if (!respondidosPorAtividade.has(r.atividade_id)) respondidosPorAtividade.set(r.atividade_id, new Set());
    respondidosPorAtividade.get(r.atividade_id)!.add(r.dbv_id);
  }
  const todosDbvs = (dbvs ?? []) as any[];

  const resultado: AtividadeEmAndamento[] = [];
  for (const a of reais) {
    const alvosAtividade = alvosPorAtividade.get(a.id) ?? [];
    let esperados: any[];
    if (alvosAtividade.length > 0) {
      if (alvosAtividade.some((al) => al.tipo === 'todos')) {
        esperados = todosDbvs;
      } else {
        const unidadeIds = new Set(alvosAtividade.filter((al) => al.tipo === 'unidade').map((al) => al.unidade_id));
        const membroIds = new Set(alvosAtividade.filter((al) => al.tipo === 'membro').map((al) => al.membro_id));
        esperados = todosDbvs.filter((d) => unidadeIds.has(d.unidade_id) || membroIds.has(d.id));
      }
    } else if (a.destino === 'todos') {
      esperados = todosDbvs;
    } else if (a.destino === 'unidade' && a.unidade_id) {
      esperados = todosDbvs.filter((d) => d.unidade_id === a.unidade_id);
    } else if (a.destino === 'desbravador' && a.dbv_id) {
      esperados = todosDbvs.filter((d) => d.id === a.dbv_id);
    } else {
      esperados = [];
    }

    const respondidos = respondidosPorAtividade.get(a.id) ?? new Set<number>();
    const pendentes = esperados.filter((d) => !respondidos.has(d.id));
    if (pendentes.length === 0 || esperados.length === 0) continue;

    resultado.push({
      atividadeId: a.id,
      titulo: a.titulo,
      data: a.data,
      itemFormativoTipo: a.item_formativo_tipo,
      itemFormativoNome: a.item_formativo_nome,
      totalEsperado: esperados.length,
      entregues: esperados.length - pendentes.length,
      pendentes: pendentes
        .map((d) => ({ dbvId: d.id, nome: d.nome, unidadeNome: d.unidade_nome || 'Sem unidade' }))
        .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')),
    });
  }

  return resultado.sort((a, b) => (a.data ?? '').localeCompare(b.data ?? '') || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/** Classes/especialidades já concluídas (status OK) no clube todo. */
export async function carregarItensConcluidos(clubeId: number): Promise<ItemConcluido[]> {
  const [especRes, progRes, dbvRes] = await Promise.all([
    supabase.from('especialidades').select('dbv_id,nome').eq('clube_id', clubeId).eq('status', 'OK'),
    supabase.from('progresso_classes').select('*').eq('clube_id', clubeId),
    supabase.from('desbravadores').select('id,nome,unidade_nome').eq('clube_id', clubeId),
  ]);
  if (especRes.error) throw especRes.error;
  if (progRes.error) throw progRes.error;
  if (dbvRes.error) throw dbvRes.error;

  const dbvsMap = new Map(((dbvRes.data ?? []) as any[]).map((d) => [d.id, d]));
  const resultado: ItemConcluido[] = [];

  for (const e of (especRes.data ?? []) as any[]) {
    const dbv = dbvsMap.get(e.dbv_id);
    resultado.push({
      dbvId: e.dbv_id, dbvNome: dbv?.nome ?? 'Membro', unidadeNome: dbv?.unidade_nome || 'Sem unidade',
      tipo: 'especialidade', nome: e.nome,
    });
  }

  for (const row of (progRes.data ?? []) as any[]) {
    const dbv = dbvsMap.get(row.dbv_id);
    for (const [campo, label] of Object.entries(CLASSES_LABELS)) {
      if (row[campo] === 'OK') {
        resultado.push({
          dbvId: row.dbv_id, dbvNome: dbv?.nome ?? 'Membro', unidadeNome: dbv?.unidade_nome || 'Sem unidade',
          tipo: 'classe', nome: label,
        });
      }
    }
  }

  return resultado.sort(
    (a, b) => a.unidadeNome.localeCompare(b.unidadeNome, 'pt-BR') || a.dbvNome.localeCompare(b.dbvNome, 'pt-BR')
  );
}

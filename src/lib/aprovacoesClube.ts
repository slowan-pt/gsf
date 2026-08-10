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
    .select('id,item_formativo_tipo,item_formativo_nome,plano_formativo_id')
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
      ? supabase.from('planos_formativos').select('id,avaliacoes_necessarias').in('id', planoIds)
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
    resultado.push({
      dbvId,
      dbvNome: dbv?.nome ?? statuses[0].dbv_nome ?? 'Membro',
      unidadeNome: dbv?.unidade_nome || 'Sem unidade',
      tipo,
      nome,
      aprovadas,
      necessarias,
    });
  }

  return resultado.sort(
    (a, b) => a.unidadeNome.localeCompare(b.unidadeNome, 'pt-BR') || a.dbvNome.localeCompare(b.dbvNome, 'pt-BR')
  );
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

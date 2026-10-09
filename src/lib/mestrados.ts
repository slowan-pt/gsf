import { supabase } from './supabase';
import { enviarAvisos } from './fluxoClasses';

/**
 * Mestrados: regras no banco (só o ADMIN TI edita), encaminhamento automático à diretoria
 * (gatilho no banco, sem ação do membro) e divisórias na faixa. Ver migration 137.
 */
export type SituacaoMestrado = 'rascunho' | 'ativo' | 'inativo';
export type EtapaMestrado = 'diretoria' | 'devolvido' | 'aprovado' | 'investido';

export interface Mestrado {
  id: string;
  codigo: string;
  nome: string;
  imagem_url: string | null;
  areas: string[];
  grupo_exibicao: string | null;
  ordem_exibicao: number;
  prioridade_exibicao: number;
  quantidade_exigida: number;
  fonte: string | null;
  edicao: string | null;
  observacoes: string | null;
  situacao: SituacaoMestrado;
  versao: number;
}

export interface EspecialidadeDoMestrado { id: string; obrigatoria: boolean }

export interface MestradoParaSalvar {
  id?: string | null;
  codigo: string;
  nome: string;
  imagem_url: string | null;
  areas: string[];
  grupo_exibicao: string | null;
  ordem_exibicao: number;
  prioridade_exibicao: number;
  quantidade_exigida: number;
  fonte: string | null;
  edicao: string | null;
  observacoes: string | null;
  situacao: SituacaoMestrado;
  especialidades: EspecialidadeDoMestrado[];
}

const CAMPOS = 'id,codigo,nome,imagem_url,areas,grupo_exibicao,ordem_exibicao,prioridade_exibicao,quantidade_exigida,fonte,edicao,observacoes,situacao,versao';

/** Lista para o ADMIN TI (o banco só devolve rascunhos e inativos para ele). */
export async function carregarMestrados(): Promise<Mestrado[]> {
  const { data, error } = await supabase.from('mestrados').select(CAMPOS).order('ordem_exibicao').order('nome');
  if (error) throw error;
  return (data ?? []) as Mestrado[];
}

export async function carregarEspecialidadesDoMestrado(mestradoId: string): Promise<EspecialidadeDoMestrado[]> {
  const { data, error } = await supabase
    .from('mestrado_especialidades').select('especialidade_id,obrigatoria').eq('mestrado_id', mestradoId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: String(r.especialidade_id), obrigatoria: !!r.obrigatoria }));
}

/** Salva regra e lista (por ID). O banco valida, registra a versão e reavalia os membros. */
export async function salvarMestrado(m: MestradoParaSalvar): Promise<{ id: string; versao: number; situacao: SituacaoMestrado; reavaliados: number }> {
  const { data, error } = await supabase.rpc('mestrado_salvar', { p: m });
  if (error) throw new Error(mensagemDoBanco(error.message));
  return data as any;
}

export async function validarMestrado(id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('mestrado_validar', { p_mestrado: id });
  if (error) throw new Error(mensagemDoBanco(error.message));
  return (data as string | null) ?? null;
}

function mensagemDoBanco(msg: string): string {
  return msg.replace(/^.*?(Somente|Nao e possivel|Nao e|O codigo|A quantidade|Informe|Sem permissao|Requisitos|Solicitacao|Esta solicitacao)/i, '$1');
}

// ---------------------------------------------------------------------------------------------
// Diretoria: fila de aprovação
// ---------------------------------------------------------------------------------------------
export interface ItemFilaMestrado {
  id: string;
  dbvId: number;
  dbvNome: string;
  unidadeNome: string | null;
  etapa: EtapaMestrado;
  mestrado: { id: string; codigo: string; nome: string; imagemUrl: string | null };
  versaoRegra: number;
  encaminhadoEm: string;
  reenviada: boolean;
  alertaRequisitos: boolean;
  motivo: string | null;
  especialidadesUsadas: { id: string; nome: string }[];
  requisitos: { total: number; necessarias: number; obrigatoriasOk: number; obrigatoriasTotal: number };
  historico: { evento: string; em: string; detalhes: any }[];
}

export async function carregarFilaMestrados(clubeId: number): Promise<ItemFilaMestrado[]> {
  const { data, error } = await supabase.rpc('mestrado_fila', { p_clube_id: clubeId });
  if (error) throw new Error(mensagemDoBanco(error.message));
  return ((data ?? []) as any[]).map((l) => ({
    id: l.id,
    dbvId: Number(l.dbv_id),
    dbvNome: l.dbv_nome ?? '',
    unidadeNome: l.unidade_nome ?? null,
    etapa: l.etapa,
    mestrado: { id: l.mestrado.id, codigo: l.mestrado.codigo, nome: l.mestrado.nome, imagemUrl: l.mestrado.imagem_url ?? null },
    versaoRegra: Number(l.versao_regra),
    encaminhadoEm: l.encaminhado_em,
    reenviada: !!l.reenviada,
    alertaRequisitos: !!l.alerta_requisitos,
    motivo: l.motivo ?? null,
    especialidadesUsadas: (l.especialidades_usadas ?? []) as { id: string; nome: string }[],
    requisitos: {
      total: Number(l.requisitos_atendidos?.total ?? 0), necessarias: Number(l.requisitos_atendidos?.necessarias ?? 0),
      obrigatoriasOk: Number(l.requisitos_atendidos?.obrigatorias_ok ?? 0), obrigatoriasTotal: Number(l.requisitos_atendidos?.obrigatorias_total ?? 0),
    },
    historico: (l.historico ?? []) as any[],
  }));
}

export async function aprovarMestrado(processoId: string): Promise<void> {
  const { data, error } = await supabase.rpc('mestrado_aprovar', { p_processo: processoId });
  if (error) throw new Error(mensagemDoBanco(error.message));
  await enviarAvisos((data as any)?.avisos);
}

export async function devolverMestrado(processoId: string, motivo: string, especialidadeIds: string[] = []): Promise<void> {
  const { data, error } = await supabase.rpc('mestrado_devolver', {
    p_processo: processoId, p_motivo: motivo, p_especialidades: especialidadeIds,
  });
  if (error) throw new Error(mensagemDoBanco(error.message));
  await enviarAvisos((data as any)?.avisos);
}

/** Entrega à diretoria o aviso das solicitações novas (o banco marca como avisado; nunca repete). */
export async function avisarDiretoriaMestrados(clubeId: number): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('mestrado_avisar_diretoria', { p_clube_id: clubeId });
    if (error) return;
    await enviarAvisos((data as any)?.avisos);
  } catch {
    // Aviso nunca atrapalha o uso do app.
  }
}

// ---------------------------------------------------------------------------------------------
// Faixa
// ---------------------------------------------------------------------------------------------
export interface MestradoNaFaixa {
  id: string;
  codigo: string;
  nome: string;
  imagemUrl: string | null;
  etapa: 'aprovado' | 'investido';
  aguardando: boolean;
  ordem: number;
}

export interface FaixaMestrados {
  mestrados: MestradoNaFaixa[];
  /** nome da especialidade (normalizado) → id do mestrado do bloco onde ela aparece */
  grupos: Record<string, string>;
}

/** Mesma chave do banco (sem acento, minúscula, espaços simples). */
export function chaveEspecialidade(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export async function carregarFaixaMestrados(dbvId: number): Promise<FaixaMestrados> {
  try {
    const { data, error } = await supabase.rpc('mestrado_faixa', { p_dbv: dbvId });
    if (error || !data) return { mestrados: [], grupos: {} };
    const d = data as any;
    return {
      mestrados: ((d.mestrados ?? []) as any[]).map((m) => ({
        id: m.id, codigo: m.codigo, nome: m.nome, imagemUrl: m.imagem_url ?? null,
        etapa: m.etapa, aguardando: !!m.aguardando, ordem: Number(m.ordem ?? 100),
      })),
      grupos: (d.grupos ?? {}) as Record<string, string>,
    };
  } catch {
    // Sem a migration 137 ou sem rede: a faixa segue só com as especialidades.
    return { mestrados: [], grupos: {} };
  }
}

/** Salva o tom de pele (1 a 8) no perfil do membro; null volta ao padrão. Falha de verdade se não salvar. */
export async function salvarTomPele(dbvId: number, tom: number | null): Promise<void> {
  let erro: { message: string } | null = null;
  try {
    const r = await supabase.rpc('faixa_definir_tom_pele', { p_dbv: dbvId, p_tom: tom });
    erro = r.error;
  } catch {
    throw new Error('Sem conexão com o servidor. A personalização não foi salva.');
  }
  if (erro) throw new Error(mensagemDoBanco(erro.message));
}

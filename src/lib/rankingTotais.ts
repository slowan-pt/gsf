import { supabase } from './supabase';
import { buscarPaginado } from './supabasePaginado';

/**
 * Totais de pontos por membro, somados NO BANCO (view `ranking_totais`).
 *
 * O caminho antigo baixava uma linha por lançamento do clube e somava no
 * aparelho: alguns milhares de linhas por abertura do ranking, crescendo todo
 * ano. A view devolve uma linha por membro/ano já somada, então o volume
 * passa a depender do número de membros, não do tamanho do histórico.
 *
 * Devolve `null` quando a view ainda não existe no banco (migration 111 não
 * aplicada). Quem chama cai no cálculo antigo nesse caso — assim o app
 * continua certo entre o deploy do código e a execução da migration.
 */
export async function carregarTotaisDoBanco(
  clubeId: number,
  anos?: number[],
): Promise<Map<number, number> | null> {
  try {
    const linhas = await buscarPaginado<{ dbv_id: number; ano: number; total: number | string }>(
      (q) => {
        const base = q.eq('clube_id', clubeId);
        return anos && anos.length > 0 ? base.in('ano', anos) : base;
      },
      'ranking_totais',
      'dbv_id, ano, total',
    );

    const totais = new Map<number, number>();
    for (const linha of linhas) {
      const dbvId = Number(linha.dbv_id);
      totais.set(dbvId, (totais.get(dbvId) ?? 0) + (Number(linha.total) || 0));
    }
    return totais;
  } catch (erro: any) {
    if (viewAindaNaoExiste(erro)) return null;
    throw erro;
  }
}

/**
 * A view some do banco em dois cenários: migration 111 ainda não rodada, ou
 * um ambiente (dev/clone) criado antes dela. Nos dois casos o certo é voltar
 * pro cálculo no cliente, não quebrar a tela.
 */
function viewAindaNaoExiste(erro: any): boolean {
  const codigo = String(erro?.code ?? '');
  const mensagem = String(erro?.message ?? '').toLowerCase();
  return (
    codigo === '42P01' || // undefined_table
    codigo === 'PGRST205' || // PostgREST: tabela/view não encontrada no schema
    mensagem.includes('ranking_totais')
  );
}

/** Só pra teste manual no console: confere se a view está ativa. */
export async function viewRankingDisponivel(): Promise<boolean> {
  const { error } = await supabase.from('ranking_totais').select('dbv_id').limit(1);
  return !error;
}

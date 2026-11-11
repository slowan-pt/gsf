import { avisar } from '../stores/avisoStore';
import { codigosDasEspecialidades } from './autorizacaoInvestidura';
import { entregarXlsx, logosDoRelatorio } from './excelRelatorio';
import type { ItemAguardando } from './investidura';
import { gerarExcelInvestidura, montarPlanilha, nomeArquivoExcel } from './excelInvestituraNucleo';

/**
 * Excel de investidura com valores (modelo da aba "Investidura" da planilha do clube): itens nas linhas, membros nas
 * colunas, preços do Bazar dos Desbravadores e os logos do clube e dos Desbravadores. A montagem do arquivo fica em
 * excelInvestituraNucleo.ts; os logos e a entrega (download/compartilhar), em excelRelatorio.ts.
 */

/** Gera e entrega o Excel com os itens aguardando investidura (todos os que forem passados). */
export async function exportarExcelInvestidura(itens: ItemAguardando[]): Promise<void> {
  if (itens.length === 0) { avisar('Nenhum item aguardando investidura.', 'info', 'Excel'); return; }
  try {
    const [logos, codigos] = await Promise.all([logosDoRelatorio(), codigosDasEspecialidades()]);
    const plano = montarPlanilha(itens, codigos);
    const total = plano.grupos.reduce((s, g) => s + g.linhas.reduce((n, l) => n + l.marcas.filter(Boolean).length, 0), 0);
    const bytes = gerarExcelInvestidura(plano, {
      clube: logos.nomeClube,
      logo: logos.logoClube,
      logoDbv: logos.logoDbv,
      subtitulo: `Investidura · ${plano.membros.length} ${plano.membros.length === 1 ? 'membro' : 'membros'} · ${total} ${total === 1 ? 'item' : 'itens'}`,
    });
    await entregarXlsx(bytes, nomeArquivoExcel(logos.nomeClube));
  } catch (e: any) {
    avisar(e?.message ?? 'Não foi possível gerar o Excel.', 'erro', 'Excel');
  }
}

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { baixarRelatorioXlsx } from './excelRelatorio';
import { avisar } from '../stores/avisoStore';
import { injetarMarca, obterMarcaClube } from './marcaRelatorio';
import { baixarPdfDeHtml } from './pdfWeb';
import { htmlComTitulo, nomeArquivoPdf, renomearPdf } from './pdfArquivo';
import { agruparPorItem, totais, type ItemAguardando, type ItemInvestido } from './investidura';

export type FormatoRelatorio = 'pdf' | 'excel';

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatarDataBR(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function montarHTML(titulo: string, subtitulo: string, itens: ItemAguardando[]): string {
  const t = totais(itens);
  const grupos = agruparPorItem(itens);
  const linhas = grupos.map((g) => `
    <tr>
      <td>${g.tipo === 'classe' ? 'Classe' : 'Especialidade'}</td>
      <td><b>${esc(g.nome)}</b></td>
      <td class="num">${g.itens.length}</td>
      <td>${g.itens.map((i) => `${esc(i.membroNome)} <span class="un">(${esc(i.unidadeNome)})</span>`).join('; ')}</td>
    </tr>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <style>
      @page { margin: 18px; size: A4 portrait; }
      body { font-family: Arial, sans-serif; color: #1f1b33; }
      h1 { margin: 0; color: #4b2bb0; font-size: 20px; }
      .sub { margin: 6px 0 12px; color: #667; font-size: 12px; }
      .resumo { display: flex; gap: 10px; margin: 0 0 14px; }
      .resumo div { flex: 1; border: 1px solid #d8dee6; border-radius: 8px; padding: 8px; text-align: center; }
      .resumo b { display: block; font-size: 18px; color: #4b2bb0; }
      .resumo span { font-size: 10px; color: #667; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #4b2bb0; color: #fff; text-align: left; padding: 6px; }
      td { border: 1px solid #d8dee6; padding: 6px; vertical-align: top; }
      td.num { text-align: center; font-weight: 700; width: 36px; }
      .un { color: #667; font-size: 10px; }
      tr:nth-child(even) td { background: #f5f3fb; }
    </style></head><body>
    <h1>${esc(titulo)}</h1>
    <div class="sub">${esc(subtitulo)} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    <div class="resumo">
      <div><b>${t.especialidades}</b><span>Especialidades</span></div>
      <div><b>${t.classes}</b><span>Classes</span></div>
      <div><b>${t.total}</b><span>Itens no total</span></div>
      <div><b>${t.membros}</b><span>Membros</span></div>
    </div>
    <table>
      <thead><tr><th>Tipo</th><th>Item</th><th>Qtd.</th><th>Membros</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="4">Nenhum item.</td></tr>'}</tbody>
    </table></body></html>`;
}

export async function abrirPDF(titulo: string, htmlOriginal: string) {
  const nomePdf = nomeArquivoPdf(titulo);
  const html = htmlComTitulo(injetarMarca(htmlOriginal, await obterMarcaClube(), titulo), nomePdf);
  if (Platform.OS === 'web') {
    // Na web gera o arquivo .pdf e baixa direto (sem a janela de impressão).
    await baixarPdfDeHtml(html, titulo);
    return;
  }
  const { uri: uriOriginal } = await Print.printToFileAsync({ html });
  const uri = await renomearPdf(uriOriginal, titulo);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: titulo, UTI: 'com.adobe.pdf' });
  } else {
    avisar(uri, 'sucesso', 'PDF gerado');
  }
}

async function baixarExcel(nomeArquivo: string, itens: ItemAguardando[], colunaExtra?: (i: ItemAguardando) => string, rotuloExtra?: string) {
  const t = totais(itens);
  await baixarRelatorioXlsx(nomeArquivo, [
    {
      nome: 'Resumo',
      blocos: [
        { tipo: 'resumo', titulo: 'Resumo', pares: [['Especialidades', t.especialidades], ['Classes', t.classes], ['Itens no total', t.total], ['Membros', t.membros]] },
        {
          tipo: 'tabela', titulo: 'Quantidade de cada item',
          colunas: [{ titulo: 'Tipo', largura: 16 }, { titulo: 'Item', largura: 38 }, { titulo: 'Quantidade', formato: 'inteiro', largura: 13 }, { titulo: 'Membros', largura: 90 }],
          linhas: agruparPorItem(itens).map((g) => [
            g.tipo === 'classe' ? 'Classe' : 'Especialidade', g.nome, g.itens.length,
            g.itens.map((i) => `${i.membroNome} (${i.unidadeNome})`).join('; '),
          ]),
        },
      ],
    },
    {
      nome: 'Detalhe',
      blocos: [{
        tipo: 'tabela',
        colunas: [{ titulo: 'Tipo', largura: 16 }, { titulo: 'Item', largura: 38 }, { titulo: 'Membro', largura: 34 }, { titulo: 'Unidade', largura: 20 }, ...(rotuloExtra ? [{ titulo: rotuloExtra, largura: 18, formato: 'centro' as const }] : [])],
        linhas: itens.map((i) => [i.tipo === 'classe' ? 'Classe' : 'Especialidade', i.nome, i.membroNome, i.unidadeNome, ...(colunaExtra ? [colunaExtra(i)] : [])]),
      }],
    },
  ]);
}

/** "Aptos a receber Classes e Especialidades": a lista da próxima investidura. */
export async function exportarAptosAReceber(itens: ItemAguardando[], formato: FormatoRelatorio) {
  if (itens.length === 0) { avisar('Nenhum item aguardando investidura.', 'info', 'Relatório'); return; }
  const titulo = 'Aptos a receber Classes e Especialidades';
  try {
    if (formato === 'excel') await baixarExcel(titulo, itens);
    else await abrirPDF(titulo, montarHTML(titulo, 'Concluídos e ainda não investidos', itens));
  } catch (e: any) {
    avisar(e?.message ?? 'Não foi possível gerar o relatório.', 'erro', 'Relatório');
  }
}

/** "Investidos em …": o que foi entregue numa investidura. */
export async function exportarInvestidos(itens: ItemInvestido[], dataIso: string | null, formato: FormatoRelatorio) {
  if (itens.length === 0) { avisar('Nenhum item investido para exportar.', 'info', 'Relatório'); return; }
  const quando = dataIso ? formatarDataBR(dataIso) : 'todas as datas';
  const titulo = `Investidos em ${quando}`;
  try {
    if (formato === 'excel') await baixarExcel(titulo.replace(/\//g, '-'), itens, (i) => formatarDataBR((i as ItemInvestido).entregueEm), 'Data da investidura');
    else await abrirPDF(titulo, montarHTML(titulo, 'Itens entregues na investidura', itens));
  } catch (e: any) {
    avisar(e?.message ?? 'Não foi possível gerar o relatório.', 'erro', 'Relatório');
  }
}

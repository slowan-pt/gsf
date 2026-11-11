import { avisar } from '../stores/avisoStore';
import { baixarRelatorioXlsx } from './excelRelatorio';
import type { FormatoColuna } from './xlsxRelatorioNucleo';
import { abrirPDF, type FormatoRelatorio } from './relatorioInvestidura';
import {
  CABECALHO_PLANILHA_PATRIMONIO, dataIsoParaBr, formatarMoeda, linhasPlanilhaPatrimonio, resumoPorDepartamento,
  rotuloCondicao, rotuloStatusPatrimonio, totaisPatrimonio, valorUnitario, itensDoRelatorio,
  type ItemPatrimonio, type SituacaoRelatorioPatrimonio,
} from './patrimonioNucleo';

/**
 * Relatórios do Patrimônio (aba Patrimônio em Relatórios):
 *  - Listagem completa: todos os campos de cada item, em PDF (paisagem) ou planilha Excel;
 *  - Listagem com fotos: PDF com a foto de cada item ao lado dos dados.
 */

export interface OpcoesRelatorioPatrimonio {
  situacao: SituacaoRelatorioPatrimonio;
  departamento: string;
}

const ROTULO_SITUACAO: Record<SituacaoRelatorioPatrimonio, string> = { ativos: 'Itens ativos', todos: 'Todos os itens (inclui baixados)', baixados: 'Itens baixados' };

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const urlSegura = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

function subtitulo(op: OpcoesRelatorioPatrimonio) {
  return `${ROTULO_SITUACAO[op.situacao]}${op.departamento ? ` · ${op.departamento}` : ''} · Gerado em ${new Date().toLocaleDateString('pt-BR')}`;
}

function blocoResumo(itens: ItemPatrimonio[]): string {
  const t = totaisPatrimonio(itens);
  return `<div class="resumo">
    <div><b>${t.quantidadeItens}</b><span>Itens ativos</span></div>
    <div><b>${t.quantidadePecas}</b><span>Peças</span></div>
    <div><b>${esc(formatarMoeda(t.valorMercado))}</b><span>Valor de mercado</span></div>
  </div>`;
}

const ESTILO_BASE = `
  body { font-family: Arial, sans-serif; color: #1f1b33; }
  h1 { margin: 0; color: #4b2bb0; font-size: 20px; }
  .sub { margin: 6px 0 12px; color: #667; font-size: 12px; }
  .resumo { display: flex; gap: 10px; margin: 0 0 14px; }
  .resumo div { flex: 1; border: 1px solid #d8dee6; border-radius: 8px; padding: 8px; text-align: center; }
  .resumo b { display: block; font-size: 16px; color: #4b2bb0; }
  .resumo span { font-size: 10px; color: #667; }
  .baixado { opacity: .65; }
`;

function htmlCompleto(titulo: string, op: OpcoesRelatorioPatrimonio, itens: ItemPatrimonio[]): string {
  const ordenados = [...itens].sort((a, b) => a.codigo - b.codigo);
  const linhas = ordenados.map((i) => `
    <tr class="${i.status === 'baixado' ? 'baixado' : ''}">
      <td class="n">${i.codigo}</td>
      <td>${esc(rotuloStatusPatrimonio(i.status))}${i.segurar ? '<br><span class="m">Segurado</span>' : ''}</td>
      <td><b>${esc(i.descricao)}</b>${i.fixada_parede ? `<br><span class="m">Fixada na parede${i.local_fixacao ? ` · ${esc(i.local_fixacao)}` : ''}</span>` : ''}${i.status === 'baixado' ? `<br><span class="m">Baixa ${esc(dataIsoParaBr(i.data_baixa))}${i.motivo_baixa ? ` · ${esc(i.motivo_baixa)}` : ''}</span>` : ''}</td>
      <td>${esc(i.departamento)}</td>
      <td>${esc(i.tipo)}</td>
      <td>${esc([i.marca, i.modelo].filter(Boolean).join(' / '))}</td>
      <td>${esc(i.serie)}</td>
      <td class="n">${i.quantidade}</td>
      <td>${esc(rotuloCondicao(i.condicao))}</td>
      <td>${esc(dataIsoParaBr(i.data_aquisicao))}</td>
      <td class="v">${esc(formatarMoeda(i.valor_aquisicao))}</td>
      <td class="v">${esc(formatarMoeda(i.valor_mercado))}</td>
      <td class="v">${esc(formatarMoeda(valorUnitario(i.valor_mercado, i.quantidade)))}</td>
    </tr>`).join('');
  const resumoDep = resumoPorDepartamento(itens);
  const tabelaDep = resumoDep.length > 1 ? `
    <table class="dep"><thead><tr><th>Departamento</th><th>Itens</th><th>Peças</th><th>Valor de mercado</th></tr></thead><tbody>
      ${resumoDep.map((d) => `<tr><td>${esc(d.departamento)}</td><td class="n">${d.itens}</td><td class="n">${d.pecas}</td><td class="v">${esc(formatarMoeda(d.valorMercado))}</td></tr>`).join('')}
    </tbody></table>` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <style>
      @page { margin: 14px; size: A4 landscape; }
      ${ESTILO_BASE}
      table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 14px; }
      th { background: #4b2bb0; color: #fff; text-align: left; padding: 5px; }
      td { border: 1px solid #d8dee6; padding: 4px 5px; vertical-align: top; }
      td.n { text-align: center; } td.v { text-align: right; white-space: nowrap; }
      .m { color: #667; font-size: 8.5px; }
      tr:nth-child(even) td { background: #f5f3fb; }
      thead { display: table-header-group; } tr { page-break-inside: avoid; }
      table.dep { width: 60%; font-size: 10.5px; }
    </style></head><body>
    <h1>${esc(titulo)}</h1>
    <div class="sub">${esc(subtitulo(op))}</div>
    ${blocoResumo(itens)}
    ${tabelaDep}
    <table>
      <thead><tr><th>Cód.</th><th>Status</th><th>Descrição</th><th>Departamento</th><th>Tipo</th><th>Marca / Modelo</th><th>Série</th><th>Qtd.</th><th>Condição</th><th>Aquisição</th><th>Valor aquis.</th><th>Valor mercado</th><th>Unitário</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="13">Nenhum item.</td></tr>'}</tbody>
    </table></body></html>`;
}

function htmlComFotos(titulo: string, op: OpcoesRelatorioPatrimonio, itens: ItemPatrimonio[]): string {
  const ordenados = [...itens].sort((a, b) => a.codigo - b.codigo);
  const cartoes = ordenados.map((i) => {
    const foto = urlSegura(i.foto_url);
    const campos: [string, string][] = [
      ['Departamento', i.departamento ?? ''], ['Tipo', i.tipo ?? ''], ['Marca / Modelo', [i.marca, i.modelo].filter(Boolean).join(' / ')],
      ['Série', i.serie ?? ''], ['Quantidade', String(i.quantidade)], ['Condição', rotuloCondicao(i.condicao)],
      ['Aquisição', dataIsoParaBr(i.data_aquisicao)], ['Valor de aquisição', formatarMoeda(i.valor_aquisicao)],
      ['Valor de mercado', formatarMoeda(i.valor_mercado)], ['Valor unitário', formatarMoeda(valorUnitario(i.valor_mercado, i.quantidade))],
    ];
    const extras = [i.fixada_parede ? `Fixada na parede${i.local_fixacao ? ` (${i.local_fixacao})` : ''}` : '', i.segurar ? 'Segurado' : ''].filter(Boolean).join(' · ');
    return `<div class="item ${i.status === 'baixado' ? 'baixado' : ''}">
      <div class="foto">${foto ? `<img src="${esc(foto)}" alt="Foto do item ${i.codigo}" />` : '<div class="semfoto">Sem foto</div>'}</div>
      <div class="dados">
        <div class="titulo"><span class="cod">#${i.codigo}</span> ${esc(i.descricao)} <span class="st">${esc(rotuloStatusPatrimonio(i.status))}</span></div>
        <table>${campos.filter(([, v]) => v).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
        ${extras ? `<div class="extra">${esc(extras)}</div>` : ''}
        ${i.status === 'baixado' ? `<div class="extra">Baixa em ${esc(dataIsoParaBr(i.data_baixa))}${i.motivo_baixa ? ` · ${esc(i.motivo_baixa)}` : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <style>
      @page { margin: 16px; size: A4 portrait; }
      ${ESTILO_BASE}
      .item { display: flex; gap: 12px; border: 1px solid #d8dee6; border-radius: 10px; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; }
      .foto { width: 150px; flex: none; }
      .foto img { width: 150px; height: 130px; object-fit: cover; border-radius: 8px; border: 1px solid #d8dee6; }
      .semfoto { width: 150px; height: 130px; border-radius: 8px; background: #efeaf9; color: #8a7bb0; display: flex; align-items: center; justify-content: center; font-size: 11px; }
      .dados { flex: 1; min-width: 0; }
      .titulo { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
      .cod { color: #4b2bb0; } .st { font-size: 9px; font-weight: 700; background: #ebe0fc; color: #4b2bb0; border-radius: 8px; padding: 2px 6px; margin-left: 6px; }
      table { border-collapse: collapse; font-size: 10px; width: 100%; }
      th { text-align: left; color: #667; font-weight: 600; padding: 1px 8px 1px 0; width: 38%; white-space: nowrap; }
      td { padding: 1px 0; }
      .extra { margin-top: 4px; font-size: 10px; color: #4b2bb0; font-weight: 700; }
    </style></head><body>
    <h1>${esc(titulo)}</h1>
    <div class="sub">${esc(subtitulo(op))}</div>
    ${blocoResumo(itens)}
    ${cartoes || '<p>Nenhum item.</p>'}
    </body></html>`;
}

async function baixarPlanilha(titulo: string, op: OpcoesRelatorioPatrimonio, itens: ItemPatrimonio[]) {
  const t = totaisPatrimonio(itens);
  const sub = subtitulo(op);
  // Colunas da listagem completa (ver CABECALHO_PLANILHA_PATRIMONIO): números como números, dinheiro em R$.
  const formatos: Record<string, FormatoColuna> = {
    'Código': 'centro', 'Status': 'centro', 'Quantidade': 'inteiro', 'Condição': 'centro', 'Fixada na parede': 'centro', 'Segurado': 'centro',
    'Data de aquisição': 'centro', 'Valor de aquisição (R$)': 'dinheiro', 'Valor de mercado (R$)': 'dinheiro', 'Valor unitário (R$)': 'dinheiro', 'Data de baixa': 'centro',
  };
  const larguras: Record<string, number> = { 'Descrição': 38, 'Local na parede': 28, 'Motivo da baixa': 34, 'Foto': 40, 'Departamento': 18, 'Tipo': 18, 'Marca': 16, 'Modelo': 16, 'Série': 16 };
  await baixarRelatorioXlsx(titulo, [
    {
      nome: 'Resumo', subtitulo: sub,
      blocos: [
        {
          tipo: 'resumo', titulo: 'Totais',
          pares: [['Itens ativos', t.quantidadeItens], ['Peças', t.quantidadePecas], ['Valor de mercado', t.valorMercado]],
          formato: ['inteiro', 'inteiro', 'dinheiro'],
        },
        {
          tipo: 'tabela', titulo: 'Por departamento',
          colunas: [{ titulo: 'Departamento', largura: 30 }, { titulo: 'Itens', formato: 'inteiro', largura: 12 }, { titulo: 'Peças', formato: 'inteiro', largura: 12 }, { titulo: 'Valor de mercado (R$)', formato: 'dinheiro', largura: 24 }],
          linhas: resumoPorDepartamento(itens).map((d) => [d.departamento, d.itens, d.pecas, d.valorMercado]),
        },
      ],
    },
    {
      nome: 'Itens', subtitulo: sub,
      blocos: [{
        tipo: 'tabela',
        colunas: CABECALHO_PLANILHA_PATRIMONIO.map((c) => ({ titulo: c, formato: formatos[c], largura: larguras[c] })),
        linhas: linhasPlanilhaPatrimonio(itens),
      }],
    },
  ]);
}

/** Listagem completa (todos os campos), em PDF ou Excel. */
export async function exportarPatrimonioCompleto(todos: ItemPatrimonio[], op: OpcoesRelatorioPatrimonio, formato: FormatoRelatorio) {
  const itens = itensDoRelatorio(todos, op.situacao, op.departamento);
  if (itens.length === 0) { avisar('Nenhum item para exportar com esses filtros.', 'info', 'Patrimônio'); return; }
  const titulo = 'Patrimônio — listagem completa';
  try {
    if (formato === 'excel') await baixarPlanilha(titulo, op, itens);
    else await abrirPDF(titulo, htmlCompleto(titulo, op, itens));
  } catch (e: any) {
    avisar(e?.message ?? 'Não foi possível gerar o relatório.', 'erro', 'Patrimônio');
  }
}

/** Listagem com a foto de cada item (PDF). Precisa de internet para buscar as fotos. */
export async function exportarPatrimonioComFotos(todos: ItemPatrimonio[], op: OpcoesRelatorioPatrimonio) {
  const itens = itensDoRelatorio(todos, op.situacao, op.departamento);
  if (itens.length === 0) { avisar('Nenhum item para exportar com esses filtros.', 'info', 'Patrimônio'); return; }
  const titulo = 'Patrimônio — listagem com fotos';
  try {
    await abrirPDF(titulo, htmlComFotos(titulo, op, itens));
  } catch (e: any) {
    avisar(e?.message ?? 'Não foi possível gerar o relatório.', 'erro', 'Patrimônio');
  }
}

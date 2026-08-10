import {
  carregarCatalogoClasses,
  carregarProgressoClube,
  carregarValidacaoClasses,
  corProgresso,
  type RequisitoCatalogo,
} from './classesRequisitos';

export type SituacaoClasse = 'nao_iniciada' | 'em_andamento' | 'aguardando_validacao' | 'validada';

export const SITUACAO_LABEL: Record<SituacaoClasse, string> = {
  nao_iniciada: 'Não iniciada',
  em_andamento: 'Em andamento',
  aguardando_validacao: 'Aguardando validação da diretoria',
  validada: 'Classe validada',
};

function situacaoDe(pct: number, aguardando: boolean, validada: boolean): SituacaoClasse {
  if (validada) return 'validada';
  if (aguardando || pct >= 100) return 'aguardando_validacao';
  if (pct > 0) return 'em_andamento';
  return 'nao_iniciada';
}

export interface MembroRelatorioClasses {
  id: number;
  nome: string;
  unidade_nome?: string | null;
}

export interface FiltroRelatorioClasses {
  clubeId: number;
  /** clube = todos os membros; unidades = só as unidades escolhidas; membros = seleção manual. */
  escopo: 'clube' | 'unidades' | 'membros';
  unidades?: string[];
  membroIds?: number[];
  /** Vazio = todas as classes do catálogo. */
  classes?: string[];
  /** Inclui a listagem nominal de requisitos concluídos e pendentes. */
  detalhado: boolean;
}

export interface LinhaRelatorioClasses {
  membro: string;
  unidade: string;
  classe: string;
  total: number;
  concluidos: number;
  pct: number;
  situacao: SituacaoClasse;
  listaConcluidos: string[];
  listaPendentes: string[];
}

function rotulo(req: RequisitoCatalogo) {
  return `${req.codigo}${req.subitem ? `.${req.subitem}` : ''} ${req.texto}`;
}

export function filtrarMembros(
  membros: MembroRelatorioClasses[],
  filtro: FiltroRelatorioClasses
): MembroRelatorioClasses[] {
  if (filtro.escopo === 'unidades') {
    const alvo = new Set(filtro.unidades ?? []);
    if (alvo.size === 0) return [];
    return membros.filter((m) => alvo.has(m.unidade_nome || 'Sem unidade'));
  }
  if (filtro.escopo === 'membros') {
    const alvo = new Set(filtro.membroIds ?? []);
    if (alvo.size === 0) return [];
    return membros.filter((m) => alvo.has(m.id));
  }
  return membros;
}

export async function gerarDadosRelatorioClasses(
  membros: MembroRelatorioClasses[],
  filtro: FiltroRelatorioClasses
): Promise<LinhaRelatorioClasses[]> {
  const alvo = filtrarMembros(membros, filtro);
  if (alvo.length === 0) return [];

  const catalogo = await carregarCatalogoClasses();
  const classesFiltro = new Set(filtro.classes ?? []);
  const pontuaveis = catalogo.filter(
    (r) => r.pontua && (classesFiltro.size === 0 || classesFiltro.has(r.classe_nome))
  );
  if (pontuaveis.length === 0) return [];

  const [progresso, validacoes] = await Promise.all([
    carregarProgressoClube(filtro.clubeId, alvo.map((m) => m.id)),
    carregarValidacaoClasses(filtro.clubeId, alvo.map((m) => m.id)),
  ]);
  const porMembro = new Map<number, Set<number>>();
  for (const p of progresso) {
    if (!porMembro.has(p.dbv_id)) porMembro.set(p.dbv_id, new Set());
    porMembro.get(p.dbv_id)!.add(p.requisito_id);
  }

  const classes = Array.from(new Set(pontuaveis.map((r) => r.classe_nome)));
  const linhas: LinhaRelatorioClasses[] = [];

  for (const membro of alvo) {
    const feitos = porMembro.get(membro.id) ?? new Set<number>();
    for (const classe of classes) {
      const daClasse = pontuaveis.filter((r) => r.classe_nome === classe);
      const concluidos = daClasse.filter((r) => feitos.has(r.id));
      const pendentes = daClasse.filter((r) => !feitos.has(r.id));
      const pct = daClasse.length > 0 ? Math.round((concluidos.length / daClasse.length) * 100) : 0;
      const validacao = validacoes.get(`${membro.id}|${classe}`);
      linhas.push({
        membro: membro.nome,
        unidade: membro.unidade_nome || 'Sem unidade',
        classe,
        total: daClasse.length,
        concluidos: concluidos.length,
        pct,
        situacao: situacaoDe(pct, !!validacao?.aguardandoValidacao, !!validacao?.validada),
        listaConcluidos: filtro.detalhado ? concluidos.map(rotulo) : [],
        listaPendentes: filtro.detalhado ? pendentes.map(rotulo) : [],
      });
    }
  }

  return linhas.sort(
    (a, b) =>
      a.unidade.localeCompare(b.unidade, 'pt-BR') ||
      a.membro.localeCompare(b.membro, 'pt-BR') ||
      a.classe.localeCompare(b.classe, 'pt-BR')
  );
}

function escapar(v: string) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const COR_SITUACAO: Record<SituacaoClasse, string> = {
  nao_iniciada: '#94a3b8',
  em_andamento: '#0ea5e9',
  aguardando_validacao: '#d97706',
  validada: '#16a34a',
};

export function montarHTMLClasses(titulo: string, linhas: LinhaRelatorioClasses[], detalhado: boolean) {
  const membros = new Set(linhas.map((l) => l.membro)).size;
  const mediaPct = linhas.length > 0 ? Math.round(linhas.reduce((s, l) => s + l.pct, 0) / linhas.length) : 0;

  const corpo = linhas
    .map((l) => {
      const cor = corProgresso(l.pct);
      const corSit = COR_SITUACAO[l.situacao];
      const detalhes = detalhado
        ? `<tr class="det"><td colspan="7">
             ${l.listaConcluidos.length ? `<p class="ok"><b>Concluídos:</b> ${escapar(l.listaConcluidos.join(' · '))}</p>` : ''}
             ${l.listaPendentes.length ? `<p class="pend"><b>Pendentes:</b> ${escapar(l.listaPendentes.join(' · '))}</p>` : ''}
           </td></tr>`
        : '';
      return `<tr>
          <td>${escapar(l.membro)}</td>
          <td>${escapar(l.unidade)}</td>
          <td>${escapar(l.classe)}</td>
          <td class="c">${l.concluidos}/${l.total}</td>
          <td class="c">${Math.max(0, l.total - l.concluidos)}</td>
          <td class="c"><span class="pill" style="background:${cor}1f;color:${cor}">${l.pct}%</span></td>
          <td class="c"><span class="pill" style="background:${corSit}1f;color:${corSit}">${escapar(SITUACAO_LABEL[l.situacao])}</span></td>
        </tr>${detalhes}`;
    })
    .join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
    <style>
      @page{margin:18px;size:A4 landscape}
      body{font-family:Arial,sans-serif;color:#1f2933;font-size:11px}
      h1{margin:0;color:#1a3a5c;font-size:20px}
      .sub{margin:4px 0 14px;color:#667;font-size:11px}
      table{width:100%;border-collapse:collapse}
      th{background:#1a3a5c;color:#fff;text-align:left;padding:6px 8px;font-size:10px}
      td{border-bottom:1px solid #e4eaf1;padding:6px 8px;vertical-align:top}
      td.c{text-align:center;white-space:nowrap}
      .pill{padding:2px 8px;border-radius:999px;font-weight:bold;font-size:10px}
      tr.det td{background:#f8fafc;font-size:9.5px;color:#52606d;border-bottom:2px solid #e4eaf1}
      tr.det p{margin:2px 0}
      .ok b{color:#16a34a}
      .pend b{color:#c2410c}
    </style></head><body>
    <h1>${escapar(titulo)}</h1>
    <p class="sub">${membros} membro(s) · ${linhas.length} linha(s) · média de conclusão ${mediaPct}% · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
    <table>
      <thead><tr><th>Membro</th><th>Unidade</th><th>Classe</th><th>Concluídos</th><th>Faltam</th><th>%</th><th>Situação</th></tr></thead>
      <tbody>${corpo || '<tr><td colspan="7">Nenhum resultado para os filtros escolhidos.</td></tr>'}</tbody>
    </table>
  </body></html>`;
}

export function montarPlanilhaClasses(linhas: LinhaRelatorioClasses[], detalhado: boolean) {
  const cabecalho = ['Membro', 'Unidade', 'Classe', 'Concluídos', 'Total', 'Faltam', '% Concluído', 'Situação'];
  if (detalhado) cabecalho.push('Requisitos concluídos', 'Requisitos pendentes');
  return [
    cabecalho,
    ...linhas.map((l) => {
      const base: (string | number)[] = [
        l.membro,
        l.unidade,
        l.classe,
        l.concluidos,
        l.total,
        Math.max(0, l.total - l.concluidos),
        `${l.pct}%`,
        SITUACAO_LABEL[l.situacao],
      ];
      if (detalhado) base.push(l.listaConcluidos.join(' · '), l.listaPendentes.join(' · '));
      return base;
    }),
  ];
}

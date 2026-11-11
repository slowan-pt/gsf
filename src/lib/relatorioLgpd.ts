import { avisar } from '../stores/avisoStore';
import { baixarRelatorioXlsx } from './excelRelatorio';
import { abrirPDF, type FormatoRelatorio } from './relatorioInvestidura';

export interface AceiteLgpdRelatorio {
  nome: string;
  email: string;
  perfil: string;
  accepted_at: string;
  /** Versão do termo que a pessoa aceitou (quando conhecida). */
  versao?: number | null;
}

interface Opcoes {
  tituloTermo: string;
  versaoAtual?: number | null;
  /** Texto do filtro aplicado na tela (busca), se houver. */
  filtro?: string;
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const quando = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR');
};

function montarHTML(aceites: AceiteLgpdRelatorio[], o: Opcoes): string {
  const naAtual = o.versaoAtual ? aceites.filter((a) => a.versao === o.versaoAtual).length : null;
  const linhas = aceites.map((a, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td><b>${esc(a.nome || a.email)}</b></td>
      <td>${esc(a.email)}</td>
      <td>${esc(a.perfil)}</td>
      <td class="num">${a.versao ? `v${a.versao}` : '-'}</td>
      <td>${esc(quando(a.accepted_at))}</td>
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
      td.num { text-align: center; width: 36px; }
      tr:nth-child(even) td { background: #f5f3fb; }
    </style></head><body>
    <h1>Aceites do termo LGPD</h1>
    <div class="sub">${esc(o.tituloTermo)}${o.versaoAtual ? ` · versão vigente v${o.versaoAtual}` : ''}${o.filtro ? ` · filtro: “${esc(o.filtro)}”` : ''} · Gerado em ${new Date().toLocaleString('pt-BR')}</div>
    <div class="resumo">
      <div><b>${aceites.length}</b><span>Aceites listados</span></div>
      ${naAtual !== null ? `<div><b>${naAtual}</b><span>Na versão vigente</span></div>` : ''}
      <div><b>${new Set(aceites.map((a) => a.perfil)).size}</b><span>Perfis diferentes</span></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Versão</th><th>Data e hora do aceite</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="6">Nenhum aceite.</td></tr>'}</tbody>
    </table></body></html>`;
}

async function baixarExcel(aceites: AceiteLgpdRelatorio[], o: Opcoes) {
  await baixarRelatorioXlsx(`Aceites do termo LGPD — ${o.tituloTermo}`, [{
    nome: 'Aceites',
    blocos: [{
      tipo: 'tabela',
      colunas: [
        { titulo: '#', formato: 'centro', largura: 6 }, { titulo: 'Nome', largura: 38 }, { titulo: 'E-mail', largura: 36 },
        { titulo: 'Perfil', largura: 24 }, { titulo: 'Versão do termo', formato: 'centro', largura: 17 }, { titulo: 'Data e hora do aceite', formato: 'centro', largura: 24 },
      ],
      linhas: aceites.map((a, i) => [i + 1, a.nome || a.email, a.email, a.perfil, a.versao ? `v${a.versao}` : '', quando(a.accepted_at)]),
    }],
  }], 'Aceites-LGPD');
}

/** Relatório de quem aceitou o termo LGPD, com data/hora, perfil e versão do termo. */
export async function exportarAceitesLgpd(aceites: AceiteLgpdRelatorio[], formato: FormatoRelatorio, opcoes: Opcoes) {
  if (aceites.length === 0) { avisar('Nenhum aceite para exportar.', 'info', 'Relatório'); return; }
  try {
    if (formato === 'excel') await baixarExcel(aceites, opcoes);
    else await abrirPDF('Aceites do termo LGPD', montarHTML(aceites, opcoes));
  } catch (e: any) {
    avisar(e?.message ?? 'Não foi possível gerar o relatório.', 'erro', 'Relatório');
  }
}

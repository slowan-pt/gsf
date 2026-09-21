import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';
import { buscarPaginado } from './supabasePaginado';
import { linhasCategoriasPontuacao } from './categoriasPontuacao';
import { formatarDataExtrato, type LinhaExtrato, type RegistroDia } from './extratoMembro';
import { uriParaUploadBody, type UploadBody } from './storageUpload';

const BUCKET = 'ranking_backups';
const PONTOS_FALLBACK = { presenca: 25, pontualidade: 100, material: 25, uniforme: 25 };

export interface RankingBackupSalvo {
  id: string;
  ano: number;
  nome_arquivo: string;
  arquivo_path: string;
  total_membros: number;
  total_pontos: number;
  created_at: string;
}

interface MembroBackup {
  id: number;
  nome: string;
  unidade: string;
  total: number;
  dias: RegistroDia[];
}

interface UnidadeBackup {
  unidade: string;
  data: string;
  descricao: string;
  pontos: number;
}

interface DadosBackup {
  clubeNome: string;
  ano: number;
  geradoEm: string;
  membros: MembroBackup[];
  unidades: UnidadeBackup[];
  totalPontos: number;
}

function chave(dbvId: number, data: string) {
  return `${dbvId}|${data}`;
}

function escaparHtml(valor: unknown) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatarPontos(valor: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(valor);
}

async function carregarDadosBackup(clubeId: number, ano: number): Promise<DadosBackup> {
  const inicio = `${ano}-01-01`;
  const fim = `${ano + 1}-01-01`;
  const [clubeResp, membros, cfgResp, itensResp, pontos, custom, extras, unidades] = await Promise.all([
    supabase.from('clubes').select('nome').eq('id', clubeId).single(),
    buscarPaginado<any>((q) => q.eq('clube_id', clubeId).order('nome'), 'desbravadores', 'id,nome,unidade_nome'),
    supabase.from('config_pontuacao').select('presenca,pontualidade,material,uniforme').eq('clube_id', clubeId).maybeSingle(),
    supabase.from('pontuacao_itens').select('id,titulo,valor').eq('clube_id', clubeId),
    buscarPaginado<any>(
      (q) => q.eq('clube_id', clubeId).gte('data', inicio).lt('data', fim).order('data'),
      'pontuacoes',
      'dbv_id,data,presenca,presenca_pts,pontualidade,pontualidade_pts,material,material_pts,uniforme,uniforme_pts,bom_biblia,pontos_extras,classe_biblica,especialidade,pgm_especial,atividade_unidade,observacao,lancado_por',
    ),
    buscarPaginado<any>(
      (q) => q.eq('clube_id', clubeId).gte('data', inicio).lt('data', fim).order('data'),
      'pontuacoes_custom',
      'dbv_id,data,item_id,item_nome,item_valor,quantidade,pontos',
    ),
    buscarPaginado<any>(
      (q) => q.eq('clube_id', clubeId).gte('data', inicio).lt('data', fim).order('data'),
      'pontuacoes_extras_itens',
      'dbv_id,data,pontos,observacao',
    ),
    buscarPaginado<any>(
      (q) => q.eq('clube_id', clubeId).gte('data', inicio).lt('data', fim).order('data'),
      'pontuacoes_unidades',
      'unidade_nome,data,pontos,descricao',
    ),
  ]);

  if (clubeResp.error) throw clubeResp.error;
  if (cfgResp.error) throw cfgResp.error;
  if (itensResp.error) throw itensResp.error;

  const cfg = cfgResp.data ?? PONTOS_FALLBACK;
  const itensPorId = new Map((itensResp.data ?? []).map((item: any) => [Number(item.id), item]));
  const extrasPorChave = new Map<string, Array<{ pontos: number; observacao?: string }>>();
  for (const item of extras) {
    const key = chave(Number(item.dbv_id), item.data);
    const lista = extrasPorChave.get(key) ?? [];
    lista.push({ pontos: Number(item.pontos) || 0, observacao: item.observacao ?? undefined });
    extrasPorChave.set(key, lista);
  }

  const diasPorMembro = new Map<number, Map<string, RegistroDia>>();
  const obterDia = (dbvId: number, data: string) => {
    let porData = diasPorMembro.get(dbvId);
    if (!porData) {
      porData = new Map();
      diasPorMembro.set(dbvId, porData);
    }
    let dia = porData.get(data);
    if (!dia) {
      dia = { data, dataFormatada: formatarDataExtrato(data), linhas: [], subtotal: 0 };
      porData.set(data, dia);
    }
    return dia;
  };

  for (const ponto of pontos) {
    const dbvId = Number(ponto.dbv_id);
    const dia = obterDia(dbvId, ponto.data);
    dia.lancado_por = ponto.lancado_por ?? dia.lancado_por;
    for (const linha of linhasCategoriasPontuacao(ponto, cfg)) {
      dia.linhas.push({ ...linha, tipo: 'base' });
      dia.subtotal += linha.pts;
    }
    const totalExtras = Number(ponto.pontos_extras) || 0;
    if (totalExtras !== 0) {
      const detalhados = extrasPorChave.get(chave(dbvId, ponto.data)) ?? [];
      for (const extra of detalhados) {
        dia.linhas.push({ label: 'Pontos Extras', pts: extra.pontos, icon: 'flash-outline', observacao: extra.observacao, tipo: 'extra' });
        dia.subtotal += extra.pontos;
      }
      const restante = totalExtras - detalhados.reduce((soma, extra) => soma + extra.pontos, 0);
      if (restante !== 0) {
        dia.linhas.push({ label: 'Pontos Extras', pts: restante, icon: 'flash-outline', observacao: ponto.observacao ?? undefined, tipo: 'extra' });
        dia.subtotal += restante;
      }
    }
  }

  for (const item of custom) {
    const quantidade = Number(item.quantidade) || 0;
    const valor = Number(item.pontos) || 0;
    if (quantidade === 0 && valor === 0) continue;
    const modelo: any = itensPorId.get(Number(item.item_id));
    const dia = obterDia(Number(item.dbv_id), item.data);
    dia.linhas.push({
      label: item.item_nome ?? modelo?.titulo ?? 'Pontuação personalizada',
      pts: valor,
      icon: 'add-circle-outline',
      observacao: quantidade > 1 ? `${quantidade}x ${item.item_valor ?? modelo?.valor ?? ''} pts` : undefined,
      tipo: 'custom',
    });
    dia.subtotal += valor;
  }

  const membrosBackup: MembroBackup[] = membros.map((membro: any) => {
    const dias = Array.from(diasPorMembro.get(Number(membro.id))?.values() ?? [])
      .filter((dia) => dia.linhas.length > 0)
      .sort((a, b) => b.data.localeCompare(a.data));
    return {
      id: Number(membro.id),
      nome: membro.nome ?? 'Sem nome',
      unidade: membro.unidade_nome ?? 'Sem unidade',
      total: dias.reduce((soma, dia) => soma + dia.subtotal, 0),
      dias,
    };
  }).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

  const unidadesBackup = unidades.map((item: any) => ({
    unidade: item.unidade_nome ?? 'Sem unidade',
    data: item.data,
    descricao: item.descricao ?? 'Pontuação direta',
    pontos: Number(item.pontos) || 0,
  }));

  return {
    clubeNome: clubeResp.data?.nome ?? 'Clube',
    ano,
    geradoEm: new Date().toISOString(),
    membros: membrosBackup,
    unidades: unidadesBackup,
    totalPontos: membrosBackup.reduce((soma, membro) => soma + membro.total, 0)
      + unidadesBackup.reduce((soma, unidade) => soma + unidade.pontos, 0),
  };
}

function gerarHtml(dados: DadosBackup) {
  const ranking = dados.membros.map((membro, indice) => `
    <tr><td>${indice + 1}</td><td>${escaparHtml(membro.nome)}</td><td>${escaparHtml(membro.unidade)}</td><td class="numero">${formatarPontos(membro.total)}</td></tr>`).join('');
  const extratos = dados.membros.map((membro) => {
    const dias = membro.dias.length === 0
      ? '<p class="vazio">Nenhuma pontuação registrada neste ano.</p>'
      : membro.dias.map((dia) => `
        <section class="dia"><h3>${escaparHtml(dia.dataFormatada)} <span>${formatarPontos(dia.subtotal)} pts</span></h3>
          ${dia.linhas.map((linha: LinhaExtrato) => `<div class="linha"><span>${escaparHtml(linha.label)}${linha.observacao ? ` — ${escaparHtml(linha.observacao)}` : ''}</span><strong>${formatarPontos(linha.pts)}</strong></div>`).join('')}
        </section>`).join('');
    return `<article class="membro"><h2>${escaparHtml(membro.nome)}</h2><p>${escaparHtml(membro.unidade)} · Total: <strong>${formatarPontos(membro.total)} pontos</strong></p>${dias}</article>`;
  }).join('');
  const unidades = dados.unidades.length === 0 ? '<p class="vazio">Nenhuma pontuação direta de unidade.</p>' : `
    <table><thead><tr><th>Data</th><th>Unidade</th><th>Descrição</th><th>Pontos</th></tr></thead><tbody>
    ${dados.unidades.map((item) => `<tr><td>${escaparHtml(item.data)}</td><td>${escaparHtml(item.unidade)}</td><td>${escaparHtml(item.descricao)}</td><td class="numero">${formatarPontos(item.pontos)}</td></tr>`).join('')}
    </tbody></table>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#172b3f;font-size:10pt}h1{margin:0 0 4px;color:#12395b}h2{margin:0;color:#12395b}h3{margin:0;background:#edf3f7;padding:7px;display:flex;justify-content:space-between}.meta{color:#56697a;margin-bottom:18px}.resumo{display:flex;gap:20px;margin:12px 0 18px}.resumo strong{font-size:16pt}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccd8e1;padding:6px;text-align:left}th{background:#12395b;color:#fff}.numero{text-align:right}.membro{page-break-before:always}.membro>p{margin:4px 0 12px;color:#56697a}.dia{margin:0 0 10px;border:1px solid #d8e1e8}.dia h3 span{font-weight:normal}.linha{display:flex;justify-content:space-between;padding:5px 8px;border-top:1px solid #e5ebef}.vazio{color:#6f7f8c;font-style:italic}.unidades{page-break-before:always}
  </style></head><body>
    <h1>Backup de pontuação ${dados.ano}</h1><div class="meta">${escaparHtml(dados.clubeNome)} · Gerado em ${new Date(dados.geradoEm).toLocaleString('pt-BR')}</div>
    <div class="resumo"><div><strong>${dados.membros.length}</strong><br>Membros</div><div><strong>${formatarPontos(dados.totalPontos)}</strong><br>Pontos registrados</div></div>
    <h2>Classificação antes da zeragem</h2><table><thead><tr><th>#</th><th>Membro</th><th>Unidade</th><th>Pontos</th></tr></thead><tbody>${ranking}</tbody></table>
    ${extratos}<article class="unidades"><h2>Pontuação direta das unidades</h2>${unidades}</article>
  </body></html>`;
}

async function gerarPdfWeb(dados: DadosBackup): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margem = 14;
  const largura = 182;
  const altura = 283;
  let y = margem;
  const novaPaginaSePreciso = (necessario: number) => {
    if (y + necessario <= altura) return;
    doc.addPage();
    y = margem;
  };
  const escrever = (texto: string, tamanho = 10, negrito = false, recuo = 0) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal');
    doc.setFontSize(tamanho);
    const linhas = doc.splitTextToSize(texto, largura - recuo);
    novaPaginaSePreciso(linhas.length * (tamanho * 0.42) + 2);
    doc.text(linhas, margem + recuo, y);
    y += linhas.length * (tamanho * 0.42) + 2;
  };

  escrever(`Backup de pontuação ${dados.ano}`, 18, true);
  escrever(`${dados.clubeNome} · Gerado em ${new Date(dados.geradoEm).toLocaleString('pt-BR')}`, 10);
  escrever(`${dados.membros.length} membros · ${formatarPontos(dados.totalPontos)} pontos registrados`, 11, true);
  y += 3;
  escrever('Classificação antes da zeragem', 14, true);
  dados.membros.forEach((membro, indice) => escrever(`${indice + 1}. ${membro.nome} · ${membro.unidade} · ${formatarPontos(membro.total)} pontos`, 9));

  for (const membro of dados.membros) {
    doc.addPage();
    y = margem;
    escrever(membro.nome, 15, true);
    escrever(`${membro.unidade} · Total: ${formatarPontos(membro.total)} pontos`, 10);
    if (membro.dias.length === 0) escrever('Nenhuma pontuação registrada neste ano.', 9);
    for (const dia of membro.dias) {
      novaPaginaSePreciso(14);
      escrever(`${dia.dataFormatada} · ${formatarPontos(dia.subtotal)} pts`, 10, true);
      for (const linha of dia.linhas) {
        const detalhe = linha.observacao ? ` — ${linha.observacao}` : '';
        escrever(`${linha.label}${detalhe}: ${formatarPontos(linha.pts)} pts`, 9, false, 4);
      }
      y += 2;
    }
  }

  doc.addPage();
  y = margem;
  escrever('Pontuação direta das unidades', 15, true);
  if (dados.unidades.length === 0) escrever('Nenhuma pontuação direta de unidade.', 9);
  dados.unidades.forEach((item) => escrever(`${item.data} · ${item.unidade} · ${item.descricao}: ${formatarPontos(item.pontos)} pts`, 9));
  return doc.output('blob');
}

async function gerarCorpoPdf(dados: DadosBackup): Promise<UploadBody> {
  if (Platform.OS === 'web') return gerarPdfWeb(dados);
  const Print = await import('expo-print');
  const { uri } = await Print.printToFileAsync({ html: gerarHtml(dados) });
  return uriParaUploadBody(uri, 'application/pdf');
}

export async function listarBackupsRanking(clubeId: number): Promise<RankingBackupSalvo[]> {
  const { data, error } = await supabase
    .from('ranking_backups')
    .select('id,ano,nome_arquivo,arquivo_path,total_membros,total_pontos,created_at')
    .eq('clube_id', clubeId)
    .order('ano', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RankingBackupSalvo[];
}

export async function abrirBackupRanking(arquivoPath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(arquivoPath, 300);
  if (error) throw error;
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  else await Linking.openURL(data.signedUrl);
}

export async function gerarBackupEZerarRanking(clubeId: number, ano: number) {
  const existentes = await listarBackupsRanking(clubeId);
  if (existentes.some((backup) => Number(backup.ano) === ano)) {
    throw new Error(`Já existe um backup e uma zeragem registrados para ${ano}.`);
  }

  const dados = await carregarDadosBackup(clubeId, ano);
  const nomeArquivo = `backup-antes-de-zerar-pontuacao-data-${ano}.pdf`;
  const arquivoPath = `${clubeId}/${nomeArquivo}`;
  const corpo = await gerarCorpoPdf(dados);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(arquivoPath, corpo, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error: rpcError } = await supabase.rpc('zerar_pontuacao_clube', {
    p_clube_id: clubeId,
    p_ano: ano,
    p_arquivo_path: arquivoPath,
    p_nome_arquivo: nomeArquivo,
    p_total_membros: dados.membros.length,
    p_total_pontos: dados.totalPontos,
  });
  if (rpcError) {
    // A chamada pode ter sido confirmada no banco e a resposta ter se perdido
    // na rede. Nesse caso, remover o arquivo destruiria o unico backup depois
    // de os pontos ja terem sido apagados. So limpamos o upload quando o banco
    // confirma que a transacao nao criou o registro anual.
    const { data: confirmado, error: erroVerificacao } = await supabase
      .from('ranking_backups')
      .select('id')
      .eq('clube_id', clubeId)
      .eq('ano', ano)
      .maybeSingle();
    if (confirmado) {
      return { nomeArquivo, totalMembros: dados.membros.length, totalPontos: dados.totalPontos };
    }
    if (!erroVerificacao) await supabase.storage.from(BUCKET).remove([arquivoPath]);
    throw rpcError;
  }
  return { nomeArquivo, totalMembros: dados.membros.length, totalPontos: dados.totalPontos };
}

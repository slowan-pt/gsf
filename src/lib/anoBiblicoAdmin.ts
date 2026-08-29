import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';
import type { Idioma, Passagem } from './anoBiblico';

export interface DiaCatalogoAdmin {
  id: number;
  mes: number;
  dia: number;
  ano_bissexto: boolean;
  livro_abrev: string;
  livro_nome: string;
  referencia: string;
  passagens: Passagem[];
}

export async function carregarCatalogoAnoBiblico(): Promise<DiaCatalogoAdmin[]> {
  const { data, error } = await supabase
    .from('ano_biblico_catalogo')
    .select('*')
    .eq('ativo', true)
    .order('ordem_no_ano');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    mes: r.mes,
    dia: r.dia,
    ano_bissexto: !!r.ano_bissexto,
    livro_abrev: r.livro_abrev,
    livro_nome: r.livro_nome,
    referencia: r.referencia,
    passagens: r.passagens,
  }));
}

const IDIOMAS_NECESSARIOS: Idioma[] = ['pt', 'en', 'fr', 'es'];

/**
 * Mesmo mapeamento de scripts/gerar_seed_ano_biblico_textos.py: livro_abrev
 * (usado no catálogo, PT) -> chave de arquivo midvash (comum a pt/en/fr) +
 * número do livro na ordem protestante padrão (1-66), usado pelo getbible.net.
 */
const LIVRO_INFO: Record<string, { chaveMidvash: string; numeroGetbible: number }> = {
  Gn: { chaveMidvash: 'Gen', numeroGetbible: 1 }, Ex: { chaveMidvash: 'Exod', numeroGetbible: 2 },
  Lv: { chaveMidvash: 'Lev', numeroGetbible: 3 }, Nm: { chaveMidvash: 'Num', numeroGetbible: 4 },
  Dt: { chaveMidvash: 'Deut', numeroGetbible: 5 }, Js: { chaveMidvash: 'Josh', numeroGetbible: 6 },
  Jz: { chaveMidvash: 'Judg', numeroGetbible: 7 }, Rt: { chaveMidvash: 'Ruth', numeroGetbible: 8 },
  '1Sm': { chaveMidvash: '1Sam', numeroGetbible: 9 }, '2Sm': { chaveMidvash: '2Sam', numeroGetbible: 10 },
  '1Rs': { chaveMidvash: '1Kgs', numeroGetbible: 11 }, '2Rs': { chaveMidvash: '2Kgs', numeroGetbible: 12 },
  '1Cr': { chaveMidvash: '1Chr', numeroGetbible: 13 }, '2Cr': { chaveMidvash: '2Chr', numeroGetbible: 14 },
  Ed: { chaveMidvash: 'Ezra', numeroGetbible: 15 }, Ne: { chaveMidvash: 'Neh', numeroGetbible: 16 },
  Et: { chaveMidvash: 'Esth', numeroGetbible: 17 }, Jó: { chaveMidvash: 'Job', numeroGetbible: 18 },
  Sl: { chaveMidvash: 'Ps', numeroGetbible: 19 }, Pv: { chaveMidvash: 'Prov', numeroGetbible: 20 },
  Ec: { chaveMidvash: 'Eccl', numeroGetbible: 21 }, Ct: { chaveMidvash: 'Song', numeroGetbible: 22 },
  Is: { chaveMidvash: 'Isa', numeroGetbible: 23 }, Jr: { chaveMidvash: 'Jer', numeroGetbible: 24 },
  Lm: { chaveMidvash: 'Lam', numeroGetbible: 25 }, Ez: { chaveMidvash: 'Ezek', numeroGetbible: 26 },
  Dn: { chaveMidvash: 'Dan', numeroGetbible: 27 }, Os: { chaveMidvash: 'Hos', numeroGetbible: 28 },
  Jl: { chaveMidvash: 'Joel', numeroGetbible: 29 }, Am: { chaveMidvash: 'Amos', numeroGetbible: 30 },
  Ob: { chaveMidvash: 'Obad', numeroGetbible: 31 }, Jn: { chaveMidvash: 'Jonah', numeroGetbible: 32 },
  Mq: { chaveMidvash: 'Mic', numeroGetbible: 33 }, Na: { chaveMidvash: 'Nah', numeroGetbible: 34 },
  Hc: { chaveMidvash: 'Hab', numeroGetbible: 35 }, Sf: { chaveMidvash: 'Zeph', numeroGetbible: 36 },
  Ag: { chaveMidvash: 'Hag', numeroGetbible: 37 }, Zc: { chaveMidvash: 'Zech', numeroGetbible: 38 },
  Ml: { chaveMidvash: 'Mal', numeroGetbible: 39 }, Mt: { chaveMidvash: 'Matt', numeroGetbible: 40 },
  Mc: { chaveMidvash: 'Mark', numeroGetbible: 41 }, Lc: { chaveMidvash: 'Luke', numeroGetbible: 42 },
  Jo: { chaveMidvash: 'John', numeroGetbible: 43 }, At: { chaveMidvash: 'Acts', numeroGetbible: 44 },
  Rm: { chaveMidvash: 'Rom', numeroGetbible: 45 }, '1Co': { chaveMidvash: '1Cor', numeroGetbible: 46 },
  '2Co': { chaveMidvash: '2Cor', numeroGetbible: 47 }, Gl: { chaveMidvash: 'Gal', numeroGetbible: 48 },
  Ef: { chaveMidvash: 'Eph', numeroGetbible: 49 }, Fp: { chaveMidvash: 'Phil', numeroGetbible: 50 },
  Cl: { chaveMidvash: 'Col', numeroGetbible: 51 }, '1Ts': { chaveMidvash: '1Thess', numeroGetbible: 52 },
  '2Ts': { chaveMidvash: '2Thess', numeroGetbible: 53 }, '1Tm': { chaveMidvash: '1Tim', numeroGetbible: 54 },
  '2Tm': { chaveMidvash: '2Tim', numeroGetbible: 55 }, Tt: { chaveMidvash: 'Titus', numeroGetbible: 56 },
  Fm: { chaveMidvash: 'Phlm', numeroGetbible: 57 }, Hb: { chaveMidvash: 'Heb', numeroGetbible: 58 },
  Tg: { chaveMidvash: 'Jas', numeroGetbible: 59 }, '1Pe': { chaveMidvash: '1Pet', numeroGetbible: 60 },
  '2Pe': { chaveMidvash: '2Pet', numeroGetbible: 61 }, '1Jo': { chaveMidvash: '1John', numeroGetbible: 62 },
  '2Jo': { chaveMidvash: '2John', numeroGetbible: 63 }, '3Jo': { chaveMidvash: '3John', numeroGetbible: 64 },
  Jd: { chaveMidvash: 'Jude', numeroGetbible: 65 }, Ap: { chaveMidvash: 'Rev', numeroGetbible: 66 },
};

const MIDVASH_LANG_DIR: Record<'pt' | 'en' | 'fr', string> = { pt: 'pt/almeida-livre', en: 'en/kjv', fr: 'fr/lsg' };
const FONTE_POR_IDIOMA: Record<Idioma, string> = {
  pt: 'Almeida Livre', en: 'King James Version', fr: 'Louis Segond 1910', es: 'Reina-Valera 1909',
};

async function buscarCapituloMidvash(idioma: 'pt' | 'en' | 'fr', livroAbrev: string, capitulo: number) {
  const info = LIVRO_INFO[livroAbrev];
  if (!info) throw new Error(`Livro desconhecido: ${livroAbrev}`);
  const url = `https://raw.githubusercontent.com/midvash/bible-data/master/versions/${MIDVASH_LANG_DIR[idioma]}/books/${info.chaveMidvash}.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao buscar ${livroAbrev} ${capitulo} (${idioma}): HTTP ${resp.status}`);
  const dados = await resp.json();
  const cap = (dados.chapters as any[]).find((c) => c.chapter === capitulo);
  if (!cap) throw new Error(`Capítulo ${capitulo} não encontrado em ${livroAbrev} (${idioma})`);
  return (cap.verses as any[]).map((v) => ({ numero: v.number, texto: String(v.text).trim() }));
}

async function buscarCapituloGetbible(livroAbrev: string, capitulo: number) {
  const info = LIVRO_INFO[livroAbrev];
  if (!info) throw new Error(`Livro desconhecido: ${livroAbrev}`);
  const url = `https://api.getbible.net/v2/valera/${info.numeroGetbible}/${capitulo}.json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao buscar ${livroAbrev} ${capitulo} (es): HTTP ${resp.status}`);
  const dados = await resp.json();
  return (dados.verses as any[]).map((v) => ({ numero: v.verse, texto: String(v.text).trim() }));
}

/**
 * Garante que todo capítulo referenciado pelas passagens tenha texto salvo
 * nos 4 idiomas — busca nas fontes públicas de domínio público (mesmas do
 * scripts/gerar_seed_ano_biblico_textos.py) o que estiver faltando e grava
 * em ano_biblico_textos. Lança erro (bloqueando o salvamento do dia) se
 * alguma busca falhar — melhor que salvar um dia com texto ausente.
 */
export async function garantirTextoDisponivel(passagens: Passagem[]): Promise<void> {
  for (const p of passagens) {
    const { data, error } = await supabase
      .from('ano_biblico_textos')
      .select('idioma')
      .eq('livro_abrev', p.livro_abrev)
      .eq('capitulo', p.capitulo);
    if (error) throw error;
    const presentes = new Set((data ?? []).map((r: any) => r.idioma));
    const faltando = IDIOMAS_NECESSARIOS.filter((i) => !presentes.has(i));
    if (faltando.length === 0) continue;

    for (const idioma of faltando) {
      const versiculos = idioma === 'es'
        ? await buscarCapituloGetbible(p.livro_abrev, p.capitulo)
        : await buscarCapituloMidvash(idioma, p.livro_abrev, p.capitulo);
      const { error: upsertError } = await supabase.from('ano_biblico_textos').upsert(
        {
          livro_abrev: p.livro_abrev,
          capitulo: p.capitulo,
          idioma,
          versiculos,
          fonte: FONTE_POR_IDIOMA[idioma],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'livro_abrev,capitulo,idioma' }
      );
      if (upsertError) throw upsertError;
    }
  }
}

export interface DiaEditavel {
  id: number;
  livro_abrev: string;
  livro_nome: string;
  referencia: string;
  passagens: Passagem[];
}

/**
 * Atualiza o dia (nunca cria/apaga linhas — os 365/366 dias já existem desde
 * o seed inicial; editar é sempre trocar o conteúdo de um dia existente).
 * Progresso de leitura de membros referencia o id do dia, então a linha
 * nunca é removida.
 */
export async function salvarDiaAnoBiblico(dados: DiaEditavel, usuarioId?: string | null): Promise<void> {
  const referencia = dados.referencia.trim();
  const livroAbrev = dados.livro_abrev.trim();
  const livroNome = dados.livro_nome.trim();
  if (!referencia) throw new Error('Informe a referência do dia.');
  if (!livroAbrev || !livroNome) throw new Error('Informe o livro.');
  if (!dados.passagens || dados.passagens.length === 0) throw new Error('Informe ao menos um capítulo.');

  // Busca o texto que ainda não existe ANTES de trocar o dia — se a busca
  // falhar (offline, fonte fora do ar), o dia não é alterado e continua
  // com o texto antigo disponível, em vez de ficar com texto ausente.
  await garantirTextoDisponivel(dados.passagens);

  const { error } = await supabase
    .from('ano_biblico_catalogo')
    .update({
      livro_abrev: livroAbrev,
      livro_nome: livroNome,
      referencia,
      passagens: dados.passagens,
      editado_por: usuarioId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dados.id);
  if (error) throw error;
}

/* ─────────────────────────────────────────────────────────────────
 * Modelo Excel para edição em massa: 1 linha por passagem (um dia com
 * mais de um capítulo vira várias linhas com o mesmo ID). Baixa o plano
 * atual, o admin edita as células que quiser e reenvia pelo upload.
 * ───────────────────────────────────────────────────────────────── */

const CABECALHO_PLANILHA = [
  'ID', 'Mês', 'Dia', 'Ano Bissexto (S/N)',
  'Livro exibido (abrev)', 'Livro exibido (nome completo)', 'Referência exibida',
  'Livro do capítulo (abrev)', 'Capítulo', 'Verso Início', 'Verso Fim',
];

function linhasDaPlanilha(dias: DiaCatalogoAdmin[]): (string | number)[][] {
  const linhas: (string | number)[][] = [CABECALHO_PLANILHA];
  for (const d of dias) {
    for (const p of d.passagens) {
      linhas.push([
        d.id, d.mes, d.dia, d.ano_bissexto ? 'S' : 'N',
        d.livro_abrev, d.livro_nome, d.referencia,
        p.livro_abrev, p.capitulo, p.verso_ini ?? '', p.verso_fim ?? '',
      ]);
    }
  }
  return linhas;
}

/**
 * Gera e baixa/compartilha o modelo Excel com o plano atual completo — 1
 * aba, 1 linha por passagem, pronto para o admin editar em massa e reenviar
 * pelo upload (ver `importarCatalogoExcel`/`aplicarImportacaoExcel`).
 */
export async function exportarModeloExcel(dias: DiaCatalogoAdmin[]): Promise<void> {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(linhasDaPlanilha(dias));
  ws['!cols'] = [
    { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 10 },
    { wch: 14 }, { wch: 20 }, { wch: 20 },
    { wch: 14 }, { wch: 9 }, { wch: 11 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Ano Bíblico');
  const nomeArquivo = 'ano-biblico-plano.xlsx';

  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, nomeArquivo);
    return;
  }
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const caminho = new FileSystem.File(FileSystem.Paths.cache, nomeArquivo).uri;
  await FileSystem.writeAsStringAsync(caminho, base64, { encoding: 'base64' as any });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(caminho, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Plano do Ano Bíblico',
    });
  }
}

async function lerWorkbookAsset(asset: DocumentPicker.DocumentPickerAsset) {
  if (Platform.OS === 'web' && (asset as any).file) {
    const buffer = await (asset as any).file.arrayBuffer();
    return XLSX.read(buffer, { type: 'array' });
  }
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any });
  return XLSX.read(base64, { type: 'base64' });
}

export interface DiaImportado extends DiaEditavel {
  linhaOrigem: number; // 1ª linha (1-indexado, sem contar cabeçalho) deste ID na planilha, para mensagens de erro
}

/**
 * Lê o Excel enviado pelo admin e reconstrói os dias (agrupando as linhas
 * pelo ID). Não grava nada ainda — só interpreta o arquivo.
 */
export async function importarCatalogoExcel(asset: DocumentPicker.DocumentPickerAsset): Promise<DiaImportado[]> {
  const wb = await lerWorkbookAsset(asset);
  const abaNome = wb.SheetNames[0];
  if (!abaNome) throw new Error('A planilha está vazia.');
  const linhas = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[abaNome], { header: 1, defval: '' });

  const porId = new Map<number, { linhaOrigem: number; dados: DiaEditavel }>();
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha || linha.every((c) => String(c ?? '').trim() === '')) continue;
    const [idRaw, , , , livroExibidoAbrev, livroExibidoNome, referencia, livroCap, capituloRaw, versoIniRaw, versoFimRaw] = linha;
    const id = parseInt(String(idRaw), 10);
    if (Number.isNaN(id)) throw new Error(`Linha ${i + 1}: ID inválido ("${idRaw}").`);
    const capitulo = parseInt(String(capituloRaw), 10);
    if (!livroCap || Number.isNaN(capitulo)) {
      throw new Error(`Linha ${i + 1}: informe livro e capítulo da passagem.`);
    }
    const versoIni = String(versoIniRaw ?? '').trim() ? parseInt(String(versoIniRaw), 10) : null;
    const versoFim = String(versoFimRaw ?? '').trim() ? parseInt(String(versoFimRaw), 10) : versoIni;
    const passagem: Passagem = { livro_abrev: String(livroCap).trim(), capitulo, verso_ini: versoIni, verso_fim: versoFim };

    let atual = porId.get(id);
    if (!atual) {
      atual = {
        linhaOrigem: i + 1,
        dados: {
          id,
          livro_abrev: String(livroExibidoAbrev ?? '').trim(),
          livro_nome: String(livroExibidoNome ?? '').trim(),
          referencia: String(referencia ?? '').trim(),
          passagens: [],
        },
      };
      porId.set(id, atual);
    }
    atual.dados.passagens.push(passagem);
  }

  if (porId.size === 0) throw new Error('Nenhuma linha reconhecida na planilha.');
  return Array.from(porId.values()).map((v) => ({ ...v.dados, linhaOrigem: v.linhaOrigem }));
}

/**
 * Aplica em sequência os dias interpretados do Excel (upsert linha a linha,
 * reusando `salvarDiaAnoBiblico`, que já garante o texto nos 4 idiomas antes
 * de trocar cada dia). Continua mesmo se um dia falhar — devolve o relatório
 * completo pra tela mostrar o que deu certo e o que não deu.
 */
export async function aplicarImportacaoExcel(
  dias: DiaImportado[],
  usuarioId?: string | null,
  onProgresso?: (feito: number, total: number) => void
): Promise<{ id: number; linhaOrigem: number; ok: boolean; erro?: string }[]> {
  const resultado: { id: number; linhaOrigem: number; ok: boolean; erro?: string }[] = [];
  for (let i = 0; i < dias.length; i++) {
    const dia = dias[i];
    try {
      await salvarDiaAnoBiblico(dia, usuarioId);
      resultado.push({ id: dia.id, linhaOrigem: dia.linhaOrigem, ok: true });
    } catch (e: any) {
      resultado.push({ id: dia.id, linhaOrigem: dia.linhaOrigem, ok: false, erro: e?.message ?? String(e) });
    }
    onProgresso?.(i + 1, dias.length);
  }
  return resultado;
}

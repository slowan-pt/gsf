import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { supabase } from './supabase';
import { getClubeAtivoId } from './contextoAtual';
import { carregarCatalogoEspecialidades } from './especialidades';
import { base64ParaBytes, bytesParaBase64 } from './logoClube';
import type { ItemAguardando } from './investidura';
import {
  anexarRelacao, chaveNome, montarAnexo, montarRelacao, montarTabelaInvestidos, nomeArquivoAutorizacao, preencherCabecalho,
  preencherDocumento, substituirImagensPelaTabela, type DadosAutorizacao, type RelacaoInvestidura,
} from './autorizacaoInvestiduraNucleo';

/**
 * Autorização para Condecoração (investidura) no modelo Word da Associação — ver autorizacaoInvestiduraNucleo.ts.
 * Aqui ficam a leitura do modelo embutido no app, os valores iniciais do formulário (clube, regional, diretor, o que
 * foi usado da última vez) e a entrega do arquivo .docx (download na web, compartilhar no celular).
 */

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const chavePadroes = (clubeId: number) => `autorizacao_investidura_padroes_v1_${clubeId}`;

/** Textos que mudam pouco: da Associação e da própria cerimônia. Valem de ponto de partida até o clube salvar os dele. */
const PADRAO_ASSOCIACAO = {
  associacao: 'Associação Rio Fluminense',
  coordenadorGeralNome: 'Lucas Bragança Almeida de Souza',
  departamentalNome: 'Pr. Henrique Custódio',
};

export type OpcoesAutorizacao = { incluirQuantidades: boolean };

function dataHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Valores que não dependem de cada investidura e são lembrados entre uma geração e outra. */
type Lembrados = Pick<DadosAutorizacao, 'associacao' | 'regiao' | 'instrutores' | 'cerimonia' | 'localCerimonia' | 'autoridades' | 'cidade'
  | 'diretorNome' | 'regionalNome' | 'coordenadorGeralNome' | 'departamentalNome'>;

export async function lembrarPadroes(clubeId: number, d: DadosAutorizacao): Promise<void> {
  const l: Lembrados = {
    associacao: d.associacao, regiao: d.regiao, instrutores: d.instrutores, cerimonia: d.cerimonia, localCerimonia: d.localCerimonia,
    autoridades: d.autoridades, cidade: d.cidade, diretorNome: d.diretorNome, regionalNome: d.regionalNome,
    coordenadorGeralNome: d.coordenadorGeralNome, departamentalNome: d.departamentalNome,
  };
  await AsyncStorage.setItem(chavePadroes(clubeId), JSON.stringify(l)).catch(() => {});
}

/** Nome do regional (perfil externo ligado ao clube). Sem permissão de leitura ou sem regional, devolve vazio. */
async function nomeDoRegional(clubeId: number): Promise<string> {
  try {
    const { data: vinculos } = await supabase.from('usuario_clubes').select('usuario_id').eq('clube_id', clubeId).eq('perfil', 'usuario_regional').eq('ativo', true).limit(1);
    const id = vinculos?.[0]?.usuario_id;
    if (!id) return '';
    const { data } = await supabase.from('usuarios').select('nome').eq('id', id).maybeSingle();
    return String((data as any)?.nome ?? '').trim();
  } catch {
    return '';
  }
}

/** Diretoria do clube: membros com cargo de diretor(a). O primeiro "Diretor" puro é quem assina. */
async function diretoriaDoClube(clubeId: number): Promise<{ instrutores: string[]; diretor: string }> {
  try {
    const { data } = await supabase.from('desbravadores').select('nome,cargo').eq('clube_id', clubeId).ilike('cargo', '%diretor%').order('nome').limit(20);
    const lista = (data ?? []) as { nome: string; cargo: string }[];
    const puro = lista.find((m) => /^\s*diretor(a)?\s*$/i.test(m.cargo));
    return { instrutores: lista.map((m) => m.nome).filter(Boolean), diretor: puro?.nome ?? lista[0]?.nome ?? '' };
  } catch {
    return { instrutores: [], diretor: '' };
  }
}

/** Valores iniciais do formulário: o que o clube usou da última vez, senão o que o cadastro do clube informa. */
export async function carregarPadroesAutorizacao(clubeId: number = getClubeAtivoId()): Promise<DadosAutorizacao> {
  const [clubeRes, regional, diretoria, lembradosBruto] = await Promise.all([
    supabase.from('clubes').select('nome,nome_curto,igreja,regional,cidade').eq('id', clubeId).maybeSingle().then((r) => r.data as any, () => null),
    nomeDoRegional(clubeId),
    diretoriaDoClube(clubeId),
    AsyncStorage.getItem(chavePadroes(clubeId)).catch(() => null),
  ]);
  let l: Partial<Lembrados> = {};
  try { l = lembradosBruto ? JSON.parse(lembradosBruto) : {}; } catch { /* usa só o cadastro */ }
  return {
    clube: String(clubeRes?.nome_curto || clubeRes?.nome || 'Clube'),
    associacao: l.associacao || PADRAO_ASSOCIACAO.associacao,
    regiao: l.regiao || String(clubeRes?.regional ?? ''),
    instrutores: l.instrutores?.length ? l.instrutores : diretoria.instrutores,
    cerimonia: l.cerimonia || 'Investidura',
    dataCerimonia: '',
    horaCerimonia: '',
    localCerimonia: l.localCerimonia || (clubeRes?.igreja ? `IASD ${String(clubeRes.igreja).replace(/^\s*(igreja|iasd)\s+(do|da|de)?\s*/i, '')}` : ''),
    autoridades: l.autoridades?.length ? l.autoridades : diretoria.instrutores,
    cidade: l.cidade || String(clubeRes?.cidade ?? ''),
    dataDocumento: dataHoje(),
    diretorNome: l.diretorNome || diretoria.diretor,
    regionalNome: regional || l.regionalNome || '',
    coordenadorGeralNome: l.coordenadorGeralNome || PADRAO_ASSOCIACAO.coordenadorGeralNome,
    departamentalNome: l.departamentalNome || PADRAO_ASSOCIACAO.departamentalNome,
    registro: '',
  };
}

/** Código do manual de cada especialidade (ex.: ENB13), pelo nome. */
export async function codigosDasEspecialidades(): Promise<Record<string, string>> {
  try {
    const catalogo = await carregarCatalogoEspecialidades(true);
    const mapa: Record<string, string> = {};
    for (const e of catalogo) if (e.codigo) mapa[chaveNome(e.nome)] = String(e.codigo).trim();
    return mapa;
  } catch {
    return {};
  }
}

async function lerModelo(): Promise<Uint8Array> {
  const asset = Asset.fromModule(require('../../assets/modelos/autorizacao-investidura-modelo.docx'));
  if (Platform.OS === 'web') {
    const r = await fetch(asset.uri);
    if (!r.ok) throw new Error('Não foi possível carregar o modelo do Word.');
    return new Uint8Array(await r.arrayBuffer());
  }
  await asset.downloadAsync();
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(asset.localUri ?? asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64ParaBytes(base64);
}

/** Monta o .docx: preenche o modelo, troca as imagens da tabela pela relação real e, se pedido, anexa as quantidades. */
export async function montarDocxAutorizacao(d: DadosAutorizacao, itens: ItemAguardando[], opcoes: OpcoesAutorizacao): Promise<{ bytes: Uint8Array; relacao: RelacaoInvestidura }> {
  const [modelo, codigos] = await Promise.all([lerModelo(), codigosDasEspecialidades()]);
  const arquivos = unzipSync(modelo);
  const relacao = montarRelacao(itens, codigos);
  let doc = preencherDocumento(strFromU8(arquivos['word/document.xml']), d, relacao);
  doc = substituirImagensPelaTabela(doc, montarTabelaInvestidos(relacao));
  if (opcoes.incluirQuantidades) doc = anexarRelacao(doc, montarAnexo(d, relacao));
  const bytes = zipSync({
    ...arquivos,
    'word/document.xml': strToU8(doc),
    'word/header1.xml': strToU8(preencherCabecalho(strFromU8(arquivos['word/header1.xml']), d)),
  });
  return { bytes, relacao };
}

/** Gera e entrega o arquivo: baixa na web; no celular abre o compartilhamento (Word, Drive, e-mail...). */
export async function exportarAutorizacaoInvestidura(d: DadosAutorizacao, itens: ItemAguardando[], opcoes: OpcoesAutorizacao): Promise<void> {
  const { bytes, relacao } = await montarDocxAutorizacao(d, itens, opcoes);
  const nome = nomeArquivoAutorizacao(d, relacao);
  await lembrarPadroes(getClubeAtivoId(), d);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME_DOCX }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nome}.docx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return;
  }
  const FileSystem = await import('expo-file-system/legacy');
  const caminho = `${FileSystem.cacheDirectory}${nome}.docx`;
  await FileSystem.writeAsStringAsync(caminho, bytesParaBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(caminho, { mimeType: MIME_DOCX, dialogTitle: nome, UTI: 'org.openxmlformats.wordprocessingml.document' });
  } else {
    throw new Error(`Arquivo gerado em ${caminho}`);
  }
}

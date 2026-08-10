import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image,
  ActivityIndicator, ActionSheetIOS, Platform, Modal, TextInput, Linking,
  KeyboardAvoidingView, Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getDB } from '../../src/lib/database';
import { useDBVStore } from '../../src/stores/dbvStore';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { carregarDocumentosModelo, carregarCargosModelo, cargosFallback, type CargoModelo } from '../../src/lib/modelosPrograma';
import { carregarDocumentosPaisConfig, janelaPaisAberta } from '../../src/lib/documentosPaisConfig';
import { sincronizarTudo } from '../../src/lib/sync';
import { BottomNav } from '../../src/components/BottomNav';
import { DateField } from '../../src/components/DateField';
import { registrarAuditoria } from '../../src/lib/auditoria';
import type { Desbravador, Documento, ProgressoClasse, Perfil } from '../../src/types';

type Aba = 'docs' | 'classes' | 'especs' | 'receber' | 'responsaveis' | 'editar';
type PerfilLogin = Perfil;
interface FormDBV {
  nome: string; genero: string; data_nascimento: string; cargo: string; cargo_adicional: string;
  unidade_id: string; unidade_nome: string; email: string; contato: string;
  camisa: string; calca: string; nome_responsavel: string; contato_responsavel: string;
  foto_url: string; senha: string; perfil_login: PerfilLogin; login_user_id: string;
}
interface UnidadeEdit { id: number; nome: string; cor: string; }
const UNIDADES_PADRAO_EDIT: UnidadeEdit[] = [
  { id: 1, nome: 'Amor Perfeito', cor: '#e91e63' },
  { id: 2, nome: 'Sempre Viva', cor: '#4caf50' },
  { id: 3, nome: 'Águia Dourada', cor: '#ff9800' },
  { id: 4, nome: 'Leões', cor: '#2196f3' },
];
const PERFIS_LOGIN: Array<{ valor: PerfilLogin; label: string }> = [
  { valor: 'usuario_desbravador', label: 'Desbravador' },
  { valor: 'usuario_aventureiro', label: 'Aventureiro' },
  { valor: 'usuario_diretoria', label: 'Diretoria' },
  { valor: 'usuario_secretaria', label: 'Secretaria' },
  { valor: 'usuario_tesouraria', label: 'Tesouraria' },
  { valor: 'usuario_conselheiro', label: 'Conselheiro' },
  { valor: 'usuario_pastor', label: 'Pastor' },
  { valor: 'usuario_capelao', label: 'Capelão' },
  { valor: 'admin_clube', label: 'Admin clube' },
  { valor: 'admin_ti', label: 'Admin TI' },
];
const FORM_VAZIO: FormDBV = {
  nome: '', genero: 'M', data_nascimento: '', cargo: '', cargo_adicional: '',
  unidade_id: '', unidade_nome: '', email: '', contato: '', camisa: '', calca: '',
  nome_responsavel: '', contato_responsavel: '', foto_url: '', senha: '',
  perfil_login: 'usuario_desbravador', login_user_id: '',
};
const CARGOS_EDIT = cargosFallback();

function normalizarCargoEdit(cargo: string) {
  return cargo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function cargoLabel(c: CargoModelo, genero: string) { return genero === 'F' ? c.fem : c.masc; }
function adaptarCargo(cargo: string, paraGenero: string, cargos = CARGOS_EDIT): string {
  const c = cargos.find((x) => x.masc === cargo || x.fem === cargo);
  if (!c) return cargo;
  return paraGenero === 'F' ? c.fem : c.masc;
}
function cargoParaFormulario(cargo: string | null | undefined, genero: string, cargos = CARGOS_EDIT) {
  const c = String(cargo ?? '').trim();
  const norm = normalizarCargoEdit(c);
  const mapa: Record<string, Pick<CargoModelo, 'masc' | 'fem'>> = {
    dbv: { masc: 'Desbravador', fem: 'Desbravadora' },
    desbravador: { masc: 'Desbravador', fem: 'Desbravadora' },
    desbravadora: { masc: 'Desbravador', fem: 'Desbravadora' },
    diretoria: { masc: 'Diretoria', fem: 'Diretoria' },
    con: { masc: 'Conselheiro', fem: 'Conselheira' },
    conselheiro: { masc: 'Conselheiro', fem: 'Conselheira' },
    conselheira: { masc: 'Conselheiro', fem: 'Conselheira' },
    sec: { masc: 'Secretaria do Clube', fem: 'Secretaria do Clube' },
    secretaria: { masc: 'Secretaria do Clube', fem: 'Secretaria do Clube' },
    tesouraria: { masc: 'Tesouraria', fem: 'Tesouraria' },
  };
  const achado = cargos.find((x) => normalizarCargoEdit(x.masc) === norm || normalizarCargoEdit(x.fem) === norm) ?? mapa[norm];
  if (!achado) return c;
  return genero === 'F' ? achado.fem : achado.masc;
}
function idadePorNascimento(data?: string | null): number | null {
  if (!data || data.length < 10) return null;
  const nasc = new Date(`${data.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}
function cargoInfoEdit(cargo: string, cargos = CARGOS_EDIT) {
  const c = normalizarCargoEdit(cargo);
  return cargos.find((x) => normalizarCargoEdit(x.masc) === c || normalizarCargoEdit(x.fem) === c);
}
function cargoForcaDesbravador(cargo: string, cargos = CARGOS_EDIT) {
  const info = cargoInfoEdit(cargo, cargos);
  if (info?.perfil_sugerido === 'usuario_desbravador' || info?.perfil_sugerido === 'usuario_aventureiro') return true;
  const c = normalizarCargoEdit(cargo);
  return ['desbravador','desbravadora','aventureiro','aventureira','capitao','capita','secretaria da unidade'].includes(c);
}
function cargoAdultoEdit(cargo: string, cargos = CARGOS_EDIT) {
  const info = cargoInfoEdit(cargo, cargos);
  if (info?.idade_minima && info.idade_minima >= 16) return true;
  const c = normalizarCargoEdit(cargo);
  return ['diretoria','secretaria do clube','capelania','tesouraria','conselheiro','conselheira'].includes(c);
}
function cargoJuvenilEdit(cargo: string, cargos = CARGOS_EDIT) { return cargoForcaDesbravador(cargo, cargos); }
function ehFuncaoJuvenil(cargo: string) {
  const c = normalizarCargoEdit(cargo);
  return c.includes('capitao') || c.includes('capita') || c.includes('secretari') && c.includes('unidade');
}
function cargoBloqueadoPorIdade(cargo: string, idade: number | null, cargos = CARGOS_EDIT) {
  if (idade === null) return false;
  const info = cargoInfoEdit(cargo, cargos);
  if (info?.idade_minima != null && idade < info.idade_minima) return true;
  if (info?.idade_maxima != null && idade > info.idade_maxima) return true;
  if (idade <= 15) return cargoAdultoEdit(cargo, cargos);
  return cargoJuvenilEdit(cargo, cargos);
}
function perfilPadraoMembro(): PerfilLogin {
  return getProgramaAtivoId() === 2 ? 'usuario_aventureiro' : 'usuario_desbravador';
}
function perfilAdulto(perfil: PerfilLogin) {
  return perfil !== 'usuario_desbravador' && perfil !== 'usuario_aventureiro';
}
function perfilBloqueadoPorIdade(perfil: PerfilLogin, idade: number | null, perfilUsuario?: string) {
  if (perfil === 'admin_ti' && perfilUsuario !== 'admin_ti') return true;
  if (idade === null) return false;
  if (idade <= 15) return perfilAdulto(perfil);
  return !perfilAdulto(perfil);
}
function ajustarPerfilPorIdade(perfil: PerfilLogin, idade: number | null): PerfilLogin {
  if (idade === null) return perfil;
  if (idade <= 15) return perfilPadraoMembro();
  return perfilAdulto(perfil) ? perfil : 'usuario_diretoria';
}
function ajustarCargoPorIdade(cargo: string, idade: number | null, cargos = CARGOS_EDIT) {
  return cargoBloqueadoPorIdade(cargo, idade, cargos) ? '' : cargo;
}

function normalizarPerfilLogin(perfil?: string | null): PerfilLogin | null {
  if (!perfil) return null;
  if (perfil === 'admin_total') return 'admin_ti';
  if (perfil === 'admin_geral') return 'admin_clube';
  if (perfil === 'admin_diretoria') return 'usuario_diretoria';
  if (perfil === 'desbravador') return 'usuario_desbravador';
  if (PERFIS_LOGIN.some((p) => p.valor === perfil)) return perfil as PerfilLogin;
  return null;
}
type RespItem = { id: string; usuario_id: string; nome: string; email: string; parentesco: string | null; ativo: boolean };
type ConviteItem = { id: string; token: string; email: string; parentesco: string | null; created_at: string };
type UserItem = { id: string; nome: string; email: string; dbv_id?: number | null };
type StatusDoc = 'OK' | 'NOK' | 'NA' | null;
type DocTipo = { campo: string; nome: string; ativo?: boolean; ordem?: number; limite_anexos?: number | null };
type DocArquivo = { url: string; nome?: string | null; tipo?: string | null; storagePath?: string | null };
type StatusRespostaAtividade = 'pendente' | 'entregue' | 'em_correcao' | 'aprovada' | 'recusada';
type UploadDocResultado = { url: string; storagePath: string };
type ItemAReceber = {
  atividade_id: number;
  titulo: string;
  tipo: 'classe' | 'especialidade';
  nome: string;
  status: StatusRespostaAtividade;
  plano_id?: number | null;
  atividades_aprovadas?: number;
  atividades_necessarias?: number;
  atividades_cadastradas?: number;
};
type EspecialidadeEntregue = {
  id?: number;
  nome: string;
  status: string;
  atividade_origem_id?: number | null;
  plano_formativo_id?: number | null;
  atividade_origem_titulo?: string | null;
  atividade_origem_excluida?: boolean | number | null;
  atividade_origem_excluida_em?: string | null;
};

const DOCS_LABELS_BASE: Record<string, string> = {
  rg: 'RG', cpf: 'CPF', rg_resp: 'RG Responsável', cartao_sus: 'Cartão SUS',
  cartao_plano: 'Cartão de Plano', ficha_saude: 'Ficha de Saúde',
  carteira_vacinacao: 'Carteira de Vacinação', laudo_medico: 'Laudo Médico',
  ficha_reg: 'Ficha de Reg. Atualizada', comp_residencia: 'Comp. Residência',
  aut_saida: 'Aut. Saída', aut_viagem: 'Aut. Viagem Autenticada',
  ri_assinado: 'RI Assinado', foto: 'Foto', ant_criminais: 'Ant. Criminais',
};

const CLASSES_LABELS: Record<string, string> = {
  amigo: 'Amigo', amigo_nat: 'Amigo da Natureza', companheiro: 'Companheiro',
  comp_exc: 'Comp. Excursionista', pesquisador: 'Pesquisador', pesquisador_cb: 'Pesquisador C.B.',
  pioneiro: 'Pioneiro', pioneiro_nf: 'Pioneiro N.F.', excursionista: 'Excursionista',
  exc_mata: 'Exc. da Mata', guia: 'Guia', guia_exp: 'Guia Exploração',
  agrupada: 'Agrupada', lider: 'Líder', lider_master: 'Líder Master', lider_ma: 'Líder MA',
};

const CORES_UNIDADE: Record<string, string> = {
  'Amor Perfeito': '#e91e63', 'Sempre Viva': '#4caf50',
  'Águia Dourada': '#ff9800', 'Leões': '#2196f3', 'Diretoria': '#9c27b0',
};

const AVATAR_CORES = [
  '#e74c3c','#e67e22','#f39c12','#2ecc71','#1abc9c',
  '#3498db','#2980b9','#9b59b6','#8e44ad','#e91e63',
  '#16a085','#27ae60','#d35400','#c0392b','#7f8c8d',
];

const MAX_ARQUIVOS = 3;

function limiteArquivosTipo(tipo?: DocTipo) {
  if (!tipo) return MAX_ARQUIVOS;
  if (tipo.campo === 'foto') return 1;
  return Math.max(1, Number(tipo.limite_anexos ?? MAX_ARQUIVOS) || MAX_ARQUIVOS);
}

function normalizarDocTipos(tipos: Array<{ campo: string; nome: string; ativo?: boolean; ordem?: number | null }>): DocTipo[] {
  return tipos.map((t, idx) => ({
    campo: t.campo,
    nome: t.nome,
    ativo: t.ativo,
    ordem: t.ordem ?? idx + 1,
  }));
}

function avatarCor(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_CORES[Math.abs(hash) % AVATAR_CORES.length];
}

function slugDocumento(nome: string) {
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 44);
  return `${base || 'documento'}_${Date.now().toString(36)}`;
}

function extensaoArquivo(nome: string) {
  const match = nome.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function arquivoPermitido(campo: string, nome: string, mime: string) {
  const ext = extensaoArquivo(nome);
  const tipo = String(mime || '').toLowerCase();
  const isImagem = tipo.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext);
  if (campo === 'foto') return isImagem;
  const isPdf = tipo === 'application/pdf' || ext === 'pdf';
  const isWord =
    tipo === 'application/msword' ||
    tipo === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ['doc', 'docx'].includes(ext);
  return isImagem || isPdf || isWord;
}

function mensagemFormatosPermitidos(campo: string) {
  if (campo === 'foto') {
    return 'A Foto 3x4 aceita apenas imagens: JPG, PNG, WEBP, HEIC ou HEIF.';
  }
  return 'Formatos permitidos: imagens (JPG, PNG, WEBP, HEIC/HEIF), PDF, DOC ou DOCX.';
}

function normalizarTextoBusca(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function campoClassePorNome(nome: string) {
  const alvo = normalizarTextoBusca(nome);
  return Object.entries(CLASSES_LABELS).find(([, label]) => normalizarTextoBusca(label) === alvo)?.[0] ?? null;
}

function statusReceberLabel(status: StatusRespostaAtividade) {
  if (status === 'aprovada') return 'Pronta para ser entregue';
  if (status === 'entregue') return 'Entregue para avaliação';
  if (status === 'em_correcao') return 'Para corrigir';
  if (status === 'recusada') return 'Recusada';
  return 'Pendente';
}

function statusReceberColor(status: StatusRespostaAtividade) {
  if (status === 'aprovada') return '#2e7d32';
  if (status === 'entregue') return '#1565c0';
  if (status === 'em_correcao') return '#ef6c00';
  if (status === 'recusada') return '#c62828';
  return '#78909c';
}

function pareceImagem(arquivo: DocArquivo) {
  const tipo = String(arquivo.tipo ?? '').toLowerCase();
  const nome = String(arquivo.nome ?? '').toLowerCase();
  const url = String(arquivo.url ?? '').toLowerCase().split('?')[0];
  return tipo.startsWith('image') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(nome) || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(url);
}

function contentTypeImagem(nome: string, mime: string) {
  const ext = extensaoArquivo(nome);
  const tipo = String(mime || '').toLowerCase();
  if (tipo.startsWith('image/')) return tipo;
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  return 'image/jpeg';
}

function extrairPathDocumentoStorage(valor?: string | null) {
  if (!valor) return null;
  const raw = String(valor);
  if (!raw.startsWith('http')) {
    return raw.startsWith('blob:') || raw.startsWith('file:') ? null : raw.replace(/^\/+/, '');
  }
  const marcador = '/storage/v1/object/';
  const idx = raw.indexOf(marcador);
  if (idx < 0 || !raw.includes('/documentos_fotos/')) return null;
  const aposObject = raw.slice(idx + marcador.length);
  const partes = aposObject.split('?')[0].split('/');
  const bucketIndex = partes.findIndex((p) => p === 'documentos_fotos');
  if (bucketIndex < 0) return null;
  return decodeURIComponent(partes.slice(bucketIndex + 1).join('/'));
}

async function resolverUrlDocumentoPrivado(valor?: string | null) {
  const path = extrairPathDocumentoStorage(valor);
  if (!path) return valor ?? '';
  const { data, error } = await supabase.storage
    .from('documentos_fotos')
    .createSignedUrl(path, 3600 * 24 * 7);
  if (error || !data?.signedUrl) {
    console.warn('[documentos] nao foi possivel assinar anexo privado:', error?.message ?? path);
    return '';
  }
  return data.signedUrl;
}

function confirmar(titulo: string, mensagem: string) {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensagem}`));
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

function escolherOpcao(titulo: string, mensagem: string, opcoes: string[]) {
  if (Platform.OS === 'web') {
    const texto = opcoes.map((o, i) => `${i + 1}. ${o}`).join('\n');
    const valor = window.prompt(`${titulo}\n${mensagem}\n\n${texto}`);
    const idx = Number(valor) - 1;
    return Promise.resolve(Number.isFinite(idx) && idx >= 0 && idx < opcoes.length ? idx : opcoes.length - 1);
  }
  return new Promise<number>((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opcoes, cancelButtonIndex: opcoes.length - 1 },
        resolve,
      );
    } else {
      Alert.alert(titulo, mensagem, opcoes.map((text, idx) => ({
        text,
        style: idx === opcoes.length - 1 ? 'cancel' : 'default',
        onPress: () => resolve(idx),
      })));
    }
  });
}

async function uploadFotoMembro(dbv_id: number, uri: string, nome = 'foto.jpg', tipo = 'image/jpeg'): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const ext = extensaoArquivo(nome) || 'jpg';
    const path = `${dbv_id}/perfil_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from('fotos_membros')
      .upload(path, blob, { upsert: true, contentType: contentTypeImagem(nome, tipo) });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('fotos_membros').getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (e) {
    console.log('Erro ao subir foto de perfil', e);
    return null;
  }
}

async function vincularFotoAoDocumento(dbv_id: number, url: string) {
  if (Platform.OS !== 'web') return;
  const clubeId = getClubeAtivoId();
  await supabase.from('documento_imagens').delete().eq('clube_id', clubeId).eq('dbv_id', dbv_id).eq('campo', 'foto');
  await supabase.from('documento_imagens').insert({
    clube_id: clubeId,
    dbv_id,
    campo: 'foto',
    url,
    nome: 'Foto 3x4',
    tipo: 'image',
  });
  await supabase
    .from('documento_status')
    .upsert(
      { clube_id: clubeId, dbv_id, campo: 'foto', status: 'OK', updated_at: new Date().toISOString() },
      { onConflict: 'dbv_id,campo' },
    );
  const { data: docExistente } = await supabase
    .from('documentos')
    .select('id')
    .eq('clube_id', clubeId)
    .eq('dbv_id', dbv_id)
    .maybeSingle();
  if (docExistente?.id) {
    await supabase
      .from('documentos')
      .update({ foto: 'OK', updated_at: new Date().toISOString() })
      .eq('id', docExistente.id);
  } else {
    await supabase
      .from('documentos')
      .insert({ clube_id: clubeId, dbv_id, foto: 'OK', updated_at: new Date().toISOString() });
  }
}

async function uploadArquivoDocumento(
  dbv_id: number,
  campo: string,
  uri: string,
  nome: string,
  tipo: string,
): Promise<UploadDocResultado | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const seguro = nome.replace(/[^\w.-]+/g, '_').slice(-70) || 'arquivo';
    const path = `${dbv_id}/${campo}_${Date.now()}_${seguro}`;
    const { data, error } = await supabase.storage
      .from('documentos_fotos')
      .upload(path, blob, { upsert: false, contentType: tipo || 'application/octet-stream' });
    if (error) throw error;
    const { data: signed } = await supabase.storage
      .from('documentos_fotos')
      .createSignedUrl(data.path, 3600 * 24 * 7);
    return signed?.signedUrl ? { url: signed.signedUrl, storagePath: data.path } : null;
  } catch {
    return null;
  }
}

export default function MembroScreen() {
  const { id, aba: abaParam } = useLocalSearchParams<{ id: string; aba?: string }>();
  const ABAS_VALIDAS: Aba[] = ['docs', 'classes', 'especs', 'receber', 'responsaveis', 'editar'];
  const [dbv, setDBV] = useState<Desbravador | null>(null);
  const [doc, setDoc] = useState<Documento | null>(null);
  const [classe, setClasse] = useState<ProgressoClasse | null>(null);
  const [especs, setEspecs] = useState<EspecialidadeEntregue[]>([]);
  const [itensAReceber, setItensAReceber] = useState<ItemAReceber[]>([]);
  const [docTipos, setDocTipos] = useState<DocTipo[]>([]);
  const [docStatus, setDocStatus] = useState<Record<string, StatusDoc>>({});
  const [arquivosDoc, setArquivosDoc] = useState<Record<string, DocArquivo[]>>({});
  const [aba, setAba] = useState<Aba>(() => ABAS_VALIDAS.includes(abaParam as Aba) ? abaParam as Aba : 'docs');
  const [upFoto, setUpFoto] = useState(false);
  const [fotoMenuVisivel, setFotoMenuVisivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [arquivoCarregando, setArquivoCarregando] = useState<string | null>(null);
  const [souConselheiro, setSouConselheiro] = useState(false);
  const [viewer, setViewer] = useState<{ campo: string; arquivos: DocArquivo[]; idx: number } | null>(null);
  const [previewFalhou, setPreviewFalhou] = useState<Record<string, boolean>>({});
  const [modalTipo, setModalTipo] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [paisPodemEditarDocs, setPaisPodemEditarDocs] = useState(false);
  const [investiduraMap, setInvestiduraMap] = useState<Record<string, boolean>>({});
  const [responsaveis, setResponsaveis] = useState<RespItem[]>([]);
  const [convites, setConvites] = useState<ConviteItem[]>([]);
  const [modalResp, setModalResp] = useState<'vincular' | 'convidar' | null>(null);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [usuariosClube, setUsuariosClube] = useState<UserItem[]>([]);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoParentesco, setNovoParentesco] = useState('');
  const [linkConvite, setLinkConvite] = useState('');
  const [salvandoResp, setSalvandoResp] = useState(false);
  const [modalLogin, setModalLogin] = useState(false);
  const [buscaLogin, setBuscaLogin] = useState('');
  const [usuariosSemVinculo, setUsuariosSemVinculo] = useState<UserItem[]>([]);
  const [salvandoLogin, setSalvandoLogin] = useState(false);
  const [headerCompacto, setHeaderCompacto] = useState(false);
  const [abasLargura, setAbasLargura] = useState(0);
  const [abasConteudoLargura, setAbasConteudoLargura] = useState(0);
  const abaInicialAdminAplicadaRef = useRef(false);

  const { atualizarDocumento, atualizarClasse, atualizarFoto, editarDesbravador, excluirDesbravador, inativarDesbravador } = useDBVStore();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const podeGerenciarDocsTodos = permissoes.temPerfil([
    'admin_ti',
    'admin_clube',
    'usuario_secretaria',
    // Perfis legados equivalentes a Admin TI/Admin clube.
    'admin_total',
    'admin_geral',
  ]);
  const podeGerenciarMembros = permissoes.pode('gerenciar_membros');
  const podeGerenciarAcessoTotal = permissoes.pode('gerenciar_acessos');
  const ehProprioMembro = String(usuario?.dbv_id) === id;
  const ehFilhoNoContexto = contextoAtivo?.tipo === 'responsavel' && String(contextoAtivo.membro_id) === id;
  const isAdmin = podeGerenciarDocsTodos || podeGerenciarMembros;
  const podeEditarUploadsDoc = podeGerenciarDocsTodos || (ehFilhoNoContexto && paisPodemEditarDocs);
  const podeEditarStatusDoc = podeEditarUploadsDoc;
  const podeEditarFotoPerfil = podeGerenciarDocsTodos || podeGerenciarMembros;
  const podeVerArquivosDoc = podeGerenciarDocsTodos || ehFilhoNoContexto || ehProprioMembro;

  // ── Form edição ──────────────────────────────────────────────────────
  const [form, setForm] = useState<FormDBV>(FORM_VAZIO);
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [upFotoForm, setUpFotoForm] = useState(false);
  const [mfaConfirmando, setMfaConfirmando] = useState(false);
  const [mfaMensagem, setMfaMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [cargosModelo, setCargosModelo] = useState<CargoModelo[]>(CARGOS_EDIT);
  const [unidades, setUnidades] = useState<UnidadeEdit[]>(UNIDADES_PADRAO_EDIT);
  const nascimentoDefault = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 10); return d; })();
  const nascimentoMin = new Date(1950, 0, 1);
  const idadeForm = idadePorNascimento(form.data_nascimento);
  const perfilTravadoComoDesbravador = idadeForm !== null && idadeForm <= 15;
  const perfilAdultoObrigatorio = idadeForm !== null && idadeForm > 15;
  // ─────────────────────────────────────────────────────────────────────

  useEffect(() => { carregarDados(); }, [id]);
  useEffect(() => { if (isAdmin) { carregarResponsaveis(); carregarCargosModelo().then(setCargosModelo).catch(() => {}); carregarUnidadesEdit(); } }, [id]);
  useEffect(() => {
    if (abaInicialAdminAplicadaRef.current || abaParam || !isAdmin) return;
    abaInicialAdminAplicadaRef.current = true;
    setAba('editar');
  }, [abaParam, isAdmin]);
  useEffect(() => {
    if (!dbv || !(podeGerenciarMembros || podeGerenciarDocsTodos)) return;
    initializarFormEdicao(dbv).catch(() => {});
  }, [dbv?.id, podeGerenciarMembros, podeGerenciarDocsTodos]);

  async function carregarUnidadesEdit() {
    if (Platform.OS !== 'web') return;
    const { data } = await supabase.from('unidades').select('id,nome,cor').eq('clube_id', getClubeAtivoId()).order('nome');
    if (data && data.length > 0) setUnidades(data as UnidadeEdit[]);
  }

  async function initializarFormEdicao(d: Desbravador) {
    const generoInicial = d.genero ?? 'M';
    const idadeInicial = idadePorNascimento(d.data_nascimento);
    const cargos = await carregarCargosModelo().catch(() => CARGOS_EDIT);
    setCargosModelo(cargos);
    const cargoInicial = ajustarCargoPorIdade(cargoParaFormulario(d.cargo, generoInicial, cargos), idadeInicial, cargos);
    const login = await buscarPerfilLoginEdit(d.id, d.email ?? '');
    const perfilInicial = ajustarPerfilPorIdade(login?.perfil ?? perfilPadraoMembro(), idadeInicial);
    setForm({
      nome: d.nome, genero: generoInicial, data_nascimento: d.data_nascimento ?? '',
      cargo: cargoInicial, unidade_id: String(d.unidade_id ?? ''), unidade_nome: d.unidade_nome ?? '',
      cargo_adicional: cargoParaFormulario(d.cargo_adicional, generoInicial, cargos),
      email: login?.email ?? d.email ?? '', contato: d.contato ?? '',
      camisa: d.camisa ?? '', calca: d.calca ?? '',
      nome_responsavel: d.nome_responsavel ?? '', contato_responsavel: d.contato_responsavel ?? '',
      foto_url: d.foto_url ?? '', senha: '',
      perfil_login: perfilInicial, login_user_id: login?.id ?? '',
    });
  }

  async function buscarPerfilLoginEdit(dbvId: number, email: string) {
    const clubeId = getClubeAtivoId();
    let { data } = await supabase.from('usuarios').select('id,email,perfil').eq('dbv_id', dbvId).maybeSingle();
    if (!data && email) {
      const resp = await supabase.from('usuarios').select('id,email,perfil').eq('email', email.toLowerCase()).maybeSingle();
      data = resp.data;
    }
    let perfil = normalizarPerfilLogin(data?.perfil);
    if (data?.id) {
      const { data: vinculos } = await supabase.from('usuario_clubes').select('perfil').eq('usuario_id', data.id).eq('clube_id', clubeId).eq('ativo', true).order('id', { ascending: false }).limit(1);
      const perfilCtx = normalizarPerfilLogin(vinculos?.[0]?.perfil);
      if (perfilCtx) perfil = perfilCtx;
    }
    if (!data?.email && !(perfil && PERFIS_LOGIN.some((p) => p.valor === perfil))) return null;
    return { id: data?.id ?? '', email: data?.email ?? email, perfil: perfil && PERFIS_LOGIN.some((p) => p.valor === perfil) ? perfil : perfilPadraoMembro() };
  }

  async function tentarGerenciarAcesso(targetUserId: string, perfil: PerfilLogin, dbvId: number) {
    try {
      const { error } = await supabase.rpc('gerenciar_acesso_usuario', {
        target_user_id: targetUserId,
        novo_perfil: perfil,
        novo_dbv_id: dbvId,
        remover_acesso: false,
      });
      if (error) console.log('gerenciar_acesso_usuario falhou', error);
    } catch (e) {
      console.log('gerenciar_acesso_usuario indisponível', e);
    }
  }

  async function sincronizarVinculoClube(userId: string, dbvId: number, unidadeId: number | null, perfil: PerfilLogin) {
    const clubeId = getClubeAtivoId();
    const perfilSalvo = perfil;
    const { data: updated, error: updateError } = await supabase.from('usuario_clubes')
      .update({ membro_id: dbvId, unidade_id: unidadeId, perfil: perfilSalvo, ativo: true })
      .eq('usuario_id', userId).eq('clube_id', clubeId).select('id');
    if (updateError) throw updateError;
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase.from('usuario_clubes').insert({ usuario_id: userId, clube_id: clubeId, membro_id: dbvId, unidade_id: unidadeId, perfil: perfilSalvo, ativo: true });
      if (insertError) throw insertError;
    }
  }

  async function atualizarPerfilLoginExistente(dbvId: number, email: string, nome: string, unidadeId: number | null, perfil: PerfilLogin) {
    let { data: existente } = await supabase.from('usuarios').select('id').eq('dbv_id', dbvId).maybeSingle();
    if (!existente) {
      const resp = await supabase.from('usuarios').select('id').eq('email', email).maybeSingle();
      existente = resp.data;
    }
    if (existente?.id) {
      await tentarGerenciarAcesso(existente.id, perfil, dbvId);
      await supabase.from('usuarios').update({ email, nome, perfil, unidade_id: unidadeId, dbv_id: dbvId }).eq('id', existente.id);
      await sincronizarVinculoClube(existente.id, dbvId, unidadeId, perfil);
    }
  }

  async function atualizarCredenciaisLoginExistente(
    userId: string,
    dbvId: number,
    email: string,
    senha: string,
    nome: string,
    unidadeId: number | null,
    perfil: PerfilLogin,
  ) {
    if (!email) throw new Error('Informe o e-mail do login.');
    if (senha && senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');

    const { error } = await supabase.rpc('atualizar_login_membro', {
      target_user_id: userId,
      novo_email: email,
      nova_senha: senha || null,
      novo_nome: nome,
      novo_perfil: perfil,
      novo_dbv_id: dbvId,
      novo_unidade_id: unidadeId,
    });
    if (error) throw error;

    await sincronizarVinculoClube(userId, dbvId, unidadeId, perfil);
    await registrarAuditoria({
      acao: senha ? 'atualizar_email_senha_login' : 'atualizar_email_login',
      entidade: 'usuarios',
      entidadeId: userId,
      membroId: dbvId,
      alvoUserId: userId,
      depois: { email, perfil, dbv_id: dbvId, unidade_id: unidadeId, senha_alterada: !!senha },
    }).catch(() => {});
  }

  async function criarLoginMembro(dbvId: number, email: string, senha: string, nome: string, unidadeId: number | null, perfil: PerfilLogin) {
    if (senha.length < 6) { Alert.alert('Login não criado', 'A senha precisa ter pelo menos 6 caracteres.'); return; }
    const { data: existente } = await supabase.from('usuarios').select('id').eq('email', email).maybeSingle();
    if (existente?.id) {
      await supabase.from('usuarios').update({ nome, perfil, unidade_id: unidadeId, dbv_id: dbvId }).eq('id', existente.id);
      await sincronizarVinculoClube(existente.id, dbvId, unidadeId, perfil);
      return;
    }
    const { data: sessaoAtual } = await supabase.auth.getSession();
    const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome, perfil, unidade_id: unidadeId, dbv_id: dbvId }, emailRedirectTo: 'dbvfonseca://auth/callback' } });
    if (sessaoAtual.session) {
      await supabase.auth.setSession({ access_token: sessaoAtual.session.access_token, refresh_token: sessaoAtual.session.refresh_token });
    }
    if (error) throw error;
    if (data.user?.id) {
      await supabase.from('usuarios').upsert({ id: data.user.id, email, nome, perfil, unidade_id: unidadeId, dbv_id: dbvId });
      await sincronizarVinculoClube(data.user.id, dbvId, unidadeId, perfil);
    }
  }

  async function executarResetMfa() {
    setMfaConfirmando(false);
    setMfaMensagem(null);
    try {
      const { error } = await supabase.rpc('resetar_mfa_usuario', { target_user_id: form.login_user_id });
      if (error) throw error;
      setMfaMensagem({ tipo: 'ok', texto: 'MFA resetado. No próximo login o usuário precisará configurar novamente.' });
    } catch (e: any) {
      setMfaMensagem({ tipo: 'erro', texto: e?.message ?? 'Não foi possível resetar o MFA.' });
    }
  }

  async function removerAcessoDoMembro() {
    if (!form.login_user_id || !dbv) return;
    if (form.login_user_id === usuario?.id) {
      Alert.alert('Ação bloqueada', 'Você não pode remover seu próprio acesso enquanto estiver logado.');
      return;
    }
    const confirmado = await confirmar(
      'Remover acesso',
      `Remover as permissões de login de ${dbv.nome}? O cadastro e os históricos do membro serão preservados.`,
    );
    if (!confirmado) return;
    setSalvandoEdit(true);
    try {
      const { error } = await supabase.rpc('gerenciar_acesso_usuario', {
        target_user_id: form.login_user_id,
        novo_perfil: perfilPadraoMembro(),
        novo_dbv_id: null,
        remover_acesso: true,
      });
      if (error) throw error;
      const { error: vinculoError } = await supabase
        .from('usuario_clubes')
        .update({ ativo: false })
        .eq('usuario_id', form.login_user_id)
        .eq('clube_id', getClubeAtivoId());
      if (vinculoError) throw vinculoError;
      await registrarAuditoria({
        acao: 'remover_acesso',
        entidade: 'usuarios',
        entidadeId: form.login_user_id,
        membroId: Number(id),
        alvoUserId: form.login_user_id,
        antes: { perfil: form.perfil_login, dbv_id: Number(id) },
        depois: { removido: true },
      });
      setForm((f) => ({ ...f, login_user_id: '', senha: '', perfil_login: perfilPadraoMembro() }));
      Alert.alert('Acesso removido', 'O cadastro do membro foi mantido, mas o login não possui mais acesso a este clube.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível remover o acesso.');
    } finally {
      setSalvandoEdit(false);
    }
  }

  async function buscarUsuariosSemVinculo(texto: string) {
    const termo = texto.replace(/[,%()]/g, ' ').trim();
    if (!termo) {
      setUsuariosSemVinculo([]);
      return;
    }
    let consulta = supabase
      .from('usuarios')
      .select('id,nome,email,dbv_id')
      .is('dbv_id', null)
      .order('nome')
      .limit(20);
    consulta = (consulta as any).or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`);
    const { data, error } = await consulta;
    if (error) {
      Alert.alert('Erro', 'Não foi possível localizar os usuários disponíveis.');
      return;
    }
    setUsuariosSemVinculo((data ?? []) as UserItem[]);
  }

  async function vincularLoginAoMembro(conta: UserItem) {
    if (!dbv) return;
    setSalvandoLogin(true);
    try {
      const perfilFinal = ajustarPerfilPorIdade(form.perfil_login, idadePorNascimento(form.data_nascimento));
      await tentarGerenciarAcesso(conta.id, perfilFinal, Number(id));
      const { error: usuarioError } = await supabase
        .from('usuarios')
        .update({
          nome: form.nome.trim() || dbv.nome,
          perfil: perfilFinal,
          unidade_id: form.unidade_id ? Number(form.unidade_id) : null,
          dbv_id: Number(id),
        })
        .eq('id', conta.id);
      if (usuarioError) throw usuarioError;
      await sincronizarVinculoClube(
        conta.id,
        Number(id),
        form.unidade_id ? Number(form.unidade_id) : null,
        perfilFinal,
      );
      await registrarAuditoria({
        acao: 'vincular_login_membro',
        entidade: 'usuarios',
        entidadeId: conta.id,
        membroId: Number(id),
        alvoUserId: conta.id,
        antes: { dbv_id: null },
        depois: { dbv_id: Number(id), perfil: perfilFinal },
      });
      setForm((f) => ({ ...f, email: conta.email, login_user_id: conta.id, perfil_login: perfilFinal }));
      setModalLogin(false);
      setBuscaLogin('');
      setUsuariosSemVinculo([]);
      Alert.alert('Login vinculado', `${conta.email} agora está vinculado a ${dbv.nome}.`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível vincular o login ao membro.');
    } finally {
      setSalvandoLogin(false);
    }
  }

  async function salvarEdicao() {
    if (!form.nome.trim()) { Alert.alert('Atenção', 'Nome é obrigatório.'); return; }
    setSalvandoEdit(true);
    try {
      const dbvId = Number(id);
      const idadeFinal = idadePorNascimento(form.data_nascimento);
      let cargoFinal = ajustarCargoPorIdade(form.cargo, idadeFinal, cargosModelo);
      let cargoAdicionalFinal = ajustarCargoPorIdade(form.cargo_adicional, idadeFinal, cargosModelo);
      if (ehFuncaoJuvenil(cargoFinal)) {
        cargoAdicionalFinal = cargoFinal;
        const cargoMembro = cargosModelo.find((c) => c.tipo === 'membro') ?? CARGOS_EDIT[0];
        cargoFinal = cargoLabel(cargoMembro, form.genero);
      }
      const perfilFinal = ajustarPerfilPorIdade(form.perfil_login, idadeFinal);
      const nomesResponsaveisAtivos = responsaveis
        .filter((r) => r.ativo)
        .map((r) => r.nome)
        .filter(Boolean)
        .join(', ');
      const dados = {
        nome: form.nome.trim(), genero: form.genero as 'M' | 'F',
        data_nascimento: form.data_nascimento || null, idade: idadeFinal,
        cargo: cargoFinal || null,
        cargo_adicional: cargoAdicionalFinal || null,
        unidade_id: form.unidade_id ? Number(form.unidade_id) : null,
        unidade_nome: form.unidade_nome || null,
        email: form.email || null, contato: form.contato || null,
        camisa: form.camisa || null, calca: form.calca || null,
        nome_responsavel: nomesResponsaveisAtivos || form.nome_responsavel || null,
        contato_responsavel: form.contato_responsavel || null,
      };
      await editarDesbravador(dbvId, dados as any);
      const emailLogin = form.email.trim().toLowerCase();
      const senhaLogin = form.senha.trim();
      if (form.login_user_id && emailLogin) {
        await atualizarCredenciaisLoginExistente(
          form.login_user_id,
          dbvId,
          emailLogin,
          senhaLogin,
          form.nome.trim(),
          dados.unidade_id,
          perfilFinal,
        );
      } else if (emailLogin && senhaLogin) {
        await criarLoginMembro(dbvId, emailLogin, senhaLogin, form.nome.trim(), dados.unidade_id, perfilFinal)
          .catch((e) => Alert.alert('Membro salvo', `Login não criado: ${e?.message ?? e}`));
      } else if (emailLogin) {
        await atualizarPerfilLoginExistente(dbvId, emailLogin, form.nome.trim(), dados.unidade_id, perfilFinal)
          .catch(() => {});
      }
      const fotoLocal = !!form.foto_url && !/^https?:\/\//i.test(form.foto_url);
      if (fotoLocal) {
        setUpFotoForm(true);
        const url = await uploadFotoMembro(dbvId, form.foto_url);
        if (url) {
          await atualizarFoto(dbvId, url);
          await vincularFotoAoDocumento(dbvId, url);
          setForm((f) => ({ ...f, foto_url: url }));
        } else {
          Alert.alert('Atenção', 'Foto salva localmente. Será enviada ao conectar à internet.');
        }
        setUpFotoForm(false);
      }
      if (Platform.OS !== 'web') await sincronizarTudo().catch(() => null);
      await carregarDados();
      Alert.alert('Sucesso', 'Dados do membro atualizados.');
    } catch (e: any) {
      Alert.alert('Erro ao salvar', e?.message || JSON.stringify(e));
    } finally {
      setSalvandoEdit(false);
      setUpFotoForm(false);
    }
  }

  function selecionarUnidade(u: UnidadeEdit) {
    setForm((f) => ({ ...f, unidade_id: String(u.id), unidade_nome: u.nome }));
  }

  function confirmarInativarMembro() {
    const executar = async () => { try { await inativarDesbravador(Number(id)); await carregarDados(); } catch (e: any) { Alert.alert('Erro', e?.message ?? 'Não foi possível inativar.'); } };
    if (Platform.OS === 'web') { if (window.confirm(`Inativar ${dbv?.nome}?\n\nO histórico será preservado.`)) executar(); return; }
    Alert.alert('Inativar membro', `${dbv?.nome} ficará oculto das listas, mas seu histórico será preservado.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Inativar', style: 'destructive', onPress: executar },
    ]);
  }

  async function reativarMembro() {
    try { await editarDesbravador(Number(id), { ativo: true } as any); await carregarDados(); }
    catch (e: any) { Alert.alert('Erro', e?.message ?? 'Não foi possível reativar.'); }
  }

  function confirmarExcluirMembro() {
    const executar = async () => { try { await excluirDesbravador(Number(id)); router.replace('/membros'); } catch (e: any) { Alert.alert('Erro', e?.message ?? 'Não foi possível excluir.'); } };
    if (Platform.OS === 'web') { if (window.confirm(`Excluir ${dbv?.nome}?\n\nIsso removerá o membro e seus dados vinculados.`)) executar(); return; }
    Alert.alert('Excluir membro', `Isso removerá ${dbv?.nome} e todos seus dados.\n\nDeseja continuar?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: executar },
    ]);
  }

  function statusComRegraDeAnexo(campo: string, valor: StatusDoc): StatusDoc {
    if (valor === 'NA') return 'NA';
    if (valor === 'OK') return (arquivosDoc[campo] ?? []).length > 0 ? 'OK' : null;
    return null;
  }

  function statusDoc(campo: string): StatusDoc {
    if (docStatus[campo] !== undefined) {
      const val = docStatus[campo];
      return statusComRegraDeAnexo(campo, val === 'OK' || val === 'NA' ? val : null);
    }
    if (doc && Object.prototype.hasOwnProperty.call(DOCS_LABELS_BASE, campo)) {
      const val = ((doc as any)[campo] || null) as StatusDoc;
      return statusComRegraDeAnexo(campo, val === 'OK' || val === 'NA' ? val : null);
    }
    return null;
  }

  function investKey(tipo: 'classe' | 'especialidade', nome: string) {
    return `${tipo}:${nome}`;
  }

  async function carregarItensFormativosAReceber(
    dbvId: number,
    membro: any,
    especialidadesAtuais: Array<{ nome: string; status: string }>,
    classesAtuais: any,
  ) {
    try {
      const clubeId = getClubeAtivoId();
      const { data: atividades } = await supabase
        .from('atividades')
        .select('id,titulo,destino,unidade_id,dbv_id,item_formativo_tipo,item_formativo_nome,plano_formativo_id')
        .eq('clube_id', clubeId)
        .not('item_formativo_tipo', 'is', null)
        .not('item_formativo_nome', 'is', null);

      const listaAtividades = (atividades ?? []) as Array<{
        id: number;
        titulo: string;
        destino: string | null;
        unidade_id: number | null;
        dbv_id: number | null;
        item_formativo_tipo: 'classe' | 'especialidade' | null;
        item_formativo_nome: string | null;
        plano_formativo_id: number | null;
      }>;
      if (listaAtividades.length === 0) {
        setItensAReceber([]);
        return;
      }

      const ids = listaAtividades.map((a) => a.id);
      const planoIds = [...new Set(listaAtividades.map((a) => a.plano_formativo_id).filter((planoId): planoId is number => !!planoId))];
      const [{ data: alvos }, { data: respostas }, planosResponse] = await Promise.all([
        supabase
          .from('atividades_alvos')
          .select('atividade_id,tipo,unidade_id,membro_id')
          .eq('clube_id', clubeId)
          .in('atividade_id', ids),
        supabase
          .from('atividades_respostas')
          .select('atividade_id,status')
          .eq('clube_id', clubeId)
          .eq('dbv_id', dbvId)
          .in('atividade_id', ids),
        planoIds.length > 0
          ? supabase.from('planos_formativos').select('id,titulo,avaliacoes_necessarias').in('id', planoIds)
          : Promise.resolve({ data: [] as Array<{ id: number; titulo: string; avaliacoes_necessarias: number }> }),
      ]);
      const planosMap = new Map<number, { id: number; titulo: string; avaliacoes_necessarias: number }>(
        ((planosResponse.data ?? []) as Array<{ id: number; titulo: string; avaliacoes_necessarias: number }>).map((p) => [p.id, p]),
      );

      const alvosPorAtividade = new Map<number, any[]>();
      for (const alvo of (alvos ?? []) as any[]) {
        const arr = alvosPorAtividade.get(alvo.atividade_id) ?? [];
        arr.push(alvo);
        alvosPorAtividade.set(alvo.atividade_id, arr);
      }

      const respostasPorAtividade = new Map<number, StatusRespostaAtividade>();
      for (const resp of (respostas ?? []) as Array<{ atividade_id: number; status: StatusRespostaAtividade | null }>) {
        respostasPorAtividade.set(resp.atividade_id, resp.status ?? 'entregue');
      }

      const especsOK = new Set(
        especialidadesAtuais
          .filter((e) => e.status === 'OK')
          .map((e) => normalizarTextoBusca(e.nome)),
      );

      const resultado: ItemAReceber[] = [];
      const itensPorPlano = new Map<number, {
        plano: { id: number; titulo: string; avaliacoes_necessarias: number };
        atividade: typeof listaAtividades[number];
        statuses: StatusRespostaAtividade[];
      }>();
      for (const atividade of listaAtividades) {
        if (!atividade.item_formativo_tipo || !atividade.item_formativo_nome) continue;

        const alvosAtividade = alvosPorAtividade.get(atividade.id) ?? [];
        const estaNoAlvo = alvosAtividade.length > 0
          ? alvosAtividade.some((alvo) =>
              alvo.tipo === 'todos'
              || (alvo.tipo === 'unidade' && Number(alvo.unidade_id) === Number(membro?.unidade_id))
              || (alvo.tipo === 'membro' && Number(alvo.membro_id) === dbvId)
            )
          : (
              atividade.destino === 'todos'
              || (atividade.destino === 'unidade' && Number(atividade.unidade_id) === Number(membro?.unidade_id))
              || (atividade.destino === 'desbravador' && Number(atividade.dbv_id) === dbvId)
            );
        if (!estaNoAlvo) continue;

        if (atividade.item_formativo_tipo === 'especialidade' && especsOK.has(normalizarTextoBusca(atividade.item_formativo_nome))) {
          continue;
        }
        if (atividade.item_formativo_tipo === 'classe') {
          const campoClasse = campoClassePorNome(atividade.item_formativo_nome);
          if (campoClasse && classesAtuais?.[campoClasse] === 'OK') continue;
        }

        const status = respostasPorAtividade.get(atividade.id) ?? 'pendente';
        const plano = atividade.plano_formativo_id ? planosMap.get(atividade.plano_formativo_id) : null;
        if (plano) {
          const atual = itensPorPlano.get(plano.id);
          if (atual) atual.statuses.push(status);
          else itensPorPlano.set(plano.id, { plano, atividade, statuses: [status] });
        } else {
          resultado.push({
            atividade_id: atividade.id,
            titulo: atividade.titulo,
            tipo: atividade.item_formativo_tipo,
            nome: atividade.item_formativo_nome,
            status,
          });
        }
      }
      for (const { plano, atividade, statuses } of itensPorPlano.values()) {
        const aprovadas = statuses.filter((status) => status === 'aprovada').length;
        const pronta = aprovadas >= plano.avaliacoes_necessarias;
        const status: StatusRespostaAtividade = pronta
          ? 'aprovada'
          : statuses.includes('em_correcao')
            ? 'em_correcao'
            : statuses.includes('entregue')
              ? 'entregue'
              : statuses.includes('recusada')
                ? 'recusada'
                : 'pendente';
        resultado.push({
          atividade_id: atividade.id,
          titulo: plano.titulo,
          tipo: atividade.item_formativo_tipo!,
          nome: atividade.item_formativo_nome!,
          status,
          plano_id: plano.id,
          atividades_aprovadas: aprovadas,
          atividades_necessarias: plano.avaliacoes_necessarias,
          atividades_cadastradas: statuses.length,
        });
      }
      setItensAReceber(resultado);
    } catch (e) {
      console.log('Erro ao carregar itens formativos a receber', e);
      setItensAReceber([]);
    }
  }

  async function carregarDados() {
    setCarregando(true);
    const dbvId = Number(id);

    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const [
        { data: d, error: dErro },
        { data: dc },
        { data: cl },
        { data: es },
        { data: tipos },
        { data: statuses },
        { data: imgs },
        { data: invs },
      ] = await Promise.all([
        supabase.from('desbravadores').select('*').eq('clube_id', clubeId).eq('id', dbvId).maybeSingle(),
        supabase.from('documentos').select('*').eq('clube_id', clubeId).eq('dbv_id', dbvId).maybeSingle(),
        supabase.from('progresso_classes').select('*').eq('clube_id', clubeId).eq('dbv_id', dbvId).maybeSingle(),
        supabase.from('especialidades').select('id,nome,status,atividade_origem_id,plano_formativo_id,atividade_origem_titulo,atividade_origem_excluida,atividade_origem_excluida_em').eq('clube_id', clubeId).eq('dbv_id', dbvId).order('nome'),
        supabase.from('documentos_modelo').select('campo,nome,ativo,ordem,limite_anexos').eq('clube_id', clubeId).eq('ativo', true).order('ordem'),
        supabase.from('documento_status').select('campo,status').eq('clube_id', clubeId).eq('dbv_id', dbvId),
        supabase.from('documento_imagens').select('campo,url,nome,tipo').eq('clube_id', clubeId).eq('dbv_id', dbvId).order('created_at'),
        supabase.from('investidura_itens').select('tipo,item_nome,marcado').eq('clube_id', clubeId).eq('dbv_id', dbvId).eq('marcado', true),
      ]);

      if (dErro) Alert.alert('Erro', 'Não foi possível carregar este membro.');

      if (usuario?.dbv_id) {
        const { data: meu } = await supabase
          .from('desbravadores')
          .select('cargo')
          .eq('clube_id', clubeId)
          .eq('id', usuario.dbv_id)
          .maybeSingle();
        const cargo = String(meu?.cargo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        setSouConselheiro(cargo.includes('conselheiro') || cargo === 'con');
      } else {
        setSouConselheiro(false);
      }

      const cfgPais = await carregarDocumentosPaisConfig(clubeId);
      setPaisPodemEditarDocs(janelaPaisAberta(cfgPais));

      const statusMap: Record<string, StatusDoc> = {};
      for (const s of (statuses ?? []) as Array<{ campo: string; status: StatusDoc }>) {
        statusMap[s.campo] = s.status;
      }

      const arquivosMap: Record<string, DocArquivo[]> = {};
      for (const img of (imgs ?? []) as DocArquivo[] & Array<{ campo: string }>) {
        if (!arquivosMap[img.campo]) arquivosMap[img.campo] = [];
        const storagePath = img.campo === 'foto' ? null : extrairPathDocumentoStorage(img.url);
        const urlResolvida = img.campo === 'foto' ? img.url : await resolverUrlDocumentoPrivado(img.url);
        arquivosMap[img.campo].push({ url: urlResolvida, nome: img.nome, tipo: img.tipo ?? 'image', storagePath });
      }

      const investMap: Record<string, boolean> = {};
      for (const inv of (invs ?? []) as Array<{ tipo: 'classe' | 'especialidade'; item_nome: string; marcado: boolean }>) {
        investMap[investKey(inv.tipo, inv.item_nome)] = !!inv.marcado;
      }

      const tiposFinal = (tipos && tipos.length > 0)
        ? tipos as DocTipo[]
        : normalizarDocTipos(await carregarDocumentosModelo());

      await carregarItensFormativosAReceber(
        dbvId,
        d,
        (es ?? []) as EspecialidadeEntregue[],
        cl,
      );

      setDBV(d as Desbravador | null);
      setDoc(dc as Documento | null);
      setClasse(cl as ProgressoClasse | null);
      setEspecs((es ?? []) as EspecialidadeEntregue[]);
      setDocTipos(tiposFinal);
      setDocStatus(statusMap);
      setArquivosDoc(arquivosMap);
      setInvestiduraMap(investMap);
      setCarregando(false);
      return;
    }

    const db = await getDB();
    const d = await db.getFirstAsync<Desbravador>('SELECT * FROM desbravadores WHERE id = ?', [id]);
    const dc = await db.getFirstAsync<Documento>('SELECT * FROM documentos WHERE dbv_id = ?', [id]);
    const cl = await db.getFirstAsync<ProgressoClasse>('SELECT * FROM progresso_classes WHERE dbv_id = ?', [id]);
    const es = await db.getAllAsync<EspecialidadeEntregue>(
      `SELECT id, nome, status, atividade_origem_id, plano_formativo_id, atividade_origem_titulo,
              atividade_origem_excluida, atividade_origem_excluida_em
       FROM especialidades WHERE dbv_id = ?`,
      [id],
    );
    const imgs = await db.getAllAsync<{ campo: string; url: string }>(
      'SELECT campo, url FROM documento_imagens WHERE dbv_id = ? ORDER BY created_at ASC',
      [id],
    );

    const arquivosMap: Record<string, DocArquivo[]> = {};
    for (const img of imgs) {
      if (!arquivosMap[img.campo]) arquivosMap[img.campo] = [];
      arquivosMap[img.campo].push({ url: img.url, nome: 'Imagem', tipo: 'image' });
    }

    setDBV(d);
    setDoc(dc);
    setClasse(cl);
    setEspecs(es);
    setItensAReceber([]);
    setDocTipos(normalizarDocTipos(await carregarDocumentosModelo()));
    setPaisPodemEditarDocs(false);
    setArquivosDoc(arquivosMap);
    setInvestiduraMap({});
    setCarregando(false);
  }

  async function escolherFotoPerfil() {
    if (!podeEditarFotoPerfil) return;
    if (Platform.OS === 'web') {
      setFotoMenuVisivel(true);
      return;
    }
    const escolha = await escolherOpcao('Foto de perfil', 'Escolha uma opção', ['Tirar foto', 'Escolher da galeria', 'Cancelar']);
    if (escolha === 2) return;

    let result: ImagePicker.ImagePickerResult;
    if (escolha === 0) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permissão necessária', 'Permita acesso à câmera.');
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.75 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permissão necessária', 'Permita acesso à galeria.');
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
    }
    if (result.canceled || !result.assets[0]) return;
    setUpFoto(true);
    const asset = result.assets[0];
    const url = await uploadFotoMembro(Number(id), asset.uri, asset.fileName ?? 'foto.jpg', asset.mimeType ?? 'image/jpeg');
    const fotoFinal = url ?? result.assets[0].uri;
    await atualizarFoto(Number(id), fotoFinal);
    setDBV((prev) => prev ? { ...prev, foto_url: fotoFinal } : prev);
    setUpFoto(false);
  }

  function escolherFotoPerfilWeb(capturar: boolean) {
    setFotoMenuVisivel(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capturar) input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        Alert.alert('Formato inválido', 'A foto 3x4 aceita apenas imagens.');
        return;
      }
      const localUrl = URL.createObjectURL(file);
      setUpFoto(true);
      try {
        const url = await uploadFotoMembro(Number(id), localUrl, file.name || 'foto.jpg', file.type || 'image/jpeg');
        const fotoFinal = url ?? localUrl;
        await atualizarFoto(Number(id), fotoFinal);
        if (url) await vincularFotoAoDocumento(Number(id), url);
        setDBV((prev) => prev ? { ...prev, foto_url: fotoFinal } : prev);
        setForm((prev) => ({ ...prev, foto_url: fotoFinal }));
      } catch (e: any) {
        Alert.alert('Erro', e?.message ?? 'Não foi possível atualizar a foto.');
      } finally {
        setUpFoto(false);
      }
    };
    input.click();
  }

  async function atualizarStatusDocumento(campo: string, status: StatusDoc) {
    const dbvId = Number(id);
    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      if (status) {
        const { error } = await supabase
          .from('documento_status')
          .upsert({ clube_id: clubeId, dbv_id: dbvId, campo, status, updated_at: new Date().toISOString() }, { onConflict: 'dbv_id,campo' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('documento_status')
          .delete()
          .eq('clube_id', clubeId)
          .eq('dbv_id', dbvId)
          .eq('campo', campo);
        if (error) throw error;
      }
    }

    if (Object.prototype.hasOwnProperty.call(DOCS_LABELS_BASE, campo)) {
      await atualizarDocumento(dbvId, campo, status ?? '');
      setDoc((prev) => prev ? { ...prev, [campo]: status } : prev);
    }
    setDocStatus((prev) => {
      const next = { ...prev };
      if (status) next[campo] = status;
      else delete next[campo];
      return next;
    });
  }

  async function toggleDoc(campo: string, valorAtual: StatusDoc) {
    if ((arquivosDoc[campo] ?? []).length > 0) return;
    const novoValor: StatusDoc = valorAtual === 'NA' ? null : 'NA';
    setDocStatus((prev) => {
      const next = { ...prev };
      if (novoValor) next[campo] = novoValor;
      else delete next[campo];
      return next;
    });
    if (Object.prototype.hasOwnProperty.call(DOCS_LABELS_BASE, campo)) {
      setDoc((prev) => prev ? { ...prev, [campo]: novoValor } : prev);
    }
    try {
      await atualizarStatusDocumento(campo, novoValor);
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o status do documento.');
      await carregarDados();
    }
  }

  async function escolherArquivoDoc(campo: string, origem: 'camera' | 'arquivo') {
    const podeEditarEsteDoc = campo === 'foto' ? podeGerenciarDocsTodos : podeEditarUploadsDoc;
    if (!podeEditarEsteDoc) return;
    const atual = arquivosDoc[campo] ?? [];
    const limite = limiteArquivosTipo(docTipos.find((d) => d.campo === campo));
    if (atual.length >= limite) {
      Alert.alert('Limite atingido', `Máximo de ${limite} ${limite === 1 ? 'arquivo' : 'arquivos'} para este documento.`);
      return;
    }

    let uri = '';
    let nome = '';
    let tipo = '';

    if (origem === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permissão necessária', 'Permita acesso à câmera.');
      const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      if (result.canceled || !result.assets[0]) return;
      uri = result.assets[0].uri;
      nome = `imagem_${Date.now()}.jpg`;
      tipo = 'image/jpeg';
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      uri = result.assets[0].uri;
      nome = result.assets[0].name || `arquivo_${Date.now()}`;
      tipo = result.assets[0].mimeType || 'application/octet-stream';
      if (!arquivoPermitido(campo, nome, tipo)) {
        Alert.alert('Formato não permitido', mensagemFormatosPermitidos(campo));
        return;
      }
    }

    setArquivoCarregando(campo);
    try {
      const uploadPrivado = campo === 'foto'
        ? null
        : await uploadArquivoDocumento(Number(id), campo, uri, nome, tipo);
      let url = campo === 'foto'
        ? await uploadFotoMembro(Number(id), uri, nome, tipo)
        : uploadPrivado?.url;
      let urlParaBanco = campo === 'foto' ? url : uploadPrivado?.storagePath;
      if (campo === 'foto' && !url) {
        const fallbackPrivado = await uploadArquivoDocumento(Number(id), campo, uri, nome, tipo);
        url = fallbackPrivado?.url ?? null;
        urlParaBanco = fallbackPrivado?.storagePath ?? url;
      }
      if (Platform.OS === 'web' && !url) {
        throw new Error('Falha no upload do arquivo.');
      }
      const arquivoFinal = {
        url: url ?? uri,
        nome,
        tipo: tipo.startsWith('image/') ? 'image' : tipo,
        storagePath: campo === 'foto' ? null : urlParaBanco,
      };

      if (Platform.OS === 'web' && url) {
        const clubeId = getClubeAtivoId();
        if (campo === 'foto') {
          await supabase.from('documento_imagens').delete().eq('clube_id', clubeId).eq('dbv_id', Number(id)).eq('campo', 'foto');
        }
        const { error } = await supabase.from('documento_imagens').insert({
          clube_id: clubeId,
          dbv_id: Number(id),
          campo,
          url: urlParaBanco ?? url,
          nome,
          tipo: arquivoFinal.tipo,
        });
        if (error) throw error;
      } else if (Platform.OS !== 'web') {
        const db = await getDB();
        if (campo === 'foto') {
          await db.runAsync('DELETE FROM documento_imagens WHERE dbv_id = ? AND campo = ?', [Number(id), 'foto']);
        }
        await db.runAsync(
          'INSERT INTO documento_imagens (dbv_id, campo, url) VALUES (?, ?, ?)',
          [Number(id), campo, arquivoFinal.url],
        );
      }

      setArquivosDoc((prev) => ({ ...prev, [campo]: campo === 'foto' ? [arquivoFinal] : [...(prev[campo] ?? []), arquivoFinal] }));
      setDocStatus((prev) => ({ ...prev, [campo]: 'OK' }));
      if (Object.prototype.hasOwnProperty.call(DOCS_LABELS_BASE, campo)) {
        setDoc((prev) => prev ? { ...prev, [campo]: 'OK' } : prev);
      }
      if (campo === 'foto') {
        await atualizarFoto(Number(id), arquivoFinal.url);
        setDBV((prev) => prev ? { ...prev, foto_url: arquivoFinal.url } : prev);
      }
      await atualizarStatusDocumento(campo, 'OK');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o anexo.');
    } finally {
      setArquivoCarregando(null);
    }
  }

  async function removerArquivoDoc(campo: string, arquivo: DocArquivo) {
    const ok = await confirmar('Remover anexo', 'Deseja remover este arquivo do documento?');
    if (!ok) return;
    const urlBanco = arquivo.storagePath ?? extrairPathDocumentoStorage(arquivo.url) ?? arquivo.url;
    if (Platform.OS === 'web') {
      await supabase
        .from('documento_imagens')
        .delete()
        .eq('clube_id', getClubeAtivoId())
        .eq('dbv_id', Number(id))
        .eq('campo', campo)
        .eq('url', urlBanco);
    } else {
      const db = await getDB();
      await db.runAsync('DELETE FROM documento_imagens WHERE dbv_id = ? AND campo = ? AND url = ?', [Number(id), campo, arquivo.url]);
    }
    const restantes = (arquivosDoc[campo] ?? []).filter((a) => a.url !== arquivo.url);
    setArquivosDoc((prev) => ({ ...prev, [campo]: restantes }));
    if (restantes.length === 0) {
      await atualizarStatusDocumento(campo, null);
    }
    setViewer(null);
  }

  async function toggleInvestidura(tipo: 'classe' | 'especialidade', itemNome: string) {
    if (!isAdmin) return;
    const key = investKey(tipo, itemNome);
    const novoValor = !investiduraMap[key];
    setInvestiduraMap((prev) => ({ ...prev, [key]: novoValor }));
    try {
      if (Platform.OS === 'web') {
        const clubeId = getClubeAtivoId();
        const payload = {
          clube_id: clubeId,
          dbv_id: Number(id),
          tipo,
          item_nome: itemNome,
          marcado: novoValor,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from('investidura_itens')
          .upsert(payload, { onConflict: 'clube_id,dbv_id,tipo,item_nome' });
        if (error) throw error;
      }
    } catch {
      setInvestiduraMap((prev) => ({ ...prev, [key]: !novoValor }));
      Alert.alert('Erro', 'Não foi possível atualizar a próxima investidura.');
    }
  }

  async function adicionarTipoDocumento() {
    const nome = novoTipoNome.trim();
    if (!nome) return Alert.alert('Informe o nome', 'Digite o nome do documento.');
    const campo = slugDocumento(nome);
    const ordem = Math.max(0, ...docTipos.map((d) => Number(d.ordem ?? 0))) + 1;
    const novo = { campo, nome, ordem, ativo: true };
    if (Platform.OS === 'web') {
      const { error } = await supabase.from('documentos_modelo').insert({
        ...novo,
        clube_id: getClubeAtivoId(),
        programa_id: getProgramaAtivoId(),
        obrigatorio: true,
        permite_anexo: true,
        limite_anexos: 3,
      });
      if (error) return Alert.alert('Erro', 'Não foi possível adicionar o documento.');
    }
    setDocTipos((prev) => [...prev, novo].sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0)));
    setNovoTipoNome('');
    setModalTipo(false);
  }

  async function toggleClasse(campo: string, valorAtual: string | null) {
    const opts = [null, 'Em Andamento', 'OK'];
    const idx = opts.indexOf(valorAtual);
    const novoValor = opts[(idx + 1) % opts.length];
    await atualizarClasse(Number(id), campo, novoValor ?? '');
    setClasse((prev) => prev ? { ...prev, [campo]: novoValor } : prev);
  }

  async function registrarEntregaInvestidura(item: ItemAReceber) {
    if (!isAdmin || item.status !== 'aprovada') return;
    const ok = await confirmar(
      'Registrar entrega',
      `Confirmar que "${item.nome}" foi entregue na investidura e deve ir para a aba final?`,
    );
    if (!ok) return;

    try {
      const clubeId = getClubeAtivoId();
      const dbvId = Number(id);
      if (item.tipo === 'especialidade') {
        const { error } = await supabase
          .from('especialidades')
          .upsert(
            {
              clube_id: clubeId,
              dbv_id: dbvId,
              nome: item.nome,
              status: 'OK',
              atividade_origem_id: item.plano_id ? null : item.atividade_id,
              plano_formativo_id: item.plano_id ?? null,
              atividade_origem_titulo: item.titulo,
              atividade_origem_excluida: false,
              atividade_origem_excluida_em: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'dbv_id,nome' },
          );
        if (error) throw error;
      } else {
        const campo = campoClassePorNome(item.nome);
        if (!campo) {
          Alert.alert('Classe não encontrada', 'Não consegui relacionar essa classe ao cadastro de classes do programa.');
          return;
        }
        const { data: existente } = await supabase
          .from('progresso_classes')
          .select('id')
          .eq('clube_id', clubeId)
          .eq('dbv_id', dbvId)
          .maybeSingle();
        const payload = { clube_id: clubeId, dbv_id: dbvId, [campo]: 'OK', updated_at: new Date().toISOString() };
        const { error } = existente?.id
          ? await supabase.from('progresso_classes').update(payload).eq('id', existente.id)
          : await supabase.from('progresso_classes').insert(payload);
        if (error) throw error;
      }

      await supabase
        .from('investidura_itens')
        .upsert({
          clube_id: clubeId,
          dbv_id: dbvId,
          atividade_id: item.atividade_id,
          plano_formativo_id: item.plano_id ?? null,
          tipo: item.tipo,
          item_nome: item.nome,
          marcado: false,
          entregue: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clube_id,dbv_id,tipo,item_nome' });

      await carregarDados();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível registrar a entrega.');
    }
  }

  async function excluirEspecialidadeEntregue(item: EspecialidadeEntregue) {
    if (!isAdmin) return;
    const ok = await confirmar(
      'Excluir especialidade entregue',
      `Excluir "${item.nome}" do histórico entregue deste membro? Essa ação não apaga a atividade original.`,
    );
    if (!ok) return;

    try {
      const dbvId = Number(id);
      const { error } = await supabase
        .from('especialidades')
        .delete()
        .eq('clube_id', getClubeAtivoId())
        .eq('dbv_id', dbvId)
        .eq('nome', item.nome);
      if (error) throw error;

      if (Platform.OS !== 'web') {
        const db = await getDB();
        await db.runAsync('DELETE FROM especialidades WHERE dbv_id = ? AND nome = ?', [dbvId, item.nome]);
      }
      setEspecs((prev) => prev.filter((e) => e.nome !== item.nome));
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível excluir a especialidade.');
    }
  }

  async function abrirArquivo(arquivo: DocArquivo) {
    const url = await resolverUrlDocumentoPrivado(arquivo.storagePath ?? arquivo.url);
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:') && !url.startsWith('file:'))) {
      Alert.alert('Arquivo indisponível', 'Não foi possível localizar este anexo no armazenamento.');
      return;
    }
    if (Platform.OS === 'web') {
      setViewer(null);
      router.push({
        pathname: '/anexo',
        params: {
          url: encodeURI(url),
          nome: arquivo.nome ?? 'Anexo',
          returnTo: `/membro/${id}?aba=docs`,
        },
      });
      return;
    }
    else Linking.openURL(url).catch(() => Alert.alert('Arquivo indisponível', 'Não foi possível abrir este anexo.'));
  }

  async function abrirViewerDoc(campo: string, arquivos: DocArquivo[], idx: number) {
    if (!podeVerArquivosDoc) {
      Alert.alert('Sem permissão', 'Você não tem permissão para visualizar arquivos de membros.');
      return;
    }

    const resolvidos = await Promise.all(arquivos.map(async (arquivo) => {
      const url = await resolverUrlDocumentoPrivado(arquivo.storagePath ?? arquivo.url);
      return url ? { ...arquivo, url } : arquivo;
    }));

    setViewer({ campo, arquivos: resolvidos, idx });
  }

  async function mudarViewerIdx(delta: number) {
    if (!viewer) return;
    const proximoIdx = Math.min(viewer.arquivos.length - 1, Math.max(0, viewer.idx + delta));
    const arquivo = viewer.arquivos[proximoIdx];
    const url = await resolverUrlDocumentoPrivado(arquivo.storagePath ?? arquivo.url);
    setViewer((atual) => {
      if (!atual) return atual;
      const arquivos = [...atual.arquivos];
      if (url) arquivos[proximoIdx] = { ...arquivo, url };
      return { ...atual, arquivos, idx: proximoIdx };
    });
  }

  // ── Responsáveis ─────────────────────────────────────────────────────
  async function carregarResponsaveis() {
    if (Platform.OS !== 'web') return;
    const clubeId = getClubeAtivoId();
    const dbvId = Number(id);
    const [
      { data: resps, error: respsError },
      { data: cnvs },
    ] = await Promise.all([
      supabase.from('responsavel_membros')
        .select('id, usuario_id, parentesco, ativo, nome_cache, email_cache')
        .eq('clube_id', clubeId).eq('membro_id', dbvId),
      supabase.from('responsavel_convites')
        .select('id, token, email, parentesco, created_at')
        .eq('clube_id', clubeId).eq('membro_id', dbvId).eq('usado', false),
    ]);

    // If the responsavel_membros query fails, keep the current list intact
    // rather than silently wiping it. The convites list can still be updated.
    if (respsError) {
      console.warn('[carregarResponsaveis] erro ao buscar responsavel_membros:', respsError.message);
      setConvites((cnvs ?? []) as ConviteItem[]);
      return;
    }

    // Try to resolve names from the usuarios table (internal users).
    // External pais (not in usuarios) fall back to nome_cache stored at
    // convite-acceptance time.
    const ids = (resps ?? []).map((r: any) => r.usuario_id).filter(Boolean);
    const userMap = new Map<string, { nome: string; email: string }>();
    if (ids.length > 0) {
      const { data: us } = await supabase.from('usuarios').select('id, nome, email').in('id', ids);
      for (const u of (us ?? []) as any[]) userMap.set(u.id, u);
    }

    setResponsaveis((resps ?? []).map((r: any) => ({
      id: r.id,
      usuario_id: r.usuario_id,
      nome: userMap.get(r.usuario_id)?.nome ?? r.nome_cache ?? 'Usuário',
      email: userMap.get(r.usuario_id)?.email ?? r.email_cache ?? '',
      parentesco: r.parentesco ?? null,
      ativo: r.ativo ?? true,
    })));
    setConvites((cnvs ?? []) as ConviteItem[]);
  }

  async function buscarUsuariosClube(busca: string) {
    const clubeId = getClubeAtivoId();
    const { data: uc } = await supabase.from('usuario_clubes')
      .select('usuario_id').eq('clube_id', clubeId).eq('ativo', true);
    const ids = (uc ?? []).map((u: any) => u.usuario_id).filter(Boolean);
    if (ids.length === 0) { setUsuariosClube([]); return; }
    let q = supabase.from('usuarios').select('id, nome, email, dbv_id').in('id', ids);
    if (busca.trim()) q = (q as any).ilike('nome', `%${busca}%`);
    const { data } = await (q as any).limit(20);
    const vinculados = new Set(responsaveis.map((r) => r.usuario_id));
    setUsuariosClube(((data ?? []) as any[]).filter((u: any) => !vinculados.has(u.id)));
  }

  async function vincularUsuario(u: UserItem) {
    setSalvandoResp(true);
    try {
      let contatoResponsavel: string | null = null;
      if (u.dbv_id) {
        const { data: membroUsuario } = await supabase
          .from('desbravadores')
          .select('contato, contato_responsavel')
          .eq('id', u.dbv_id)
          .maybeSingle();
        contatoResponsavel = membroUsuario?.contato ?? membroUsuario?.contato_responsavel ?? null;
      }
      const { error } = await supabase.from('responsavel_membros').insert({
        usuario_id: u.id, membro_id: Number(id),
        clube_id: getClubeAtivoId(), programa_id: getProgramaAtivoId(), ativo: true,
        nome_cache: u.nome ?? null, email_cache: u.email ?? null,
      });
      if (error) throw error;
      const atualizacao: Record<string, any> = {
        email: dbv?.email || u.email,
        nome_responsavel: dbv?.nome_responsavel || u.nome,
        updated_at: new Date().toISOString(),
      };
      if (contatoResponsavel && !dbv?.contato_responsavel) {
        atualizacao.contato_responsavel = contatoResponsavel;
      }
      await supabase
        .from('desbravadores')
        .update(atualizacao)
        .eq('clube_id', getClubeAtivoId())
        .eq('id', Number(id));
      await carregarResponsaveis();
      await carregarDados();
      setModalResp(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível vincular o responsável.');
    } finally { setSalvandoResp(false); }
  }

  async function criarConvite() {
    const email = novoEmail.trim().toLowerCase();
    if (!email.includes('@')) { Alert.alert('E-mail inválido', 'Informe um e-mail válido.'); return; }
    setSalvandoResp(true);
    setLinkConvite('');
    try {
      const { data, error } = await supabase.from('responsavel_convites')
        .insert({
          email, membro_id: Number(id), clube_id: getClubeAtivoId(),
          programa_id: getProgramaAtivoId(),
          parentesco: novoParentesco.trim() || null, criado_por: usuario?.id,
        })
        .select('token').single();
      if (error) throw error;
      const origin = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin : 'https://gsf-clubes.pages.dev';
      setLinkConvite(`${origin}/convite/${data.token}`);
      await carregarResponsaveis();
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o convite.');
    } finally { setSalvandoResp(false); }
  }

  async function bloquearResponsavel(respId: string) {
    const ok = await confirmar('Bloquear acesso', 'Suspender o acesso deste responsável ao clube?');
    if (!ok) return;
    await supabase.from('responsavel_membros').update({ ativo: false }).eq('id', respId);
    setResponsaveis((prev) => prev.map((r) => r.id === respId ? { ...r, ativo: false } : r));
  }

  async function reativarResponsavel(respId: string) {
    await supabase.from('responsavel_membros').update({ ativo: true }).eq('id', respId);
    setResponsaveis((prev) => prev.map((r) => r.id === respId ? { ...r, ativo: true } : r));
  }

  async function cancelarConvite(conviteId: string) {
    const ok = await confirmar('Cancelar convite', 'Cancelar este convite pendente?');
    if (!ok) return;
    await supabase.from('responsavel_convites').delete().eq('id', conviteId);
    setConvites((prev) => prev.filter((c) => c.id !== conviteId));
  }

  function copiarLink(link: string) {
    if (Platform.OS === 'web' && navigator?.clipboard) {
      navigator.clipboard.writeText(link);
      Alert.alert('Copiado!', 'Link copiado para a área de transferência.');
    }
  }
  // ─────────────────────────────────────────────────────────────────────

  if (carregando) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#1a3a5c" /></View>;
  }

  if (!dbv) {
    return (
      <View style={styles.loading}>
        <Text style={styles.vazio}>Membro não encontrado.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={{ color: '#1a3a5c', fontWeight: '700' }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cor = CORES_UNIDADE[dbv.unidade_nome] ?? avatarCor(dbv.nome);
  const avatarColor = dbv.foto_url ? cor : avatarCor(dbv.nome);
  const docsOk = docTipos.filter((d) => ['OK', 'NA'].includes(String(statusDoc(d.campo)))).length;
  const docsTotal = docTipos.length;
  const responsaveisAtivos = responsaveis.filter((r) => r.ativo);
  const nomesResponsaveisAtivos = responsaveisAtivos.map((r) => r.nome).filter(Boolean).join(', ');
  const cargosPermitidos = cargosModelo.filter((c) => !cargoBloqueadoPorIdade(cargoLabel(c, form.genero), idadeForm, cargosModelo));
  const funcoesAdicionaisPermitidas = cargosModelo
    .filter((c) => c.tipo !== 'membro')
    .filter((c) => !cargoBloqueadoPorIdade(cargoLabel(c, form.genero), idadeForm, cargosModelo));
  const perfisPermitidos = PERFIS_LOGIN.filter((p) => !perfilBloqueadoPorIdade(p.valor, idadeForm, usuario?.perfil));
  const mostrarHintAbas = abasConteudoLargura > abasLargura + 8;

  function statusDocIcon(val: StatusDoc): { icon: string; color: string; label: string } {
    if (val === 'OK') return { icon: 'checkmark-circle', color: '#2e7d32', label: 'Entregue' };
    if (val === 'NA') return { icon: 'remove-circle', color: '#78909c', label: 'N/A' };
    return { icon: 'close-circle', color: '#c62828', label: 'Pendente' };
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, headerCompacto && styles.headerCompacto, { backgroundColor: cor }]}>
        <TouchableOpacity onPress={() => router.push('/membros')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={escolherFotoPerfil}
          style={[styles.avatarWrapper, headerCompacto && styles.avatarWrapperCompacto]}
          disabled={upFoto || !podeEditarFotoPerfil}
        >
          {dbv.foto_url ? (
            <Image source={{ uri: dbv.foto_url }} style={[styles.avatarImg, headerCompacto && styles.avatarImgCompacto]} />
          ) : (
            <View style={[styles.avatarGrande, headerCompacto && styles.avatarGrandeCompacto, { backgroundColor: avatarColor }]}>
              <Text style={[styles.avatarLetra, headerCompacto && styles.avatarLetraCompacta]}>{dbv.nome[0]}</Text>
            </View>
          )}
          {upFoto ? (
            <View style={styles.avatarOverlay}><ActivityIndicator color="#fff" size="small" /></View>
          ) : null}
        </TouchableOpacity>

        <Text style={[styles.nome, headerCompacto && styles.nomeCompacto]} numberOfLines={headerCompacto ? 1 : 2}>{dbv.nome}</Text>
        {!headerCompacto && (
          <Text style={styles.sub}>{dbv.unidade_nome} • {dbv.cargo}{dbv.cargo_adicional ? ` / ${dbv.cargo_adicional}` : ''} • {dbv.idade} anos</Text>
        )}

        {isAdmin && !headerCompacto && (
          <TouchableOpacity style={styles.respHeaderBadge} onPress={() => setAba('responsaveis')}>
            <Ionicons name="people" size={13} color="rgba(255,255,255,0.9)" />
            <Text style={styles.respHeaderBadgeText}>
              {responsaveis.filter((r) => r.ativo).length > 0
                ? `${responsaveis.filter((r) => r.ativo).length} responsável(is) vinculado(s)`
                : convites.length > 0
                  ? `${convites.length} convite(s) pendente(s)`
                  : 'Sem responsáveis vinculados'}
            </Text>
            <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}

        {isAdmin && !headerCompacto && (
          <View style={styles.headerDangerBox}>
            <Text style={styles.headerDangerTitle}>Zona de perigo</Text>
            <View style={styles.headerDangerRow}>
              {dbv.ativo !== false ? (
                <TouchableOpacity style={styles.headerInativarBtn} onPress={confirmarInativarMembro}>
                  <Ionicons name="eye-off-outline" size={15} color="#fff" />
                  <Text style={styles.headerDangerBtnText}>Inativar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.headerReativarBtn} onPress={reativarMembro}>
                  <Ionicons name="eye-outline" size={15} color="#fff" />
                  <Text style={styles.headerDangerBtnText}>Reativar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.headerExcluirBtn} onPress={confirmarExcluirMembro}>
                <Ionicons name="trash-outline" size={15} color="#fff" />
                <Text style={styles.headerDangerBtnText}>Deletar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.abasWrapper} onLayout={(ev) => setAbasLargura(ev.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.abasScroll}
          contentContainerStyle={styles.abasContent}
          onContentSizeChange={(w) => setAbasConteudoLargura(w)}
        >
          {([
            ...(isAdmin ? [{ key: 'editar', label: 'Dados' }] : []),
            { key: 'docs', label: `Docs (${docsOk}/${docsTotal})` },
            { key: 'classes', label: 'Classes' },
            { key: 'especs', label: 'Especs.' },
            { key: 'receber', label: `Receber (${itensAReceber.length})` },
            ...(isAdmin ? [{ key: 'responsaveis', label: `Responsável (${responsaveisAtivos.length})` }] : []),
          ] as { key: Aba; label: string }[]).map(({ key, label }) => (
            <TouchableOpacity key={key} style={[styles.aba, aba === key && styles.abaAtiva]} onPress={() => setAba(key)}>
              <Text style={[styles.abaText, aba === key && styles.abaTextAtiva]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {mostrarHintAbas && (
          <View pointerEvents="none" style={styles.abasHint}>
            <Ionicons name="chevron-forward" size={18} color="#1a3a5c" />
          </View>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 32 }}
        scrollEventThrottle={16}
        onScroll={(ev) => {
          const compacto = ev.nativeEvent.contentOffset.y > 82;
          setHeaderCompacto((atual) => atual === compacto ? atual : compacto);
        }}
      >
        {aba === 'docs' && (
          <View>
            {(podeGerenciarDocsTodos || ehFilhoNoContexto || ehProprioMembro || souConselheiro) && (
              <View style={styles.docSegurancaNote}>
                <Ionicons name="shield-checkmark" size={16} color="#1565c0" />
                <Text style={styles.docSegurancaText}>
                  Anexos ficam restritos ao próprio membro e administradores. Conselheiros veem o status, mas não abrem os arquivos.
                </Text>
              </View>
            )}

            <View style={styles.docToolbar}>
              <View style={styles.legendaItem}><Ionicons name="checkmark-circle" size={16} color="#2e7d32" /><Text style={styles.legendaText}>Entregue</Text></View>
              <View style={styles.legendaItem}><Ionicons name="remove-circle" size={16} color="#78909c" /><Text style={styles.legendaText}>Não se aplica</Text></View>
              {podeGerenciarDocsTodos && (
                <TouchableOpacity style={styles.addDocBtn} onPress={() => setModalTipo(true)}>
                  <Ionicons name="add" size={17} color="#fff" />
                  <Text style={styles.addDocText}>Documento</Text>
                </TouchableOpacity>
              )}
            </View>

            {docTipos.map((tipo) => {
              const val = statusDoc(tipo.campo);
              const arquivos = arquivosDoc[tipo.campo] ?? [];
              const carregandoArquivo = arquivoCarregando === tipo.campo;
              const podeEditarEsteDoc = tipo.campo === 'foto' ? podeGerenciarDocsTodos : podeEditarStatusDoc;
              const statusTravadoPorAnexo = arquivos.length > 0;
              const { icon, color, label } = statusDocIcon(val);
              const limiteArquivos = limiteArquivosTipo(tipo);
              const podeAdicionar = podeEditarEsteDoc && arquivos.length < limiteArquivos;
              const temImagem = arquivos.some((a) => pareceImagem(a));

              return (
                <View key={tipo.campo} style={styles.docCard}>
                  <View style={styles.docRow}>
                    <TouchableOpacity
                      onPress={() => podeEditarEsteDoc && !statusTravadoPorAnexo && toggleDoc(tipo.campo, val)}
                      disabled={!podeEditarEsteDoc || statusTravadoPorAnexo}
                      style={[styles.statusBtn, statusTravadoPorAnexo && styles.statusBtnTravado]}
                      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                      accessibilityLabel={`Alternar status ${tipo.nome}`}
                    >
                      <Ionicons name={icon as any} size={24} color={color} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => podeEditarEsteDoc && !statusTravadoPorAnexo && toggleDoc(tipo.campo, val)}
                      disabled={!podeEditarEsteDoc || statusTravadoPorAnexo}
                      accessibilityLabel={`Alterar ${tipo.nome}`}
                    >
                      <Text style={styles.itemLabel}>{tipo.nome}</Text>
                      <Text style={[styles.docStatusText, { color }]}>{label}</Text>
                      {statusTravadoPorAnexo && (
                        <Text style={styles.docLockedText}>Remova os anexos para alterar o status</Text>
                      )}
                    </TouchableOpacity>

                    {arquivos.length > 0 && (
                      <TouchableOpacity
                        style={styles.fotoCountBadge}
                        onPress={() => abrirViewerDoc(tipo.campo, arquivos, 0)}
                      >
                        <Ionicons name={temImagem ? 'images' : 'document-attach'} size={14} color="#1a3a5c" />
                        <Text style={styles.fotoCountText}>{arquivos.length}/{limiteArquivos}</Text>
                      </TouchableOpacity>
                    )}

                    {podeEditarEsteDoc && (
                      <View style={styles.docActions}>
                        <TouchableOpacity
                          onPress={() => escolherArquivoDoc(tipo.campo, 'arquivo')}
                          style={[styles.docFotoBtn, !podeAdicionar && { opacity: 0.4 }]}
                          disabled={carregandoArquivo || !podeAdicionar}
                        >
                          {carregandoArquivo
                            ? <ActivityIndicator size="small" color="#1a3a5c" />
                            : <Ionicons name="attach" size={20} color={arquivos.length > 0 ? '#1a3a5c' : '#777'} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => escolherArquivoDoc(tipo.campo, 'camera')}
                          style={[styles.docFotoBtn, !podeAdicionar && { opacity: 0.4 }]}
                          disabled={carregandoArquivo || !podeAdicionar}
                        >
                          {carregandoArquivo
                            ? <ActivityIndicator size="small" color="#1a3a5c" />
                            : <Ionicons name="camera" size={20} color={arquivos.length > 0 ? '#1a3a5c' : '#777'} />}
                        </TouchableOpacity>
                      </View>
                    )}

                  </View>

                  {arquivos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotosRow}>
                      {arquivos.map((arquivo, idx) => {
                        const chavePreview = `${tipo.campo}-${arquivo.storagePath ?? arquivo.url}-${idx}`;
                        const isImg = pareceImagem(arquivo) && !previewFalhou[chavePreview];
                        return (
                          <TouchableOpacity key={`${arquivo.url}-${idx}`} onPress={() => abrirViewerDoc(tipo.campo, arquivos, idx)} style={styles.miniThumb}>
                            {isImg ? (
                              <Image
                                source={{ uri: arquivo.url }}
                                style={styles.miniThumbImg}
                                onError={() => setPreviewFalhou((prev) => ({ ...prev, [chavePreview]: true }))}
                              />
                            ) : (
                              <View style={styles.miniFile}>
                                <Ionicons name="document-text" size={24} color="#1a3a5c" />
                                <Text numberOfLines={2} style={styles.miniFileText}>{arquivo.nome ?? 'Abrir arquivo'}</Text>
                              </View>
                            )}
                            <View style={styles.miniThumbNum}><Text style={styles.miniThumbNumText}>{idx + 1}</Text></View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {aba === 'classes' && (
          <View>
            {Object.entries(CLASSES_LABELS).filter(([campo]) => classe ? (classe as any)[campo] === 'OK' : false).length === 0 && (
              <Text style={styles.vazio}>Nenhuma classe entregue até agora.</Text>
            )}
            {Object.entries(CLASSES_LABELS).filter(([campo]) => classe ? (classe as any)[campo] === 'OK' : false).map(([campo, label]) => {
              const val = classe ? (classe as any)[campo] : null;
              const corC = val === 'OK' ? '#2e7d32' : val === 'Em Andamento' ? '#f57c00' : '#bbb';
              return (
                <View key={campo} style={styles.itemRow}>
                  <View style={[styles.classeIndicador, { backgroundColor: corC }]} />
                  <Text style={styles.itemLabel}>{label}</Text>
                  <Text style={[styles.classeStatus, { color: corC }]}>{val ?? '—'}</Text>
                </View>
              );
            })}
          </View>
        )}

        {aba === 'especs' && (
          <View>
            {especs.filter((e) => e.status === 'OK').length === 0 && <Text style={styles.vazio}>Nenhuma especialidade entregue até agora.</Text>}
            {especs.filter((e) => e.status === 'OK').map((e, i) => (
              <View key={e.id ?? `${e.nome}-${i}`} style={styles.especCard}>
                <View style={styles.especHeader}>
                  <Ionicons name="star" size={20} color="#ff9800" />
                  <Text style={styles.itemLabel}>{e.nome}</Text>
                  <Text style={styles.especOk}>OK</Text>
                  {isAdmin && (
                    <TouchableOpacity style={styles.especDeleteBtn} onPress={() => excluirEspecialidadeEntregue(e)}>
                      <Ionicons name="trash-outline" size={17} color="#c62828" />
                    </TouchableOpacity>
                  )}
                </View>
                {!!e.atividade_origem_excluida && (
                  <View style={styles.especOrigemExcluida}>
                    <Ionicons name="warning-outline" size={14} color="#b45309" />
                    <Text style={styles.especOrigemText}>Atividade avaliativa excluída</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {aba === 'responsaveis' && (
          <View>
            <View style={styles.respToolbar}>
              <TouchableOpacity
                style={styles.respBtn}
                onPress={() => { setBuscaUsuario(''); setUsuariosClube([]); setModalResp('vincular'); }}
              >
                <Ionicons name="people" size={14} color="#fff" />
                <Text style={styles.respBtnText}>Vincular membro do clube</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.respBtn, { backgroundColor: '#2e7d32' }]}
                onPress={() => { setNovoEmail(''); setNovoParentesco(''); setLinkConvite(''); setModalResp('convidar'); }}
              >
                <Ionicons name="mail" size={14} color="#fff" />
                <Text style={styles.respBtnText}>Convidar por e-mail</Text>
              </TouchableOpacity>
            </View>

            {responsaveis.filter((r) => r.ativo).length > 0 && (
              <>
                <Text style={styles.respSecTitle}>Vinculados</Text>
                {responsaveis.filter((r) => r.ativo).map((r) => (
                  <View key={r.id} style={styles.respCard}>
                    <View style={styles.respAvatar}>
                      <Text style={styles.respAvatarText}>{r.nome[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.respNome}>{r.nome}</Text>
                      <Text style={styles.respEmail}>{r.email}</Text>
                      {r.parentesco ? <Text style={styles.respParentesco}>{r.parentesco}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => bloquearResponsavel(r.id)} style={styles.docFotoBtn}>
                      <Ionicons name="lock-closed-outline" size={18} color="#f57c00" />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {responsaveis.filter((r) => !r.ativo).length > 0 && (
              <>
                <Text style={[styles.respSecTitle, { marginTop: 14, color: '#c62828' }]}>Bloqueados</Text>
                {responsaveis.filter((r) => !r.ativo).map((r) => (
                  <View key={r.id} style={[styles.respCard, { opacity: 0.65, borderLeftWidth: 3, borderLeftColor: '#c62828' }]}>
                    <View style={[styles.respAvatar, { backgroundColor: '#c62828' }]}>
                      <Text style={styles.respAvatarText}>{r.nome[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.respNome}>{r.nome}</Text>
                      <Text style={styles.respEmail}>{r.email}</Text>
                      {r.parentesco ? <Text style={styles.respParentesco}>{r.parentesco}</Text> : null}
                      <Text style={{ fontSize: 11, color: '#c62828', fontWeight: '700', marginTop: 2 }}>Acesso suspenso</Text>
                    </View>
                    <TouchableOpacity onPress={() => reativarResponsavel(r.id)} style={styles.docFotoBtn}>
                      <Ionicons name="lock-open-outline" size={18} color="#2e7d32" />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {convites.length > 0 && (
              <>
                <Text style={[styles.respSecTitle, { marginTop: 14 }]}>Convites pendentes</Text>
                {convites.map((c) => (
                  <View key={c.id} style={[styles.respCard, { borderLeftWidth: 3, borderLeftColor: '#f57c00' }]}>
                    <Ionicons name="mail-open-outline" size={28} color="#f57c00" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.respNome}>{c.email}</Text>
                      {c.parentesco ? <Text style={styles.respParentesco}>{c.parentesco}</Text> : null}
                      <Text style={styles.respEmail}>Aguardando aceite</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => copiarLink(
                        `${Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://gsf-clubes.pages.dev'}/convite/${c.token}`
                      )}
                      style={[styles.docFotoBtn, { marginRight: 4 }]}
                    >
                      <Ionicons name="copy-outline" size={18} color="#1a3a5c" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => cancelarConvite(c.id)} style={styles.docTrashBtn}>
                      <Ionicons name="close-circle-outline" size={18} color="#c62828" />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {responsaveis.length === 0 && convites.length === 0 && (
              <Text style={styles.vazio}>Nenhum responsável vinculado. Use os botões acima para vincular ou convidar.</Text>
            )}
          </View>
        )}

        {aba === 'receber' && (
          <View>
            {itensAReceber.length === 0 && (
              <Text style={styles.vazio}>Nenhuma classe ou especialidade pendente para receber.</Text>
            )}
            {itensAReceber.map((item) => {
              const color = statusReceberColor(item.status);
              return (
                <View key={`${item.tipo}-${item.nome}-${item.atividade_id}`} style={styles.receberCard}>
                  <View style={[styles.receberIcon, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={item.tipo === 'classe' ? 'ribbon' : 'star'} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receberNome}>{item.nome}</Text>
                    <Text style={styles.receberSub}>
                      {item.tipo === 'classe' ? 'Classe' : 'Especialidade'} • {item.titulo}
                    </Text>
                    {item.plano_id ? (
                      <Text style={styles.receberProgresso}>
                        {item.atividades_aprovadas ?? 0}/{item.atividades_necessarias ?? 1} avaliações aprovadas • {item.atividades_cadastradas ?? 0} cadastradas
                      </Text>
                    ) : null}
                    <View style={[styles.receberStatus, { backgroundColor: `${color}16`, borderColor: `${color}55` }]}>
                      <Text style={[styles.receberStatusText, { color }]}>{statusReceberLabel(item.status)}</Text>
                    </View>
                  </View>
                  {isAdmin && item.status === 'aprovada' && (
                    <TouchableOpacity style={styles.entregarBtn} onPress={() => registrarEntregaInvestidura(item)}>
                      <Ionicons name={item.tipo === 'classe' ? 'checkmark-done' : 'gift'} size={15} color="#fff" />
                      <Text style={styles.entregarBtnText}>{item.tipo === 'classe' ? 'Classe validada' : 'Entregar'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
        {aba === 'editar' && isAdmin && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <CampoEdit label="Nome completo *">
              <TextInput style={styles.editInput} value={form.nome} onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome do desbravador" placeholderTextColor="#aaa" />
            </CampoEdit>

            <CampoEdit label="Gênero">
              <View style={styles.chipRow}>
                {(['M', 'F'] as const).map((g) => (
                  <TouchableOpacity key={g} onPress={() => setForm((f) => ({ ...f, genero: g, cargo: ajustarCargoPorIdade(adaptarCargo(f.cargo, g, cargosModelo), idadePorNascimento(f.data_nascimento), cargosModelo), cargo_adicional: adaptarCargo(f.cargo_adicional, g, cargosModelo), perfil_login: ajustarPerfilPorIdade(f.perfil_login, idadePorNascimento(f.data_nascimento)) }))} style={[styles.chipBtn, form.genero === g && styles.chipBtnAtivo]}>
                    <Text style={[styles.chipBtnText, form.genero === g && { color: '#fff' }]}>{g === 'M' ? '♂ Masculino' : '♀ Feminino'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </CampoEdit>

            <CampoEdit label="Data de nascimento">
              <DateField
                value={form.data_nascimento}
                onChange={(v) => setForm((f) => {
                  const idade = idadePorNascimento(v);
                  return { ...f, data_nascimento: v, cargo: ajustarCargoPorIdade(f.cargo, idade, cargosModelo), cargo_adicional: ajustarCargoPorIdade(f.cargo_adicional, idade, cargosModelo), perfil_login: ajustarPerfilPorIdade(f.perfil_login, idade) };
                })}
                placeholder="Selecionar nascimento"
                minimumDate={nascimentoMin}
                defaultDate={nascimentoDefault}
              />
            </CampoEdit>

            <CampoEdit label="Cargo">
              <View style={styles.chipRow}>
                {cargosPermitidos.map((c) => {
                  const label = cargoLabel(c, form.genero);
                  const ativo = form.cargo === c.masc || form.cargo === c.fem;
                  return (
                    <TouchableOpacity key={c.codigo} onPress={() => setForm((f) => ({ ...f, cargo: ativo ? '' : cargoLabel(c, f.genero), perfil_login: cargoForcaDesbravador(label, cargosModelo) ? perfilPadraoMembro() : ajustarPerfilPorIdade(f.perfil_login, idadePorNascimento(f.data_nascimento)) }))} style={[styles.chipBtn, ativo && styles.chipBtnAtivo]}>
                      <Text style={[styles.chipBtnText, ativo && { color: '#fff' }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </CampoEdit>

            <CampoEdit label="Função adicional (opcional)">
              <View style={styles.chipRow}>
                {funcoesAdicionaisPermitidas.map((c) => {
                  const label = cargoLabel(c, form.genero);
                  const ativo = form.cargo_adicional === c.masc || form.cargo_adicional === c.fem;
                  return (
                    <TouchableOpacity key={`adicional-${c.codigo}`} onPress={() => setForm((f) => ({ ...f, cargo_adicional: ativo ? '' : cargoLabel(c, f.genero) }))} style={[styles.chipBtn, ativo && styles.chipBtnAtivo]}>
                      <Text style={[styles.chipBtnText, ativo && { color: '#fff' }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </CampoEdit>

            <CampoEdit label="Unidade">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {[...unidades, { id: 0, nome: 'Diretoria', cor: '#9c27b0' }].map((u) => (
                  <TouchableOpacity key={u.id} onPress={() => selecionarUnidade(u as UnidadeEdit)} style={[styles.unChip, form.unidade_nome === u.nome && { backgroundColor: u.cor }]}>
                    <Text style={[styles.unChipText, form.unidade_nome === u.nome && { color: '#fff' }]}>{u.nome}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setForm((f) => ({ ...f, unidade_id: '', unidade_nome: '' }))} style={[styles.unChip, !form.unidade_nome && { backgroundColor: '#90a4ae' }]}>
                  <Text style={[styles.unChipText, !form.unidade_nome && { color: '#fff' }]}>Sem unidade</Text>
                </TouchableOpacity>
              </ScrollView>
            </CampoEdit>

            <CampoEdit label="E-mail">
              <TextInput style={styles.editInput} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#aaa" />
            </CampoEdit>

            <CampoEdit label={form.login_user_id ? 'Senha de login (deixe em branco para manter)' : 'Senha de login'}>
              <TextInput style={styles.editInput} value={form.senha} onChangeText={(v) => setForm((f) => ({ ...f, senha: v }))} placeholder="Mínimo 6 caracteres" secureTextEntry placeholderTextColor="#aaa" />
            </CampoEdit>

            <CampoEdit label="Tipo de acesso">
              {podeGerenciarAcessoTotal && (
                <View style={styles.loginVinculoInfo}>
                  <Ionicons
                    name={form.login_user_id ? 'checkmark-circle-outline' : 'unlink-outline'}
                    size={16}
                    color={form.login_user_id ? '#2e7d32' : '#607d8b'}
                  />
                  <Text style={[styles.loginVinculoInfoText, form.login_user_id && { color: '#2e7d32' }]}>
                    {form.login_user_id ? `Login vinculado: ${form.email || 'conta cadastrada'}` : 'Nenhum login vinculado a este membro'}
                  </Text>
                </View>
              )}
              <View style={styles.chipRow}>
                {perfisPermitidos.map((p) => {
                  const ativo = form.perfil_login === p.valor;
                  return (
                    <TouchableOpacity key={p.valor} style={[styles.chipBtn, ativo && styles.chipBtnAtivo]} onPress={() => setForm((f) => ({ ...f, perfil_login: ajustarPerfilPorIdade(p.valor, idadePorNascimento(f.data_nascimento)) }))}>
                      <Text style={[styles.chipBtnText, ativo && { color: '#fff' }]}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {perfilTravadoComoDesbravador && <Text style={styles.editAviso}>Até 15 anos, o acesso fica limitado a Desbravador.</Text>}
              {perfilAdultoObrigatorio && <Text style={styles.editAviso}>Acima de 15 anos, o acesso de Desbravador fica bloqueado.</Text>}
              {form.login_user_id && perfilAdulto(form.perfil_login) && podeGerenciarAcessoTotal && (
                <View style={{ marginTop: 10 }}>
                  {mfaMensagem && (
                    <View style={[styles.mfaBox, mfaMensagem.tipo === 'ok' ? styles.mfaBoxOk : styles.mfaBoxErro]}>
                      <Ionicons name={mfaMensagem.tipo === 'ok' ? 'checkmark-circle' : 'alert-circle'} size={15} color={mfaMensagem.tipo === 'ok' ? '#2e7d32' : '#c62828'} />
                      <Text style={[styles.mfaBoxText, { color: mfaMensagem.tipo === 'ok' ? '#2e7d32' : '#c62828' }]}>{mfaMensagem.texto}</Text>
                    </View>
                  )}
                  {mfaConfirmando ? (
                    <View style={styles.mfaConfirmBox}>
                      <Text style={styles.mfaConfirmTexto}>Remover Google Authenticator deste usuário? No próximo login ele precisará configurar novamente.</Text>
                      <View style={styles.mfaConfirmBotoes}>
                        <TouchableOpacity style={styles.mfaConfirmCancelar} onPress={() => setMfaConfirmando(false)}>
                          <Text style={styles.mfaConfirmCancelarText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mfaConfirmOk} onPress={executarResetMfa}>
                          <Text style={styles.mfaConfirmOkText}>Confirmar reset</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.mfaResetBtn} onPress={() => { setMfaMensagem(null); setMfaConfirmando(true); }}>
                      <Ionicons name="key-outline" size={15} color="#7d4f00" />
                      <Text style={styles.mfaResetText}>Resetar dupla autenticação</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {!form.login_user_id && podeGerenciarAcessoTotal && (
                <TouchableOpacity
                  style={styles.vincularLoginBtn}
                  onPress={() => { setBuscaLogin(''); setUsuariosSemVinculo([]); setModalLogin(true); }}
                >
                  <Ionicons name="link-outline" size={15} color="#1a3a5c" />
                  <Text style={styles.vincularLoginText}>Vincular usuário existente a este membro</Text>
                </TouchableOpacity>
              )}
            </CampoEdit>

            <CampoEdit label="Telefone/WhatsApp">
              <TextInput style={styles.editInput} value={form.contato} onChangeText={(v) => setForm((f) => ({ ...f, contato: v }))} placeholder="(00) 00000-0000" keyboardType="phone-pad" placeholderTextColor="#aaa" />
            </CampoEdit>

            <CampoEdit label="Tamanho da camisa">
              <View style={styles.chipRow}>
                {['PP','P','M','G','GG','XG'].map((t) => (
                  <TouchableOpacity key={t} onPress={() => setForm((f) => ({ ...f, camisa: t }))} style={[styles.chipBtn, form.camisa === t && styles.chipBtnAtivo, { minWidth: 44 }]}>
                    <Text style={[styles.chipBtnText, form.camisa === t && { color: '#fff' }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </CampoEdit>

            <CampoEdit label="Tamanho da calça">
              <View style={styles.chipRow}>
                {['4','6','8','10','12','14','PP','P','M','G','GG','XG'].map((t) => (
                  <TouchableOpacity key={t} onPress={() => setForm((f) => ({ ...f, calca: t }))} style={[styles.chipBtn, form.calca === t && styles.chipBtnAtivo, { minWidth: 44 }]}>
                    <Text style={[styles.chipBtnText, form.calca === t && { color: '#fff' }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </CampoEdit>

            {responsaveisAtivos.length > 0 && (
              <CampoEdit label="Responsável vinculado">
                <View style={styles.responsavelReadonly}>
                  <Ionicons name="people-outline" size={16} color="#1a3a5c" />
                  <Text style={styles.responsavelReadonlyText}>{nomesResponsaveisAtivos}</Text>
                </View>
                <Text style={styles.editAviso}>O nome é definido na aba Responsável. Aqui fica apenas para conferência.</Text>
              </CampoEdit>
            )}

            <CampoEdit label="Telefone do responsável">
              <TextInput style={styles.editInput} value={form.contato_responsavel} onChangeText={(v) => setForm((f) => ({ ...f, contato_responsavel: v }))} placeholder="(00) 00000-0000" keyboardType="phone-pad" placeholderTextColor="#aaa" />
            </CampoEdit>

            <TouchableOpacity style={[styles.salvarBtn, salvandoEdit && { opacity: 0.6 }]} onPress={salvarEdicao} disabled={salvandoEdit}>
              {salvandoEdit
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.salvarBtnText}>Salvar alterações</Text></>
              }
            </TouchableOpacity>

            {form.login_user_id && podeGerenciarAcessoTotal && (
              <TouchableOpacity style={styles.removerAcessoBtn} onPress={removerAcessoDoMembro} disabled={salvandoEdit}>
                <Ionicons name="lock-closed-outline" size={15} color="#c62828" />
                <Text style={styles.removerAcessoText}>Remover acesso de login deste membro</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </KeyboardAvoidingView>
        )}
      </ScrollView>

      <Modal visible={!!viewer} transparent animationType="fade">
        <View style={styles.viewerBg}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          {viewer && (() => {
            const arquivo = viewer.arquivos[viewer.idx];
            const chaveViewer = `${viewer.campo}-${arquivo.storagePath ?? arquivo.url}-${viewer.idx}-viewer`;
            const isImg = pareceImagem(arquivo) && !previewFalhou[chaveViewer];
            return (
              <>
                {isImg ? (
                  <Image
                    source={{ uri: arquivo.url }}
                    style={styles.viewerImg}
                    resizeMode="contain"
                    onError={() => setPreviewFalhou((prev) => ({ ...prev, [chaveViewer]: true }))}
                  />
                ) : (
                  <View style={styles.viewerFile}>
                    <Ionicons name="document-text" size={76} color="#fff" />
                    <Text style={styles.viewerFileName}>{arquivo.nome ?? 'Arquivo anexado'}</Text>
                    <TouchableOpacity style={styles.viewerOpen} onPress={() => abrirArquivo(arquivo)}>
                      <Ionicons name="open-outline" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Abrir arquivo</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.viewerNav}>
                  <TouchableOpacity
                    onPress={() => mudarViewerIdx(-1)}
                    disabled={viewer.idx === 0}
                    style={[styles.viewerNavBtn, viewer.idx === 0 && { opacity: 0.3 }]}
                  >
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.viewerCounter}>{viewer.idx + 1} / {viewer.arquivos.length}</Text>
                  <TouchableOpacity
                    onPress={() => mudarViewerIdx(1)}
                    disabled={viewer.idx === viewer.arquivos.length - 1}
                    style={[styles.viewerNavBtn, viewer.idx === viewer.arquivos.length - 1 && { opacity: 0.3 }]}
                  >
                    <Ionicons name="chevron-forward" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>
                {podeEditarUploadsDoc && (
                  <TouchableOpacity style={styles.viewerDelete} onPress={() => removerArquivoDoc(viewer.campo, arquivo)}>
                    <Ionicons name="trash" size={22} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Remover</Text>
                  </TouchableOpacity>
                )}
              </>
            );
          })()}
        </View>
      </Modal>

      {/* Modal: vincular membro do clube */}
      <Modal visible={modalResp === 'vincular'} transparent animationType="slide" onRequestClose={() => setModalResp(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Vincular membro do clube</Text>
            <Text style={styles.modalSub}>Busque pelo nome do usuário já cadastrado.</Text>
            <TextInput
              value={buscaUsuario}
              onChangeText={(t) => { setBuscaUsuario(t); buscarUsuariosClube(t); }}
              placeholder="Nome do usuário..."
              style={styles.modalInput}
              autoFocus
            />
            <ScrollView style={{ maxHeight: 260, marginTop: 8 }}>
              {usuariosClube.length === 0 && buscaUsuario.length > 0 && (
                <Text style={{ color: '#999', textAlign: 'center', marginTop: 16 }}>Nenhum usuário encontrado.</Text>
              )}
              {usuariosClube.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userItem}
                  onPress={() => vincularUsuario(u)}
                  disabled={salvandoResp}
                >
                  <View style={styles.userItemAvatar}>
                    <Text style={styles.userItemAvatarText}>{u.nome[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userItemNome}>{u.nome}</Text>
                    <Text style={styles.userItemEmail}>{u.email}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color="#1a3a5c" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setModalResp(null)}>
              <Text style={styles.modalCancelText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalLogin} transparent animationType="slide" onRequestClose={() => setModalLogin(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Vincular login do membro</Text>
            <Text style={styles.modalSub}>Selecione uma conta criada que ainda não está associada a nenhum membro.</Text>
            <TextInput
              value={buscaLogin}
              onChangeText={(texto) => { setBuscaLogin(texto); buscarUsuariosSemVinculo(texto); }}
              placeholder="Buscar por nome ou e-mail..."
              style={styles.modalInput}
              autoCapitalize="none"
              autoFocus
            />
            <ScrollView style={{ maxHeight: 260, marginTop: 8 }}>
              {usuariosSemVinculo.length === 0 && buscaLogin.length > 0 && (
                <Text style={{ color: '#999', textAlign: 'center', marginTop: 16 }}>Nenhum login sem vínculo encontrado.</Text>
              )}
              {usuariosSemVinculo.map((conta) => (
                <TouchableOpacity
                  key={conta.id}
                  style={styles.userItem}
                  onPress={() => vincularLoginAoMembro(conta)}
                  disabled={salvandoLogin}
                >
                  <View style={styles.userItemAvatar}>
                    <Text style={styles.userItemAvatarText}>{conta.nome[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userItemNome}>{conta.nome}</Text>
                    <Text style={styles.userItemEmail}>{conta.email}</Text>
                  </View>
                  {salvandoLogin ? <ActivityIndicator size="small" color="#1a3a5c" /> : <Ionicons name="link-outline" size={21} color="#1a3a5c" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setModalLogin(false)}>
              <Text style={styles.modalCancelText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: convidar responsável externo */}
      <Modal visible={modalResp === 'convidar'} transparent animationType="slide" onRequestClose={() => setModalResp(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Convidar responsável</Text>
            <Text style={styles.modalSub}>Um link será gerado para o responsável ativar o acesso.</Text>
            <TextInput
              value={novoEmail}
              onChangeText={setNovoEmail}
              placeholder="E-mail do responsável"
              style={styles.modalInput}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              value={novoParentesco}
              onChangeText={setNovoParentesco}
              placeholder="Parentesco (ex.: Mãe, Pai)"
              style={[styles.modalInput, { marginTop: 10 }]}
            />

            {linkConvite ? (
              <View style={styles.linkBox}>
                <Text style={styles.linkBoxText} numberOfLines={2}>{linkConvite}</Text>
                <TouchableOpacity style={styles.linkCopyBtn} onPress={() => copiarLink(linkConvite)}>
                  <Ionicons name="copy-outline" size={18} color="#1a3a5c" />
                  <Text style={styles.linkCopyText}>Copiar</Text>
                </TouchableOpacity>
                <Text style={styles.linkBoxHint}>Envie este link via WhatsApp ou e-mail para o responsável.</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.modalSave, salvandoResp && { opacity: 0.6 }]}
                onPress={criarConvite}
                disabled={salvandoResp}
              >
                {salvandoResp
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Ionicons name="link" size={18} color="#fff" />
                      <Text style={styles.modalSaveText}>Gerar link de convite</Text>
                    </>
                }
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalCancel} onPress={() => { setModalResp(null); setLinkConvite(''); }}>
              <Text style={styles.modalCancelText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalTipo} transparent animationType="slide" onRequestClose={() => setModalTipo(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adicionar documento</Text>
            <Text style={styles.modalSub}>Esse item passa a contar na lista exigida de documentos.</Text>
            <TextInput
              value={novoTipoNome}
              onChangeText={setNovoTipoNome}
              placeholder="Ex.: Autorização especial"
              style={styles.modalInput}
              autoFocus
            />
            <TouchableOpacity style={styles.modalSave} onPress={adicionarTipoDocumento}>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.modalSaveText}>Salvar documento</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setModalTipo(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={fotoMenuVisivel} transparent animationType="fade" onRequestClose={() => setFotoMenuVisivel(false)}>
        <Pressable style={styles.fotoMenuOverlay} onPress={() => setFotoMenuVisivel(false)}>
          <Pressable style={styles.fotoMenuCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.fotoMenuTitulo}>Foto 3x4</Text>
            <Text style={styles.fotoMenuSub}>Escolha como deseja atualizar a foto oficial do membro.</Text>
            <TouchableOpacity style={styles.fotoMenuOpcao} onPress={() => escolherFotoPerfilWeb(true)}>
              <Ionicons name="camera-outline" size={22} color="#1a3a5c" />
              <Text style={styles.fotoMenuOpcaoText}>Abrir câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fotoMenuOpcao} onPress={() => escolherFotoPerfilWeb(false)}>
              <Ionicons name="image-outline" size={22} color="#1a3a5c" />
              <Text style={styles.fotoMenuOpcaoText}>Escolher da galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fotoMenuCancelar} onPress={() => setFotoMenuVisivel(false)}>
              <Text style={styles.fotoMenuCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <BottomNav />
    </View>
  );
}

function CampoEdit({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.editCampo}>
      <Text style={styles.editCampoLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    transitionProperty: 'padding',
    transitionDuration: '220ms',
    transitionTimingFunction: 'ease-out',
  } as any,
  headerCompacto: { paddingTop: 44, paddingBottom: 12, paddingHorizontal: 56 },
  backBtn: { position: 'absolute', top: 52, left: 16, padding: 8 },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
    transitionProperty: 'margin',
    transitionDuration: '220ms',
    transitionTimingFunction: 'ease-out',
  } as any,
  avatarWrapperCompacto: { marginBottom: 6 },
  avatarImg: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    transitionProperty: 'width, height, border-radius, border-width',
    transitionDuration: '220ms',
    transitionTimingFunction: 'ease-out',
  } as any,
  avatarImgCompacto: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarGrande: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    transitionProperty: 'width, height, border-radius, border-width',
    transitionDuration: '220ms',
    transitionTimingFunction: 'ease-out',
  } as any,
  avatarGrandeCompacto: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarLetra: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    transitionProperty: 'font-size',
    transitionDuration: '220ms',
    transitionTimingFunction: 'ease-out',
  } as any,
  avatarLetraCompacta: { fontSize: 19 },
  avatarOverlay: { position: 'absolute', inset: 0, borderRadius: 43, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  avatarCameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  nome: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    transitionProperty: 'font-size',
    transitionDuration: '220ms',
    transitionTimingFunction: 'ease-out',
  } as any,
  nomeCompacto: { fontSize: 16, maxWidth: '100%' },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  backToListBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  backToListText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  headerDangerBox: { marginTop: 12, alignItems: 'center', gap: 7 },
  headerDangerTitle: { color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', opacity: 0.9 },
  headerDangerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerInativarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(230,81,0,0.9)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  headerReativarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(46,125,50,0.9)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  headerExcluirBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(198,40,40,0.95)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  headerDangerBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  abasWrapper: { position: 'relative', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  abasScroll: { backgroundColor: '#fff', maxHeight: 46 },
  abasContent: { flexDirection: 'row', paddingHorizontal: 4 },
  abasHint: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderLeftWidth: 1,
    borderLeftColor: '#eef2f6',
  },
  abas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  aba: { paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  abaAtiva: { borderBottomWidth: 2, borderBottomColor: '#1a3a5c' },
  abaText: { fontSize: 12, color: '#888', fontWeight: '600' },
  abaTextAtiva: { color: '#1a3a5c' },
  content: { flex: 1, padding: 12 },
  docSegurancaNote: { flexDirection: 'row', backgroundColor: '#e3f2fd', borderRadius: 10, padding: 10, marginBottom: 8, gap: 8, alignItems: 'flex-start' },
  docSegurancaText: { flex: 1, fontSize: 12, color: '#1565c0', lineHeight: 16 },
  docToolbar: { flexDirection: 'row', gap: 12, marginBottom: 10, paddingHorizontal: 4, alignItems: 'center', flexWrap: 'wrap' },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendaText: { fontSize: 11, color: '#666' },
  addDocBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1a3a5c', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  addDocText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  docCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 6, overflow: 'hidden', elevation: 1 },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  statusBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  statusBtnTravado: { opacity: 0.75 },
  itemLabel: { flex: 1, fontSize: 13, color: '#333', fontWeight: '700' },
  docStatusText: { fontSize: 11, marginTop: 2, fontWeight: '700' },
  docLockedText: { fontSize: 10, color: '#78909c', marginTop: 2 },
  fotoCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e8f0fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fotoCountText: { fontSize: 11, color: '#1a3a5c', fontWeight: '700' },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docFotoBtn: { padding: 7, borderRadius: 8, backgroundColor: '#f0f4f8' },
  docTrashBtn: { padding: 7, borderRadius: 8, backgroundColor: '#fff5f5' },
  fotosRow: { paddingHorizontal: 12, paddingBottom: 10 },
  miniThumb: { position: 'relative', marginRight: 6 },
  miniThumbImg: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
  miniFile: { width: 82, height: 64, borderRadius: 8, backgroundColor: '#eef3f8', justifyContent: 'center', alignItems: 'center', padding: 6 },
  miniFileText: { fontSize: 9, color: '#1a3a5c', marginTop: 4, maxWidth: 70 },
  miniThumbNum: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  miniThumbNumText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 6, gap: 12, elevation: 1 },
  especCard: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 6, elevation: 1 },
  especHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  especOk: { color: '#2e7d32', fontSize: 12, fontWeight: '700' },
  especDeleteBtn: { marginLeft: 2, padding: 6, borderRadius: 8, backgroundColor: '#fff5f5' },
  especOrigemExcluida: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 9, marginLeft: 32, backgroundColor: '#fff3e0', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  especOrigemText: { fontSize: 11, fontWeight: '800', color: '#b45309' },
  classeIndicador: { width: 12, height: 12, borderRadius: 6 },
  classeStatus: { fontSize: 12, fontWeight: '600' },
  investBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#c9d8e6', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#f7fbff' },
  investBtnAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  investText: { color: '#1a3a5c', fontSize: 10, fontWeight: '800' },
  investTextAtivo: { color: '#fff' },
  receberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, elevation: 1 },
  receberIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  receberNome: { fontSize: 14, color: '#1f2933', fontWeight: '900' },
  receberSub: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  receberProgresso: { fontSize: 11, color: '#1a3a5c', fontWeight: '800', marginTop: 5 },
  receberStatus: { alignSelf: 'flex-start', marginTop: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  receberStatusText: { fontSize: 11, fontWeight: '900' },
  entregarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1a3a5c', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14 },
  entregarBtnText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  vazio: { textAlign: 'center', color: '#999', marginTop: 30 },
  viewerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
  viewerImg: { width: '100%', height: '70%' },
  viewerFile: { alignItems: 'center', paddingHorizontal: 28 },
  viewerFileName: { color: '#fff', fontSize: 18, textAlign: 'center', marginTop: 12, fontWeight: '700' },
  viewerOpen: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, borderWidth: 1, borderColor: '#fff', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  viewerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, marginTop: 16 },
  viewerNavBtn: { padding: 10 },
  viewerCounter: { color: '#fff', fontSize: 16, fontWeight: '600', minWidth: 60, textAlign: 'center' },
  viewerDelete: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 20, backgroundColor: 'rgba(231,76,60,0.8)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, gap: 12 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#102a43' },
  modalSub: { color: '#777', fontSize: 13 },
  modalInput: { borderWidth: 1, borderColor: '#d8e0e8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  modalSave: { marginTop: 4, backgroundColor: '#1a3a5c', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  modalSaveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  modalCancel: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { color: '#777', fontWeight: '700' },
  // Responsáveis
  respToolbar: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  respBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1a3a5c', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  respBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  respSecTitle: { fontSize: 12, fontWeight: '800', color: '#546e7a', marginBottom: 8, paddingHorizontal: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  respCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
  respAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a3a5c', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  respAvatarText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  respNome: { fontSize: 14, fontWeight: '800', color: '#1f2937' },
  respEmail: { fontSize: 11, color: '#78909c', marginTop: 1 },
  respParentesco: { fontSize: 11, color: '#1a3a5c', fontWeight: '700', marginTop: 2 },
  userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f0f4f8', gap: 10 },
  userItemAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a3a5c', justifyContent: 'center', alignItems: 'center' },
  userItemAvatarText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  userItemNome: { fontSize: 14, fontWeight: '800', color: '#263238' },
  userItemEmail: { fontSize: 11, color: '#78909c' },
  linkBox: { backgroundColor: '#eef3f8', borderRadius: 12, padding: 12, marginTop: 12, gap: 8 },
  linkBoxText: { fontSize: 12, color: '#1a3a5c', fontWeight: '700' },
  linkCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#c9d8e6' },
  linkCopyText: { fontSize: 13, color: '#1a3a5c', fontWeight: '800' },
  linkBoxHint: { fontSize: 11, color: '#546e7a', lineHeight: 16 },
  respHeaderBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  respHeaderBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Aba editar
  editCampo: { marginBottom: 14 },
  editCampoLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 6 },
  editInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chipBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  chipBtnAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipBtnDisabled: { opacity: 0.38 },
  chipBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  chipBtnTextDisabled: { color: '#999' },
  unChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa', marginRight: 8 },
  unChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  editAviso: { color: '#777', fontSize: 12, marginTop: 8 },
  responsavelReadonly: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eef6ff', borderWidth: 1, borderColor: '#d4e5f6', borderRadius: 12, padding: 12 },
  responsavelReadonlyText: { flex: 1, color: '#1a3a5c', fontSize: 14, fontWeight: '800' },
  mfaBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  mfaBoxOk: { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' },
  mfaBoxErro: { backgroundColor: '#ffebee', borderColor: '#ef9a9a' },
  mfaBoxText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  mfaConfirmBox: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffb74d', borderRadius: 10, padding: 12, gap: 10 },
  mfaConfirmTexto: { color: '#5d3200', fontSize: 13, lineHeight: 18 },
  mfaConfirmBotoes: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  mfaConfirmCancelar: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#bbb', backgroundColor: '#f5f5f5' },
  mfaConfirmCancelarText: { color: '#555', fontWeight: '700', fontSize: 13 },
  mfaConfirmOk: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#c62828' },
  mfaConfirmOkText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  mfaResetBtn: { backgroundColor: '#fff7e6', borderWidth: 1, borderColor: '#ffd58a', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mfaResetText: { color: '#7d4f00', fontWeight: '800', fontSize: 12 },
  removerAcessoBtn: { marginTop: 10, backgroundColor: '#fff0f0', borderWidth: 1, borderColor: '#ffc7c7', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  removerAcessoText: { color: '#c62828', fontWeight: '800', fontSize: 12 },
  loginVinculoInfo: { backgroundColor: '#f4f7fb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  loginVinculoInfoText: { color: '#607d8b', fontSize: 12, fontWeight: '700', flex: 1 },
  vincularLoginBtn: { marginTop: 10, backgroundColor: '#eaf2fb', borderWidth: 1, borderColor: '#c1d8ee', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  vincularLoginText: { color: '#1a3a5c', fontWeight: '800', fontSize: 12 },
  salvarBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 16, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  salvarBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  fotoMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  fotoMenuCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, gap: 10 },
  fotoMenuTitulo: { fontSize: 18, fontWeight: '900', color: '#1a3a5c' },
  fotoMenuSub: { fontSize: 13, color: '#667', marginBottom: 4 },
  fotoMenuOpcao: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f3f7fb', borderRadius: 14, padding: 14 },
  fotoMenuOpcaoText: { fontSize: 15, fontWeight: '800', color: '#1a3a5c' },
  fotoMenuCancelar: { alignItems: 'center', paddingVertical: 12 },
  fotoMenuCancelarText: { color: '#888', fontWeight: '800' },
  divisorPerigo: { borderTopWidth: 1, borderTopColor: '#ffd0d0', marginTop: 28, marginBottom: 8 },
  zonaPerigo: { fontSize: 11, fontWeight: '800', color: '#c62828', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  inativarBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ff8f00', borderRadius: 12, padding: 13, marginBottom: 10, backgroundColor: '#fff8f0' },
  inativarBtnText: { color: '#e65100', fontWeight: '800', fontSize: 14 },
  reativarBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#66bb6a', borderRadius: 12, padding: 13, marginBottom: 10, backgroundColor: '#f1f8f1' },
  reativarBtnText: { color: '#2e7d32', fontWeight: '800', fontSize: 14 },
  excluirBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#c62828', borderRadius: 12, padding: 13, marginBottom: 10 },
  excluirBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});

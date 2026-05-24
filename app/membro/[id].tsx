import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image,
  ActivityIndicator, ActionSheetIOS, Platform, Modal, TextInput, Linking,
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
import { carregarDocumentosModelo } from '../../src/lib/modelosPrograma';
import { carregarDocumentosPaisConfig, janelaPaisAberta } from '../../src/lib/documentosPaisConfig';
import type { Desbravador, Documento, ProgressoClasse } from '../../src/types';

type Aba = 'docs' | 'classes' | 'especs' | 'receber' | 'responsaveis';
type RespItem = { id: string; usuario_id: string; nome: string; email: string; parentesco: string | null };
type ConviteItem = { id: string; token: string; email: string; parentesco: string | null; created_at: string };
type UserItem = { id: string; nome: string; email: string };
type StatusDoc = 'OK' | 'NOK' | 'NA' | null;
type DocTipo = { campo: string; nome: string; ativo?: boolean; ordem?: number; limite_anexos?: number | null };
type DocArquivo = { url: string; nome?: string | null; tipo?: string | null };
type StatusRespostaAtividade = 'pendente' | 'entregue' | 'em_correcao' | 'aprovada' | 'recusada';
type ItemAReceber = {
  atividade_id: number;
  titulo: string;
  tipo: 'classe' | 'especialidade';
  nome: string;
  status: StatusRespostaAtividade;
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

async function uploadArquivoDocumento(
  dbv_id: number,
  campo: string,
  uri: string,
  nome: string,
  tipo: string,
): Promise<string | null> {
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
    return signed?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export default function MembroScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dbv, setDBV] = useState<Desbravador | null>(null);
  const [doc, setDoc] = useState<Documento | null>(null);
  const [classe, setClasse] = useState<ProgressoClasse | null>(null);
  const [especs, setEspecs] = useState<Array<{ nome: string; status: string }>>([]);
  const [itensAReceber, setItensAReceber] = useState<ItemAReceber[]>([]);
  const [docTipos, setDocTipos] = useState<DocTipo[]>([]);
  const [docStatus, setDocStatus] = useState<Record<string, StatusDoc>>({});
  const [arquivosDoc, setArquivosDoc] = useState<Record<string, DocArquivo[]>>({});
  const [aba, setAba] = useState<Aba>('docs');
  const [upFoto, setUpFoto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [arquivoCarregando, setArquivoCarregando] = useState<string | null>(null);
  const [souConselheiro, setSouConselheiro] = useState(false);
  const [viewer, setViewer] = useState<{ campo: string; arquivos: DocArquivo[]; idx: number } | null>(null);
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

  const { atualizarDocumento, atualizarClasse, atualizarFoto } = useDBVStore();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const podeGerenciarDocsTodos = permissoes.temPerfil(['usuario_secretaria']);
  const podeGerenciarMembros = permissoes.pode('gerenciar_membros');
  const ehProprioMembro = String(usuario?.dbv_id) === id;
  const ehFilhoNoContexto = contextoAtivo?.tipo === 'responsavel' && String(contextoAtivo.membro_id) === id;
  const isAdmin = podeGerenciarDocsTodos || podeGerenciarMembros;
  const podeEditarUploadsDoc = podeGerenciarDocsTodos || (ehFilhoNoContexto && paisPodemEditarDocs);
  const podeEditarStatusDoc = podeEditarUploadsDoc;
  const podeEditarFotoPerfil = podeGerenciarDocsTodos || podeGerenciarMembros;
  const podeVerArquivosDoc = podeGerenciarDocsTodos || ehFilhoNoContexto || ehProprioMembro;

  useEffect(() => { carregarDados(); }, [id]);
  useEffect(() => { if (aba === 'responsaveis' && isAdmin) carregarResponsaveis(); }, [aba]);

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
        .select('id,titulo,destino,unidade_id,dbv_id,item_formativo_tipo,item_formativo_nome')
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
      }>;
      if (listaAtividades.length === 0) {
        setItensAReceber([]);
        return;
      }

      const ids = listaAtividades.map((a) => a.id);
      const [{ data: alvos }, { data: respostas }] = await Promise.all([
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
      ]);

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

        resultado.push({
          atividade_id: atividade.id,
          titulo: atividade.titulo,
          tipo: atividade.item_formativo_tipo,
          nome: atividade.item_formativo_nome,
          status: respostasPorAtividade.get(atividade.id) ?? 'pendente',
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
        supabase.from('especialidades').select('nome, status').eq('clube_id', clubeId).eq('dbv_id', dbvId).order('nome'),
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
        arquivosMap[img.campo].push({ url: img.url, nome: img.nome, tipo: img.tipo ?? 'image' });
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
        (es ?? []) as Array<{ nome: string; status: string }>,
        cl,
      );

      setDBV(d as Desbravador | null);
      setDoc(dc as Documento | null);
      setClasse(cl as ProgressoClasse | null);
      setEspecs((es ?? []) as Array<{ nome: string; status: string }>);
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
    const es = await db.getAllAsync<{ nome: string; status: string }>('SELECT nome, status FROM especialidades WHERE dbv_id = ?', [id]);
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
      let url = campo === 'foto'
        ? await uploadFotoMembro(Number(id), uri, nome, tipo)
        : await uploadArquivoDocumento(Number(id), campo, uri, nome, tipo);
      if (campo === 'foto' && !url) {
        url = await uploadArquivoDocumento(Number(id), campo, uri, nome, tipo);
      }
      if (Platform.OS === 'web' && !url) {
        throw new Error('Falha no upload do arquivo.');
      }
      const arquivoFinal = { url: url ?? uri, nome, tipo: tipo.startsWith('image/') ? 'image' : tipo };

      if (Platform.OS === 'web' && url) {
        const clubeId = getClubeAtivoId();
        if (campo === 'foto') {
          await supabase.from('documento_imagens').delete().eq('clube_id', clubeId).eq('dbv_id', Number(id)).eq('campo', 'foto');
        }
        const { error } = await supabase.from('documento_imagens').insert({
          clube_id: clubeId,
          dbv_id: Number(id),
          campo,
          url,
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
    if (Platform.OS === 'web') {
      await supabase
        .from('documento_imagens')
        .delete()
        .eq('clube_id', getClubeAtivoId())
        .eq('dbv_id', Number(id))
        .eq('campo', campo)
        .eq('url', arquivo.url);
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

  async function removerTipoDocumento(tipo: DocTipo) {
    const ok = await confirmar('Remover tipo de documento', `Remover "${tipo.nome}" da lista de documentos exigidos?`);
    if (!ok) return;
    if (Platform.OS === 'web') {
      const { error } = await supabase
        .from('documentos_modelo')
        .update({ ativo: false })
        .eq('clube_id', getClubeAtivoId())
        .eq('campo', tipo.campo);
      if (error) return Alert.alert('Erro', 'Não foi possível remover o documento.');
    }
    setDocTipos((prev) => prev.filter((d) => d.campo !== tipo.campo));
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
            { clube_id: clubeId, dbv_id: dbvId, nome: item.nome, status: 'OK', updated_at: new Date().toISOString() },
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

  function abrirArquivo(arquivo: DocArquivo) {
    if (Platform.OS === 'web') window.open(arquivo.url, '_blank', 'noopener,noreferrer');
    else Linking.openURL(arquivo.url).catch(() => {});
  }

  // ── Responsáveis ─────────────────────────────────────────────────────
  async function carregarResponsaveis() {
    if (Platform.OS !== 'web') return;
    const clubeId = getClubeAtivoId();
    const dbvId = Number(id);
    const [{ data: resps }, { data: cnvs }] = await Promise.all([
      supabase.from('responsavel_membros')
        .select('id, usuario_id, parentesco')
        .eq('clube_id', clubeId).eq('membro_id', dbvId).eq('ativo', true),
      supabase.from('responsavel_convites')
        .select('id, token, email, parentesco, created_at')
        .eq('clube_id', clubeId).eq('membro_id', dbvId).eq('usado', false),
    ]);
    const ids = (resps ?? []).map((r: any) => r.usuario_id).filter(Boolean);
    const userMap = new Map<string, { nome: string; email: string }>();
    if (ids.length > 0) {
      const { data: us } = await supabase.from('usuarios').select('id, nome, email').in('id', ids);
      for (const u of (us ?? []) as any[]) userMap.set(u.id, u);
    }
    setResponsaveis((resps ?? []).map((r: any) => ({
      id: r.id, usuario_id: r.usuario_id,
      nome: userMap.get(r.usuario_id)?.nome ?? 'Usuário',
      email: userMap.get(r.usuario_id)?.email ?? '',
      parentesco: r.parentesco ?? null,
    })));
    setConvites((cnvs ?? []) as ConviteItem[]);
  }

  async function buscarUsuariosClube(busca: string) {
    const clubeId = getClubeAtivoId();
    const { data: uc } = await supabase.from('usuario_clubes')
      .select('usuario_id').eq('clube_id', clubeId).eq('ativo', true);
    const ids = (uc ?? []).map((u: any) => u.usuario_id).filter(Boolean);
    if (ids.length === 0) { setUsuariosClube([]); return; }
    let q = supabase.from('usuarios').select('id, nome, email').in('id', ids);
    if (busca.trim()) q = (q as any).ilike('nome', `%${busca}%`);
    const { data } = await (q as any).limit(20);
    const vinculados = new Set(responsaveis.map((r) => r.usuario_id));
    setUsuariosClube(((data ?? []) as any[]).filter((u: any) => !vinculados.has(u.id)));
  }

  async function vincularUsuario(u: UserItem) {
    setSalvandoResp(true);
    try {
      const { error } = await supabase.from('responsavel_membros').insert({
        usuario_id: u.id, membro_id: Number(id),
        clube_id: getClubeAtivoId(), programa_id: getProgramaAtivoId(), ativo: true,
      });
      if (error) throw error;
      await carregarResponsaveis();
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

  async function removerResponsavel(respId: string) {
    const ok = await confirmar('Remover responsável', 'Desvincular este responsável do membro?');
    if (!ok) return;
    await supabase.from('responsavel_membros').update({ ativo: false }).eq('id', respId);
    setResponsaveis((prev) => prev.filter((r) => r.id !== respId));
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

  function statusDocIcon(val: StatusDoc): { icon: string; color: string; label: string } {
    if (val === 'OK') return { icon: 'checkmark-circle', color: '#2e7d32', label: 'Entregue' };
    if (val === 'NA') return { icon: 'remove-circle', color: '#78909c', label: 'N/A' };
    return { icon: 'close-circle', color: '#c62828', label: 'Pendente' };
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: cor }]}>
        <TouchableOpacity onPress={() => router.push('/membros')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={escolherFotoPerfil} style={styles.avatarWrapper} disabled={upFoto || !podeEditarFotoPerfil}>
          {dbv.foto_url ? (
            <Image source={{ uri: dbv.foto_url }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarGrande, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarLetra}>{dbv.nome[0]}</Text>
            </View>
          )}
          {upFoto ? (
            <View style={styles.avatarOverlay}><ActivityIndicator color="#fff" size="small" /></View>
          ) : null}
        </TouchableOpacity>

        <Text style={styles.nome}>{dbv.nome}</Text>
        <Text style={styles.sub}>{dbv.unidade_nome} • {dbv.cargo} • {dbv.idade} anos</Text>

        <TouchableOpacity style={styles.backToListBtn} onPress={() => router.push('/membros')}>
          <Ionicons name="people" size={16} color="#fff" />
          <Text style={styles.backToListText}>Voltar para membros</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.abas}>
        {([
          { key: 'docs', label: `Docs (${docsOk}/${docsTotal})` },
          { key: 'classes', label: 'Classes' },
          { key: 'especs', label: 'Especs.' },
          { key: 'receber', label: `Receber (${itensAReceber.length})` },
          ...(isAdmin ? [{ key: 'responsaveis', label: `Resp. (${responsaveis.length})` }] : []),
        ] as { key: Aba; label: string }[]).map(({ key, label }) => (
          <TouchableOpacity key={key} style={[styles.aba, aba === key && styles.abaAtiva]} onPress={() => setAba(key)}>
            <Text style={[styles.abaText, aba === key && styles.abaTextAtiva]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
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
              const temImagem = arquivos.some((a) => String(a.tipo ?? '').startsWith('image') || /\.(png|jpe?g|webp)$/i.test(a.url));

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
                        onPress={() => podeVerArquivosDoc ? setViewer({ campo: tipo.campo, arquivos, idx: 0 }) : undefined}
                        disabled={!podeVerArquivosDoc}
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

                    {podeGerenciarDocsTodos && (
                      <TouchableOpacity onPress={() => removerTipoDocumento(tipo)} style={styles.docTrashBtn}>
                        <Ionicons name="trash-outline" size={18} color="#c62828" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {arquivos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotosRow}>
                      {arquivos.map((arquivo, idx) => {
                        const isImg = String(arquivo.tipo ?? '').startsWith('image') || /\.(png|jpe?g|webp)$/i.test(arquivo.url);
                        return (
                          <TouchableOpacity key={`${arquivo.url}-${idx}`} onPress={() => podeVerArquivosDoc && setViewer({ campo: tipo.campo, arquivos, idx })} style={styles.miniThumb}>
                            {isImg ? (
                              <Image source={{ uri: arquivo.url }} style={styles.miniThumbImg} />
                            ) : (
                              <View style={styles.miniFile}>
                                <Ionicons name="document-text" size={24} color="#1a3a5c" />
                                <Text numberOfLines={1} style={styles.miniFileText}>{arquivo.nome ?? 'Arquivo'}</Text>
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
              <View key={i} style={styles.itemRow}>
                <Ionicons name="star" size={20} color="#ff9800" />
                <Text style={styles.itemLabel}>{e.nome}</Text>
                <Text style={{ color: '#2e7d32', fontSize: 12, fontWeight: '700' }}>OK</Text>
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

            {responsaveis.length > 0 && (
              <>
                <Text style={styles.respSecTitle}>Vinculados</Text>
                {responsaveis.map((r) => (
                  <View key={r.id} style={styles.respCard}>
                    <View style={styles.respAvatar}>
                      <Text style={styles.respAvatarText}>{r.nome[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.respNome}>{r.nome}</Text>
                      <Text style={styles.respEmail}>{r.email}</Text>
                      {r.parentesco ? <Text style={styles.respParentesco}>{r.parentesco}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => removerResponsavel(r.id)} style={styles.docTrashBtn}>
                      <Ionicons name="trash-outline" size={18} color="#c62828" />
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
              <Text style={styles.vazio}>Nenhum responsável vinculado.</Text>
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
                    <View style={[styles.receberStatus, { backgroundColor: `${color}16`, borderColor: `${color}55` }]}>
                      <Text style={[styles.receberStatusText, { color }]}>{statusReceberLabel(item.status)}</Text>
                    </View>
                  </View>
                  {isAdmin && item.status === 'aprovada' && (
                    <TouchableOpacity style={styles.entregarBtn} onPress={() => registrarEntregaInvestidura(item)}>
                      <Ionicons name="gift" size={15} color="#fff" />
                      <Text style={styles.entregarBtnText}>Entregar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!viewer} transparent animationType="fade">
        <View style={styles.viewerBg}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewer(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          {viewer && (() => {
            const arquivo = viewer.arquivos[viewer.idx];
            const isImg = String(arquivo.tipo ?? '').startsWith('image') || /\.(png|jpe?g|webp)$/i.test(arquivo.url);
            return (
              <>
                {isImg ? (
                  <Image source={{ uri: arquivo.url }} style={styles.viewerImg} resizeMode="contain" />
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
                    onPress={() => setViewer((p) => p ? { ...p, idx: Math.max(0, p.idx - 1) } : p)}
                    disabled={viewer.idx === 0}
                    style={[styles.viewerNavBtn, viewer.idx === 0 && { opacity: 0.3 }]}
                  >
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.viewerCounter}>{viewer.idx + 1} / {viewer.arquivos.length}</Text>
                  <TouchableOpacity
                    onPress={() => setViewer((p) => p ? { ...p, idx: Math.min(p.arquivos.length - 1, p.idx + 1) } : p)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 52, left: 16, padding: 8 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarImg: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarGrande: { width: 86, height: 86, borderRadius: 43, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarLetra: { color: '#fff', fontSize: 36, fontWeight: '800' },
  avatarOverlay: { position: 'absolute', inset: 0, borderRadius: 43, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  avatarCameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  nome: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  backToListBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  backToListText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  abas: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  aba: { flex: 1, paddingVertical: 12, alignItems: 'center' },
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
});

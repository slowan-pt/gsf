import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { enviarParaAlvos } from '../../src/lib/notifications';
import { DateField } from '../../src/components/DateField';
import { BottomNav } from '../../src/components/BottomNav';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import {
  PALETA_PADRAO_ATIVIDADES,
  FONTE_PADRAO_ATIVIDADES,
  carregarVisualAtividades,
  corCabecalhoDaPaleta,
  fonteAtividadesPorId,
  paletaAtividadesConfigurada,
} from '../../src/lib/paletaAtividades';
import {
  carregarClassesModelo,
  carregarEspecialidadesModelo,
  classesFallback,
  type ClasseModelo,
  type EspecialidadeModelo,
} from '../../src/lib/modelosPrograma';

type Destino = 'todos' | 'unidade' | 'desbravador';
type AlvoTipo = 'todos' | 'unidade' | 'membro';
type StatusResposta = 'pendente' | 'entregue' | 'em_correcao' | 'aprovada' | 'recusada'; // recusada: legado, não exibido mais na UI
type ItemFormativoTipo = 'classe' | 'especialidade' | null;
const DIRETORIA_GRUPO_ID = -1000;

interface Atividade {
  id: number;
  supabase_id?: number | null;
  titulo: string;
  descricao: string | null;
  data: string | null;
  destino: Destino;
  unidade_id: number | null;
  unidade_nome: string | null;
  dbv_id: number | null;
  dbv_nome: string | null;
  criado_por: string | null;
  avaliador_id?: string | null;
  avaliador_nome?: string | null;
  item_formativo_tipo?: ItemFormativoTipo;
  item_formativo_nome?: string | null;
  gera_investidura?: number | boolean | null;
  plano_formativo_id?: number | null;
  created_at: string;
}

interface PlanoFormativo {
  id: number;
  tipo: Exclude<ItemFormativoTipo, null>;
  item_nome: string;
  titulo: string;
  avaliacoes_necessarias: number;
  ativo: boolean;
}

interface GrupoAtividades {
  key: string;
  plano: PlanoFormativo | null;
  atividades: Atividade[];
}

interface AtividadePlanoForm {
  atividade: Atividade | null;
  titulo: string;
  descricao: string;
  data: string;
  destino: Destino;
  buscaUnidade: string;
  buscaDbv: string;
  unidades: UnidadeLocal[];
  dbvs: DBVLocal[];
  avaliador: DiretorLocal | null;
  anexosPend: AnexoPendente[];
}

interface AlvoAtividade {
  id: number;
  supabase_id?: number | null;
  atividade_id: number;
  tipo: AlvoTipo;
  unidade_id: number | null;
  membro_id: number | null;
}

interface Anexo {
  id: number;
  supabase_id?: number | null;
  atividade_id: number;
  nome: string;
  url: string;
  tipo: 'image' | 'pdf' | 'word' | 'outro';
}

interface Resposta {
  id: number;
  supabase_id?: number | null;
  atividade_id: number;
  dbv_id: number;
  dbv_nome: string | null;
  texto: string | null;
  anexo_url: string | null;
  anexo_nome: string | null;
  status?: StatusResposta | null;
  nota?: number | null;
  comentario_avaliador?: string | null;
  avaliado_por?: string | null;
  avaliado_em?: string | null;
  entregue_em?: string | null;
  created_at: string;
}

interface AtividadeMensagem {
  id: number;
  supabase_id?: number | null;
  atividade_id: number;
  dbv_id: number;
  autor_tipo: 'membro' | 'avaliador' | 'sistema';
  autor_id?: string | null;
  autor_nome?: string | null;
  tipo: 'resposta' | 'aprovacao' | 'devolucao' | 'recusa' | 'sistema';
  texto?: string | null;
  anexo_url?: string | null;
  anexo_nome?: string | null;
  status?: StatusResposta | null;
  nota?: number | null;
  created_at: string;
}

interface AnexoPendente {
  chave: string;
  uri: string;
  nome: string;
  tipo: Anexo['tipo'];
  mime?: string | null;
  url?: string | null;
  storagePath?: string | null;
  enviando?: boolean;
  erro?: string | null;
}
interface RascunhoResposta {
  texto: string;
  anexo: AnexoPendente | null;
  updated_at: string;
}
interface UnidadeLocal { id: number; nome: string; cor: string; }
interface DBVLocal { id: number; nome: string; unidade_id: number | null; unidade_nome: string | null; }
interface DiretorLocal { id: string; nome: string; email: string; perfil: string; membro_id: number | null; }
interface MembroProgresso { id: number; nome: string; unidade_nome: string | null; resposta: Resposta | null; }

function fmt(d: string | null | undefined) {
  if (!d) return '';
  try {
    const base = d.includes('T') ? new Date(d) : new Date(`${d}T12:00:00`);
    return format(base, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return d;
  }
}

function prazoEncerrado(atividade: Pick<Atividade, 'data'>) {
  if (!atividade.data) return false;
  return format(new Date(), 'yyyy-MM-dd') > atividade.data.slice(0, 10);
}

function diasRestantes(atividade: Pick<Atividade, 'data'>): number | null {
  if (!atividade.data) return null;
  const hoje = new Date(format(new Date(), 'yyyy-MM-dd') + 'T00:00:00');
  const limite = new Date(atividade.data.slice(0, 10) + 'T00:00:00');
  return Math.round((limite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

/** Dentro da janela de 1 semana após o prazo, o membro pode editar mesmo com status aprovada */
function podeEditarAprovada(a: Pick<Atividade, 'data'>, resp: { status?: string | null } | null | undefined): boolean {
  if (resp?.status !== 'aprovada') return false;
  if (!a.data) return false;
  const janela = new Date(a.data.slice(0, 10) + 'T00:00:00');
  janela.setDate(janela.getDate() + 7);
  const hoje = new Date(format(new Date(), 'yyyy-MM-dd') + 'T00:00:00');
  return hoje <= janela;
}

function tipoAnexo(nome: string, mime?: string): Anexo['tipo'] {
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext) || mime?.includes('word')) return 'word';
  return 'outro';
}

function tipoIcon(tipo: Anexo['tipo']) {
  if (tipo === 'pdf') return { name: 'document-text' as const, color: '#c62828' };
  if (tipo === 'word') return { name: 'document-text' as const, color: '#1565c0' };
  if (tipo === 'image') return { name: 'image' as const, color: '#2e7d32' };
  return { name: 'attach' as const, color: '#555' };
}

function nomeArquivoSeguro(nome: string) {
  const limpo = String(nome || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return limpo || 'arquivo';
}

function novaChaveAnexo() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function caminhoStorageDaUrl(url: string) {
  const marcador = '/storage/v1/object/public/atividades/';
  const inicio = url.indexOf(marcador);
  if (inicio < 0) return null;
  return decodeURIComponent(url.slice(inicio + marcador.length).split('?')[0]);
}

function statusLabel(status?: StatusResposta | null) {
  if (status === 'aprovada') return 'Aprovada';
  if (status === 'em_correcao') return 'Para corrigir';
  if (status === 'recusada') return 'Recusada';
  if (status === 'entregue') return 'Entregue';
  return 'Pendente';
}

function statusColor(status?: StatusResposta | null) {
  if (status === 'aprovada') return '#2e7d32';
  if (status === 'em_correcao') return '#ef6c00';
  if (status === 'recusada') return '#c62828';
  if (status === 'entregue') return '#1565c0';
  return '#999';
}

function normalizarBusca(v: string | null | undefined) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function numeroOuNull(v: unknown) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numerosUnicos(valores: Array<number | null | undefined>) {
  return Array.from(new Set(valores.map(numeroOuNull).filter((n): n is number => n != null)));
}

async function uploadParaStorage(path: string, uri: string, mime: string): Promise<string | null> {
  try {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('Não foi possível ler o arquivo selecionado.');
    const blob = await res.blob();
    const { data, error } = await supabase.storage
      .from('atividades')
      .upload(path, blob, { upsert: true, contentType: mime });
    if (error) throw error;
    const publicUrl = supabase.storage.from('atividades').getPublicUrl(data.path).data.publicUrl;
    if (!publicUrl || publicUrl.startsWith('blob:') || publicUrl.startsWith('file:')) {
      throw new Error('O arquivo não foi enviado para o armazenamento.');
    }
    return publicUrl;
  } catch (e) {
    console.error('Falha no upload de atividade', e);
    throw e;
  }
}

function escolherArquivoWeb(options: {
  multiple?: boolean;
  accept: string;
  onFiles: (files: File[]) => void;
}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = !!options.multiple;
  input.accept = options.accept;
  input.onchange = () => options.onFiles(Array.from(input.files ?? []));
  input.click();
}

function uniqById<T extends { id: number }>(items: T[]) {
  const map = new Map<number, T>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
}

function conversaKey(atividadeId: number, dbvId: number) {
  return `${atividadeId}:${dbvId}`;
}

function chaveRascunhoResposta(atividadeId: number, dbvId: number) {
  return `atividade_resposta_rascunho_v1:${atividadeId}:${dbvId}`;
}

export default function AtividadesScreen() {
  const params = useLocalSearchParams<{ detalhes?: string; progresso?: string; aba?: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const contextos = useContextoStore((s) => s.contextos);
  const permissoes = usePermissoes();
  const isAdmin = permissoes.pode('gerenciar_atividades');
  const podeReabrir = permissoes.temPerfil(['admin_ti', 'admin_clube']);
  const clubeAtivoId = contextoAtivo?.clube_id ?? getClubeAtivoId();

  const membroAtualId = contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;
  const membroAtualNome = contextoAtivo?.membro_nome ?? usuario?.nome ?? null;
  const unidadeAtualId = contextoAtivo?.unidade_id ?? usuario?.unidade_id ?? null;
  const [filhosDados, setFilhosDados] = useState<DBVLocal[]>([]);

  const filhosCtxs = useMemo(
    () => contextos.filter(c => c.tipo === 'responsavel' && Number(c.clube_id) === Number(clubeAtivoId) && c.membro_id != null),
    [contextos, clubeAtivoId]
  );
  const ehPai = filhosCtxs.length > 0;
  const filhosIds = useMemo(() => numerosUnicos(filhosCtxs.map(c => c.membro_id)), [filhosCtxs]);
  const filhosUnidadeIds = useMemo(
    () => numerosUnicos([...filhosCtxs.map(c => c.unidade_id), ...filhosDados.map(f => f.unidade_id)]),
    [filhosCtxs, filhosDados]
  );

  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [alvosMap, setAlvosMap] = useState<Record<number, AlvoAtividade[]>>({});
  const [anexosMap, setAnexosMap] = useState<Record<number, Anexo[]>>({});
  const [respostasMap, setRespostasMap] = useState<Record<number, Resposta[]>>({});
  const [mensagensMap, setMensagensMap] = useState<Record<string, AtividadeMensagem[]>>({});
  const [loading, setLoading] = useState(true);
  // Rastreia se já houve pelo menos uma carga completa.
  // Evita que recargas em background (focus, fechar modal) mostrem tela branca.
  const jaCarregouRef = useRef(false);
  const [ehConselheiro, setEhConselheiro] = useState(false);
  const [aba, setAba] = useState<'lista' | 'filhos' | 'progresso'>('lista');

  const [modalCRUD, setModalCRUD] = useState(false);
  const [editando, setEditando] = useState<Atividade | null>(null);
  const [fTitulo, setFTitulo] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fData, setFData] = useState('');
  const [fDestino, setFDestino] = useState<Destino>('todos');
  const [fUnidades, setFUnidades] = useState<UnidadeLocal[]>([]);
  const [fDbvs, setFDbvs] = useState<DBVLocal[]>([]);
  const [fAvaliador, setFAvaliador] = useState<DiretorLocal | null>(null);
  const [fItemTipo, setFItemTipo] = useState<ItemFormativoTipo>(null);
  const [fItemNome, setFItemNome] = useState('');
  const [buscaItem, setBuscaItem] = useState('');
  const [buscaDbv, setBuscaDbv] = useState('');
  const [buscaUnidade, setBuscaUnidade] = useState('');
  const [anexosPend, setAnexosPend] = useState<AnexoPendente[]>([]);
  const uploadsCanceladosRef = useRef<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [unidades, setUnidades] = useState<UnidadeLocal[]>([]);
  const [dbvs, setDbvs] = useState<DBVLocal[]>([]);
  const [diretoria, setDiretoria] = useState<DiretorLocal[]>([]);
  const [classesModelo, setClassesModelo] = useState<ClasseModelo[]>([]);
  const [especialidadesModelo, setEspecialidadesModelo] = useState<EspecialidadeModelo[]>([]);
  const [planosFormativos, setPlanosFormativos] = useState<PlanoFormativo[]>([]);
  const [fPlanoId, setFPlanoId] = useState<number | null>(null);
  const [fNovoPlano, setFNovoPlano] = useState(false);
  const [fPlanoTitulo, setFPlanoTitulo] = useState('');
  const [fAvaliacoesNecessarias, setFAvaliacoesNecessarias] = useState('1');
  const [fAtividadesPlano, setFAtividadesPlano] = useState<AtividadePlanoForm[]>([]);
  const [etapaCadastro, setEtapaCadastro] = useState<1 | 2>(1);
  const [tituloPlanoEmErro, setTituloPlanoEmErro] = useState(false);
  const tituloPlanoRefs = useRef<Array<TextInput | null>>([]);
  const [blocoPaiPrazo, setBlocoPaiPrazo] = useState<number | null>(null);
  const [blocoPaiDestino, setBlocoPaiDestino] = useState<number | null>(null);
  const [blocoPaiAvaliador, setBlocoPaiAvaliador] = useState<number | null>(null);
  const [paletaAtividadeId, setPaletaAtividadeId] = useState(PALETA_PADRAO_ATIVIDADES);
  const [coresAtividade, setCoresAtividade] = useState<string[] | null>(null);
  const [fonteAtividadeId, setFonteAtividadeId] = useState(FONTE_PADRAO_ATIVIDADES);
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({});

  const [modalResp, setModalResp] = useState(false);
  const [respAtiv, setRespAtiv] = useState<Atividade | null>(null);
  const [respMembroId, setRespMembroId] = useState<number | null>(null);
  const [respMembroNome, setRespMembroNome] = useState<string | null>(null);
  const [respTexto, setRespTexto] = useState('');
  const [respAnexo, setRespAnexo] = useState<AnexoPendente | null>(null);
  const [enviandoResp, setEnviandoResp] = useState(false);
  const [rascunhoRespSalvoEm, setRascunhoRespSalvoEm] = useState<string | null>(null);
  const [respAnexoExistenteRemovido, setRespAnexoExistenteRemovido] = useState(false);
  const [atividadesParaRemoverDoBloco, setAtividadesParaRemoverDoBloco] = useState<number[]>([]);
  const carregandoRascunhoRespRef = useRef(false);
  const [abaMembro, setAbaMembro] = useState<'pendentes' | 'enviadas'>('pendentes');
  const [cardExpandidoId, setCardExpandidoId] = useState<number | null>(null);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [detalheAtiv, setDetalheAtiv] = useState<Atividade | null>(null);

  const [modalProg, setModalProg] = useState(false);
  const [progAtiv, setProgAtiv] = useState<Atividade | null>(null);
  const [membrosStatus, setMembrosStatus] = useState<MembroProgresso[]>([]);
  const [loadingProg, setLoadingProg] = useState(false);

  const [modalAval, setModalAval] = useState(false);
  const [avalAtiv, setAvalAtiv] = useState<Atividade | null>(null);
  const [avalResp, setAvalResp] = useState<Resposta | null>(null);
  const [avalStatus, setAvalStatus] = useState<StatusResposta>('aprovada');
  const [avalNota, setAvalNota] = useState('');
  const [avalComentario, setAvalComentario] = useState('');
  const [avalAnexo, setAvalAnexo] = useState<AnexoPendente | null>(null);
  const [salvandoAval, setSalvandoAval] = useState(false);

  const podeVerProgresso = isAdmin || ehConselheiro;
  const paletaAtividade = useMemo(
    () => paletaAtividadesConfigurada(paletaAtividadeId, coresAtividade),
    [paletaAtividadeId, coresAtividade]
  );
  const fonteAtividade = useMemo(() => fonteAtividadesPorId(fonteAtividadeId), [fonteAtividadeId]);
  const fonteAtividadeStyle = fonteAtividade.fontFamily ? { fontFamily: fonteAtividade.fontFamily } : undefined;
  const headerColor = corCabecalhoDaPaleta(paletaAtividade);

  useEffect(() => {
    let ativo = true;
    async function carregarFilhosResponsavel() {
      if (filhosIds.length === 0) {
        if (ativo) setFilhosDados([]);
        return;
      }
      try {
        const { data } = await supabase
          .from('desbravadores')
          .select('id,nome,unidade_id,unidade_nome')
          .eq('clube_id', clubeAtivoId)
          .in('id', filhosIds);
        if (!ativo) return;
        setFilhosDados(((data ?? []) as any[]).map((m) => ({
          id: Number(m.id),
          nome: m.nome,
          unidade_id: m.unidade_id ?? null,
          unidade_nome: m.unidade_nome ?? null,
        })));
      } catch {
        if (ativo) setFilhosDados([]);
      }
    }
    carregarFilhosResponsavel();
    return () => { ativo = false; };
  }, [clubeAtivoId, filhosIds.join(',')]);

  useEffect(() => {
    const id = contextoAtivo?.membro_id ?? usuario?.dbv_id;
    if (!id) return;
    getDB().then(async db => {
      const d = await db.getFirstAsync<{ cargo: string | null }>(
        'SELECT cargo FROM desbravadores WHERE id = ?',
        [id]
      );
      const c = (d?.cargo ?? '').toLowerCase();
      setEhConselheiro(c.includes('conselheiro') || c.includes('conselheira'));
    }).catch(() => {});
  }, [contextoAtivo?.membro_id, usuario?.dbv_id]);

  useFocusEffect(useCallback(() => {
    carregarVisualAtividades(getClubeAtivoId()).then((config) => {
      setPaletaAtividadeId(config.paletaId);
      setCoresAtividade(config.coresPersonalizadas);
      setFonteAtividadeId(config.fonteId);
    }).catch(() => {});
    sincronizar().then(carregar);
  }, [isAdmin, usuario?.id, contextoAtivo?.id, filhosIds.join(','), filhosUnidadeIds.join(',')]));

  useEffect(() => {
    const abaParam = Array.isArray(params.aba) ? params.aba[0] : params.aba;
    if (abaParam === 'pendentes' || abaParam === 'enviadas') {
      setAbaMembro(abaParam);
    }
    if (abaParam === 'lista' || abaParam === 'filhos' || abaParam === 'progresso') {
      setAba(abaParam);
    }
  }, [params.aba]);

  useEffect(() => {
    const id = Number(Array.isArray(params.detalhes) ? params.detalhes[0] : params.detalhes);
    if (!id || atividades.length === 0) return;
    const atividade = atividades.find((a) => Number(a.id) === id || Number(a.supabase_id) === id);
    if (!atividade) return;
    setDetalheAtiv(atividade);
    setModalDetalhes(true);
  }, [params.detalhes, atividades]);

  useEffect(() => {
    const id = Number(Array.isArray(params.progresso) ? params.progresso[0] : params.progresso);
    if (!id || atividades.length === 0 || modalProg) return;
    const atividade = atividades.find((a) => Number(a.id) === id || Number(a.supabase_id) === id);
    if (!atividade) return;
    abrirProgresso(atividade);
  }, [params.progresso, atividades, modalProg]);

  useEffect(() => {
    if (!modalResp || !respAtiv || !respMembroId || enviandoResp || carregandoRascunhoRespRef.current) return;
    const atividadeId = respAtiv.supabase_id ?? respAtiv.id;
    const membroId = numeroOuNull(respMembroId);
    if (!atividadeId || !membroId) return;

    const texto = respTexto;
    const anexo = respAnexo;
    const timer = setTimeout(async () => {
      try {
        const key = chaveRascunhoResposta(atividadeId, membroId);
        const temConteudo = texto.trim().length > 0 || !!anexo;
        if (!temConteudo) {
          await AsyncStorage.removeItem(key);
          setRascunhoRespSalvoEm(null);
          return;
        }
        const payload: RascunhoResposta = {
          texto,
          anexo,
          updated_at: new Date().toISOString(),
        };
        await AsyncStorage.setItem(key, JSON.stringify(payload));
        setRascunhoRespSalvoEm(payload.updated_at);
      } catch (e) {
        console.warn('Não foi possível salvar rascunho da resposta', e);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [
    modalResp,
    respAtiv?.id,
    respAtiv?.supabase_id,
    respMembroId,
    respTexto,
    respAnexo?.chave,
    respAnexo?.nome,
    respAnexo?.uri,
    respAnexo?.url,
    respAnexo?.storagePath,
    respAnexo?.enviando,
    respAnexo?.erro,
    enviandoResp,
  ]);

  async function sincronizar() {
    try {
      const db = await getDB();
      const clubeId = getClubeAtivoId();
      const { data: ats } = await supabase.from('atividades').select('*').eq('clube_id', clubeId);

      if (ats?.length) {
        for (const a of ats) {
        await db.runAsync(
          `INSERT OR REPLACE INTO atividades
             (id,supabase_id,titulo,descricao,data,destino,unidade_id,unidade_nome,dbv_id,dbv_nome,criado_por,avaliador_id,avaliador_nome,item_formativo_tipo,item_formativo_nome,gera_investidura,plano_formativo_id,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [a.id, a.id, a.titulo, a.descricao, a.data, a.destino, a.unidade_id, a.unidade_nome,
             a.dbv_id, a.dbv_nome, a.criado_por, a.avaliador_id ?? null, a.avaliador_nome ?? null,
             a.item_formativo_tipo ?? null, a.item_formativo_nome ?? null, a.gera_investidura ? 1 : 0,
             a.plano_formativo_id ?? null, a.created_at]
          );
        }
      }

      const { data: alvos } = await supabase.from('atividades_alvos').select('*').eq('clube_id', clubeId);
      if (alvos?.length) {
        for (const x of alvos) {
          await db.runAsync(
            `INSERT OR REPLACE INTO atividades_alvos
             (supabase_id,atividade_id,tipo,unidade_id,membro_id,created_at)
             VALUES (?,?,?,?,?,?)`,
            [x.id, x.atividade_id, x.tipo, x.unidade_id ?? null, x.membro_id ?? null, x.created_at]
          );
        }
      }

      const { data: anexos } = await supabase.from('atividades_anexos').select('*').eq('clube_id', clubeId);
      if (anexos?.length) {
        for (const x of anexos) {
          await db.runAsync(
            `INSERT OR REPLACE INTO atividades_anexos (supabase_id,atividade_id,nome,url,tipo,created_at)
             VALUES (?,?,?,?,?,?)`,
            [x.id, x.atividade_id, x.nome, x.url, x.tipo, x.created_at]
          );
        }
      }

      const { data: resps } = await supabase.from('atividades_respostas').select('*').eq('clube_id', clubeId);
      if (resps?.length) {
        for (const r of resps) {
          await db.runAsync(
            `INSERT OR REPLACE INTO atividades_respostas
             (supabase_id,atividade_id,dbv_id,dbv_nome,texto,anexo_url,anexo_nome,status,nota,comentario_avaliador,avaliado_por,avaliado_em,entregue_em,created_at,updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [r.id, r.atividade_id, r.dbv_id, r.dbv_nome, r.texto, r.anexo_url, r.anexo_nome,
             r.status ?? 'entregue', r.nota ?? null, r.comentario_avaliador ?? null,
             r.avaliado_por ?? null, r.avaliado_em ?? null, r.entregue_em ?? r.created_at ?? null,
             r.created_at, r.updated_at]
          );
        }
      }

      const { data: mensagens } = await supabase.from('atividades_mensagens').select('*').eq('clube_id', clubeId);
      if (mensagens?.length) {
        for (const m of mensagens) {
          await db.runAsync(
            `INSERT OR REPLACE INTO atividades_mensagens
             (supabase_id,atividade_id,dbv_id,autor_tipo,autor_id,autor_nome,tipo,texto,anexo_url,anexo_nome,status,nota,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [m.id, m.atividade_id, m.dbv_id, m.autor_tipo, m.autor_id ?? null, m.autor_nome ?? null,
             m.tipo, m.texto ?? null, m.anexo_url ?? null, m.anexo_nome ?? null, m.status ?? null, m.nota ?? null, m.created_at]
          );
        }
      }
    } catch {
      // offline: mantém SQLite
    }
  }

  function atividadeIncluiMembro(a: Atividade, alvos: AlvoAtividade[], membroId: number | null, unidadeIds: number[]) {
    if (!membroId && unidadeIds.length === 0) return false;
    const membro = numeroOuNull(membroId);
    const unidadesDoMembro = new Set(numerosUnicos(unidadeIds));
    if (alvos.length === 0) {
      return (
        a.destino === 'todos'
        || (a.destino === 'unidade' && unidadesDoMembro.has(numeroOuNull(a.unidade_id) ?? -1))
        || (a.destino === 'desbravador' && membro != null && numeroOuNull(a.dbv_id) === membro)
      );
    }
    return alvos.some(al =>
      al.tipo === 'todos'
      || (al.tipo === 'unidade' && unidadesDoMembro.has(numeroOuNull(al.unidade_id) ?? -1))
      || (al.tipo === 'membro' && membro != null && numeroOuNull(al.membro_id) === membro)
    );
  }

  function atividadeParaUsuario(a: Atividade, alvos: AlvoAtividade[]) {
    if (isAdmin) return true;

    const unidadeDireta = numerosUnicos([unidadeAtualId as any]);
    if (atividadeIncluiMembro(a, alvos, numeroOuNull(membroAtualId), unidadeDireta)) return true;

    if (filhosIds.length > 0) {
      return filhosIds.some((filhoId) => {
        const filho = filhosDados.find((f) => Number(f.id) === Number(filhoId));
        const unidadesDoFilho = numerosUnicos([filho?.unidade_id, ...filhosCtxs.filter((ctx) => Number(ctx.membro_id) === Number(filhoId)).map((ctx) => ctx.unidade_id)]);
        return atividadeIncluiMembro(a, alvos, filhoId, unidadesDoFilho);
      });
    }

    return false;
  }

  async function carregarRemoto() {
    const clubeId = getClubeAtivoId();
    const [atividadesRes, alvosRes, anexosRes, respostasRes, mensagensRes, planosRes] = await Promise.all([
      supabase.from('atividades').select('*').eq('clube_id', clubeId).order('data', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('atividades_alvos').select('*').eq('clube_id', clubeId),
      supabase.from('atividades_anexos').select('*').eq('clube_id', clubeId),
      supabase.from('atividades_respostas').select('*').eq('clube_id', clubeId),
      supabase.from('atividades_mensagens').select('*').eq('clube_id', clubeId).order('created_at', { ascending: true }),
      supabase.from('planos_formativos').select('id,tipo,item_nome,titulo,avaliacoes_necessarias,ativo').eq('clube_id', clubeId).eq('ativo', true).order('created_at', { ascending: false }),
    ]);

    if (atividadesRes.error) throw atividadesRes.error;
    if (alvosRes.error) throw alvosRes.error;
    if (anexosRes.error) throw anexosRes.error;
    if (respostasRes.error) throw respostasRes.error;
    if (planosRes.error && planosRes.error.code !== '42P01') throw planosRes.error;
    if (mensagensRes.error && mensagensRes.error.code !== '42P01') {
      console.warn('Falha ao carregar histórico de atividades', mensagensRes.error);
    }

    const rows = ((atividadesRes.data ?? []) as any[]).map((a) => ({
      id: a.id,
      supabase_id: a.id,
      titulo: a.titulo,
      descricao: a.descricao,
      data: a.data,
      destino: a.destino,
      unidade_id: a.unidade_id,
      unidade_nome: a.unidade_nome,
      dbv_id: a.dbv_id,
      dbv_nome: a.dbv_nome,
      criado_por: a.criado_por,
      avaliador_id: a.avaliador_id ?? null,
      avaliador_nome: a.avaliador_nome ?? null,
      item_formativo_tipo: a.item_formativo_tipo ?? null,
      item_formativo_nome: a.item_formativo_nome ?? null,
      gera_investidura: a.gera_investidura ? 1 : 0,
      plano_formativo_id: a.plano_formativo_id ?? null,
      created_at: a.created_at,
    })) as Atividade[];

    const alvos = ((alvosRes.data ?? []) as any[]).map((x) => ({
      id: x.id,
      supabase_id: x.id,
      atividade_id: x.atividade_id,
      tipo: x.tipo,
      unidade_id: x.unidade_id ?? null,
      membro_id: x.membro_id ?? null,
    })) as AlvoAtividade[];

    const anexos = ((anexosRes.data ?? []) as any[]).map((x) => ({
      id: x.id,
      supabase_id: x.id,
      atividade_id: x.atividade_id,
      nome: x.nome,
      url: x.url,
      tipo: x.tipo ?? 'outro',
    })) as Anexo[];

    const respostas = ((respostasRes.data ?? []) as any[]).map((r) => ({
      id: r.id,
      supabase_id: r.id,
      atividade_id: r.atividade_id,
      dbv_id: r.dbv_id,
      dbv_nome: r.dbv_nome,
      texto: r.texto,
      anexo_url: r.anexo_url,
      anexo_nome: r.anexo_nome,
      status: r.status ?? 'entregue',
      nota: r.nota ?? null,
      comentario_avaliador: r.comentario_avaliador ?? null,
      avaliado_por: r.avaliado_por ?? null,
      avaliado_em: r.avaliado_em ?? null,
      entregue_em: r.entregue_em ?? r.created_at ?? null,
      created_at: r.created_at,
    })) as Resposta[];

    const alvosPorAtividade: Record<number, AlvoAtividade[]> = {};
    for (const x of alvos) {
      if (!alvosPorAtividade[x.atividade_id]) alvosPorAtividade[x.atividade_id] = [];
      alvosPorAtividade[x.atividade_id].push(x);
    }

    const anexosPorAtividade: Record<number, Anexo[]> = {};
    for (const x of anexos) {
      if (!anexosPorAtividade[x.atividade_id]) anexosPorAtividade[x.atividade_id] = [];
      anexosPorAtividade[x.atividade_id].push(x);
    }

    const respostasPorAtividade: Record<number, Resposta[]> = {};
    for (const r of respostas) {
      if (!respostasPorAtividade[r.atividade_id]) respostasPorAtividade[r.atividade_id] = [];
      respostasPorAtividade[r.atividade_id].push(r);
    }

    const mensagens = ((mensagensRes.data ?? []) as any[]).map((m) => ({
      id: m.id,
      supabase_id: m.id,
      atividade_id: m.atividade_id,
      dbv_id: m.dbv_id,
      autor_tipo: m.autor_tipo ?? 'sistema',
      autor_id: m.autor_id ?? null,
      autor_nome: m.autor_nome ?? null,
      tipo: m.tipo ?? 'sistema',
      texto: m.texto ?? null,
      anexo_url: m.anexo_url ?? null,
      anexo_nome: m.anexo_nome ?? null,
      status: m.status ?? null,
      nota: m.nota ?? null,
      created_at: m.created_at,
    })) as AtividadeMensagem[];

    const mensagensPorConversa: Record<string, AtividadeMensagem[]> = {};
    for (const m of mensagens) {
      const key = conversaKey(m.atividade_id, m.dbv_id);
      if (!mensagensPorConversa[key]) mensagensPorConversa[key] = [];
      mensagensPorConversa[key].push(m);
    }

    setAlvosMap(alvosPorAtividade);
    setAnexosMap(anexosPorAtividade);
    setRespostasMap(respostasPorAtividade);
    setMensagensMap(mensagensPorConversa);
    setPlanosFormativos((planosRes.data ?? []) as PlanoFormativo[]);
    setAtividades(rows.filter(a => atividadeParaUsuario(a, alvosPorAtividade[a.id] ?? [])));
  }

  async function carregar() {
    // Só exibe o spinner na primeira carga (sem dados ainda).
    // Recargas subsequentes (useFocusEffect após fechar modal, troca de aba, etc.)
    // atualizam em background sem apagar o conteúdo — evita tela branca.
    if (!jaCarregouRef.current) setLoading(true);
    try {
      if (Platform.OS === 'web') {
        try {
          await carregarRemoto();
          return;
        } catch (e) {
          console.warn('Falha ao carregar atividades do Supabase; usando cache local.', e);
        }
      }

      const db = await getDB();
      const rows = await db.getAllAsync<Atividade>('SELECT * FROM atividades ORDER BY COALESCE(data, created_at) DESC, created_at DESC');
      const alvos = await db.getAllAsync<AlvoAtividade>('SELECT * FROM atividades_alvos');
      const anexos = await db.getAllAsync<Anexo>('SELECT * FROM atividades_anexos');
      const respostas = await db.getAllAsync<Resposta>('SELECT * FROM atividades_respostas');
      const mensagens = await db.getAllAsync<AtividadeMensagem>('SELECT * FROM atividades_mensagens ORDER BY created_at ASC');
      const planos = await db.getAllAsync<PlanoFormativo>('SELECT * FROM planos_formativos WHERE ativo = 1 ORDER BY created_at DESC');

      const alvosPorAtividade: Record<number, AlvoAtividade[]> = {};
      for (const x of alvos) {
        if (!alvosPorAtividade[x.atividade_id]) alvosPorAtividade[x.atividade_id] = [];
        alvosPorAtividade[x.atividade_id].push(x);
      }

      const anexosPorAtividade: Record<number, Anexo[]> = {};
      for (const x of anexos) {
        if (!anexosPorAtividade[x.atividade_id]) anexosPorAtividade[x.atividade_id] = [];
        anexosPorAtividade[x.atividade_id].push(x);
      }

      const respostasPorAtividade: Record<number, Resposta[]> = {};
      for (const r of respostas) {
        if (!respostasPorAtividade[r.atividade_id]) respostasPorAtividade[r.atividade_id] = [];
        respostasPorAtividade[r.atividade_id].push(r);
      }

      const mensagensPorConversa: Record<string, AtividadeMensagem[]> = {};
      for (const m of mensagens) {
        const key = conversaKey(m.atividade_id, m.dbv_id);
        if (!mensagensPorConversa[key]) mensagensPorConversa[key] = [];
        mensagensPorConversa[key].push(m);
      }

      setAlvosMap(alvosPorAtividade);
      setAnexosMap(anexosPorAtividade);
      setRespostasMap(respostasPorAtividade);
      setMensagensMap(mensagensPorConversa);
      setPlanosFormativos(planos);
      setAtividades(rows.filter(a => atividadeParaUsuario(a, alvosPorAtividade[a.id] ?? [])));
    } finally {
      setLoading(false);
      jaCarregouRef.current = true;
    }
  }

  async function carregarUnidadesDbvs() {
    const db = await getDB();
    let dbvsLocais = await db.getAllAsync<DBVLocal>(
      'SELECT id,nome,unidade_id,unidade_nome FROM desbravadores ORDER BY unidade_nome, nome'
    );
    let unidadesLocais = await db.getAllAsync<UnidadeLocal>('SELECT id,nome,cor FROM unidades ORDER BY nome');

    if (unidadesLocais.length === 0) {
      const porId = new Map<number, UnidadeLocal>();
      for (const d of dbvsLocais) {
        if (d.unidade_id && d.unidade_nome) {
          porId.set(d.unidade_id, { id: d.unidade_id, nome: d.unidade_nome, cor: '#1a3a5c' });
        }
      }
      unidadesLocais = Array.from(porId.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    }

    if (Platform.OS === 'web' && unidadesLocais.length === 0) {
      const { data } = await supabase
        .from('unidades')
        .select('id,nome,cor')
        .eq('clube_id', getClubeAtivoId())
        .order('nome');
      unidadesLocais = ((data ?? []) as any[]).map((u) => ({ id: u.id, nome: u.nome, cor: u.cor ?? '#1a3a5c' }));
    }

    if (Platform.OS === 'web') {
      const { data } = await supabase
        .from('desbravadores')
        .select('id,nome,unidade_id,unidade_nome')
        .eq('clube_id', getClubeAtivoId())
        .order('unidade_nome')
        .order('nome');
      if (data?.length) {
        const mapa = new Map<number, DBVLocal>();
        for (const d of dbvsLocais) mapa.set(d.id, d);
        for (const d of data as any[]) {
          mapa.set(d.id, {
            id: d.id,
            nome: d.nome,
            unidade_id: d.unidade_id ?? null,
            unidade_nome: d.unidade_nome ?? null,
          });
        }
        dbvsLocais = Array.from(mapa.values()).sort((a, b) =>
          `${a.unidade_nome ?? ''} ${a.nome}`.localeCompare(`${b.unidade_nome ?? ''} ${b.nome}`)
        );
      }
    }

    if (dbvsLocais.some((membro) => normalizarBusca(membro.unidade_nome) === 'diretoria')
      && !unidadesLocais.some((unidade) => normalizarBusca(unidade.nome) === 'diretoria')) {
      unidadesLocais = [{ id: DIRETORIA_GRUPO_ID, nome: 'Diretoria', cor: '#7b1fa2' }, ...unidadesLocais];
    }

    setUnidades(unidadesLocais);
    setDbvs(dbvsLocais);
    try {
      const [classes, especialidades] = await Promise.all([
        carregarClassesModelo(),
        carregarEspecialidadesModelo({ limite: 800 }),
      ]);
      setClassesModelo(classes.length ? classes : classesFallback());
      setEspecialidadesModelo(especialidades);
    } catch {
      setClassesModelo(classesFallback());
      setEspecialidadesModelo([]);
    }

    const clubeId = getClubeAtivoId();
    const perfisDiretoria = [
      'admin_ti', 'admin_clube', 'usuario_diretoria', 'usuario_secretaria',
      'usuario_conselheiro', 'usuario_capelao', 'usuario_pastor',
      'usuario_tesouraria', 'usuario_regional', 'usuario_distrital',
      'admin_total', 'admin_geral', 'admin_diretoria',
    ];
    const { data: vinculos } = await supabase
      .from('usuario_clubes')
      .select('usuario_id, perfil, membro_id')
      .eq('clube_id', clubeId)
      .eq('ativo', true)
      .in('perfil', perfisDiretoria);

    const ids = Array.from(new Set((vinculos ?? []).map((v: any) => v.usuario_id).filter(Boolean)));
    const membroIds = Array.from(new Set((vinculos ?? []).map((v: any) => v.membro_id).filter(Boolean)));
    const usuariosMap = new Map<string, { nome: string; email: string }>();
    const membrosMap = new Map<number, string>();

    if (ids.length > 0) {
      const { data: usuarios } = await supabase.from('usuarios').select('id,nome,email').in('id', ids);
      for (const u of (usuarios ?? []) as any[]) usuariosMap.set(u.id, { nome: u.nome ?? u.email, email: u.email ?? '' });
    }
    if (membroIds.length > 0) {
      const { data: membros } = await supabase.from('desbravadores').select('id,nome').in('id', membroIds);
      for (const m of (membros ?? []) as any[]) membrosMap.set(m.id, m.nome);
    }

    const lista = (vinculos ?? []).map((v: any) => {
      const u = usuariosMap.get(v.usuario_id);
      return {
        id: v.usuario_id,
        nome: membrosMap.get(v.membro_id) ?? u?.nome ?? u?.email ?? 'Diretoria',
        email: u?.email ?? '',
        perfil: v.perfil,
        membro_id: v.membro_id ?? null,
      };
    });
    setDiretoria(lista);
    return dbvsLocais;
  }

  function atividadeVaziaPlano(membros: DBVLocal[] = dbvs): AtividadePlanoForm {
    return {
      atividade: null,
      titulo: '',
      descricao: '',
      data: '',
      destino: 'todos',
      buscaUnidade: '',
      buscaDbv: '',
      unidades: [],
      dbvs: membros,
      avaliador: null,
      anexosPend: [],
    };
  }

  function formDaAtividadePlano(a: Atividade, membros: DBVLocal[] = dbvs): AtividadePlanoForm {
    const alvos = alvosMap[a.id] ?? [];
    const membrosSelecionados = alvos
      .filter(x => x.tipo === 'membro' && x.membro_id)
      .map(x => membros.find(d => d.id === x.membro_id) ?? { id: x.membro_id!, nome: a.dbv_nome ?? `Membro ${x.membro_id}`, unidade_id: null, unidade_nome: '' });
    return {
      atividade: a,
      titulo: a.titulo,
      descricao: a.descricao ?? '',
      data: a.data ?? '',
      destino: a.destino === 'todos' || a.destino === 'unidade' ? a.destino : alvos.some(x => x.tipo === 'membro') ? 'desbravador' : a.destino,
      buscaUnidade: '',
      buscaDbv: '',
      unidades: [
        ...alvos
          .filter(x => x.tipo === 'unidade' && x.unidade_id)
          .map(x => unidades.find(u => u.id === x.unidade_id) ?? { id: x.unidade_id!, nome: a.unidade_nome ?? `Unidade ${x.unidade_id}`, cor: '#1a3a5c' }),
        ...(a.destino === 'unidade' && membrosSelecionados.some((membro) => normalizarBusca(membro.unidade_nome) === 'diretoria')
          ? [{ id: DIRETORIA_GRUPO_ID, nome: 'Diretoria', cor: '#7b1fa2' }]
          : []),
      ],
      dbvs: a.destino === 'todos' && membrosSelecionados.length === 0 ? membros : membrosSelecionados,
      avaliador: a.avaliador_id ? { id: a.avaliador_id, nome: a.avaliador_nome ?? 'Avaliador', email: '', perfil: '', membro_id: null } : null,
      anexosPend: [],
    };
  }

  function prepararAtividadesPlano(planoId: number | null, quantidade: number, primeira?: Partial<AtividadePlanoForm>, membros: DBVLocal[] = dbvs) {
    const existentes = planoId
      ? atividades.filter((a) => a.plano_formativo_id === planoId)
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
          .map((atividade) => formDaAtividadePlano(atividade, membros))
      : [];
    const base = existentes.length > 0 ? existentes : [{ ...atividadeVaziaPlano(membros), ...primeira }];
    setFAtividadesPlano(
      Array.from({ length: Math.max(1, quantidade) }, (_, i) => base[i] ?? atividadeVaziaPlano(membros))
    );
  }

  function atualizarQuantidadePlano(valor: string) {
    setFAvaliacoesNecessarias(valor);
    const quantidade = Math.max(1, Number(valor) || 1);
    setFAtividadesPlano((prev) => {
      const primeira = prev[0] ?? {
        ...atividadeVaziaPlano(),
        titulo: fTitulo,
        descricao: fDesc,
        data: fData,
        destino: fDestino,
        unidades: fUnidades,
        dbvs: fDbvs,
        avaliador: fAvaliador,
        anexosPend,
      };
      return Array.from({ length: quantidade }, (_, i) => prev[i] ?? (i === 0 ? primeira : atividadeVaziaPlano()));
    });
  }

  function adicionarSlotAoBloco() {
    setFAtividadesPlano((prev) => [...prev, atividadeVaziaPlano()]);
    setFAvaliacoesNecessarias((prev) => String((Math.max(1, Number(prev) || 1)) + 1));
  }

  function removerSlotDoBloco(indice: number) {
    const slot = fAtividadesPlano[indice];
    const executar = () => {
      if (slot?.atividade?.supabase_id) {
        setAtividadesParaRemoverDoBloco((prev) => [...prev, slot.atividade!.supabase_id!]);
      }
      setFAtividadesPlano((prev) => prev.filter((_, i) => i !== indice));
      setFAvaliacoesNecessarias((prev) => String(Math.max(1, (Number(prev) || 1) - 1)));
    };
    if (slot?.atividade) {
      Alert.alert(
        'Remover atividade',
        `"${slot.atividade.titulo}" será excluída do bloco. Esta ação não pode ser desfeita. Continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Remover', style: 'destructive', onPress: executar },
        ]
      );
    } else {
      executar();
    }
  }

  function atualizarSlotPlano(indice: number, patch: Partial<AtividadePlanoForm>) {
    setFAtividadesPlano((prev) => prev.map((slot, i) => i === indice ? { ...slot, ...patch } : slot));
  }

  function atualizarSlotComRepeticao(
    indice: number,
    patch: Partial<AtividadePlanoForm>,
    campo?: 'prazo' | 'destino' | 'avaliador'
  ) {
    setFAtividadesPlano((prev) => prev.map((slot, i) => {
      if (i === indice) return { ...slot, ...patch };
      if (indice !== 0) return slot;
      if (campo === 'prazo' && blocoPaiPrazo === indice) return { ...slot, data: patch.data ?? slot.data };
      if (campo === 'destino' && blocoPaiDestino === indice) {
        return {
          ...slot,
          destino: patch.destino ?? slot.destino,
          unidades: patch.unidades ?? slot.unidades,
          dbvs: patch.dbvs ?? slot.dbvs,
          buscaUnidade: '',
          buscaDbv: '',
        };
      }
      if (campo === 'avaliador' && blocoPaiAvaliador === indice) return { ...slot, avaliador: patch.avaliador ?? null };
      return slot;
    }));
  }

  function configurarRepeticaoPrazo(indice: number) {
    if (blocoPaiPrazo === indice) {
      setBlocoPaiPrazo(null);
      return;
    }
    setBlocoPaiPrazo(indice);
    setFAtividadesPlano((prev) => prev.map((slot, i) => i === indice ? slot : { ...slot, data: prev[indice]?.data ?? '' }));
  }

  function configurarRepeticaoDestino(indice: number) {
    if (blocoPaiDestino === indice) {
      setBlocoPaiDestino(null);
      return;
    }
    setBlocoPaiDestino(indice);
    setFAtividadesPlano((prev) => prev.map((slot, i) => i === indice ? slot : {
        ...slot,
        destino: prev[indice]?.destino ?? 'todos',
        unidades: prev[indice]?.unidades ?? [],
        dbvs: prev[indice]?.dbvs ?? [],
        buscaUnidade: '',
        buscaDbv: '',
      }));
  }

  function configurarRepeticaoAvaliador(indice: number) {
    if (blocoPaiAvaliador === indice) {
      setBlocoPaiAvaliador(null);
      return;
    }
    setBlocoPaiAvaliador(indice);
    setFAtividadesPlano((prev) => prev.map((slot, i) => i === indice ? slot : { ...slot, avaliador: prev[indice]?.avaliador ?? null }));
  }

  function unidadesDoSlot(slot: AtividadePlanoForm) {
    const q = normalizarBusca(slot.buscaUnidade);
    return q ? unidades.filter((unidade) => normalizarBusca(unidade.nome).includes(q)) : unidades;
  }

  function dbvsDoSlot(slot: AtividadePlanoForm) {
    const q = normalizarBusca(slot.buscaDbv);
    return q
      ? dbvs.filter((dbv) => normalizarBusca(`${dbv.nome} ${dbv.unidade_nome ?? ''}`).includes(q))
      : dbvs;
  }

  function dbvsExcluidosDoSlot(slot: AtividadePlanoForm) {
    return dbvs.filter((dbv) => !slot.dbvs.some((selecionado) => selecionado.id === dbv.id));
  }

  async function abrirCriar() {
    const membros = await carregarUnidadesDbvs();
    setEditando(null);
    setFTitulo('');
    setFDesc('');
    setFData('');
    setFDestino('todos');
    setFUnidades([]);
    setFDbvs(membros);
    setFAvaliador(null);
    setFItemTipo(null);
    setFItemNome('');
    setBuscaItem('');
    setBuscaDbv('');
    setBuscaUnidade('');
    setFPlanoId(null);
    setFNovoPlano(true);
    setFPlanoTitulo('');
    setFAvaliacoesNecessarias('');
    setFAtividadesPlano([]);
    setEtapaCadastro(1);
    setTituloPlanoEmErro(false);
    setBlocoPaiPrazo(null);
    setBlocoPaiDestino(null);
    setBlocoPaiAvaliador(null);
    setAnexosPend([]);
    setTituloPlanoEmErro(false);
    setAtividadesParaRemoverDoBloco([]);
    setModalCRUD(true);
  }

  async function abrirEditar(a: Atividade) {
    const membros = await carregarUnidadesDbvs();
    const alvos = alvosMap[a.id] ?? [];
    const unidadesSelecionadas = alvos
      .filter(x => x.tipo === 'unidade' && x.unidade_id)
      .map(x => unidades.find(u => u.id === x.unidade_id) ?? { id: x.unidade_id!, nome: a.unidade_nome ?? `Unidade ${x.unidade_id}`, cor: '#1a3a5c' });
    const dbvsSelecionados = alvos
      .filter(x => x.tipo === 'membro' && x.membro_id)
      .map(x => membros.find(d => d.id === x.membro_id) ?? { id: x.membro_id!, nome: a.dbv_nome ?? `Membro ${x.membro_id}`, unidade_id: null, unidade_nome: '' });

    setEditando(a);
    setFTitulo(a.titulo);
    setFDesc(a.descricao ?? '');
    setFData(a.data ?? '');
    setFDestino(a.destino === 'todos' || a.destino === 'unidade' ? a.destino : alvos.some(x => x.tipo === 'membro') ? 'desbravador' : a.destino);
    setFUnidades([
      ...(unidadesSelecionadas.length ? unidadesSelecionadas : a.unidade_id ? [{ id: a.unidade_id, nome: a.unidade_nome ?? '', cor: '#1a3a5c' }] : []),
      ...(a.destino === 'unidade' && dbvsSelecionados.some((membro) => normalizarBusca(membro.unidade_nome) === 'diretoria')
        ? [{ id: DIRETORIA_GRUPO_ID, nome: 'Diretoria', cor: '#7b1fa2' }]
        : []),
    ]);
    setFDbvs(a.destino === 'todos' && dbvsSelecionados.length === 0
      ? membros
      : dbvsSelecionados.length ? dbvsSelecionados : a.dbv_id ? [{ id: a.dbv_id, nome: a.dbv_nome ?? '', unidade_id: null, unidade_nome: '' }] : []);
    setFAvaliador(a.avaliador_id ? { id: a.avaliador_id, nome: a.avaliador_nome ?? 'Avaliador', email: '', perfil: '', membro_id: null } : null);
    setFItemTipo(a.item_formativo_tipo ?? null);
    setFItemNome(a.item_formativo_nome ?? '');
    setBuscaItem(a.item_formativo_nome ?? '');
    setBuscaDbv('');
    setBuscaUnidade('');
    setFPlanoId(a.plano_formativo_id ?? null);
    setFNovoPlano(false);
    const plano = a.plano_formativo_id ? planosFormativos.find((p) => p.id === a.plano_formativo_id) : null;
    setFPlanoTitulo(plano?.titulo ?? '');
    setFAvaliacoesNecessarias(String(plano?.avaliacoes_necessarias ?? 1));
    if (plano && plano.avaliacoes_necessarias > 1) {
      prepararAtividadesPlano(plano.id, plano.avaliacoes_necessarias, undefined, membros);
    } else {
      setFAtividadesPlano([]);
    }
    setEtapaCadastro(2);
    setBlocoPaiPrazo(null);
    setBlocoPaiDestino(null);
    setBlocoPaiAvaliador(null);
    setAnexosPend([]);
    setAtividadesParaRemoverDoBloco([]);
    setModalCRUD(true);
  }

  function toggleUnidade(u: UnidadeLocal) {
    setFUnidades(prev => prev.some(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]);
  }

  function toggleDbv(d: DBVLocal) {
    setFDbvs(prev => prev.some(x => x.id === d.id) ? prev.filter(x => x.id !== d.id) : [...prev, d]);
  }

  function criarAnexoPendente(uri: string, nome: string, tipo: Anexo['tipo'], mime?: string | null): AnexoPendente {
    return {
      chave: novaChaveAnexo(),
      uri,
      nome,
      tipo,
      mime,
      enviando: true,
      erro: null,
    };
  }

  async function removerDoStorage(path?: string | null) {
    if (!path) return;
    const { error } = await supabase.storage.from('atividades').remove([path]);
    if (error) throw error;
  }

  async function enviarAnexoRascunho(
    anexo: AnexoPendente,
    atualizar: (anexoAtualizado: AnexoPendente) => void
  ) {
    const mime = anexo.mime || (anexo.tipo === 'image' ? 'image/jpeg' : anexo.tipo === 'pdf' ? 'application/pdf' : 'application/octet-stream');
    const path = `rascunhos/${getClubeAtivoId()}/${usuario?.id ?? 'usuario'}/${anexo.chave}_${nomeArquivoSeguro(anexo.nome)}`;
    try {
      const url = await uploadParaStorage(path, anexo.uri, mime);
      if (uploadsCanceladosRef.current.has(anexo.chave)) {
        await removerDoStorage(path);
        uploadsCanceladosRef.current.delete(anexo.chave);
        return;
      }
      atualizar({ ...anexo, url, storagePath: path, enviando: false, erro: null });
    } catch (e: any) {
      if (!uploadsCanceladosRef.current.has(anexo.chave)) {
        atualizar({ ...anexo, enviando: false, erro: e?.message ?? 'Falha no envio.' });
      }
    }
  }

  function adicionarAnexosGerais(novos: AnexoPendente[]) {
    setAnexosPend((prev) => [...prev, ...novos]);
    novos.forEach((anexo) => {
      void enviarAnexoRascunho(anexo, (atualizado) => {
        setAnexosPend((prev) => prev.map((item) => item.chave === atualizado.chave ? atualizado : item));
      });
    });
  }

  function adicionarAnexosAoSlot(indice: number, novos: AnexoPendente[]) {
    setFAtividadesPlano((prev) => prev.map((slot, i) => i === indice
      ? { ...slot, anexosPend: [...slot.anexosPend, ...novos] }
      : slot));
    novos.forEach((anexo) => {
      void enviarAnexoRascunho(anexo, (atualizado) => {
        setFAtividadesPlano((prev) => prev.map((slot, i) => i === indice
          ? { ...slot, anexosPend: slot.anexosPend.map((item) => item.chave === atualizado.chave ? atualizado : item) }
          : slot));
      });
    });
  }

  async function removerAnexoPendente(anexo: AnexoPendente, removerDaTela: () => void) {
    uploadsCanceladosRef.current.add(anexo.chave);
    removerDaTela();
    try {
      await removerDoStorage(anexo.storagePath);
      uploadsCanceladosRef.current.delete(anexo.chave);
    } catch (e: any) {
      Alert.alert('Aviso', e?.message ?? 'O anexo saiu do formulário, mas não foi possível removê-lo do armazenamento.');
    }
  }

  async function descartarAnexosNaoSalvos() {
    const pendentes = [...anexosPend, ...fAtividadesPlano.flatMap((slot) => slot.anexosPend)];
    pendentes.forEach((anexo) => uploadsCanceladosRef.current.add(anexo.chave));
    const paths = [...new Set(pendentes.map((anexo) => anexo.storagePath).filter((path): path is string => !!path))];
    if (paths.length > 0) {
      const { error } = await supabase.storage.from('atividades').remove(paths);
      if (error) console.error('Falha ao descartar anexos temporários', error);
    }
    setAnexosPend([]);
    setFAtividadesPlano((prev) => prev.map((slot) => ({ ...slot, anexosPend: [] })));
  }

  function fecharCadastroAtividade() {
    void descartarAnexosNaoSalvos();
    setModalCRUD(false);
  }

  async function excluirAnexoSalvo(atividadeId: number, anexo: Anexo) {
    const executar = async () => {
      try {
        const storagePath = caminhoStorageDaUrl(anexo.url);
        if (storagePath) await removerDoStorage(storagePath);
        if (anexo.supabase_id) {
          const { error } = await supabase.from('atividades_anexos')
            .delete()
            .eq('id', anexo.supabase_id)
            .eq('clube_id', getClubeAtivoId());
          if (error) throw error;
        }
        const db = await getDB();
        await db.runAsync('DELETE FROM atividades_anexos WHERE id=? OR supabase_id=?', [anexo.id, anexo.supabase_id ?? -1]);
        setAnexosMap((prev) => ({
          ...prev,
          [atividadeId]: (prev[atividadeId] ?? []).filter((item) => item.id !== anexo.id),
        }));
      } catch (e: any) {
        Alert.alert('Erro', e?.message ?? 'Não foi possível excluir o anexo.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir o anexo "${anexo.nome}"?`)) await executar();
      return;
    }
    Alert.alert('Excluir anexo', `Remover "${anexo.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void executar() },
    ]);
  }

  async function escolherAnexo() {
    if (anexosPend.length >= 5) {
      Alert.alert('Limite', 'Máximo de 5 anexos na atividade.');
      return;
    }
    if (Platform.OS === 'web') {
      escolherArquivoWeb({
        multiple: true,
        accept: 'image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        onFiles: (files) => {
        const vagas = Math.max(0, 5 - anexosPend.length);
        const validos = files.slice(0, vagas).filter((file) => {
          const tipo = tipoAnexo(file.name, file.type);
          return tipo === 'image' || tipo === 'pdf' || tipo === 'word';
        });
        if (validos.length === 0) {
          Alert.alert('Formato inválido', 'Anexe apenas imagens, PDF ou Word (.doc/.docx).');
          return;
        }
        adicionarAnexosGerais(validos.map((file) => criarAnexoPendente(
          URL.createObjectURL(file),
          file.name,
          tipoAnexo(file.name, file.type),
          file.type
        )));
        if (files.length > vagas) Alert.alert('Limite', 'Foram adicionados apenas os arquivos até o limite de 5 anexos.');
        },
      });
      return;
    }
    Alert.alert('Adicionar anexo', 'Escolha o tipo de arquivo', [
      {
        text: 'Imagem',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!r.canceled && r.assets[0]) {
            adicionarAnexosGerais([criarAnexoPendente(r.assets[0].uri, `imagem_${Date.now()}.jpg`, 'image', 'image/jpeg')]);
          }
        },
      },
      {
        text: 'PDF / Word',
        onPress: async () => {
          const r = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            copyToCacheDirectory: true,
          });
          if (!r.canceled && r.assets[0]) {
            const a = r.assets[0];
            adicionarAnexosGerais([criarAnexoPendente(a.uri, a.name, tipoAnexo(a.name, a.mimeType ?? ''), a.mimeType ?? null)]);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function escolherAnexoPlano(indice: number) {
    const slot = fAtividadesPlano[indice];
    if (!slot || slot.anexosPend.length >= 5) {
      Alert.alert('Limite', 'Máximo de 5 anexos por atividade.');
      return;
    }
    if (Platform.OS === 'web') {
      escolherArquivoWeb({
        multiple: true,
        accept: 'image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        onFiles: (files) => {
          const vagas = Math.max(0, 5 - slot.anexosPend.length);
          const validos = files.slice(0, vagas).filter((file) => {
            const tipo = tipoAnexo(file.name, file.type);
            return tipo === 'image' || tipo === 'pdf' || tipo === 'word';
          });
          if (validos.length === 0) {
            Alert.alert('Formato inválido', 'Anexe apenas imagens, PDF ou Word (.doc/.docx).');
            return;
          }
          adicionarAnexosAoSlot(indice, validos.map((file) => criarAnexoPendente(
            URL.createObjectURL(file),
            file.name,
            tipoAnexo(file.name, file.type),
            file.type
          )));
        },
      });
      return;
    }
    Alert.alert('Adicionar anexo', 'Escolha o tipo de arquivo', [
      {
        text: 'Imagem',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!r.canceled && r.assets[0]) {
            adicionarAnexosAoSlot(indice, [criarAnexoPendente(r.assets[0].uri, `imagem_${Date.now()}.jpg`, 'image', 'image/jpeg')]);
          }
        },
      },
      {
        text: 'PDF / Word',
        onPress: async () => {
          const r = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            copyToCacheDirectory: true,
          });
          if (!r.canceled && r.assets[0]) {
            const arq = r.assets[0];
            adicionarAnexosAoSlot(indice, [criarAnexoPendente(arq.uri, arq.name, tipoAnexo(arq.name, arq.mimeType ?? ''), arq.mimeType ?? null)]);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function alvosDeUnidades(selecionadas: UnidadeLocal[]) {
    const membrosDiretoria = selecionadas.some((unidade) => unidade.id === DIRETORIA_GRUPO_ID)
      ? dbvs
          .filter((membro) => normalizarBusca(membro.unidade_nome) === 'diretoria')
          .map((membro) => ({ tipo: 'membro' as AlvoTipo, unidade_id: null, membro_id: membro.id }))
      : [];
    return [
      ...selecionadas
        .filter((unidade) => unidade.id !== DIRETORIA_GRUPO_ID)
        .map((unidade) => ({ tipo: 'unidade' as AlvoTipo, unidade_id: unidade.id, membro_id: null })),
      ...membrosDiretoria,
    ];
  }

  function montarAlvos() {
    if (fDestino === 'todos') return fDbvs.map(d => ({ tipo: 'membro' as AlvoTipo, unidade_id: null, membro_id: d.id }));
    if (fDestino === 'unidade') return alvosDeUnidades(fUnidades);
    return fDbvs.map(d => ({ tipo: 'membro' as AlvoTipo, unidade_id: null, membro_id: d.id }));
  }

  function montarAlvosSlot(slot: AtividadePlanoForm) {
    if (slot.destino === 'todos') return slot.dbvs.map(d => ({ tipo: 'membro' as AlvoTipo, unidade_id: null, membro_id: d.id }));
    if (slot.destino === 'unidade') return alvosDeUnidades(slot.unidades);
    return slot.dbvs.map(d => ({ tipo: 'membro' as AlvoTipo, unidade_id: null, membro_id: d.id }));
  }

  async function salvarAlvos(localAtividadeId: number, supAtividadeId: number | null, alvos: ReturnType<typeof montarAlvos>) {
    const db = await getDB();
    await db.runAsync('DELETE FROM atividades_alvos WHERE atividade_id=?', [localAtividadeId]);
    if (supAtividadeId) {
      await supabase.from('atividades_alvos').delete().eq('atividade_id', supAtividadeId);
    }
    for (const alvo of alvos) {
      let supAlvoId: number | null = null;
      if (supAtividadeId) {
        const { data: ins } = await supabase
          .from('atividades_alvos')
          .insert({
            clube_id: getClubeAtivoId(),
            atividade_id: supAtividadeId,
            tipo: alvo.tipo,
            unidade_id: alvo.unidade_id,
            membro_id: alvo.membro_id,
          })
          .select()
          .single();
        supAlvoId = ins?.id ?? null;
      }
      await db.runAsync(
        'INSERT INTO atividades_alvos (supabase_id,atividade_id,tipo,unidade_id,membro_id) VALUES (?,?,?,?,?)',
        [supAlvoId, localAtividadeId, alvo.tipo, alvo.unidade_id, alvo.membro_id]
      );
    }
  }

  const planoSelecionado = fPlanoId ? planosFormativos.find((p) => p.id === fPlanoId) ?? null : null;
  const quantidadePlanoFormulario = Math.max(1, Number(fAvaliacoesNecessarias) || planoSelecionado?.avaliacoes_necessarias || 1);
  const criandoPlanoEmEtapas = !editando && etapaCadastro === 2;
  const modoCadastroBloco = Boolean(
    fItemTipo && fItemNome.trim() && (fNovoPlano || fPlanoId)
      && (quantidadePlanoFormulario > 1 || criandoPlanoEmEtapas || (editando && fAtividadesPlano.length > 0))
  );
  const podeAvancarCadastro = Boolean(
    fItemTipo && fItemNome.trim() && Number(fAvaliacoesNecessarias) >= 1
  );
  const indiceTituloObrigatorio = Math.max(0, fAtividadesPlano.findIndex((slot) => !!slot.titulo.trim()));

  function avancarCadastroPlano() {
    if (!podeAvancarCadastro) return;
    const quantidade = Math.max(1, Number(fAvaliacoesNecessarias));
    setFNovoPlano(true);
    setFPlanoId(null);
    setFPlanoTitulo(`${fItemNome.trim()} - ${new Date().getFullYear()}`);
    prepararAtividadesPlano(null, quantidade);
    setTituloPlanoEmErro(true);
    setEtapaCadastro(2);
  }

  function temTituloNoPlano() {
    return fAtividadesPlano.some((slot) => !!slot.titulo.trim());
  }

  function exigirTituloNoPlano() {
    if (temTituloNoPlano()) {
      setTituloPlanoEmErro(false);
      return true;
    }
    setTituloPlanoEmErro(true);
    setTimeout(() => tituloPlanoRefs.current[0]?.focus(), 0);
    return false;
  }

  async function salvarAtividadesDoBloco() {
    const preenchidas = fAtividadesPlano.filter((slot) => slot.titulo.trim());
    if (preenchidas.length === 0) {
      exigirTituloNoPlano();
      return;
    }
    setTituloPlanoEmErro(false);
    if (fAtividadesPlano.some((slot) => !slot.titulo.trim() && slot.anexosPend.length > 0)) {
      Alert.alert('Atenção', 'Há anexo em uma atividade sem título. Preencha o título ou remova o arquivo antes de salvar.');
      return;
    }
    const uploadsPlano = preenchidas.flatMap((slot) => slot.anexosPend);
    if (uploadsPlano.some((anexo) => anexo.enviando)) {
      Alert.alert('Aguarde', 'Um ou mais anexos ainda estão sendo enviados.');
      return;
    }
    if (uploadsPlano.some((anexo) => anexo.erro || !anexo.url)) {
      Alert.alert('Anexo não enviado', 'Remova o arquivo com falha e anexe novamente antes de salvar.');
      return;
    }
    for (const slot of preenchidas) {
      if (slot.destino === 'unidade' && slot.unidades.length === 0) {
        Alert.alert('Atenção', `Selecione a unidade da atividade "${slot.titulo}".`);
        return;
      }
      if (slot.destino === 'todos' && slot.dbvs.length === 0) {
        Alert.alert('Atenção', `Mantenha ao menos um participante na atividade "${slot.titulo}".`);
        return;
      }
      if (slot.destino === 'desbravador' && slot.dbvs.length === 0) {
        Alert.alert('Atenção', `Selecione ao menos um membro da atividade "${slot.titulo}".`);
        return;
      }
    }

    setSalvando(true);
    try {
      const db = await getDB();

      // Excluir atividades removidas do bloco antes de salvar
      if (atividadesParaRemoverDoBloco.length > 0) {
        const { error: errExcluir } = await supabase
          .from('atividades')
          .delete()
          .in('id', atividadesParaRemoverDoBloco)
          .eq('clube_id', getClubeAtivoId());
        if (errExcluir) throw errExcluir;
        for (const supId of atividadesParaRemoverDoBloco) {
          await db.runAsync('DELETE FROM atividades WHERE supabase_id = ?', [supId]);
        }
        setAtividadesParaRemoverDoBloco([]);
      }

      let planoId = fPlanoId;
      let planoSalvo: PlanoFormativo | null = planoSelecionado;
      const planoPayload = {
        clube_id: getClubeAtivoId(),
        tipo: fItemTipo as Exclude<ItemFormativoTipo, null>,
        item_nome: fItemNome.trim(),
        titulo: fPlanoTitulo.trim() || `${fItemNome.trim()} - ${new Date().getFullYear()}`,
        avaliacoes_necessarias: quantidadePlanoFormulario,
        criado_por: usuario?.id ?? null,
      };

      if (!planoId) {
        const { data, error } = await supabase.from('planos_formativos')
          .insert(planoPayload)
          .select('id,tipo,item_nome,titulo,avaliacoes_necessarias,ativo')
          .single();
        if (error) throw error;
        planoSalvo = data as PlanoFormativo;
        planoId = planoSalvo.id;
        setPlanosFormativos((prev) => [planoSalvo!, ...prev]);
      } else {
        const { error } = await supabase.from('planos_formativos')
          .update({ titulo: planoPayload.titulo, avaliacoes_necessarias: quantidadePlanoFormulario, updated_at: new Date().toISOString() })
          .eq('id', planoId)
          .eq('clube_id', getClubeAtivoId());
        if (error) throw error;
        setPlanosFormativos((prev) => prev.map((plano) => plano.id === planoId
          ? { ...plano, titulo: planoPayload.titulo, avaliacoes_necessarias: quantidadePlanoFormulario }
          : plano));
      }

      await db.runAsync(
        `INSERT OR REPLACE INTO planos_formativos
         (id, clube_id, tipo, item_nome, titulo, avaliacoes_necessarias, ativo, criado_por, created_at, updated_at)
         VALUES (?,?,?,?,?,?,1,?,datetime('now'),datetime('now'))`,
        [planoId, getClubeAtivoId(), planoPayload.tipo, planoPayload.item_nome, planoPayload.titulo, quantidadePlanoFormulario, usuario?.id ?? null]
      );

      for (const slot of preenchidas) {
        const alvos = montarAlvosSlot(slot);
        const primeiraUnidade = slot.destino === 'unidade'
          ? slot.unidades.find((unidade) => unidade.id !== DIRETORIA_GRUPO_ID) ?? null
          : null;
        const primeiroDbv = slot.destino === 'desbravador' ? slot.dbvs[0] : null;
        const payload = {
          clube_id: getClubeAtivoId(),
          titulo: slot.titulo.trim(),
          descricao: slot.descricao.trim() || null,
          data: slot.data.trim() || null,
          destino: slot.destino,
          unidade_id: primeiraUnidade?.id ?? null,
          unidade_nome: primeiraUnidade?.nome ?? null,
          dbv_id: primeiroDbv?.id ?? null,
          dbv_nome: primeiroDbv?.nome ?? null,
          criado_por: usuario?.nome ?? null,
          avaliador_id: slot.avaliador?.id ?? null,
          avaliador_nome: slot.avaliador?.nome ?? null,
          item_formativo_tipo: fItemTipo,
          item_formativo_nome: fItemNome.trim(),
          gera_investidura: true,
          plano_formativo_id: planoId,
        };
        let supId = slot.atividade?.supabase_id ?? null;
        let localId = slot.atividade?.id ?? null;

        if (slot.atividade) {
          if (supId) {
            const { error } = await supabase.from('atividades').update(payload).eq('id', supId).eq('clube_id', getClubeAtivoId());
            if (error) throw error;
          }
          await db.runAsync(
            `UPDATE atividades SET titulo=?,descricao=?,data=?,destino=?,unidade_id=?,unidade_nome=?,dbv_id=?,dbv_nome=?,criado_por=?,avaliador_id=?,avaliador_nome=?,item_formativo_tipo=?,item_formativo_nome=?,gera_investidura=?,plano_formativo_id=? WHERE id=?`,
            [payload.titulo, payload.descricao, payload.data, payload.destino, payload.unidade_id, payload.unidade_nome,
             payload.dbv_id, payload.dbv_nome, payload.criado_por, payload.avaliador_id, payload.avaliador_nome,
             payload.item_formativo_tipo, payload.item_formativo_nome, 1, planoId, slot.atividade.id]
          );
        } else {
          const { data: inserida, error } = await supabase.from('atividades').insert(payload).select().single();
          if (error) throw error;
          supId = inserida?.id ?? null;
          localId = supId;
          await db.runAsync(
            `INSERT OR REPLACE INTO atividades (id,supabase_id,titulo,descricao,data,destino,unidade_id,unidade_nome,dbv_id,dbv_nome,criado_por,avaliador_id,avaliador_nome,item_formativo_tipo,item_formativo_nome,gera_investidura,plano_formativo_id,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
            [supId, supId, payload.titulo, payload.descricao, payload.data, payload.destino, payload.unidade_id, payload.unidade_nome,
             payload.dbv_id, payload.dbv_nome, payload.criado_por, payload.avaliador_id, payload.avaliador_nome,
             payload.item_formativo_tipo, payload.item_formativo_nome, 1, planoId]
          );
        }

        await salvarAlvos(localId!, supId, alvos);
        for (const ap of slot.anexosPend) {
          const { data: anexoCriado } = await supabase.from('atividades_anexos')
            .insert({ clube_id: getClubeAtivoId(), atividade_id: supId, nome: ap.nome, url: ap.url!, tipo: ap.tipo })
            .select().single();
          await db.runAsync(
            'INSERT INTO atividades_anexos (supabase_id,atividade_id,nome,url,tipo) VALUES (?,?,?,?,?)',
            [anexoCriado?.id ?? null, localId, ap.nome, ap.url!, ap.tipo]
          );
        }
        await notificarAlvos(payload.titulo, payload.descricao, alvos);
      }

      setModalCRUD(false);
      await sincronizar();
      await carregar();
      Alert.alert('Plano salvo', `${preenchidas.length} atividade(s) cadastrada(s). Você poderá completar as demais depois.`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar o plano de atividades.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarAtividade() {
    if (modoCadastroBloco) {
      await salvarAtividadesDoBloco();
      return;
    }
    if (!fTitulo.trim()) {
      Alert.alert('Atenção', 'Título obrigatório.');
      return;
    }
    if (fDestino === 'unidade' && fUnidades.length === 0) {
      Alert.alert('Atenção', 'Selecione uma ou mais unidades.');
      return;
    }
    if (fDestino === 'todos' && fDbvs.length === 0) {
      Alert.alert('Atenção', 'Mantenha ao menos um participante na atividade.');
      return;
    }
    if (fDestino === 'desbravador' && fDbvs.length === 0) {
      Alert.alert('Atenção', 'Selecione um ou mais membros.');
      return;
    }
    if (fNovoPlano && fItemTipo && fItemNome.trim() && Number(fAvaliacoesNecessarias) < 1) {
      Alert.alert('Atenção', 'Informe quantas atividades avaliativas serão necessárias.');
      return;
    }
    if (anexosPend.some((anexo) => anexo.enviando)) {
      Alert.alert('Aguarde', 'Um ou mais anexos ainda estão sendo enviados.');
      return;
    }
    if (anexosPend.some((anexo) => anexo.erro || !anexo.url)) {
      Alert.alert('Anexo não enviado', 'Remova o arquivo com falha e anexe novamente antes de salvar.');
      return;
    }

    setSalvando(true);
    try {
      const db = await getDB();
      const alvos = montarAlvos();
      const primeiraUnidade = fDestino === 'unidade'
        ? fUnidades.find((unidade) => unidade.id !== DIRETORIA_GRUPO_ID) ?? null
        : null;
      const primeiroDbv = fDestino === 'desbravador' ? fDbvs[0] : null;
      let planoFormativoId = fItemTipo && fItemNome.trim() ? fPlanoId : null;
      if (fNovoPlano && fItemTipo && fItemNome.trim()) {
        const quantidade = Math.max(1, Number(fAvaliacoesNecessarias) || 1);
        const { data: planoCriado, error: planoErro } = await supabase
          .from('planos_formativos')
          .insert({
            clube_id: getClubeAtivoId(),
            tipo: fItemTipo,
            item_nome: fItemNome.trim(),
            titulo: fPlanoTitulo.trim() || `${fItemNome.trim()} - ${new Date().getFullYear()}`,
            avaliacoes_necessarias: quantidade,
            criado_por: usuario?.id ?? null,
          })
          .select('id,tipo,item_nome,titulo,avaliacoes_necessarias,ativo')
          .single();
        if (planoErro) throw planoErro;
        planoFormativoId = planoCriado.id;
        setPlanosFormativos((prev) => [planoCriado as PlanoFormativo, ...prev]);
      }
      const payload = {
        clube_id: getClubeAtivoId(),
        titulo: fTitulo.trim(),
        descricao: fDesc.trim() || null,
        data: fData.trim() || null,
        destino: fDestino,
        unidade_id: primeiraUnidade?.id ?? null,
        unidade_nome: primeiraUnidade?.nome ?? null,
        dbv_id: primeiroDbv?.id ?? null,
        dbv_nome: primeiroDbv?.nome ?? null,
        criado_por: usuario?.nome ?? null,
        avaliador_id: fAvaliador?.id ?? null,
        avaliador_nome: fAvaliador?.nome ?? null,
        item_formativo_tipo: fItemTipo,
        item_formativo_nome: fItemTipo && fItemNome.trim() ? fItemNome.trim() : null,
        gera_investidura: fItemTipo && fItemNome.trim() ? true : false,
        plano_formativo_id: planoFormativoId,
      };

      let supId = editando?.supabase_id ?? null;
      let localId = editando?.id ?? null;

      if (editando) {
        if (supId) {
          const { error } = await supabase.from('atividades').update(payload).eq('id', supId).eq('clube_id', getClubeAtivoId());
          if (error) throw error;
        }
        await db.runAsync(
          `UPDATE atividades SET titulo=?,descricao=?,data=?,destino=?,unidade_id=?,unidade_nome=?,dbv_id=?,dbv_nome=?,criado_por=?,avaliador_id=?,avaliador_nome=?,item_formativo_tipo=?,item_formativo_nome=?,gera_investidura=?,plano_formativo_id=? WHERE id=?`,
          [payload.titulo, payload.descricao, payload.data, payload.destino, payload.unidade_id, payload.unidade_nome,
           payload.dbv_id, payload.dbv_nome, payload.criado_por, payload.avaliador_id, payload.avaliador_nome,
           payload.item_formativo_tipo, payload.item_formativo_nome, payload.gera_investidura ? 1 : 0, payload.plano_formativo_id, editando.id]
        );
        localId = editando.id;
      } else {
        const { data: ins, error } = await supabase.from('atividades').insert(payload).select().single();
        if (error) throw error;
        supId = ins?.id ?? null;
        if (supId) {
          await db.runAsync(
            `INSERT OR REPLACE INTO atividades (id,supabase_id,titulo,descricao,data,destino,unidade_id,unidade_nome,dbv_id,dbv_nome,criado_por,avaliador_id,avaliador_nome,item_formativo_tipo,item_formativo_nome,gera_investidura,plano_formativo_id,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
            [supId, supId, payload.titulo, payload.descricao, payload.data, payload.destino, payload.unidade_id, payload.unidade_nome,
             payload.dbv_id, payload.dbv_nome, payload.criado_por, payload.avaliador_id, payload.avaliador_nome,
             payload.item_formativo_tipo, payload.item_formativo_nome, payload.gera_investidura ? 1 : 0, payload.plano_formativo_id]
          );
          localId = supId;
        } else {
          const result = await db.runAsync(
            `INSERT INTO atividades (supabase_id,titulo,descricao,data,destino,unidade_id,unidade_nome,dbv_id,dbv_nome,criado_por,avaliador_id,avaliador_nome,item_formativo_tipo,item_formativo_nome,gera_investidura,plano_formativo_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [supId, payload.titulo, payload.descricao, payload.data, payload.destino, payload.unidade_id, payload.unidade_nome,
           payload.dbv_id, payload.dbv_nome, payload.criado_por, payload.avaliador_id, payload.avaliador_nome,
           payload.item_formativo_tipo, payload.item_formativo_nome, payload.gera_investidura ? 1 : 0, payload.plano_formativo_id]
          );
          localId = result.lastInsertRowId;
        }
      }

      await salvarAlvos(localId!, supId, alvos);

      for (const ap of anexosPend) {
        let supAnexoId: number | null = null;
        if (supId) {
          const { data: xIns } = await supabase.from('atividades_anexos')
            .insert({ clube_id: getClubeAtivoId(), atividade_id: supId, nome: ap.nome, url: ap.url!, tipo: ap.tipo })
            .select()
            .single();
          supAnexoId = xIns?.id ?? null;
        }
        await db.runAsync(
          'INSERT INTO atividades_anexos (supabase_id,atividade_id,nome,url,tipo) VALUES (?,?,?,?,?)',
          [supAnexoId, localId, ap.nome, ap.url!, ap.tipo]
        );
      }

      await notificarAlvos(payload.titulo, payload.descricao, alvos);
      setModalCRUD(false);
      await sincronizar();
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a atividade.');
    } finally {
      setSalvando(false);
    }
  }

  async function notificarAlvos(titulo: string, descricao: string | null, alvos: ReturnType<typeof montarAlvos>) {
    const msgTitulo = editando ? `Atividade atualizada: ${titulo}` : `Nova atividade: ${titulo}`;
    const corpo = descricao ?? 'Toque para ver detalhes';
    for (const alvo of alvos) {
      if (alvo.tipo === 'todos') {
        await enviarParaAlvos(msgTitulo, corpo, { tela: 'atividades' }, 'todos');
      } else if (alvo.tipo === 'unidade') {
        await enviarParaAlvos(msgTitulo, corpo, { tela: 'atividades' }, 'unidade', alvo.unidade_id ?? undefined);
      } else {
        await enviarParaAlvos(msgTitulo, corpo, { tela: 'atividades' }, 'desbravador', undefined, alvo.membro_id ?? undefined);
      }
    }
  }

  async function registrarMensagemAtividade(msg: Omit<AtividadeMensagem, 'id' | 'supabase_id' | 'created_at'> & { created_at?: string }) {
    const createdAt = msg.created_at ?? new Date().toISOString();
    const payload = {
      clube_id: getClubeAtivoId(),
      atividade_id: msg.atividade_id,
      dbv_id: msg.dbv_id,
      autor_tipo: msg.autor_tipo,
      autor_id: msg.autor_id ?? null,
      autor_nome: msg.autor_nome ?? null,
      tipo: msg.tipo,
      texto: msg.texto ?? null,
      anexo_url: msg.anexo_url ?? null,
      anexo_nome: msg.anexo_nome ?? null,
      status: msg.status ?? null,
      nota: msg.nota ?? null,
      created_at: createdAt,
    };

    let supabaseId: number | null = null;
    if (Platform.OS === 'web') {
      const { data, error } = await supabase.from('atividades_mensagens').insert(payload).select('id').single();
      if (error) {
        console.warn('Não foi possível gravar histórico remoto da atividade', error);
      } else {
        supabaseId = data?.id ?? null;
      }
    }

    try {
      const db = await getDB();
      await db.runAsync(
        `INSERT INTO atividades_mensagens
         (supabase_id,atividade_id,dbv_id,autor_tipo,autor_id,autor_nome,tipo,texto,anexo_url,anexo_nome,status,nota,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [supabaseId, payload.atividade_id, payload.dbv_id, payload.autor_tipo, payload.autor_id, payload.autor_nome,
         payload.tipo, payload.texto, payload.anexo_url, payload.anexo_nome, payload.status, payload.nota, payload.created_at]
      );
    } catch (cacheError) {
      console.warn('Histórico remoto gravado, mas o cache local falhou.', cacheError);
    }

    const key = conversaKey(payload.atividade_id, payload.dbv_id);
    setMensagensMap((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] ?? []),
        {
          id: supabaseId ?? Date.now(),
          supabase_id: supabaseId,
          atividade_id: payload.atividade_id,
          dbv_id: payload.dbv_id,
          autor_tipo: payload.autor_tipo as AtividadeMensagem['autor_tipo'],
          autor_id: payload.autor_id,
          autor_nome: payload.autor_nome,
          tipo: payload.tipo as AtividadeMensagem['tipo'],
          texto: payload.texto,
          anexo_url: payload.anexo_url,
          anexo_nome: payload.anexo_nome,
          status: payload.status as StatusResposta | null,
          nota: payload.nota,
          created_at: payload.created_at,
        },
      ],
    }));
  }

  async function excluirAtividade(a: Atividade) {
    const executarExclusao = async () => {
      try {
        setLoading(true);
        const db = await getDB();
        const supabaseId = a.supabase_id ?? a.id;
        if (supabaseId) {
          if (a.item_formativo_tipo === 'especialidade' && a.item_formativo_nome) {
            let origemQuery = supabase
              .from('especialidades')
              .update({
                atividade_origem_excluida: true,
                atividade_origem_excluida_em: new Date().toISOString(),
                atividade_origem_titulo: a.titulo,
              })
              .eq('clube_id', getClubeAtivoId())
              .eq('nome', a.item_formativo_nome);
            origemQuery = a.plano_formativo_id
              ? origemQuery.eq('plano_formativo_id', a.plano_formativo_id)
              : origemQuery.eq('atividade_origem_id', supabaseId);
            const { error: origemError } = await origemQuery;
            if (origemError) throw origemError;
          }
          const { error } = await supabase
            .from('atividades')
            .delete()
            .eq('id', supabaseId)
            .eq('clube_id', getClubeAtivoId());
          if (error) throw error;
        }
        if (a.item_formativo_tipo === 'especialidade' && a.item_formativo_nome) {
          await db.runAsync(
            `UPDATE especialidades
             SET atividade_origem_excluida = 1, atividade_origem_excluida_em = ?,
                 atividade_origem_titulo = ?
             WHERE nome = ? AND (atividade_origem_id = ? OR plano_formativo_id = ?)`,
            [new Date().toISOString(), a.titulo, a.item_formativo_nome, a.id, a.plano_formativo_id ?? -1],
          );
        }
        await db.runAsync('DELETE FROM atividades_alvos WHERE atividade_id=?', [a.id]);
        await db.runAsync('DELETE FROM atividades_anexos WHERE atividade_id=?', [a.id]);
        await db.runAsync('DELETE FROM atividades_respostas WHERE atividade_id=?', [a.id]);
        await db.runAsync('DELETE FROM atividades WHERE id=?', [a.id]);
        setAtividades((prev) => prev.filter((item) => item.id !== a.id));
        await carregar();
      } catch (e: any) {
        Alert.alert('Erro', e?.message ?? 'Não foi possível excluir a atividade.');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const ok = window.confirm(`Deseja excluir a atividade "${a.titulo}"?`);
      if (ok) await executarExclusao();
      return;
    }

    Alert.alert('Excluir', `Remover "${a.titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: executarExclusao,
      },
    ]);
  }

  function respostaDoUsuario(a: Atividade, membroId?: number | null) {
    const alvoId = numeroOuNull(membroId ?? membroAtualId);
    if (!alvoId) return null;
    return respostasMap[a.id]?.find(r => Number(r.dbv_id) === alvoId) ?? null;
  }

  function meuStatus(a: Atividade): StatusResposta | 'na' {
    if (!membroAtualId) return 'na';
    const resp = respostaDoUsuario(a);
    return resp?.status ?? (resp ? 'entregue' : 'pendente');
  }

  function atividadePendenteParaMim(a: Atividade) {
    const st = meuStatus(a);
    return st === 'pendente' || st === 'em_correcao' || st === 'recusada';
  }

  function atividadeEnviadaPorMim(a: Atividade) {
    const st = meuStatus(a);
    return st === 'entregue' || st === 'aprovada';
  }

  function quantidadeDestinatarios(a: Atividade) {
    const alvos = alvosMap[a.id] ?? [];
    if (alvos.length === 0) {
      if (a.destino === 'todos') return dbvs.length;
      if (a.destino === 'unidade') return dbvs.filter((m) => m.unidade_id === a.unidade_id).length;
      return a.dbv_id ? 1 : 0;
    }
    if (alvos.some((alvo) => alvo.tipo === 'todos')) return dbvs.length;
    if (a.destino === 'todos') return new Set(alvos.filter((alvo) => alvo.tipo === 'membro').map((alvo) => alvo.membro_id)).size;
    const ids = new Set<number>();
    alvos.filter((alvo) => alvo.tipo === 'membro' && alvo.membro_id).forEach((alvo) => ids.add(alvo.membro_id!));
    alvos.filter((alvo) => alvo.tipo === 'unidade' && alvo.unidade_id).forEach((alvo) => {
      dbvs.filter((m) => m.unidade_id === alvo.unidade_id).forEach((m) => ids.add(m.id));
    });
    return ids.size;
  }

  function atividadeConcluida(a: Atividade) {
    if (!isAdmin) return meuStatus(a) === 'aprovada';
    const totalDestinatarios = quantidadeDestinatarios(a);
    if (totalDestinatarios === 0) return false;
    const aprovados = new Set(
      (respostasMap[a.id] ?? [])
        .filter((resposta) => resposta.status === 'aprovada')
        .map((resposta) => resposta.dbv_id)
    ).size;
    return aprovados >= totalDestinatarios;
  }

  function abrirDetalhes(a: Atividade) {
    setDetalheAtiv(a);
    setModalDetalhes(true);
  }

  function fecharDetalhes() {
    setModalDetalhes(false);
    // NÃO limpamos detalheAtiv aqui. Com animationType="slide", o modal
    // anima o fechamento no mesmo frame em que visible vira false.
    // Se limparmos detalheAtiv junto, o conteúdo do modal fica branco
    // DURANTE a animação — causando a tela branca visível ao usuário.
    // Os dados serão substituídos naturalmente quando abrirDetalhes() for
    // chamado para outra atividade.
    if (params.detalhes) {
      const abaRetorno = !isAdmin ? `?aba=${abaMembro}` : '';
      router.replace(`/atividades${abaRetorno}` as any);
    }
  }

  function fecharProgresso() {
    setModalProg(false);
    // Mesma razão: não limpar progAtiv durante a animação de fechamento.
    if (params.progresso) {
      router.replace('/atividades' as any);
    }
  }

  function abrirAnexo(x: { url: string; nome?: string | null }) {
    if (!x.url || x.url.startsWith('blob:') || x.url.startsWith('file:')) {
      Alert.alert(
        'Arquivo indisponível',
        'Este anexo foi salvo antes da correção do upload e ficou apenas como arquivo temporário. Reanexe o arquivo para ele ficar disponível para visualização e download.'
      );
      return;
    }
    const url = encodeURI(x.url);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const veioDoProgresso = modalProg && progAtiv;
      const veioDosDetalhes = modalDetalhes && detalheAtiv;
      const abaRetorno = !isAdmin ? `&aba=${abaMembro}` : '';
      const returnTo = veioDosDetalhes
        ? `/atividades?detalhes=${detalheAtiv.id}${abaRetorno}`
        : veioDoProgresso
          ? `/atividades?progresso=${progAtiv.id}`
        : !isAdmin
          ? `/atividades?aba=${abaMembro}`
          : '/atividades';
      if (veioDosDetalhes) setModalDetalhes(false);
      if (veioDoProgresso) setModalProg(false);
      router.push({
        pathname: '/anexo',
        params: {
          url,
          nome: x.nome ?? 'Anexo',
          returnTo,
        },
      });
      return;
    }
    Linking.openURL(url);
  }

  async function baixarAnexo(x: { url: string; nome?: string | null }) {
    if (!x.url || x.url.startsWith('blob:') || x.url.startsWith('file:')) {
      Alert.alert(
        'Arquivo indisponível',
        'Este anexo foi salvo como arquivo temporário. Reanexe o arquivo para conseguir baixar.'
      );
      return;
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const response = await fetch(x.url, { cache: 'no-store' });
        if (!response.ok) throw new Error('Falha ao baixar.');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = x.nome ?? 'anexo';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      } catch {
        Alert.alert('Download não concluído', 'Não foi possível baixar o arquivo.');
      }
      return;
    }

    Linking.openURL(x.url).catch(() => {
      Alert.alert('Download não concluído', 'Não foi possível abrir o arquivo para download.');
    });
  }

  async function abrirResponder(a: Atividade, membroId?: number | null, membroNome?: string | null) {
    if (prazoEncerrado(a)) {
      Alert.alert('Prazo encerrado', `O prazo desta atividade encerrou em ${fmt(a.data)} e novas entregas não são mais permitidas.`);
      return;
    }
    const alvoId = numeroOuNull(membroId ?? membroAtualId);
    if (!alvoId) {
      Alert.alert('Atenção', 'Este acesso não está vinculado ao membro que deve responder a atividade.');
      return;
    }
    const resp = respostaDoUsuario(a, alvoId);
    // Resposta aprovada não pode ser editada
    if (resp?.status === 'aprovada') {
      Alert.alert('Resposta aprovada', 'Esta entrega já foi aprovada e não pode ser alterada.');
      return;
    }
    // Refazendo (devolvida para correção) → campo deve iniciar vazio
    const estaRefazendo = resp?.status === 'em_correcao' || resp?.status === 'recusada';
    carregandoRascunhoRespRef.current = true;
    setRespAtiv(a);
    setRespMembroId(alvoId);
    setRespMembroNome(membroNome ?? (alvoId === numeroOuNull(membroAtualId) ? membroAtualNome : null));
    setRespTexto(estaRefazendo ? '' : (resp?.texto ?? ''));
    setRespAnexo(null);
    setRespAnexoExistenteRemovido(estaRefazendo); // refazendo → descarta anexo anterior
    setRascunhoRespSalvoEm(null);
    setModalResp(true);
    try {
      const raw = await AsyncStorage.getItem(chaveRascunhoResposta(a.supabase_id ?? a.id, alvoId));
      if (raw) {
        const rascunho = JSON.parse(raw) as RascunhoResposta;
        setRespTexto(rascunho.texto ?? (estaRefazendo ? '' : resp?.texto ?? ''));
        setRespAnexo(rascunho.anexo ?? null);
        setRascunhoRespSalvoEm(rascunho.updated_at ?? null);
      }
    } catch (e) {
      console.warn('Não foi possível carregar rascunho da resposta', e);
    } finally {
      setTimeout(() => { carregandoRascunhoRespRef.current = false; }, 0);
    }
  }

  async function escolherAnexoResposta() {
    const anexarResposta = (anexo: AnexoPendente) => {
      setRespAnexo(anexo);
      void enviarAnexoRascunho(anexo, (atualizado) => {
        setRespAnexo((atual) => atual?.chave === atualizado.chave ? atualizado : atual);
      });
    };

    if (Platform.OS === 'web') {
      escolherArquivoWeb({
        accept: 'image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        onFiles: (files) => {
          const file = files[0];
          if (!file) return;
          const tipo = tipoAnexo(file.name, file.type);
          if (tipo !== 'image' && tipo !== 'pdf' && tipo !== 'word') {
            Alert.alert('Formato inválido', 'Anexe apenas imagem, PDF ou Word (.doc/.docx).');
            return;
          }
          anexarResposta(criarAnexoPendente(URL.createObjectURL(file), file.name, tipo, file.type || null));
        },
      });
      return;
    }

    Alert.alert('Anexar à resposta', 'Escolha', [
      {
        text: 'Imagem',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!r.canceled && r.assets[0]) {
            anexarResposta(criarAnexoPendente(r.assets[0].uri, `imagem_${Date.now()}.jpg`, 'image', 'image/jpeg'));
          }
        },
      },
      {
        text: 'Documento',
        onPress: async () => {
          const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
          if (!r.canceled && r.assets[0]) {
            const a = r.assets[0];
            anexarResposta(criarAnexoPendente(a.uri, a.name, tipoAnexo(a.name, a.mimeType ?? ''), a.mimeType ?? null));
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function removerAnexoResposta() {
    const anexo = respAnexo;
    if (!anexo) return;
    await removerAnexoPendente(anexo, () => setRespAnexo(null));
  }

  async function enviarResposta() {
    if (!respAtiv) return;
    if (prazoEncerrado(respAtiv)) {
      Alert.alert('Prazo encerrado', `O prazo desta atividade encerrou em ${fmt(respAtiv.data)} e novas entregas não são mais permitidas.`);
      return;
    }
    if (!respTexto.trim() && !respAnexo) {
      Alert.alert('Atenção', 'Escreva um texto ou anexe um arquivo.');
      return;
    }
    if (respAnexo?.enviando) {
      Alert.alert('Aguarde o anexo', 'O arquivo ainda está sendo enviado em rascunho. Tente novamente em alguns segundos.');
      return;
    }
    if (respAnexo?.erro && !respAnexo.url) {
      Alert.alert('Anexo não enviado', 'Remova o anexo com erro ou selecione o arquivo novamente antes de enviar.');
      return;
    }
    const membroRespostaId = numeroOuNull(respMembroId ?? membroAtualId);
    const membroRespostaNome = respMembroNome ?? membroAtualNome ?? usuario?.nome ?? null;
    if (!membroRespostaId) {
      Alert.alert('Atenção', 'Este acesso não está vinculado ao membro que deve responder a atividade.');
      return;
    }

    setEnviandoResp(true);
    try {
      const supId = respAtiv.supabase_id ?? respAtiv.id;
      let anexoUrl: string | null = null;
      let anexoNome: string | null = null;

      if (respAnexo) {
        if (respAnexo.url) {
          anexoUrl = respAnexo.url;
        } else {
          const mime = respAnexo.mime || (respAnexo.tipo === 'image' ? 'image/jpeg' : respAnexo.tipo === 'pdf' ? 'application/pdf' : 'application/octet-stream');
          const path = `${supId}/resposta_${membroRespostaId}_${Date.now()}_${nomeArquivoSeguro(respAnexo.nome)}`;
          anexoUrl = await uploadParaStorage(path, respAnexo.uri, mime);
        }
        anexoNome = respAnexo.nome;
      }

      const existenteEstado = respostaDoUsuario(respAtiv, membroRespostaId);

      const payload = {
        clube_id: getClubeAtivoId(),
        atividade_id: supId,
        dbv_id: membroRespostaId,
        dbv_nome: membroRespostaNome,
        texto: respTexto.trim() || null,
        anexo_url: anexoUrl ?? (respAnexoExistenteRemovido ? null : existenteEstado?.anexo_url ?? null),
        anexo_nome: anexoNome ?? (respAnexoExistenteRemovido ? null : existenteEstado?.anexo_nome ?? null),
        // Preserva aprovação quando o membro edita dentro da janela de 1 semana
        status: existenteEstado?.status === 'aprovada' ? 'aprovada' : 'entregue',
        nota: existenteEstado?.status === 'aprovada' ? (existenteEstado?.nota ?? null) : null,
        comentario_avaliador: existenteEstado?.comentario_avaliador ?? null,
        avaliado_por: existenteEstado?.status === 'aprovada' ? (existenteEstado?.avaliado_por ?? null) : null,
        avaliado_em: existenteEstado?.status === 'aprovada' ? (existenteEstado?.avaliado_em ?? null) : null,
        entregue_em: existenteEstado?.entregue_em ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const enviadoEm = payload.entregue_em;

      const { data: rIns, error } = await supabase.from('atividades_respostas')
        .upsert(payload, { onConflict: 'atividade_id,dbv_id' })
        .select()
        .single();
      if (error) throw error;

      try {
        const db = await getDB();
        const existente = await db.getFirstAsync<Resposta>(
          'SELECT * FROM atividades_respostas WHERE atividade_id=? AND dbv_id=?',
          [respAtiv.id, membroRespostaId]
        );

        if (existente) {
          await db.runAsync(
            `UPDATE atividades_respostas
             SET texto=?, anexo_url=?, anexo_nome=?, supabase_id=?, status='entregue',
                 nota=NULL, avaliado_por=NULL, avaliado_em=NULL, entregue_em=?, updated_at=datetime('now')
             WHERE id=?`,
            [payload.texto, payload.anexo_url, payload.anexo_nome, rIns?.id ?? existente.supabase_id ?? null, payload.entregue_em, existente.id]
          );
        } else {
          await db.runAsync(
            `INSERT INTO atividades_respostas
             (supabase_id,atividade_id,dbv_id,dbv_nome,texto,anexo_url,anexo_nome,status,entregue_em)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [rIns?.id ?? null, respAtiv.id, membroRespostaId, membroRespostaNome, payload.texto, payload.anexo_url, payload.anexo_nome, 'entregue', payload.entregue_em]
          );
        }
      } catch (cacheError) {
        console.warn('Resposta enviada, mas o cache local não foi atualizado agora.', cacheError);
      }

      const editandoEntregue = existenteEstado?.status === 'entregue';
      const chaveConversa = conversaKey(supId ?? respAtiv.id, membroRespostaId);
      const mensagensConversa = mensagensMap[chaveConversa] ?? [];
      const ultimaResposta = [...mensagensConversa].reverse().find(m => m.tipo === 'resposta');

      if (editandoEntregue) {
        if (ultimaResposta) {
          // Há mensagem registrada — atualiza no Supabase e no SQLite
          if (ultimaResposta.supabase_id) {
            const { error: updErr } = await supabase.from('atividades_mensagens')
              .update({ texto: payload.texto ?? null, anexo_url: anexoUrl ?? null, anexo_nome: anexoNome ?? null })
              .eq('id', ultimaResposta.supabase_id);
            if (updErr) console.warn('Não foi possível atualizar histórico remoto da atividade', updErr);
          }
          try {
            const db = await getDB();
            // Usa supabase_id como chave de busca no SQLite (o id do estado é = supabase_id)
            if (ultimaResposta.supabase_id) {
              await db.runAsync(
                'UPDATE atividades_mensagens SET texto=?, anexo_url=?, anexo_nome=? WHERE supabase_id=?',
                [payload.texto ?? null, anexoUrl ?? null, anexoNome ?? null, ultimaResposta.supabase_id]
              );
            }
          } catch (cacheError) {
            console.warn('Cache local da mensagem não atualizado.', cacheError);
          }
          // Atualiza estado local para refletir imediatamente após carregar()
          setMensagensMap((prev) => ({
            ...prev,
            [chaveConversa]: (prev[chaveConversa] ?? []).map((m) =>
              m.id === ultimaResposta.id
                ? { ...m, texto: payload.texto ?? null, anexo_url: anexoUrl ?? null, anexo_nome: anexoNome ?? null }
                : m
            ),
          }));
        }
        // Se não há mensagem registrada (dados antigos usam fallback de resposta.texto),
        // o upsert em atividades_respostas já atualizou o texto — carregar() exibirá o valor correto.
      } else {
        // Nova resposta ou refazer — INSERT
        await registrarMensagemAtividade({
          atividade_id: supId ?? respAtiv.id,
          dbv_id: membroRespostaId,
          autor_tipo: 'membro',
          autor_id: usuario?.id ?? null,
          autor_nome: membroRespostaNome ?? usuario?.nome ?? 'Membro',
          tipo: 'resposta',
          texto: payload.texto,
          anexo_url: anexoUrl,
          anexo_nome: anexoNome,
          status: 'entregue',
          created_at: enviadoEm,
        });
      }

      await AsyncStorage.removeItem(chaveRascunhoResposta(supId, membroRespostaId)).catch(() => {});
      setRascunhoRespSalvoEm(null);
      setModalResp(false);
      await carregar();
      Alert.alert('Resposta enviada', 'Sua entrega foi registrada.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível enviar a resposta.');
    } finally {
      setEnviandoResp(false);
    }
  }

  async function membrosDosAlvos(a: Atividade) {
    const db = await getDB();
    const alvos = alvosMap[a.id] ?? [];
    if (alvos.length === 0) {
      if (a.destino === 'todos') {
        return db.getAllAsync<DBVLocal>(
          'SELECT id,nome,unidade_id,unidade_nome FROM desbravadores ORDER BY unidade_nome, nome'
        );
      }
      if (a.destino === 'unidade') {
        return db.getAllAsync<DBVLocal>('SELECT id,nome,unidade_id,unidade_nome FROM desbravadores WHERE unidade_id=? ORDER BY nome', [a.unidade_id]);
      }
      return db.getAllAsync<DBVLocal>('SELECT id,nome,unidade_id,unidade_nome FROM desbravadores WHERE id=?', [a.dbv_id]);
    }

    const resultado: DBVLocal[] = [];
    if (alvos.some(x => x.tipo === 'todos')) {
      resultado.push(...await db.getAllAsync<DBVLocal>(
        'SELECT id,nome,unidade_id,unidade_nome FROM desbravadores ORDER BY unidade_nome, nome'
      ));
    }

    const unidadeIds = alvos.filter(x => x.tipo === 'unidade' && x.unidade_id).map(x => x.unidade_id!);
    for (const uid of unidadeIds) {
      resultado.push(...await db.getAllAsync<DBVLocal>(
        'SELECT id,nome,unidade_id,unidade_nome FROM desbravadores WHERE unidade_id=? ORDER BY nome',
        [uid]
      ));
    }

    const membroIds = alvos.filter(x => x.tipo === 'membro' && x.membro_id).map(x => x.membro_id!);
    if (membroIds.length > 0) {
      resultado.push(...await db.getAllAsync<DBVLocal>(
        `SELECT id,nome,unidade_id,unidade_nome FROM desbravadores WHERE id IN (${membroIds.map(() => '?').join(',')}) ORDER BY nome`,
        membroIds
      ));
    }
    return uniqById(resultado);
  }

  async function abrirProgresso(a: Atividade) {
    setProgAtiv(a);
    setLoadingProg(true);
    setModalProg(true);
    try {
      const membros = await membrosDosAlvos(a);
      const resps = respostasMap[a.id] ?? [];
      const porMembro = new Map<number, MembroProgresso>();
      for (const m of membros) {
        porMembro.set(m.id, {
        id: m.id,
        nome: m.nome,
        unidade_nome: m.unidade_nome,
        resposta: resps.find(r => r.dbv_id === m.id) ?? null,
        });
      }
      for (const r of resps) {
        if (!porMembro.has(r.dbv_id)) {
          porMembro.set(r.dbv_id, {
            id: r.dbv_id,
            nome: r.dbv_nome ?? `Membro ${r.dbv_id}`,
            unidade_nome: null,
            resposta: r,
          });
        }
      }
      setMembrosStatus(Array.from(porMembro.values()).sort((a, b) => {
        const aEntregou = a.resposta ? 0 : 1;
        const bEntregou = b.resposta ? 0 : 1;
        if (aEntregou !== bEntregou) return aEntregou - bEntregou;
        return a.nome.localeCompare(b.nome);
      }));
    } finally {
      setLoadingProg(false);
    }
  }

  function abrirAvaliacao(a: Atividade, r: Resposta, status: StatusResposta) {
    setAvalAtiv(a);
    setAvalResp(r);
    setAvalStatus(status);
    setAvalNota(r.nota != null ? String(r.nota) : '');
    setAvalComentario('');
    setAvalAnexo(null);
    setModalAval(true);
  }

  async function escolherAnexoAvaliacao() {
    const anexar = (anexo: AnexoPendente) => {
      setAvalAnexo(anexo);
      void enviarAnexoRascunho(anexo, (atualizado) => {
        setAvalAnexo((atual) => atual?.chave === atualizado.chave ? atualizado : atual);
      });
    };
    if (Platform.OS === 'web') {
      escolherArquivoWeb({
        accept: 'image/*,.pdf,.doc,.docx',
        onFiles: (files) => {
          const file = files[0];
          if (!file) return;
          const tipo = tipoAnexo(file.name, file.type);
          if (tipo !== 'image' && tipo !== 'pdf' && tipo !== 'word') {
            Alert.alert('Formato inválido', 'Anexe apenas imagem, PDF ou Word.');
            return;
          }
          anexar(criarAnexoPendente(URL.createObjectURL(file), file.name, tipo, file.type || null));
        },
      });
      return;
    }
    Alert.alert('Anexar ao feedback', 'Escolha', [
      {
        text: 'Imagem',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!r.canceled && r.assets[0])
            anexar(criarAnexoPendente(r.assets[0].uri, `imagem_${Date.now()}.jpg`, 'image', 'image/jpeg'));
        },
      },
      {
        text: 'Documento',
        onPress: async () => {
          const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
          if (!r.canceled && r.assets[0]) {
            const f = r.assets[0];
            anexar(criarAnexoPendente(f.uri, f.name, tipoAnexo(f.name, f.mimeType ?? ''), f.mimeType ?? null));
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function salvarAvaliacao() {
    if (!avalAtiv || !avalResp) return;
    if (avalAnexo?.enviando) {
      Alert.alert('Aguarde', 'O anexo ainda está sendo enviado. Tente em alguns segundos.');
      return;
    }
    setSalvandoAval(true);
    try {
      const db = await getDB();
      const nota = avalNota.trim() ? Number(avalNota.replace(',', '.')) : null;

      // Upload do anexo do avaliador (se houver)
      let anexoUrl: string | null = null;
      let anexoNome: string | null = null;
      if (avalAnexo) {
        if (avalAnexo.url) {
          anexoUrl = avalAnexo.url;
        } else {
          const supId = avalAtiv.supabase_id ?? avalAtiv.id;
          const mime = avalAnexo.mime || (avalAnexo.tipo === 'image' ? 'image/jpeg' : 'application/octet-stream');
          const path = `${supId}/feedback_${avalResp.dbv_id}_${Date.now()}_${nomeArquivoSeguro(avalAnexo.nome)}`;
          anexoUrl = await uploadParaStorage(path, avalAnexo.uri, mime);
        }
        anexoNome = avalAnexo.nome;
      }

      const payload = {
        status: avalStatus,
        nota: avalStatus === 'aprovada' ? nota : null,
        comentario_avaliador: avalComentario.trim() || null,
        avaliado_por: usuario?.id ?? null,
        avaliado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const avaliadoEm = payload.avaliado_em;

      if (avalResp.supabase_id) {
        const { error } = await supabase
          .from('atividades_respostas')
          .update(payload)
          .eq('id', avalResp.supabase_id)
          .eq('clube_id', getClubeAtivoId());
        if (error) throw error;
      }

      await db.runAsync(
        `UPDATE atividades_respostas
         SET status=?, nota=?, comentario_avaliador=?, avaliado_por=?, avaliado_em=?, updated_at=datetime('now')
         WHERE id=?`,
        [payload.status, payload.nota, payload.comentario_avaliador, payload.avaliado_por, payload.avaliado_em, avalResp.id]
      );

      await registrarMensagemAtividade({
        atividade_id: avalAtiv.supabase_id ?? avalAtiv.id,
        dbv_id: avalResp.dbv_id,
        autor_tipo: 'avaliador',
        autor_id: usuario?.id ?? null,
        autor_nome: usuario?.nome ?? avalAtiv.avaliador_nome ?? 'Avaliador',
        tipo: avalStatus === 'aprovada' ? 'aprovacao' : 'devolucao',
        texto: payload.comentario_avaliador,
        anexo_url: anexoUrl,
        anexo_nome: anexoNome,
        status: avalStatus,
        nota: payload.nota,
        created_at: avaliadoEm,
      });

      const respostaAtualizada: Resposta = {
        ...avalResp,
        status: payload.status,
        nota: payload.nota,
        comentario_avaliador: payload.comentario_avaliador,
        avaliado_por: payload.avaliado_por,
        avaliado_em: payload.avaliado_em,
      };
      setRespostasMap((prev) => ({
        ...prev,
        [avalAtiv.id]: (prev[avalAtiv.id] ?? []).map((r) => r.id === avalResp.id ? respostaAtualizada : r),
      }));
      setMembrosStatus((prev) => prev.map((m) => m.id === avalResp.dbv_id ? { ...m, resposta: respostaAtualizada } : m));
      setModalAval(false);
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a avaliação.');
    } finally {
      setSalvandoAval(false);
    }
  }

  async function reabrirResposta(a: Atividade, resp: Resposta) {
    // No web Alert.alert multi-botão não dispara onPress corretamente —
    // usamos window.confirm() diretamente, igual ao padrão do restante do arquivo.
    const confirmar = Platform.OS === 'web'
      ? window.confirm(`Reabrir a resposta de ${resp.dbv_nome ?? 'Membro'} para edição?\n\nA aprovação será removida e o membro poderá editar novamente.`)
      : await new Promise<boolean>((resolve) =>
          Alert.alert(
            'Reabrir para edição?',
            `A resposta de ${resp.dbv_nome ?? 'Membro'} voltará ao status "Entregue" e poderá ser editada novamente. A aprovação será removida.`,
            [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Reabrir', onPress: () => resolve(true) },
            ]
          )
        );

    if (!confirmar) return;

    try {
      const supId    = a.supabase_id ?? a.id;
      const clubeId  = getClubeAtivoId();
      const payloadUpdate = {
        status: 'entregue',
        nota: null,
        comentario_avaliador: null,
        avaliado_por: null,
        avaliado_em: null,
        updated_at: new Date().toISOString(),
      };

      // Atualiza no Supabase (inclui clube_id como salvarAvaliacao, e verifica se atualizou)
      if (resp.supabase_id) {
        const { data: linhasAtualizadas, error } = await supabase
          .from('atividades_respostas')
          .update(payloadUpdate)
          .eq('id', resp.supabase_id)
          .eq('clube_id', clubeId)
          .select('id');
        if (error) throw error;
        if (!linhasAtualizadas || linhasAtualizadas.length === 0) {
          throw new Error('Não foi possível reabrir: nenhuma resposta foi atualizada. Verifique as permissões do clube.');
        }
      }

      try {
        const db = await getDB();
        await db.runAsync(
          `UPDATE atividades_respostas
           SET status='entregue', nota=NULL, comentario_avaliador=NULL,
               avaliado_por=NULL, avaliado_em=NULL, updated_at=datetime('now')
           WHERE id=?`,
          [resp.id]
        );
      } catch { /* offline — ok */ }

      await registrarMensagemAtividade({
        atividade_id: supId,
        dbv_id: resp.dbv_id,
        autor_tipo: 'sistema',
        autor_id: usuario?.id ?? null,
        autor_nome: usuario?.nome ?? 'Administrador',
        tipo: 'sistema',
        texto: `Atividade reaberta para edição por ${usuario?.nome ?? 'Administrador'}.`,
        status: 'entregue',
      });

      // Atualiza o modal imediatamente via functional update (opera no estado mais recente)
      const respostaReaberta: Resposta = {
        ...(resp as Resposta),
        status: 'entregue',
        nota: null,
        comentario_avaliador: null,
        avaliado_por: null,
        avaliado_em: null,
      };
      setMembrosStatus((prev) =>
        prev.map((m) => m.id === resp.dbv_id ? { ...m, resposta: respostaReaberta } : m)
      );
      setRespostasMap((prev) => ({
        ...prev,
        [a.id]: (prev[a.id] ?? []).map((r) => r.id === resp.id ? respostaReaberta : r),
      }));

      // Recarrega do servidor em background (jaCarregouRef evita tela branca)
      await carregar();

    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível reabrir a atividade.');
    }
  }

  const dbvsFiltrados = useMemo(() => {
    const q = normalizarBusca(buscaDbv);
    const base = q
      ? dbvs.filter(d => normalizarBusca(`${d.nome} ${d.unidade_nome ?? ''}`).includes(q))
      : dbvs;
    return base;
  }, [buscaDbv, dbvs]);

  const dbvsExcluidosTodos = useMemo(
    () => dbvs.filter((dbv) => !fDbvs.some((selecionado) => selecionado.id === dbv.id)),
    [dbvs, fDbvs]
  );

  const unidadesFiltradas = useMemo(() => {
    const q = normalizarBusca(buscaUnidade);
    return q ? unidades.filter(u => normalizarBusca(u.nome).includes(q)) : unidades;
  }, [buscaUnidade, unidades]);

  const itensFormativosFiltrados = useMemo(() => {
    const q = buscaItem.trim().toLowerCase();
    if (fItemTipo === 'classe') {
      return classesModelo
        .filter(c => !q || c.nome.toLowerCase().includes(q))
        .slice(0, 20)
        .map(c => ({ id: String(c.id ?? c.nome), nome: c.nome, detalhe: c.idade_indicada ? `${c.idade_indicada} anos` : c.tipo ?? '' }));
    }
    if (fItemTipo === 'especialidade') {
      return especialidadesModelo
        .filter(e => {
          if (!q) return true;
          return e.nome.toLowerCase().includes(q)
            || String(e.codigo ?? '').toLowerCase().includes(q)
            || String(e.categoria ?? e.area ?? '').toLowerCase().includes(q);
        })
        .slice(0, 30)
        .map(e => ({ id: e.id, nome: e.nome, detalhe: [e.codigo, e.categoria ?? e.area].filter(Boolean).join(' • ') }));
    }
    return [];
  }, [buscaItem, classesModelo, especialidadesModelo, fItemTipo]);

  const planosCompativeis = useMemo(() => {
    if (!fItemTipo || !fItemNome.trim()) return [];
    const item = normalizarBusca(fItemNome);
    return planosFormativos.filter((p) => p.tipo === fItemTipo && normalizarBusca(p.item_nome) === item && p.ativo);
  }, [fItemTipo, fItemNome, planosFormativos]);

  function planoDaAtividade(atividade: Atividade) {
    return atividade.plano_formativo_id
      ? planosFormativos.find((p) => p.id === atividade.plano_formativo_id) ?? null
      : null;
  }

  function alvoTexto(a: Atividade) {
    const alvos = alvosMap[a.id] ?? [];
    if (alvos.length === 0) {
      if (a.destino === 'todos') return 'Todos';
      if (a.destino === 'unidade') return a.unidade_nome ?? 'Unidade';
      return a.dbv_nome ?? 'Desbravador';
    }
    if (alvos.some(x => x.tipo === 'todos')) return 'Todos';
    if (a.destino === 'todos') {
      const participantes = alvos.filter((alvo) => alvo.tipo === 'membro').length;
      return participantes === dbvs.length ? 'Todos os membros' : `${participantes} membros selecionados`;
    }
    const unidadesTxt = alvos.filter(x => x.tipo === 'unidade').map(x => unidades.find(u => u.id === x.unidade_id)?.nome ?? `Unidade ${x.unidade_id}`);
    const membrosTxt = alvos.filter(x => x.tipo === 'membro').map(x => dbvs.find(d => d.id === x.membro_id)?.nome ?? `Membro ${x.membro_id}`);
    return [...unidadesTxt, ...membrosTxt].slice(0, 3).join(', ') + ([...unidadesTxt, ...membrosTxt].length > 3 ? '...' : '');
  }

  const atividadesFilho = useMemo(() => {
    if (!ehPai || filhosIds.length === 0) return [];
    return atividades.filter(a => filhosIds.some((filhoId) => {
      const filho = filhosDados.find((f) => Number(f.id) === Number(filhoId));
      const unidadesDoFilho = numerosUnicos([filho?.unidade_id, ...filhosCtxs.filter((ctx) => Number(ctx.membro_id) === Number(filhoId)).map((ctx) => ctx.unidade_id)]);
      return atividadeIncluiMembro(a, alvosMap[a.id] ?? [], filhoId, unidadesDoFilho);
    }));
  }, [atividades, alvosMap, ehPai, filhosIds, filhosDados, filhosCtxs]);

  function atividadeParaFilho(a: Atividade, filhoId: number) {
    const filho = filhosDados.find((f) => Number(f.id) === Number(filhoId));
    const unidadesDoFilho = numerosUnicos([
      filho?.unidade_id,
      ...filhosCtxs.filter((ctx) => Number(ctx.membro_id) === Number(filhoId)).map((ctx) => ctx.unidade_id),
    ]);
    return atividadeIncluiMembro(a, alvosMap[a.id] ?? [], filhoId, unidadesDoFilho);
  }

  const filhosCtxsComDados = useMemo(() => {
    return filhosCtxs.map((ctx) => {
      const filho = filhosDados.find((f) => Number(f.id) === Number(ctx.membro_id));
      return {
        ...ctx,
        membro_nome: ctx.membro_nome ?? filho?.nome ?? null,
        unidade_id: ctx.unidade_id ?? filho?.unidade_id ?? null,
      };
    });
  }, [filhosCtxs, filhosDados]);

  const pendentesFilhoCount = useMemo(() => {
    if (!ehPai || filhosIds.length === 0) return 0;
    return atividadesFilho.filter(a => {
      return filhosIds.some(filhoId => {
        if (!atividadeParaFilho(a, filhoId)) return false;
        const resp = respostasMap[a.id]?.find(r => r.dbv_id === filhoId);
        return !resp || ['pendente', 'em_correcao', 'recusada'].includes(resp.status ?? 'pendente');
      });
    }).length;
  }, [atividadesFilho, respostasMap, ehPai, filhosIds, filhosDados, filhosCtxs, alvosMap]);

  const pendentesCount = isAdmin ? 0 : atividades.filter(atividadePendenteParaMim).length;
  const atividadesVisiveis = !isAdmin && abaMembro === 'pendentes'
    ? atividades.filter(atividadePendenteParaMim).slice().sort((a, b) => {
        const dA = a.data ? a.data.slice(0, 10) : '9999-99-99';
        const dB = b.data ? b.data.slice(0, 10) : '9999-99-99';
        return dA.localeCompare(dB);
      })
    : !isAdmin && abaMembro === 'enviadas'
      ? atividades.filter(atividadeEnviadaPorMim)
      : atividades;

  function agruparAtividades(lista: Atividade[]) {
    const grupos = new Map<string, GrupoAtividades>();
    for (const atividade of lista) {
      const plano = planoDaAtividade(atividade);
      const key = plano ? `plano-${plano.id}` : `atividade-${atividade.id}`;
      const grupo = grupos.get(key);
      if (grupo) {
        grupo.atividades.push(atividade);
      } else {
        grupos.set(key, { key, plano, atividades: [atividade] });
      }
    }
    return Array.from(grupos.values()).map((grupo) => ({
      ...grupo,
      atividades: grupo.atividades.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
    }));
  }

  const atividadesParaBlocos = useMemo(() => {
    // Para não-admin cada atividade vai à aba exclusivamente pelo seu status,
    // sem expandir o plano inteiro (o que causava sobreposição entre abas).
    return atividadesVisiveis;
  }, [atividadesVisiveis]);

  const gruposAtividadesVisiveis = agruparAtividades(atividadesParaBlocos);

  if (!usuario) return <Redirect href="/auth/login" />;

  const chatDetalheResp = detalheAtiv ? respostaDoUsuario(detalheAtiv) : null;
  const chatDetalheSt: StatusResposta = chatDetalheResp?.status ?? (chatDetalheResp ? 'entregue' : 'pendente');
  const chatDetalheAnexos = detalheAtiv ? (anexosMap[detalheAtiv.id] ?? []) : [];
  // Resposta existente sendo editada no modal de resposta
  const respEditandoExistente = modalResp && respAtiv ? respostaDoUsuario(respAtiv, respMembroId) : null;
  function mensagensDaConversa(atividade: Atividade, resposta?: Resposta | null) {
    const membroId = resposta?.dbv_id ?? membroAtualId;
    if (!membroId) return [] as AtividadeMensagem[];
    const historico = mensagensMap[conversaKey(atividade.id, membroId)] ?? mensagensMap[conversaKey(atividade.supabase_id ?? atividade.id, membroId)] ?? [];
    if (historico.length > 0) return historico;
    const fallback: AtividadeMensagem[] = [];
    if (resposta) {
      fallback.push({
        id: resposta.id,
        atividade_id: atividade.id,
        dbv_id: resposta.dbv_id,
        autor_tipo: 'membro',
        autor_nome: resposta.dbv_nome ?? membroAtualNome ?? 'Membro',
        tipo: 'resposta',
        texto: resposta.texto,
        anexo_url: resposta.anexo_url,
        anexo_nome: resposta.anexo_nome,
        status: 'entregue',
        created_at: resposta.entregue_em ?? resposta.created_at,
      });
      if (resposta.status === 'aprovada' || resposta.status === 'em_correcao' || resposta.status === 'recusada') {
        fallback.push({
          id: resposta.id + 1000000,
          atividade_id: atividade.id,
          dbv_id: resposta.dbv_id,
          autor_tipo: 'avaliador',
          autor_id: resposta.avaliado_por ?? null,
          autor_nome: atividade.avaliador_nome ?? 'Diretoria',
          tipo: resposta.status === 'aprovada' ? 'aprovacao' : 'devolucao',
          texto: resposta.comentario_avaliador,
          status: resposta.status,
          nota: resposta.nota,
          created_at: resposta.avaliado_em ?? resposta.created_at,
        });
      }
    }
    return fallback;
  }

  function renderMensagemChat(msg: AtividadeMensagem) {
    // Mensagem de sistema — aviso centralizado
    if (msg.tipo === 'sistema') {
      return (
        <View key={`${msg.id}-${msg.created_at}`} style={s.chatRowSistema}>
          <Ionicons name="information-circle-outline" size={13} color="#7b1fa2" />
          <Text style={s.chatSistemaText}>{msg.texto}</Text>
          <Text style={s.chatSistemaData}>{fmt(msg.created_at)}</Text>
        </View>
      );
    }
    const isMembro = msg.autor_tipo === 'membro';
    const status = msg.status ?? (msg.tipo === 'resposta' ? 'entregue' : null);
    return (
      <View key={`${msg.id}-${msg.created_at}`} style={isMembro ? s.chatRowRight : s.chatRowLeft}>
        {!isMembro && (
          <View style={s.chatAvatarLeft}>
            <Ionicons name="school" size={18} color="#fff" />
          </View>
        )}
        <View style={[
          isMembro ? s.chatBubbleRight : s.chatBubbleLeft,
          msg.tipo === 'aprovacao' ? s.chatBubbleAprovada : null,
          msg.tipo === 'devolucao' || msg.tipo === 'recusa' ? s.chatBubbleCorrecao : null,
        ]}>
          <Text style={[s.chatSenderName, isMembro && { color: '#1b5e20' }]}>{msg.autor_nome ?? (isMembro ? 'Membro' : 'Avaliador')}</Text>
          {status ? (
            <View style={s.chatStatusRow}>
              <Ionicons
                name={status === 'aprovada' ? 'checkmark-circle' : (status === 'em_correcao' || status === 'recusada') ? 'construct' : 'send'}
                size={13}
                color={statusColor(status)}
              />
              <Text style={[s.chatStatusText, { color: statusColor(status) }]}>{statusLabel(status)}</Text>
            </View>
          ) : null}
          {msg.texto ? <Text style={s.chatBubbleText}>{msg.texto}</Text> : null}
          {msg.anexo_url ? (
            <TouchableOpacity style={s.chatAnexoChip} onPress={() => abrirAnexo({ url: msg.anexo_url!, nome: msg.anexo_nome })}>
              <Ionicons
                name={tipoIcon(tipoAnexo(msg.anexo_nome ?? '')).name}
                size={15}
                color={tipoIcon(tipoAnexo(msg.anexo_nome ?? '')).color}
              />
              <Text style={s.chatAnexoNome} numberOfLines={1}>{msg.anexo_nome ?? 'Anexo'}</Text>
            </TouchableOpacity>
          ) : null}
          {msg.nota != null ? <Text style={s.chatNotaText}>Nota: {msg.nota}</Text> : null}
          <Text style={s.chatTimeText}>{fmt(msg.created_at)}</Text>
        </View>
        {isMembro && (
          <View style={s.chatAvatarRight}>
            <Ionicons name="person" size={18} color="#fff" />
          </View>
        )}
      </View>
    );
  }

  function renderAtividadeLista(a: Atividade, indice?: number, totalPrevisto?: number) {
    const anexos = anexosMap[a.id] ?? [];
    const resps = respostasMap[a.id] ?? [];
    const minhaResp = respostaDoUsuario(a);
    const st = meuStatus(a);
    const respValidas = resps.filter(r => r.status !== 'recusada');
    const aguardandoAvaliacao = resps.filter(r => r.status === 'entregue').length;
    const estaEmPlano = indice != null && totalPrevisto != null;
    const concluida = atividadeConcluida(a);
    const corDoBloco = estaEmPlano
      ? paletaAtividade.cores[((indice ?? 1) - 1) % paletaAtividade.cores.length]
      : undefined;

    // Cards colapsáveis para não-admin (acordeão) — pendente, em_correcao, prazo encerrado
    const encerrado = prazoEncerrado(a);
    const dias = diasRestantes(a);
    const labelDias = dias === null ? null : dias === 0 ? 'Hoje' : dias === 1 ? '1 dia' : `${dias} dias`;
    type ChipInfo = { label: string; icon: string; color: string; bg: string; tituloColor: string; opacity: number };
    let chipInfo: ChipInfo | null = null;
    if (!isAdmin) {
      if (encerrado && st !== 'aprovada') {
        chipInfo = { label: 'Prazo encerrado', icon: 'lock-closed', color: '#c62828', bg: '#ffebee', tituloColor: '#90a4ae', opacity: 0.72 };
      } else if (!encerrado && st === 'pendente') {
        chipInfo = { label: labelDias ? `Responder · ${labelDias}` : 'Responder', icon: 'send-outline', color: '#1565c0', bg: '#e3f2fd', tituloColor: '#1a3a5c', opacity: 1 };
      } else if (st === 'em_correcao' || st === 'recusada') {
        chipInfo = { label: labelDias ? `Para corrigir · ${labelDias}` : 'Para corrigir', icon: 'construct-outline', color: '#e65100', bg: '#fff3e0', tituloColor: '#1a3a5c', opacity: 1 };
      } else if (st === 'entregue') {
        chipInfo = { label: 'Aguardando avaliação', icon: 'time-outline', color: '#1565c0', bg: '#e8eaf6', tituloColor: '#1a3a5c', opacity: 1 };
      } else if (st === 'aprovada') {
        chipInfo = { label: 'Aprovada', icon: 'checkmark-circle', color: '#2e7d32', bg: '#e8f5e9', tituloColor: '#1a3a5c', opacity: 1 };
      }
    }
    const cardExpandido = cardExpandidoId === a.id;

    if (chipInfo && !cardExpandido) {
      return (
        <TouchableOpacity
          key={a.id}
          style={[estaEmPlano ? s.planoAtividade : s.card, { opacity: chipInfo.opacity }, corDoBloco]}
          activeOpacity={0.82}
          onPress={() => setCardExpandidoId(a.id)}
        >
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                {estaEmPlano ? <Text style={[s.planoAtividadeNumero, { color: '#90a4ae' }]}>Atividade {indice}/{totalPrevisto}</Text> : null}
                <Text style={[s.cardTitulo, { color: chipInfo.tituloColor }, fonteAtividadeStyle]} numberOfLines={1}>{a.titulo}</Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#90a4ae" style={{ marginLeft: 6 }} />
            </View>
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <View style={[s.prazoEncChip, s.prazoEncChipDestaque, { backgroundColor: chipInfo.bg }]}>
                <Ionicons name={chipInfo.icon as any} size={14} color={chipInfo.color} />
                <Text style={[s.prazoEncChipText, s.prazoEncChipTextDestaque, { color: chipInfo.color }]}>{chipInfo.label}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View key={a.id} style={[estaEmPlano ? s.planoAtividade : s.card, corDoBloco, concluida && s.concluidaCard, estaEmPlano && aguardandoAvaliacao > 0 && s.cardAguardando]}>
        {concluida ? <Text pointerEvents="none" style={s.concluidaMarca}>Concluída</Text> : null}
        {chipInfo && cardExpandido && (
          <TouchableOpacity
            style={s.recolherExpiradoBtn}
            onPress={() => setCardExpandidoId(null)}
          >
            <Ionicons name="chevron-up" size={14} color="#90a4ae" />
            <Text style={s.recolherExpiradoText}>Recolher</Text>
          </TouchableOpacity>
        )}
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            {estaEmPlano ? <Text style={[s.planoAtividadeNumero, fonteAtividadeStyle, corDoBloco && { color: corDoBloco.accentColor }, concluida && s.concluidaTexto]}>Atividade {indice}/{totalPrevisto}</Text> : null}
            <Text style={[s.cardTitulo, fonteAtividadeStyle, corDoBloco && { color: corDoBloco.accentColor }, concluida && s.concluidaTexto]}>{a.titulo}</Text>
            {a.data ? <Text style={[s.cardData, fonteAtividadeStyle, corDoBloco && { color: corDoBloco.accentColor }, concluida && s.concluidaTextoSec]} >Prazo: {fmt(a.data)}</Text> : null}
          </View>
          {isAdmin && (
            <View style={s.acoesRow}>
              <TouchableOpacity
                style={s.acaoBtn}
                onPress={() => abrirEditar(a)}
                accessibilityLabel={estaEmPlano ? 'Editar bloco de atividades' : 'Editar atividade'}
              >
                <Ionicons name="pencil-outline" size={16} color="#1a3a5c" />
              </TouchableOpacity>
              <TouchableOpacity style={s.acaoBtn} onPress={() => excluirAtividade(a)}>
                <Ionicons name="trash-outline" size={16} color="#c62828" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {a.descricao ? <Text style={[s.cardDesc, fonteAtividadeStyle]}>{a.descricao}</Text> : null}

        <View style={s.badgeRow}>
          <View style={s.badge}><Text style={[s.badgeText, fonteAtividadeStyle]}>{alvoTexto(a)}</Text></View>
          {!estaEmPlano && a.item_formativo_tipo && a.item_formativo_nome ? (
            <View style={[s.badge, s.badgeFormativo]}>
              <Text style={[s.badgeText, fonteAtividadeStyle]}>
                {a.item_formativo_tipo === 'classe' ? 'Classe' : 'Especialidade'}: {a.item_formativo_nome}
              </Text>
            </View>
          ) : null}
          {!estaEmPlano && planoDaAtividade(a) ? (
            <View style={[s.badge, s.badgePlano]}>
              <Text style={[s.badgeText, fonteAtividadeStyle]}>Plano: {planoDaAtividade(a)!.avaliacoes_necessarias} avaliações</Text>
            </View>
          ) : null}
          {a.avaliador_nome ? (
            <View style={[s.badge, s.badgeAvaliador]}>
              <Text style={[s.badgeText, fonteAtividadeStyle]}>Avaliador: {a.avaliador_nome}</Text>
            </View>
          ) : null}
        </View>

        {anexos.length > 0 && (
          <View style={s.anexosRow}>
            {anexos.map(x => (
              <TouchableOpacity key={x.id} style={s.anexoChip} onPress={() => abrirAnexo(x)}>
                {x.tipo === 'image' ? (
                  <Image source={{ uri: x.url }} style={s.anexoThumb} />
                ) : (
                  <Ionicons name={tipoIcon(x.tipo).name} size={18} color={tipoIcon(x.tipo).color} />
                )}
                <Text style={s.anexoNome} numberOfLines={1}>{x.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!isAdmin && st !== 'na' && (
          minhaResp ? (
            <>
              {/* Histórico da conversa — sempre visível, igual ao WhatsApp */}
              <View style={s.planoConversa}>
                {mensagensDaConversa(a, minhaResp).map(renderMensagemChat)}
              </View>
              {/* Ações abaixo do histórico */}
              {st === 'entregue' && !prazoEncerrado(a) && (
                <TouchableOpacity
                  style={s.editarRespBtn}
                  onPress={() => abrirResponder(a)}
                >
                  <Ionicons name="pencil-outline" size={14} color="#1a3a5c" />
                  <Text style={s.editarRespBtnText}>Editar resposta</Text>
                </TouchableOpacity>
              )}
              {(st === 'em_correcao' || st === 'recusada') && !prazoEncerrado(a) && (
                <TouchableOpacity style={s.refazerBtn} onPress={() => abrirResponder(a)}>
                  <Ionicons name="refresh" size={15} color="#fff" />
                  <Text style={s.refazerBtnText}>Refazer</Text>
                </TouchableOpacity>
              )}
              {st === 'aprovada' && (
                <View style={[s.prazoEncerradoBox, { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7', marginTop: 6 }]}>
                  <Ionicons name="checkmark-circle" size={14} color="#2e7d32" />
                  <Text style={[s.prazoEncerradoText, { color: '#2e7d32' }]}>Aprovada</Text>
                </View>
              )}
            </>
          ) : prazoEncerrado(a) ? (
            <View style={s.prazoEncerradoBox}>
              <Ionicons name="lock-closed-outline" size={15} color="#c62828" />
              <Text style={s.prazoEncerradoText}>Prazo encerrado</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.responderBtn} onPress={() => abrirResponder(a)}>
              <Ionicons name="send-outline" size={15} color="#fff" />
              <Text style={s.responderBtnText}>Responder</Text>
            </TouchableOpacity>
          )
        )}

        <TouchableOpacity style={s.detalhesBtn} onPress={() => abrirDetalhes(a)}>
          <Ionicons name="document-text-outline" size={15} color="#1a3a5c" />
          <Text style={s.detalhesBtnText}>Ver detalhes</Text>
        </TouchableOpacity>

        {podeVerProgresso && (
          <TouchableOpacity style={s.statsRow} onPress={() => abrirProgresso(a)}>
            <Text style={s.statsText}>
              {respValidas.length} entrega(s){aguardandoAvaliacao > 0 ? ` • ${aguardandoAvaliacao} a avaliar` : ''}
            </Text>
            <View style={s.verProg}>
              <Text style={s.verProgText}>Ver progresso</Text>
              <Ionicons name="chevron-forward" size={12} color="#1a3a5c" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderGrupoLista(grupo: GrupoAtividades) {
    if (!grupo.plano) return renderAtividadeLista(grupo.atividades[0]);
    const total = grupo.plano.avaliacoes_necessarias;
    const cadastradas = grupo.atividades.length;
    const expandido = !!gruposExpandidos[grupo.key];
    const aprovadasMembro = !isAdmin
      ? grupo.atividades.filter((a) => meuStatus(a) === 'aprovada').length
      : null;
    const concluido = cadastradas === total && grupo.atividades.every((atividade) => atividadeConcluida(atividade));
    return (
      <View key={grupo.key} style={[s.planoCard, concluido && s.concluidaGrupo]}>
        {concluido ? <Text pointerEvents="none" style={s.concluidaMarcaGrupo}>Concluída</Text> : null}
        <TouchableOpacity
          style={s.planoCabecalhoCompacto}
          onPress={() => setGruposExpandidos((prev) => ({ ...prev, [grupo.key]: !expandido }))}
          accessibilityLabel={expandido ? 'Recolher atividades do bloco' : 'Mostrar atividades do bloco'}
        >
          <View style={s.planoToggle}>
            <Ionicons name={expandido ? 'remove' : 'add'} size={18} color="#1a3a5c" />
          </View>
          <Text style={[s.planoLinhaTitulo, fonteAtividadeStyle, concluido && s.concluidaTexto]} numberOfLines={1}>
            {grupo.plano.tipo === 'classe' ? 'Classe' : 'Especialidade'}: {grupo.plano.item_nome}
          </Text>
          <View style={[s.planoContagem, concluido && s.concluidaContagem]}>
            <Text style={[s.planoContagemNum, concluido && s.concluidaTexto]}>{aprovadasMembro != null ? aprovadasMembro : cadastradas}/{total}</Text>
            <Text style={[s.planoContagemLabel, concluido && s.concluidaTexto]}>{aprovadasMembro != null ? 'aprovadas' : 'cadastradas'}</Text>
          </View>
        </TouchableOpacity>
        {expandido ? (
          <>
            <Text style={[s.planoInstrucao, fonteAtividadeStyle, concluido && s.concluidaTextoSec]}>
              {cadastradas < total
                ? `${total - cadastradas} atividade(s) ainda poderão ser cadastradas depois.`
                : 'Todas as atividades previstas já foram cadastradas.'}
            </Text>
            <View style={s.planoAtividadesLista}>
              {grupo.atividades.map((atividade, i) => renderAtividadeLista(atividade, i + 1, total))}
              {Array.from({ length: Math.max(0, total - cadastradas) }, (_, i) => (
                <View key={`pendente-${i}`} style={s.planoAtividadeVazia}>
                  <Text style={[s.planoAtividadeVaziaTitulo, fonteAtividadeStyle]}>Atividade {cadastradas + i + 1}/{total}</Text>
                  <Text style={[s.planoAtividadeVaziaText, fonteAtividadeStyle]}>Ainda não cadastrada</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>
    );
  }

  function voltar() {
    setModalDetalhes(false);
    setModalProg(false);
    setAba('lista');
    router.replace('/');
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: headerColor }]}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={voltar} style={s.headerBack} accessibilityLabel="Voltar para a lista de atividades">
            <Ionicons name="arrow-back" size={22} color="#fff" />
            <Text style={s.headerBackText}>Voltar</Text>
          </TouchableOpacity>
        </View>
        <View style={s.headerMain}>
          <Text style={[s.headerTitle, fonteAtividadeStyle]}>Atividades</Text>
          {isAdmin && (
            <TouchableOpacity onPress={abrirCriar} style={s.headerAdd} accessibilityLabel="Nova atividade">
              <Ionicons name="add-circle-outline" size={28} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {podeVerProgresso && (
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, aba === 'lista' && s.tabAtiva]} onPress={() => setAba('lista')}>
            <Text style={[s.tabText, aba === 'lista' && s.tabTextAtiva]}>Atividades</Text>
          </TouchableOpacity>
          {ehPai && (
            <TouchableOpacity style={[s.tab, aba === 'filhos' && s.tabAtiva]} onPress={() => setAba('filhos')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[s.tabText, aba === 'filhos' && s.tabTextAtiva]}>
                  {filhosCtxsComDados.length === 1 ? filhosCtxsComDados[0].membro_nome ?? 'Minha filha' : 'Meus filhos'}
                </Text>
                {pendentesFilhoCount > 0 && (
                  <View style={{ backgroundColor: '#ff6b35', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{pendentesFilhoCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.tab, aba === 'progresso' && s.tabAtiva]} onPress={() => setAba('progresso')}>
            <Text style={[s.tabText, aba === 'progresso' && s.tabTextAtiva]}>Progresso</Text>
          </TouchableOpacity>
        </View>
      )}

      {!podeVerProgresso && (
        <View style={s.tabs}>
          {([
            { id: 'pendentes' as const, label: `Pendentes (${pendentesCount})` },
            { id: 'enviadas' as const, label: `Enviadas (${atividades.filter(atividadeEnviadaPorMim).length})` },
          ]).map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, abaMembro === t.id && (t.id === 'pendentes' ? s.tabAtivaPendentes : s.tabAtivaEnviadas)]}
              onPress={() => setAbaMembro(t.id)}
            >
              <Text style={[s.tabText, abaMembro === t.id && (t.id === 'pendentes' ? s.tabTextPendentes : s.tabTextEnviadas)]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!isAdmin && pendentesCount > 0 && (
        <View style={s.pendBanner}>
          <Ionicons name="alert-circle" size={16} color="#ff6b35" />
          <Text style={s.pendBannerText}>{pendentesCount} atividade(s) pendente(s)</Text>
        </View>
      )}

      {aba === 'filhos' && pendentesFilhoCount > 0 && (
        <View style={s.pendBanner}>
          <Ionicons name="alert-circle" size={16} color="#ff6b35" />
          <Text style={s.pendBannerText}>{pendentesFilhoCount} atividade(s) pendente(s) para {filhosCtxsComDados.length === 1 ? filhosCtxsComDados[0].membro_nome ?? 'sua filha' : 'seus filhos'}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a3a5c" />
      ) : aba === 'filhos' ? (
        <ScrollView contentContainerStyle={s.list}>
          {atividadesFilho.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="clipboard-outline" size={64} color="#c7d0d8" />
              <Text style={s.emptyText}>Nenhuma atividade encontrada para {filhosCtxsComDados.length === 1 ? filhosCtxsComDados[0].membro_nome ?? 'sua filha' : 'seus filhos'}</Text>
            </View>
          ) : null}
          {atividadesFilho.map(a => {
            const anexos = anexosMap[a.id] ?? [];
            return (
              <View key={a.id}>
                {filhosCtxsComDados.filter((filhoCtx) => atividadeParaFilho(a, filhoCtx.membro_id!)).map(filhoCtx => {
                  const filhoId = filhoCtx.membro_id!;
                  const filhoNome = filhoCtx.membro_nome ?? `Filho(a) ${filhoId}`;
                  const resp = respostasMap[a.id]?.find(r => r.dbv_id === filhoId);
                  const st: StatusResposta = resp?.status ?? (resp ? 'entregue' : 'pendente');
                  const pendente = !resp || ['pendente', 'em_correcao', 'recusada'].includes(st);
                  return (
                    <View key={`${a.id}-${filhoId}`} style={[s.card, pendente && s.cardFilhoPendente]}>
                      <View style={s.cardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cardTitulo}>{a.titulo}</Text>
                          {a.data ? <Text style={s.cardData}>Prazo: {fmt(a.data)}</Text> : null}
                        </View>
                        <View style={[s.filhoStatusBadge, { backgroundColor: pendente ? '#fff3e0' : '#e8f5e9' }]}>
                          <Ionicons
                            name={pendente ? 'time-outline' : st === 'aprovada' ? 'checkmark-circle' : 'send'}
                            size={14}
                            color={pendente ? '#e65100' : statusColor(st)}
                          />
                          <Text style={[s.filhoStatusText, { color: pendente ? '#e65100' : statusColor(st) }]}>
                            {pendente ? 'Pendente' : statusLabel(st)}
                          </Text>
                        </View>
                      </View>

                      <View style={s.filhoNomeRow}>
                        <Ionicons name="person-circle-outline" size={15} color="#546e7a" />
                        <Text style={s.filhoNomeText}>{filhoNome}</Text>
                      </View>

                      {a.descricao ? <Text style={s.cardDesc} numberOfLines={2}>{a.descricao}</Text> : null}

                      <View style={s.badgeRow}>
                        <View style={s.badge}><Text style={s.badgeText}>{alvoTexto(a)}</Text></View>
                        {a.item_formativo_nome ? (
                          <View style={[s.badge, s.badgeFormativo]}>
                            <Text style={s.badgeText}>{a.item_formativo_tipo === 'classe' ? 'Classe' : 'Esp.'}: {a.item_formativo_nome}</Text>
                          </View>
                        ) : null}
                      </View>

                      {resp && (
                        <View style={s.respondidoBox}>
                          <Text style={[s.respondidoText, { color: statusColor(st) }]}>{statusLabel(st)}</Text>
                          {resp.texto ? <Text style={s.respPreview} numberOfLines={2}>{resp.texto}</Text> : null}
                          {resp.nota != null ? <Text style={s.respPreview}>Nota: {resp.nota}</Text> : null}
                          {resp.comentario_avaliador ? <Text style={s.respPreview} numberOfLines={1}>{resp.comentario_avaliador}</Text> : null}
                        </View>
                      )}

                      {anexos.length > 0 && (
                        <View style={s.anexosRow}>
                          {anexos.map(x => (
                            <TouchableOpacity key={x.id} style={s.anexoChip} onPress={() => abrirAnexo(x)}>
                              {x.tipo === 'image'
                                ? <Image source={{ uri: x.url }} style={s.anexoThumb} />
                                : <Ionicons name={tipoIcon(x.tipo).name} size={18} color={tipoIcon(x.tipo).color} />}
                              <Text style={s.anexoNome} numberOfLines={1}>{x.nome}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <View style={s.filhoAcoes}>
                        <TouchableOpacity style={[s.detalhesBtn, s.filhoAcaoBtn]} onPress={() => abrirDetalhes(a)}>
                          <Ionicons name="document-text-outline" size={15} color="#1a3a5c" />
                          <Text style={s.detalhesBtnText}>Ver detalhes</Text>
                        </TouchableOpacity>
                        {pendente && !prazoEncerrado(a) ? (
                          <TouchableOpacity
                            style={[s.responderBtn, s.filhoAcaoBtn]}
                            onPress={() => abrirResponder(a, filhoId, filhoNome)}
                          >
                            <Ionicons name="send-outline" size={15} color="#fff" />
                            <Text style={s.responderBtnText}>{resp ? 'Corrigir' : 'Responder'}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View style={{ height: 28 }} />
        </ScrollView>
      ) : aba === 'lista' ? (
        <ScrollView contentContainerStyle={s.list}>
          {atividadesVisiveis.length === 0 && (
            <View style={s.emptyWrap}>
              <Ionicons name="clipboard-outline" size={64} color="#c7d0d8" />
              <Text style={s.emptyText}>
                {!isAdmin && abaMembro === 'enviadas' ? 'Nenhuma atividade enviada' : 'Nenhuma atividade encontrada'}
              </Text>
            </View>
          )}

          {gruposAtividadesVisiveis.map(renderGrupoLista)}
          <View style={{ height: 28 }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {atividades.map(a => {
            const resps = respostasMap[a.id] ?? [];
            const aguardandoAvaliacao = resps.filter(r => r.status === 'entregue').length;
            const aprovadas = resps.filter(r => r.status === 'aprovada').length;
            return (
              <TouchableOpacity key={a.id} style={[s.card, aguardandoAvaliacao > 0 && s.cardAguardando]} onPress={() => abrirProgresso(a)} activeOpacity={0.82}>
                <Text style={s.cardTitulo}>{a.titulo}</Text>
                {a.data ? <Text style={s.cardData}>{fmt(a.data)}</Text> : null}
                <View style={s.badgeRow}>
                  <View style={[s.badge, aguardandoAvaliacao > 0 && s.badgeAguardando]}>
                    <Text style={s.badgeText}>{aguardandoAvaliacao} a avaliar</Text>
                  </View>
                  <View style={[s.badge, s.badgeAvaliador]}>
                    <Text style={s.badgeText}>{aprovadas} aprovadas</Text>
                  </View>
                </View>
                <View style={[s.statsRow, { marginTop: 8 }]}>
                  <Text style={s.statsText}>{resps.length} entrega(s)</Text>
                  <View style={s.verProg}>
                    <Text style={s.verProgText}>Ver quem enviou</Text>
                    <Ionicons name="chevron-forward" size={16} color="#1a3a5c" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={modalCRUD} animationType="slide" presentationStyle="pageSheet" onRequestClose={fecharCadastroAtividade}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={fecharCadastroAtividade}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={s.modalTitulo}>
                {!editando && etapaCadastro === 1
                  ? 'Novo plano de atividades'
                  : modoCadastroBloco ? (fPlanoId ? 'Editar plano de atividades' : 'Nova atividade') : 'Editar atividade'}
              </Text>
              {!editando && etapaCadastro === 1 ? <View style={s.modalAcaoEspaco} /> : (
                <TouchableOpacity onPress={salvarAtividade} disabled={salvando}>
                  {salvando ? <ActivityIndicator size="small" color="#1a3a5c" /> : <Text style={s.modalSalvar}>{modoCadastroBloco ? 'Salvar plano' : 'Salvar'}</Text>}
                </TouchableOpacity>
              )}
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              {!editando && etapaCadastro === 1 && (
                <View>
                  <Text style={s.etapaTexto}>Etapa 1 de 2</Text>
                  <Text style={s.etapaTitulo}>Defina o plano avaliativo</Text>

                  <Text style={s.label}>Quantidade de atividades *</Text>
                  <TextInput
                    style={s.input}
                    value={fAvaliacoesNecessarias}
                    onChangeText={setFAvaliacoesNecessarias}
                    keyboardType="number-pad"
                    placeholder="Ex.: 4"
                  />

                  <Text style={s.label}>Especialidade ou classe vinculada *</Text>
                  <View style={s.chipRow}>
                    {([
                      { key: 'especialidade' as const, label: 'Especialidade' },
                      { key: 'classe' as const, label: 'Classe' },
                    ]).map((op) => (
                      <TouchableOpacity
                        key={op.label}
                        style={[s.chip, fItemTipo === op.key && s.chipAtivo]}
                        onPress={() => {
                          setFItemTipo(op.key);
                          setFItemNome('');
                          setBuscaItem('');
                        }}
                      >
                        <Text style={[s.chipText, fItemTipo === op.key && s.chipTextAtivo]}>{op.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {fItemTipo ? (
                    <>
                      <TextInput
                        style={[s.input, s.itemBusca]}
                        value={buscaItem}
                        onChangeText={(valor) => {
                          setBuscaItem(valor);
                          setFItemNome('');
                        }}
                        placeholder={fItemTipo === 'classe' ? 'Buscar classe...' : 'Buscar especialidade...'}
                      />
                      <View style={s.optionList}>
                        {itensFormativosFiltrados.map((item) => {
                          const ativo = fItemNome === item.nome;
                          return (
                            <TouchableOpacity
                              key={item.id}
                              style={[s.optionItem, ativo && s.optionItemAtivo]}
                              onPress={() => {
                                setFItemNome(item.nome);
                                setBuscaItem(item.nome);
                              }}
                            >
                              <Text style={[s.optionTitle, ativo && s.optionTextAtivo]}>{item.nome}</Text>
                              {item.detalhe ? <Text style={[s.optionSub, ativo && s.optionTextAtivo]}>{item.detalhe}</Text> : null}
                            </TouchableOpacity>
                          );
                        })}
                        {!!buscaItem.trim() && itensFormativosFiltrados.length === 0 ? (
                          <Text style={s.optionEmpty}>Nenhuma opção encontrada.</Text>
                        ) : null}
                      </View>
                    </>
                  ) : null}

                  <TouchableOpacity
                    style={[s.avancarBtn, !podeAvancarCadastro && s.avancarBtnDisabled]}
                    disabled={!podeAvancarCadastro}
                    onPress={avancarCadastroPlano}
                  >
                    <Text style={[s.avancarBtnText, !podeAvancarCadastro && s.avancarBtnTextDisabled]}>Avançar</Text>
                    <Ionicons name="arrow-forward" size={18} color={podeAvancarCadastro ? '#fff' : '#9eabb7'} />
                  </TouchableOpacity>
                </View>
              )}

              {editando && !modoCadastroBloco && (
                <>
                  <Text style={s.label}>Título *</Text>
                  <TextInput style={s.input} value={fTitulo} onChangeText={setFTitulo} placeholder="Título da atividade" autoFocus />

                  <Text style={s.label}>Descrição</Text>
                  <TextInput style={[s.input, s.textArea]} value={fDesc} onChangeText={setFDesc} placeholder="Descrição" multiline />
                </>
              )}

              {editando && (
                <>
              <Text style={s.label}>Especialidade ou classe vinculada</Text>
              <View style={s.chipRow}>
                {([
                  { key: null, label: 'Nenhuma' },
                  { key: 'especialidade' as const, label: 'Especialidade' },
                  { key: 'classe' as const, label: 'Classe' },
                ]).map((op) => (
                  <TouchableOpacity
                    key={op.label}
                    style={[s.chip, fItemTipo === op.key && s.chipAtivo]}
                    onPress={() => {
                      setFItemTipo(op.key);
                      if (!op.key) setFItemNome('');
                      setBuscaItem('');
                      setFPlanoId(null);
                      setFNovoPlano(false);
                      setFPlanoTitulo('');
                      setFAvaliacoesNecessarias('1');
                      setFAtividadesPlano([]);
                    }}
                  >
                    <Text style={[s.chipText, fItemTipo === op.key && s.chipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {fItemTipo && (
                <>
                  <TextInput
                    style={s.input}
                    value={buscaItem}
                    onChangeText={(v) => {
                      setBuscaItem(v);
                      setFItemNome(v);
                      setFPlanoId(null);
                      setFNovoPlano(false);
                    }}
                    placeholder={fItemTipo === 'classe' ? 'Buscar classe...' : 'Buscar especialidade...'}
                  />
                  <View style={s.optionList}>
                    {itensFormativosFiltrados.map((item) => {
                      const ativo = fItemNome === item.nome;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[s.optionItem, ativo && s.optionItemAtivo]}
                          onPress={() => {
                            setFItemNome(item.nome);
                            setBuscaItem(item.nome);
                            setFPlanoId(null);
                            setFNovoPlano(true);
                            setFPlanoTitulo(`${item.nome} - ${new Date().getFullYear()}`);
                            setFAvaliacoesNecessarias('1');
                            prepararAtividadesPlano(null, 1, {
                              titulo: fTitulo,
                              descricao: fDesc,
                              data: fData,
                              destino: fDestino,
                              unidades: fUnidades,
                              dbvs: fDbvs,
                              avaliador: fAvaliador,
                              anexosPend,
                            });
                          }}
                        >
                          <Text style={[s.optionTitle, ativo && s.optionTextAtivo]}>{item.nome}</Text>
                          {item.detalhe ? <Text style={[s.optionSub, ativo && s.optionTextAtivo]}>{item.detalhe}</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                    {itensFormativosFiltrados.length === 0 && (
                      <Text style={s.optionEmpty}>Nenhum item encontrado. Você pode digitar o nome manualmente.</Text>
                    )}
                  </View>
                  {!!fItemNome.trim() && (
                    <View style={s.planoBox}>
                      <Text style={s.label}>Plano avaliativo</Text>
                      <Text style={s.planoAjuda}>
                        Defina quantas atividades aprovadas o membro precisa cumprir para receber este item.
                      </Text>
                      <TouchableOpacity
                        style={[s.optionItem, !fPlanoId && !fNovoPlano && s.optionItemAtivo]}
                        onPress={() => {
                          setFPlanoId(null);
                          setFNovoPlano(false);
                          setFAtividadesPlano([]);
                        }}
                      >
                        <Text style={[s.optionTitle, !fPlanoId && !fNovoPlano && s.optionTextAtivo]}>Atividade avulsa</Text>
                        <Text style={[s.optionSub, !fPlanoId && !fNovoPlano && s.optionTextAtivo]}>
                          Libera o item quando esta unica avaliacao for aprovada.
                        </Text>
                      </TouchableOpacity>
                      {planosCompativeis.map((plano) => (
                        <TouchableOpacity
                          key={plano.id}
                          style={[s.optionItem, fPlanoId === plano.id && !fNovoPlano && s.optionItemAtivo]}
                          onPress={() => {
                            setFPlanoId(plano.id);
                            setFNovoPlano(false);
                            setFPlanoTitulo(plano.titulo);
                            setFAvaliacoesNecessarias(String(plano.avaliacoes_necessarias));
                            prepararAtividadesPlano(plano.id, plano.avaliacoes_necessarias);
                          }}
                        >
                          <Text style={[s.optionTitle, fPlanoId === plano.id && !fNovoPlano && s.optionTextAtivo]}>{plano.titulo}</Text>
                          <Text style={[s.optionSub, fPlanoId === plano.id && !fNovoPlano && s.optionTextAtivo]}>
                            Exige {plano.avaliacoes_necessarias} atividade(s) aprovada(s)
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[s.optionItem, fNovoPlano && s.optionItemAtivo]}
                        onPress={() => {
                          setFNovoPlano(true);
                          setFPlanoId(null);
                          setFPlanoTitulo((prev) => prev || `${fItemNome.trim()} - ${new Date().getFullYear()}`);
                          prepararAtividadesPlano(null, Math.max(1, Number(fAvaliacoesNecessarias) || 1), {
                            titulo: fTitulo,
                            descricao: fDesc,
                            data: fData,
                            destino: fDestino,
                            unidades: fUnidades,
                            dbvs: fDbvs,
                            avaliador: fAvaliador,
                            anexosPend,
                          });
                        }}
                      >
                        <Text style={[s.optionTitle, fNovoPlano && s.optionTextAtivo]}>+ Criar novo plano avaliativo</Text>
                        <Text style={[s.optionSub, fNovoPlano && s.optionTextAtivo]}>Permite cadastrar as avaliações aos poucos.</Text>
                      </TouchableOpacity>
                      {(fNovoPlano || fPlanoId) && (
                        <>
                          <Text style={s.label}>Nome do plano</Text>
                          <TextInput style={s.input} value={fPlanoTitulo} onChangeText={setFPlanoTitulo} placeholder="Ex.: Computação IV - Investidura 2026" />
                          <Text style={s.label}>Quantidade de atividades avaliativas exigidas</Text>
                          <TextInput
                            style={s.input}
                            value={fAvaliacoesNecessarias}
                            onChangeText={atualizarQuantidadePlano}
                            keyboardType="number-pad"
                            placeholder="Ex.: 4"
                          />
                        </>
                      )}
                      {!fNovoPlano && !fPlanoId && (
                        <Text style={s.planoAviso}>Sem plano: esta atividade sozinha libera o item quando aprovada.</Text>
                      )}
                    </View>
                  )}
                </>
              )}
                </>
              )}

              {modoCadastroBloco && (
                <>
                  {!editando && (
                    <View style={s.resumoPlano}>
                      <View style={s.resumoPlanoTopo}>
                        <TouchableOpacity style={s.resumoVoltar} onPress={() => setEtapaCadastro(1)}>
                          <Ionicons name="arrow-back" size={16} color="#1a3a5c" />
                          <Text style={s.resumoVoltarText}>Voltar</Text>
                        </TouchableOpacity>
                        <Text style={s.etapaTexto}>Etapa 2 de 2</Text>
                      </View>
                      <Text style={s.resumoPlanoTitulo}>{fItemNome}</Text>
                      <Text style={s.resumoPlanoTexto}>
                        {fItemTipo === 'classe' ? 'Classe' : 'Especialidade'} - {quantidadePlanoFormulario} atividade(s)
                      </Text>
                    </View>
                  )}
                  {!editando && (
                    <Text style={s.blocoAjuda}>
                      Preencha agora somente as avaliações que já estiverem definidas. As demais permanecerão vazias para edição posterior.
                    </Text>
                  )}
                  {fAtividadesPlano.map((slot, indice) => (
                    <View key={`slot-${indice}`} style={[s.blocoFormItem, paletaAtividade.cores[indice % paletaAtividade.cores.length]]}>
                      <View style={s.blocoFormHeader}>
                        <Text style={[s.blocoFormNumero, { color: paletaAtividade.cores[indice % paletaAtividade.cores.length].accentColor }]}>Atividade {indice + 1}/{quantidadePlanoFormulario}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          {slot.atividade ? <Text style={s.blocoSalvaBadge}>Cadastrada</Text> : null}
                          {editando && fAtividadesPlano.length > 1 && (
                            <TouchableOpacity onPress={() => removerSlotDoBloco(indice)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="trash-outline" size={18} color="#c62828" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <Text style={[s.label, tituloPlanoEmErro && indice === indiceTituloObrigatorio && s.labelErro]}>
                        Título{indice === indiceTituloObrigatorio ? ' *' : ''}
                      </Text>
                      <TextInput
                        ref={(ref) => { tituloPlanoRefs.current[indice] = ref; }}
                        style={[s.input, tituloPlanoEmErro && indice === indiceTituloObrigatorio && s.inputErro]}
                        value={slot.titulo}
                        autoFocus={indice === indiceTituloObrigatorio && !temTituloNoPlano()}
                        onChangeText={(titulo) => {
                          atualizarSlotPlano(indice, { titulo });
                          if (titulo.trim()) setTituloPlanoEmErro(false);
                        }}
                        onBlur={() => {
                          if (indice === indiceTituloObrigatorio && !temTituloNoPlano()) exigirTituloNoPlano();
                        }}
                        placeholder={tituloPlanoEmErro && indice === indiceTituloObrigatorio
                          ? 'É necessário preencher o campo título'
                          : slot.atividade ? 'Título da atividade' : indice === indiceTituloObrigatorio
                            ? 'Título obrigatório da atividade'
                            : 'Deixe em branco para cadastrar depois'}
                        placeholderTextColor={tituloPlanoEmErro && indice === indiceTituloObrigatorio ? '#c62828' : undefined}
                      />
                      <Text style={s.label}>Descrição</Text>
                      <TextInput
                        style={[s.input, s.textArea]}
                        value={slot.descricao}
                        onChangeText={(descricao) => atualizarSlotPlano(indice, { descricao })}
                        onPressIn={() => { exigirTituloNoPlano(); }}
                        onFocus={() => { exigirTituloNoPlano(); }}
                        placeholder="Descrição da avaliação"
                        multiline
                      />
                      <View style={s.labelComRepeticao}>
                        <Text style={s.label}>Prazo de entrega</Text>
                        {quantidadePlanoFormulario > 1 && (blocoPaiPrazo === null || blocoPaiPrazo === indice) ? (
                          <TouchableOpacity style={s.repetirCampo} onPress={() => { if (exigirTituloNoPlano()) configurarRepeticaoPrazo(indice); }}>
                            <Ionicons name={blocoPaiPrazo === indice ? 'checkbox' : 'square-outline'} size={18} color={blocoPaiPrazo === indice ? '#1a3a5c' : '#7b8794'} />
                            <Text style={s.repetirTexto}>Repetir para todos os blocos</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <View
                        pointerEvents={blocoPaiPrazo !== null && blocoPaiPrazo !== indice ? 'none' : 'auto'}
                        style={blocoPaiPrazo !== null && blocoPaiPrazo !== indice ? s.campoHerdado : undefined}
                      >
                        <DateField
                          value={slot.data}
                          onChange={(data) => atualizarSlotComRepeticao(indice, { data }, 'prazo')}
                          onPress={() => exigirTituloNoPlano()}
                          placeholder="Selecionar data"
                          minimumDate={new Date(2026, 0, 1)}
                          maximumDate={new Date(2035, 11, 31)}
                        />
                      </View>
                      {blocoPaiPrazo !== null && blocoPaiPrazo !== indice ? <Text style={s.herdadoTexto}>Herdado da Atividade {blocoPaiPrazo + 1}</Text> : null}
                      <View style={s.labelComRepeticao}>
                        <Text style={s.label}>Destino</Text>
                        {quantidadePlanoFormulario > 1 && (blocoPaiDestino === null || blocoPaiDestino === indice) ? (
                          <TouchableOpacity style={s.repetirCampo} onPress={() => { if (exigirTituloNoPlano()) configurarRepeticaoDestino(indice); }}>
                            <Ionicons name={blocoPaiDestino === indice ? 'checkbox' : 'square-outline'} size={18} color={blocoPaiDestino === indice ? '#1a3a5c' : '#7b8794'} />
                            <Text style={s.repetirTexto}>Repetir para todos os blocos</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <View
                        pointerEvents={blocoPaiDestino !== null && blocoPaiDestino !== indice ? 'none' : 'auto'}
                        style={blocoPaiDestino !== null && blocoPaiDestino !== indice ? s.campoHerdado : undefined}
                      >
                      <View style={s.chipRow}>
                        {(['todos', 'unidade', 'desbravador'] as const).map((destino) => (
                          <TouchableOpacity
                            key={destino}
                            style={[s.chip, slot.destino === destino && s.chipAtivo]}
                            onPress={() => { if (!exigirTituloNoPlano()) return; atualizarSlotComRepeticao(indice, {
                              destino,
                              unidades: [],
                              dbvs: destino === 'todos' ? dbvs : [],
                              buscaUnidade: '',
                              buscaDbv: '',
                            }, 'destino'); }}
                          >
                            <Text style={[s.chipText, slot.destino === destino && s.chipTextAtivo]}>
                              {destino === 'todos' ? 'Todos' : destino === 'unidade' ? 'Unidades' : 'Membros'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {slot.destino === 'unidade' ? (
                        <>
                          <Text style={s.label}>Unidades selecionadas ({slot.unidades.length})</Text>
                          {slot.unidades.length > 0 ? (
                            <View style={s.resumoDestino}>
                              <Text style={s.resumoDestinoTitulo}>Participarão as unidades:</Text>
                              <View style={s.selectedWrap}>
                                {slot.unidades.map((unidade) => (
                                  <TouchableOpacity
                                    key={unidade.id}
                                    style={s.selectedChip}
                                    onPress={() => atualizarSlotComRepeticao(indice, { unidades: slot.unidades.filter((item) => item.id !== unidade.id) }, 'destino')}
                                  >
                                    <Text style={s.selectedChipText}>{unidade.nome} ×</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          ) : null}
                          <TextInput
                            style={s.input}
                            value={slot.buscaUnidade}
                            onChangeText={(buscaUnidade) => atualizarSlotPlano(indice, { buscaUnidade })}
                            onPressIn={() => { exigirTituloNoPlano(); }}
                            onFocus={() => { exigirTituloNoPlano(); }}
                            placeholder="Buscar unidade cadastrada"
                          />
                          <View style={s.optionList}>
                          {unidadesDoSlot(slot).map((unidade) => {
                            const selecionada = slot.unidades.some((u) => u.id === unidade.id);
                            return (
                              <TouchableOpacity
                                key={unidade.id}
                                style={[s.optionItem, selecionada && s.optionItemAtivo]}
                                onPress={() => atualizarSlotComRepeticao(indice, {
                                  unidades: selecionada
                                    ? slot.unidades.filter((u) => u.id !== unidade.id)
                                    : [...slot.unidades, unidade],
                                }, 'destino')}
                              >
                                <Text style={[s.optionTitle, selecionada && s.optionTextAtivo]}>{selecionada ? '✓ ' : ''}{unidade.nome}</Text>
                                <Text style={[s.optionSub, selecionada && s.optionTextAtivo]}>Unidade cadastrada do clube</Text>
                              </TouchableOpacity>
                            );
                          })}
                          {unidadesDoSlot(slot).length === 0 && <Text style={s.optionEmpty}>Nenhuma unidade encontrada.</Text>}
                          </View>
                        </>
                      ) : null}
                      {(slot.destino === 'todos' || slot.destino === 'desbravador') ? (
                        <>
                          <Text style={s.label}>Participantes selecionados ({slot.dbvs.length})</Text>
                          {slot.destino === 'todos' ? (
                            <Text style={s.planoAviso}>Todos os membros, incluindo a Diretoria. Desmarque apenas quem não deverá participar.</Text>
                          ) : null}
                          {slot.destino === 'todos' && dbvsExcluidosDoSlot(slot).length > 0 ? (
                            <View style={s.resumoDestino}>
                              <Text style={s.resumoDestinoTitulo}>Não farão parte desta atividade:</Text>
                              <View style={s.selectedWrap}>
                                {dbvsExcluidosDoSlot(slot).map((dbv) => (
                                  <Text key={dbv.id} style={s.excluidoChip}>{dbv.nome}</Text>
                                ))}
                              </View>
                            </View>
                          ) : null}
                          {slot.destino === 'desbravador' && slot.dbvs.length > 0 ? (
                            <View style={s.resumoDestino}>
                              <Text style={s.resumoDestinoTitulo}>Membros selecionados:</Text>
                              <View style={s.selectedWrap}>
                                {slot.dbvs.map((dbv) => (
                                  <TouchableOpacity
                                    key={dbv.id}
                                    style={s.selectedChip}
                                    onPress={() => atualizarSlotComRepeticao(indice, { dbvs: slot.dbvs.filter((item) => item.id !== dbv.id) }, 'destino')}
                                  >
                                    <Text style={s.selectedChipText}>{dbv.nome} ×</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          ) : null}
                          <TextInput
                            style={s.input}
                            value={slot.buscaDbv}
                            onChangeText={(buscaDbv) => atualizarSlotPlano(indice, { buscaDbv })}
                            onPressIn={() => { exigirTituloNoPlano(); }}
                            onFocus={() => { exigirTituloNoPlano(); }}
                            placeholder="Buscar membro por nome ou unidade"
                          />
                          {!!slot.buscaDbv.trim() && (
                            <View style={s.optionList}>
                            {dbvsDoSlot(slot).slice(0, 50).map((dbv) => {
                              const selecionado = slot.dbvs.some((item) => item.id === dbv.id);
                              return (
                                <TouchableOpacity
                                  key={dbv.id}
                                  style={[s.optionItem, selecionado && s.optionItemAtivo]}
                                  onPress={() => atualizarSlotComRepeticao(indice, {
                                    dbvs: selecionado
                                      ? slot.dbvs.filter((item) => item.id !== dbv.id)
                                      : [...slot.dbvs, dbv],
                                  }, 'destino')}
                                >
                                  <Text style={[s.optionTitle, selecionado && s.optionTextAtivo]}>{selecionado ? '✓ ' : ''}{dbv.nome}</Text>
                                  <Text style={[s.optionSub, selecionado && s.optionTextAtivo]}>{dbv.unidade_nome ?? 'Sem unidade'}</Text>
                                </TouchableOpacity>
                              );
                            })}
                            {dbvsDoSlot(slot).length === 0 && <Text style={s.optionEmpty}>Nenhum membro encontrado.</Text>}
                            {dbvsDoSlot(slot).length > 50 && <Text style={s.optionEmpty}>Digite parte do nome para refinar a lista.</Text>}
                            </View>
                          )}
                        </>
                      ) : null}
                      </View>
                      {blocoPaiDestino !== null && blocoPaiDestino !== indice ? <Text style={s.herdadoTexto}>Herdado da Atividade {blocoPaiDestino + 1}</Text> : null}
                      <View style={s.labelComRepeticao}>
                        <Text style={s.label}>Avaliador</Text>
                        {quantidadePlanoFormulario > 1 && (blocoPaiAvaliador === null || blocoPaiAvaliador === indice) ? (
                          <TouchableOpacity style={s.repetirCampo} onPress={() => { if (exigirTituloNoPlano()) configurarRepeticaoAvaliador(indice); }}>
                            <Ionicons name={blocoPaiAvaliador === indice ? 'checkbox' : 'square-outline'} size={18} color={blocoPaiAvaliador === indice ? '#1a3a5c' : '#7b8794'} />
                            <Text style={s.repetirTexto}>Repetir para todos os blocos</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <View
                        pointerEvents={blocoPaiAvaliador !== null && blocoPaiAvaliador !== indice ? 'none' : 'auto'}
                        style={blocoPaiAvaliador !== null && blocoPaiAvaliador !== indice ? s.campoHerdado : undefined}
                      >
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.blocoOpcoesScroll}>
                        <TouchableOpacity style={[s.chip, !slot.avaliador && s.chipAtivo]} onPress={() => { if (exigirTituloNoPlano()) atualizarSlotComRepeticao(indice, { avaliador: null }, 'avaliador'); }}>
                          <Text style={[s.chipText, !slot.avaliador && s.chipTextAtivo]}>Sem avaliador fixo</Text>
                        </TouchableOpacity>
                        {diretoria.map((diretor) => (
                          <TouchableOpacity
                            key={`${diretor.id}-${diretor.perfil}`}
                            style={[s.chip, slot.avaliador?.id === diretor.id && s.chipAtivo]}
                            onPress={() => { if (exigirTituloNoPlano()) atualizarSlotComRepeticao(indice, { avaliador: diretor }, 'avaliador'); }}
                          >
                            <Text style={[s.chipText, slot.avaliador?.id === diretor.id && s.chipTextAtivo]}>{diretor.nome}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      </View>
                      {blocoPaiAvaliador !== null && blocoPaiAvaliador !== indice ? <Text style={s.herdadoTexto}>Herdado da Atividade {blocoPaiAvaliador + 1}</Text> : null}
                      <Text style={s.label}>Anexos ({slot.anexosPend.length}/5)</Text>
                      {slot.anexosPend.map((anexo, anexoIndex) => (
                        <View key={`${anexo.nome}-${anexoIndex}`} style={s.anexoPendItem}>
                          <Text style={s.anexoPendNome} numberOfLines={1}>{anexo.nome}</Text>
                          {anexo.enviando ? <ActivityIndicator size="small" color="#1a3a5c" /> : anexo.erro ? <Text style={s.anexoErro}>Falhou</Text> : <Text style={s.anexoEnviado}>Enviado</Text>}
                          <TouchableOpacity onPress={() => void removerAnexoPendente(
                            anexo,
                            () => atualizarSlotPlano(indice, { anexosPend: slot.anexosPend.filter((_, i) => i !== anexoIndex) })
                          )}>
                            <Ionicons name="close-circle" size={20} color="#c62828" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity style={s.addAnexoBtn} onPress={() => { if (exigirTituloNoPlano()) escolherAnexoPlano(indice); }}>
                        <Ionicons name="attach" size={18} color="#1a3a5c" />
                        <Text style={s.addAnexoText}>Adicionar imagem, PDF ou Word</Text>
                      </TouchableOpacity>
                      {slot.atividade && (anexosMap[slot.atividade.id] ?? []).length > 0 ? (
                        <>
                          <Text style={s.label}>Arquivos já anexados</Text>
                          {(anexosMap[slot.atividade.id] ?? []).map((anexo) => (
                            <View key={anexo.id} style={s.anexoPendItem}>
                              <TouchableOpacity style={s.anexoAbrirArea} onPress={() => abrirAnexo(anexo)}>
                              <Text style={s.anexoPendNome} numberOfLines={1}>{anexo.nome}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => void excluirAnexoSalvo(slot.atividade!.id, anexo)}>
                                <Ionicons name="trash-outline" size={20} color="#c62828" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </>
                      ) : null}
                    </View>
                  ))}
                  {editando && (
                    <TouchableOpacity style={s.adicionarSlotBtn} onPress={adicionarSlotAoBloco}>
                      <Ionicons name="add-circle-outline" size={20} color="#1a3a5c" />
                      <Text style={s.adicionarSlotText}>Adicionar atividade ao bloco</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {editando && !modoCadastroBloco && (
                <>
              <Text style={s.label}>Prazo de entrega</Text>
              <DateField value={fData} onChange={setFData} placeholder="Selecionar data" minimumDate={new Date(2026, 0, 1)} maximumDate={new Date(2035, 11, 31)} />

              <Text style={s.label}>Destino</Text>
              <View style={s.chipRow}>
                {(['todos', 'unidade', 'desbravador'] as const).map(d => (
                  <TouchableOpacity key={d} style={[s.chip, fDestino === d && s.chipAtivo]}
                    onPress={() => { setFDestino(d); setFUnidades([]); setFDbvs(d === 'todos' ? dbvs : []); setBuscaDbv(''); setBuscaUnidade(''); }}>
                    <Text style={[s.chipText, fDestino === d && s.chipTextAtivo]}>
                      {d === 'todos' ? 'Todos' : d === 'unidade' ? 'Unidades' : 'Membros'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {fDestino === 'unidade' && (
                <>
                  <Text style={s.label}>Unidades ({fUnidades.length})</Text>
                  {fUnidades.length > 0 ? (
                    <View style={s.resumoDestino}>
                      <Text style={s.resumoDestinoTitulo}>Participarão as unidades:</Text>
                      <View style={s.selectedWrap}>
                        {fUnidades.map(u => (
                          <TouchableOpacity key={u.id} style={s.selectedChip} onPress={() => toggleUnidade(u)}>
                            <Text style={s.selectedChipText}>{u.nome} ×</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  <TextInput style={s.input} value={buscaUnidade} onChangeText={setBuscaUnidade} placeholder="Buscar unidade cadastrada" />
                  <View style={s.optionList}>
                    {unidadesFiltradas.map(u => {
                      const ativo = fUnidades.some(x => x.id === u.id);
                      return (
                        <TouchableOpacity key={u.id} style={[s.optionItem, ativo && s.optionItemAtivo]} onPress={() => toggleUnidade(u)}>
                          <Text style={[s.optionTitle, ativo && s.optionTextAtivo]}>{ativo ? '✓ ' : ''}{u.nome}</Text>
                          <Text style={[s.optionSub, ativo && s.optionTextAtivo]}>Unidade cadastrada do clube</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {unidadesFiltradas.length === 0 && (
                      <Text style={s.optionEmpty}>Nenhuma unidade encontrada.</Text>
                    )}
                  </View>
                </>
              )}

              {(fDestino === 'todos' || fDestino === 'desbravador') && (
                <>
                  <Text style={s.label}>Participantes selecionados ({fDbvs.length})</Text>
                  {fDestino === 'todos' && (
                    <Text style={s.planoAviso}>Todos os membros, incluindo a Diretoria. Desmarque apenas quem não deverá participar.</Text>
                  )}
                  {fDestino === 'todos' && dbvsExcluidosTodos.length > 0 ? (
                    <View style={s.resumoDestino}>
                      <Text style={s.resumoDestinoTitulo}>Não farão parte desta atividade:</Text>
                      <View style={s.selectedWrap}>
                        {dbvsExcluidosTodos.map((dbv) => (
                          <Text key={dbv.id} style={s.excluidoChip}>{dbv.nome}</Text>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {fDestino === 'desbravador' && fDbvs.length > 0 ? (
                    <View style={s.resumoDestino}>
                      <Text style={s.resumoDestinoTitulo}>Membros selecionados:</Text>
                      <View style={s.selectedWrap}>
                        {fDbvs.map((dbv) => (
                          <TouchableOpacity key={dbv.id} style={s.selectedChip} onPress={() => toggleDbv(dbv)}>
                            <Text style={s.selectedChipText}>{dbv.nome} ×</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  <TextInput style={s.input} value={buscaDbv} onChangeText={setBuscaDbv} placeholder="Buscar membro por nome ou unidade" />
                  {!!buscaDbv.trim() && (
                    <View style={s.optionList}>
                      {dbvsFiltrados.slice(0, 50).map(d => {
                        const ativo = fDbvs.some(x => x.id === d.id);
                        return (
                          <TouchableOpacity key={d.id} style={[s.optionItem, ativo && s.optionItemAtivo]} onPress={() => toggleDbv(d)}>
                            <Text style={[s.optionTitle, ativo && s.optionTextAtivo]}>{ativo ? '✓ ' : ''}{d.nome}</Text>
                            <Text style={[s.optionSub, ativo && s.optionTextAtivo]}>{d.unidade_nome ?? 'Sem unidade'}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      {dbvsFiltrados.length === 0 && (
                        <Text style={s.optionEmpty}>Nenhum membro encontrado.</Text>
                      )}
                      {dbvsFiltrados.length > 50 && (
                        <Text style={s.optionEmpty}>Mostrando 50 primeiros. Use a busca para refinar.</Text>
                      )}
                    </View>
                  )}
                </>
              )}

              <Text style={s.label}>Avaliador da diretoria</Text>
              <View style={s.chipRow}>
                <TouchableOpacity style={[s.chip, !fAvaliador && s.chipAtivo]} onPress={() => setFAvaliador(null)}>
                  <Text style={[s.chipText, !fAvaliador && s.chipTextAtivo]}>Sem avaliador fixo</Text>
                </TouchableOpacity>
                {diretoria.map(d => (
                  <TouchableOpacity key={`${d.id}-${d.perfil}`} style={[s.chip, fAvaliador?.id === d.id && s.chipAtivo]} onPress={() => setFAvaliador(d)}>
                    <Text style={[s.chipText, fAvaliador?.id === d.id && s.chipTextAtivo]}>{d.nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Anexos ({anexosPend.length}/5)</Text>
              {anexosPend.map((ap, i) => (
                <View key={`${ap.nome}-${i}`} style={s.anexoPendItem}>
                  {ap.tipo === 'image'
                    ? <Image source={{ uri: ap.uri }} style={s.anexoPendThumb} />
                    : <Ionicons name={tipoIcon(ap.tipo).name} size={22} color={tipoIcon(ap.tipo).color} />}
                  <Text style={s.anexoPendNome} numberOfLines={1}>{ap.nome}</Text>
                  {ap.enviando ? <ActivityIndicator size="small" color="#1a3a5c" /> : ap.erro ? <Text style={s.anexoErro}>Falhou</Text> : <Text style={s.anexoEnviado}>Enviado</Text>}
                  <TouchableOpacity onPress={() => void removerAnexoPendente(ap, () => setAnexosPend(p => p.filter((_, j) => j !== i)))}>
                    <Ionicons name="close-circle" size={20} color="#c62828" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addAnexoBtn} onPress={escolherAnexo}>
                <Ionicons name="attach" size={18} color="#1a3a5c" />
                <Text style={s.addAnexoText}>Adicionar imagem, PDF ou Word</Text>
              </TouchableOpacity>

              {editando && (anexosMap[editando.id] ?? []).length > 0 && (
                <>
                  <Text style={s.label}>Arquivos já anexados</Text>
                  {(anexosMap[editando.id] ?? []).map(x => (
                    <View key={x.id} style={s.anexoPendItem}>
                      <TouchableOpacity style={s.anexoAbrirArea} onPress={() => abrirAnexo(x)}>
                      {x.tipo === 'image'
                        ? <Image source={{ uri: x.url }} style={s.anexoPendThumb} />
                        : <Ionicons name={tipoIcon(x.tipo).name} size={22} color={tipoIcon(x.tipo).color} />}
                      <Text style={s.anexoPendNome} numberOfLines={1}>{x.nome}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => void excluirAnexoSalvo(editando.id, x)}>
                        <Ionicons name="trash-outline" size={20} color="#c62828" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
                </>
              )}
              <View style={{ height: 36 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalResp} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalResp(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalResp(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={s.modalTitulo} numberOfLines={1}>{respEditandoExistente ? 'Editar resposta' : 'Responder atividade'}</Text>
              <TouchableOpacity onPress={enviarResposta} disabled={enviandoResp}>
                {enviandoResp ? <ActivityIndicator size="small" color="#1a3a5c" /> : <Text style={s.modalSalvar}>Enviar</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              {respAtiv ? <Text style={s.modalSubtitulo}>{respAtiv.titulo}</Text> : null}
              {respMembroNome ? (
                <View style={s.respondendoComoBox}>
                  <Ionicons name="person-circle-outline" size={15} color="#1a3a5c" />
                  <Text style={s.respondendoComoText}>Respondendo por {respMembroNome}</Text>
                </View>
              ) : null}
              <Text style={s.label}>Resposta</Text>
              <TextInput style={[s.input, s.textAreaLarge]} value={respTexto} onChangeText={setRespTexto} placeholder="Escreva sua resposta..." multiline autoFocus />
              {rascunhoRespSalvoEm ? (
                <View style={s.rascunhoBox}>
                  <Ionicons name="save-outline" size={14} color="#607d8b" />
                  <Text style={s.rascunhoText}>Rascunho salvo automaticamente</Text>
                </View>
              ) : null}

              {/* Anexo já salvo — só mostra quando editando entregue (não ao refazer) */}
              {respEditandoExistente?.anexo_url && !respAnexo && !respAnexoExistenteRemovido ? (
                <View style={s.anexoPendItem}>
                  <Ionicons name={tipoIcon(tipoAnexo(respEditandoExistente.anexo_nome ?? '')).name} size={22} color={tipoIcon(tipoAnexo(respEditandoExistente.anexo_nome ?? '')).color} />
                  <Text style={s.anexoPendNome} numberOfLines={1}>{respEditandoExistente.anexo_nome ?? 'Arquivo'}</Text>
                  <Text style={s.anexoEnviado}>Salvo</Text>
                  <TouchableOpacity onPress={() => abrirAnexo({ url: respEditandoExistente.anexo_url!, nome: respEditandoExistente.anexo_nome })}>
                    <Ionicons name="eye-outline" size={18} color="#1a3a5c" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setRespAnexoExistenteRemovido(true)}>
                    <Ionicons name="close-circle" size={20} color="#c62828" />
                  </TouchableOpacity>
                </View>
              ) : respAnexoExistenteRemovido && respEditandoExistente?.status === 'entregue' ? (
                <View style={[s.rascunhoBox, { backgroundColor: '#fff3e0' }]}>
                  <Ionicons name="warning-outline" size={14} color="#ef6c00" />
                  <Text style={[s.rascunhoText, { color: '#ef6c00' }]}>Anexo anterior será removido ao salvar</Text>
                  <TouchableOpacity onPress={() => setRespAnexoExistenteRemovido(false)}>
                    <Text style={[s.rascunhoText, { color: '#1a3a5c', textDecorationLine: 'underline' }]}>Desfazer</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <Text style={s.label}>{respEditandoExistente?.anexo_url && !respAnexo && !respAnexoExistenteRemovido ? 'Substituir anexo (opcional)' : 'Anexo opcional'}</Text>
              {respAnexo ? (
                <View style={s.anexoPendItem}>
                  {respAnexo.tipo === 'image'
                    ? <Image source={{ uri: respAnexo.url ?? respAnexo.uri }} style={s.anexoPendThumb} />
                    : <Ionicons name={tipoIcon(respAnexo.tipo).name} size={22} color={tipoIcon(respAnexo.tipo).color} />}
                  <Text style={s.anexoPendNome} numberOfLines={1}>{respAnexo.nome}</Text>
                  {respAnexo.enviando ? <ActivityIndicator size="small" color="#1a3a5c" /> : respAnexo.erro ? <Text style={s.anexoErro}>Falhou</Text> : respAnexo.url ? <Text style={s.anexoEnviado}>Enviado</Text> : null}
                  <TouchableOpacity onPress={removerAnexoResposta}>
                    <Ionicons name="close-circle" size={20} color="#c62828" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.addAnexoBtn} onPress={escolherAnexoResposta}>
                  <Ionicons name="attach" size={18} color="#1a3a5c" />
                  <Text style={s.addAnexoText}>Anexar arquivo ou imagem</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalDetalhes} animationType={Platform.OS === 'web' ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={fecharDetalhes}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={fecharDetalhes}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
            <Text style={s.modalTitulo} numberOfLines={1}>{detalheAtiv?.titulo ?? 'Atividade'}</Text>
            <View style={{ width: 34 }} />
          </View>
          {isAdmin ? (
            <ScrollView contentContainerStyle={s.modalScroll}>
              {detalheAtiv && (
                <>
                  <Text style={s.detalheTitulo}>{detalheAtiv.titulo}</Text>
                  {detalheAtiv.data ? <Text style={s.cardData}>Prazo: {fmt(detalheAtiv.data)}</Text> : null}
                  <View style={[s.badgeRow, { marginTop: 10 }]}>
                    <View style={s.badge}><Text style={s.badgeText}>{alvoTexto(detalheAtiv)}</Text></View>
                    {detalheAtiv.item_formativo_tipo && detalheAtiv.item_formativo_nome ? (
                      <View style={[s.badge, s.badgeFormativo]}>
                        <Text style={s.badgeText}>
                          {detalheAtiv.item_formativo_tipo === 'classe' ? 'Classe' : 'Especialidade'}: {detalheAtiv.item_formativo_nome}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {detalheAtiv.descricao ? (
                    <>
                      <Text style={s.label}>Descrição</Text>
                      <Text style={s.detalheTexto}>{detalheAtiv.descricao}</Text>
                    </>
                  ) : null}
                  <Text style={s.label}>Anexos da atividade</Text>
                  {chatDetalheAnexos.length === 0 ? (
                    <Text style={s.optionEmpty}>Nenhum anexo cadastrado.</Text>
                  ) : chatDetalheAnexos.map((x) => (
                    <View key={x.id} style={s.anexoDetalheItem}>
                      <TouchableOpacity style={s.anexoDetalheInfo} onPress={() => abrirAnexo(x)}>
                        {x.tipo === 'image'
                          ? <Image source={{ uri: x.url }} style={s.anexoPendThumb} />
                          : <Ionicons name={tipoIcon(x.tipo).name} size={22} color={tipoIcon(x.tipo).color} />}
                        <Text style={s.anexoPendNome} numberOfLines={1}>{x.nome}</Text>
                      </TouchableOpacity>
                      <View style={s.anexoDetalheAcoes}>
                        <TouchableOpacity style={s.anexoAcaoBtn} onPress={() => abrirAnexo(x)}>
                          <Ionicons name="eye-outline" size={16} color="#1a3a5c" />
                          <Text style={s.anexoAcaoText}>Abrir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.anexoAcaoBtn} onPress={() => baixarAnexo(x)}>
                          <Ionicons name="download-outline" size={16} color="#1a3a5c" />
                          <Text style={s.anexoAcaoText}>Baixar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={s.chatScroll} style={{ backgroundColor: '#dde8f0' }}>
              {detalheAtiv && (
                <>
                  {/* Bubble 1 — Avaliador publica a atividade */}
                  <View style={s.chatRowLeft}>
                    <View style={s.chatAvatarLeft}>
                      <Ionicons name="school" size={18} color="#fff" />
                    </View>
                    <View style={s.chatBubbleLeft}>
                      <Text style={s.chatSenderName}>{detalheAtiv.avaliador_nome ?? 'Diretoria'}</Text>
                      <Text style={s.chatActivityTitle}>{detalheAtiv.titulo}</Text>
                      {detalheAtiv.data ? (
                        <View style={s.chatMetaRow}>
                          <Ionicons name="calendar-outline" size={12} color="#546e7a" />
                          <Text style={s.chatMetaText}>Prazo: {fmt(detalheAtiv.data)}</Text>
                        </View>
                      ) : null}
                      {detalheAtiv.item_formativo_tipo && detalheAtiv.item_formativo_nome ? (
                        <View style={s.chatTag}>
                          <Text style={s.chatTagText}>
                            {detalheAtiv.item_formativo_tipo === 'classe' ? 'Classe' : 'Especialidade'}: {detalheAtiv.item_formativo_nome}
                          </Text>
                        </View>
                      ) : null}
                      {detalheAtiv.descricao ? (
                        <Text style={s.chatBubbleText}>{detalheAtiv.descricao}</Text>
                      ) : null}
                      {chatDetalheAnexos.length > 0 && (
                        <View style={s.chatAnexosWrap}>
                          {chatDetalheAnexos.map(x => (
                            <TouchableOpacity key={x.id} style={s.chatAnexoChip} onPress={() => abrirAnexo(x)}>
                              {x.tipo === 'image'
                                ? <Image source={{ uri: x.url }} style={s.chatAnexoThumb} />
                                : <Ionicons name={tipoIcon(x.tipo).name} size={15} color={tipoIcon(x.tipo).color} />}
                              <Text style={s.chatAnexoNome} numberOfLines={1}>{x.nome}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <Text style={s.chatTimeText}>{fmt(detalheAtiv.created_at)}</Text>
                    </View>
                  </View>

                  {chatDetalheResp ? (
                    mensagensDaConversa(detalheAtiv, chatDetalheResp).map(renderMensagemChat)
                  ) : (
                    <View style={s.chatPendenteHint}>
                      <Ionicons name="time-outline" size={15} color="#e65100" />
                      <Text style={s.chatPendenteText}>Você ainda não respondeu esta atividade</Text>
                    </View>
                  )}

                  {/* Botão de ação */}
                  <View style={s.chatActions}>
                    {prazoEncerrado(detalheAtiv) ? (
                      <View style={s.prazoEncerradoBox}>
                        <Ionicons name="lock-closed-outline" size={15} color="#c62828" />
                        <Text style={s.prazoEncerradoText}>Prazo encerrado em {fmt(detalheAtiv.data)}</Text>
                      </View>
                    ) : chatDetalheSt === 'aprovada' ? (
                      <View style={[s.prazoEncerradoBox, { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' }]}>
                        <Ionicons name="checkmark-circle" size={15} color="#2e7d32" />
                        <Text style={[s.prazoEncerradoText, { color: '#2e7d32' }]}>Resposta aprovada — edição não permitida</Text>
                      </View>
                    ) : (chatDetalheSt === 'em_correcao' || chatDetalheSt === 'recusada') ? (
                      <TouchableOpacity
                        style={s.refazerBtn}
                        onPress={() => { setModalDetalhes(false); abrirResponder(detalheAtiv); }}
                      >
                        <Ionicons name="refresh" size={15} color="#fff" />
                        <Text style={s.refazerBtnText}>Refazer</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={s.responderBtn}
                        onPress={() => { setModalDetalhes(false); abrirResponder(detalheAtiv); }}
                      >
                        <Ionicons name="send-outline" size={15} color="#fff" />
                        <Text style={s.responderBtnText}>
                          {chatDetalheResp ? 'Editar resposta' : 'Responder'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
          <BottomNav onNavigate={() => setModalDetalhes(false)} />
        </View>
      </Modal>

      <Modal visible={modalProg} animationType={Platform.OS === 'web' ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={fecharProgresso}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={fecharProgresso}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
            <Text style={s.modalTitulo} numberOfLines={1}>{progAtiv?.titulo}</Text>
            <View style={{ width: 34 }} />
          </View>

          {loadingProg ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a3a5c" />
          ) : (
            <ScrollView contentContainerStyle={s.modalScroll}>
              <View style={s.progStats}>
                <View style={[s.progStat, { backgroundColor: '#e3f2fd' }]}>
                  <Text style={[s.progStatNum, { color: '#1565c0' }]}>{membrosStatus.filter(m => m.resposta?.status === 'entregue').length}</Text>
                  <Text style={s.progStatLabel}>A avaliar</Text>
                </View>
                <View style={[s.progStat, { backgroundColor: '#e8f5e9' }]}>
                  <Text style={[s.progStatNum, { color: '#2e7d32' }]}>{membrosStatus.filter(m => m.resposta && m.resposta.status !== 'em_correcao' && m.resposta.status !== 'recusada').length}</Text>
                  <Text style={s.progStatLabel}>Entregues</Text>
                </View>
                <View style={[s.progStat, { backgroundColor: '#fff3e0' }]}>
                  <Text style={[s.progStatNum, { color: '#e65100' }]}>{membrosStatus.filter(m => !m.resposta || m.resposta.status === 'em_correcao' || m.resposta.status === 'recusada').length}</Text>
                  <Text style={s.progStatLabel}>Pendentes</Text>
                </View>
                <View style={[s.progStat, { backgroundColor: '#e8f0fe' }]}>
                  <Text style={[s.progStatNum, { color: '#1a3a5c' }]}>{membrosStatus.filter(m => m.resposta?.status === 'aprovada').length}</Text>
                  <Text style={s.progStatLabel}>Aprovadas</Text>
                </View>
              </View>

              {membrosStatus.map(m => {
                const status = m.resposta?.status ?? (m.resposta ? 'entregue' : 'pendente');
                return (
                  <View key={m.id} style={s.progItem}>
                    <View style={[s.progDot, { backgroundColor: statusColor(status) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.progNome}>{m.nome}</Text>
                      {m.unidade_nome ? <Text style={s.progUnidade}>{m.unidade_nome}</Text> : null}
                      {m.resposta ? (
                        <>
                          <Text style={[s.progStatus, { color: statusColor(status) }]}>{statusLabel(status)}</Text>
                          {m.resposta.entregue_em || m.resposta.created_at ? <Text style={s.progData}>Entregue em {fmt(m.resposta.entregue_em ?? m.resposta.created_at)}</Text> : null}
                          {m.resposta.texto ? <Text style={s.progResp} numberOfLines={2}>{m.resposta.texto}</Text> : null}
                          {m.resposta.anexo_url ? (
                            <View style={s.progAnexoBox}>
                              <Text style={s.progAnexoNome} numberOfLines={1}>📎 {m.resposta.anexo_nome ?? 'Anexo da entrega'}</Text>
                              <View style={s.progAnexoAcoes}>
                                <TouchableOpacity
                                  style={s.anexoAcaoBtn}
                                  onPress={() => abrirAnexo({ url: m.resposta!.anexo_url!, nome: m.resposta!.anexo_nome })}
                                >
                                  <Ionicons name="eye-outline" size={15} color="#1a3a5c" />
                                  <Text style={s.anexoAcaoText}>Abrir</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={s.anexoAcaoBtn}
                                  onPress={() => baixarAnexo({ url: m.resposta!.anexo_url!, nome: m.resposta!.anexo_nome })}
                                >
                                  <Ionicons name="download-outline" size={15} color="#1a3a5c" />
                                  <Text style={s.anexoAcaoText}>Baixar</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : null}
                          <View style={s.progChatBox}>
                            <Text style={s.progComentarioLabel}>Histórico da conversa</Text>
                            {mensagensDaConversa(progAtiv!, m.resposta).map(renderMensagemChat)}
                          </View>
                          {m.resposta.nota != null ? <Text style={s.progNota}>Nota: {m.resposta.nota}</Text> : null}
                          {m.resposta.comentario_avaliador ? (
                            <View style={s.progComentarioBox}>
                              <Text style={s.progComentarioLabel}>
                                {status === 'aprovada' ? 'Anotação da aprovação' : 'Anotação da devolução'}
                              </Text>
                              <Text style={s.progComentario}>{m.resposta.comentario_avaliador}</Text>
                            </View>
                          ) : null}
                          {isAdmin && (
                            <View style={s.avaliarRow}>
                              {m.resposta.status !== 'aprovada' && (
                                <TouchableOpacity style={[s.avaliarBtn, { backgroundColor: '#e8f5e9' }]} onPress={() => abrirAvaliacao(progAtiv!, m.resposta!, 'aprovada')}>
                                  <Text style={[s.avaliarText, { color: '#2e7d32' }]}>Aprovar</Text>
                                </TouchableOpacity>
                              )}
                              {m.resposta.status !== 'aprovada' && (
                                <TouchableOpacity style={[s.avaliarBtn, { backgroundColor: '#fff3e0' }]} onPress={() => abrirAvaliacao(progAtiv!, m.resposta!, 'em_correcao')}>
                                  <Text style={[s.avaliarText, { color: '#ef6c00' }]}>Devolver</Text>
                                </TouchableOpacity>
                              )}
                              {podeReabrir && m.resposta.status === 'aprovada' && (
                                <TouchableOpacity style={[s.avaliarBtn, { backgroundColor: '#f3e5f5' }]} onPress={() => reabrirResposta(progAtiv!, m.resposta!)}>
                                  <Ionicons name="lock-open-outline" size={13} color="#7b1fa2" />
                                  <Text style={[s.avaliarText, { color: '#7b1fa2', marginLeft: 4 }]}>Reabrir</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </>
                      ) : (
                        <Text style={s.progPendente}>Ainda não entregou</Text>
                      )}
                    </View>
                    <Ionicons name={m.resposta ? 'checkmark-circle' : 'time-outline'} size={22} color={statusColor(status)} />
                  </View>
                );
              })}
            </ScrollView>
          )}
          <BottomNav onNavigate={() => setModalProg(false)} />
        </View>
      </Modal>

      <Modal visible={modalAval} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalAval(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalContainer}>
            {/* Header */}
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalAval(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={s.modalTitulo}>{avalStatus === 'aprovada' ? 'Aprovar entrega' : 'Devolver para correção'}</Text>
              <TouchableOpacity onPress={salvarAvaliacao} disabled={salvandoAval}>
                {salvandoAval
                  ? <ActivityIndicator size="small" color="#1a3a5c" />
                  : <View style={s.modalSalvarRow}>
                      <Ionicons name="checkmark-done-outline" size={18} color="#1a3a5c" />
                      <Text style={s.modalSalvar}>Enviar</Text>
                    </View>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={s.avaliacaoSub}>{avalResp?.dbv_nome}</Text>

              {/* Status */}
              <Text style={s.label}>Resultado</Text>
              <View style={s.chipRow}>
                {(['aprovada', 'em_correcao'] as StatusResposta[]).map(st => (
                  <TouchableOpacity key={st} style={[s.chip, avalStatus === st && s.chipAtivo]} onPress={() => setAvalStatus(st)}>
                    <Text style={[s.chipText, avalStatus === st && s.chipTextAtivo]}>{statusLabel(st)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Nota (somente aprovada) */}
              {avalStatus === 'aprovada' && (
                <>
                  <Text style={s.label}>Nota</Text>
                  <TextInput style={s.input} value={avalNota} onChangeText={setAvalNota} keyboardType="numeric" placeholder="Ex: 10" />
                </>
              )}

              {/* Mensagem */}
              <Text style={s.label}>Mensagem</Text>
              <TextInput
                style={[s.input, s.textAreaLarge]}
                value={avalComentario}
                onChangeText={setAvalComentario}
                multiline
                placeholder={avalStatus === 'aprovada' ? 'Parabéns! Observação ou elogio...' : 'Explique o que precisa ser corrigido...'}
              />

              {/* Anexo */}
              <Text style={s.label}>Anexo</Text>
              {avalAnexo ? (
                <View style={s.anexoPreviewRow}>
                  {avalAnexo.tipo === 'image'
                    ? <Image source={{ uri: avalAnexo.uri }} style={s.anexoThumb} />
                    : <Ionicons name={tipoIcon(avalAnexo.tipo).name} size={26} color={tipoIcon(avalAnexo.tipo).color} />
                  }
                  <Text style={s.anexoNome} numberOfLines={1}>{avalAnexo.nome}</Text>
                  {avalAnexo.enviando && <ActivityIndicator size="small" color="#1a3a5c" />}
                  {avalAnexo.erro && <Ionicons name="warning-outline" size={16} color="#c62828" />}
                  <TouchableOpacity onPress={() => removerAnexoPendente(avalAnexo, () => setAvalAnexo(null))}>
                    <Ionicons name="close-circle" size={20} color="#c62828" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.addAnexoBtn} onPress={escolherAnexoAvaliacao}>
                  <Ionicons name="attach-outline" size={20} color="#1a3a5c" />
                  <Text style={s.addAnexoText}>Adicionar anexo</Text>
                </TouchableOpacity>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 26, paddingBottom: 18, paddingHorizontal: 16 },
  headerTop: { minHeight: 38, justifyContent: 'center', alignItems: 'flex-start' },
  headerMain: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingRight: 12 },
  headerBackText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  headerAdd: { padding: 4 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 22, fontWeight: '800' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8edf3' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabAtiva: { borderBottomWidth: 2, borderBottomColor: '#1a3a5c' },
  tabAtivaPendentes: { borderBottomWidth: 3, borderBottomColor: '#ff6b35' },
  tabAtivaEnviadas:  { borderBottomWidth: 3, borderBottomColor: '#2e7d32' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#999' },
  tabTextAtiva: { color: '#1a3a5c' },
  tabTextPendentes: { color: '#ff6b35', fontWeight: '800' },
  tabTextEnviadas:  { color: '#2e7d32', fontWeight: '800' },
  pendBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff3e0', paddingHorizontal: 16, paddingVertical: 10 },
  pendBannerText: { color: '#e65100', fontSize: 13, fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  emptyWrap: { alignItems: 'center', marginTop: 72 },
  emptyText: { color: '#8b98a5', fontSize: 15, marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  planoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#d7e5f3', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  planoCabecalho: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#e6edf4', paddingBottom: 11 },
  planoCabecalhoCompacto: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  planoToggle: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#eaf2fa', alignItems: 'center', justifyContent: 'center' },
  planoLinhaTitulo: { flex: 1, fontSize: 15, fontWeight: '900', color: '#1a3a5c' },
  planoTitulo: { fontSize: 17, fontWeight: '900', color: '#1a3a5c' },
  planoItem: { fontSize: 12, color: '#546e7a', fontWeight: '700', marginTop: 4 },
  planoContagem: { backgroundColor: '#e8f5e9', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', minWidth: 72 },
  planoContagemNum: { color: '#2e7d32', fontSize: 16, fontWeight: '900' },
  planoContagemLabel: { color: '#2e7d32', fontSize: 10, fontWeight: '800' },
  planoInstrucao: { fontSize: 12, lineHeight: 17, color: '#546e7a', marginVertical: 10 },
  planoAtividadesLista: { gap: 10 },
  planoAtividade: { backgroundColor: '#f7fafc', borderWidth: 1, borderColor: '#e2e9f0', borderRadius: 12, padding: 12, overflow: 'hidden' },
  planoAtividadeNumero: { fontSize: 11, fontWeight: '900', color: '#1565c0', textTransform: 'uppercase', marginBottom: 4 },
  planoAtividadeVazia: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#c7d5e2', borderRadius: 12, padding: 12, backgroundColor: '#fbfcfd' },
  planoAtividadeVaziaTitulo: { color: '#7b8794', fontWeight: '900', fontSize: 12 },
  planoAtividadeVaziaText: { color: '#99a5b1', fontSize: 12, marginTop: 3 },
  planoConversa: { marginTop: 10, borderRadius: 12, backgroundColor: '#dde8f0', padding: 8 },
  blocoAjuda: { marginTop: 15, padding: 11, backgroundColor: '#e8f0fe', borderRadius: 10, color: '#1a3a5c', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  blocoFormItem: { marginTop: 12, padding: 12, backgroundColor: '#f7fafc', borderWidth: 1, borderColor: '#d7e5f3', borderRadius: 14 },
  blocoFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blocoFormNumero: { fontSize: 14, fontWeight: '900', color: '#1565c0' },
  blocoSalvaBadge: { fontSize: 11, fontWeight: '800', color: '#2e7d32', backgroundColor: '#e8f5e9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  blocoOpcoesScroll: { gap: 7, paddingTop: 8, paddingBottom: 2 },
  adicionarSlotBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#1a3a5c', borderStyle: 'dashed' },
  adicionarSlotText: { color: '#1a3a5c', fontWeight: '700', fontSize: 14 },
  labelComRepeticao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  repetirCampo: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 10 },
  repetirTexto: { fontSize: 11, color: '#546e7a', fontWeight: '700' },
  campoHerdado: { opacity: 0.53 },
  herdadoTexto: { color: '#607d8b', fontSize: 11, fontWeight: '700', marginTop: 5 },
  cardAguardando: { borderWidth: 1.5, borderColor: '#90caf9' },
  concluidaCard: { backgroundColor: '#d5f2da', borderColor: '#59ab6a', overflow: 'hidden' },
  concluidaGrupo: { backgroundColor: '#e1f5e5', borderColor: '#59ab6a', overflow: 'hidden' },
  concluidaTexto: { color: '#145a30' },
  concluidaTextoSec: { color: '#36734b' },
  concluidaContagem: { backgroundColor: '#c6eccc' },
  concluidaMarca: { position: 'absolute', left: 12, right: 12, top: '36%', textAlign: 'center', fontSize: 37, fontWeight: '900', color: 'rgba(22, 108, 50, 0.10)', textTransform: 'uppercase', transform: [{ rotate: '-10deg' }] },
  concluidaMarcaGrupo: { position: 'absolute', left: 0, right: 0, top: 6, textAlign: 'center', fontSize: 32, fontWeight: '900', color: 'rgba(22, 108, 50, 0.09)', textTransform: 'uppercase', transform: [{ rotate: '-6deg' }] },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cardTitulo: { fontSize: 16, fontWeight: '800', color: '#1a3a5c' },
  cardData: { fontSize: 12, color: '#7b8794', marginTop: 2 },
  cardDesc: { fontSize: 14, color: '#4d5966', lineHeight: 20, marginBottom: 8 },
  acoesRow: { flexDirection: 'row', gap: 6 },
  acaoBtn: { padding: 7, backgroundColor: '#f0f4f8', borderRadius: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  badge: { backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeAvaliador: { backgroundColor: '#e8f5e9' },
  badgeAguardando: { backgroundColor: '#e3f2fd' },
  badgeFormativo: { backgroundColor: '#fff8e1' },
  badgePlano: { backgroundColor: '#e8f5e9' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#1a3a5c' },
  anexosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  anexoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f5f7fa', borderRadius: 8, padding: 6, maxWidth: 190 },
  anexoThumb: { width: 36, height: 36, borderRadius: 6 },
  anexoNome: { fontSize: 12, color: '#333', flex: 1 },
  respondidoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f6faf7', borderRadius: 10, padding: 10, marginTop: 4, flexWrap: 'wrap' },
  respondidoText: { fontSize: 13, fontWeight: '800' },
  respPreview: { fontSize: 12, color: '#555' },
  editarRespText: { fontSize: 12, color: '#1a3a5c', fontWeight: '700', textDecorationLine: 'underline' },
  editarRespBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#1a3a5c', borderRadius: 10, padding: 10, marginTop: 6, justifyContent: 'center' },
  editarRespBtnText: { color: '#1a3a5c', fontWeight: '700', fontSize: 13 },
  responderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a3a5c', borderRadius: 10, padding: 11, marginTop: 8, justifyContent: 'center' },
  responderBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  refazerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e65100', borderRadius: 10, padding: 11, marginTop: 8, justifyContent: 'center' },
  refazerBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  filhoAcoes: { flexDirection: 'row', gap: 8, marginTop: 8 },
  filhoAcaoBtn: { flex: 1, marginTop: 0 },
  prazoEncerradoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ffebee', borderRadius: 10, padding: 11, marginTop: 8 },
  prazoEncerradoText: { color: '#c62828', fontWeight: '800', fontSize: 13 },
  cardExpiradoColapsado: { opacity: 0.72 },
  cardExpiradoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prazoEncChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffebee', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  prazoEncChipDestaque: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  prazoEncChipText: { color: '#c62828', fontSize: 11, fontWeight: '700' },
  prazoEncChipTextDestaque: { fontSize: 13, fontWeight: '800' },
  recolherExpiradoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginBottom: 6 },
  recolherExpiradoText: { color: '#90a4ae', fontSize: 11, fontWeight: '700' },
  detalhesBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#d7e5f3', backgroundColor: '#f7fbff', borderRadius: 10, padding: 10, marginTop: 8 },
  detalhesBtnText: { color: '#1a3a5c', fontWeight: '800', fontSize: 13 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 9, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 4 },
  statsText: { fontSize: 12, color: '#7b8794', fontWeight: '600' },
  verProg: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  verProgText: { fontSize: 12, color: '#1a3a5c', fontWeight: '800' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitulo: { flex: 1, fontSize: 17, fontWeight: '900', color: '#1a3a5c', textAlign: 'center' },
  modalSubtitulo: { color: '#1a3a5c', fontWeight: '800', fontSize: 16, marginBottom: 8 },
  respondendoComoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#edf6ff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  respondendoComoText: { color: '#1a3a5c', fontSize: 13, fontWeight: '800' },
  rascunhoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#eef3f6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  rascunhoText: { color: '#607d8b', fontSize: 12, fontWeight: '800' },
  modalSalvar: { fontSize: 16, fontWeight: '800', color: '#1a3a5c' },
  modalAcaoEspaco: { width: 52 },
  modalScroll: { padding: 16 },
  paletaScroll: { padding: 16, paddingBottom: 36 },
  paletaIntro: { color: '#546e7a', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  paletaConfirmacao: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  paletaConfirmacaoText: { color: '#2e7d32', fontSize: 13, fontWeight: '800' },
  paletaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paletaCard: { width: '48%', minWidth: 150, flexGrow: 1, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#dde5ed', backgroundColor: '#fff' },
  paletaCardSelecionada: { borderWidth: 2, borderColor: '#2e7d32', backgroundColor: '#f7fff8' },
  paletaCardTituloRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  paletaNome: { color: '#1a3a5c', fontSize: 14, fontWeight: '900', flexShrink: 1 },
  paletaDescricao: { color: '#6c7a86', fontSize: 11, minHeight: 29, marginTop: 3 },
  paletaAmostras: { flexDirection: 'row', gap: 5, marginTop: 8 },
  paletaAmostra: { height: 33, flex: 1, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  paletaAmostraText: { fontSize: 12, fontWeight: '900' },
  etapaTexto: { color: '#607d8b', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  etapaTitulo: { color: '#1a3a5c', fontSize: 20, fontWeight: '900', marginTop: 5, marginBottom: 8 },
  itemBusca: { marginTop: 12 },
  avancarBtn: { marginTop: 24, backgroundColor: '#238346', borderRadius: 12, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  avancarBtnDisabled: { backgroundColor: '#edf1f5' },
  avancarBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  avancarBtnTextDisabled: { color: '#9eabb7' },
  resumoPlano: { backgroundColor: '#f3f7fb', borderWidth: 1, borderColor: '#d7e5f3', borderRadius: 13, padding: 12, marginBottom: 4 },
  resumoPlanoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resumoVoltar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resumoVoltarText: { color: '#1a3a5c', fontWeight: '800', fontSize: 13 },
  resumoPlanoTitulo: { color: '#1a3a5c', fontSize: 17, fontWeight: '900' },
  resumoPlanoTexto: { color: '#546e7a', fontSize: 13, marginTop: 3 },
  detalheTitulo: { fontSize: 22, fontWeight: '900', color: '#0b2742', marginBottom: 4 },
  detalheTexto: { color: '#333', fontSize: 14, lineHeight: 21, marginTop: 6 },
  label: { fontSize: 12, fontWeight: '800', color: '#77838f', textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  labelErro: { color: '#c62828' },
  input: { borderWidth: 1, borderColor: '#dce3eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  inputErro: { borderColor: '#c62828', borderWidth: 2, backgroundColor: '#fff6f6' },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  textAreaLarge: { minHeight: 130, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#f0f4f8', borderWidth: 1.5, borderColor: '#dde4f0' },
  chipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#4d5966' },
  chipTextAtivo: { color: '#fff' },
  resumoDestino: { backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#f1df9a', borderRadius: 9, padding: 8, marginTop: 7, marginBottom: 8 },
  resumoDestinoTitulo: { color: '#7b5c10', fontSize: 11, fontWeight: '800', marginBottom: 7 },
  selectedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedChip: { backgroundColor: '#ffeab2', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14 },
  selectedChipText: { color: '#6d530e', fontWeight: '700', fontSize: 11 },
  excluidoChip: { backgroundColor: '#ffedbb', color: '#7b5c10', fontWeight: '700', fontSize: 11, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14 },
  dbvItem: { padding: 12, borderWidth: 1, borderColor: '#e5e9ef', borderRadius: 10, marginTop: 6, backgroundColor: '#fff' },
  dbvItemAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  dbvNome: { fontSize: 14, fontWeight: '800', color: '#222' },
  dbvSub: { fontSize: 12, color: '#7b8794', marginTop: 2 },
  optionList: { marginTop: 8, gap: 6 },
  optionItem: { padding: 10, borderWidth: 1, borderColor: '#e5e9ef', borderRadius: 10, backgroundColor: '#fff' },
  optionItemAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  optionTitle: { fontSize: 13, fontWeight: '900', color: '#1a3a5c' },
  optionSub: { fontSize: 11, color: '#7b8794', marginTop: 2 },
  optionTextAtivo: { color: '#fff' },
  optionEmpty: { color: '#8b98a5', fontSize: 12, marginTop: 6, lineHeight: 17 },
  planoBox: { marginTop: 12, backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#d7e5f3', borderRadius: 12, padding: 10, gap: 7 },
  planoAjuda: { color: '#546e7a', fontSize: 12, lineHeight: 17, marginBottom: 3 },
  planoAviso: { color: '#8a6d1f', backgroundColor: '#fff8e1', borderRadius: 8, padding: 8, fontSize: 11, fontWeight: '700' },
  addAnexoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: '#edf4fb', borderWidth: 1, borderColor: '#d7e5f3' },
  addAnexoText: { color: '#1a3a5c', fontWeight: '800' },
  anexoPendItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f5f7fa', borderRadius: 10, padding: 10, marginBottom: 8 },
  anexoPendThumb: { width: 42, height: 42, borderRadius: 8 },
  anexoPendNome: { flex: 1, fontWeight: '700', color: '#344150' },
  anexoAbrirArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  anexoEnviado: { fontSize: 11, fontWeight: '800', color: '#238346' },
  anexoErro: { fontSize: 11, fontWeight: '800', color: '#c62828' },
  anexoDetalheItem: { backgroundColor: '#f5f7fa', borderRadius: 12, padding: 10, marginBottom: 8, gap: 10 },
  anexoDetalheInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  anexoDetalheAcoes: { flexDirection: 'row', gap: 8, paddingLeft: 52 },
  anexoAcaoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8f0fe', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  anexoAcaoText: { color: '#1a3a5c', fontWeight: '900', fontSize: 12 },
  progStats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  progStat: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  progStatNum: { fontSize: 22, fontWeight: '900' },
  progStatLabel: { fontSize: 11, color: '#6d7782', fontWeight: '700', marginTop: 2 },
  progItem: { flexDirection: 'row', gap: 12, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 8 },
  progDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  progNome: { fontSize: 14, fontWeight: '900', color: '#1a3a5c' },
  progUnidade: { fontSize: 11, color: '#7b8794', marginTop: 1 },
  progStatus: { fontSize: 12, fontWeight: '900', marginTop: 4 },
  progResp: { fontSize: 13, color: '#4d5966', marginTop: 5, lineHeight: 18 },
  progAnexo: { color: '#1a3a5c', fontSize: 12, fontWeight: '800', marginTop: 4 },
  progAnexoBox: { marginTop: 8, backgroundColor: '#eef5fb', borderRadius: 10, padding: 9, gap: 8 },
  progAnexoNome: { color: '#1a3a5c', fontSize: 12, fontWeight: '900' },
  progAnexoAcoes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  progData: { color: '#7b8794', fontSize: 11, marginTop: 3 },
  progNota: { color: '#2e7d32', fontSize: 12, fontWeight: '900', marginTop: 4 },
  progComentarioBox: { marginTop: 8, backgroundColor: '#fff8e1', padding: 9, borderRadius: 10 },
  progComentarioLabel: { color: '#8a6d1f', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 3 },
  progComentario: { color: '#6d4c41', fontSize: 12, lineHeight: 17 },
  progChatBox: { marginTop: 10, backgroundColor: '#dde8f0', padding: 8, borderRadius: 12 },
  progPendente: { color: '#e65100', fontSize: 12, fontWeight: '800', marginTop: 4 },
  avaliarRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  avaliarBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  avaliarText: { fontSize: 12, fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 18 },
  avaliacaoBoxWrap: { width: '100%' },
  avaliacaoBox: { backgroundColor: '#fff', borderRadius: 18, padding: 18 },
  avaliacaoTitulo: { fontSize: 20, fontWeight: '900', color: '#1a3a5c' },
  avaliacaoSub: { color: '#7b8794', fontSize: 14, marginTop: 3, marginBottom: 8 },
  anexoPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f5f7fa', borderRadius: 10, padding: 10, marginBottom: 4 },
  primaryBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelBtnText: { color: '#8b98a5', fontWeight: '800' },
  cardFilhoPendente: { borderLeftWidth: 4, borderLeftColor: '#ff6b35' },
  filhoStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  filhoStatusText: { fontSize: 11, fontWeight: '900' },
  filhoNomeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  filhoNomeText: { fontSize: 12, color: '#546e7a', fontWeight: '700' },
  // Chat (detalhes WhatsApp-style)
  chatScroll: { padding: 12, gap: 8 },
  chatRowLeft: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start', maxWidth: '88%', marginBottom: 10 },
  chatRowRight: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-end', maxWidth: '88%', marginBottom: 10 },
  chatAvatarLeft: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chatAvatarRight: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2e7d32', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chatBubbleLeft: { backgroundColor: '#fff', borderRadius: 14, borderBottomLeftRadius: 3, padding: 12, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, elevation: 1, flex: 1 },
  chatBubbleRight: { backgroundColor: '#d1f7c4', borderRadius: 14, borderBottomRightRadius: 3, padding: 12, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, elevation: 1, flex: 1 },
  chatBubbleAprovada: { backgroundColor: '#e8f5e9' },
  chatBubbleCorrecao: { backgroundColor: '#fff3e0' },
  chatSenderName: { fontSize: 11, fontWeight: '900', color: '#1a3a5c', marginBottom: 4 },
  chatActivityTitle: { fontSize: 15, fontWeight: '900', color: '#0b2742', marginBottom: 4 },
  chatMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  chatMetaText: { fontSize: 12, color: '#546e7a' },
  chatTag: { backgroundColor: '#e8f0fe', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  chatTagText: { fontSize: 11, fontWeight: '700', color: '#1a3a5c' },
  chatBubbleText: { fontSize: 14, color: '#333', lineHeight: 20, marginVertical: 4 },
  chatTimeText: { fontSize: 10, color: '#aaa', textAlign: 'right', marginTop: 4 },
  chatAnexosWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chatAnexoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 8, padding: 6, maxWidth: 170 },
  chatAnexoThumb: { width: 28, height: 28, borderRadius: 4 },
  chatAnexoNome: { fontSize: 11, color: '#333', flex: 1 },
  chatStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  chatStatusText: { fontSize: 12, fontWeight: '900' },
  chatNotaText: { fontSize: 13, fontWeight: '900', color: '#2e7d32', marginTop: 4 },
  chatPendenteHint: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: '#fff3e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginVertical: 8 },
  chatPendenteText: { fontSize: 13, color: '#e65100', fontWeight: '700' },
  chatActions: { marginTop: 8, paddingHorizontal: 2 },
  chatRowSistema: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, alignSelf: 'center', backgroundColor: '#f3e5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginVertical: 6, maxWidth: '90%' },
  chatSistemaText: { fontSize: 11, color: '#7b1fa2', fontWeight: '700', flex: 1, flexWrap: 'wrap' },
  chatSistemaData: { fontSize: 10, color: '#ab47bc', marginLeft: 4 },
});

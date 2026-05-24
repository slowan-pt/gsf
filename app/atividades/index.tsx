import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import {
  carregarClassesModelo,
  carregarEspecialidadesModelo,
  classesFallback,
  type ClasseModelo,
  type EspecialidadeModelo,
} from '../../src/lib/modelosPrograma';

type Destino = 'todos' | 'unidade' | 'desbravador';
type AlvoTipo = 'todos' | 'unidade' | 'membro';
type StatusResposta = 'pendente' | 'entregue' | 'em_correcao' | 'aprovada' | 'recusada';
type ItemFormativoTipo = 'classe' | 'especialidade' | null;

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
  created_at: string;
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

interface AnexoPendente { uri: string; nome: string; tipo: Anexo['tipo']; mime?: string | null; }
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

export default function AtividadesScreen() {
  const params = useLocalSearchParams<{ detalhes?: string; progresso?: string; aba?: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const contextos = useContextoStore((s) => s.contextos);
  const permissoes = usePermissoes();
  const isAdmin = permissoes.pode('gerenciar_atividades');

  const membroAtualId = contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;
  const membroAtualNome = contextoAtivo?.membro_nome ?? usuario?.nome ?? null;
  const unidadeAtualId = contextoAtivo?.unidade_id ?? usuario?.unidade_id ?? null;

  const filhosCtxs = useMemo(
    () => contextos.filter(c => c.tipo === 'responsavel' && c.clube_id === contextoAtivo?.clube_id && c.membro_id != null),
    [contextos, contextoAtivo?.clube_id]
  );
  const ehPai = filhosCtxs.length > 0;
  const filhosIds = useMemo(() => filhosCtxs.map(c => c.membro_id!), [filhosCtxs]);
  const filhosUnidadeIds = useMemo(
    () => [...new Set(filhosCtxs.map(c => c.unidade_id).filter((id): id is number => id != null))],
    [filhosCtxs]
  );

  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [alvosMap, setAlvosMap] = useState<Record<number, AlvoAtividade[]>>({});
  const [anexosMap, setAnexosMap] = useState<Record<number, Anexo[]>>({});
  const [respostasMap, setRespostasMap] = useState<Record<number, Resposta[]>>({});
  const [loading, setLoading] = useState(true);
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
  const [salvando, setSalvando] = useState(false);
  const [unidades, setUnidades] = useState<UnidadeLocal[]>([]);
  const [dbvs, setDbvs] = useState<DBVLocal[]>([]);
  const [diretoria, setDiretoria] = useState<DiretorLocal[]>([]);
  const [classesModelo, setClassesModelo] = useState<ClasseModelo[]>([]);
  const [especialidadesModelo, setEspecialidadesModelo] = useState<EspecialidadeModelo[]>([]);

  const [modalResp, setModalResp] = useState(false);
  const [respAtiv, setRespAtiv] = useState<Atividade | null>(null);
  const [respTexto, setRespTexto] = useState('');
  const [respAnexo, setRespAnexo] = useState<AnexoPendente | null>(null);
  const [enviandoResp, setEnviandoResp] = useState(false);
  const [abaMembro, setAbaMembro] = useState<'pendentes' | 'enviadas'>('pendentes');
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
  const [salvandoAval, setSalvandoAval] = useState(false);

  const podeVerProgresso = isAdmin || ehConselheiro;

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
    sincronizar().then(carregar);
  }, [isAdmin, usuario?.id, contextoAtivo?.id]));

  useEffect(() => {
    const abaParam = Array.isArray(params.aba) ? params.aba[0] : params.aba;
    if (abaParam === 'pendentes' || abaParam === 'enviadas') {
      setAbaMembro(abaParam);
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

  async function sincronizar() {
    try {
      const db = await getDB();
      const clubeId = getClubeAtivoId();
      const { data: ats } = await supabase.from('atividades').select('*').eq('clube_id', clubeId);

      if (ats?.length) {
        for (const a of ats) {
        await db.runAsync(
          `INSERT OR REPLACE INTO atividades
             (id,supabase_id,titulo,descricao,data,destino,unidade_id,unidade_nome,dbv_id,dbv_nome,criado_por,avaliador_id,avaliador_nome,item_formativo_tipo,item_formativo_nome,gera_investidura,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [a.id, a.id, a.titulo, a.descricao, a.data, a.destino, a.unidade_id, a.unidade_nome,
             a.dbv_id, a.dbv_nome, a.criado_por, a.avaliador_id ?? null, a.avaliador_nome ?? null,
             a.item_formativo_tipo ?? null, a.item_formativo_nome ?? null, a.gera_investidura ? 1 : 0, a.created_at]
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
    } catch {
      // offline: mantém SQLite
    }
  }

  function atividadeParaUsuario(a: Atividade, alvos: AlvoAtividade[]) {
    if (isAdmin) return true;
    if (alvos.length === 0) {
      return (
        a.destino === 'todos'
        || (a.destino === 'unidade' && a.unidade_id === unidadeAtualId)
        || (a.destino === 'desbravador' && a.dbv_id === membroAtualId)
      );
    }
    return alvos.some(al =>
      al.tipo === 'todos'
      || (al.tipo === 'unidade' && al.unidade_id === unidadeAtualId)
      || (al.tipo === 'membro' && al.membro_id === membroAtualId)
    );
  }

  async function carregarRemoto() {
    const clubeId = getClubeAtivoId();
    const [atividadesRes, alvosRes, anexosRes, respostasRes] = await Promise.all([
      supabase.from('atividades').select('*').eq('clube_id', clubeId).order('data', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('atividades_alvos').select('*').eq('clube_id', clubeId),
      supabase.from('atividades_anexos').select('*').eq('clube_id', clubeId),
      supabase.from('atividades_respostas').select('*').eq('clube_id', clubeId),
    ]);

    if (atividadesRes.error) throw atividadesRes.error;
    if (alvosRes.error) throw alvosRes.error;
    if (anexosRes.error) throw anexosRes.error;
    if (respostasRes.error) throw respostasRes.error;

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

    setAlvosMap(alvosPorAtividade);
    setAnexosMap(anexosPorAtividade);
    setRespostasMap(respostasPorAtividade);
    setAtividades(rows.filter(a => atividadeParaUsuario(a, alvosPorAtividade[a.id] ?? [])));
  }

  async function carregar() {
    setLoading(true);
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

      setAlvosMap(alvosPorAtividade);
      setAnexosMap(anexosPorAtividade);
      setRespostasMap(respostasPorAtividade);
      setAtividades(rows.filter(a => atividadeParaUsuario(a, alvosPorAtividade[a.id] ?? [])));
    } finally {
      setLoading(false);
    }
  }

  async function carregarUnidadesDbvs() {
    const db = await getDB();
    let dbvsLocais = await db.getAllAsync<DBVLocal>(
      "SELECT id,nome,unidade_id,unidade_nome FROM desbravadores WHERE COALESCE(unidade_nome,'') != 'Diretoria' ORDER BY unidade_nome, nome"
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
        .neq('unidade_nome', 'Diretoria')
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
  }

  async function abrirCriar() {
    await carregarUnidadesDbvs();
    setEditando(null);
    setFTitulo('');
    setFDesc('');
    setFData('');
    setFDestino('todos');
    setFUnidades([]);
    setFDbvs([]);
    setFAvaliador(null);
    setFItemTipo(null);
    setFItemNome('');
    setBuscaItem('');
    setBuscaDbv('');
    setBuscaUnidade('');
    setAnexosPend([]);
    setModalCRUD(true);
  }

  async function abrirEditar(a: Atividade) {
    await carregarUnidadesDbvs();
    const alvos = alvosMap[a.id] ?? [];
    const unidadesSelecionadas = alvos
      .filter(x => x.tipo === 'unidade' && x.unidade_id)
      .map(x => unidades.find(u => u.id === x.unidade_id) ?? { id: x.unidade_id!, nome: a.unidade_nome ?? `Unidade ${x.unidade_id}`, cor: '#1a3a5c' });
    const dbvsSelecionados = alvos
      .filter(x => x.tipo === 'membro' && x.membro_id)
      .map(x => dbvs.find(d => d.id === x.membro_id) ?? { id: x.membro_id!, nome: a.dbv_nome ?? `Membro ${x.membro_id}`, unidade_id: null, unidade_nome: '' });

    setEditando(a);
    setFTitulo(a.titulo);
    setFDesc(a.descricao ?? '');
    setFData(a.data ?? '');
    setFDestino(alvos.some(x => x.tipo === 'membro') ? 'desbravador' : alvos.some(x => x.tipo === 'unidade') ? 'unidade' : a.destino);
    setFUnidades(unidadesSelecionadas.length ? unidadesSelecionadas : a.unidade_id ? [{ id: a.unidade_id, nome: a.unidade_nome ?? '', cor: '#1a3a5c' }] : []);
    setFDbvs(dbvsSelecionados.length ? dbvsSelecionados : a.dbv_id ? [{ id: a.dbv_id, nome: a.dbv_nome ?? '', unidade_id: null, unidade_nome: '' }] : []);
    setFAvaliador(a.avaliador_id ? { id: a.avaliador_id, nome: a.avaliador_nome ?? 'Avaliador', email: '', perfil: '', membro_id: null } : null);
    setFItemTipo(a.item_formativo_tipo ?? null);
    setFItemNome(a.item_formativo_nome ?? '');
    setBuscaItem(a.item_formativo_nome ?? '');
    setBuscaDbv('');
    setBuscaUnidade('');
    setAnexosPend([]);
    setModalCRUD(true);
  }

  function toggleUnidade(u: UnidadeLocal) {
    setFUnidades(prev => prev.some(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]);
  }

  function toggleDbv(d: DBVLocal) {
    setFDbvs(prev => prev.some(x => x.id === d.id) ? prev.filter(x => x.id !== d.id) : [...prev, d]);
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
        setAnexosPend((p) => [
          ...p,
          ...validos.map((file) => ({
            uri: URL.createObjectURL(file),
            nome: file.name,
            tipo: tipoAnexo(file.name, file.type),
            mime: file.type,
          })),
        ]);
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
            setAnexosPend(p => [...p, { uri: r.assets[0].uri, nome: `imagem_${Date.now()}.jpg`, tipo: 'image', mime: 'image/jpeg' }]);
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
            setAnexosPend(p => [...p, { uri: a.uri, nome: a.name, tipo: tipoAnexo(a.name, a.mimeType ?? ''), mime: a.mimeType ?? null }]);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function montarAlvos() {
    if (fDestino === 'todos') return [{ tipo: 'todos' as AlvoTipo, unidade_id: null, membro_id: null }];
    if (fDestino === 'unidade') return fUnidades.map(u => ({ tipo: 'unidade' as AlvoTipo, unidade_id: u.id, membro_id: null }));
    return fDbvs.map(d => ({ tipo: 'membro' as AlvoTipo, unidade_id: null, membro_id: d.id }));
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

  async function salvarAtividade() {
    if (!fTitulo.trim()) {
      Alert.alert('Atenção', 'Título obrigatório.');
      return;
    }
    if (fDestino === 'unidade' && fUnidades.length === 0) {
      Alert.alert('Atenção', 'Selecione uma ou mais unidades.');
      return;
    }
    if (fDestino === 'desbravador' && fDbvs.length === 0) {
      Alert.alert('Atenção', 'Selecione um ou mais desbravadores.');
      return;
    }

    setSalvando(true);
    try {
      const db = await getDB();
      const alvos = montarAlvos();
      const primeiraUnidade = fDestino === 'unidade' ? fUnidades[0] : null;
      const primeiroDbv = fDestino === 'desbravador' ? fDbvs[0] : null;
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
      };

      let supId = editando?.supabase_id ?? null;
      let localId = editando?.id ?? null;

      if (editando) {
        if (supId) {
          const { error } = await supabase.from('atividades').update(payload).eq('id', supId).eq('clube_id', getClubeAtivoId());
          if (error) throw error;
        }
        await db.runAsync(
          `UPDATE atividades SET titulo=?,descricao=?,data=?,destino=?,unidade_id=?,unidade_nome=?,dbv_id=?,dbv_nome=?,criado_por=?,avaliador_id=?,avaliador_nome=?,item_formativo_tipo=?,item_formativo_nome=?,gera_investidura=? WHERE id=?`,
          [payload.titulo, payload.descricao, payload.data, payload.destino, payload.unidade_id, payload.unidade_nome,
           payload.dbv_id, payload.dbv_nome, payload.criado_por, payload.avaliador_id, payload.avaliador_nome,
           payload.item_formativo_tipo, payload.item_formativo_nome, payload.gera_investidura ? 1 : 0, editando.id]
        );
        localId = editando.id;
      } else {
        const { data: ins, error } = await supabase.from('atividades').insert(payload).select().single();
        if (error) throw error;
        supId = ins?.id ?? null;
        if (supId) {
          await db.runAsync(
            `INSERT OR REPLACE INTO atividades (id,supabase_id,titulo,descricao,data,destino,unidade_id,unidade_nome,dbv_id,dbv_nome,criado_por,avaliador_id,avaliador_nome,item_formativo_tipo,item_formativo_nome,gera_investidura,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
            [supId, supId, payload.titulo, payload.descricao, payload.data, payload.destino, payload.unidade_id, payload.unidade_nome,
             payload.dbv_id, payload.dbv_nome, payload.criado_por, payload.avaliador_id, payload.avaliador_nome,
             payload.item_formativo_tipo, payload.item_formativo_nome, payload.gera_investidura ? 1 : 0]
          );
          localId = supId;
        } else {
          const result = await db.runAsync(
            `INSERT INTO atividades (supabase_id,titulo,descricao,data,destino,unidade_id,unidade_nome,dbv_id,dbv_nome,criado_por,avaliador_id,avaliador_nome,item_formativo_tipo,item_formativo_nome,gera_investidura)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [supId, payload.titulo, payload.descricao, payload.data, payload.destino, payload.unidade_id, payload.unidade_nome,
           payload.dbv_id, payload.dbv_nome, payload.criado_por, payload.avaliador_id, payload.avaliador_nome,
           payload.item_formativo_tipo, payload.item_formativo_nome, payload.gera_investidura ? 1 : 0]
          );
          localId = result.lastInsertRowId;
        }
      }

      await salvarAlvos(localId!, supId, alvos);

      for (const ap of anexosPend) {
        const mime = ap.mime || (ap.tipo === 'image' ? 'image/jpeg' : ap.tipo === 'pdf' ? 'application/pdf' : 'application/octet-stream');
        const path = `${supId ?? localId}/anexo_${Date.now()}_${nomeArquivoSeguro(ap.nome)}`;
        const url = await uploadParaStorage(path, ap.uri, mime);
        let supAnexoId: number | null = null;
        if (supId) {
          const { data: xIns } = await supabase.from('atividades_anexos')
            .insert({ clube_id: getClubeAtivoId(), atividade_id: supId, nome: ap.nome, url, tipo: ap.tipo })
            .select()
            .single();
          supAnexoId = xIns?.id ?? null;
        }
        await db.runAsync(
          'INSERT INTO atividades_anexos (supabase_id,atividade_id,nome,url,tipo) VALUES (?,?,?,?,?)',
          [supAnexoId, localId, ap.nome, url, ap.tipo]
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

  async function excluirAtividade(a: Atividade) {
    const executarExclusao = async () => {
      try {
        setLoading(true);
        const db = await getDB();
        const supabaseId = a.supabase_id ?? a.id;
        if (supabaseId) {
          const { error } = await supabase
            .from('atividades')
            .delete()
            .eq('id', supabaseId)
            .eq('clube_id', getClubeAtivoId());
          if (error) throw error;
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

  function respostaDoUsuario(a: Atividade) {
    if (!membroAtualId) return null;
    return respostasMap[a.id]?.find(r => r.dbv_id === membroAtualId) ?? null;
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

  function abrirDetalhes(a: Atividade) {
    setDetalheAtiv(a);
    setModalDetalhes(true);
  }

  function fecharDetalhes() {
    setModalDetalhes(false);
    setDetalheAtiv(null);
    router.replace('/(tabs)/atividades' as any);
  }

  function fecharProgresso() {
    setModalProg(false);
    setProgAtiv(null);
    setAba('progresso');
    router.replace('/(tabs)/atividades' as any);
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

  function abrirResponder(a: Atividade) {
    const resp = respostaDoUsuario(a);
    setRespAtiv(a);
    setRespTexto(resp?.texto ?? '');
    setRespAnexo(null);
    setModalResp(true);
  }

  async function escolherAnexoResposta() {
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
          setRespAnexo({
            uri: URL.createObjectURL(file),
            nome: file.name,
            tipo,
            mime: file.type || null,
          });
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
            setRespAnexo({ uri: r.assets[0].uri, nome: `imagem_${Date.now()}.jpg`, tipo: 'image', mime: 'image/jpeg' });
          }
        },
      },
      {
        text: 'Documento',
        onPress: async () => {
          const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
          if (!r.canceled && r.assets[0]) {
            const a = r.assets[0];
            setRespAnexo({ uri: a.uri, nome: a.name, tipo: tipoAnexo(a.name, a.mimeType ?? ''), mime: a.mimeType ?? null });
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function enviarResposta() {
    if (!respAtiv) return;
    if (!respTexto.trim() && !respAnexo) {
      Alert.alert('Atenção', 'Escreva um texto ou anexe um arquivo.');
      return;
    }
    if (!membroAtualId) {
      Alert.alert('Atenção', 'Seu acesso não está vinculado a um membro.');
      return;
    }

    setEnviandoResp(true);
    try {
      const db = await getDB();
      const supId = respAtiv.supabase_id;
      let anexoUrl: string | null = null;
      let anexoNome: string | null = null;

      if (respAnexo) {
        const mime = respAnexo.mime || (respAnexo.tipo === 'image' ? 'image/jpeg' : respAnexo.tipo === 'pdf' ? 'application/pdf' : 'application/octet-stream');
        const path = `${supId ?? respAtiv.id}/resposta_${membroAtualId}_${Date.now()}_${nomeArquivoSeguro(respAnexo.nome)}`;
        anexoUrl = await uploadParaStorage(path, respAnexo.uri, mime);
        anexoNome = respAnexo.nome;
      }

      const existente = await db.getFirstAsync<Resposta>(
        'SELECT * FROM atividades_respostas WHERE atividade_id=? AND dbv_id=?',
        [respAtiv.id, membroAtualId]
      );

      const payload = {
        clube_id: getClubeAtivoId(),
        atividade_id: supId,
        dbv_id: membroAtualId,
        dbv_nome: membroAtualNome,
        texto: respTexto.trim() || null,
        anexo_url: anexoUrl ?? existente?.anexo_url ?? null,
        anexo_nome: anexoNome ?? existente?.anexo_nome ?? null,
        status: 'entregue',
        nota: null,
        comentario_avaliador: existente?.comentario_avaliador ?? null,
        avaliado_por: null,
        avaliado_em: null,
        entregue_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: rIns, error } = await supabase.from('atividades_respostas')
        .upsert(payload, { onConflict: 'atividade_id,dbv_id' })
        .select()
        .single();
      if (error) throw error;

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
          [rIns?.id ?? null, respAtiv.id, membroAtualId, membroAtualNome, payload.texto, payload.anexo_url, payload.anexo_nome, 'entregue', payload.entregue_em]
        );
      }

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
          "SELECT id,nome,unidade_id,unidade_nome FROM desbravadores WHERE COALESCE(unidade_nome,'') != 'Diretoria' ORDER BY unidade_nome, nome"
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
        "SELECT id,nome,unidade_id,unidade_nome FROM desbravadores WHERE COALESCE(unidade_nome,'') != 'Diretoria' ORDER BY unidade_nome, nome"
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
    setAvalComentario(r.comentario_avaliador ?? '');
    setModalAval(true);
  }

  async function salvarAvaliacao() {
    if (!avalAtiv || !avalResp) return;
    setSalvandoAval(true);
    try {
      const db = await getDB();
      const nota = avalNota.trim() ? Number(avalNota.replace(',', '.')) : null;
      const payload = {
        status: avalStatus,
        nota: avalStatus === 'aprovada' ? nota : null,
        comentario_avaliador: avalComentario.trim() || null,
        avaliado_por: usuario?.id ?? null,
        avaliado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

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

      setModalAval(false);
      await carregar();
      await abrirProgresso(avalAtiv);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a avaliação.');
    } finally {
      setSalvandoAval(false);
    }
  }

  const dbvsFiltrados = useMemo(() => {
    const q = normalizarBusca(buscaDbv);
    const base = q
      ? dbvs.filter(d => normalizarBusca(`${d.nome} ${d.unidade_nome ?? ''}`).includes(q))
      : dbvs;
    return base;
  }, [buscaDbv, dbvs]);

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

  function alvoTexto(a: Atividade) {
    const alvos = alvosMap[a.id] ?? [];
    if (alvos.length === 0) {
      if (a.destino === 'todos') return 'Todos';
      if (a.destino === 'unidade') return a.unidade_nome ?? 'Unidade';
      return a.dbv_nome ?? 'Desbravador';
    }
    if (alvos.some(x => x.tipo === 'todos')) return 'Todos';
    const unidadesTxt = alvos.filter(x => x.tipo === 'unidade').map(x => unidades.find(u => u.id === x.unidade_id)?.nome ?? `Unidade ${x.unidade_id}`);
    const membrosTxt = alvos.filter(x => x.tipo === 'membro').map(x => dbvs.find(d => d.id === x.membro_id)?.nome ?? `Membro ${x.membro_id}`);
    return [...unidadesTxt, ...membrosTxt].slice(0, 3).join(', ') + ([...unidadesTxt, ...membrosTxt].length > 3 ? '...' : '');
  }

  const atividadesFilho = useMemo(() => {
    if (!ehPai || filhosIds.length === 0) return [];
    return atividades.filter(a => {
      const alvos = alvosMap[a.id] ?? [];
      if (alvos.length === 0) {
        return a.destino === 'todos'
          || (a.destino === 'unidade' && filhosUnidadeIds.includes(a.unidade_id!))
          || (a.destino === 'desbravador' && filhosIds.includes(a.dbv_id!));
      }
      return alvos.some(al =>
        al.tipo === 'todos'
        || (al.tipo === 'unidade' && filhosUnidadeIds.includes(al.unidade_id!))
        || (al.tipo === 'membro' && filhosIds.includes(al.membro_id!))
      );
    });
  }, [atividades, alvosMap, ehPai, filhosIds, filhosUnidadeIds]);

  const pendentesFilhoCount = useMemo(() => {
    if (!ehPai || filhosIds.length === 0) return 0;
    return atividadesFilho.filter(a => {
      return filhosIds.some(filhoId => {
        const resp = respostasMap[a.id]?.find(r => r.dbv_id === filhoId);
        return !resp || ['pendente', 'em_correcao', 'recusada'].includes(resp.status ?? 'pendente');
      });
    }).length;
  }, [atividadesFilho, respostasMap, ehPai, filhosIds]);

  const pendentesCount = isAdmin ? 0 : atividades.filter(atividadePendenteParaMim).length;
  const atividadesVisiveis = !isAdmin && abaMembro === 'pendentes'
    ? atividades.filter(atividadePendenteParaMim)
    : !isAdmin && abaMembro === 'enviadas'
      ? atividades.filter(atividadeEnviadaPorMim)
      : atividades;

  if (!usuario) return <Redirect href="/auth/login" />;

  function voltar() {
    setModalDetalhes(false);
    setModalProg(false);
    setAba('lista');
    router.replace('/');
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={voltar} style={s.headerBack} accessibilityLabel="Voltar para a lista de atividades">
            <Ionicons name="arrow-back" size={22} color="#fff" />
            <Text style={s.headerBackText}>Voltar</Text>
          </TouchableOpacity>
        </View>
        <View style={s.headerMain}>
          <Text style={s.headerTitle}>Atividades</Text>
          {isAdmin && (
            <TouchableOpacity onPress={abrirCriar} style={s.headerAdd}>
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
                  {filhosCtxs.length === 1 ? filhosCtxs[0].membro_nome ?? 'Minha filha' : 'Meus filhos'}
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
            <TouchableOpacity key={t.id} style={[s.tab, abaMembro === t.id && s.tabAtiva]} onPress={() => setAbaMembro(t.id)}>
              <Text style={[s.tabText, abaMembro === t.id && s.tabTextAtiva]}>{t.label}</Text>
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
          <Text style={s.pendBannerText}>{pendentesFilhoCount} atividade(s) pendente(s) para {filhosCtxs.length === 1 ? filhosCtxs[0].membro_nome ?? 'sua filha' : 'seus filhos'}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a3a5c" />
      ) : aba === 'filhos' ? (
        <ScrollView contentContainerStyle={s.list}>
          {atividadesFilho.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="clipboard-outline" size={64} color="#c7d0d8" />
              <Text style={s.emptyText}>Nenhuma atividade encontrada para {filhosCtxs.length === 1 ? filhosCtxs[0].membro_nome ?? 'sua filha' : 'seus filhos'}</Text>
            </View>
          ) : null}
          {atividadesFilho.map(a => {
            const anexos = anexosMap[a.id] ?? [];
            return (
              <View key={a.id}>
                {filhosCtxs.map(filhoCtx => {
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

                      <TouchableOpacity style={s.detalhesBtn} onPress={() => abrirDetalhes(a)}>
                        <Ionicons name="document-text-outline" size={15} color="#1a3a5c" />
                        <Text style={s.detalhesBtnText}>Ver detalhes</Text>
                      </TouchableOpacity>
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

          {atividadesVisiveis.map(a => {
            const anexos = anexosMap[a.id] ?? [];
            const resps = respostasMap[a.id] ?? [];
            const minhaResp = respostaDoUsuario(a);
            const st = meuStatus(a);
            const respValidas = resps.filter(r => r.status !== 'recusada');
            const aguardandoAvaliacao = resps.filter(r => r.status === 'entregue').length;
            return (
              <View key={a.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitulo}>{a.titulo}</Text>
                    {a.data ? <Text style={s.cardData}>{fmt(a.data)}</Text> : null}
                  </View>
                  {isAdmin && (
                    <View style={s.acoesRow}>
                      <TouchableOpacity style={s.acaoBtn} onPress={() => abrirEditar(a)}>
                        <Ionicons name="pencil-outline" size={16} color="#1a3a5c" />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.acaoBtn} onPress={() => excluirAtividade(a)}>
                        <Ionicons name="trash-outline" size={16} color="#c62828" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {a.descricao ? <Text style={s.cardDesc} numberOfLines={3}>{a.descricao}</Text> : null}

                <View style={s.badgeRow}>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>
                      {alvoTexto(a)}
                    </Text>
                  </View>
                  {a.item_formativo_tipo && a.item_formativo_nome ? (
                    <View style={[s.badge, s.badgeFormativo]}>
                      <Text style={s.badgeText}>
                        {a.item_formativo_tipo === 'classe' ? 'Classe' : 'Especialidade'}: {a.item_formativo_nome}
                      </Text>
                    </View>
                  ) : null}
                  {a.avaliador_nome ? (
                    <View style={[s.badge, s.badgeAvaliador]}>
                      <Text style={s.badgeText}>Avaliador: {a.avaliador_nome}</Text>
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
                    <View style={s.respondidoBox}>
                      <Ionicons name={st === 'aprovada' ? 'checkmark-circle' : st === 'em_correcao' ? 'construct' : 'send'} size={16} color={statusColor(st as StatusResposta)} />
                      <Text style={[s.respondidoText, { color: statusColor(st as StatusResposta) }]}>{statusLabel(st as StatusResposta)}</Text>
                      {minhaResp.nota != null && <Text style={s.respPreview}>Nota: {minhaResp.nota}</Text>}
                      {minhaResp.comentario_avaliador ? <Text style={s.respPreview} numberOfLines={1}>{minhaResp.comentario_avaliador}</Text> : null}
                      {(st === 'entregue' || st === 'em_correcao' || st === 'recusada') && (
                        <TouchableOpacity onPress={() => abrirResponder(a)}>
                          <Text style={s.editarRespText}>Editar</Text>
                        </TouchableOpacity>
                      )}
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
          })}
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

      <Modal visible={modalCRUD} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalCRUD(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalCRUD(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={s.modalTitulo}>{editando ? 'Editar atividade' : 'Nova atividade'}</Text>
              <TouchableOpacity onPress={salvarAtividade} disabled={salvando}>
                {salvando ? <ActivityIndicator size="small" color="#1a3a5c" /> : <Text style={s.modalSalvar}>Salvar</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Título *</Text>
              <TextInput style={s.input} value={fTitulo} onChangeText={setFTitulo} placeholder="Título da atividade" autoFocus />

              <Text style={s.label}>Descrição</Text>
              <TextInput style={[s.input, s.textArea]} value={fDesc} onChangeText={setFDesc} placeholder="Descrição" multiline />

              <Text style={s.label}>Prazo de entrega</Text>
              <DateField value={fData} onChange={setFData} placeholder="Selecionar data" minimumDate={new Date(2026, 0, 1)} maximumDate={new Date(2035, 11, 31)} />

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
                    {itensFormativosFiltrados.length === 0 && (
                      <Text style={s.optionEmpty}>Nenhum item encontrado. Você pode digitar o nome manualmente.</Text>
                    )}
                  </View>
                </>
              )}

              <Text style={s.label}>Destino</Text>
              <View style={s.chipRow}>
                {(['todos', 'unidade', 'desbravador'] as const).map(d => (
                  <TouchableOpacity key={d} style={[s.chip, fDestino === d && s.chipAtivo]}
                    onPress={() => { setFDestino(d); setFUnidades([]); setFDbvs([]); setBuscaDbv(''); setBuscaUnidade(''); }}>
                    <Text style={[s.chipText, fDestino === d && s.chipTextAtivo]}>
                      {d === 'todos' ? 'Todos' : d === 'unidade' ? 'Unidades' : 'Desbravadores'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {fDestino === 'unidade' && (
                <>
                  <Text style={s.label}>Unidades ({fUnidades.length})</Text>
                  <View style={s.selectedWrap}>
                    {fUnidades.map(u => (
                      <TouchableOpacity key={u.id} style={s.selectedChip} onPress={() => toggleUnidade(u)}>
                        <Text style={s.selectedChipText}>{u.nome} ×</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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

              {fDestino === 'desbravador' && (
                <>
                  <Text style={s.label}>Desbravadores selecionados ({fDbvs.length})</Text>
                  <View style={s.selectedWrap}>
                    {fDbvs.map(d => (
                      <TouchableOpacity key={d.id} style={s.selectedChip} onPress={() => toggleDbv(d)}>
                        <Text style={s.selectedChipText}>{d.nome} ×</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput style={s.input} value={buscaDbv} onChangeText={setBuscaDbv} placeholder="Buscar por nome ou unidade" />
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
                      <Text style={s.optionEmpty}>Nenhum desbravador encontrado.</Text>
                    )}
                    {dbvsFiltrados.length > 50 && (
                      <Text style={s.optionEmpty}>Mostrando 50 primeiros. Use a busca para refinar.</Text>
                    )}
                  </View>
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
                  <TouchableOpacity onPress={() => setAnexosPend(p => p.filter((_, j) => j !== i))}>
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
                    <TouchableOpacity key={x.id} style={s.anexoPendItem} onPress={() => abrirAnexo(x)}>
                      {x.tipo === 'image'
                        ? <Image source={{ uri: x.url }} style={s.anexoPendThumb} />
                        : <Ionicons name={tipoIcon(x.tipo).name} size={22} color={tipoIcon(x.tipo).color} />}
                      <Text style={s.anexoPendNome} numberOfLines={1}>{x.nome}</Text>
                    </TouchableOpacity>
                  ))}
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
              <Text style={s.modalTitulo} numberOfLines={1}>Responder atividade</Text>
              <TouchableOpacity onPress={enviarResposta} disabled={enviandoResp}>
                {enviandoResp ? <ActivityIndicator size="small" color="#1a3a5c" /> : <Text style={s.modalSalvar}>Enviar</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              {respAtiv ? <Text style={s.modalSubtitulo}>{respAtiv.titulo}</Text> : null}
              <Text style={s.label}>Resposta</Text>
              <TextInput style={[s.input, s.textAreaLarge]} value={respTexto} onChangeText={setRespTexto} placeholder="Escreva sua resposta..." multiline autoFocus />

              <Text style={s.label}>Anexo opcional</Text>
              {respAnexo ? (
                <View style={s.anexoPendItem}>
                  {respAnexo.tipo === 'image'
                    ? <Image source={{ uri: respAnexo.uri }} style={s.anexoPendThumb} />
                    : <Ionicons name={tipoIcon(respAnexo.tipo).name} size={22} color={tipoIcon(respAnexo.tipo).color} />}
                  <Text style={s.anexoPendNome} numberOfLines={1}>{respAnexo.nome}</Text>
                  <TouchableOpacity onPress={() => setRespAnexo(null)}>
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

      <Modal visible={modalDetalhes} animationType="slide" presentationStyle="pageSheet" onRequestClose={fecharDetalhes}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={fecharDetalhes}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
            <Text style={s.modalTitulo} numberOfLines={1}>Detalhes da atividade</Text>
            <View style={{ width: 34 }} />
          </View>
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
                {(anexosMap[detalheAtiv.id] ?? []).length === 0 ? (
                  <Text style={s.optionEmpty}>Nenhum anexo cadastrado.</Text>
                ) : (
                  (anexosMap[detalheAtiv.id] ?? []).map((x) => (
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
                  ))
                )}

                {!isAdmin && (
                  <>
                    <Text style={s.label}>Sua entrega</Text>
                    {respostaDoUsuario(detalheAtiv) ? (
                      <View style={s.respondidoBox}>
                        <Text style={s.respondidoText}>{statusLabel(respostaDoUsuario(detalheAtiv)?.status)}</Text>
                        {respostaDoUsuario(detalheAtiv)?.texto ? (
                          <Text style={s.detalheTexto}>{respostaDoUsuario(detalheAtiv)?.texto}</Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={s.optionEmpty}>Ainda pendente.</Text>
                    )}
                    <TouchableOpacity style={s.responderBtn} onPress={() => { setModalDetalhes(false); abrirResponder(detalheAtiv); }}>
                      <Ionicons name="send-outline" size={15} color="#fff" />
                      <Text style={s.responderBtnText}>{respostaDoUsuario(detalheAtiv) ? 'Editar resposta' : 'Responder'}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={modalProg} animationType="slide" presentationStyle="pageSheet" onRequestClose={fecharProgresso}>
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
                  <Text style={[s.progStatNum, { color: '#2e7d32' }]}>{membrosStatus.filter(m => m.resposta).length}</Text>
                  <Text style={s.progStatLabel}>Entregues</Text>
                </View>
                <View style={[s.progStat, { backgroundColor: '#fff3e0' }]}>
                  <Text style={[s.progStatNum, { color: '#e65100' }]}>{membrosStatus.filter(m => !m.resposta).length}</Text>
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
                          {m.resposta.texto ? <Text style={s.progResp} numberOfLines={3}>{m.resposta.texto}</Text> : null}
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
                              <TouchableOpacity style={[s.avaliarBtn, { backgroundColor: '#e8f5e9' }]} onPress={() => abrirAvaliacao(progAtiv!, m.resposta!, 'aprovada')}>
                                <Text style={[s.avaliarText, { color: '#2e7d32' }]}>Aprovar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={[s.avaliarBtn, { backgroundColor: '#fff3e0' }]} onPress={() => abrirAvaliacao(progAtiv!, m.resposta!, 'em_correcao')}>
                                <Text style={[s.avaliarText, { color: '#ef6c00' }]}>Devolver</Text>
                              </TouchableOpacity>
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
        </View>
      </Modal>

      <Modal visible={modalAval} transparent animationType="fade" onRequestClose={() => setModalAval(false)}>
        <View style={s.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.avaliacaoBoxWrap}>
            <View style={s.avaliacaoBox}>
              <Text style={s.avaliacaoTitulo}>{avalStatus === 'aprovada' ? 'Aprovar entrega' : 'Devolver para correção'}</Text>
              <Text style={s.avaliacaoSub}>{avalResp?.dbv_nome}</Text>

              <Text style={s.label}>Status</Text>
              <View style={s.chipRow}>
                {(['aprovada', 'em_correcao', 'recusada'] as StatusResposta[]).map(st => (
                  <TouchableOpacity key={st} style={[s.chip, avalStatus === st && s.chipAtivo]} onPress={() => setAvalStatus(st)}>
                    <Text style={[s.chipText, avalStatus === st && s.chipTextAtivo]}>{statusLabel(st)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {avalStatus === 'aprovada' && (
                <>
                  <Text style={s.label}>Nota</Text>
                  <TextInput style={s.input} value={avalNota} onChangeText={setAvalNota} keyboardType="numeric" placeholder="Ex: 10" />
                </>
              )}

              <Text style={s.label}>Comentário</Text>
              <TextInput style={[s.input, s.textArea]} value={avalComentario} onChangeText={setAvalComentario} multiline placeholder="Orientação, correção ou observação" />

              <TouchableOpacity style={s.primaryBtn} onPress={salvarAvaliacao} disabled={salvandoAval}>
                {salvandoAval ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Salvar avaliação</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalAval(false)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
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
  tabText: { fontSize: 14, fontWeight: '700', color: '#999' },
  tabTextAtiva: { color: '#1a3a5c' },
  pendBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff3e0', paddingHorizontal: 16, paddingVertical: 10 },
  pendBannerText: { color: '#e65100', fontSize: 13, fontWeight: '700' },
  list: { padding: 16, gap: 12 },
  emptyWrap: { alignItems: 'center', marginTop: 72 },
  emptyText: { color: '#8b98a5', fontSize: 15, marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  cardAguardando: { borderWidth: 1.5, borderColor: '#90caf9' },
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
  badgeText: { fontSize: 12, fontWeight: '700', color: '#1a3a5c' },
  anexosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  anexoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f5f7fa', borderRadius: 8, padding: 6, maxWidth: 190 },
  anexoThumb: { width: 36, height: 36, borderRadius: 6 },
  anexoNome: { fontSize: 12, color: '#333', flex: 1 },
  respondidoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f6faf7', borderRadius: 10, padding: 10, marginTop: 4, flexWrap: 'wrap' },
  respondidoText: { fontSize: 13, fontWeight: '800' },
  respPreview: { fontSize: 12, color: '#555' },
  editarRespText: { fontSize: 12, color: '#1a3a5c', fontWeight: '700', textDecorationLine: 'underline' },
  responderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a3a5c', borderRadius: 10, padding: 11, marginTop: 8, justifyContent: 'center' },
  responderBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
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
  modalSalvar: { fontSize: 16, fontWeight: '800', color: '#1a3a5c' },
  modalScroll: { padding: 16 },
  detalheTitulo: { fontSize: 22, fontWeight: '900', color: '#0b2742', marginBottom: 4 },
  detalheTexto: { color: '#333', fontSize: 14, lineHeight: 21, marginTop: 6 },
  label: { fontSize: 12, fontWeight: '800', color: '#77838f', textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#dce3eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  textAreaLarge: { minHeight: 130, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#f0f4f8', borderWidth: 1.5, borderColor: '#dde4f0' },
  chipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#4d5966' },
  chipTextAtivo: { color: '#fff' },
  selectedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  selectedChip: { backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  selectedChipText: { color: '#2e7d32', fontWeight: '700', fontSize: 12 },
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
  addAnexoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: '#edf4fb', borderWidth: 1, borderColor: '#d7e5f3' },
  addAnexoText: { color: '#1a3a5c', fontWeight: '800' },
  anexoPendItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f5f7fa', borderRadius: 10, padding: 10, marginBottom: 8 },
  anexoPendThumb: { width: 42, height: 42, borderRadius: 8 },
  anexoPendNome: { flex: 1, fontWeight: '700', color: '#344150' },
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
  progPendente: { color: '#e65100', fontSize: 12, fontWeight: '800', marginTop: 4 },
  avaliarRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  avaliarBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  avaliarText: { fontSize: 12, fontWeight: '900' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 18 },
  avaliacaoBoxWrap: { width: '100%' },
  avaliacaoBox: { backgroundColor: '#fff', borderRadius: 18, padding: 18 },
  avaliacaoTitulo: { fontSize: 20, fontWeight: '900', color: '#1a3a5c' },
  avaliacaoSub: { color: '#7b8794', marginTop: 3, marginBottom: 8 },
  primaryBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelBtnText: { color: '#8b98a5', fontWeight: '800' },
  cardFilhoPendente: { borderLeftWidth: 4, borderLeftColor: '#ff6b35' },
  filhoStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  filhoStatusText: { fontSize: 11, fontWeight: '900' },
  filhoNomeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  filhoNomeText: { fontSize: 12, color: '#546e7a', fontWeight: '700' },
});

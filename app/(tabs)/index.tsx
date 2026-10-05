import { carregarAguardandoInvestidura } from '../../src/lib/investidura';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, PanResponder, Animated, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { useDBVStore } from '../../src/stores/dbvStore';
import { usePontuacaoStore } from '../../src/stores/pontuacaoStore';
import { puxarDeSupabase, sincronizarTudo } from '../../src/lib/sync';
import { getDB } from '../../src/lib/database';
import { popularBancoDeDados } from '../../src/lib/seed_local';
import { usePermissoes } from '../../src/lib/permissoes';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { supabase } from '../../src/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarCapitulos, obterDiaDeHoje, type DiaAnoBiblico } from '../../src/lib/anoBiblico';
import { Avatar, type BadgeFoto } from '../../src/components/common/Avatar';
import { TAMANHO_FOTO_CABECALHO, tomTexto } from '../../src/lib/tema';
import { useLinhaCabecalho } from '../../src/lib/marcaCabecalho';
import { CabecalhoTela, BotaoAtualizar } from '../../src/components/CabecalhoTela';
import { useFocoComCache } from '../../src/lib/cacheTela';
import { HeroInicio, PessoasCarrossel, ResumoCompacto, SaudacaoCabecalho } from '../../src/components/HomeHero';
import { carregarBadgesResponsaveis } from '../../src/lib/responsaveis';
import { carregarItensParaAprovar } from '../../src/lib/aprovacoesClube';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { carregarConfigRanking, anosEfetivosRanking } from '../../src/lib/rankingConfig';
import { CONFIG_FALTOSOS_PADRAO, entraNaContagemFaltosos, normalizarConfigFaltosos } from '../../src/lib/faltosos';
import { buscarPaginado } from '../../src/lib/supabasePaginado';
import { ClassesCarrossel, EspecialidadesConquistadas, classeAtualDe, useClassesMembro } from '../../src/components/HomeProgresso';
import { LeituraFlutuante } from '../../src/components/LeituraFlutuante';
import { estiloCartao } from '../../src/lib/tema';
import { Chip, TituloSecao } from '../../src/components/ui';
import { imagemDaClasse } from '../../src/lib/classesRequisitos';

interface MembroAlerta {
  id: number;
  nome: string;
  unidade_nome: string;
  faltas_consecutivas: number;
  foto_url?: string;
}

interface AtividadeItem {
  id: number;
  titulo: string;
  descricao: string | null;
  data: string | null;
  destino: string;
  unidade_nome: string | null;
  dbv_nome: string | null;
}

// Habilita LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Paleta para avatares
const AVATAR_CORES = [
  '#e74c3c','#e67e22','#f39c12','#2ecc71','#1abc9c',
  '#3498db','#9b59b6','#e91e63','#16a085','#d35400',
];
function avatarCor(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_CORES[Math.abs(h) % AVATAR_CORES.length];
}

function partesDataNascimento(dataNascimento?: string | null) {
  if (!dataNascimento) return null;
  const raw = String(dataNascimento).trim();
  let dia: number | null = null;
  let mes: number | null = null;
  let ano: number | null = null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else {
    const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (br) {
      dia = Number(br[1]);
      mes = Number(br[2]);
      ano = Number(br[3]);
      if (ano < 100) ano += ano > 30 ? 1900 : 2000;
    }
  }

  if (!dia || !mes || !ano || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return { dia, mes, ano };
}

function diasAteAniversario(dataNascimento?: string | null) {
  const partes = partesDataNascimento(dataNascimento);
  if (!partes) return null;
  const { mes, dia } = partes;
  const hojeBase = new Date();
  const hoje = new Date(hojeBase.getFullYear(), hojeBase.getMonth(), hojeBase.getDate());
  let prox = new Date(hoje.getFullYear(), mes - 1, dia);
  if (prox < hoje) prox = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  return Math.round((prox.getTime() - hoje.getTime()) / 86400000);
}

/**
 * Retorna qual dia da semana (0=dom … 6=sáb) cai o aniversário na semana
 * corrente (domingo a sábado), ou null se não cair nessa semana.
 */
function diasNaSemanaAtual(dataNascimento?: string | null): number | null {
  const partes = partesDataNascimento(dataNascimento);
  if (!partes) return null;
  const { mes, dia } = partes;
  const hojeBase  = new Date();
  const hoje      = new Date(hojeBase.getFullYear(), hojeBase.getMonth(), hojeBase.getDate());
  const diaSemana = hoje.getDay();                           // 0=Dom … 6=Sáb
  const domingo   = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diaSemana);
  const sabado    = new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() + 6);
  // Tenta o aniversário neste ano
  let niver = new Date(domingo.getFullYear(), mes - 1, dia);
  if (niver >= domingo && niver <= sabado)
    return Math.round((niver.getTime() - domingo.getTime()) / 86400000);
  // Trata semanas que cruzam a virada de ano (ex.: 29/dez → 4/jan)
  niver = new Date(domingo.getFullYear() + 1, mes - 1, dia);
  if (niver >= domingo && niver <= sabado)
    return Math.round((niver.getTime() - domingo.getTime()) / 86400000);
  return null;
}

function formatarAniversario(dataNascimento?: string | null) {
  const partes = partesDataNascimento(dataNascimento);
  if (!partes) return '';
  const { mes, dia } = partes;
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

function numeroOuNull(v: unknown) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numerosUnicos(valores: Array<number | null | undefined>) {
  return Array.from(new Set(valores.map(numeroOuNull).filter((n): n is number => n != null)));
}

function respostaContaComoPendente(
  resposta: { status?: string | null; reaberto_ate?: string | null } | null | undefined,
  prazoOriginal: string | null | undefined,
  hoje: string
) {
  const status = resposta?.status ?? null;
  if (status === 'aprovada' || status === 'entregue') return false;

  if (status === 'em_correcao' || status === 'recusada') {
    const prazoReabertura = resposta?.reaberto_ate ? resposta.reaberto_ate.slice(0, 10) : null;
    const prazo = prazoReabertura ?? (prazoOriginal ? prazoOriginal.slice(0, 10) : null);
    return !prazo || prazo >= hoje;
  }

  const prazo = prazoOriginal ? prazoOriginal.slice(0, 10) : null;
  return !prazo || prazo >= hoje;
}

/* ─── Definição dos atalhos ─────────────────────────────────────── */
interface ShortcutDef {
  id: string;
  icon: string;
  label: string;
  route: string;
  adminOnly: boolean;
  acesso?: 'pontuacao' | 'unidades' | 'membros' | 'relatorios' | 'mensagens' | 'admin_clube' | 'admin_ti';
}

const ALL_SHORTCUTS: ShortcutDef[] = [
  { id: 'ranking',    icon: 'trophy',              label: 'Ranking',   route: '/(tabs)/ranking',              adminOnly: false },
  { id: 'membros',    icon: 'people',              label: 'Membros',   route: '/(tabs)/membros',              adminOnly: false },
  { id: 'agenda',     icon: 'calendar',            label: 'Agenda',    route: '/(tabs)/calendario',           adminOnly: false },
  { id: 'pontuacao',  icon: 'checkmark-circle',    label: 'Pontuação', route: '/(tabs)/pontuacao',            adminOnly: true, acesso: 'pontuacao' },
  { id: 'extras',     icon: 'star',                label: 'Extras',    route: '/(tabs)/extras',               adminOnly: true, acesso: 'pontuacao' },
  { id: 'unidades',   icon: 'flag',                label: 'Unidades',  route: '/(tabs)/unidades',             adminOnly: true, acesso: 'unidades' },
  { id: 'importar',   icon: 'cloud-upload-outline', label: 'Importar', route: '/importar',                    adminOnly: true, acesso: 'membros' },
  { id: 'relatorios', icon: 'bar-chart',           label: 'Relatórios', route: '/relatorios',                  adminOnly: true, acesso: 'relatorios' },
  { id: 'preCadastros', icon: 'person-add',         label: 'Pré-cadastros', route: '/admin/pre-cadastros',      adminOnly: true, acesso: 'membros' },
  { id: 'aparencia',  icon: 'color-palette',       label: 'Aparência', route: '/admin/aparencia',             adminOnly: false },
  { id: 'modelos',    icon: 'options',             label: 'Modelos',   route: '/admin/modelos',               adminOnly: true, acesso: 'admin_clube' },
  { id: 'clubes',     icon: 'business',            label: 'Clubes',    route: '/admin/clubes',                adminOnly: true, acesso: 'admin_ti' },
  { id: 'classificacao', icon: 'star-outline',     label: 'Classificação', route: '/admin/classificacao',      adminOnly: true, acesso: 'admin_clube' },
  { id: 'rankingClubes', icon: 'ribbon',           label: 'Ranking Campo', route: '/admin/ranking-clubes',     adminOnly: true, acesso: 'admin_clube' },
  { id: 'auditoria',  icon: 'shield-checkmark',    label: 'Auditoria', route: '/admin/auditoria',             adminOnly: true, acesso: 'admin_clube' },
  { id: 'lgpd',       icon: 'document-text',       label: 'LGPD',      route: '/admin/lgpd',                  adminOnly: true, acesso: 'admin_clube' },
  { id: 'avisos',     icon: 'notifications',       label: 'Avisos',    route: '/mensagens',                   adminOnly: false },
  { id: 'mensagens',  icon: 'megaphone',           label: 'Mensagens', route: '/admin/mensagens',             adminOnly: true, acesso: 'mensagens' },
  { id: 'atividades',     icon: 'clipboard',           label: 'Atividades',    route: '/(tabs)/atividades',       adminOnly: false },
  { id: 'classeBiblica', icon: 'book',               label: 'Classe Bíblica', route: '/classe-biblica',         adminOnly: false },
  { id: 'permissoesAdmin', icon: 'lock-closed',        label: 'Permissões', route: '/admin/permissoes', adminOnly: true, acesso: 'admin_ti' },
  { id: 'classesBiblicasAdmin', icon: 'library',      label: 'Inserir Classe Bíblica', route: '/admin/classes-biblicas', adminOnly: true, acesso: 'admin_ti' },
  { id: 'anoBiblico',    icon: 'book-outline',       label: 'Ano Bíblico', route: '/ano-biblico',              adminOnly: false },
  { id: 'classes',       icon: 'ribbon',             label: 'Classes',       route: '/classes',                 adminOnly: false },
  { id: 'especialidades', icon: 'medal',             label: 'Especialidades', route: '/especialidades',         adminOnly: false },
  { id: 'regionais',     icon: 'shield-checkmark',   label: 'Regionais',     route: '/admin/regionais',         adminOnly: true, acesso: 'admin_clube' },
  { id: 'aprovacoes',    icon: 'checkmark-done-circle', label: 'Aprovações', route: '/admin/aprovacoes',      adminOnly: true },
  { id: 'perfil',        icon: 'person-circle',      label: 'Perfil',        route: '/perfil',                  adminOnly: false },
];

function ordenarAtalhosPorNome(atalhos: ShortcutDef[]) {
  return [...atalhos].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

// Nova chave: aplica a ordem alfabetica uma vez, sem reaproveitar ordens antigas.
const ORDER_KEY = 'shortcuts_order_v2';

/* ─── Componente principal ──────────────────────────────────────── */
export default function DashboardScreen() {
  const { abaFaltosos } = useLocalSearchParams<{ abaFaltosos?: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const contextos = useContextoStore((s) => s.contextos);
  const { desbravadores, carregar } = useDBVStore();
  const { getRankingGeral } = usePontuacaoStore();
  const [meuTotal,  setMeuTotal]  = useState(0);
  const [minhaPos,  setMinhaPos]  = useState<number | null>(null);
  // Mesma configuração ("sem lista completa, Desbravadores e Pais podem
  // ver") usada no card restrito da tela de Ranking — precisa valer aqui
  // também, senão esse card do dashboard sempre mostra os dois independente
  // do que o admin configurou.
  const [mostrarMinhaPosicaoDashboard, setMostrarMinhaPosicaoDashboard] = useState(false);
  const [mostrarMinhaPontuacaoDashboard, setMostrarMinhaPontuacaoDashboard] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sincStatus, setSincStatus] = useState<'idle' | 'ok' | 'offline'>('idle');
  const [atividadesRecentes, setAtividadesRecentes] = useState<AtividadeItem[]>([]);
  const [atividadesPendentes, setAtividadesPendentes] = useState(0);
  const [atividadesParaCorrigir, setAtividadesParaCorrigir] = useState(0);
  const [avisosNaoLidos, setAvisosNaoLidos] = useState(0);
  const [aprovacoesPendentes, setAprovacoesPendentes] = useState(0);
  const [abaCard, setAbaCard] = useState<'aniversarios' | 'alertas'>('aniversarios');
  const [membrosAusentesAlerta, setMembrosAusentesAlerta] = useState<MembroAlerta[]>([]);
  const [badgesResp, setBadgesResp] = useState<Map<number, BadgeFoto[]>>(new Map());
  const [diaAnoBiblico, setDiaAnoBiblico] = useState<DiaAnoBiblico | null>(null);

  useEffect(() => {
    if (abaFaltosos === '1') setAbaCard('alertas');
  }, [abaFaltosos]);
  const isAdmin = permissoes.podeAlguma([
    'gerenciar_membros',
    'gerenciar_pontuacao',
    'gerenciar_unidades',
    'gerenciar_agenda',
  ]);
  const podeVerAniversarios = permissoes.podeAlguma([
    'gerenciar_membros',
    'gerenciar_unidades',
    'gerenciar_pontuacao',
    'gerenciar_atividades',
  ]);
  const isAdminTi = permissoes.pode('gerenciar_clubes');
  const podeVerAprovacoes = permissoes.temPerfil(['admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria', 'usuario_regional']);
  const podeVerMenuAdminClube = permissoes.temPerfil(['admin_ti', 'admin_clube']);
  const contextosMesmoClube = useMemo(
    () => contextos.filter((c) => Number(c.clube_id) === Number(contextoAtivo?.clube_id)),
    [contextos, contextoAtivo?.clube_id]
  );
  const ehResponsavelPuroNoClube = contextosMesmoClube.length > 0 && contextosMesmoClube.every((c) => c.tipo === 'responsavel');
  // Cor de cabeçalho compartilhada com todas as telas (ver aparenciaStore) —
  // antes era calculada só aqui, então só a Início acompanhava a
  // personalização e o cabeçalho mudava de tom ao trocar de tela.
  const cabecalhoVisual = useCorCabecalho();
  const cores = useCores();
  const hojeBruto = format(new Date(), 'EEEE, dd/MM/yyyy', { locale: ptBR });
  const hoje = hojeBruto.charAt(0).toLocaleUpperCase('pt-BR') + hojeBruto.slice(1);
  const aniversariosSemana = useMemo(() => (
    desbravadores
      .map((m) => ({
        ...m,
        dias:      diasAteAniversario(m.data_nascimento),   // mantido para detectar "hoje" (= 0)
        diasSemana: diasNaSemanaAtual(m.data_nascimento),   // posição 0-6 dentro da semana corrente (dom-sáb)
      }))
      .filter((m) => m.diasSemana !== null)
      .sort((a, b) => Number(a.diasSemana) - Number(b.diasSemana) || a.nome.localeCompare(b.nome, 'pt-BR'))
  ), [desbravadores]);

  // O Regional acompanha apenas classes/especialidades dos clubes vinculados.
  const ehRegional = permissoes.temPerfil(['usuario_regional']);

  // Atalhos filtrados e ordenados
  const shortcuts = ALL_SHORTCUTS.filter((s) => {
    if (ehRegional) return s.id === 'classes' || s.id === 'perfil';
    if (!s.adminOnly) return true;
    if (ehResponsavelPuroNoClube) return false;
    if (s.acesso === 'admin_ti') return isAdminTi;
    if (s.acesso === 'admin_clube') return podeVerMenuAdminClube;
    if (s.acesso === 'pontuacao') return permissoes.pode('gerenciar_pontuacao');
    if (s.acesso === 'unidades') return permissoes.pode('gerenciar_unidades');
    if (s.acesso === 'membros') return permissoes.pode('gerenciar_membros');
    if (s.acesso === 'relatorios') return permissoes.pode('ver_relatorios');
    if (s.acesso === 'mensagens') return permissoes.pode('enviar_mensagens');
    if (s.id === 'aprovacoes') return podeVerAprovacoes;
    return isAdmin;
  });
  const atalhosVisiveisKey = shortcuts.map((s) => s.id).join('|');
  const [ordem, setOrdem] = useState<string[]>(() => ordenarAtalhosPorNome(shortcuts).map((s) => s.id));
  const [reordenando, setReordenando] = useState(false);

  useEffect(() => {
    async function init() {
      await carregar();
      await carregarDados();
    }
    init();
  }, []);

  // O contexto/perfil termina de carregar depois do primeiro render.
  // Recalcula os atalhos quando as permissoes liberarem novas opcoes.
  useEffect(() => {
    carregarOrdem();
  }, [atalhosVisiveisKey]);

  useEffect(() => {
    carregarAlertasFaltas();
  }, [desbravadores, podeVerAniversarios]);

  useEffect(() => {
    const menores = desbravadores.filter((d) => d.idade < 16).map((d) => d.id);
    if (menores.length === 0) { setBadgesResp(new Map()); return; }
    carregarBadgesResponsaveis(menores).then(setBadgesResp);
  }, [desbravadores]);

  const carregarInicio = useCallback(async () => {
    async function initLocal() {
      await carregar();
      await carregarDados();
      await carregarAtividadesRecentes();
      await carregarPendentes();
      await carregarAvisosNaoLidos();
      carregarAprovacoesPendentes();
      await carregarDiaAnoBiblico();
    }
    await initLocal();
    // Puxada do servidor: o próprio puxarDeSupabase só roda a cada 5 min.
    try {
      if (await puxarDeSupabase()) await initLocal();
    } catch {}
  }, [isAdmin, permissoes.ehMembroComum, usuario, contextoAtivo?.id, contextoAtivo?.membro_id]);

  const atualizarInicio = useFocoComCache(
    `inicio:${contextoAtivo?.id ?? ''}:${contextoAtivo?.membro_id ?? ''}:${usuario?.id ?? ''}`,
    carregarInicio,
    90_000,
  );
  const atualizarAgora = useCallback(async () => {
    await puxarDeSupabase({ forcar: true }).catch(() => {});
    await atualizarInicio();
  }, [atualizarInicio]);

  async function carregarDiaAnoBiblico() {
    try {
      setDiaAnoBiblico(await obterDiaDeHoje());
    } catch {}
  }

  async function carregarAtividadesRecentes() {
    if (Platform.OS === 'web') return;
    try {
      const db = await getDB();
      let rows: AtividadeItem[];
      if (isAdmin) {
        rows = await db.getAllAsync<AtividadeItem>(
          'SELECT id, titulo, descricao, data, destino, unidade_nome, dbv_nome FROM atividades ORDER BY created_at DESC LIMIT 3'
        );
      } else {
        rows = await db.getAllAsync<AtividadeItem>(
          `SELECT id, titulo, descricao, data, destino, unidade_nome, dbv_nome FROM atividades
           WHERE destino='todos'
              OR (destino='unidade' AND unidade_id=?)
              OR (destino='desbravador' AND dbv_id=?)
           ORDER BY created_at DESC LIMIT 3`,
          [usuario?.unidade_id ?? -1, usuario?.dbv_id ?? -1]
        );
      }
      setAtividadesRecentes(rows);
    } catch {}
  }

  async function carregarPendentes() {
    if (!usuario?.id) {
      setAtividadesPendentes(0);
      setAtividadesParaCorrigir(0);
      return;
    }
    try {
      const clubeId = getClubeAtivoId();
      const hojeIso = new Date().toISOString().slice(0, 10);
      const pendentes = new Set<string>();

      const [{ data: atividades }, { data: alvos }] = await Promise.all([
        supabase.from('atividades').select('id,destino,unidade_id,dbv_id,data').eq('clube_id', clubeId),
        supabase.from('atividades_alvos').select('atividade_id,tipo,unidade_id,membro_id').eq('clube_id', clubeId),
      ]);

      const atividadesLista = ((atividades ?? []) as any[]).map((a) => ({ ...a, id: Number(a.id) }));
      const alvosPorAt = new Map<number, any[]>();
      const prazoPorAt = new Map<number, string | null>();
      for (const al of (alvos ?? []) as any[]) {
        const id = Number(al.atividade_id);
        if (!alvosPorAt.has(id)) alvosPorAt.set(id, []);
        alvosPorAt.get(id)!.push(al);
      }
      for (const a of atividadesLista) prazoPorAt.set(Number(a.id), a.data ?? null);

      const membroId = contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;
      const unidadeId = contextoAtivo?.unidade_id ?? usuario?.unidade_id ?? null;

      if (membroId) {
        const ids = atividadesLista
          .filter((a: any) => {
            const lista = alvosPorAt.get(Number(a.id)) ?? [];
            if (lista.length > 0) {
              return lista.some((al: any) =>
                al.tipo === 'todos' ||
                (al.tipo === 'unidade' && Number(al.unidade_id) === Number(unidadeId)) ||
                (al.tipo === 'membro' && Number(al.membro_id) === Number(membroId))
              );
            }
            return a.destino === 'todos' ||
              (a.destino === 'unidade' && Number(a.unidade_id) === Number(unidadeId)) ||
              (a.destino === 'desbravador' && Number(a.dbv_id) === Number(membroId));
          })
          .map((a: any) => Number(a.id));

        if (ids.length > 0) {
          const respostas = await buscarPaginado(
            (q) => q.eq('clube_id', clubeId).eq('dbv_id', membroId).in('atividade_id', ids),
            'atividades_respostas',
            'atividade_id,status,reaberto_ate',
          );
          const respostaPorAt = new Map<number, any>();
          for (const r of (respostas ?? []) as any[]) respostaPorAt.set(Number(r.atividade_id), r);
          for (const id of ids) {
            if (respostaContaComoPendente(respostaPorAt.get(id), prazoPorAt.get(id), hojeIso)) {
              pendentes.add(`${id}:${Number(membroId)}`);
            }
          }
        }
      }

      const responsavelCtxs = contextos.filter(c => c.tipo === 'responsavel' && Number(c.clube_id) === Number(clubeId) && c.membro_id != null);
      const filhosIds = numerosUnicos(responsavelCtxs.map(c => c.membro_id));
      if (filhosIds.length > 0) {
        const filhosData = await buscarPaginado(
          (q) => q.eq('clube_id', clubeId).in('id', filhosIds),
          'desbravadores',
          'id,unidade_id',
        );
        const unidadePorFilho = new Map<number, number | null>();
        for (const ctx of responsavelCtxs) unidadePorFilho.set(Number(ctx.membro_id), numeroOuNull(ctx.unidade_id));
        for (const filho of (filhosData ?? []) as any[]) unidadePorFilho.set(Number(filho.id), numeroOuNull(filho.unidade_id));

        const pares = atividadesLista.flatMap((a: any) => {
          const atId = Number(a.id);
          const lista = alvosPorAt.get(atId) ?? [];
          return filhosIds
            .filter((filhoId) => {
              const unidadeFilho = unidadePorFilho.get(Number(filhoId));
              if (lista.length > 0) {
                return lista.some((al: any) =>
                  al.tipo === 'todos' ||
                  (al.tipo === 'unidade' && unidadeFilho != null && Number(al.unidade_id) === Number(unidadeFilho)) ||
                  (al.tipo === 'membro' && Number(al.membro_id) === Number(filhoId))
                );
              }
              return a.destino === 'todos' ||
                (a.destino === 'unidade' && unidadeFilho != null && Number(a.unidade_id) === Number(unidadeFilho)) ||
                (a.destino === 'desbravador' && Number(a.dbv_id) === Number(filhoId));
            })
            .map((filhoId) => ({ atividadeId: atId, filhoId: Number(filhoId) }));
        });

        const idsAtividadesFilhos = Array.from(new Set(pares.map((par) => par.atividadeId)));
        if (pares.length > 0) {
          const respostas = await buscarPaginado(
            (q) => q.eq('clube_id', clubeId).in('dbv_id', filhosIds).in('atividade_id', idsAtividadesFilhos),
            'atividades_respostas',
            'atividade_id,dbv_id,status,reaberto_ate',
          );
          const respostaPorPar = new Map<string, any>();
          for (const r of respostas as any[]) respostaPorPar.set(`${r.atividade_id}:${r.dbv_id}`, r);
          for (const par of pares) {
            const resposta = respostaPorPar.get(`${par.atividadeId}:${par.filhoId}`);
            if (respostaContaComoPendente(resposta, prazoPorAt.get(par.atividadeId), hojeIso)) {
              pendentes.add(`${par.atividadeId}:${par.filhoId}`);
            }
          }
        }
      }

      setAtividadesPendentes(pendentes.size);

      if (permissoes.pode('gerenciar_atividades')) {
        // count no servidor: trazer os ids pra contar com .length parava em
        // mil e subnotificava a fila de correção.
        const { count } = await supabase
          .from('atividades_respostas')
          .select('id', { count: 'exact', head: true })
          .eq('clube_id', clubeId)
          .eq('status', 'entregue');
        setAtividadesParaCorrigir(count ?? 0);
      } else {
        const { data: minhasAts } = await supabase
          .from('atividades')
          .select('id')
          .eq('clube_id', clubeId)
          .eq('avaliador_id', usuario.id);
        const idsMinhasAts = ((minhasAts ?? []) as any[]).map((a: any) => Number(a.id));
        if (idsMinhasAts.length === 0) {
          setAtividadesParaCorrigir(0);
        } else {
          const { count } = await supabase
            .from('atividades_respostas')
            .select('id', { count: 'exact', head: true })
            .eq('clube_id', clubeId)
            .eq('status', 'entregue')
            .in('atividade_id', idsMinhasAts);
          setAtividadesParaCorrigir(count ?? 0);
        }
      }
    } catch {
      setAtividadesPendentes(0);
      setAtividadesParaCorrigir(0);
    }
  }

  async function carregarAprovacoesPendentes() {
    if (!podeVerAprovacoes) { setAprovacoesPendentes(0); return; }
    try {
      const itens = await carregarItensParaAprovar(getClubeAtivoId());
      let aguardando = 0;
      try { aguardando = (await carregarAguardandoInvestidura(getClubeAtivoId())).length; } catch { /* sem migration */ }
      setAprovacoesPendentes(itens.length + aguardando);
    } catch {
      setAprovacoesPendentes(0);
    }
  }

  async function carregarAvisosNaoLidos() {
    if (!usuario?.id) {
      setAvisosNaoLidos(0);
      return;
    }
    try {
      const clubeId = getClubeAtivoId();
      const [msgsRes, lidosRes, ocultosRes, alertasRes] = await Promise.all([
        supabase
          .from('mensagens_clube')
          .select('id')
          .eq('clube_id', clubeId)
          .limit(500),
        supabase
          .from('mensagens_clube_lidos')
          .select('mensagem_id')
          .eq('usuario_id', usuario.id),
        supabase
          .from('mensagens_clube_ocultos')
          .select('mensagem_id')
          .eq('usuario_id', usuario.id),
        supabase
          .from('alertas_usuarios')
          .select('id')
          .eq('usuario_id', usuario.id)
          .eq('clube_id', clubeId)
          .is('lido_em', null)
          .is('oculto_em', null),
      ]);

      const lidosSet = new Set(((lidosRes.data ?? []) as any[]).map((r) => String(r.mensagem_id)));
      const ocultosSet = new Set(((ocultosRes.data ?? []) as any[]).map((r) => String(r.mensagem_id)));
      const naoLidos = ((msgsRes.data ?? []) as any[])
        .map((m) => String(m.id))
        .filter((id) => !lidosSet.has(id) && !ocultosSet.has(id));
      setAvisosNaoLidos(naoLidos.length + (alertasRes.data?.length ?? 0));
    } catch {
      setAvisosNaoLidos(0);
    }
  }

  async function carregarAlertasFaltas() {
    if (!podeVerAniversarios || desbravadores.length === 0) return;
    try {
      const clubeId = getClubeAtivoId();
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 120);
      // Paginado: 120 dias de lançamentos do clube passam de mil linhas.
      const [rows, { data: cfgClube }] = await Promise.all([
        buscarPaginado(
          (q) => q.eq('clube_id', clubeId).gte('data', dataLimite.toISOString().slice(0, 10)),
          'pontuacoes',
          'data, dbv_id, presenca',
        ),
        supabase.from('clubes').select('min_faltas_faltosos').eq('id', clubeId).single(),
      ]);
      const limiar = Math.max(1, (cfgClube as any)?.min_faltas_faltosos ?? 3);

      // Quem entra na contagem (config do clube). Tolerante: sem a coluna ou sem
      // resposta, vale o padrão (todos os ativos).
      let cfgFaltosos = CONFIG_FALTOSOS_PADRAO;
      try {
        const { data } = await supabase.from('clubes').select('config_faltosos').eq('id', clubeId).maybeSingle();
        cfgFaltosos = normalizarConfigFaltosos((data as any)?.config_faltosos);
      } catch { /* mantém o padrão */ }
      let candidatos: { id: number; nome: string; unidade_nome?: string | null; foto_url?: string | null; ativo?: boolean | null }[] = desbravadores;
      if (cfgFaltosos.inativos) {
        try {
          const { data: inativos } = await supabase
            .from('desbravadores')
            .select('id,nome,unidade_nome,foto_url,ativo')
            .eq('clube_id', clubeId)
            .eq('ativo', false);
          candidatos = [...desbravadores, ...((inativos ?? []) as any[])];
        } catch { /* sem inativos */ }
      }
      candidatos = candidatos.filter((m) => entraNaContagemFaltosos(m, cfgFaltosos));

      if (!rows || rows.length === 0) { setMembrosAusentesAlerta([]); return; }

      // Datas com pelo menos 1 presente = dias de reunião reais
      const datasComPresenca = new Set<string>();
      for (const p of rows as any[]) {
        if (p.presenca) datasComPresenca.add(p.data);
      }
      const diasReuniao = Array.from(datasComPresenca).sort((a, b) => b.localeCompare(a));
      if (diasReuniao.length < limiar) { setMembrosAusentesAlerta([]); return; }

      // Monta mapa de presença por membro
      const presencaMap = new Map<number, Map<string, boolean>>();
      for (const p of rows as any[]) {
        const id = Number(p.dbv_id);
        if (!presencaMap.has(id)) presencaMap.set(id, new Map());
        presencaMap.get(id)!.set(p.data, !!p.presenca);
      }

      // Para cada desbravador, conta faltas consecutivas a partir da reunião mais recente
      const alertas: MembroAlerta[] = [];
      for (const dbv of candidatos) {
        const registros = presencaMap.get(dbv.id) ?? new Map<string, boolean>();
        let consecutivas = 0;
        for (const dia of diasReuniao) {
          if (registros.get(dia) === true) break;
          consecutivas++;
        }
        if (consecutivas >= limiar) {
          alertas.push({
            id: dbv.id,
            nome: dbv.nome,
            unidade_nome: dbv.unidade_nome || 'Sem unidade',
            faltas_consecutivas: consecutivas,
            foto_url: dbv.foto_url ?? undefined,
          });
        }
      }
      alertas.sort((a, b) => b.faltas_consecutivas - a.faltas_consecutivas || a.nome.localeCompare(b.nome, 'pt-BR'));
      setMembrosAusentesAlerta(alertas);
    } catch {
      setMembrosAusentesAlerta([]);
    }
  }

  async function carregarOrdem() {
    try {
      const saved = await AsyncStorage.getItem(ORDER_KEY);
      const visiveisOrdenados = ordenarAtalhosPorNome(shortcuts).map((s) => s.id);
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        // Mantem personalizacoes posteriores; novos atalhos entram alfabeticamente no final.
        const merged = [
          ...ids.filter((id) => visiveisOrdenados.includes(id)),
          ...visiveisOrdenados.filter((id) => !ids.includes(id)),
        ];
        setOrdem(merged);
      } else {
        setOrdem(visiveisOrdenados);
      }
    } catch {}
  }

  async function salvarOrdem(nova: string[]) {
    setOrdem(nova);
    await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(nova));
  }

  async function carregarDados() {
    if (Platform.OS === 'web' && isAdmin && !permissoes.ehMembroComum) return;
    setMostrarMinhaPosicaoDashboard(false);
    setMostrarMinhaPontuacaoDashboard(false);
    const db = await getDB();
    const totalLocal = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM desbravadores');
    if (!totalLocal || totalLocal.n === 0) {
      await popularBancoDeDados();
      puxarDeSupabase({ forcar: true }).catch(() => {});
      await carregar();
    }

    // No contexto de responsável o card mostra o filho(a), não a ficha do próprio
    // usuário (mesma regra da tela de Ranking).
    const membroAlvoId = contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;
    if (membroAlvoId) {
      // Mesmo filtro de anos usado na tela de Ranking, senão o card "minha
      // pontuação" mostra um número diferente do ranking pro mesmo membro.
      let configRanking;
      try {
        configRanking = await carregarConfigRanking(getClubeAtivoId());
      } catch (erro) {
        console.log('Erro ao carregar configuracao do ranking', erro);
        return;
      }
      const anos = anosEfetivosRanking(configRanking);
      // Mesmo critério da tela de Ranking: "não tem permissão de equipe"
      // em vez de conferir nomes de perfil (ver PERMISSOES_EQUIPE).
      const ehMembroComum = permissoes.ehMembroComum;
      setMostrarMinhaPosicaoDashboard(!ehMembroComum || configRanking.membros_ve_posicao);
      setMostrarMinhaPontuacaoDashboard(!ehMembroComum || configRanking.membros_ve_pontuacao);
      const ranking = await getRankingGeral(undefined, anos);
      const idx = ranking.findIndex((r) => Number(r.dbv_id) === Number(membroAlvoId));
      if (idx >= 0) { setMeuTotal(ranking[idx].total); setMinhaPos(idx + 1); }
      else { setMeuTotal(0); setMinhaPos(null); }
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    const result = await sincronizarTudo();
    await puxarDeSupabase({ forcar: true });
    setSincStatus(result.sucesso ? 'ok' : 'offline');
    await carregar();
    await carregarDados();
    await carregarAtividadesRecentes();
    await carregarPendentes();
    await carregarAvisosNaoLidos();
    setRefreshing(false);
    setTimeout(() => setSincStatus('idle'), 3000);
  }

  // Ordem visual dos atalhos
  const shortcutsOrdenados = ordem
    .map((id) => shortcuts.find((s) => s.id === id))
    .filter(Boolean) as ShortcutDef[];

  // Mover para cima/baixo (reordenar)
  function moverItem(idx: number, dir: -1 | 1) {
    const nova = [...ordem];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= nova.length) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    [nova[idx], nova[newIdx]] = [nova[newIdx], nova[idx]];
    salvarOrdem(nova);
  }

  const nomeUsuario = usuario?.nome?.split(' ')[0] ?? 'Usuário';
  const avatarColor = avatarCor(usuario?.nome ?? 'U');
  const temFilhosVinculados = contextos.some((c) => c.tipo === 'responsavel');
  const comoResponsavel = contextoAtivo?.tipo === 'responsavel';
  const meuDbvId = contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;
  const classesMembro = useClassesMembro();
  const classeAtualMembro = classeAtualDe(classesMembro);
  // Ícones dos atalhos (.quick .ico): fundo suave, ciano claro e pêssego, em ciclo.
  const icoTom = (i: number) => {
    const n = i % 3;
    if (cores.isEscuro) return n === 1 ? { fundo: '#83ddd9', cor: '#153d44' } : n === 2 ? { fundo: '#f7d087', cor: '#543916' } : { fundo: '#44305f', cor: '#dec7ff' };
    return n === 1 ? { fundo: '#c9f7f5', cor: '#432958' } : n === 2 ? { fundo: '#ffe3aa', cor: '#432958' } : { fundo: cores.acentoSuave, cor: '#432958' };
  };
  const nomeFilho = contextoAtivo?.membro_nome ?? null;
  const primeiroNomeFilho = nomeFilho?.split(' ')[0] ?? null;
  const nomeBruto = (comoResponsavel && primeiroNomeFilho ? primeiroNomeFilho : nomeUsuario) ?? '';
  const nomeCabecalho = nomeBruto.charAt(0).toLocaleUpperCase('pt-BR') + nomeBruto.slice(1).toLocaleLowerCase('pt-BR');
  // Como responsável, o avatar do topo é o do filho(a) do contexto (com o selo
  // de responsável), e não a foto de quem está logado.
  const filhoDoContexto = comoResponsavel
    ? desbravadores.find((d) => Number(d.id) === Number(contextoAtivo?.membro_id))
    : undefined;
  // Foto da própria conta (responsável) ou, se logado como desbravador/
  // aventureiro/líder com ficha vinculada, a foto dessa ficha — pra bater com
  // a mesma foto trocada em "Meu perfil" ou na ficha do membro.
  const usuarioFotoUrl = usuario?.foto_url
    ?? desbravadores.find((d) => d.id === usuario?.dbv_id)?.foto_url
    ?? undefined;

  if (!usuario) return null;

  return (
    <View style={[styles.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela
        titulo="Início"
        acoes={<BotaoAtualizar aoAtualizar={atualizarAgora} />}
        conteudo={(
          <SaudacaoCabecalho
            nome={comoResponsavel ? (primeiroNomeFilho ?? nomeCabecalho) : nomeCabecalho}
            fotoUrl={comoResponsavel ? (filhoDoContexto?.foto_url ?? usuarioFotoUrl) : usuarioFotoUrl}
            data={hoje}
            clube={contextoAtivo?.clube_nome_curto ?? contextoAtivo?.clube_nome ?? null}
            responsavel={comoResponsavel ? (usuario?.nome ?? null) : null}
            aoAbrirPerfil={usuario ? () => router.push('/perfil') : undefined}
          />
        )}
      />

      <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      {sincStatus === 'ok' && (
        <View style={[styles.sincBanner, { backgroundColor: '#2e7d32' }]}>
          <Ionicons name="cloud-done" size={16} color="#fff" />
          <Text style={styles.sincText}>Dados sincronizados</Text>
        </View>
      )}
        {sincStatus === 'offline' && (
        <View style={[styles.sincBanner, { backgroundColor: '#e65100' }]}>
          <Ionicons name="cloud-offline" size={16} color="#fff" />
          <Text style={styles.sincText}>Sem internet — dados salvos offline</Text>
        </View>
      )}

      <View style={styles.content}>
        <HeroInicio
          nome={comoResponsavel ? (primeiroNomeFilho ?? nomeCabecalho) : nomeCabecalho}
          data={hoje}
          fotoUrl={comoResponsavel ? (filhoDoContexto?.foto_url ?? usuarioFotoUrl) : usuarioFotoUrl}
          corAvatar={comoResponsavel ? avatarCor(nomeFilho ?? filhoDoContexto?.nome ?? 'U') : avatarColor}
          responsavel={comoResponsavel ? (usuario?.nome ?? null) : null}
          pontos={permissoes.ehMembroComum && minhaPos !== null && mostrarMinhaPontuacaoDashboard ? meuTotal : null}
          posicao={permissoes.ehMembroComum && minhaPos !== null && mostrarMinhaPosicaoDashboard ? minhaPos : null}
          rotuloPontos={comoResponsavel && primeiroNomeFilho ? `Pontuação de ${primeiroNomeFilho}` : 'Minha pontuação'}
          aoAbrirPerfil={usuario ? () => router.push('/perfil') : undefined}
          aoAbrirExtrato={meuDbvId ? () => router.push(`/extrato/${meuDbvId}` as any) : undefined}
          classeAtual={classeAtualMembro ? { label: classeAtualMembro.label, pct: classeAtualMembro.pct, emblema: imagemDaClasse(classeAtualMembro.classe, classeAtualMembro.avancada) } : null}
          aoAbrirClasse={meuDbvId && classeAtualMembro ? () => router.push(`/classes/${meuDbvId}?chave=${encodeURIComponent(classeAtualMembro.chave)}` as any) : undefined}
        />

        {isAdmin && (
          <ResumoCompacto itens={[
            { valor: desbravadores.length, rotulo: 'Membros' },
            { valor: desbravadores.filter((d) => d.unidade_nome === 'Diretoria').length, rotulo: 'Diretoria' },
            { valor: desbravadores.filter((d) => d.unidade_nome && d.unidade_nome !== 'Diretoria').length, rotulo: 'Desbravadores' },
          ]} />
        )}

        {(contextos.length > 1 || temFilhosVinculados) && (
          <View style={styles.contextoLinha}>
            {contextos.length > 1 && (
              <TouchableOpacity
                style={[styles.contextoMeio, estiloCartao(cores, 17), { boxShadow: `0px 3px 0px ${cores.sombra}` }]}
                onPress={() => router.push('/auth/contexto' as any)}
                accessibilityRole="button"
                accessibilityLabel={`Acessando como ${contextoAtivo?.perfil_nome ?? 'perfil'}. Trocar de contexto`}
              >
                <View style={[styles.contextoIcon, { backgroundColor: cores.acentoSuave }]}>
                  <Ionicons name="swap-horizontal" size={18} color={cores.acento} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.contextoTitulo, { color: cores.texto }]} numberOfLines={1}>{contextoAtivo?.perfil_nome ?? 'Perfil'}</Text>
                  <Text style={[styles.contextoSub, { color: cores.textoSecundario }]} numberOfLines={1}>
                    {comoResponsavel && nomeFilho ? `${nomeFilho.split(' ')[0]} · ` : ''}{contextoAtivo?.clube_nome_curto ?? contextoAtivo?.clube_nome ?? 'Trocar contexto'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {temFilhosVinculados && (
              <TouchableOpacity
                style={[styles.contextoMeio, estiloCartao(cores, 17), { boxShadow: `0px 3px 0px ${cores.sombra}` }]}
                onPress={() => router.push('/auth/contexto' as any)}
                accessibilityRole="button"
                accessibilityLabel="Meus filhos. Trocar para o contexto de responsável"
              >
                <View style={[styles.contextoIcon, { backgroundColor: cores.isEscuro ? '#4e371b' : '#ffe3aa' }]}>
                  <Ionicons name="people-circle" size={20} color={cores.isEscuro ? '#ffcc80' : '#432958'} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.contextoTitulo, { color: cores.texto }]} numberOfLines={1}>Meus filhos</Text>
                  <Text style={[styles.contextoSub, { color: cores.textoSecundario }]} numberOfLines={1}>Trocar contexto</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!reordenando && (
          <>
            <ClassesCarrossel itens={classesMembro} />
            <EspecialidadesConquistadas />
          </>
        )}

        {podeVerAniversarios && (
          <>
            <PessoasCarrossel
              titulo="🎂 Aniversariantes da semana"
              pessoas={aniversariosSemana.map((m) => ({ id: m.id, nome: m.nome, foto_url: m.foto_url, detalhe: m.dias === 0 ? 'Hoje' : formatarAniversario(m.data_nascimento), badges: badgesResp.get(m.id) }))}
              aoAbrir={(p) => router.push(`/membro/${p.id}` as any)}
            />
            <PessoasCarrossel
              titulo="💬 Sentimos sua falta"
              pessoas={membrosAusentesAlerta.map((m) => ({ id: m.id, nome: m.nome, foto_url: m.foto_url, detalhe: `${m.faltas_consecutivas} ${m.faltas_consecutivas === 1 ? 'falta' : 'faltas'}`, badges: badgesResp.get(m.id) }))}
              aoAbrir={(p) => router.push(`/membro/${p.id}` as any)}
              aoVerTodas={() => router.push('/relatorios' as any)}
            />
          </>
        )}

        {/* Acesso rápido */}
        <View style={styles.acessoTopo}>
          <Text style={[styles.acessoTitulo, { color: cores.texto }]} accessibilityRole="header">Acesso rápido</Text>
          <TouchableOpacity
            onPress={() => setReordenando((r) => !r)}
            accessibilityRole="button"
            style={[styles.jump, { backgroundColor: cores.acentoSuave }]}
          >
            <Text style={[styles.jumpTexto, { color: cores.acento }]}>{reordenando ? '✓ Concluir' : '☰ Ordenar'}</Text>
          </TouchableOpacity>
        </View>

        {reordenando ? (
          /* Modo reordenação: lista vertical com setas */
          <View style={styles.reorderList}>
            {shortcutsOrdenados.map((sh, idx) => (
              <View key={sh.id} style={[styles.reorderItem, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
                <View style={[styles.reorderIcon, { backgroundColor: '#ece5fb' }]}>
                  <Ionicons name={sh.icon as any} size={22} color={cores.isEscuro ? '#fff' : tomTexto('#4b2bb0', cores)} />
                </View>
                <Text style={[styles.reorderLabel, cores.isEscuro && { color: '#ececf3' }, { color: cores.texto }]}>{sh.label}</Text>
                <View style={styles.reorderArrows}>
                  <TouchableOpacity
                    onPress={() => moverItem(idx, -1)}
                    disabled={idx === 0}
                    style={[styles.arrowBtn, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }, idx === 0 && { opacity: 0.25 }]}
                  >
                    <Ionicons name="chevron-up" size={18} color={cores.isEscuro ? '#fff' : tomTexto('#4b2bb0', cores)} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moverItem(idx, 1)}
                    disabled={idx === shortcutsOrdenados.length - 1}
                    style={[styles.arrowBtn, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }, idx === shortcutsOrdenados.length - 1 && { opacity: 0.25 }]}
                  >
                    <Ionicons name="chevron-down" size={18} color={cores.isEscuro ? '#fff' : tomTexto('#4b2bb0', cores)} />
                  </TouchableOpacity>
                </View>
                <Ionicons name="reorder-three-outline" size={20} color={cores.textoSecundario} />
              </View>
            ))}
          </View>
        ) : (
          /* Modo normal: grade */
          <View style={styles.shortcuts}>
            {shortcutsOrdenados.map((sh, indiceAtalho) => {
              const temPendentes = sh.id === 'atividades' && atividadesPendentes > 0;
              const temCorrecoes = sh.id === 'atividades' && atividadesParaCorrigir > 0;
              const temAvisos = sh.id === 'avisos' && avisosNaoLidos > 0;
              const temAprovacoes = sh.id === 'aprovacoes' && aprovacoesPendentes > 0;
              return (
                <TouchableOpacity
                  key={sh.id}
                  accessibilityRole="button"
                  accessibilityLabel={sh.label}
                  style={[styles.shortcut, { backgroundColor: cores.cartao, borderColor: cores.borda, boxShadow: `0px 4px 0px ${cores.sombra}` }]}
                  onPress={() => router.push(sh.route as any)}
                >
                  <View style={[styles.shortcutIcon, { backgroundColor: icoTom(indiceAtalho).fundo }]}>
                    <Ionicons name={sh.icon as any} size={24} color={icoTom(indiceAtalho).cor} />
                  </View>
                  {temPendentes && (
                    <View style={[styles.badgeCircle, temCorrecoes && styles.badgeCircleRight]}>
                      <Text style={styles.badgeText}>{atividadesPendentes > 99 ? '99+' : atividadesPendentes}</Text>
                    </View>
                  )}
                  {temCorrecoes && (
                    <View style={[styles.badgeCircle, styles.badgeCircleGreen, temPendentes && styles.badgeCircleLeft]}>
                      <Text style={styles.badgeText}>{atividadesParaCorrigir > 99 ? '99+' : atividadesParaCorrigir}</Text>
                    </View>
                  )}
                  {temAprovacoes && (
                    <View style={[styles.badgeCircle, styles.badgeCircleAviso]}>
                      <Text style={styles.badgeText}>{aprovacoesPendentes > 99 ? '99+' : aprovacoesPendentes}</Text>
                    </View>
                  )}
                  {temAvisos && (
                    <View style={[styles.badgeCircle, styles.badgeCircleAviso]}>
                      <Text style={styles.badgeText}>{avisosNaoLidos > 99 ? '99+' : avisosNaoLidos}</Text>
                    </View>
                  )}
                  <Text style={[styles.shortcutLabel, { color: cores.texto }]} numberOfLines={2}>{sh.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Atividades Recentes */}
        {atividadesRecentes.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, cores.isEscuro && { color: '#ececf3' }, { color: cores.texto }]}>📋 Atividades Recentes</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/atividades' as any)}>
                <Text style={[styles.verTodas, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Ver todas →</Text>
              </TouchableOpacity>
            </View>
            {atividadesRecentes.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.atividadeCard, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}
                onPress={() => router.push('/(tabs)/atividades' as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.atividadeTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]} numberOfLines={1}>{a.titulo}</Text>
                  {a.data ? (
                    <Text style={[styles.atividadeData, cores.isEscuro && { color: '#c4c4d2' }, { color: cores.textoSecundario }]}>
                      {(() => { try { return format(new Date(a.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }); } catch { return a.data; } })()}
                    </Text>
                  ) : null}
                  {a.descricao ? (
                    <Text style={[styles.atividadeDesc, cores.isEscuro && { color: '#d4d4de' }, { color: cores.textoSecundario }]} numberOfLines={2}>{a.descricao}</Text>
                  ) : null}
                </View>
                <View style={styles.atividadeBadgeWrap}>
                  <Text style={[styles.atividadeBadge, cores.isEscuro && { backgroundColor: '#3e3a4b', color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.fundo }]}>
                    {a.destino === 'todos' ? '👥 Todos' : a.destino === 'unidade' ? `🏠 ${a.unidade_nome ?? ''}` : `👤 ${a.dbv_nome ?? ''}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      </ScrollView>
      <LeituraFlutuante />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f3fb' },
  header:      { backgroundColor: '#7c39e7', padding: 24, paddingTop: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selo: { position: 'absolute', right: -6, bottom: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#f57c00', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', overflow: 'hidden' },
  faixaResponsavel: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 4, backgroundColor: 'rgba(245,124,0,0.35)', borderRadius: 22, paddingHorizontal: 8, paddingVertical: 3 },
  faixaResponsavelTexto: { color: '#ffe0b2', fontSize: 11, fontWeight: '700' },
  avatarBadge: { width: TAMANHO_FOTO_CABECALHO, height: TAMANHO_FOTO_CABECALHO, borderRadius: TAMANHO_FOTO_CABECALHO * 0.3, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff' },
  avatarLetra: { color: '#fff', fontSize: 20, fontWeight: '800' },
  saudacao:    { color: '#fff', fontSize: 20, fontWeight: '700' },
  data:        { color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 2 },
  logoutBtn:   { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoutText:  { color: '#fff', fontWeight: '800', fontSize: 13 },
  sincBanner:  { flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 16, gap: 8 },
  sincText:    { color: '#fff', fontSize: 13 },

  content:     { padding: 16 },
  contextoCard: { backgroundColor: '#fff', borderRadius: 18, padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  contextoLinha: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  contextoMeio: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12 },
  contextoIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  contextoTitulo: { fontSize: 13, fontWeight: '800' },
  contextoSub: { fontSize: 11, marginTop: 2 },
  card:        { backgroundColor: '#fff', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)', alignItems: 'center' },
  cardTitle:   { fontSize: 14, color: '#555', marginBottom: 8 },
  rankPos:     { fontSize: 52, fontWeight: '800', color: '#4b2bb0' },
  rankPts:     { fontSize: 16, color: '#666', marginTop: 4 },

  statsGrid:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard:    { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 16, alignItems: 'center', boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  statNum:     { fontSize: 28, fontWeight: '800', color: '#4b2bb0' },
  statLabel:   { fontSize: 12, color: '#888', marginTop: 2 },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  headerActions: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  sectionRowCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: '#333' },
  aniversariosBox: { backgroundColor: '#fff', borderRadius: 18, padding: 12, marginBottom: 16, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  aniversariosScroll: { gap: 10, paddingRight: 4 },
  aniversarioCard: { width: 112, borderRadius: 18, backgroundColor: '#f5f3fb', padding: 10, alignItems: 'center' },
  aniversarioHoje: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffb74d' },
  aniversarioNome: { color: '#1f1b33', fontSize: 12, fontWeight: '800', maxWidth: 92 },
  aniversarioData: { color: '#66788a', fontSize: 11, fontWeight: '700', marginTop: 3 },
  aniversarioHojeText: { color: '#e65100' },

  // Abas do card aniversários/alertas
  abasCardRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  abaCard: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 18, backgroundColor: '#f5f3fb', alignItems: 'center' },
  abaCardAtiva: { backgroundColor: '#7c39e7' },
  abaCardText: { fontSize: 12, fontWeight: '700', color: '#4b2bb0' },
  abaCardTextAtiva: { color: '#fff' },
  cardVazio: { color: '#aaa', fontSize: 13, textAlign: 'center', paddingVertical: 14 },

  // Alertas de falta
  alertaLista: { gap: 7 },
  alertaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff8f0', borderRadius: 18, padding: 10, borderLeftWidth: 3, borderLeftColor: '#f57c00' },
  alertaNome: { fontSize: 13, fontWeight: '800', color: '#1f1b33' },
  alertaUnidade: { fontSize: 11, color: '#78909c', marginTop: 1 },
  alertaBadge: { backgroundColor: '#f57c00', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 36, alignItems: 'center' },
  alertaBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  reorderBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 22, backgroundColor: '#ece5fb' },
  reorderBtnAtivo: { backgroundColor: '#7c39e7' },
  reorderBtnText:  { fontSize: 13, fontWeight: '600', color: '#4b2bb0' },

  // Grade normal
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcut: { width: '31.5%', minHeight: 96, borderWidth: 1, borderRadius: 17, paddingVertical: 13, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', gap: 8 },
  secaoAtalhos:   { fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  shortcutIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  shortcutIconPendente: { backgroundColor: '#c2410c' },
  shortcutIconCorrecao: { backgroundColor: '#2e7d32' },
  shortcutIconAviso:    { backgroundColor: '#d32f2f' },
  shortcutIconAprovacao: { backgroundColor: '#c2410c' },
  shortcutLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  badgeCircle: { position: 'absolute', top: 6, right: 6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#c62828', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeCircleGreen: { backgroundColor: '#2e7d32' },
  badgeCircleAviso: { backgroundColor: '#c2410c' },
  badgeCircleLeft: { left: 6, right: undefined },
  badgeCircleRight: { right: 6 },
  badgeText:     { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Modo reordenação
  reorderList:    { gap: 6 },
  reorderItem:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 12, gap: 12, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  reorderIcon:    { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  reorderLabel:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
  reorderArrows:  { flexDirection: 'row', gap: 4 },
  arrowBtn:       { padding: 6, backgroundColor: '#f5f3fb', borderRadius: 22 },

  // Atividades Recentes
  verTodas:           { fontSize: 13, fontWeight: '600', color: '#4b2bb0' },
  atividadeCard:      { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, elevation: 3, shadowColor: '#2a1a5e', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  atividadeTitulo:    { fontSize: 15, fontWeight: '700', color: '#4b2bb0' },
  atividadeData:      { fontSize: 12, color: '#888', marginTop: 2 },
  atividadeDesc:      { fontSize: 13, color: '#555', marginTop: 4, lineHeight: 18 },
  atividadeBadgeWrap: { paddingTop: 2 },
  atividadeBadge:     { backgroundColor: '#ece5fb', color: '#4b2bb0', fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  acessoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, marginBottom: 12 },
  acessoTitulo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  jump: { borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  jumpTexto: { fontSize: 12, fontWeight: '800' },
});

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
import {
  type VisualAtividadesConfig,
  carregarVisualAtividades,
  corCabecalhoDaPaleta,
  paletaAtividadesConfigurada,
} from '../../src/lib/paletaAtividades';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { obterDiaDeHoje, type DiaAnoBiblico } from '../../src/lib/anoBiblico';
import { Avatar, type BadgeFoto } from '../../src/components/common/Avatar';
import { carregarBadgesResponsaveis } from '../../src/lib/responsaveis';

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
  const [refreshing, setRefreshing] = useState(false);
  const [sincStatus, setSincStatus] = useState<'idle' | 'ok' | 'offline'>('idle');
  const [atividadesRecentes, setAtividadesRecentes] = useState<AtividadeItem[]>([]);
  const [atividadesPendentes, setAtividadesPendentes] = useState(0);
  const [atividadesParaCorrigir, setAtividadesParaCorrigir] = useState(0);
  const [avisosNaoLidos, setAvisosNaoLidos] = useState(0);
  const [abaCard, setAbaCard] = useState<'aniversarios' | 'alertas'>('aniversarios');
  const [membrosAusentesAlerta, setMembrosAusentesAlerta] = useState<MembroAlerta[]>([]);
  const [badgesResp, setBadgesResp] = useState<Map<number, BadgeFoto[]>>(new Map());
  const [diaAnoBiblico, setDiaAnoBiblico] = useState<DiaAnoBiblico | null>(null);

  useEffect(() => {
    if (abaFaltosos === '1') setAbaCard('alertas');
  }, [abaFaltosos]);
  const [visualAtividades, setVisualAtividades] = useState<VisualAtividadesConfig>({
    paletaId: 'viva',
    coresPersonalizadas: null,
    fonteId: 'padrao',
  });

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
  const podeVerAprovacoes = permissoes.temPerfil(['admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria']);
  const podeVerMenuAdminClube = permissoes.temPerfil(['admin_ti', 'admin_clube']);
  const contextosMesmoClube = useMemo(
    () => contextos.filter((c) => Number(c.clube_id) === Number(contextoAtivo?.clube_id)),
    [contextos, contextoAtivo?.clube_id]
  );
  const ehResponsavelPuroNoClube = contextosMesmoClube.length > 0 && contextosMesmoClube.every((c) => c.tipo === 'responsavel');
  const paletaVisual = useMemo(
    () => paletaAtividadesConfigurada(visualAtividades.paletaId, visualAtividades.coresPersonalizadas),
    [visualAtividades]
  );
  const cabecalhoVisual = corCabecalhoDaPaleta(paletaVisual);
  const hoje = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
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

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      async function initLocal() {
        await carregar();
        await carregarDados();
        await carregarAtividadesRecentes();
        await carregarPendentes();
        await carregarAvisosNaoLidos();
        await carregarAparencia();
        await carregarDiaAnoBiblico();
      }
      initLocal();
      puxarDeSupabase()
        .then(async () => {
          if (!ativo) return;
          await initLocal();
        })
        .catch(() => {});
      return () => { ativo = false; };
    }, [isAdmin, usuario])
  );

  async function carregarDiaAnoBiblico() {
    try {
      setDiaAnoBiblico(await obterDiaDeHoje());
    } catch {}
  }

  async function carregarAparencia() {
    try {
      const config = await carregarVisualAtividades(usuario?.id);
      setVisualAtividades(config);
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
          const { data: respostas } = await supabase
            .from('atividades_respostas')
            .select('atividade_id,status,reaberto_ate')
            .eq('clube_id', clubeId)
            .eq('dbv_id', membroId)
            .in('atividade_id', ids);
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
        const { data: filhosData } = await supabase
          .from('desbravadores')
          .select('id,unidade_id')
          .eq('clube_id', clubeId)
          .in('id', filhosIds);
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
          const { data: respostas } = await supabase
            .from('atividades_respostas')
            .select('atividade_id,dbv_id,status,reaberto_ate')
            .eq('clube_id', clubeId)
            .in('dbv_id', filhosIds)
            .in('atividade_id', idsAtividadesFilhos);
          const respostaPorPar = new Map<string, any>();
          for (const r of (respostas ?? []) as any[]) respostaPorPar.set(`${r.atividade_id}:${r.dbv_id}`, r);
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
        const { data } = await supabase
          .from('atividades_respostas')
          .select('id')
          .eq('clube_id', clubeId)
          .eq('status', 'entregue');
        setAtividadesParaCorrigir(data?.length ?? 0);
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
          const { data } = await supabase
            .from('atividades_respostas')
            .select('id')
            .eq('clube_id', clubeId)
            .eq('status', 'entregue')
            .in('atividade_id', idsMinhasAts);
          setAtividadesParaCorrigir(data?.length ?? 0);
        }
      }
    } catch {
      setAtividadesPendentes(0);
      setAtividadesParaCorrigir(0);
    }
  }

  async function carregarAvisosNaoLidos() {
    if (!usuario?.id) {
      setAvisosNaoLidos(0);
      return;
    }
    try {
      const clubeId = getClubeAtivoId();
      const [msgsRes, lidosRes, ocultosRes] = await Promise.all([
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
      ]);

      const lidosSet = new Set(((lidosRes.data ?? []) as any[]).map((r) => String(r.mensagem_id)));
      const ocultosSet = new Set(((ocultosRes.data ?? []) as any[]).map((r) => String(r.mensagem_id)));
      const naoLidos = ((msgsRes.data ?? []) as any[])
        .map((m) => String(m.id))
        .filter((id) => !lidosSet.has(id) && !ocultosSet.has(id));
      setAvisosNaoLidos(naoLidos.length);
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
      const [{ data: rows }, { data: cfgClube }] = await Promise.all([
        supabase
          .from('pontuacoes')
          .select('data, dbv_id, presenca')
          .eq('clube_id', clubeId)
          .gte('data', dataLimite.toISOString().slice(0, 10))
          .order('data', { ascending: false }),
        supabase.from('clubes').select('min_faltas_faltosos').eq('id', clubeId).single(),
      ]);
      const limiar = Math.max(1, (cfgClube as any)?.min_faltas_faltosos ?? 3);

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
      for (const dbv of desbravadores) {
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
            foto_url: dbv.foto_url,
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
    if (Platform.OS === 'web' && isAdmin) return;
    const db = await getDB();
    const totalLocal = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM desbravadores');
    if (!totalLocal || totalLocal.n === 0) {
      await popularBancoDeDados();
      puxarDeSupabase().catch(() => {});
      await carregar();
    }

    if (usuario?.dbv_id) {
      const ranking = await getRankingGeral();
      const idx = ranking.findIndex((r) => r.dbv_id === usuario.dbv_id);
      if (idx >= 0) { setMeuTotal(ranking[idx].total); setMinhaPos(idx + 1); }
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    const result = await sincronizarTudo();
    await puxarDeSupabase();
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
  // Foto da própria conta (responsável) ou, se logado como desbravador/
  // aventureiro/líder com ficha vinculada, a foto dessa ficha — pra bater com
  // a mesma foto trocada em "Meu perfil" ou na ficha do membro.
  const usuarioFotoUrl = usuario?.foto_url
    ?? desbravadores.find((d) => d.id === usuario?.dbv_id)?.foto_url
    ?? undefined;

  if (!usuario) return null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header com avatar colorido */}
      <View style={[styles.header, { backgroundColor: cabecalhoVisual }]}>
        <TouchableOpacity
          disabled={!usuario}
          onPress={() => router.push('/perfil')}
          style={styles.avatarBadge}
        >
          <Avatar nome={usuario?.nome ?? 'U'} foto_url={usuarioFotoUrl} cor={avatarColor} size={44} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.saudacao}>Olá, {nomeUsuario}! 👋</Text>
          <Text style={styles.data}>
            {contextoAtivo?.clube_nome_curto ? `${contextoAtivo.clube_nome_curto} • ` : ''}{hoje}
          </Text>
        </View>
      </View>

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
        {!isAdmin && minhaPos !== null && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🏆 Minha posição no Ranking</Text>
            <Text style={styles.rankPos}>#{minhaPos}</Text>
            <Text style={styles.rankPts}>{meuTotal.toLocaleString('pt-BR')} pontos</Text>
          </View>
        )}

        {contextos.length > 1 && (
          <TouchableOpacity style={styles.contextoCard} onPress={() => router.push('/auth/contexto' as any)}>
            <View style={styles.contextoIcon}>
              <Ionicons name="swap-horizontal" size={20} color="#1a3a5c" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contextoTitulo}>Acessando como {contextoAtivo?.perfil_nome ?? 'perfil'}</Text>
              <Text style={styles.contextoSub}>{contextoAtivo?.clube_nome ?? 'Selecionar contexto'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#90a4ae" />
          </TouchableOpacity>
        )}

        {temFilhosVinculados && (
          <TouchableOpacity style={styles.contextoCard} onPress={() => router.push('/auth/contexto' as any)}>
            <View style={[styles.contextoIcon, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="people-circle" size={22} color="#f57c00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contextoTitulo}>Meus filhos</Text>
              <Text style={styles.contextoSub}>Troque para o contexto de responsável</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#90a4ae" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.contextoCard} onPress={() => router.push('/ano-biblico/hoje' as any)}>
          <View style={[styles.contextoIcon, { backgroundColor: '#ede7f6' }]}>
            <Ionicons name="book" size={20} color="#5e35b1" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contextoTitulo}>Ano bíblico</Text>
            <Text style={styles.contextoSub}>
              {hoje}{diaAnoBiblico ? ` · ${diaAnoBiblico.referencia}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#90a4ae" />
        </TouchableOpacity>

        {isAdmin && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{desbravadores.length}</Text>
              <Text style={styles.statLabel}>Membros</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{desbravadores.filter((d) => d.unidade_nome === 'Diretoria').length}</Text>
              <Text style={styles.statLabel}>Diretoria</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{desbravadores.filter((d) => d.unidade_nome && d.unidade_nome !== 'Diretoria').length}</Text>
              <Text style={styles.statLabel}>Desbravadores</Text>
            </View>
          </View>
        )}

        {podeVerAniversarios && (
          <View style={styles.aniversariosBox}>
            {/* Abas */}
            <View style={styles.abasCardRow}>
              <TouchableOpacity
                style={[styles.abaCard, abaCard === 'aniversarios' && styles.abaCardAtiva]}
                onPress={() => setAbaCard('aniversarios')}
              >
                <Text style={[styles.abaCardText, abaCard === 'aniversarios' && styles.abaCardTextAtiva]}>🎂 Aniversários</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.abaCard, abaCard === 'alertas' && styles.abaCardAtiva]}
                onPress={() => setAbaCard('alertas')}
              >
                <Text style={[styles.abaCardText, abaCard === 'alertas' && styles.abaCardTextAtiva]}>
                  ⚠️ Faltosos{membrosAusentesAlerta.length > 0 ? ` (${membrosAusentesAlerta.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {abaCard === 'aniversarios' ? (
              aniversariosSemana.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aniversariosScroll}>
                  {aniversariosSemana.map((m) => {
                    const hojeNiver = m.dias === 0;
                    return (
                      <View key={m.id} style={[styles.aniversarioCard, hojeNiver && styles.aniversarioHoje]}>
                        <View style={{ marginBottom: 6 }}>
                          <Avatar nome={m.nome} foto_url={m.foto_url} cor={avatarCor(m.nome)} size={38} badgeFotos={badgesResp.get(m.id)} />
                        </View>
                        <Text style={styles.aniversarioNome} numberOfLines={1}>{m.nome}</Text>
                        <Text style={[styles.aniversarioData, hojeNiver && styles.aniversarioHojeText]}>
                          {hojeNiver ? 'Hoje' : formatarAniversario(m.data_nascimento)}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.cardVazio}>Nenhum aniversariante esta semana.</Text>
              )
            ) : (
              membrosAusentesAlerta.length > 0 ? (
                <View style={styles.alertaLista}>
                  {membrosAusentesAlerta.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.alertaCard}
                      onPress={() => router.push(`/membro/${m.id}` as any)}
                    >
                      <Avatar nome={m.nome} foto_url={m.foto_url} cor={avatarCor(m.nome)} size={34} badgeFotos={badgesResp.get(m.id)} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertaNome} numberOfLines={1}>{m.nome}</Text>
                        <Text style={styles.alertaUnidade}>{m.unidade_nome}</Text>
                      </View>
                      <View style={styles.alertaBadge}>
                        <Text style={styles.alertaBadgeText}>{m.faltas_consecutivas}✗</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.cardVazio}>Nenhum alerta de faltas consecutivas.</Text>
              )
            )}
          </View>
        )}

        {/* Acesso Rápido */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Acesso Rápido</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setReordenando((r) => !r)}
              style={[styles.reorderBtn, reordenando && styles.reorderBtnAtivo]}
            >
              <Ionicons name={reordenando ? 'checkmark' : 'reorder-three'} size={18} color={reordenando ? '#fff' : '#1a3a5c'} />
              <Text style={[styles.reorderBtnText, reordenando && { color: '#fff' }]}>
                {reordenando ? 'Pronto' : 'Ordenar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {reordenando ? (
          /* Modo reordenação: lista vertical com setas */
          <View style={styles.reorderList}>
            {shortcutsOrdenados.map((sh, idx) => (
              <View key={sh.id} style={styles.reorderItem}>
                <View style={[styles.reorderIcon, { backgroundColor: '#e8f0fe' }]}>
                  <Ionicons name={sh.icon as any} size={22} color="#1a3a5c" />
                </View>
                <Text style={styles.reorderLabel}>{sh.label}</Text>
                <View style={styles.reorderArrows}>
                  <TouchableOpacity
                    onPress={() => moverItem(idx, -1)}
                    disabled={idx === 0}
                    style={[styles.arrowBtn, idx === 0 && { opacity: 0.25 }]}
                  >
                    <Ionicons name="chevron-up" size={18} color="#1a3a5c" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moverItem(idx, 1)}
                    disabled={idx === shortcutsOrdenados.length - 1}
                    style={[styles.arrowBtn, idx === shortcutsOrdenados.length - 1 && { opacity: 0.25 }]}
                  >
                    <Ionicons name="chevron-down" size={18} color="#1a3a5c" />
                  </TouchableOpacity>
                </View>
                <Ionicons name="reorder-three-outline" size={20} color="#bbb" />
              </View>
            ))}
          </View>
        ) : (
          /* Modo normal: grade */
          <View style={styles.shortcuts}>
            {shortcutsOrdenados.map((sh) => {
              const temPendentes = sh.id === 'atividades' && atividadesPendentes > 0;
              const temCorrecoes = sh.id === 'atividades' && atividadesParaCorrigir > 0;
              const temAvisos = sh.id === 'avisos' && avisosNaoLidos > 0;
              const temBadgeAtividades = temPendentes || temCorrecoes;
              const temBadge = temBadgeAtividades || temAvisos;
              return (
                <TouchableOpacity
                  key={sh.id}
                  style={styles.shortcut}
                  onPress={() => router.push(sh.route as any)}
                >
                  <View style={[
                    styles.shortcutIcon,
                    temPendentes && styles.shortcutIconPendente,
                    !temPendentes && temCorrecoes && styles.shortcutIconCorrecao,
                    temAvisos && styles.shortcutIconAviso,
                  ]}>
                    <Ionicons name={sh.icon as any} size={26} color={temBadge ? '#fff' : '#1a3a5c'} />
                    {temPendentes && (
                      <View style={[styles.badgeCircle, temCorrecoes && styles.badgeCircleRight]}>
                        <Text style={styles.badgeText}>
                          {atividadesPendentes > 99 ? '99+' : atividadesPendentes}
                        </Text>
                      </View>
                    )}
                    {temCorrecoes && (
                      <View style={[styles.badgeCircle, styles.badgeCircleGreen, temPendentes && styles.badgeCircleLeft]}>
                        <Text style={styles.badgeText}>
                          {atividadesParaCorrigir > 99 ? '99+' : atividadesParaCorrigir}
                        </Text>
                      </View>
                    )}
                    {temAvisos && (
                      <View style={[styles.badgeCircle, styles.badgeCircleAviso]}>
                        <Text style={styles.badgeText}>
                          {avisosNaoLidos > 99 ? '99+' : avisosNaoLidos}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.shortcutLabel}>{sh.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Atividades Recentes */}
        {atividadesRecentes.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>📋 Atividades Recentes</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/atividades' as any)}>
                <Text style={styles.verTodas}>Ver todas →</Text>
              </TouchableOpacity>
            </View>
            {atividadesRecentes.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.atividadeCard}
                onPress={() => router.push('/(tabs)/atividades' as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.atividadeTitulo} numberOfLines={1}>{a.titulo}</Text>
                  {a.data ? (
                    <Text style={styles.atividadeData}>
                      {(() => { try { return format(new Date(a.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }); } catch { return a.data; } })()}
                    </Text>
                  ) : null}
                  {a.descricao ? (
                    <Text style={styles.atividadeDesc} numberOfLines={2}>{a.descricao}</Text>
                  ) : null}
                </View>
                <View style={styles.atividadeBadgeWrap}>
                  <Text style={styles.atividadeBadge}>
                    {a.destino === 'todos' ? '👥 Todos' : a.destino === 'unidade' ? `🏠 ${a.unidade_nome ?? ''}` : `👤 ${a.dbv_nome ?? ''}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f0f4f8' },
  header:      { backgroundColor: '#1a3a5c', padding: 24, paddingTop: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBadge: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  avatarLetra: { color: '#fff', fontSize: 20, fontWeight: '800' },
  saudacao:    { color: '#fff', fontSize: 20, fontWeight: '700' },
  data:        { color: '#a8c8e8', fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  logoutBtn:   { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoutText:  { color: '#fff', fontWeight: '800', fontSize: 13 },
  sincBanner:  { flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 16, gap: 8 },
  sincText:    { color: '#fff', fontSize: 13 },

  content:     { padding: 16 },
  contextoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 1 },
  contextoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  contextoTitulo: { color: '#1a3a5c', fontWeight: '900', fontSize: 14 },
  contextoSub: { color: '#78909c', fontSize: 12, marginTop: 2 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 3, alignItems: 'center' },
  cardTitle:   { fontSize: 14, color: '#555', marginBottom: 8 },
  rankPos:     { fontSize: 52, fontWeight: '800', color: '#1a3a5c' },
  rankPts:     { fontSize: 16, color: '#666', marginTop: 4 },

  statsGrid:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard:    { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 2 },
  statNum:     { fontSize: 28, fontWeight: '800', color: '#1a3a5c' },
  statLabel:   { fontSize: 12, color: '#888', marginTop: 2 },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  headerActions: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  sectionRowCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: '#333' },
  aniversariosBox: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 16, elevation: 1 },
  aniversariosScroll: { gap: 10, paddingRight: 4 },
  aniversarioCard: { width: 112, borderRadius: 12, backgroundColor: '#f4f7fb', padding: 10, alignItems: 'center' },
  aniversarioHoje: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffb74d' },
  aniversarioNome: { color: '#1f2933', fontSize: 12, fontWeight: '800', maxWidth: 92 },
  aniversarioData: { color: '#66788a', fontSize: 11, fontWeight: '700', marginTop: 3 },
  aniversarioHojeText: { color: '#e65100' },

  // Abas do card aniversários/alertas
  abasCardRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  abaCard: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10, backgroundColor: '#f0f4f8', alignItems: 'center' },
  abaCardAtiva: { backgroundColor: '#1a3a5c' },
  abaCardText: { fontSize: 12, fontWeight: '700', color: '#1a3a5c' },
  abaCardTextAtiva: { color: '#fff' },
  cardVazio: { color: '#aaa', fontSize: 13, textAlign: 'center', paddingVertical: 14 },

  // Alertas de falta
  alertaLista: { gap: 7 },
  alertaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff8f0', borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: '#f57c00' },
  alertaNome: { fontSize: 13, fontWeight: '800', color: '#1f2933' },
  alertaUnidade: { fontSize: 11, color: '#78909c', marginTop: 1 },
  alertaBadge: { backgroundColor: '#f57c00', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 36, alignItems: 'center' },
  alertaBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  reorderBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e8f0fe' },
  reorderBtnAtivo: { backgroundColor: '#1a3a5c' },
  reorderBtnText:  { fontSize: 13, fontWeight: '600', color: '#1a3a5c' },

  // Grade normal
  shortcuts:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shortcut:       { alignItems: 'center', width: '22%' },
  shortcutIcon:         { width: 56, height: 56, backgroundColor: '#fff', borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 2, marginBottom: 6 },
  shortcutIconPendente: { backgroundColor: '#ff6b35' },
  shortcutIconCorrecao: { backgroundColor: '#2e7d32' },
  shortcutIconAviso:    { backgroundColor: '#d32f2f' },
  shortcutLabel:        { fontSize: 11, color: '#555', textAlign: 'center' },
  badgeCircle:   { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#d32f2f', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  badgeCircleGreen: { backgroundColor: '#2e7d32' },
  badgeCircleAviso: { backgroundColor: '#ff6b35' },
  badgeCircleLeft: { left: -6, right: undefined },
  badgeCircleRight: { right: -6 },
  badgeText:     { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Modo reordenação
  reorderList:    { gap: 6 },
  reorderItem:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 12, elevation: 1 },
  reorderIcon:    { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  reorderLabel:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
  reorderArrows:  { flexDirection: 'row', gap: 4 },
  arrowBtn:       { padding: 6, backgroundColor: '#f0f4f8', borderRadius: 8 },

  // Atividades Recentes
  verTodas:           { fontSize: 13, fontWeight: '600', color: '#1a3a5c' },
  atividadeCard:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  atividadeTitulo:    { fontSize: 15, fontWeight: '700', color: '#1a3a5c' },
  atividadeData:      { fontSize: 12, color: '#888', marginTop: 2 },
  atividadeDesc:      { fontSize: 13, color: '#555', marginTop: 4, lineHeight: 18 },
  atividadeBadgeWrap: { paddingTop: 2 },
  atividadeBadge:     { backgroundColor: '#e8f0fe', color: '#1a3a5c', fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
});

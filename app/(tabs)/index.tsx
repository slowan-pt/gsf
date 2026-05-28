import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, PanResponder, Animated, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
import {
  type VisualAtividadesConfig,
  carregarVisualAtividades,
  corCabecalhoDaPaleta,
  paletaAtividadesConfigurada,
} from '../../src/lib/paletaAtividades';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

function diasAteAniversario(dataNascimento?: string | null) {
  if (!dataNascimento || dataNascimento.length < 10) return null;
  const [ano, mes, dia] = dataNascimento.slice(0, 10).split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  const hojeBase = new Date();
  const hoje = new Date(hojeBase.getFullYear(), hojeBase.getMonth(), hojeBase.getDate());
  let prox = new Date(hoje.getFullYear(), mes - 1, dia);
  if (prox < hoje) prox = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  return Math.round((prox.getTime() - hoje.getTime()) / 86400000);
}

function formatarAniversario(dataNascimento?: string | null) {
  if (!dataNascimento || dataNascimento.length < 10) return '';
  const [, mes, dia] = dataNascimento.slice(0, 10).split('-').map(Number);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
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
  { id: 'aparencia',  icon: 'color-palette',       label: 'Aparência', route: '/admin/aparencia',             adminOnly: true, acesso: 'admin_clube' },
  { id: 'modelos',    icon: 'options',             label: 'Modelos',   route: '/admin/modelos',               adminOnly: true, acesso: 'admin_clube' },
  { id: 'clubes',     icon: 'business',            label: 'Clubes',    route: '/admin/clubes',                adminOnly: true, acesso: 'admin_ti' },
  { id: 'classificacao', icon: 'star-outline',     label: 'Classificação', route: '/admin/classificacao',      adminOnly: true, acesso: 'admin_clube' },
  { id: 'rankingClubes', icon: 'ribbon',           label: 'Ranking Campo', route: '/admin/ranking-clubes',     adminOnly: true, acesso: 'admin_clube' },
  { id: 'auditoria',  icon: 'shield-checkmark',    label: 'Auditoria', route: '/admin/auditoria',             adminOnly: true, acesso: 'admin_clube' },
  { id: 'lgpd',       icon: 'document-text',       label: 'LGPD',      route: '/admin/lgpd',                  adminOnly: true, acesso: 'admin_clube' },
  { id: 'avisos',     icon: 'notifications',       label: 'Avisos',    route: '/mensagens',                   adminOnly: false },
  { id: 'mensagens',  icon: 'megaphone',           label: 'Mensagens', route: '/admin/mensagens',             adminOnly: true, acesso: 'mensagens' },
  { id: 'atividades', icon: 'clipboard',           label: 'Atividades', route: '/(tabs)/atividades',          adminOnly: false },
  { id: 'perfil',     icon: 'person-circle',       label: 'Perfil',     route: '/perfil',                     adminOnly: false },
];

function ordenarAtalhosPorNome(atalhos: ShortcutDef[]) {
  return [...atalhos].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

// Nova chave: aplica a ordem alfabetica uma vez, sem reaproveitar ordens antigas.
const ORDER_KEY = 'shortcuts_order_v2';

/* ─── Componente principal ──────────────────────────────────────── */
export default function DashboardScreen() {
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
  const podeConfigurarAparencia = permissoes.temPerfil(['admin_ti', 'admin_clube']);
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
      .map((m) => ({ ...m, dias: diasAteAniversario(m.data_nascimento) }))
      .filter((m) => m.dias !== null && m.dias >= 0 && m.dias <= 7)
      .sort((a, b) => Number(a.dias) - Number(b.dias) || a.nome.localeCompare(b.nome, 'pt-BR'))
  ), [desbravadores]);

  // Atalhos filtrados e ordenados
  const shortcuts = ALL_SHORTCUTS.filter((s) => {
    if (!s.adminOnly) return true;
    if (ehResponsavelPuroNoClube) return false;
    if (s.acesso === 'admin_ti') return isAdminTi;
    if (s.acesso === 'admin_clube') return podeVerMenuAdminClube;
    if (s.acesso === 'pontuacao') return permissoes.pode('gerenciar_pontuacao');
    if (s.acesso === 'unidades') return permissoes.pode('gerenciar_unidades');
    if (s.acesso === 'membros') return permissoes.pode('gerenciar_membros');
    if (s.acesso === 'relatorios') return permissoes.pode('ver_relatorios');
    if (s.acesso === 'mensagens') return permissoes.pode('enviar_mensagens');
    if (s.id === 'aparencia') return podeConfigurarAparencia;
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

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      async function initLocal() {
        await carregar();
        await carregarDados();
        await carregarAtividadesRecentes();
        await carregarPendentes();
        await carregarAparencia();
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

  async function carregarAparencia() {
    try {
      const config = await carregarVisualAtividades(getClubeAtivoId());
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
    if (Platform.OS === 'web') { setAtividadesPendentes(0); return; }
    // Só faz sentido para membros (não admin)
    if (isAdmin || !usuario?.dbv_id) { setAtividadesPendentes(0); return; }
    try {
      const db = await getDB();
      const row = await db.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) as total FROM atividades a
         WHERE (a.destino='todos'
                OR (a.destino='unidade' AND a.unidade_id=?)
                OR (a.destino='desbravador' AND a.dbv_id=?))
           AND NOT EXISTS (
             SELECT 1 FROM atividades_respostas r
             WHERE r.atividade_id = a.id AND r.dbv_id = ?
           )`,
        [usuario.unidade_id ?? -1, usuario.dbv_id, usuario.dbv_id]
      );
      setAtividadesPendentes(row?.total ?? 0);
    } catch { setAtividadesPendentes(0); }
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
          style={[styles.avatarBadge, { backgroundColor: avatarColor }]}
        >
          <Text style={styles.avatarLetra}>{(usuario?.nome ?? 'U')[0].toUpperCase()}</Text>
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

        {podeVerAniversarios && aniversariosSemana.length > 0 && (
          <View style={styles.aniversariosBox}>
            <View style={styles.sectionRowCompact}>
              <Text style={styles.sectionTitle}>🎂 Aniversários da semana</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aniversariosScroll}>
              {aniversariosSemana.map((m) => {
                const hojeNiver = m.dias === 0;
                return (
                  <View key={m.id} style={[styles.aniversarioCard, hojeNiver && styles.aniversarioHoje]}>
                    <View style={[styles.aniversarioAvatar, { backgroundColor: avatarCor(m.nome) }]}>
                      <Text style={styles.aniversarioLetra}>{m.nome[0]}</Text>
                    </View>
                    <Text style={styles.aniversarioNome} numberOfLines={1}>{m.nome}</Text>
                    <Text style={[styles.aniversarioData, hojeNiver && styles.aniversarioHojeText]}>
                      {hojeNiver ? 'Hoje' : formatarAniversario(m.data_nascimento)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
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
              return (
                <TouchableOpacity
                  key={sh.id}
                  style={styles.shortcut}
                  onPress={() => router.push(sh.route as any)}
                >
                  <View style={[styles.shortcutIcon, temPendentes && styles.shortcutIconPendente]}>
                    <Ionicons name={sh.icon as any} size={26} color={temPendentes ? '#fff' : '#1a3a5c'} />
                    {temPendentes && (
                      <View style={styles.badgeCircle}>
                        <Text style={styles.badgeText}>
                          {atividadesPendentes > 99 ? '99+' : atividadesPendentes}
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
  aniversarioAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  aniversarioLetra: { color: '#fff', fontSize: 17, fontWeight: '900' },
  aniversarioNome: { color: '#1f2933', fontSize: 12, fontWeight: '800', maxWidth: 92 },
  aniversarioData: { color: '#66788a', fontSize: 11, fontWeight: '700', marginTop: 3 },
  aniversarioHojeText: { color: '#e65100' },
  reorderBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e8f0fe' },
  reorderBtnAtivo: { backgroundColor: '#1a3a5c' },
  reorderBtnText:  { fontSize: 13, fontWeight: '600', color: '#1a3a5c' },

  // Grade normal
  shortcuts:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  shortcut:       { alignItems: 'center', width: '22%' },
  shortcutIcon:         { width: 56, height: 56, backgroundColor: '#fff', borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 2, marginBottom: 6 },
  shortcutIconPendente: { backgroundColor: '#ff6b35' },
  shortcutLabel:        { fontSize: 11, color: '#555', textAlign: 'center' },
  badgeCircle:   { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#d32f2f', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
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

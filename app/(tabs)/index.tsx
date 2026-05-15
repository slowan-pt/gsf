import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, PanResponder, Animated, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../src/stores/authStore';
import { useDBVStore } from '../../src/stores/dbvStore';
import { usePontuacaoStore } from '../../src/stores/pontuacaoStore';
import { puxarDeSupabase, sincronizarTudo } from '../../src/lib/sync';
import { getDB } from '../../src/lib/database';
import { popularBancoDeDados } from '../../src/lib/seed_local';
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

/* ─── Definição dos atalhos ─────────────────────────────────────── */
interface ShortcutDef {
  id: string;
  icon: string;
  label: string;
  route: string;
  adminOnly: boolean;
}

const ALL_SHORTCUTS: ShortcutDef[] = [
  { id: 'ranking',    icon: 'trophy',              label: 'Ranking',   route: '/(tabs)/ranking',              adminOnly: false },
  { id: 'membros',    icon: 'people',              label: 'Membros',   route: '/(tabs)/membros',              adminOnly: false },
  { id: 'agenda',     icon: 'calendar',            label: 'Agenda',    route: '/(tabs)/calendario',           adminOnly: false },
  { id: 'pontuacao',  icon: 'checkmark-circle',    label: 'Pontuação', route: '/(tabs)/pontuacao',            adminOnly: true  },
  { id: 'extras',     icon: 'star',                label: 'Extras',    route: '/(tabs)/extras',               adminOnly: true  },
  { id: 'unidades',   icon: 'flag',                label: 'Unidades',  route: '/(tabs)/unidades',             adminOnly: true  },
  { id: 'importar',   icon: 'cloud-upload-outline', label: 'Importar', route: '/importar',                    adminOnly: true  },
  { id: 'relatorios', icon: 'bar-chart',           label: 'Relatórios', route: '/relatorios',                  adminOnly: true  },
  { id: 'vincular',   icon: 'link',                label: 'Vincular',  route: '/admin/vincular-usuarios',     adminOnly: true  },
  { id: 'mensagens',  icon: 'megaphone',           label: 'Mensagens', route: '/admin/mensagens',             adminOnly: true  },
  { id: 'atividades', icon: 'clipboard',           label: 'Atividades', route: '/atividades',                 adminOnly: false },
  { id: 'perfil',     icon: 'person-circle',       label: 'Perfil',     route: '/perfil',                     adminOnly: false },
];

const ORDER_KEY = 'shortcuts_order_v1';

/* ─── Componente principal ──────────────────────────────────────── */
export default function DashboardScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout  = useAuthStore((s) => s.logout);
  const { desbravadores, carregar } = useDBVStore();
  const { getRankingGeral } = usePontuacaoStore();
  const [meuTotal,  setMeuTotal]  = useState(0);
  const [minhaPos,  setMinhaPos]  = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sincStatus, setSincStatus] = useState<'idle' | 'ok' | 'offline'>('idle');
  const [atividadesRecentes, setAtividadesRecentes] = useState<AtividadeItem[]>([]);
  const [atividadesPendentes, setAtividadesPendentes] = useState(0);

  const isAdmin = usuario?.perfil === 'admin_geral' || usuario?.perfil === 'admin_diretoria';
  const hoje = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  // Atalhos filtrados e ordenados
  const shortcuts = ALL_SHORTCUTS.filter((s) => {
    return !s.adminOnly || isAdmin;
  });
  const [ordem, setOrdem] = useState<string[]>(() => shortcuts.map((s) => s.id));
  const [reordenando, setReordenando] = useState(false);

  useEffect(() => {
    async function init() {
      await carregar();
      await carregarDados();
      await carregarOrdem();
    }
    init();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      async function initLocal() {
        await carregar();
        await carregarDados();
        await carregarAtividadesRecentes();
        await carregarPendentes();
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
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        // Merge: mantém salvos na frente, adiciona novos no final
        const visiveis = shortcuts.map((s) => s.id);
        const merged = [
          ...ids.filter((id) => visiveis.includes(id)),
          ...visiveis.filter((id) => !ids.includes(id)),
        ];
        setOrdem(merged);
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

  if (!usuario) return null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header com avatar colorido */}
      <View style={styles.header}>
        <TouchableOpacity
          disabled={!usuario}
          onPress={() => router.push('/perfil')}
          style={[styles.avatarBadge, { backgroundColor: avatarColor }]}
        >
          <Text style={styles.avatarLetra}>{(usuario?.nome ?? 'U')[0].toUpperCase()}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.saudacao}>Olá, {nomeUsuario}! 👋</Text>
          <Text style={styles.data}>{hoje}</Text>
        </View>
        <TouchableOpacity onPress={usuario ? logout : () => router.push('/auth/login')} style={styles.logoutBtn}>
          <Ionicons name={usuario ? 'log-out-outline' : 'log-in-outline'} size={22} color="#fff" />
        </TouchableOpacity>
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

        {/* Acesso Rápido */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Acesso Rápido</Text>
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
              <TouchableOpacity onPress={() => router.push('/atividades' as any)}>
                <Text style={styles.verTodas}>Ver todas →</Text>
              </TouchableOpacity>
            </View>
            {atividadesRecentes.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.atividadeCard}
                onPress={() => router.push('/atividades' as any)}
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
  logoutBtn:   { padding: 8 },
  sincBanner:  { flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 16, gap: 8 },
  sincText:    { color: '#fff', fontSize: 13 },

  content:     { padding: 16 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 3, alignItems: 'center' },
  cardTitle:   { fontSize: 14, color: '#555', marginBottom: 8 },
  rankPos:     { fontSize: 52, fontWeight: '800', color: '#1a3a5c' },
  rankPts:     { fontSize: 16, color: '#666', marginTop: 4 },

  statsGrid:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard:    { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 2 },
  statNum:     { fontSize: 28, fontWeight: '800', color: '#1a3a5c' },
  statLabel:   { fontSize: 12, color: '#888', marginTop: 2 },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: '#333' },
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

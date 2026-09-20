import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissoes } from '../lib/permissoes';
import { NAV_COLORS } from '../lib/navTheme';
import { useAuthStore } from '../stores/authStore';
import { confirmar } from '../stores/avisoStore';
import { useCores } from '../stores/temaStore';

const TABS = [
  { id: 'inicio',     path: '/',          label: 'Início',      icon: 'home-outline',             iconActive: 'home' },
  { id: 'ranking',    path: '/ranking',   label: 'Ranking',     icon: 'trophy-outline',           iconActive: 'trophy' },
  { id: 'membros',    path: '/membros',   label: 'Membros',     icon: 'people-outline',           iconActive: 'people' },
  { id: 'pontuacao',  path: '/pontuacao', label: 'Pontuação',   icon: 'checkmark-circle-outline', iconActive: 'checkmark-circle', permissao: 'gerenciar_pontuacao' },
  { id: 'extras',     path: '/extras',    label: 'Extras',      icon: 'star-outline',             iconActive: 'star', permissao: 'gerenciar_pontuacao' },
  // No lugar de "Classes" (agora acessível pelo atalho da tela inicial) — a
  // logo do clube ocupou o espaço onde ficava o botão flutuante de sair, então
  // sair de vez precisava de um lugar fixo e sempre visível.
  { id: 'sair',       path: '__sair__',   label: 'Sair',        icon: 'log-out-outline',          iconActive: 'log-out' },
] as const;

/** O Regional só acompanha classes/especialidades dos clubes vinculados. */
const TABS_REGIONAL = ['inicio', 'sair'];

interface BottomNavProps {
  /** Chamado antes de navegar — use para fechar modais */
  onNavigate?: (path: string) => void | boolean | Promise<void | boolean>;
}

export function BottomNav({ onNavigate }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const cores = useCores();
  const pathname = usePathname();
  const permissoes = usePermissoes();
  const logout = useAuthStore((s) => s.logout);
  const ehRegional = permissoes.temPerfil(['usuario_regional']);
  const tabs = TABS.filter((tab) => {
    if (ehRegional) return TABS_REGIONAL.includes(tab.id);
    return !('permissao' in tab) || permissoes.pode(tab.permissao);
  });

  async function sair() {
    if (!(await confirmar('Sair', 'Deseja sair do sistema?', 'Sair'))) return;
    await logout();
    router.replace('/auth/login');
  }

  return (
    <View style={[styles.container, { backgroundColor: cores.cartao, borderTopColor: cores.borda, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const isActive =
          tab.id === 'sair'
            ? false
            : tab.path === '/'
              ? pathname === '/' || pathname === '/index' || pathname === ''
              : pathname.startsWith(tab.path);
        return (
          <TouchableOpacity
            key={tab.path}
            style={styles.tab}
            onPress={async () => {
              if (tab.id === 'sair') { await sair(); return; }
              const podeNavegar = await onNavigate?.(tab.path);
              if (podeNavegar === false) return;
              router.replace(tab.path as any);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={(isActive ? tab.iconActive : tab.icon) as any}
              size={22}
              color={isActive ? NAV_COLORS.active : cores.textoSecundario}
            />
            <Text style={[styles.label, { color: cores.textoSecundario }, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
    minHeight: 66,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  labelActive: {
    color: NAV_COLORS.active,
  },
});

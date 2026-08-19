import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissoes } from '../lib/permissoes';
import { NAV_COLORS } from '../lib/navTheme';

const TABS = [
  { id: 'inicio',     path: '/',          label: 'Início',      icon: 'home-outline',             iconActive: 'home' },
  { id: 'ranking',    path: '/ranking',   label: 'Ranking',     icon: 'trophy-outline',           iconActive: 'trophy' },
  { id: 'membros',    path: '/membros',   label: 'Membros',     icon: 'people-outline',           iconActive: 'people' },
  { id: 'pontuacao',  path: '/pontuacao', label: 'Pontuação',   icon: 'checkmark-circle-outline', iconActive: 'checkmark-circle', permissao: 'gerenciar_pontuacao' },
  { id: 'extras',     path: '/extras',    label: 'Extras',      icon: 'star-outline',             iconActive: 'star', permissao: 'gerenciar_pontuacao' },
  { id: 'classes',    path: '/classes',   label: 'Classes',     icon: 'ribbon-outline',           iconActive: 'ribbon' },
] as const;

/** O Regional só acompanha classes/especialidades dos clubes vinculados. */
const TABS_REGIONAL = ['inicio', 'classes'];

interface BottomNavProps {
  /** Chamado antes de navegar — use para fechar modais */
  onNavigate?: (path: string) => void | boolean | Promise<void | boolean>;
}

export function BottomNav({ onNavigate }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const permissoes = usePermissoes();
  const ehRegional = permissoes.temPerfil(['usuario_regional']);
  const tabs = TABS.filter((tab) => {
    if (ehRegional) return TABS_REGIONAL.includes(tab.id);
    return !('permissao' in tab) || permissoes.pode(tab.permissao);
  });

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const isActive =
          tab.path === '/'
            ? pathname === '/' || pathname === '/index' || pathname === ''
            : pathname.startsWith(tab.path);
        return (
          <TouchableOpacity
            key={tab.path}
            style={styles.tab}
            onPress={async () => {
              const podeNavegar = await onNavigate?.(tab.path);
              if (podeNavegar === false) return;
              router.replace(tab.path as any);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={(isActive ? tab.iconActive : tab.icon) as any}
              size={22}
              color={isActive ? NAV_COLORS.active : NAV_COLORS.inactive}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>
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
    backgroundColor: NAV_COLORS.background,
    borderTopWidth: 1,
    borderTopColor: NAV_COLORS.border,
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
    color: NAV_COLORS.inactive,
  },
  labelActive: {
    color: NAV_COLORS.active,
  },
});

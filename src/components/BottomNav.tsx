import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissoes } from '../lib/permissoes';
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
            style={[styles.tab, isActive && { backgroundColor: cores.acentoSuave }]}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            onPress={async () => {
              if (tab.id === 'sair') { await sair(); return; }
              const podeNavegar = await onNavigate?.(tab.path);
              if (podeNavegar === false) return;
              router.replace(tab.path as any);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon as any}
              size={23}
              color={isActive ? cores.acento : cores.textoSecundario}
            />
            <Text style={[styles.label, { color: isActive ? cores.acento : cores.textoSecundario }, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Protótipo (.nav): fundo do painel, borda superior fina, botões com raio 13
  // e o ativo inteiro em fundo suave com ícone/rótulo na cor da marca.
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 8,
    gap: 4,
    minHeight: 70,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  labelActive: {
    fontWeight: '800',
  },
});

import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissoes } from '../lib/permissoes';
import { useAuthStore } from '../stores/authStore';
import { confirmar } from '../stores/avisoStore';
import { useCores } from '../stores/temaStore';
import { useAprovacoesContador } from '../stores/aprovacoesContadorStore';
import { carregarFilaClasses } from '../lib/fluxoClasses';
import { getClubeAtivoId } from '../lib/contextoAtual';

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
const TABS_REGIONAL = [
  { id: 'inicio',     path: '/',                 label: 'Início',     icon: 'home-outline',                iconActive: 'home' },
  { id: 'aprovacoes', path: '/admin/aprovacoes', label: 'Aprovações', icon: 'checkmark-done-circle-outline', iconActive: 'checkmark-done-circle' },
  { id: 'classes',    path: '/classes',          label: 'Classes',    icon: 'ribbon-outline',              iconActive: 'ribbon' },
  { id: 'perfil',     path: '/perfil',           label: 'Perfil',     icon: 'person-circle-outline',       iconActive: 'person-circle' },
  { id: 'sair',       path: '__sair__',          label: 'Sair',       icon: 'log-out-outline',             iconActive: 'log-out' },
] as const;

/** A Associação só cuida dos perfis externos (pastor e regional). */
const TABS_ASSOCIACAO = [
  { id: 'inicio',          path: '/',                       label: 'Início',   icon: 'home-outline',          iconActive: 'home' },
  { id: 'perfisExternos',  path: '/admin/perfis-externos',  label: 'Perfis',   icon: 'shield-checkmark-outline', iconActive: 'shield-checkmark' },
  { id: 'perfil',          path: '/perfil',                 label: 'Perfil',   icon: 'person-circle-outline', iconActive: 'person-circle' },
  { id: 'sair',            path: '__sair__',                label: 'Sair',     icon: 'log-out-outline',       iconActive: 'log-out' },
] as const;

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
  const ehAssociacao = !ehRegional && permissoes.temPerfil(['usuario_associacao']);
  const pendentes = useAprovacoesContador((s) => s.total);
  const definirPendentes = useAprovacoesContador((s) => s.definir);
  const tabs: readonly { id: string; path: string; label: string; icon: string; iconActive: string }[] = ehRegional
    ? TABS_REGIONAL
    : ehAssociacao
      ? TABS_ASSOCIACAO
      : TABS.filter((tab) => !('permissao' in tab) || permissoes.pode(tab.permissao));

  // Regional: quantas classes esperam a aprovação dele. Atualiza a cada troca de tela; a tela de
  // Aprovações também atualiza o número depois de cada aprovação ou recusa.
  useEffect(() => {
    if (!ehRegional) return;
    let ativo = true;
    carregarFilaClasses(getClubeAtivoId())
      .then((fila) => { if (ativo) definirPendentes(fila.filter((f) => f.etapa === 'regional').length); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [ehRegional, pathname, definirPendentes]);

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
            <View>
              <Ionicons
                name={(isActive ? tab.iconActive : tab.icon) as any}
                size={23}
                color={isActive ? cores.acento : cores.textoSecundario}
              />
              {tab.id === 'aprovacoes' && ehRegional && pendentes > 0 ? (
                <View style={styles.contador} accessibilityLabel={`${pendentes} para aprovar`}>
                  <Text style={styles.contadorTexto}>{pendentes > 99 ? '99+' : pendentes}</Text>
                </View>
              ) : null}
            </View>
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
  contador: {
    position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: '#e53935', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#ffffff',
  },
  contadorTexto: { color: '#fff', fontSize: 10, fontWeight: '900' },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  labelActive: {
    fontWeight: '800',
  },
});

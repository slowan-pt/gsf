import { Alert, Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';

/**
 * Botão flutuante "Sair" — antes só existia dentro de app/(tabs)/_layout.tsx,
 * então telas fora do grupo de abas (Classes, fichas etc.) nunca mostravam a
 * opção de sair, mesmo sendo acessadas pelo mesmo rodapé de navegação.
 */
export function BotaoSairFlutuante() {
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();

  async function sair() {
    await logout();
    router.replace('/auth/login');
  }

  function confirmarSair() {
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja sair do sistema?')) sair();
      return;
    }
    Alert.alert('Sair', 'Deseja sair do sistema?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: sair },
    ]);
  }

  return (
    <TouchableOpacity
      onPress={confirmarSair}
      style={[styles.logoutFloating, { top: Math.max(insets.top + 10, 18) }]}
      accessibilityLabel="Sair do sistema"
    >
      <Ionicons name="log-out-outline" size={17} color="#fff" />
      <Text style={styles.logoutFloatingText}>Sair</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  logoutFloating: {
    position: 'absolute',
    right: 12,
    zIndex: 999,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(26,58,92,0.88)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  logoutFloatingText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});

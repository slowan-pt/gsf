import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { confirmar } from '../stores/avisoStore';

/**
 * Botão "Sair" — antes só existia dentro de app/(tabs)/_layout.tsx, então
 * telas fora do grupo de abas (Classes, fichas etc.) nunca mostravam a opção
 * de sair, mesmo sendo acessadas pelo mesmo rodapé de navegação.
 *
 * `flutuante` (padrão): sobrepõe a tela no canto superior direito — usado
 * nas abas, que não têm nenhum outro botão ali. Em telas que JÁ têm um botão
 * no canto do cabeçalho (ex.: "Catálogo" em Classes), passe
 * `flutuante={false}` pra renderizar no fluxo normal do cabeçalho, lado a
 * lado — o botão em si (ícone, texto, cor) é sempre o mesmo, só a posição
 * muda, senão os dois acabavam se sobrepondo e escondendo o ícone.
 */
export function BotaoSairFlutuante({ flutuante = true }: { flutuante?: boolean }) {
  const logout = useAuthStore((s) => s.logout);
  const insets = useSafeAreaInsets();

  async function sair() {
    await logout();
    router.replace('/auth/login');
  }

  async function confirmarSair() {
    if (await confirmar('Sair', 'Deseja sair do sistema?', 'Sair')) await sair();
  }

  return (
    <TouchableOpacity
      onPress={confirmarSair}
      style={[
        styles.logoutBtn,
        flutuante ? [styles.logoutFloating, { top: Math.max(insets.top + 10, 18) }] : styles.logoutInline,
      ]}
      accessibilityLabel="Sair do sistema"
    >
      <Ionicons name="log-out-outline" size={17} color="#fff" />
      <Text style={styles.logoutText}>Sair</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(26,58,92,0.88)',
  },
  logoutFloating: {
    position: 'absolute',
    right: 12,
    zIndex: 999,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  logoutInline: {},
  logoutText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});

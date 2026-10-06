import { Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAtualizacaoStore } from '../stores/atualizacaoStore';

/**
 * iPhone: aviso de tela cheia, sem botão de fechar, quando a App Store tem uma
 * versão mais nova (a Apple não tem o fluxo "immediate" do Android). O único
 * caminho é o botão, que abre direto a página do app na loja.
 */
export function AtualizacaoObrigatoria() {
  const urlLoja = useAtualizacaoStore((s) => s.urlLoja);
  const versaoLoja = useAtualizacaoStore((s) => s.versaoLoja);
  if (Platform.OS !== 'ios' || !urlLoja) return null;
  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={() => {}}>
      <View style={s.tela}>
        <View style={s.icone}>
          <Ionicons name="cloud-download-outline" size={44} color="#fff" />
        </View>
        <Text style={s.titulo} accessibilityRole="header">Atualização disponível</Text>
        <Text style={s.texto}>
          Há uma nova versão do app{versaoLoja ? ` (${versaoLoja})` : ''}. Atualize para continuar usando.
        </Text>
        <TouchableOpacity
          style={s.botao}
          accessibilityRole="button"
          onPress={() => { Linking.openURL(urlLoja).catch(() => {}); }}
        >
          <Text style={s.botaoTexto}>Atualizar agora</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#4b2bb0', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  icone: { width: 88, height: 88, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  titulo: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  texto: { color: 'rgba(255,255,255,0.9)', fontSize: 16, textAlign: 'center', lineHeight: 23 },
  botao: { marginTop: 8, backgroundColor: '#ffdd33', borderRadius: 16, paddingVertical: 15, paddingHorizontal: 34, boxShadow: '0px 4px 0px #c09522' },
  botaoTexto: { color: '#432958', fontSize: 16, fontWeight: '900' },
});

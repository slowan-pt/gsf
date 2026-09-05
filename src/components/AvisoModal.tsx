import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAvisoStore } from '../stores/avisoStore';

const ICONE_POR_TIPO: Record<string, { nome: keyof typeof Ionicons.glyphMap; cor: string }> = {
  info: { nome: 'information-circle', cor: '#1a3a5c' },
  erro: { nome: 'alert-circle', cor: '#c0392b' },
  sucesso: { nome: 'checkmark-circle', cor: '#2e7d32' },
};

/** Renderizado uma vez em app/_layout.tsx — qualquer tela chama avisar()/useAvisoStore para usar. */
export function AvisoModal() {
  const { visivel, titulo, mensagem, tipo, botoes, fechar } = useAvisoStore();
  const icone = ICONE_POR_TIPO[tipo] ?? ICONE_POR_TIPO.info;

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={fechar}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: icone.cor }]}>
            <Ionicons name={icone.nome} size={30} color="#fff" />
          </View>
          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.mensagem}>{mensagem}</Text>
          <View style={styles.botoesRow}>
            {botoes.map((botao, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.btn, botao.estilo === 'cancelar' && styles.btnCancelar]}
                onPress={() => { fechar(); botao.onPress?.(); }}
              >
                <Text style={[styles.btnText, botao.estilo === 'cancelar' && styles.btnTextCancelar]}>
                  {botao.texto}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,20,35,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 18, padding: 24,
    alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14,
  },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  titulo: { fontSize: 18, fontWeight: '900', color: '#1a3a5c', textAlign: 'center' },
  mensagem: { fontSize: 14, color: '#546e7a', textAlign: 'center', lineHeight: 20, marginTop: 8 },
  botoesRow: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  btn: { flex: 1, backgroundColor: '#1a3a5c', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnCancelar: { backgroundColor: '#eef3f8' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnTextCancelar: { color: '#1a3a5c' },
});

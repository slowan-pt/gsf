import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Faixa laranja "Aguardando aprovação" (classe ou especialidade na fila da diretoria/regional
 * ou no ambiente intermediário). Fica no canto do bloco, por cima.
 */
export function SeloAguardando({ compacto = false }: { compacto?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[s.faixa, compacto && s.faixaCompacta]}
      accessible
      accessibilityLabel="Aguardando aprovação"
    >
      <Ionicons name="hourglass-outline" size={compacto ? 9 : 12} color="#fff" />
      <Text style={[s.texto, compacto && s.textoCompacto]} numberOfLines={2}>Aguardando aprovação</Text>
    </View>
  );
}

const s = StyleSheet.create({
  faixa: {
    position: 'absolute', top: -7, right: -8, maxWidth: 98, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#e8420f', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6,
    boxShadow: '0px 2px 0px #a82d08', zIndex: 5,
  },
  faixaCompacta: { position: 'relative', top: 0, right: 0, alignSelf: 'center', maxWidth: 92, paddingHorizontal: 5, paddingVertical: 2 },
  texto: { flexShrink: 1, color: '#fff', fontSize: 9, fontWeight: '900', lineHeight: 10 },
  textoCompacto: { fontSize: 8, lineHeight: 9 },
});

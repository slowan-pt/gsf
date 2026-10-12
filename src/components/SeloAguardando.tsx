import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Faixa laranja "Aguardando aprovação" (classe ou especialidade na fila da diretoria/regional
 * ou no ambiente intermediário). Fica no canto do bloco, por cima.
 */
export function SeloAguardando({ compacto = false, tipo = 'aguardando' }: { compacto?: boolean; tipo?: 'aguardando' | 'correcoes' | 'concluida' | 'investidura' | 'diretoria' | 'regional' | 'devolvida' }) {
  const correcoes = tipo === 'correcoes' || tipo === 'devolvida';
  const concluida = tipo === 'concluida';
  const investidura = tipo === 'investidura';
  const rotulo = tipo === 'diretoria' ? 'Com a diretoria' : tipo === 'regional' ? 'Com o regional' : tipo === 'devolvida' ? 'Devolvida para correção' : investidura ? 'Aguardando investidura' : concluida ? 'Concluída' : correcoes ? 'Correções solicitadas' : 'Aguardando aprovação';
  return (
    <View
      pointerEvents="none"
      style={[s.faixa, compacto && s.faixaCompacta, correcoes && s.faixaCorrecoes, concluida && s.faixaConcluida, investidura && s.faixaInvestidura]}
      accessible
      accessibilityLabel={rotulo}
    >
      <Ionicons name={investidura ? 'ribbon' : tipo === 'diretoria' || tipo === 'regional' ? 'person-circle-outline' : concluida ? 'checkmark-circle' : correcoes ? 'document-text-outline' : 'hourglass-outline'} size={compacto ? 9 : 12} color="#fff" />
      <Text style={[s.texto, compacto && s.textoCompacto]} numberOfLines={2}>{rotulo}</Text>
    </View>
  );
}

/**
 * Selo de uma classe já iniciada cuja equivalente (regular ou agrupadas) fica anulada:
 * "Anula: Amigo - Agrupadas". Fica em linha, abaixo do status.
 */
export function SeloEquivalente({ texto, compacto = false }: { texto: string; compacto?: boolean }) {
  return (
    <View style={[s.equiv, compacto && s.equivCompacto]} accessible accessibilityLabel={texto}>
      <Ionicons name="swap-horizontal" size={compacto ? 10 : 12} color="#5b3fd0" />
      <Text style={[s.equivTexto, compacto && { fontSize: 9, lineHeight: 11 }]} numberOfLines={2}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  equiv: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#ece7ff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginTop: 5 },
  equivCompacto: { marginTop: 4, paddingHorizontal: 5, paddingVertical: 2 },
  equivTexto: { flexShrink: 1, color: '#4328b0', fontSize: 10, fontWeight: '900', lineHeight: 12 },
  faixa: {
    position: 'absolute', top: -7, right: -8, maxWidth: 98, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#e8420f', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6,
    boxShadow: '0px 2px 0px #a82d08', zIndex: 5,
  },
  faixaCorrecoes: { backgroundColor: '#d4161c', boxShadow: '0px 2px 0px #8f0e12' },
  faixaInvestidura: { backgroundColor: '#5b3fd0', boxShadow: '0px 2px 0px #3a2796' },
  faixaConcluida: { backgroundColor: '#1f9d4d', boxShadow: '0px 2px 0px #136b33' },
  faixaCompacta: { position: 'relative', top: 0, right: 0, alignSelf: 'center', maxWidth: 92, paddingHorizontal: 5, paddingVertical: 2 },
  texto: { flexShrink: 1, color: '#fff', fontSize: 9, fontWeight: '900', lineHeight: 10 },
  textoCompacto: { fontSize: 8, lineHeight: 9 },
});

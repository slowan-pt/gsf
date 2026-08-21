import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSincroniaStore } from '../stores/sincroniaStore';

/**
 * Tarja discreta sobre o rodapé mostrando onde o dado está: só no aparelho,
 * subindo, ou já no servidor. Aparece e some sozinha, sem bloquear a tela.
 */
export function StatusSincronia() {
  const estado = useSincroniaStore((s) => s.estado);
  const pendentes = useSincroniaStore((s) => s.pendentes);
  const ignorados = useSincroniaStore((s) => s.ignorados);
  const cargaInicial = useSincroniaStore((s) => s.cargaInicial);
  const cargaFeitas = useSincroniaStore((s) => s.cargaFeitas);
  const cargaTotal = useSincroniaStore((s) => s.cargaTotal);
  const cargaRotulo = useSincroniaStore((s) => s.cargaRotulo);
  const cargaAvisoVisivel = useSincroniaStore((s) => s.cargaAvisoVisivel);
  const ocultarAvisoCarga = useSincroniaStore((s) => s.ocultarAvisoCarga);
  const opacidade = useRef(new Animated.Value(0)).current;

  // O aviso do download inicial só aparece uma vez, por alguns segundos (ou
  // até o usuário fechar) — o download continua em segundo plano do mesmo jeito.
  const mostrarCarga = cargaInicial !== 'ocioso' && cargaAvisoVisivel;
  const visivel = mostrarCarga || estado !== 'ocioso';

  useEffect(() => {
    Animated.timing(opacidade, {
      toValue: visivel ? 1 : 0,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visivel, opacidade]);

  if (!mostrarCarga && estado === 'ocioso') return null;

  const visualCarga = {
    baixando: {
      icone: 'cloud-download-outline' as const,
      cor: '#1a3a5c',
      fundo: '#eef3f8',
      texto: cargaTotal > 0
        ? `Baixando ${cargaFeitas + 1}/${cargaTotal}: ${cargaRotulo} — já pode usar`
        : 'Baixando dados — já pode usar o app',
    },
    concluida: {
      icone: 'checkmark-circle-outline' as const,
      cor: '#2e7d32',
      fundo: '#e8f5e9',
      texto: 'Download concluído — todos os dados disponíveis',
    },
    incompleta: {
      icone: 'alert-circle-outline' as const,
      cor: '#b45309',
      fundo: '#fff7ed',
      texto: 'Conexão instável — o app segue tentando baixar sozinho',
    },
  }[cargaInicial as Exclude<typeof cargaInicial, 'ocioso'>];

  // Só usa o banner de carga se o aviso ainda estiver liberado a aparecer.
  const visual = (mostrarCarga ? visualCarga : null) ?? {
    local: {
      icone: 'phone-portrait-outline' as const,
      cor: '#b45309',
      fundo: '#fff7ed',
      texto: pendentes > 1
        ? `Informação salva localmente (${pendentes} pendentes)`
        : 'Informação salva localmente',
    },
    enviando: {
      icone: 'cloud-upload-outline' as const,
      cor: '#1a3a5c',
      fundo: '#eef3f8',
      texto: 'Enviando para o servidor...',
    },
    concluido: {
      icone: 'cloud-done-outline' as const,
      cor: '#2e7d32',
      fundo: '#e8f5e9',
      texto: ignorados > 0
        ? `Sincronia concluída · ${ignorados} já estava(m) igual(is)`
        : 'Sincronia concluída',
    },
    // Sem aviso aqui de propósito: um push que falha (rede instável, RLS
    // negando por algum motivo pontual) é tentado de novo sozinho depois —
    // a tarja aparecendo toda vez que isso acontece só alarmava sem ajudar.
    erro: null,
    ocioso: null,
  }[estado];

  if (!visual) return null;

  return (
    <Animated.View pointerEvents="box-none" style={[s.wrapper, { opacity: opacidade }]}>
      <View style={[s.tarja, { backgroundColor: visual.fundo, borderColor: visual.cor + '33' }]}>
        <Ionicons name={visual.icone} size={14} color={visual.cor} />
        <Text style={[s.texto, { color: visual.cor }]} numberOfLines={1}>{visual.texto}</Text>
        {mostrarCarga && (
          <TouchableOpacity
            onPress={ocultarAvisoCarga}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.fechar}
          >
            <Ionicons name="close" size={14} color={visual.cor} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    // No TOPO: embaixo ela cobria o rodapé de navegação.
    top: 0,
    paddingTop: 46,
    alignItems: 'center',
    zIndex: 900,
  },
  tarja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '92%',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  texto: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  fechar: { marginLeft: 2, padding: 1 },
});

import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { temAcessoOfflineValido } from '../lib/acessoOffline';

/**
 * Atalho "AcampClasses (sem internet)" para as telas de entrada (login/MFA), onde quem está sem rede cai.
 * Só aparece quando este aparelho já foi preparado e a autorização ainda vale; fora disso não renderiza nada,
 * então não muda nada para quem não usa o módulo.
 */
export function AcessoAcampOffline() {
  const [visivel, setVisivel] = useState(false);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    temAcessoOfflineValido().then((v) => { if (ativo) setVisivel(v); }).catch(() => {});
    return () => { ativo = false; };
  }, []));

  if (!visivel) return null;
  return (
    <TouchableOpacity
      style={s.botao}
      onPress={() => router.push('/acampclasses' as any)}
      accessibilityRole="button"
      accessibilityLabel="Abrir o AcampClasses sem internet"
    >
      <Ionicons name="cloud-offline-outline" size={17} color="#4b2bb0" />
      <Text style={s.texto}>AcampClasses (sem internet)</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  botao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12,
    paddingVertical: 12, borderRadius: 14, backgroundColor: '#ffe16a',
  },
  texto: { fontSize: 14, fontWeight: '800', color: '#4b2bb0' },
});

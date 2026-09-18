import { ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { avisar } from '../stores/avisoStore';

const URL_SUPORTE = 'https://clubeplus.pages.dev/suporte';

/** Mostra o aviso padrão de recurso bloqueado na demonstração. */
export function acaoBloqueadaDemo() {
  avisar(
    'Este recurso estará disponível após o cadastro do clube. No ambiente de demonstração, nenhuma alteração é salva.',
    'info',
    'Demonstração'
  );
}

export type PersonaDemo = 'diretoria' | 'membro';

interface DemoShellProps {
  titulo: string;
  subtitulo: string;
  persona: PersonaDemo;
  children: ReactNode;
}

/**
 * Casca comum das telas de demo: cabeçalho, aviso permanente de dados
 * fictícios, conteúdo rolável, e o rodapé fixo com troca de perfil,
 * "Quero o Clube + no meu clube" e "Sair da demonstração" — exigidos em toda
 * tela da demonstração. Trocar perfil troca só a navegação local (nenhuma
 * chamada de rede, nenhuma sessão criada).
 */
export function DemoShell({ titulo, subtitulo, persona, children }: DemoShellProps) {
  const outraPersona: PersonaDemo = persona === 'diretoria' ? 'membro' : 'diretoria';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/demo')} style={styles.voltarBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>{titulo}</Text>
          <Text style={styles.headerSub}>{subtitulo}</Text>
        </View>
      </View>

      <View style={styles.avisoFaixa}>
        <Ionicons name="information-circle-outline" size={15} color="#6b4f0a" />
        <Text style={styles.avisoTexto}>
          Ambiente de demonstração — todos os nomes e dados são fictícios. Nenhuma alteração será salva.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {children}
      </ScrollView>

      <View style={styles.rodape}>
        <TouchableOpacity
          style={styles.trocarBtn}
          onPress={() => router.replace(`/demo/${outraPersona}` as any)}
        >
          <Ionicons name="swap-horizontal-outline" size={16} color="#1a3a5c" />
          <Text style={styles.trocarTexto}>Trocar perfil da demonstração</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cadastroBtn} onPress={() => Linking.openURL(URL_SUPORTE)}>
          <Ionicons name="rocket-outline" size={16} color="#fff" />
          <Text style={styles.cadastroTexto}>Quero o Clube + no meu clube</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sairBtn} onPress={() => router.replace('/auth/login')}>
          <Text style={styles.sairTexto}>Sair da demonstração</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a3a5c',
    padding: 16, paddingTop: 20,
  },
  voltarBtn: { padding: 4 },
  headerTitulo: { color: '#fff', fontWeight: '800', fontSize: 17 },
  headerSub: { color: '#a8c8e8', fontSize: 12, marginTop: 2 },
  avisoFaixa: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff3cd',
    paddingVertical: 8, paddingHorizontal: 14,
  },
  avisoTexto: { flex: 1, fontSize: 11.5, color: '#6b4f0a', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  rodape: { padding: 14, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e6ec', gap: 8 },
  trocarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#eef3f8', borderRadius: 10, padding: 12,
  },
  trocarTexto: { color: '#1a3a5c', fontWeight: '700', fontSize: 13 },
  cadastroBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1a3a5c', borderRadius: 10, padding: 13,
  },
  cadastroTexto: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sairBtn: { alignItems: 'center', padding: 8 },
  sairTexto: { color: '#78909c', fontWeight: '700', fontSize: 13 },

  secaoTitulo: { color: '#1a3a5c', fontWeight: '800', fontSize: 15, marginTop: 18, marginBottom: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitulo: { color: '#263238', fontWeight: '700', fontSize: 14 },
  cardSub: { color: '#78909c', fontSize: 12, marginTop: 3 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#e8f0fe' },
  chipTexto: { color: '#1a3a5c', fontSize: 11, fontWeight: '700' },
  progressoFundo: { height: 8, borderRadius: 999, backgroundColor: '#e0e6ec', overflow: 'hidden', marginTop: 8 },
  progressoPreenchido: { height: '100%', borderRadius: 999, backgroundColor: '#1a3a5c' },
  acaoBloqueada: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#f0f4f8',
  },
  acaoBloqueadaTexto: { color: '#90a4ae', fontSize: 11.5, fontWeight: '700' },
  avatarIniciais: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a3a5c',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarIniciaisTexto: { color: '#fff', fontWeight: '800', fontSize: 12 },
});

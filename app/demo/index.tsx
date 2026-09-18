import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CLUBE_DEMO } from '../../src/demo/fixtures';

const URL_SUPORTE = 'https://clube360.pages.dev/suporte';

export default function DemoIndex() {
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.logoArea}>
          <View style={styles.badge}>
            <Ionicons name="eye-outline" size={28} color="#fff" />
          </View>
          <Text style={styles.titulo}>Explorar o Clube +</Text>
          <Text style={styles.sub}>{CLUBE_DEMO.nome} · {CLUBE_DEMO.cidade}</Text>
        </View>

        <View style={styles.avisoCard}>
          <Ionicons name="information-circle-outline" size={18} color="#1a3a5c" />
          <Text style={styles.avisoTexto}>
            Ambiente de demonstração — todos os nomes e dados são fictícios.
            Nenhuma alteração será salva.
          </Text>
        </View>

        <Text style={styles.pergunta}>Como você quer explorar o app?</Text>

        <TouchableOpacity
          style={styles.opcaoCard}
          onPress={() => router.push('/demo/diretoria' as any)}
        >
          <View style={[styles.opcaoIcone, { backgroundColor: '#e8f0fe' }]}>
            <Ionicons name="briefcase-outline" size={22} color="#1a3a5c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.opcaoTitulo}>Visão da diretoria</Text>
            <Text style={styles.opcaoSub}>Painel, agenda, membros, relatórios e mais</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#90a4ae" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.opcaoCard}
          onPress={() => router.push('/demo/membro' as any)}
        >
          <View style={[styles.opcaoIcone, { backgroundColor: '#e8f5e9' }]}>
            <Ionicons name="person-outline" size={22} color="#2e7d32" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.opcaoTitulo}>Visão do membro</Text>
            <Text style={styles.opcaoSub}>Perfil, agenda, classes, ranking e mais</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#90a4ae" />
        </TouchableOpacity>

        <Text style={styles.trocaNota}>
          Você pode trocar de perfil a qualquer momento durante a exploração.
        </Text>

        <View style={styles.rodape}>
          <Text style={styles.rodapeTexto}>
            Conheça as principais funcionalidades usando um ambiente
            demonstrativo com dados fictícios. Não é necessário criar uma conta.
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(URL_SUPORTE)}>
            <Text style={styles.linkCadastro}>Quero o Clube + no meu clube</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.sairBtn} onPress={() => router.replace('/auth/login')}>
          <Ionicons name="close-outline" size={18} color="#1a3a5c" />
          <Text style={styles.sairTexto}>Sair da demonstração</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3a5c' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 22 },
  badge: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  titulo: { fontSize: 21, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub: { fontSize: 13, color: '#a8c8e8', marginTop: 4, textAlign: 'center' },
  avisoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff3cd',
    borderRadius: 10, padding: 12, marginBottom: 20,
  },
  avisoTexto: { flex: 1, fontSize: 12.5, color: '#6b4f0a', fontWeight: '600' },
  pergunta: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 10 },
  opcaoCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 2,
  },
  opcaoIcone: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  opcaoTitulo: { color: '#1a3a5c', fontWeight: '800', fontSize: 15 },
  opcaoSub: { color: '#78909c', fontSize: 12, marginTop: 2 },
  trocaNota: { color: '#a8c8e8', fontSize: 11.5, textAlign: 'center', marginTop: 4 },
  rodape: { marginTop: 18, alignItems: 'center' },
  rodapeTexto: { color: '#a8c8e8', fontSize: 12.5, textAlign: 'center', marginBottom: 8 },
  linkCadastro: { color: '#f9c74f', fontWeight: '800', fontSize: 14 },
  sairBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 10, padding: 13, marginTop: 22,
  },
  sairTexto: { color: '#1a3a5c', fontWeight: '700', fontSize: 14 },
});

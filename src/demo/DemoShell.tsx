import { ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { avisar } from '../stores/avisoStore';
import { Avatar, avatarCor } from '../components/common/Avatar';

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

export interface AbaDemo {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconAtivo: keyof typeof Ionicons.glyphMap;
}

interface DemoShellProps {
  /** Nome de quem a demo representa (aparece na saudação do cabeçalho, igual ao painel real). */
  nomeUsuario: string;
  subtitulo: string;
  persona: PersonaDemo;
  abas: AbaDemo[];
  abaAtiva: string;
  onTrocarAba: (id: string) => void;
  children: ReactNode;
}

/**
 * Casca comum das telas de demo — reproduz o MESMO padrão visual do app
 * real (não uma versão simplificada): cabeçalho colorido com avatar e
 * saudação (igual a app/(tabs)/index.tsx), barra de abas inferior com os
 * mesmos ícones/cores de src/components/BottomNav.tsx (NAV_COLORS), e o
 * aviso permanente de dados fictícios. "Avatar"/"avatarCor" são os mesmos
 * componentes puros usados no app de verdade (sem Supabase/sessão), então
 * o visual bate mesmo sendo 100% local.
 */
export function DemoShell({ nomeUsuario, subtitulo, persona, abas, abaAtiva, onTrocarAba, children }: DemoShellProps) {
  const outraPersona: PersonaDemo = persona === 'diretoria' ? 'membro' : 'diretoria';
  const primeiroNome = nomeUsuario.split(' ')[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Avatar nome={nomeUsuario} cor={avatarCor(nomeUsuario)} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.saudacao}>Olá, {primeiroNome}! 👋</Text>
          <Text style={styles.data}>{subtitulo}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.replace(`/demo/${outraPersona}` as any)}
        >
          <Ionicons name="swap-horizontal-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.replace('/auth/login')}>
          <Ionicons name="exit-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.avisoFaixa}>
        <Ionicons name="information-circle-outline" size={14} color="#6b4f0a" />
        <Text style={styles.avisoTexto} numberOfLines={2}>
          Ambiente de demonstração — dados fictícios, nada é salvo.
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL(URL_SUPORTE)}>
          <Text style={styles.avisoLink}>Quero o Clube +</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {children}
      </ScrollView>

      <View style={styles.tabBar}>
        {abas.map((aba) => {
          const ativa = aba.id === abaAtiva;
          return (
            <TouchableOpacity key={aba.id} style={styles.tab} onPress={() => onTrocarAba(aba.id)} activeOpacity={0.7}>
              <Ionicons name={ativa ? aba.iconAtivo : aba.icon} size={22} color={ativa ? '#1a3a5c' : '#8b96a3'} />
              <Text style={[styles.tabLabel, ativa && styles.tabLabelAtiva]}>{aba.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a3a5c',
    padding: 16, paddingTop: 48, paddingBottom: 18,
  },
  saudacao: { color: '#fff', fontWeight: '800', fontSize: 16 },
  data: { color: '#a8c8e8', fontSize: 12, marginTop: 2 },
  headerIconBtn: { padding: 4 },

  avisoFaixa: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff3cd',
    paddingVertical: 7, paddingHorizontal: 14,
  },
  avisoTexto: { flex: 1, fontSize: 11, color: '#6b4f0a', fontWeight: '600' },
  avisoLink: { fontSize: 11, color: '#1a3a5c', fontWeight: '800', textDecorationLine: 'underline' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dde4ec',
    paddingTop: 8, paddingBottom: 10, elevation: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  tabLabel: { fontSize: 10, fontWeight: '600', color: '#8b96a3' },
  tabLabelAtiva: { color: '#1a3a5c' },

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

  // Pódio do ranking — mesmo padrão visual de app/(tabs)/ranking.tsx
  podio: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 8, gap: 8 },
  podioItem: { alignItems: 'center', flex: 1 },
  podioMedalha: { fontSize: 22, marginTop: 4, marginBottom: 2 },
  podioNome: { fontSize: 12, fontWeight: '700', color: '#333', textAlign: 'center' },
  podioPts: { fontSize: 11, color: '#666', marginBottom: 6 },
  podioPillar: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6, justifyContent: 'center', alignItems: 'center' },
  podioPillarNum: { color: '#fff', fontWeight: '800', fontSize: 18 },
  itemLista: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginTop: 8, padding: 12, borderRadius: 12, elevation: 1, gap: 10 },
  itemPos: { width: 28, fontSize: 15, fontWeight: '700', color: '#555' },
  itemInfo: { flex: 1 },
  itemNome: { fontSize: 14, fontWeight: '600', color: '#222' },
  itemSub: { fontSize: 12, color: '#888', marginTop: 2 },
  itemPts: { fontSize: 15, fontWeight: '700', color: '#1a3a5c' },
});

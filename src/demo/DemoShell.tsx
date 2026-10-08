import { ReactNode, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { avisar } from '../stores/avisoStore';
import { Avatar, avatarCor } from '../components/common/Avatar';
import { useCores } from '../stores/temaStore';
import { FundoDegrade, useCoresDegrade } from '../components/Gradiente';
import { BotaoCabecalho, useMedidasCabecalho } from '../components/CabecalhoTela';
import { SaudacaoCabecalho } from '../components/HomeHero';
import { TituloSecao } from '../components/ui';
import type { CoresTema } from '../lib/tema';

const URL_SUPORTE = 'https://dbvplus.pages.dev/suporte';
const PADDING_BARRA = 8;
const GAP_ABAS = 4;

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
 * Casca comum das telas de demo — usa os MESMOS componentes visuais do app real:
 * cabeçalho em degradê da marca com a saudação e a foto quadrada (SaudacaoCabecalho),
 * botões translúcidos do cabeçalho, e a barra inferior em pílula (como BottomNav).
 * Cores vêm do tema do usuário (paleta e modo escuro), então a demo acompanha a
 * aparência do resto do app. Todos os dados são fictícios (src/demo/fixtures.ts).
 */
export function DemoShell({ nomeUsuario, subtitulo, persona, abas, abaAtiva, onTrocarAba, children }: DemoShellProps) {
  const cores = useCores();
  const insets = useSafeAreaInsets();
  const [de, ate] = useCoresDegrade();
  const { topo, base } = useMedidasCabecalho();
  const [larguraBarra, setLarguraBarra] = useState(0);
  const outraPersona: PersonaDemo = persona === 'diretoria' ? 'membro' : 'diretoria';
  const primeiroNome = nomeUsuario.split(' ')[0];

  // Mesma conta do BottomNav: uma fonte só, pela largura real da aba, sem quebrar o rótulo.
  const maiorRotulo = Math.max(...abas.map((a) => a.label.length));
  const larguraAba = larguraBarra > 0 ? (larguraBarra - 2 * PADDING_BARRA - GAP_ABAS * (abas.length - 1)) / abas.length - 4 : 0;
  const tamanhoRotulo = larguraAba > 0 ? Math.max(8, Math.min(11, Math.floor((larguraAba / (maiorRotulo * 0.62)) * 10) / 10)) : 11;

  return (
    <View style={[st.container, { backgroundColor: cores.fundo }]}>
      <View style={{ paddingTop: topo, paddingBottom: base, paddingHorizontal: 20, overflow: 'hidden' }}>
        <FundoDegrade de={de} ate={ate} />
        <View style={st.linhaCabecalho}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <SaudacaoCabecalho nome={primeiroNome} data={subtitulo} />
          </View>
          <BotaoCabecalho icone="swap-horizontal-outline" rotulo="Trocar de perfil" onPress={() => router.replace(`/demo/${outraPersona}` as any)} />
          <BotaoCabecalho icone="exit-outline" rotulo="Sair da demonstração" onPress={() => router.replace('/auth/login')} />
        </View>
      </View>

      <View style={[st.avisoFaixa, { backgroundColor: cores.isEscuro ? '#4a3a12' : '#fff3cd' }]}>
        <Ionicons name="information-circle-outline" size={14} color={cores.isEscuro ? '#f5cf73' : '#6b4f0a'} />
        <Text style={[st.avisoTexto, { color: cores.isEscuro ? '#f5cf73' : '#6b4f0a' }]} numberOfLines={2}>
          Ambiente de demonstração — dados fictícios, nada é salvo.
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL(URL_SUPORTE)} accessibilityRole="link">
          <Text style={[st.avisoLink, { color: cores.acento }]}>Quero o DBV+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.scrollContent}>
        {children}
      </ScrollView>

      <View
        onLayout={(e) => setLarguraBarra(e.nativeEvent.layout.width)}
        style={[st.tabBar, { backgroundColor: cores.cartao, borderTopColor: cores.borda, paddingBottom: Math.max(insets.bottom, 8) }]}
      >
        {abas.map((aba) => {
          const ativa = aba.id === abaAtiva;
          return (
            <TouchableOpacity
              key={aba.id}
              style={[st.tab, ativa && { backgroundColor: cores.acentoSuave }]}
              onPress={() => onTrocarAba(aba.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={aba.label}
              accessibilityState={{ selected: ativa }}
            >
              <Ionicons name={ativa ? aba.iconAtivo : aba.icon} size={23} color={ativa ? cores.acento : cores.textoSecundario} />
              <Text
                numberOfLines={1}
                style={{ fontSize: tamanhoRotulo, fontWeight: ativa ? '800' : '700', color: ativa ? cores.acento : cores.textoSecundario }}
              >
                {aba.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function criarEstilos(cores: CoresTema) {
  const cartao = {
    backgroundColor: cores.cartao,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: cores.borda,
    boxShadow: `0px 4px 0px ${cores.sombra}`,
  } as const;
  return StyleSheet.create({
    card: { ...cartao, padding: 14, marginBottom: 12 },
    cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    cardTitulo: { color: cores.texto, fontWeight: '800', fontSize: 14, flexShrink: 1 },
    cardSub: { color: cores.textoSecundario, fontSize: 12, marginTop: 3 },
    chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: cores.acentoSuave },
    chipTexto: { color: cores.acento, fontSize: 11, fontWeight: '800' },
    progressoFundo: { height: 9, borderRadius: 999, backgroundColor: cores.borda, overflow: 'hidden', marginTop: 9 },
    progressoPreenchido: { height: '100%', borderRadius: 999, backgroundColor: cores.primaria },
    acaoBloqueada: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      marginTop: 4, marginBottom: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: cores.acentoSuave,
    },
    acaoBloqueadaTexto: { color: cores.acento, fontSize: 12, fontWeight: '800' },

    podio: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 8, gap: 8 },
    podioItem: { alignItems: 'center', flex: 1 },
    podioMedalha: { fontSize: 22, marginTop: 4, marginBottom: 2 },
    podioNome: { fontSize: 12, fontWeight: '700', color: cores.texto, textAlign: 'center' },
    podioPts: { fontSize: 11, color: cores.textoSecundario, marginBottom: 6 },
    podioPillar: { width: '100%', borderTopLeftRadius: 10, borderTopRightRadius: 10, justifyContent: 'center', alignItems: 'center' },
    podioPillarNum: { color: '#fff', fontWeight: '900', fontSize: 18 },
    itemLista: { ...cartao, flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4, padding: 12, gap: 10 },
    itemPos: { width: 28, fontSize: 15, fontWeight: '800', color: cores.textoSecundario },
    itemInfo: { flex: 1 },
    itemNome: { fontSize: 14, fontWeight: '700', color: cores.texto },
    itemSub: { fontSize: 12, color: cores.textoSecundario, marginTop: 2 },
    itemPts: { fontSize: 15, fontWeight: '900', color: cores.acento },

    atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
    atalho: { ...cartao, width: '31.5%', minHeight: 96, borderRadius: 17, paddingVertical: 13, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', gap: 8 },
    atalhoIcone: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    atalhoRotulo: { fontSize: 12, fontWeight: '800', textAlign: 'center', color: cores.texto },
  });
}

/** Estilos temáticos (paleta e modo escuro) usados pelas telas da demonstração. */
export function useEstilosDemo() {
  const cores = useCores();
  return useMemo(() => criarEstilos(cores), [cores]);
}

/** Título de seção no mesmo padrão do app ("Acesso rápido", "Minhas classes"...). */
export function SecaoDemo({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <View style={{ marginTop: 14, marginBottom: 2 }}>
      <TituloSecao titulo={titulo} subtitulo={subtitulo} />
    </View>
  );
}

export function BotaoBloqueado({ texto }: { texto: string }) {
  const styles = useEstilosDemo();
  const cores = useCores();
  return (
    <TouchableOpacity style={styles.acaoBloqueada} onPress={acaoBloqueadaDemo} accessibilityRole="button">
      <Ionicons name="lock-closed-outline" size={13} color={cores.acento} />
      <Text style={styles.acaoBloqueadaTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

export interface AtalhoDemo {
  rotulo: string;
  icone: keyof typeof Ionicons.glyphMap;
  /** Sem ação própria, mostra o aviso padrão de recurso da demonstração. */
  aoAbrir?: () => void;
}

/** Grade "Acesso rápido": mesmo cartão e mesmos tons de ícone da Início real. */
export function AtalhosDemo({ itens }: { itens: AtalhoDemo[] }) {
  const cores = useCores();
  const styles = useEstilosDemo();
  const tom = (i: number) => {
    const n = i % 3;
    if (cores.isEscuro) return n === 1 ? { fundo: '#83ddd9', cor: '#153d44' } : n === 2 ? { fundo: '#f7d087', cor: '#543916' } : { fundo: '#44305f', cor: '#dec7ff' };
    return n === 1 ? { fundo: '#c9f7f5', cor: '#432958' } : n === 2 ? { fundo: '#ffe3aa', cor: '#432958' } : { fundo: cores.acentoSuave, cor: '#432958' };
  };
  return (
    <View style={styles.atalhos}>
      {itens.map((it, i) => (
        <TouchableOpacity key={it.rotulo} style={styles.atalho} onPress={it.aoAbrir ?? acaoBloqueadaDemo} accessibilityRole="button" accessibilityLabel={it.rotulo}>
          <View style={[styles.atalhoIcone, { backgroundColor: tom(i).fundo }]}>
            <Ionicons name={it.icone} size={24} color={tom(i).cor} />
          </View>
          <Text style={styles.atalhoRotulo} numberOfLines={2}>{it.rotulo}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const MEDALHAS = ['🥇', '🥈', '🥉'];
const CORES_PODIO = ['#FFD700', '#C0C0C0', '#CD7F32'];
export { MEDALHAS };

export function Podio({ itens }: { itens: { nome: string; pontos: number }[] }) {
  const styles = useEstilosDemo();
  const alturas = [95, 70, 55];
  const ordem = [1, 0, 2]; // 2º, 1º, 3º — mesma disposição visual do app real
  return (
    <View style={styles.podio}>
      {ordem.map((i) => {
        const item = itens[i];
        if (!item) return <View key={i} style={{ flex: 1 }} />;
        return (
          <View key={i} style={[styles.podioItem, i !== 0 && { marginTop: i === 1 ? 20 : 40 }]}>
            <Avatar nome={item.nome} cor={avatarCor(item.nome)} size={i === 0 ? 52 : i === 1 ? 44 : 40} />
            <Text style={styles.podioMedalha}>{MEDALHAS[i]}</Text>
            <Text style={[styles.podioNome, i === 0 && { fontWeight: '800' }]}>{item.nome.split(' ')[0]}</Text>
            <Text style={styles.podioPts}>{item.pontos.toLocaleString('pt-BR')}</Text>
            <View style={[styles.podioPillar, { height: alturas[i], backgroundColor: CORES_PODIO[i] }]}>
              <Text style={styles.podioPillarNum}>{i + 1}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  linhaCabecalho: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avisoFaixa: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 14 },
  avisoTexto: { flex: 1, fontSize: 11, fontWeight: '700' },
  avisoLink: { fontSize: 11, fontWeight: '900', textDecorationLine: 'underline' },
  scrollContent: { padding: 16, paddingBottom: 28 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 10, paddingHorizontal: PADDING_BARRA, gap: GAP_ABAS, minHeight: 70 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 2, borderRadius: 13 },
});

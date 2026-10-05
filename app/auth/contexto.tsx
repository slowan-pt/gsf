import { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import type { ContextoAcesso } from '../../src/types';
import { useCores } from '../../src/stores/temaStore';
import { corIcone, estiloCartao } from '../../src/lib/tema';
import { FundoDegrade, useCoresDegrade } from '../../src/components/Gradiente';
import { Tag, EstadoVazio, Botao } from '../../src/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LOGO_DESBRAVADORES = require('../../assets/logo-desbravadores.png');
const LOGO_AVENTUREIROS = require('../../assets/logo-transparente.png');

function iconFor(ctx: ContextoAcesso) {
  if (ctx.tipo === 'responsavel') return 'people-circle';
  if (ctx.perfil === 'admin_ti') return 'shield-checkmark';
  if (ctx.perfil === 'admin_clube') return 'business';
  if (ctx.perfil === 'usuario_pastor' || ctx.perfil === 'usuario_capelao') return 'book';
  if (ctx.perfil === 'usuario_conselheiro') return 'person';
  return 'flag';
}

function temLogoPrograma(ctx: ContextoAcesso) {
  return ctx.programa_codigo === 'desbravadores' || ctx.programa_codigo === 'aventureiros';
}

function CardIcon({ ctx }: { ctx: ContextoAcesso }) {
  const cores = useCores();
  if (ctx.programa_codigo === 'desbravadores') {
    return <Image source={LOGO_DESBRAVADORES} style={s.cardLogoImg} resizeMode="contain" />;
  }
  if (ctx.programa_codigo === 'aventureiros') {
    return <Image source={LOGO_AVENTUREIROS} style={s.cardLogoImg} resizeMode="contain" />;
  }
  return <Ionicons name={iconFor(ctx) as any} size={25} color={corIcone(cores)} />;
}

export default function ContextoScreen() {
  const [de, ate] = useCoresDegrade();
  const insets = useSafeAreaInsets();
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const {
    contextos,
    contextoAtivo,
    selecaoPendente,
    carregando,
    erro,
    carregarContextos,
    escolherContexto,
  } = useContextoStore();

  useEffect(() => {
    if (usuario?.id && contextos.length === 0 && !carregando) {
      carregarContextos(usuario);
    }
  }, [usuario?.id]);

  if (!usuario) return <Redirect href="/auth/login" />;

  async function selecionar(ctx: ContextoAcesso) {
    await escolherContexto(ctx);
    router.replace('/(tabs)');
  }

  async function sair() {
    await logout();
    router.replace('/auth/login');
  }

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <View style={[s.header, { paddingTop: Math.max(48, insets.top + 16) }]}>
        <FundoDegrade de={de} ate={ate} raios />
        <View style={s.headerIcon}>
          <Ionicons name="git-branch" size={28} color="#fff" />
        </View>
        <Text style={s.title} accessibilityRole="header">Escolha como acessar</Text>
        <Text style={s.subtitle}>
          Seu login pode ter mais de um papel. Selecione o contexto para continuar.
        </Text>
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {carregando ? (
          <EstadoVazio icone="hourglass-outline" titulo="Carregando acessos..." />
        ) : null}

        {erro ? (
          <EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} acao="Tentar novamente" aoAcao={() => { if (usuario) void carregarContextos(usuario); }} />
        ) : null}

        {contextos.map((ctx) => {
          const ativo = contextoAtivo?.id === ctx.id;
          return (
            <TouchableOpacity
              key={ctx.id}
              activeOpacity={0.85}
              onPress={() => selecionar(ctx)}
              accessibilityRole="button"
              accessibilityLabel={`${ctx.perfil_nome}, ${ctx.clube_nome_curto || ctx.clube_nome}${ctx.membro_nome ? `, ${ctx.membro_nome}` : ''}`}
              style={[s.card, estiloCartao(cores, 17), { boxShadow: `0px 4px 0px ${cores.sombra}` }, ativo && { borderColor: cores.primaria, borderWidth: 2 }]}
            >
              <View style={[s.cardIcon, { backgroundColor: temLogoPrograma(ctx) ? '#f4f7fa' : cores.acentoSuave }]}>
                <CardIcon ctx={ctx} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.cardTitle, { color: cores.texto }]} numberOfLines={1}>{ctx.perfil_nome}</Text>
                <Text style={[s.cardClub, { color: cores.texto }]} numberOfLines={1}>{ctx.clube_nome_curto || ctx.clube_nome}</Text>
                {ctx.membro_nome ? <Text style={[s.cardSub, { color: cores.textoSecundario }]} numberOfLines={1}>{ctx.membro_nome}</Text> : null}
                <View style={s.tags}>
                  <Tag texto={ctx.programa_nome} />
                  {ativo ? <Tag texto="Atual" tom="verde" /> : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={cores.textoSecundario} />
            </TouchableOpacity>
          );
        })}

        {!carregando && contextos.length === 0 ? (
          <EstadoVazio icone="lock-closed-outline" titulo="Nenhum acesso encontrado" texto="Peça para um administrador vincular seu usuário a um clube." />
        ) : null}

        <View style={s.sair}>
          <Botao rotulo="Sair" icone="log-out-outline" secundario onPress={sair} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 24, overflow: 'hidden' },
  headerIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: '#fff', fontSize: 25, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 6, fontSize: 14, lineHeight: 20 },
  content: { flex: 1 },
  card: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  cardIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardLogoImg: { width: 42, height: 42 },
  cardTitle: { fontSize: 17, fontWeight: '900' },
  cardClub: { fontWeight: '800', marginTop: 2, fontSize: 13 },
  cardSub: { marginTop: 2, fontSize: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  sair: { alignItems: 'center', marginTop: 8 },
});

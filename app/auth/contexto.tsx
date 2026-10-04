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
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, tomTexto } from '../../src/lib/tema';

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
  const corCabecalho = useCorCabecalho();
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
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <View style={s.headerIcon}>
          <Ionicons name="git-branch" size={30} color="#fff" />
        </View>
        <Text style={s.title}>Escolha como acessar</Text>
        <Text style={s.subtitle}>
          Seu login pode ter mais de um papel. Selecione o contexto para continuar.
        </Text>
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 18, gap: 12 }}>
        {carregando ? (
          <View style={[s.loadingBox, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
            <ActivityIndicator color={corIcone(cores)} />
            <Text style={[s.loadingText, cores.isEscuro && { color: '#b9c6cf' }, { color: cores.textoSecundario }]}>Carregando acessos...</Text>
          </View>
        ) : null}

        {erro ? (
          <View style={[s.warnBox, cores.isEscuro && { backgroundColor: '#413e46' }]}>
            <Ionicons name="warning-outline" size={20} color={tomTexto('#b26a00', cores)} />
            <Text style={[s.warnText, cores.isEscuro && { color: '#bdaba6' }, cores.isEscuro && { color: '#bdaba6' }]}>{erro}</Text>
          </View>
        ) : null}

        {contextos.map((ctx) => (
          <TouchableOpacity key={ctx.id} style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]} onPress={() => selecionar(ctx)}>
            <View style={[
              s.cardIcon,
              { backgroundColor: temLogoPrograma(ctx) ? '#f4f7fa' : cores.fundo },
            ]}>
              <CardIcon ctx={ctx} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{ctx.perfil_nome}</Text>
              <Text style={[s.cardClub, cores.isEscuro && { color: '#eceff1' }, { color: cores.texto }]}>{ctx.clube_nome_curto || ctx.clube_nome}</Text>
              {ctx.membro_nome ? <Text style={[s.cardSub, cores.isEscuro && { color: '#b9c6cf' }, { color: cores.textoSecundario }]}>{ctx.membro_nome}</Text> : null}
              <Text style={[s.cardProgram, cores.isEscuro && { color: '#bcc7cf' }, { color: cores.textoSecundario }]}>{ctx.programa_nome}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={cores.textoSecundario} />
          </TouchableOpacity>
        ))}

        {!carregando && contextos.length === 0 ? (
          <View style={[s.emptyBox, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
            <Text style={[s.emptyTitle, cores.isEscuro && { color: '#eceff1' }, { color: cores.texto }]}>Nenhum acesso encontrado</Text>
            <Text style={[s.emptyText, cores.isEscuro && { color: '#b9c6cf' }, { color: cores.textoSecundario }]}>Peça para um administrador vincular seu usuário a um clube.</Text>
          </View>
        ) : null}

        <TouchableOpacity style={s.logoutBtn} onPress={sair}>
          <Ionicons name="log-out-outline" size={18} color={tomTexto('#b71c1c', cores)} />
          <Text style={[s.logoutText, cores.isEscuro && { color: '#ff9b9b' }, { color: tomTexto('#b71c1c', cores) }]}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#efeaf9' },
  header: { backgroundColor: '#7c39e7', padding: 26, paddingTop: 54 },
  headerIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#c7d8e8', marginTop: 6, fontSize: 15, lineHeight: 21 },
  content: { flex: 1 },
  loadingBox: { backgroundColor: '#fff', borderRadius: 18, padding: 18, alignItems: 'center', gap: 8 },
  loadingText: { color: '#607d8b', fontWeight: '700' },
  warnBox: { backgroundColor: '#fff8e1', borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  warnText: { color: '#795548', flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  cardIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#efeaf9', alignItems: 'center', justifyContent: 'center' },
  cardLogoImg: { width: 42, height: 42 },
  cardTitle: { color: '#4b2bb0', fontSize: 18, fontWeight: '900' },
  cardClub: { color: '#263238', fontWeight: '800', marginTop: 3 },
  cardSub: { color: '#546e7a', marginTop: 2 },
  cardProgram: { color: '#78909c', fontSize: 12, fontWeight: '800', marginTop: 5, textTransform: 'uppercase' },
  emptyBox: { backgroundColor: '#fff', borderRadius: 18, padding: 20, alignItems: 'center' },
  emptyTitle: { color: '#263238', fontWeight: '900', fontSize: 17 },
  emptyText: { color: '#607d8b', textAlign: 'center', marginTop: 6 },
  logoutBtn: { alignSelf: 'center', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 },
  logoutText: { color: '#b71c1c', fontWeight: '900' },
});

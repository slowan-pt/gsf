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
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

const LOGO_DESBRAVADORES = require('../../assets/logo-desbravadores.png');
const LOGO_AVENTUREIROS = require('../../assets/logo-aventureiros.png');

function iconFor(ctx: ContextoAcesso) {
  if (ctx.tipo === 'responsavel') return 'people-circle';
  if (ctx.perfil === 'admin_ti') return 'shield-checkmark';
  if (ctx.perfil === 'admin_clube') return 'business';
  if (ctx.perfil === 'usuario_pastor' || ctx.perfil === 'usuario_capelao') return 'book';
  if (ctx.perfil === 'usuario_conselheiro') return 'person';
  return 'flag';
}

function CardIcon({ ctx }: { ctx: ContextoAcesso }) {
  if (ctx.programa_codigo === 'desbravadores') {
    return <Image source={LOGO_DESBRAVADORES} style={s.cardLogoImg} resizeMode="contain" />;
  }
  if (ctx.programa_codigo === 'aventureiros') {
    return <Image source={LOGO_AVENTUREIROS} style={s.cardLogoImg} resizeMode="contain" />;
  }
  return <Ionicons name={iconFor(ctx) as any} size={25} color="#1a3a5c" />;
}

export default function ContextoScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
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
    <View style={s.container}>
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
          <View style={s.loadingBox}>
            <ActivityIndicator color="#1a3a5c" />
            <Text style={s.loadingText}>Carregando acessos...</Text>
          </View>
        ) : null}

        {erro ? (
          <View style={s.warnBox}>
            <Ionicons name="warning-outline" size={20} color="#b26a00" />
            <Text style={s.warnText}>{erro}</Text>
          </View>
        ) : null}

        {contextos.map((ctx) => (
          <TouchableOpacity key={ctx.id} style={s.card} onPress={() => selecionar(ctx)}>
            <View style={s.cardIcon}>
              <CardIcon ctx={ctx} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{ctx.perfil_nome}</Text>
              <Text style={s.cardClub}>{ctx.clube_nome_curto || ctx.clube_nome}</Text>
              {ctx.membro_nome ? <Text style={s.cardSub}>{ctx.membro_nome}</Text> : null}
              <Text style={s.cardProgram}>{ctx.programa_nome}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#90a4ae" />
          </TouchableOpacity>
        ))}

        {!carregando && contextos.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>Nenhum acesso encontrado</Text>
            <Text style={s.emptyText}>Peça para um administrador vincular seu usuário a um clube.</Text>
          </View>
        ) : null}

        <TouchableOpacity style={s.logoutBtn} onPress={sair}>
          <Ionicons name="log-out-outline" size={18} color="#b71c1c" />
          <Text style={s.logoutText}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  header: { backgroundColor: '#1a3a5c', padding: 26, paddingTop: 54 },
  headerIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#c7d8e8', marginTop: 6, fontSize: 15, lineHeight: 21 },
  content: { flex: 1 },
  loadingBox: { backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center', gap: 8 },
  loadingText: { color: '#607d8b', fontWeight: '700' },
  warnBox: { backgroundColor: '#fff8e1', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  warnText: { color: '#795548', flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  cardIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#eef5fb', alignItems: 'center', justifyContent: 'center' },
  cardLogoImg: { width: 42, height: 42 },
  cardTitle: { color: '#1a3a5c', fontSize: 18, fontWeight: '900' },
  cardClub: { color: '#263238', fontWeight: '800', marginTop: 3 },
  cardSub: { color: '#546e7a', marginTop: 2 },
  cardProgram: { color: '#78909c', fontSize: 12, fontWeight: '800', marginTop: 5, textTransform: 'uppercase' },
  emptyBox: { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center' },
  emptyTitle: { color: '#263238', fontWeight: '900', fontSize: 17 },
  emptyText: { color: '#607d8b', textAlign: 'center', marginTop: 6 },
  logoutBtn: { alignSelf: 'center', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12 },
  logoutText: { color: '#b71c1c', fontWeight: '900' },
});

import { useEffect, useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { getDB } from '../../src/lib/database';

function numeroOuNull(v: unknown) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numerosUnicos(valores: Array<number | null | undefined>) {
  return Array.from(new Set(valores.map(numeroOuNull).filter((n): n is number => n != null)));
}

function respostaContaComoPendente(
  resposta: { status?: string | null; reaberto_ate?: string | null } | null | undefined,
  prazoOriginal: string | null | undefined,
  hoje: string
) {
  const status = resposta?.status ?? null;
  if (status === 'aprovada' || status === 'entregue') return false;

  if (status === 'em_correcao' || status === 'recusada') {
    const prazoReabertura = resposta?.reaberto_ate ? resposta.reaberto_ate.slice(0, 10) : null;
    const prazo = prazoReabertura ?? (prazoOriginal ? prazoOriginal.slice(0, 10) : null);
    return !prazo || prazo >= hoje;
  }

  const prazo = prazoOriginal ? prazoOriginal.slice(0, 10) : null;
  return !prazo || prazo >= hoje;
}

function AtividadesTabIcon({ color, size, pendentesFilho, paraCorrigir }: {
  color: string; size: number; pendentesFilho: number; paraCorrigir: number;
}) {
  const temAlgum = pendentesFilho > 0 || paraCorrigir > 0;
  const temAmbos = pendentesFilho > 0 && paraCorrigir > 0;
  return (
    <View style={{ width: size + 14, height: size + 8, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Ionicons name="clipboard" size={size} color={temAlgum ? '#555' : color} />
      {pendentesFilho > 0 && (
        <View style={[styles.badge, { backgroundColor: '#ff6b35', right: temAmbos ? 0 : 0, top: 0 }]}>
          <Text style={styles.badgeText}>{pendentesFilho > 99 ? '99+' : pendentesFilho}</Text>
        </View>
      )}
      {paraCorrigir > 0 && (
        <View style={[styles.badge, { backgroundColor: '#2e7d32', left: temAmbos ? 0 : undefined, right: temAmbos ? undefined : 0, top: 0 }]}>
          <Text style={styles.badgeText}>{paraCorrigir > 99 ? '99+' : paraCorrigir}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const selecaoContextoPendente = useContextoStore((s) => s.selecaoPendente);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const contextos = useContextoStore((s) => s.contextos);
  const { pode } = usePermissoes();
  const podePontuar = pode('gerenciar_pontuacao');
  const podeUnidades = pode('gerenciar_unidades');
  const podeGerenciarAtividades = pode('gerenciar_atividades');
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 18);
  const [pendentesFilho, setPendentesFilho] = useState(0);
  const [paraCorrigir, setParaCorrigir] = useState(0);
  const clubeAtivoId = contextoAtivo?.clube_id ?? getClubeAtivoId();
  const [filhosDados, setFilhosDados] = useState<Array<{ id: number; unidade_id: number | null }>>([]);

  const responsavelCtxs = useMemo(
    () => contextos.filter(c => c.tipo === 'responsavel' && Number(c.clube_id) === Number(clubeAtivoId) && c.membro_id != null),
    [contextos, clubeAtivoId]
  );
  const filhosIds = useMemo(() => numerosUnicos(responsavelCtxs.map(c => c.membro_id)), [responsavelCtxs]);
  const filhosUnidadeIds = useMemo(
    () => numerosUnicos([...responsavelCtxs.map(c => c.unidade_id), ...filhosDados.map(f => f.unidade_id)]),
    [responsavelCtxs, filhosDados]
  );

  useEffect(() => {
    let ativo = true;
    async function carregarFilhos() {
      if (filhosIds.length === 0) {
        if (ativo) setFilhosDados([]);
        return;
      }
      try {
        const { data } = await supabase
          .from('desbravadores')
          .select('id,unidade_id')
          .eq('clube_id', clubeAtivoId)
          .in('id', filhosIds);
        if (ativo) setFilhosDados(((data ?? []) as any[]).map((m) => ({ id: Number(m.id), unidade_id: m.unidade_id ?? null })));
      } catch {
        if (ativo) setFilhosDados([]);
      }
    }
    carregarFilhos();
    return () => { ativo = false; };
  }, [clubeAtivoId, filhosIds.join(',')]);

  // Badge laranja: próprias atividades pendentes (membro) + pendentes dos filhos (pai)
  // Inclui: sem resposta, em_correcao (devolvida) e recusada
  useEffect(() => {
    let ativo = true;
    async function calcPendentesLaranja() {
      const clubeId = getClubeAtivoId();
      const pendentes = new Set<string>();

      // Parte 1: atividades pendentes do próprio membro (não-admin)
      const membroId = contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;
      const unidadeId = contextoAtivo?.unidade_id ?? usuario?.unidade_id ?? null;
      const hoje = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
      if (membroId) {
        try {
          const [{ data: atividades }, { data: alvos }] = await Promise.all([
            supabase.from('atividades').select('id,destino,unidade_id,dbv_id,data').eq('clube_id', clubeId),
            supabase.from('atividades_alvos').select('atividade_id,tipo,unidade_id,membro_id').eq('clube_id', clubeId),
          ]);
          const alvosPorAt = new Map<number, any[]>();
          const prazoPorAt = new Map<number, string | null>();
          for (const al of (alvos ?? []) as any[]) {
            const id = Number(al.atividade_id);
            if (!alvosPorAt.has(id)) alvosPorAt.set(id, []);
            alvosPorAt.get(id)!.push(al);
          }
          for (const a of (atividades ?? []) as any[]) {
            prazoPorAt.set(Number(a.id), a.data ?? null);
          }
          const ids = ((atividades ?? []) as any[])
            .filter((a: any) => {
              const lista = alvosPorAt.get(Number(a.id)) ?? [];
              if (lista.length > 0) {
                return lista.some((al: any) =>
                  al.tipo === 'todos' ||
                  (al.tipo === 'unidade' && Number(al.unidade_id) === Number(unidadeId)) ||
                  (al.tipo === 'membro' && Number(al.membro_id) === Number(membroId))
                );
              }
              return a.destino === 'todos' ||
                (a.destino === 'unidade' && Number(a.unidade_id) === Number(unidadeId)) ||
                (a.destino === 'desbravador' && Number(a.dbv_id) === Number(membroId));
            })
            .map((a: any) => Number(a.id));

          if (ids.length > 0) {
            const { data: respostas } = await supabase
              .from('atividades_respostas')
              .select('atividade_id,status,reaberto_ate')
              .eq('clube_id', clubeId)
              .eq('dbv_id', membroId)
              .in('atividade_id', ids);
            const respostaPorAt = new Map<number, any>();
            for (const r of (respostas ?? []) as any[]) respostaPorAt.set(Number(r.atividade_id), r);
            for (const id of ids) {
              if (respostaContaComoPendente(respostaPorAt.get(id), prazoPorAt.get(id), hoje)) {
                pendentes.add(`${id}:${Number(membroId)}`);
              }
            }
          }
        } catch { /* offline */ }
      }

      // Parte 2: atividades pendentes dos filhos (papel de pai)
      if (filhosIds.length > 0) {
        try {
          const [{ data: atividades }, { data: alvos }] = await Promise.all([
            supabase.from('atividades').select('id,destino,unidade_id,dbv_id,data').eq('clube_id', clubeId),
            supabase.from('atividades_alvos').select('atividade_id,tipo,unidade_id,membro_id').eq('clube_id', clubeId),
          ]);
          const alvosPorAt = new Map<number, any[]>();
          const prazoPorAt = new Map<number, string | null>();
          for (const al of (alvos ?? []) as any[]) {
            const id = Number(al.atividade_id);
            if (!alvosPorAt.has(id)) alvosPorAt.set(id, []);
            alvosPorAt.get(id)!.push(al);
          }
          for (const a of (atividades ?? []) as any[]) {
            prazoPorAt.set(Number(a.id), a.data ?? null);
          }

          const unidadePorFilho = new Map<number, number | null>();
          for (const ctx of responsavelCtxs) unidadePorFilho.set(Number(ctx.membro_id), numeroOuNull(ctx.unidade_id));
          for (const filho of filhosDados) unidadePorFilho.set(Number(filho.id), numeroOuNull(filho.unidade_id));

          const pares = ((atividades ?? []) as any[]).flatMap((a: any) => {
            const atId = Number(a.id);
            const lista = alvosPorAt.get(atId) ?? [];
            return filhosIds
              .filter((filhoId) => {
                const unidadeFilho = unidadePorFilho.get(Number(filhoId));
                if (lista.length > 0) {
                  return lista.some((al: any) =>
                    al.tipo === 'todos' ||
                    (al.tipo === 'unidade' && unidadeFilho != null && Number(al.unidade_id) === Number(unidadeFilho)) ||
                    (al.tipo === 'membro' && Number(al.membro_id) === Number(filhoId))
                  );
                }
                return a.destino === 'todos' ||
                  (a.destino === 'unidade' && unidadeFilho != null && Number(a.unidade_id) === Number(unidadeFilho)) ||
                  (a.destino === 'desbravador' && Number(a.dbv_id) === Number(filhoId));
              })
              .map((filhoId) => ({ atividadeId: atId, filhoId: Number(filhoId) }));
          });

          const idsFilhos = Array.from(new Set(pares.map((par) => par.atividadeId)));
          if (pares.length > 0) {
            const { data: respostas } = await supabase
              .from('atividades_respostas')
              .select('atividade_id,dbv_id,status,reaberto_ate')
              .eq('clube_id', clubeId)
              .in('dbv_id', filhosIds)
              .in('atividade_id', idsFilhos);
            const respostaPorPar = new Map<string, any>();
            for (const r of (respostas ?? []) as any[]) respostaPorPar.set(`${r.atividade_id}:${r.dbv_id}`, r);
            for (const par of pares) {
              const resposta = respostaPorPar.get(`${par.atividadeId}:${par.filhoId}`);
              if (respostaContaComoPendente(resposta, prazoPorAt.get(par.atividadeId), hoje)) {
                pendentes.add(`${par.atividadeId}:${par.filhoId}`);
              }
            }
          }
        } catch { /* offline */ }
      }

      if (ativo) setPendentesFilho(pendentes.size);
    }
    calcPendentesLaranja();
    return () => { ativo = false; };
  }, [
    contextoAtivo?.membro_id, contextoAtivo?.unidade_id, contextoAtivo?.clube_id,
    usuario?.dbv_id, usuario?.unidade_id,
    filhosIds.join(','), filhosUnidadeIds.join(','),
  ]);

  // Badge verde: respostas aguardando avaliação (papel de avaliador/admin)
  useEffect(() => {
    let ativo = true;
    async function calcParaCorrigir() {
      const clubeId = getClubeAtivoId();
      if (!podeGerenciarAtividades && !usuario?.id) { if (ativo) setParaCorrigir(0); return; }
      try {
        if (podeGerenciarAtividades) {
          // Admin vê todas as respostas com status 'entregue'
          const { data } = await supabase
            .from('atividades_respostas')
            .select('id')
            .eq('clube_id', clubeId)
            .eq('status', 'entregue');
          if (ativo) setParaCorrigir(data?.length ?? 0);
        } else if (usuario?.id) {
          // Avaliador designado: só as atividades onde é avaliador
          const { data: minhasAts } = await supabase
            .from('atividades')
            .select('id')
            .eq('clube_id', clubeId)
            .eq('avaliador_id', usuario.id);
          const idsMinhasAts = ((minhasAts ?? []) as any[]).map((a: any) => Number(a.id));
          if (idsMinhasAts.length === 0) { if (ativo) setParaCorrigir(0); return; }
          const { data } = await supabase
            .from('atividades_respostas')
            .select('id')
            .eq('clube_id', clubeId)
            .eq('status', 'entregue')
            .in('atividade_id', idsMinhasAts);
          if (ativo) setParaCorrigir(data?.length ?? 0);
        }
      } catch {
        if (ativo) setParaCorrigir(0);
      }
    }
    calcParaCorrigir();
    return () => { ativo = false; };
  }, [podeGerenciarAtividades, usuario?.id, contextoAtivo?.clube_id]);

  if (!usuario) return <Redirect href="/auth/login" />;
  if (selecaoContextoPendente) return <Redirect href="/auth/contexto" />;

  async function sair() {
    await logout();
    router.replace('/auth/login');
  }

  function confirmarSair() {
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja sair do sistema?')) sair();
      return;
    }
    Alert.alert('Sair', 'Deseja sair do sistema?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: sair },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#1a3a5c',
          tabBarInactiveTintColor: '#999',
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            paddingTop: 6,
            paddingBottom: bottomInset,
            height: 58 + bottomInset,
          },
          tabBarItemStyle: { paddingVertical: 2 },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="ranking"
          options={{
            title: 'Ranking',
            tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="membros"
          options={{
            title: 'Membros',
            tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="pontuacao"
          options={{
            href: podePontuar ? undefined : null,
            title: 'Pontuação',
            tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="atividades"
          options={{
            title: 'Atividades',
            tabBarIcon: ({ color, size }) => (
              <AtividadesTabIcon
                color={color}
                size={size}
                pendentesFilho={pendentesFilho}
                paraCorrigir={paraCorrigir}
              />
            ),
          }}
        />
        <Tabs.Screen name="campori" options={{ href: null }} />
        <Tabs.Screen name="anexo" options={{ href: null }} />
        <Tabs.Screen name="mensagens" options={{ href: null }} />
        <Tabs.Screen
          name="extras"
          options={{
            href: podePontuar ? undefined : null,
            title: 'Extras',
            tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="unidades"
          options={{
            href: podeUnidades ? undefined : null,
            title: 'Unidades',
            tabBarIcon: ({ color, size }) => <Ionicons name="flag" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="calendario"
          options={{
            title: 'Agenda',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          }}
        />
      </Tabs>

      <TouchableOpacity
        onPress={confirmarSair}
        style={[styles.logoutFloating, { top: Math.max(insets.top + 10, 18) }]}
        accessibilityLabel="Sair do sistema"
      >
        <Ionicons name="log-out-outline" size={17} color="#fff" />
        <Text style={styles.logoutFloatingText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  logoutFloating: {
    position: 'absolute',
    right: 12,
    zIndex: 999,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(26,58,92,0.88)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  logoutFloatingText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});

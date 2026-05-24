import { useEffect, useState } from 'react';
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

export default function TabsLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);
  const selecaoContextoPendente = useContextoStore((s) => s.selecaoPendente);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const { pode } = usePermissoes();
  const podePontuar = pode('gerenciar_pontuacao');
  const podeUnidades = pode('gerenciar_unidades');
  const podeGerenciarAtividades = pode('gerenciar_atividades');
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 18);
  const [atividadesPendentes, setAtividadesPendentes] = useState(0);

  useEffect(() => {
    let ativo = true;
    async function carregarPendentes() {
      const clubeId = getClubeAtivoId();

      if (podeGerenciarAtividades) {
        if (Platform.OS !== 'web') {
          try {
            const db = await getDB();
            const rows = await db.getAllAsync<{ id: number }>(
              `SELECT id FROM atividades_respostas WHERE clube_id = ? AND status = 'entregue'`,
              [clubeId]
            );
            if (ativo) setAtividadesPendentes(rows.length);
          } catch {
            if (ativo) setAtividadesPendentes(0);
          }
          return;
        }
        try {
          const { data } = await supabase
            .from('atividades_respostas')
            .select('id')
            .eq('clube_id', clubeId)
            .eq('status', 'entregue');
          if (ativo) setAtividadesPendentes(data?.length ?? 0);
        } catch {
          if (ativo) setAtividadesPendentes(0);
        }
        return;
      }

      if (!usuario?.dbv_id) {
        if (ativo) setAtividadesPendentes(0);
        return;
      }

      const membroId = contextoAtivo?.membro_id ?? usuario.dbv_id;
      const unidadeId = contextoAtivo?.unidade_id ?? usuario.unidade_id;

      if (Platform.OS !== 'web') {
        try {
          const db = await getDB();
          const rows = await db.getAllAsync<{ id: number }>(
            `SELECT ar.id FROM atividades_respostas ar
             WHERE ar.clube_id = ? AND ar.dbv_id = ?
               AND (ar.status IS NULL OR ar.status NOT IN ('corrigida','aprovada'))`,
            [clubeId, membroId]
          );
          if (ativo) setAtividadesPendentes(rows.length);
        } catch {
          if (ativo) setAtividadesPendentes(0);
        }
        return;
      }

      try {
        const [{ data: atividades }, { data: alvos }] = await Promise.all([
          supabase
            .from('atividades')
            .select('id,destino,unidade_id,dbv_id')
            .eq('clube_id', clubeId),
          supabase
            .from('atividades_alvos')
            .select('atividade_id,tipo,unidade_id,membro_id')
            .eq('clube_id', clubeId),
        ]);
        const alvosPorAtividade = new Map<number, any[]>();
        for (const alvo of (alvos ?? []) as any[]) {
          const id = Number(alvo.atividade_id);
          if (!alvosPorAtividade.has(id)) alvosPorAtividade.set(id, []);
          alvosPorAtividade.get(id)!.push(alvo);
        }
        const ids = (atividades ?? [])
          .filter((a: any) => {
            const lista = alvosPorAtividade.get(Number(a.id)) ?? [];
            if (lista.length > 0) {
              return lista.some((alvo: any) =>
                alvo.tipo === 'todos' ||
                (alvo.tipo === 'unidade' && Number(alvo.unidade_id) === Number(unidadeId)) ||
                (alvo.tipo === 'membro' && Number(alvo.membro_id) === Number(membroId))
              );
            }
            return a.destino === 'todos' ||
              (a.destino === 'unidade' && Number(a.unidade_id) === Number(unidadeId)) ||
              (a.destino === 'desbravador' && Number(a.dbv_id) === Number(membroId));
          })
          .map((a: any) => Number(a.id));
        if (ids.length === 0) {
          if (ativo) setAtividadesPendentes(0);
          return;
        }
        const { data: respostas } = await supabase
          .from('atividades_respostas')
          .select('atividade_id,status')
          .eq('clube_id', clubeId)
          .eq('dbv_id', membroId)
          .in('atividade_id', ids);
        const encerradas = new Set((respostas ?? [])
          .filter((r: any) => !['em_correcao', 'recusada', 'pendente'].includes(r.status ?? 'entregue'))
          .map((r: any) => Number(r.atividade_id)));
        if (ativo) setAtividadesPendentes(ids.filter((id: any) => !encerradas.has(Number(id))).length);
      } catch {
        if (ativo) setAtividadesPendentes(0);
      }
    }
    carregarPendentes();
    return () => { ativo = false; };
  }, [usuario?.dbv_id, usuario?.unidade_id, contextoAtivo?.membro_id, contextoAtivo?.unidade_id, podeGerenciarAtividades]);

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
            tabBarBadge: atividadesPendentes > 0 ? atividadesPendentes : undefined,
            tabBarBadgeStyle: { backgroundColor: '#ff6b35', color: '#fff' },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="clipboard" size={size} color={atividadesPendentes > 0 ? '#ff6b35' : color} />
            ),
          }}
        />
        <Tabs.Screen name="campori" options={{ href: null }} />
        <Tabs.Screen name="anexo" options={{ href: null }} />
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

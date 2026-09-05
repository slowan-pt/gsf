import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useEspacoParaTeclado } from '../../src/lib/teclado';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { TERMO_LGPD_PADRAO, TERMO_LGPD_TITULO_PADRAO, type TermoLgpd } from '../../src/lib/lgpd';
import { BottomNav } from '../../src/components/BottomNav';
import { combinaBusca } from '../../src/lib/texto';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

interface AceiteRow {
  id: number;
  usuario_id: string;
  termo_id: number;
  email: string;
  nome: string;
  perfil: string;
  accepted_at: string;
}

export default function AdminLgpdScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const [carregando, setCarregando] = useState(false);
  const espacoTeclado = useEspacoParaTeclado();
  const [salvando, setSalvando] = useState(false);
  const [termo, setTermo] = useState<TermoLgpd | null>(null);
  const [titulo, setTitulo] = useState(TERMO_LGPD_TITULO_PADRAO);
  const [conteudo, setConteudo] = useState(TERMO_LGPD_PADRAO);
  const [aceites, setAceites] = useState<AceiteRow[]>([]);
  const [busca, setBusca] = useState('');

  const podeGerenciar = permissoes.podeAlguma(['gerenciar_acessos', 'admin_clube']);

  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  async function carregar() {
    setCarregando(true);
    try {
      const [{ data: termoAtual, error: erroTermo }, { data: lista, error: erroAceites }] = await Promise.all([
        supabase
          .from('lgpd_termos')
          .select('*')
          .eq('ativo', true)
          .order('versao', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('lgpd_aceites')
          .select('*')
          .order('accepted_at', { ascending: false }),
      ]);
      if (erroTermo) throw erroTermo;
      if (erroAceites) throw erroAceites;

      const t = termoAtual as TermoLgpd | null;
      setTermo(t);
      setTitulo(t?.titulo ?? TERMO_LGPD_TITULO_PADRAO);
      setConteudo(t?.conteudo ?? TERMO_LGPD_PADRAO);
      setAceites((lista ?? []) as AceiteRow[]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível carregar os termos LGPD.');
    } finally {
      setCarregando(false);
    }
  }

  const aceitesFiltrados = useMemo(() => {
    const q = busca.trim();
    if (!q) return aceites;
    return aceites.filter((a) =>
      combinaBusca(a.nome, q) ||
      combinaBusca(a.email, q) ||
      combinaBusca(a.perfil, q)
    );
  }, [aceites, busca]);

  async function salvarTermo() {
    if (!titulo.trim() || !conteudo.trim()) {
      Alert.alert('Campos obrigatórios', 'Informe título e conteúdo do termo.');
      return;
    }
    setSalvando(true);
    try {
      const novaVersao = (termo?.versao ?? 0) + 1;
      if (termo?.id) {
        const { error } = await supabase
          .from('lgpd_termos')
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq('id', termo.id);
        if (error) throw error;
      }
      const { error } = await supabase
        .from('lgpd_termos')
        .insert({
          titulo: titulo.trim(),
          conteudo: conteudo.trim(),
          versao: novaVersao,
          ativo: true,
          criado_por: usuario?.id ?? null,
        });
      if (error) throw error;
      Alert.alert('Pronto', 'Novo termo publicado. Os usuários precisarão aceitar esta versão no próximo acesso.');
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar o termo.');
    } finally {
      setSalvando(false);
    }
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: corCabecalho }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>LGPD</Text>
          <Text style={s.headerSub}>Termo, consentimentos e responsabilidade</Text>
        </View>
        <TouchableOpacity onPress={carregar} style={s.iconBtn}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {carregando ? (
        <ActivityIndicator color="#1a3a5c" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: espacoTeclado }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.card}>
            <Text style={s.cardTitle}>Editar termo vigente</Text>
            <Text style={s.cardSub}>
              Salvar cria uma nova versão. Quem ainda não aceitou a versão atual ficará bloqueado até aceitar.
            </Text>

            <Text style={s.label}>Título</Text>
            <TextInput
              style={s.input}
              value={titulo}
              onChangeText={setTitulo}
              placeholder="Título do termo"
            />

            <Text style={s.label}>Texto do termo</Text>
            <TextInput
              style={[s.input, s.textarea]}
              value={conteudo}
              onChangeText={setConteudo}
              multiline
              textAlignVertical="top"
              placeholder="Texto do termo LGPD..."
            />

            <TouchableOpacity style={[s.btn, salvando && { opacity: 0.6 }]} onPress={salvarTermo} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
              <Text style={s.btnText}>Publicar nova versão</Text>
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.cardTitle}>Aceites registrados</Text>
                <Text style={s.cardSub}>{aceites.length} aceite(s)</Text>
              </View>
              {termo?.versao ? <Text style={s.versionBadge}>v{termo.versao}</Text> : null}
            </View>

            <View style={s.searchBox}>
              <Ionicons name="search" size={18} color="#78909c" />
              <TextInput
                style={s.searchInput}
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar por nome, e-mail ou perfil..."
                placeholderTextColor="#90a4ae"
              />
            </View>

            {aceitesFiltrados.map((a) => (
              <View key={a.id} style={s.acceptRow}>
                <View style={s.acceptIcon}>
                  <Ionicons name="checkmark-circle" size={18} color="#2e7d32" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.acceptName}>{a.nome || a.email}</Text>
                  <Text style={s.acceptMeta}>{a.email} · {a.perfil}</Text>
                  <Text style={s.acceptDate}>
                    {new Date(a.accepted_at).toLocaleString('pt-BR')}
                  </Text>
                </View>
              </View>
            ))}

            {aceitesFiltrados.length === 0 && (
              <Text style={s.empty}>Nenhum aceite encontrado.</Text>
            )}
          </View>
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingBottom: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { padding: 4 },
  iconBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  headerSub: { color: '#a8c8e8', marginTop: 2 },
  content: { padding: 14, gap: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, elevation: 2 },
  cardTitle: { color: '#1a3a5c', fontSize: 18, fontWeight: '900' },
  cardSub: { color: '#78909c', marginTop: 3, lineHeight: 19 },
  label: { color: '#607d8b', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#dce5ec', borderRadius: 12, backgroundColor: '#fafafa', padding: 12, color: '#263238', outlineStyle: 'none' as any },
  textarea: { minHeight: 260, lineHeight: 20 },
  btn: { marginTop: 14, backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: '900' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  versionBadge: { alignSelf: 'flex-start', backgroundColor: '#e8f0fe', color: '#1a3a5c', fontWeight: '900', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  searchBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#edf2f6' },
  searchInput: { flex: 1, color: '#222', outlineStyle: 'none' as any },
  acceptRow: { marginTop: 10, flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12 },
  acceptIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e8f5e9', alignItems: 'center', justifyContent: 'center' },
  acceptName: { color: '#263238', fontWeight: '900' },
  acceptMeta: { color: '#607d8b', fontSize: 12, marginTop: 2 },
  acceptDate: { color: '#90a4ae', fontSize: 11, marginTop: 3 },
  empty: { color: '#90a4ae', textAlign: 'center', marginVertical: 20 },
});

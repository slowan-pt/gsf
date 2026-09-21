import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator,
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
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { avisar } from '../../src/stores/avisoStore';
import { corIcone } from '../../src/lib/tema';

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
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const [carregandoTermo, setCarregandoTermo] = useState(false);
  const [carregandoAceites, setCarregandoAceites] = useState(false);
  const espacoTeclado = useEspacoParaTeclado();
  const [salvando, setSalvando] = useState(false);
  const [termo, setTermo] = useState<TermoLgpd | null>(null);
  const [titulo, setTitulo] = useState(TERMO_LGPD_TITULO_PADRAO);
  const [conteudo, setConteudo] = useState(TERMO_LGPD_PADRAO);
  const [aceites, setAceites] = useState<AceiteRow[]>([]);
  const [busca, setBusca] = useState('');

  const podeGerenciar = permissoes.podeAlguma(['gerenciar_acessos', 'admin_clube']);

  useFocusEffect(useCallback(() => {
    void carregar();
  }, []));

  async function carregar() {
    await Promise.all([carregarTermo(), carregarAceites()]);
  }

  async function carregarTermo() {
    setCarregandoTermo(true);
    try {
      const { data: termoAtual, error: erroTermo } = await supabase
        .from('lgpd_termos')
        .select('id,titulo,conteudo,versao,ativo,created_at,updated_at')
        .eq('ativo', true)
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (erroTermo) throw erroTermo;

      const t = termoAtual as TermoLgpd | null;
      setTermo(t);
      setTitulo(t?.titulo ?? TERMO_LGPD_TITULO_PADRAO);
      setConteudo(t?.conteudo ?? TERMO_LGPD_PADRAO);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar o termo LGPD.', 'erro', 'Erro');
    } finally {
      setCarregandoTermo(false);
    }
  }

  async function carregarAceites() {
    setCarregandoAceites(true);
    try {
      const { data: lista, error } = await supabase
        .from('lgpd_aceites')
        .select('id,usuario_id,termo_id,email,nome,perfil,accepted_at')
        .order('accepted_at', { ascending: false });
      if (error) throw error;
      setAceites((lista ?? []) as AceiteRow[]);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar os aceites LGPD.', 'erro', 'Erro');
    } finally {
      setCarregandoAceites(false);
    }
  }

  const buscaAdiada = useDeferredValue(busca);
  const aceitesFiltrados = useMemo(() => {
    const q = buscaAdiada.trim();
    if (!q) return aceites;
    return aceites.filter((a) =>
      combinaBusca(a.nome, q) ||
      combinaBusca(a.email, q) ||
      combinaBusca(a.perfil, q)
    );
  }, [aceites, buscaAdiada]);

  async function salvarTermo() {
    if (!titulo.trim() || !conteudo.trim()) {
      avisar('Informe título e conteúdo do termo.', 'info', 'Campos obrigatórios');
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
      avisar('Novo termo publicado. Os usuários precisarão aceitar esta versão no próximo acesso.', 'sucesso', 'Pronto');
      await carregarTermo();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar o termo.', 'erro', 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18, paddingRight: 76 }]}>
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

      <FlatList
        data={aceitesFiltrados}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[s.content, { paddingBottom: espacoTeclado }]}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={(
          <>
          <View style={[s.card, { backgroundColor: cores.cartao }]}>
            <Text style={[s.cardTitle, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Editar termo vigente</Text>
            <Text style={[s.cardSub, { color: cores.textoSecundario }]}>
              Salvar cria uma nova versão. Quem ainda não aceitou a versão atual ficará bloqueado até aceitar.
            </Text>

            <Text style={[s.label, { color: cores.textoSecundario }]}>Título</Text>
            {carregandoTermo ? (
              <ActivityIndicator color={corIcone(cores)} style={s.termLoading} />
            ) : (
              <>
                <TextInput
                  style={[s.input, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
                  value={titulo}
                  onChangeText={setTitulo}
                  placeholder="Título do termo"
                  placeholderTextColor={cores.placeholder}
                />

                <Text style={[s.label, { color: cores.textoSecundario }]}>Texto do termo</Text>
                <TextInput
                  style={[s.input, s.textarea, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
                  value={conteudo}
                  onChangeText={setConteudo}
                  multiline
                  textAlignVertical="top"
                  placeholder="Texto do termo LGPD..."
                  placeholderTextColor={cores.placeholder}
                />

                <TouchableOpacity style={[s.btn, salvando && { opacity: 0.6 }]} onPress={salvarTermo} disabled={salvando}>
                  {salvando ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                  <Text style={s.btnText}>Publicar nova versão</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={[s.card, s.acceptCard, { backgroundColor: cores.cartao }]}>
            <View style={s.rowBetween}>
              <View>
                <Text style={[s.cardTitle, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Aceites registrados</Text>
                <Text style={[s.cardSub, { color: cores.textoSecundario }]}>{aceites.length} aceite(s)</Text>
              </View>
              {termo?.versao ? <Text style={[s.versionBadge, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.fundo }]}>v{termo.versao}</Text> : null}
            </View>

            <View style={[s.searchBox, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
              <Ionicons name="search" size={18} color={cores.textoSecundario} />
              <TextInput
                style={[s.searchInput, { color: cores.texto }]}
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar por nome, e-mail ou perfil..."
                placeholderTextColor={cores.placeholder}
              />
            </View>
          </View>
          </>
        )}
        renderItem={({ item: a }) => (
          <View style={[s.acceptRow, { backgroundColor: cores.cartao }]}>
            <View style={s.acceptIcon}>
              <Ionicons name="checkmark-circle" size={18} color="#2e7d32" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.acceptName, { color: cores.texto }]}>{a.nome || a.email}</Text>
              <Text style={[s.acceptMeta, { color: cores.textoSecundario }]}>{a.email} · {a.perfil}</Text>
              <Text style={[s.acceptDate, { color: cores.textoSecundario }]}>
                {new Date(a.accepted_at).toLocaleString('pt-BR')}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={carregandoAceites ? (
          <ActivityIndicator color={corIcone(cores)} style={s.acceptLoading} />
        ) : (
          <Text style={[s.empty, { color: cores.textoSecundario }]}>Nenhum aceite encontrado.</Text>
        )}
      />
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
  termLoading: { marginVertical: 32 },
  acceptCard: { marginBottom: 0 },
  acceptLoading: { marginVertical: 24 },
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

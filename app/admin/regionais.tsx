import { EstadoVazio } from '../../src/components/ui';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { avisar } from '../../src/stores/avisoStore';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, tomTexto } from '../../src/lib/tema';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';

const PERFIL_REGIONAL = 'usuario_regional';

interface UsuarioLinha {
  id: string;
  nome: string | null;
  email: string | null;
  perfil: string | null;
}

interface ClubeLinha {
  id: number;
  nome: string;
}

function normalizar(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export default function RegionaisScreen() {
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
  const permissoes = usePermissoes();
  const podeGerenciar = permissoes.podeAlguma(['admin_plataforma', 'gerenciar_acessos']);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioLinha[]>([]);
  const [clubes, setClubes] = useState<ClubeLinha[]>([]);
  const [vinculos, setVinculos] = useState<Record<string, number[]>>({});
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<UsuarioLinha | null>(null);
  const [clubesEscolhidos, setClubesEscolhidos] = useState<number[]>([]);

  useFocusEffect(useCallback(() => { carregar(); }, []));

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [usuariosRes, clubesRes, vinculosRes] = await Promise.all([
        supabase.from('usuarios').select('id,nome,email,perfil').order('nome', { ascending: true }),
        supabase.from('clubes').select('id,nome').order('nome', { ascending: true }),
        supabase.from('usuario_clubes').select('usuario_id,clube_id').eq('perfil', PERFIL_REGIONAL).eq('ativo', true),
      ]);
      if (usuariosRes.error) throw usuariosRes.error;
      if (clubesRes.error) throw clubesRes.error;
      if (vinculosRes.error) throw vinculosRes.error;

      setUsuarios((usuariosRes.data ?? []) as UsuarioLinha[]);
      setClubes((clubesRes.data ?? []) as ClubeLinha[]);
      const mapa: Record<string, number[]> = {};
      (vinculosRes.data ?? []).forEach((v: any) => { (mapa[v.usuario_id] ??= []).push(v.clube_id); });
      setVinculos(mapa);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }

  const regionais = useMemo(
    () => usuarios.filter((u) => u.perfil === PERFIL_REGIONAL || (vinculos[u.id]?.length ?? 0) > 0),
    [usuarios, vinculos]
  );

  const resultadosBusca = useMemo(() => {
    const termo = normalizar(busca);
    if (termo.length < 2) return [];
    return usuarios
      .filter((u) => normalizar(`${u.nome ?? ''} ${u.email ?? ''}`).includes(termo))
      .slice(0, 12);
  }, [usuarios, busca]);

  function abrir(u: UsuarioLinha) {
    setSelecionado(u);
    setClubesEscolhidos(vinculos[u.id] ?? []);
    setBusca('');
  }

  async function salvar() {
    if (!selecionado || salvando) return;
    setSalvando(true);
    try {
      const atuais = vinculos[selecionado.id] ?? [];
      const paraRemover = atuais.filter((c) => !clubesEscolhidos.includes(c));
      const paraAdicionar = clubesEscolhidos.filter((c) => !atuais.includes(c));

      if (paraRemover.length > 0) {
        const { error } = await supabase
          .from('usuario_clubes')
          .delete()
          .eq('usuario_id', selecionado.id)
          .eq('perfil', PERFIL_REGIONAL)
          .in('clube_id', paraRemover);
        if (error) throw error;
      }
      if (paraAdicionar.length > 0) {
        const { error } = await supabase.from('usuario_clubes').insert(
          paraAdicionar.map((clube_id) => ({
            usuario_id: selecionado.id,
            clube_id,
            perfil: PERFIL_REGIONAL,
            ativo: true,
          }))
        );
        if (error) throw error;
      }

      // Mantém o perfil base do usuário coerente com o vínculo criado.
      if (clubesEscolhidos.length > 0 && selecionado.perfil !== PERFIL_REGIONAL) {
        await supabase.from('usuarios').update({ perfil: PERFIL_REGIONAL }).eq('id', selecionado.id);
      }

      await carregar();
      setSelecionado(null);
      const msg = clubesEscolhidos.length > 0
        ? `Acesso salvo: ${clubesEscolhidos.length} clube(s).`
        : 'Todos os acessos deste regional foram removidos.';
      avisar(msg, 'sucesso', 'Pronto');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  if (!podeGerenciar) return <Redirect href="/" />;

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Regionais" />

      <ScrollView contentContainerStyle={s.scroll}>
        {loading && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
        {!!erro && <EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} />}

        {!loading && (
          <>
            <View style={[s.aviso, cores.isEscuro && { backgroundColor: '#3b3c4c' }]}>
              <Ionicons name="information-circle" size={20} color={tomTexto('#0369a1', cores)} />
              <Text style={[s.avisoTexto, cores.isEscuro && { color: '#c4e6f7' }, cores.isEscuro && { color: '#c4e6f7' }]}>
                O perfil Regional enxerga apenas Classes e Especialidades — concluídas e em andamento —
                dos membros dos clubes marcados aqui. Nenhum outro menu fica disponível para ele.
              </Text>
            </View>

            <Text style={[s.label, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>Adicionar / editar regional</Text>
            <TextInput
              style={[s.busca, cores.isEscuro && { backgroundColor: '#1d1932', color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda, borderWidth: 1 }]}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar usuário por nome ou e-mail..."
              placeholderTextColor={cores.placeholder}
              autoCapitalize="none"
            />
            {resultadosBusca.map((u) => (
              <TouchableOpacity key={u.id} style={[s.resultado, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]} onPress={() => abrir(u)}>
                <Ionicons name="person-circle-outline" size={22} color={corIcone(cores)} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.resultadoNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{u.nome || 'Sem nome'}</Text>
                  <Text style={[s.resultadoEmail, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>{u.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={cores.textoSecundario} />
              </TouchableOpacity>
            ))}

            <Text style={[s.label, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario, marginTop: 18 }]}>Regionais cadastrados ({regionais.length})</Text>
            {regionais.length === 0 && <EstadoVazio titulo="Nenhum regional cadastrado ainda." />}
            {regionais.map((u) => {
              const meus = vinculos[u.id] ?? [];
              return (
                <TouchableOpacity key={u.id} style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]} onPress={() => abrir(u)}>
                  <View style={s.cardTopo}>
                    <Ionicons name="shield-checkmark" size={20} color={tomTexto('#7c3aed', cores)} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{u.nome || 'Sem nome'}</Text>
                      <Text style={[s.cardEmail, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>{u.email}</Text>
                    </View>
                    <Text style={[s.cardContagem, cores.isEscuro && { backgroundColor: '#3e3b4c', color: '#cbb8ff' }]}>{meus.length}</Text>
                  </View>
                  <Text style={[s.cardClubes, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>
                    {meus.length > 0
                      ? clubes.filter((c) => meus.includes(c.id)).map((c) => c.nome).join(' · ')
                      : 'Sem clube vinculado'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {!!selecionado && (
        <View style={[s.painel, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
          <ScrollView contentContainerStyle={{ padding: 18 }}>
            <Text style={[s.painelTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{selecionado.nome || selecionado.email}</Text>
            <Text style={[s.painelSub, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>Marque os clubes que este regional poderá acompanhar.</Text>
            {clubes.map((c) => {
              const marcado = clubesEscolhidos.includes(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={s.clubeLinha}
                  onPress={() =>
                    setClubesEscolhidos((p) => (marcado ? p.filter((x) => x !== c.id) : [...p, c.id]))
                  }
                >
                  <View style={[s.check, { borderColor: cores.borda }, marcado && s.checkOn]}>
                    {marcado ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                  </View>
                  <Text style={[s.clubeNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{c.nome}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={s.painelAcoes}>
              <TouchableOpacity style={[s.btnSec, cores.isEscuro && { backgroundColor: '#3c394a' }, { backgroundColor: cores.borda }]} onPress={() => setSelecionado(null)}>
                <Text style={[s.btnSecText, { color: cores.textoSecundario }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
                <Text style={s.btnText}>{salvando ? 'Salvando...' : 'Salvar acesso'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f3fb' },
  header: {
    backgroundColor: '#7c39e7', paddingTop: 48, paddingBottom: 18, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  voltar: { padding: 4 },
  headerTitulo: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  scroll: { padding: 16 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', fontSize: 13, marginTop: 6 },
  aviso: {
    flexDirection: 'row', gap: 10, backgroundColor: '#e0f2fe', borderRadius: 12,
    padding: 14, alignItems: 'flex-start', marginBottom: 16,
  },
  avisoTexto: { flex: 1, color: '#075985', fontSize: 12, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '800', color: '#52606d', textTransform: 'uppercase', marginBottom: 8 },
  busca: {
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#1f1b33',
  },
  resultado: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: 10, padding: 12, marginTop: 8,
  },
  resultadoNome: { fontSize: 14, fontWeight: '700', color: '#1f1b33' },
  resultadoEmail: { fontSize: 11, color: '#7b8794' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardNome: { fontSize: 15, fontWeight: '700', color: '#1f1b33' },
  cardEmail: { fontSize: 11, color: '#7b8794' },
  cardContagem: {
    fontSize: 13, fontWeight: '800', color: '#7c3aed', backgroundColor: '#ede9fe',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  cardClubes: { fontSize: 11, color: '#52606d', marginTop: 8 },
  painel: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: '#f8fafc',
  },
  painelTitulo: { fontSize: 18, fontWeight: '800', color: '#4b2bb0', marginTop: 34 },
  painelSub: { fontSize: 12, color: '#52606d', marginTop: 4, marginBottom: 14 },
  clubeLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  check: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#c3ccd6',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  clubeNome: { flex: 1, fontSize: 14, color: '#1f1b33' },
  painelAcoes: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnSec: { flex: 1, paddingVertical: 12, borderRadius: 22, backgroundColor: '#e6e1f4', alignItems: 'center' },
  btnSecText: { color: '#52606d', fontWeight: '700', fontSize: 13 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 22, backgroundColor: '#7c3aed', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

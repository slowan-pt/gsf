import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { avisar, confirmar } from '../../src/stores/avisoStore';
import { useCores } from '../../src/stores/temaStore';
import { corIcone, estiloCartao, tomTexto } from '../../src/lib/tema';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { Chip, EstadoVazio } from '../../src/components/ui';

type Tipo = 'pastor' | 'regional' | 'associacao';

interface PerfilExterno {
  usuario_id: string;
  nome: string | null;
  email: string | null;
  tipo: Tipo;
  clubes: number[];
}

interface ClubeLinha { id: number; nome: string }

const ROTULO: Record<Tipo, string> = { pastor: 'Pastor', regional: 'Regional', associacao: 'Associação' };
const ROTULO_PLURAL: Record<Tipo, string> = { pastor: 'Pastores', regional: 'Regionais', associacao: 'Associação' };
const PERFIL_DO_TIPO: Record<Tipo, string> = { pastor: 'usuario_pastor', regional: 'usuario_regional', associacao: 'usuario_associacao' };
const DESCRICAO: Record<Tipo, string> = {
  pastor: 'Acompanhamento pastoral dos clubes marcados.',
  regional: 'Aprova classes dos clubes marcados, depois da diretoria.',
  associacao: 'Cria e gerencia pastores e regionais.',
};

export default function PerfisExternosScreen() {
  const cores = useCores();
  const permissoes = usePermissoes();
  // Só o Admin TI e a Associação veem esta página.
  const ehAdminTi = permissoes.temPerfil(['admin_ti']);
  const podeVer = ehAdminTi || permissoes.temPerfil(['usuario_associacao']);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [perfis, setPerfis] = useState<PerfilExterno[]>([]);
  const [clubes, setClubes] = useState<ClubeLinha[]>([]);
  const [painel, setPainel] = useState<'novo' | PerfilExterno | null>(null);

  const [tipo, setTipo] = useState<Tipo>('regional');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [clubesEscolhidos, setClubesEscolhidos] = useState<number[]>([]);

  useFocusEffect(useCallback(() => { if (podeVer) carregar(); }, [podeVer]));

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [lista, listaClubes] = await Promise.all([
        supabase.rpc('perfis_externos_listar'),
        supabase.rpc('perfis_externos_clubes'),
      ]);
      if (lista.error) throw lista.error;
      if (listaClubes.error) throw listaClubes.error;
      setPerfis(((lista.data ?? []) as any[]).map((l) => ({
        usuario_id: String(l.usuario_id), nome: l.nome, email: l.email, tipo: l.tipo as Tipo, clubes: (l.clubes ?? []) as number[],
      })));
      setClubes((listaClubes.data ?? []) as ClubeLinha[]);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar. A migration 134 já foi executada?');
    } finally {
      setLoading(false);
    }
  }

  const grupos = useMemo(
    () => (['associacao', 'regional', 'pastor'] as Tipo[]).map((t) => ({ tipo: t, itens: perfis.filter((p) => p.tipo === t) })).filter((g) => g.itens.length > 0),
    [perfis],
  );

  function abrirNovo() {
    setTipo('regional'); setNome(''); setEmail(''); setSenha(''); setClubesEscolhidos([]);
    setPainel('novo');
  }

  function abrirEdicao(p: PerfilExterno) {
    setTipo(p.tipo); setNome(p.nome ?? ''); setEmail(p.email ?? ''); setSenha('');
    setClubesEscolhidos(p.clubes);
    setPainel(p);
  }

  /** Cria a conta de login (ou reaproveita a que já existe) e devolve o id. */
  async function obterOuCriarConta(): Promise<string> {
    const { data: achada, error: erroBusca } = await supabase.rpc('perfil_externo_buscar', { p_email: email });
    if (erroBusca) throw erroBusca;
    const existente = ((achada ?? []) as any[])[0];
    if (existente?.id) return String(existente.id);

    if (senha.length < 6) throw new Error('A senha provisória precisa ter pelo menos 6 caracteres.');
    const { data: sessaoAtual } = await supabase.auth.getSession();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: { data: { nome: nome.trim(), perfil: PERFIL_DO_TIPO[tipo] }, emailRedirectTo: 'dbvfonseca://auth/callback' },
    });
    // O cadastro troca a sessão para a nova conta: volta para quem está criando.
    if (sessaoAtual.session) {
      await supabase.auth.setSession({ access_token: sessaoAtual.session.access_token, refresh_token: sessaoAtual.session.refresh_token });
    }
    if (error) throw error;
    if (!data.user?.id || (data.user.identities && data.user.identities.length === 0)) {
      throw new Error('Este e-mail já tem uma conta que não pôde ser vinculada.');
    }
    return data.user.id;
  }

  async function salvar() {
    if (!painel || salvando) return;
    if (painel === 'novo') {
      if (!nome.trim()) { avisar('Informe o nome.', 'info', 'Atenção'); return; }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { avisar('Informe um e-mail válido.', 'info', 'Atenção'); return; }
    }
    if (clubesEscolhidos.length === 0) {
      avisar('Marque ao menos um clube: sem clube a pessoa não consegue entrar.', 'info', 'Atenção');
      return;
    }
    setSalvando(true);
    try {
      const usuarioId = painel === 'novo' ? await obterOuCriarConta() : painel.usuario_id;
      const { error } = await supabase.rpc('perfil_externo_salvar', {
        p_usuario_id: usuarioId, p_tipo: tipo, p_nome: nome.trim(), p_email: email.trim(), p_clubes: clubesEscolhidos,
      });
      if (error) throw error;
      avisar(painel === 'novo' ? `${ROTULO[tipo]} criado(a). Passe o e-mail e a senha provisória.` : 'Acesso salvo.', 'sucesso', 'Pronto');
      setPainel(null);
      await carregar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(p: PerfilExterno) {
    const ok = await confirmar('Remover acesso', `Remover o acesso de ${p.nome || p.email}? A conta e o histórico ficam; só o acesso aos clubes sai.`, 'Remover');
    if (!ok) return;
    try {
      const { error } = await supabase.rpc('perfil_externo_remover', { p_usuario_id: p.usuario_id });
      if (error) throw error;
      setPainel(null);
      await carregar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível remover.', 'erro');
    }
  }

  if (!podeVer) return <Redirect href="/" />;

  const tiposCriaveis: Tipo[] = ehAdminTi ? ['regional', 'pastor', 'associacao'] : ['regional', 'pastor'];
  const editando = painel && painel !== 'novo' ? painel : null;
  const podeEditarEste = !editando || editando.tipo !== 'associacao' || ehAdminTi;

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Perfis externos" />

      <ScrollView contentContainerStyle={s.scroll}>
        {loading && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
        {!!erro && <EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} />}

        {!loading && !erro && (
          <>
            <View style={[s.aviso, { backgroundColor: cores.acentoSuave }]}>
              <Ionicons name="information-circle" size={20} color={cores.acento} />
              <Text style={[s.avisoTexto, { color: cores.texto }]}>
                Pastor, Regional e Associação não pertencem a um clube: cada um pode acompanhar vários clubes, com responsabilidades
                diferentes das de um clube. {ehAdminTi ? '' : 'A Associação cria pastores e regionais.'}
              </Text>
            </View>

            <TouchableOpacity style={[s.btnNovo, { backgroundColor: cores.primaria, boxShadow: `0px 4px 0px ${cores.profundo}` }]} onPress={abrirNovo} accessibilityRole="button">
              <Ionicons name="person-add" size={18} color="#fff" />
              <Text style={s.btnNovoTexto}>Novo perfil externo</Text>
            </TouchableOpacity>

            {grupos.length === 0 && <EstadoVazio titulo="Nenhum perfil externo cadastrado ainda." />}
            {grupos.map((g) => (
              <View key={g.tipo}>
                <Text style={[s.label, { color: cores.textoSecundario }]}>{ROTULO_PLURAL[g.tipo]} ({g.itens.length})</Text>
                {g.itens.map((p) => (
                  <TouchableOpacity key={p.usuario_id} style={[s.card, estiloCartao(cores, 18)]} onPress={() => abrirEdicao(p)} accessibilityRole="button">
                    <View style={s.cardTopo}>
                      <Ionicons name="shield-checkmark" size={20} color={tomTexto('#7c3aed', cores)} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.cardNome, { color: cores.texto }]}>{p.nome || 'Sem nome'}</Text>
                        <Text style={[s.cardEmail, { color: cores.textoSecundario }]}>{p.email}</Text>
                      </View>
                      <Text style={[s.contagem, { backgroundColor: cores.acentoSuave, color: cores.acento }]}>{p.clubes.length}</Text>
                    </View>
                    <Text style={[s.cardClubes, { color: cores.textoSecundario }]}>
                      {p.clubes.length > 0 ? clubes.filter((c) => p.clubes.includes(c.id)).map((c) => c.nome).join(' · ') : 'Sem clube vinculado'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {!!painel && (
        <View style={[s.painel, { backgroundColor: cores.fundo }]}>
          <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 52 }} keyboardShouldPersistTaps="handled">
            <Text style={[s.painelTitulo, { color: cores.texto }]}>{painel === 'novo' ? 'Novo perfil externo' : (editando?.nome || editando?.email)}</Text>
            <Text style={[s.painelSub, { color: cores.textoSecundario }]}>{DESCRICAO[tipo]}</Text>

            {painel === 'novo' ? (
              <>
                <Text style={[s.label, { color: cores.textoSecundario }]}>Tipo</Text>
                <View style={s.chips}>
                  {tiposCriaveis.map((t) => <Chip key={t} rotulo={ROTULO[t]} ativo={tipo === t} onPress={() => setTipo(t)} />)}
                </View>
                <Text style={[s.label, { color: cores.textoSecundario }]}>Nome</Text>
                <TextInput style={[s.input, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={nome} onChangeText={setNome} placeholder="Nome completo" placeholderTextColor={cores.placeholder} />
                <Text style={[s.label, { color: cores.textoSecundario }]}>E-mail de login</Text>
                <TextInput style={[s.input, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={email} onChangeText={setEmail} placeholder="email@exemplo.com" placeholderTextColor={cores.placeholder} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
                <Text style={[s.label, { color: cores.textoSecundario }]}>Senha provisória</Text>
                <TextInput style={[s.input, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={senha} onChangeText={setSenha} placeholder="Mínimo 6 caracteres (ignorada se a conta já existe)" placeholderTextColor={cores.placeholder} secureTextEntry />
              </>
            ) : (
              <View style={[s.selo, { backgroundColor: cores.acentoSuave }]}>
                <Text style={[s.seloTexto, { color: cores.acento }]}>{ROTULO[tipo]}</Text>
              </View>
            )}

            <Text style={[s.label, { color: cores.textoSecundario, marginTop: 14 }]}>Clubes que acompanha</Text>
            {clubes.map((c) => {
              const marcado = clubesEscolhidos.includes(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={s.clubeLinha}
                  disabled={!podeEditarEste}
                  onPress={() => setClubesEscolhidos((p) => (marcado ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                >
                  <View style={[s.check, { borderColor: cores.borda }, marcado && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}>
                    {marcado ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                  </View>
                  <Text style={[s.clubeNome, { color: cores.texto }]}>{c.nome}</Text>
                </TouchableOpacity>
              );
            })}

            <View style={s.acoes}>
              <TouchableOpacity style={[s.btnSec, { backgroundColor: cores.borda }]} onPress={() => setPainel(null)} accessibilityRole="button">
                <Text style={[s.btnSecTexto, { color: cores.texto }]}>Cancelar</Text>
              </TouchableOpacity>
              {podeEditarEste && (
                <TouchableOpacity style={[s.btn, { backgroundColor: cores.primaria }, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando} accessibilityRole="button">
                  <Text style={s.btnTexto}>{salvando ? 'Salvando...' : painel === 'novo' ? 'Criar perfil' : 'Salvar acesso'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {editando && podeEditarEste && (
              <TouchableOpacity style={s.remover} onPress={() => remover(editando)} accessibilityRole="button">
                <Ionicons name="trash-outline" size={16} color="#c62828" />
                <Text style={s.removerTexto}>Remover acesso</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  aviso: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 14, alignItems: 'flex-start', marginBottom: 14 },
  avisoTexto: { flex: 1, fontSize: 12, lineHeight: 17 },
  btnNovo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 14, marginBottom: 16 },
  btnNovoTexto: { color: '#fff', fontSize: 15, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  card: { padding: 14, marginBottom: 10 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardNome: { fontSize: 15, fontWeight: '800' },
  cardEmail: { fontSize: 11 },
  contagem: { fontSize: 13, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  cardClubes: { fontSize: 11, marginTop: 8 },
  painel: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  painelTitulo: { fontSize: 18, fontWeight: '900' },
  painelSub: { fontSize: 12, marginTop: 4, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 46, fontSize: 14, marginBottom: 8 },
  selo: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  seloTexto: { fontSize: 12, fontWeight: '900' },
  clubeLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  clubeNome: { flex: 1, fontSize: 14 },
  acoes: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnSec: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnSecTexto: { fontWeight: '800', fontSize: 13 },
  btn: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnTexto: { color: '#fff', fontWeight: '900', fontSize: 13 },
  remover: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, minHeight: 44 },
  removerTexto: { color: '#c62828', fontWeight: '800', fontSize: 13 },
});

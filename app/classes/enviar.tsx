import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useEspacoParaTeclado } from '../../src/lib/teclado';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import {
  carregarCatalogoClasses,
  classesDoCatalogo,
  enviarRequisitosComoAtividade,
  type RequisitoCatalogo,
} from '../../src/lib/classesRequisitos';

type Escopo = 'clube' | 'unidade' | 'membros';

interface Membro {
  id: number;
  nome: string;
  unidade: string;
}

function normalizar(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function mascaraData(t: string) {
  const d = t.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

function paraISO(ddmmaaaa: string) {
  const [d, m, a] = ddmmaaaa.split('/');
  if (!d || !m || !a || a.length !== 4) return null;
  const iso = `${a}-${m}-${d}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

export default function EnviarRequisitosScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const clubeId = getClubeAtivoId();
  const podeEnviar = permissoes.pode('gerenciar_atividades');

  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const espacoTeclado = useEspacoParaTeclado();
  const [catalogo, setCatalogo] = useState<RequisitoCatalogo[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);

  const [classeAtiva, setClasseAtiva] = useState('');
  const [buscaRequisito, setBuscaRequisito] = useState('');
  const [requisitosEscolhidos, setRequisitosEscolhidos] = useState<number[]>([]);
  const [escopo, setEscopo] = useState<Escopo>('clube');
  const [unidadesEscolhidas, setUnidadesEscolhidas] = useState<string[]>([]);
  const [membrosEscolhidos, setMembrosEscolhidos] = useState<number[]>([]);
  const [buscaMembro, setBuscaMembro] = useState('');
  const [prazoTexto, setPrazoTexto] = useState('');

  useFocusEffect(useCallback(() => { carregar(); }, [clubeId]));

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [cat, membrosRes] = await Promise.all([
        carregarCatalogoClasses(),
        supabase
          .from('desbravadores')
          .select('id,nome,unidade_nome')
          .eq('clube_id', clubeId)
          .neq('ativo', false)
          .order('nome', { ascending: true }),
      ]);
      if (membrosRes.error) throw membrosRes.error;
      setCatalogo(cat);
      setMembros(
        (membrosRes.data ?? []).map((m: any) => ({
          id: m.id, nome: m.nome, unidade: m.unidade_nome || 'Sem unidade',
        }))
      );
      const classes = classesDoCatalogo(cat);
      setClasseAtiva((a) => (a && classes.includes(a) ? a : classes[0] ?? ''));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }

  const classes = useMemo(() => classesDoCatalogo(catalogo), [catalogo]);
  const unidades = useMemo(
    () => Array.from(new Set(membros.map((m) => m.unidade))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [membros]
  );

  const requisitosVisiveis = useMemo(() => {
    const termo = normalizar(buscaRequisito);
    return catalogo.filter(
      (r) => r.classe_nome === classeAtiva && (!termo || normalizar(r.texto).includes(termo))
    );
  }, [catalogo, classeAtiva, buscaRequisito]);

  const alvos = useMemo(() => {
    if (escopo === 'clube') return membros;
    if (escopo === 'unidade') return membros.filter((m) => unidadesEscolhidas.includes(m.unidade));
    return membros.filter((m) => membrosEscolhidos.includes(m.id));
  }, [escopo, membros, unidadesEscolhidas, membrosEscolhidos]);

  const membrosFiltrados = useMemo(() => {
    const termo = normalizar(buscaMembro);
    return membros.filter((m) => !termo || normalizar(m.nome).includes(termo)).slice(0, 80);
  }, [membros, buscaMembro]);

  async function enviar() {
    const requisitos = catalogo.filter((r) => requisitosEscolhidos.includes(r.id));
    if (requisitos.length === 0) return Alert.alert('Envio', 'Escolha ao menos um requisito.');
    if (alvos.length === 0) return Alert.alert('Envio', 'Escolha ao menos um destinatário.');

    const prazo = prazoTexto.trim() ? paraISO(prazoTexto) : null;
    if (prazoTexto.trim() && !prazo) {
      return Alert.alert('Data inválida', 'Use o formato dd/mm/aaaa ou deixe em branco.');
    }

    const total = requisitos.length * alvos.length;
    const confirma = typeof window !== 'undefined'
      ? window.confirm(
          `Enviar ${requisitos.length} requisito(s) para ${alvos.length} membro(s)?\n\n` +
          `Serão criadas até ${total} atividades${prazo ? ` com prazo ${prazoTexto}` : ' sem prazo'}.`
        )
      : true;
    if (!confirma) return;

    setEnviando(true);
    try {
      const { criadas, ignoradas } = await enviarRequisitosComoAtividade({
        clubeId, requisitos, membros: alvos, prazo, criadoPor: usuario?.nome ?? null,
      });
      const msg = `${criadas} atividade(s) criada(s)${ignoradas ? ` · ${ignoradas} já existiam e foram ignoradas` : ''}.`;
      if (typeof window !== 'undefined') window.alert(msg);
      else Alert.alert('Pronto', msg);
      setRequisitosEscolhidos([]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  }

  if (!podeEnviar) return <Redirect href="/classes" />;

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: corCabecalho }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Enviar requisitos em lote</Text>
          <Text style={s.headerSub}>Vira atividade a cumprir no painel de cada membro</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: espacoTeclado }]}
        keyboardShouldPersistTaps="handled"
      >
        {loading && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={s.erro}>{erro}</Text>}

        {!loading && (
          <>
            <Text style={s.label}>1. Classe</Text>
            <View style={s.chips}>
              {classes.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[s.chip, classeAtiva === c && s.chipOn]}
                  onPress={() => { setClasseAtiva(c); setRequisitosEscolhidos([]); }}
                >
                  <Text style={[s.chipText, classeAtiva === c && s.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>2. Requisitos ({requisitosEscolhidos.length} selecionados)</Text>
            <TextInput
              style={s.busca}
              value={buscaRequisito}
              onChangeText={setBuscaRequisito}
              placeholder="Buscar requisito..."
              placeholderTextColor="#9aa5b1"
            />
            <View style={s.lista}>
              {requisitosVisiveis.slice(0, 120).map((r) => {
                const on = requisitosEscolhidos.includes(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.linha, on && s.linhaOn]}
                    onPress={() =>
                      setRequisitosEscolhidos((p) => (on ? p.filter((x) => x !== r.id) : [...p, r.id]))
                    }
                  >
                    <View style={[s.check, on && s.checkOn]}>
                      {on ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                    </View>
                    <Text style={s.linhaTexto} numberOfLines={2}>
                      <Text style={s.codigo}>
                        {r.codigo}{r.subitem ? `.${r.subitem}` : ''}{' '}
                      </Text>
                      {r.texto}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {requisitosVisiveis.length === 0 && <Text style={s.vazio}>Nenhum requisito encontrado.</Text>}
            </View>

            <Text style={s.label}>3. Para quem</Text>
            <View style={s.chips}>
              {([
                { id: 'clube', label: 'Clube todo' },
                { id: 'unidade', label: 'Unidades' },
                { id: 'membros', label: 'Membros específicos' },
              ] as const).map((op) => (
                <TouchableOpacity
                  key={op.id}
                  style={[s.chip, escopo === op.id && s.chipOn]}
                  onPress={() => { setEscopo(op.id); setUnidadesEscolhidas([]); setMembrosEscolhidos([]); }}
                >
                  <Text style={[s.chipText, escopo === op.id && s.chipTextOn]}>{op.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {escopo === 'unidade' && (
              <View style={s.chips}>
                {unidades.map((u) => {
                  const on = unidadesEscolhidas.includes(u);
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[s.chip, on && s.chipOn]}
                      onPress={() => setUnidadesEscolhidas((p) => (on ? p.filter((x) => x !== u) : [...p, u]))}
                    >
                      <Text style={[s.chipText, on && s.chipTextOn]}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {escopo === 'membros' && (
              <>
                <TextInput
                  style={s.busca}
                  value={buscaMembro}
                  onChangeText={setBuscaMembro}
                  placeholder="Buscar membro..."
                  placeholderTextColor="#9aa5b1"
                />
                <View style={s.chips}>
                  {membrosFiltrados.map((m) => {
                    const on = membrosEscolhidos.includes(m.id);
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[s.chip, on && s.chipOn]}
                        onPress={() => setMembrosEscolhidos((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))}
                      >
                        <Text style={[s.chipText, on && s.chipTextOn]}>{m.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={s.label}>4. Prazo (opcional)</Text>
            <TextInput
              style={s.busca}
              value={prazoTexto}
              onChangeText={(t) => setPrazoTexto(mascaraData(t))}
              placeholder="dd/mm/aaaa — deixe vazio para enviar sem prazo"
              placeholderTextColor="#9aa5b1"
              keyboardType="numeric"
              maxLength={10}
            />

            <View style={s.resumo}>
              <Text style={s.resumoTexto}>
                {requisitosEscolhidos.length} requisito(s) × {alvos.length} membro(s) ={' '}
                <Text style={{ fontWeight: '800' }}>{requisitosEscolhidos.length * alvos.length}</Text> atividade(s)
              </Text>
              <Text style={s.resumoDica}>Quem já recebeu o mesmo requisito é ignorado automaticamente.</Text>
            </View>

            <TouchableOpacity
              style={[s.btnEnviar, (enviando || requisitosEscolhidos.length === 0 || alvos.length === 0) && { opacity: 0.5 }]}
              onPress={enviar}
              disabled={enviando || requisitosEscolhidos.length === 0 || alvos.length === 0}
            >
              <Ionicons name="paper-plane" size={18} color="#fff" />
              <Text style={s.btnEnviarText}>{enviando ? 'Enviando...' : 'Enviar atividades'}</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  header: {
    backgroundColor: '#1a3a5c', paddingTop: 48, paddingBottom: 18, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  voltar: { padding: 4 },
  headerTitulo: { color: '#fff', fontSize: 19, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  scroll: { padding: 16 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', fontSize: 13, padding: 12, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '800', color: '#52606d', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#e4eaf1' },
  chipOn: { backgroundColor: '#1a3a5c' },
  chipText: { fontSize: 12, color: '#4a5866', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  busca: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: '#1f2933', marginBottom: 8,
  },
  lista: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', maxHeight: 340 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderBottomWidth: 1, borderBottomColor: '#eef2f6' },
  linhaOn: { backgroundColor: '#eff6ff' },
  check: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#c3ccd6',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  linhaTexto: { flex: 1, fontSize: 12, color: '#1f2933', lineHeight: 17 },
  codigo: { fontWeight: '800', color: '#1a3a5c' },
  resumo: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, marginTop: 18 },
  resumoTexto: { fontSize: 13, color: '#1e40af' },
  resumoDica: { fontSize: 11, color: '#60a5fa', marginTop: 4 },
  btnEnviar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, marginTop: 12,
  },
  btnEnviarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

import { EstadoVazio, Chip } from '../../src/components/ui';
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
import { buscarPaginado } from '../../src/lib/supabasePaginado';
import { useEspacoParaTeclado } from '../../src/lib/teclado';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { avisar, confirmar } from '../../src/stores/avisoStore';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import {
  carregarCatalogoClasses,
  classesDoCatalogo,
  enviarRequisitosComoAtividade,
  type RequisitoCatalogo,
} from '../../src/lib/classesRequisitos';
import { corIcone } from '../../src/lib/tema';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';

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
  const cores = useCores();
  const corCabecalho = useCorCabecalho();
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
        buscarPaginado(
          (q) => q.eq('clube_id', clubeId).neq('ativo', false).order('nome', { ascending: true }),
          'desbravadores',
          'id,nome,unidade_nome',
        ).then((data) => ({ data, error: null as any })),
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
    if (requisitos.length === 0) return avisar('Escolha ao menos um requisito.', 'info', 'Envio');
    if (alvos.length === 0) return avisar('Escolha ao menos um destinatário.', 'info', 'Envio');

    const prazo = prazoTexto.trim() ? paraISO(prazoTexto) : null;
    if (prazoTexto.trim() && !prazo) {
      return avisar('Use o formato dd/mm/aaaa ou deixe em branco.', 'info', 'Data inválida');
    }

    const total = requisitos.length * alvos.length;
    const confirma = await confirmar(
      'Enviar requisitos',
      `Enviar ${requisitos.length} requisito(s) para ${alvos.length} membro(s)?\n\nSerão criadas até ${total} atividades${prazo ? ` com prazo ${prazoTexto}` : ' sem prazo'}.`,
      'Enviar'
    );
    if (!confirma) return;

    setEnviando(true);
    try {
      const { criadas, ignoradas } = await enviarRequisitosComoAtividade({
        clubeId, requisitos, membros: alvos, prazo, criadoPor: usuario?.nome ?? null,
      });
      avisar(`${criadas} atividade(s) criada(s)${ignoradas ? ` · ${ignoradas} já existiam e foram ignoradas` : ''}.`, 'sucesso', 'Pronto');
      setRequisitosEscolhidos([]);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível enviar.', 'erro');
    } finally {
      setEnviando(false);
    }
  }

  if (!podeEnviar) return <Redirect href="/classes" />;

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Enviar requisitos em lote" />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: espacoTeclado }]}
        keyboardShouldPersistTaps="handled"
      >
        {loading && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
        {!!erro && <EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} />}

        {!loading && (
          <>
            <Text style={[s.label, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>1. Classe</Text>
            <View style={s.chips}>
              {classes.map((c) => (
                <Chip key={c} rotulo={c} ativo={!!(classeAtiva === c)} onPress={() => { setClasseAtiva(c); setRequisitosEscolhidos([]); }} />
              ))}
            </View>

            <Text style={[s.label, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>2. Requisitos ({requisitosEscolhidos.length} selecionados)</Text>
            <TextInput
              style={[s.busca, cores.isEscuro && { backgroundColor: '#1d1932', color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto }]}
              value={buscaRequisito}
              onChangeText={setBuscaRequisito}
              placeholder="Buscar requisito..."
              placeholderTextColor={cores.placeholder}
            />
            <View style={[s.lista, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
              {requisitosVisiveis.slice(0, 120).map((r) => {
                const on = requisitosEscolhidos.includes(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.linha, cores.isEscuro && { borderBottomColor: '#322c52' }, { borderBottomColor: cores.borda }, on && [s.linhaOn, cores.isEscuro && { backgroundColor: '#3e3d4c' }]]}
                    onPress={() =>
                      setRequisitosEscolhidos((p) => (on ? p.filter((x) => x !== r.id) : [...p, r.id]))
                    }
                  >
                    <View style={[s.check, { borderColor: cores.borda }, on && s.checkOn]}>
                      {on ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                    </View>
                    <Text style={[s.linhaTexto, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]} numberOfLines={2}>
                      <Text style={[s.codigo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>
                        {r.codigo}{r.subitem ? `.${r.subitem}` : ''}{' '}
                      </Text>
                      {r.texto}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {requisitosVisiveis.length === 0 && <EstadoVazio titulo="Nenhum requisito encontrado." />}
            </View>

            <Text style={[s.label, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>3. Para quem</Text>
            <View style={s.chips}>
              {([
                { id: 'clube', label: 'Clube todo' },
                { id: 'unidade', label: 'Unidades' },
                { id: 'membros', label: 'Membros específicos' },
              ] as const).map((op) => (
                <Chip key={op.id} rotulo={op.label} ativo={!!(escopo === op.id)} onPress={() => { setEscopo(op.id); setUnidadesEscolhidas([]); setMembrosEscolhidos([]); }} />
              ))}
            </View>

            {escopo === 'unidade' && (
              <View style={s.chips}>
                {unidades.map((u) => {
                  const on = unidadesEscolhidas.includes(u);
                  return (
                    <Chip key={u} rotulo={u} ativo={!!(on)} onPress={() => setUnidadesEscolhidas((p) => (on ? p.filter((x) => x !== u) : [...p, u]))} />
                  );
                })}
              </View>
            )}

            {escopo === 'membros' && (
              <>
                <TextInput
                  style={[s.busca, cores.isEscuro && { backgroundColor: '#1d1932', color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto }]}
                  value={buscaMembro}
                  onChangeText={setBuscaMembro}
                  placeholder="Buscar membro..."
                  placeholderTextColor={cores.placeholder}
                />
                <View style={s.chips}>
                  {membrosFiltrados.map((m) => {
                    const on = membrosEscolhidos.includes(m.id);
                    return (
                      <Chip key={m.id} rotulo={m.nome} ativo={!!(on)} onPress={() => setMembrosEscolhidos((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))} />
                    );
                  })}
                </View>
              </>
            )}

            <Text style={[s.label, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>4. Prazo (opcional)</Text>
            <TextInput
              style={[s.busca, cores.isEscuro && { backgroundColor: '#1d1932', color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, color: cores.texto }]}
              value={prazoTexto}
              onChangeText={(t) => setPrazoTexto(mascaraData(t))}
              placeholder="dd/mm/aaaa — deixe vazio para enviar sem prazo"
              placeholderTextColor={cores.placeholder}
              keyboardType="numeric"
              maxLength={10}
            />

            <View style={[s.resumo, cores.isEscuro && { backgroundColor: '#3e3d4c' }]}>
              <Text style={[s.resumoTexto, cores.isEscuro && { color: '#9eacdc' }, cores.isEscuro && { color: '#9eacdc' }]}>
                {requisitosEscolhidos.length} requisito(s) × {alvos.length} membro(s) ={' '}
                <Text style={{ fontWeight: '800' }}>{requisitosEscolhidos.length * alvos.length}</Text> atividade(s)
              </Text>
              <Text style={[s.resumoDica, cores.isEscuro && { color: '#bfdbfe' }]}>Quem já recebeu o mesmo requisito é ignorado automaticamente.</Text>
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
  container: { flex: 1, backgroundColor: '#f5f3fb' },
  header: {
    backgroundColor: '#4b2bb0', paddingTop: 48, paddingBottom: 18, paddingHorizontal: 16,
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
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#e6e1f4' },
  chipOn: { backgroundColor: '#4b2bb0' },
  chipText: { fontSize: 12, color: '#4a5866', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  busca: {
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: '#1f1b33', marginBottom: 8,
  },
  lista: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', maxHeight: 340 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderBottomWidth: 1, borderBottomColor: '#eef2f6' },
  linhaOn: { backgroundColor: '#eff6ff' },
  check: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#c3ccd6',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  linhaTexto: { flex: 1, fontSize: 12, color: '#1f1b33', lineHeight: 17 },
  codigo: { fontWeight: '800', color: '#4b2bb0' },
  resumo: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, marginTop: 18 },
  resumoTexto: { fontSize: 13, color: '#1e40af' },
  resumoDica: { fontSize: 11, color: '#60a5fa', marginTop: 4 },
  btnEnviar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563eb', borderRadius: 22, paddingVertical: 14, marginTop: 12,
  },
  btnEnviarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

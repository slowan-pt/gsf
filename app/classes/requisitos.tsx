import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { usePermissoes } from '../../src/lib/permissoes';
import {
  carregarRequisitosDaClasse,
  excluirRequisito,
  salvarRequisito,
  secoesDe,
} from '../../src/lib/classesCatalogoAdmin';
import { carregarCatalogoEspecialidades } from '../../src/lib/especialidades';
import type { RequisitoCatalogo } from '../../src/lib/classesRequisitos';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${titulo}\n\n${mensagem}`);
    return;
  }
  Alert.alert(titulo, mensagem);
}

async function confirmar(titulo: string, mensagem: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(`${titulo}\n\n${mensagem}`);
  }
  return new Promise((resolve) => {
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Excluir', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

const FORM_VAZIO = {
  id: undefined as number | undefined,
  secao: '',
  secao_ordem: '1',
  ordem: '1',
  codigo: '',
  texto: '',
  pontua: true,
  especialidade_nome: '',
};

export default function RequisitosDaClasseScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const { classe, avancada: avancadaParam, rotulo } = useLocalSearchParams<{
    classe: string; avancada?: string; rotulo?: string;
  }>();
  const avancada = avancadaParam === '1';
  const permissoes = usePermissoes();
  const podeEditar = permissoes.temPerfil(['admin_ti', 'admin_total']);

  const [requisitos, setRequisitos] = useState<RequisitoCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [secoesAbertas, setSecoesAbertas] = useState<Set<string>>(new Set());
  const [nomesEspecialidades, setNomesEspecialidades] = useState<string[]>([]);

  useFocusEffect(useCallback(() => { carregar(); }, [classe, avancada]));
  useFocusEffect(useCallback(() => {
    carregarCatalogoEspecialidades()
      .then((lista) => setNomesEspecialidades(lista.map((e) => e.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))))
      .catch(() => {});
  }, []));

  async function carregar() {
    if (!classe) return;
    setCarregando(true);
    setErro(null);
    try {
      setRequisitos(await carregarRequisitosDaClasse(String(classe), avancada));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar os requisitos.');
    } finally {
      setCarregando(false);
    }
  }

  const secoes = useMemo(() => secoesDe(requisitos), [requisitos]);

  const porSecao = useMemo(() => {
    const mapa = new Map<string, RequisitoCatalogo[]>();
    for (const r of requisitos) {
      if (!mapa.has(r.secao)) mapa.set(r.secao, []);
      mapa.get(r.secao)!.push(r);
    }
    return secoes.map((s) => ({ ...s, itens: mapa.get(s.secao) ?? [] }));
  }, [requisitos, secoes]);

  function abrirNovo() {
    const ultimaSecao = secoes[secoes.length - 1];
    const proximaOrdem = requisitos.length > 0
      ? Math.max(...requisitos.map((r) => r.ordem)) + 1
      : 1;
    setForm({
      ...FORM_VAZIO,
      secao: ultimaSecao?.secao ?? 'Requisitos',
      secao_ordem: String(ultimaSecao?.ordem ?? 1),
      ordem: String(proximaOrdem),
      codigo: String(proximaOrdem),
    });
    setModal(true);
  }

  function abrirEdicao(r: RequisitoCatalogo) {
    setForm({
      id: r.id,
      secao: r.secao,
      secao_ordem: String(r.secao_ordem),
      ordem: String(r.ordem),
      codigo: r.codigo,
      texto: r.texto,
      pontua: r.pontua,
      especialidade_nome: r.especialidade_nome ?? '',
    });
    setModal(true);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await salvarRequisito({
        id: form.id,
        classe_nome: String(classe),
        avancada,
        secao: form.secao,
        secao_ordem: Number(form.secao_ordem) || 1,
        ordem: Number(form.ordem) || 1,
        codigo: form.codigo,
        texto: form.texto,
        pontua: form.pontua,
        especialidade_nome: form.especialidade_nome,
      });
      setModal(false);
      await carregar();
    } catch (e: any) {
      avisar('Erro ao salvar', e?.message ?? 'Não foi possível salvar o requisito.');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(r: RequisitoCatalogo) {
    const ok = await confirmar(
      'Excluir requisito',
      `Remover "${r.codigo} — ${r.texto.slice(0, 60)}..."?\n\nEle some de todas as telas e deixa de contar no progresso. O histórico já registrado dos membros é preservado.`
    );
    if (!ok) return;
    try {
      await excluirRequisito(r.id);
      await carregar();
    } catch (e: any) {
      avisar('Erro ao excluir', e?.message ?? 'Não foi possível excluir.');
    }
  }

  const totalPontuam = requisitos.filter((r) => r.pontua).length;

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo} numberOfLines={1}>{rotulo ?? classe}</Text>
          <Text style={s.headerSub}>
            {requisitos.length} itens · {totalPontuam} contam no progresso
          </Text>
        </View>
        {podeEditar && (
          <TouchableOpacity onPress={abrirNovo} style={s.novoBtn}>
            <Ionicons name="add" size={18} color="#1a3a5c" />
          </TouchableOpacity>
        )}
      </View>

      {!podeEditar && (
        <Text style={s.somenteLeitura}>
          Só o Admin TI pode alterar requisitos — eles valem para todos os clubes do programa.
        </Text>
      )}

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={s.erro}>{erro}</Text>}
        {!carregando && !erro && requisitos.length === 0 && (
          <Text style={s.vazio}>Nenhum requisito cadastrado nesta classe ainda.</Text>
        )}

        {porSecao.map((grupo) => {
          const aberta = secoesAbertas.size === 0 || secoesAbertas.has(grupo.secao);
          return (
            <View key={grupo.secao}>
              <TouchableOpacity
                style={s.secaoHeader}
                activeOpacity={0.7}
                onPress={() => setSecoesAbertas((prev) => {
                  // Primeiro toque fecha só esta; depois alterna normalmente.
                  const base = prev.size === 0 ? new Set(porSecao.map((g) => g.secao)) : new Set(prev);
                  if (base.has(grupo.secao)) base.delete(grupo.secao);
                  else base.add(grupo.secao);
                  return base;
                })}
              >
                <Ionicons name={aberta ? 'chevron-down' : 'chevron-forward'} size={17} color="#1a3a5c" />
                <Text style={s.secaoTitulo}>{grupo.secao}</Text>
                <View style={s.contador}>
                  <Text style={s.contadorText}>{grupo.itens.length}</Text>
                </View>
              </TouchableOpacity>

              {aberta && grupo.itens.map((r) => (
                <View key={r.id} style={s.card}>
                  <View style={s.cardTopo}>
                    <Text style={s.codigo}>{r.codigo}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.texto}>{r.texto}</Text>
                      <View style={s.tags}>
                        {!r.pontua && <Text style={s.tagSubitem}>subitem</Text>}
                        {!!r.especialidade_nome && (
                          <Text style={s.tagEspec}>especialidade: {r.especialidade_nome}</Text>
                        )}
                      </View>
                    </View>
                    {podeEditar && (
                      <View style={s.acoes}>
                        <TouchableOpacity style={s.acaoBtn} onPress={() => abrirEdicao(r)}>
                          <Ionicons name="create-outline" size={17} color="#1a3a5c" />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.acaoBtn} onPress={() => remover(r)}>
                          <Ionicons name="trash-outline" size={17} color="#c0392b" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={s.modalFundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalCaixa}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>{form.id ? 'Editar requisito' : 'Novo requisito'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={22} color="#52606d" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={s.label}>Texto do requisito *</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={form.texto}
                onChangeText={(v) => setForm((f) => ({ ...f, texto: v }))}
                placeholder="Descreva o que o membro precisa cumprir"
                multiline
              />

              <Text style={s.label}>Seção *</Text>
              {secoes.length > 0 ? (
                <View style={s.chipsWrap}>
                  {secoes.map((sec) => (
                    <TouchableOpacity
                      key={sec.secao}
                      style={[s.chip, form.secao === sec.secao && s.chipAtivo]}
                      onPress={() => setForm((f) => ({
                        ...f, secao: sec.secao, secao_ordem: String(sec.ordem),
                      }))}
                    >
                      <Text style={[s.chipText, form.secao === sec.secao && s.chipTextAtivo]}>
                        {sec.secao}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={s.avisoVazio}>Nenhuma seção cadastrada ainda para esta classe.</Text>
              )}

              <View style={s.linha}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Código</Text>
                  <View style={s.inputSomenteLeitura}>
                    <Text style={s.inputSomenteLeituraTexto}>{form.codigo || '—'}</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Ordem</Text>
                  <View style={s.inputSomenteLeitura}>
                    <Text style={s.inputSomenteLeituraTexto}>{form.ordem || '—'}</Text>
                  </View>
                </View>
              </View>
              <Text style={s.avisoVazio}>Numeração automática, seguindo a sequência já existente.</Text>

              <Text style={s.label}>Especialidade vinculada</Text>
              <View style={s.chipsWrap}>
                <TouchableOpacity
                  style={[s.chip, !form.especialidade_nome && s.chipAtivo]}
                  onPress={() => setForm((f) => ({ ...f, especialidade_nome: '' }))}
                >
                  <Text style={[s.chipText, !form.especialidade_nome && s.chipTextAtivo]}>Nenhuma</Text>
                </TouchableOpacity>
                {nomesEspecialidades.map((nome) => (
                  <TouchableOpacity
                    key={nome}
                    style={[s.chip, form.especialidade_nome === nome && s.chipAtivo]}
                    onPress={() => setForm((f) => ({ ...f, especialidade_nome: nome }))}
                  >
                    <Text style={[s.chipText, form.especialidade_nome === nome && s.chipTextAtivo]}>{nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.switchLinha}>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchTitulo}>Conta no progresso</Text>
                  <Text style={s.switchSub}>
                    Desligue se for apenas um subitem explicativo do requisito acima.
                  </Text>
                </View>
                <Switch
                  value={form.pontua}
                  onValueChange={(v) => setForm((f) => ({ ...f, pontua: v }))}
                  trackColor={{ true: '#1a3a5c' }}
                />
              </View>

              <TouchableOpacity style={s.salvar} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#fff" />
                    <Text style={s.salvarText}>Salvar requisito</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  header: {
    backgroundColor: '#1a3a5c', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voltar: { padding: 2 },
  headerTitulo: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  novoBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  somenteLeitura: { fontSize: 12, color: '#8a94a0', textAlign: 'center', padding: 14 },

  lista: { flex: 1, marginTop: 6 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24, paddingHorizontal: 30 },

  secaoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 11, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e4eaf1',
  },
  secaoTitulo: { flex: 1, fontSize: 12, fontWeight: '800', color: '#1a3a5c', textTransform: 'uppercase' },
  contador: {
    minWidth: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#eef3f8', alignItems: 'center',
  },
  contadorText: { fontSize: 12, fontWeight: '800', color: '#1a3a5c' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12,
    borderWidth: 1, borderColor: '#e4eaf1', padding: 12,
  },
  cardTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  codigo: {
    fontSize: 12, fontWeight: '900', color: '#7c3aed', minWidth: 30,
    backgroundColor: '#f3eeff', borderRadius: 6, paddingVertical: 3, textAlign: 'center',
  },
  texto: { fontSize: 13, color: '#1f2933', lineHeight: 19 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tagSubitem: {
    fontSize: 10, fontWeight: '800', color: '#8a94a0', backgroundColor: '#f0f3f7',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },
  tagEspec: {
    fontSize: 10, fontWeight: '800', color: '#7c3aed', backgroundColor: '#f3eeff',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },
  acoes: { flexDirection: 'row' },
  acaoBtn: { padding: 6 },

  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCaixa: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, maxHeight: '92%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  modalTitulo: { flex: 1, fontSize: 17, fontWeight: '800', color: '#1a3a5c' },
  label: {
    fontSize: 12, fontWeight: '800', color: '#667', marginBottom: 6, marginTop: 12,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 11,
    padding: 12, fontSize: 15, color: '#1f2933',
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
  linha: { flexDirection: 'row', gap: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#eef3f8', marginRight: 7, marginBottom: 7 },
  chipAtivo: { backgroundColor: '#1a3a5c' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#4a5866' },
  chipTextAtivo: { color: '#fff' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  avisoVazio: { fontSize: 12, color: '#8a94a0', marginTop: 4, fontStyle: 'italic' },
  inputSomenteLeitura: {
    backgroundColor: '#f0f3f7', borderWidth: 1, borderColor: '#e4eaf1', borderRadius: 11,
    padding: 12,
  },
  inputSomenteLeituraTexto: { fontSize: 15, color: '#52606d', fontWeight: '700' },
  switchLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18,
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 12,
  },
  switchTitulo: { fontSize: 13, fontWeight: '800', color: '#1f2933' },
  switchSub: { fontSize: 11, color: '#8a94a0', marginTop: 2, lineHeight: 15 },
  salvar: {
    marginTop: 20, backgroundColor: '#1a3a5c', borderRadius: 13, padding: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  salvarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

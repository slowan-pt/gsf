import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { supabase } from '../../src/lib/supabase';
import { getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';

interface ClasseCatalogo {
  id: number;
  nome: string;
  tipo: string | null;
  idade_indicada: number | null;
  ordem: number | null;
  ativo: boolean;
}

const SEM_TIPO = 'Sem tipo';

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
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

const FORM_VAZIO = { id: null as number | null, nome: '', tipo: '', idade_indicada: '' };

export default function CatalogoClassesScreen() {
  const permissoes = usePermissoes();
  const podeGerenciar = permissoes.temPerfil(['admin_ti', 'admin_total']);

  const [itens, setItens] = useState<ClasseCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(useCallback(() => { carregar(); }, []));

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from('classes_modelo')
        .select('id,nome,tipo,idade_indicada,ordem,ativo')
        .eq('programa_id', getProgramaAtivoId())
        .order('ordem');
      if (error) throw error;
      setItens((data ?? []) as ClasseCatalogo[]);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar o catálogo de classes.');
    } finally {
      setCarregando(false);
    }
  }

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = termo
      ? itens.filter((i) => i.nome.toLowerCase().includes(termo) || (i.tipo ?? '').toLowerCase().includes(termo))
      : itens;
    const mapa = new Map<string, ClasseCatalogo[]>();
    for (const item of filtrados) {
      const tipo = (item.tipo ?? '').trim() || SEM_TIPO;
      if (!mapa.has(tipo)) mapa.set(tipo, []);
      mapa.get(tipo)!.push(item);
    }
    return Array.from(mapa.entries())
      .map(([tipo, lista]) => ({
        tipo,
        itens: lista.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.nome.localeCompare(b.nome, 'pt-BR')),
      }))
      .sort((a, b) => (a.tipo === SEM_TIPO ? 1 : b.tipo === SEM_TIPO ? -1 : a.tipo.localeCompare(b.tipo, 'pt-BR')));
  }, [itens, busca]);

  const tipos = useMemo(() => {
    const set = new Set<string>();
    for (const i of itens) { const t = (i.tipo ?? '').trim(); if (t) set.add(t); }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [itens]);

  async function salvar() {
    if (!form.nome.trim()) { avisar('Atenção', 'Informe o nome da classe.'); return; }
    setSalvando(true);
    try {
      const payload = {
        programa_id: getProgramaAtivoId(),
        nome: form.nome.trim(),
        tipo: form.tipo.trim() || null,
        idade_indicada: form.idade_indicada.trim() ? Number(form.idade_indicada) : null,
      };
      const { error } = form.id
        ? await supabase.from('classes_modelo').update(payload).eq('id', form.id)
        : await supabase.from('classes_modelo').insert({
            ...payload,
            ordem: itens.length + 1,
            ativo: true,
          });
      if (error) throw error;
      setModal(false);
      await carregar();
    } catch (e: any) {
      avisar('Erro ao salvar', e?.message ?? 'Não foi possível salvar a classe.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtiva(item: ClasseCatalogo) {
    try {
      const { error } = await supabase
        .from('classes_modelo')
        .update({ ativo: !item.ativo })
        .eq('id', item.id);
      if (error) throw error;
      await carregar();
    } catch (e: any) {
      avisar('Erro', e?.message ?? 'Não foi possível alterar a classe.');
    }
  }

  async function excluir(item: ClasseCatalogo) {
    const ok = await confirmar(
      'Excluir do catálogo',
      `Remover "${item.nome}"? O progresso já registrado dos membros continua preservado.`
    );
    if (!ok) return;
    try {
      const { error } = await supabase.from('classes_modelo').delete().eq('id', item.id);
      if (error) throw error;
      await carregar();
    } catch (e: any) {
      avisar('Erro ao excluir', e?.message ?? 'Não foi possível excluir a classe.');
    }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Catálogo de classes</Text>
          <Text style={s.headerSub}>{itens.length} cadastrada(s)</Text>
        </View>
        {podeGerenciar && (
          <TouchableOpacity onPress={() => { setForm(FORM_VAZIO); setModal(true); }} style={s.novoBtn}>
            <Ionicons name="add" size={18} color="#1a3a5c" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.explicacao}>
        Estas são as classes que aparecem ao vincular uma atividade. Os requisitos
        detalhados de cada classe ficam no menu Classes.
      </Text>

      {!podeGerenciar && (
        <Text style={s.somenteLeitura}>
          Só o Admin TI pode alterar o catálogo — ele é compartilhado por todos os clubes do programa.
        </Text>
      )}

      <View style={s.buscaBox}>
        <Ionicons name="search" size={18} color="#8a94a0" />
        <TextInput
          style={s.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar classe ou tipo..."
          placeholderTextColor="#aaa"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={s.erro}>{erro}</Text>}
        {!carregando && !erro && grupos.length === 0 && <Text style={s.vazio}>Nenhuma classe encontrada.</Text>}

        {grupos.map((grupo) => {
          const aberto = !!busca.trim() || abertas.has(grupo.tipo);
          return (
            <View key={grupo.tipo}>
              <TouchableOpacity
                style={s.grupoHeader}
                activeOpacity={0.7}
                onPress={() => setAbertas((prev) => {
                  const novo = new Set(prev);
                  if (novo.has(grupo.tipo)) novo.delete(grupo.tipo);
                  else novo.add(grupo.tipo);
                  return novo;
                })}
              >
                <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={17} color="#1a3a5c" />
                <Text style={s.grupoTitulo}>{grupo.tipo}</Text>
                <View style={s.grupoContador}>
                  <Text style={s.grupoContadorText}>{grupo.itens.length}</Text>
                </View>
              </TouchableOpacity>

              {aberto && grupo.itens.map((item) => (
                <View key={item.id} style={[s.card, !item.ativo && s.cardInativo]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardNome, !item.ativo && s.textoInativo]}>{item.nome}</Text>
                    <Text style={s.cardSub}>
                      {item.idade_indicada ? `${item.idade_indicada} anos · ` : ''}
                      {item.ativo ? 'Ativa' : 'Desativada'}
                    </Text>
                  </View>
                  {podeGerenciar && (
                    <View style={s.acoes}>
                      <TouchableOpacity
                        style={s.acaoBtn}
                        onPress={() => {
                          setForm({
                            id: item.id,
                            nome: item.nome,
                            tipo: item.tipo ?? '',
                            idade_indicada: item.idade_indicada ? String(item.idade_indicada) : '',
                          });
                          setModal(true);
                        }}
                      >
                        <Ionicons name="create-outline" size={18} color="#1a3a5c" />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.acaoBtn} onPress={() => alternarAtiva(item)}>
                        <Ionicons
                          name={item.ativo ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={item.ativo ? '#b45309' : '#2e7d32'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.acaoBtn} onPress={() => excluir(item)}>
                        <Ionicons name="trash-outline" size={18} color="#c0392b" />
                      </TouchableOpacity>
                    </View>
                  )}
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
              <Text style={s.modalTitulo}>{form.id ? 'Editar classe' : 'Nova classe'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={22} color="#52606d" />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Nome *</Text>
            <TextInput
              style={s.input}
              value={form.nome}
              onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))}
              placeholder="Ex.: Amigo"
            />

            <Text style={s.label}>Tipo</Text>
            <TextInput
              style={s.input}
              value={form.tipo}
              onChangeText={(v) => setForm((f) => ({ ...f, tipo: v }))}
              placeholder="Ex.: Regular, Avançada, Liderança"
            />
            {tipos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {tipos.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.chip, form.tipo === t && s.chipAtivo]}
                    onPress={() => setForm((f) => ({ ...f, tipo: t }))}
                  >
                    <Text style={[s.chipText, form.tipo === t && s.chipTextAtivo]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={s.label}>Idade indicada</Text>
            <TextInput
              style={s.input}
              value={form.idade_indicada}
              onChangeText={(v) => setForm((f) => ({ ...f, idade_indicada: v.replace(/[^0-9]/g, '') }))}
              placeholder="Opcional"
              keyboardType="numeric"
            />

            <TouchableOpacity style={s.salvar} onPress={salvar} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={s.salvarText}>Salvar</Text>
                </>
              )}
            </TouchableOpacity>
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
  headerTitulo: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  novoBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  explicacao: { fontSize: 12, color: '#6b7684', paddingHorizontal: 20, paddingTop: 12, lineHeight: 17 },
  somenteLeitura: { fontSize: 12, color: '#8a94a0', textAlign: 'center', paddingHorizontal: 20, paddingTop: 8 },

  buscaBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#e4eaf1',
  },
  busca: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#222' },

  lista: { flex: 1, marginTop: 8 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },

  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 11, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e4eaf1',
  },
  grupoTitulo: { flex: 1, fontSize: 12, fontWeight: '800', color: '#1a3a5c', textTransform: 'uppercase' },
  grupoContador: {
    minWidth: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#eef3f8', alignItems: 'center',
  },
  grupoContadorText: { fontSize: 12, fontWeight: '800', color: '#1a3a5c' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 14,
    borderWidth: 1, borderColor: '#e4eaf1', padding: 12,
  },
  cardInativo: { backgroundColor: '#f7f8fa' },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f2933' },
  textoInativo: { color: '#9aa5b1', textDecorationLine: 'line-through' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
  acoes: { flexDirection: 'row', gap: 2 },
  acaoBtn: { padding: 7 },

  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCaixa: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, maxHeight: '90%',
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
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#eef3f8', marginRight: 7 },
  chipAtivo: { backgroundColor: '#1a3a5c' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#4a5866' },
  chipTextAtivo: { color: '#fff' },
  salvar: {
    marginTop: 20, backgroundColor: '#1a3a5c', borderRadius: 13, padding: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  salvarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

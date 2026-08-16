import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { usePermissoes } from '../../src/lib/permissoes';
import {
  agruparPorCategoria,
  carregarCatalogoEspecialidades,
  categoriasDoCatalogo,
  definirEspecialidadeAtiva,
  excluirEspecialidadeCatalogo,
  salvarEspecialidadeCatalogo,
  type EspecialidadeCatalogo,
} from '../../src/lib/especialidades';

/** Alert.alert não renderiza no react-native-web; no navegador usa window. */
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

const FORM_VAZIO = {
  id: null as string | null,
  nome: '', codigo: '', categoria: '', requisitos: '', pre_requisitos: '', observacoes: '',
};

export default function CatalogoEspecialidadesScreen() {
  const permissoes = usePermissoes();
  const podeGerenciar = permissoes.temPerfil(['admin_ti', 'admin_total']);

  const [itens, setItens] = useState<EspecialidadeCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  useFocusEffect(useCallback(() => { carregar(); }, []));

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await carregarCatalogoEspecialidades(true));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar o catálogo.');
    } finally {
      setCarregando(false);
    }
  }

  const categorias = useMemo(() => categoriasDoCatalogo(itens), [itens]);

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = termo
      ? itens.filter((i) =>
          i.nome.toLowerCase().includes(termo) || (i.categoria ?? '').toLowerCase().includes(termo))
      : itens;
    return agruparPorCategoria(filtrados);
  }, [itens, busca]);

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setModal(true);
  }

  function abrirEdicao(item: EspecialidadeCatalogo) {
    setForm({
      id: item.id,
      nome: item.nome,
      codigo: item.codigo ?? '',
      categoria: item.categoria ?? '',
      requisitos: item.requisitos ?? '',
      pre_requisitos: item.pre_requisitos ?? '',
      observacoes: item.observacoes ?? '',
    });
    setModal(true);
  }

  async function salvar() {
    if (!form.nome.trim()) { avisar('Atenção', 'Informe o nome da especialidade.'); return; }
    setSalvando(true);
    try {
      await salvarEspecialidadeCatalogo(form);
      setModal(false);
      await carregar();
    } catch (e: any) {
      avisar('Erro ao salvar', e?.message ?? 'Não foi possível salvar a especialidade.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtiva(item: EspecialidadeCatalogo) {
    try {
      await definirEspecialidadeAtiva(item.id, !item.ativo);
      await carregar();
    } catch (e: any) {
      avisar('Erro', e?.message ?? 'Não foi possível alterar a especialidade.');
    }
  }

  async function excluir(item: EspecialidadeCatalogo) {
    const ok = await confirmar(
      'Excluir do catálogo',
      `Remover "${item.nome}" do catálogo? Quem já conquistou continua com ela no histórico.`
    );
    if (!ok) return;
    try {
      await excluirEspecialidadeCatalogo(item.id);
      await carregar();
    } catch (e: any) {
      avisar('Erro ao excluir', e?.message ?? 'Não foi possível excluir a especialidade.');
    }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Catálogo de especialidades</Text>
          <Text style={s.headerSub}>{itens.length} cadastrada(s)</Text>
        </View>
        {podeGerenciar && (
          <TouchableOpacity onPress={abrirNovo} style={s.novoBtn}>
            <Ionicons name="add" size={18} color="#1a3a5c" />
          </TouchableOpacity>
        )}
      </View>

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
          placeholder="Buscar por nome ou categoria..."
          placeholderTextColor="#aaa"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={s.erro}>{erro}</Text>}
        {!carregando && !erro && grupos.length === 0 && <Text style={s.vazio}>Nenhuma especialidade encontrada.</Text>}

        {grupos.map((grupo) => (
          <View key={grupo.categoria}>
            <Text style={s.grupoTitulo}>{grupo.categoria}</Text>
            {grupo.itens.map((item) => (
              <View key={item.id} style={[s.card, !item.ativo && s.cardInativo]}>
                <View style={s.cardTopo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardNome, !item.ativo && s.textoInativo]}>{item.nome}</Text>
                    <Text style={s.cardSub}>
                      {item.codigo ? `${item.codigo} · ` : ''}{item.ativo ? 'Ativa' : 'Desativada'}
                    </Text>
                  </View>
                  {podeGerenciar && (
                    <View style={s.acoes}>
                      <TouchableOpacity onPress={() => abrirEdicao(item)} style={s.acaoBtn}>
                        <Ionicons name="create-outline" size={18} color="#1a3a5c" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => alternarAtiva(item)} style={s.acaoBtn}>
                        <Ionicons
                          name={item.ativo ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={item.ativo ? '#b45309' : '#2e7d32'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => excluir(item)} style={s.acaoBtn}>
                        <Ionicons name="trash-outline" size={18} color="#c0392b" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                {!!item.requisitos && (
                  <Text style={s.requisitosPreview} numberOfLines={3}>{item.requisitos}</Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={s.modalFundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalCaixa}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>{form.id ? 'Editar especialidade' : 'Nova especialidade'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={22} color="#52606d" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Nome *</Text>
              <TextInput
                style={s.input}
                value={form.nome}
                onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))}
                placeholder="Ex.: Nós e Amarras"
              />

              <Text style={s.label}>Categoria</Text>
              <TextInput
                style={s.input}
                value={form.categoria}
                onChangeText={(v) => setForm((f) => ({ ...f, categoria: v }))}
                placeholder="Ex.: Artes e Habilidades Manuais"
              />
              {categorias.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {categorias.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[s.chip, form.categoria === c && s.chipAtivo]}
                      onPress={() => setForm((f) => ({ ...f, categoria: c }))}
                    >
                      <Text style={[s.chipText, form.categoria === c && s.chipTextAtivo]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={s.label}>Código</Text>
              <TextInput
                style={s.input}
                value={form.codigo}
                onChangeText={(v) => setForm((f) => ({ ...f, codigo: v }))}
                placeholder="Opcional"
              />

              <Text style={s.label}>Pré-requisitos</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={form.pre_requisitos}
                onChangeText={(v) => setForm((f) => ({ ...f, pre_requisitos: v }))}
                placeholder="Opcional"
                multiline
              />

              <Text style={s.label}>Requisitos</Text>
              <TextInput
                style={[s.input, s.inputMultiGrande]}
                value={form.requisitos}
                onChangeText={(v) => setForm((f) => ({ ...f, requisitos: v }))}
                placeholder={'1. ...\n2. ...\n3. ...'}
                multiline
              />

              <Text style={s.label}>Observações</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={form.observacoes}
                onChangeText={(v) => setForm((f) => ({ ...f, observacoes: v }))}
                placeholder="Opcional"
                multiline
              />

              <TouchableOpacity style={s.salvar} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#fff" />
                    <Text style={s.salvarText}>Salvar</Text>
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
  headerTitulo: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  novoBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  somenteLeitura: {
    fontSize: 12, color: '#8a94a0', textAlign: 'center', paddingHorizontal: 20, paddingTop: 12,
  },

  buscaBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#e4eaf1',
  },
  busca: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#222' },

  lista: { flex: 1, marginTop: 8 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  grupoTitulo: {
    fontSize: 12, fontWeight: '800', color: '#52606d', textTransform: 'uppercase',
    marginHorizontal: 20, marginTop: 14, marginBottom: 2,
  },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 14,
    borderWidth: 1, borderColor: '#e4eaf1', padding: 12,
  },
  cardInativo: { backgroundColor: '#f7f8fa' },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f2933' },
  textoInativo: { color: '#9aa5b1', textDecorationLine: 'line-through' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
  acoes: { flexDirection: 'row', gap: 2 },
  acaoBtn: { padding: 7 },
  requisitosPreview: {
    fontSize: 12, color: '#6b7684', marginTop: 8, lineHeight: 17,
    backgroundColor: '#f8fafc', padding: 8, borderRadius: 8,
  },

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
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  inputMultiGrande: { minHeight: 130, textAlignVertical: 'top' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#eef3f8', marginRight: 7,
  },
  chipAtivo: { backgroundColor: '#1a3a5c' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#4a5866' },
  chipTextAtivo: { color: '#fff' },
  salvar: {
    marginTop: 20, backgroundColor: '#1a3a5c', borderRadius: 13, padding: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  salvarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

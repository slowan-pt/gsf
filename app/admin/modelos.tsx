import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { DateField } from '../../src/components/DateField';
import { carregarDocumentosPaisConfig } from '../../src/lib/documentosPaisConfig';
import { BottomNav } from '../../src/components/BottomNav';

interface PontuacaoItem {
  id: number;
  titulo: string;
  sigla: string;
  valor: number;
  ordem: number;
  ativo: boolean;
}

interface DocumentoItem {
  id: number;
  campo: string;
  nome: string;
  obrigatorio: boolean;
  permite_anexo: boolean;
  limite_anexos: number;
  ordem: number;
  ativo: boolean;
}

type Aba = 'pontuacao' | 'documentos';

const PONTUACAO_VAZIA = { titulo: '', sigla: '', valor: '0' };
const DOCUMENTO_VAZIO = { nome: '', campo: '', limite_anexos: '1', obrigatorio: true };
const PAIS_CONFIG_VAZIO = { pais_podem_editar: false, editar_de: '', editar_ate: '' };

function slugCampo(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 42);
}

function confirmar(titulo: string, msg: string) {
  if (typeof window !== 'undefined') return Promise.resolve(window.confirm(`${titulo}\n\n${msg}`));
  return new Promise<boolean>((resolve) => {
    Alert.alert(titulo, msg, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Excluir', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function ModelosAdminScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const [aba, setAba] = useState<Aba>('pontuacao');
  const [loading, setLoading] = useState(false);
  const [pontuacoes, setPontuacoes] = useState<PontuacaoItem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoItem[]>([]);
  const [modalPont, setModalPont] = useState<PontuacaoItem | null | 'novo'>(null);
  const [modalDoc, setModalDoc] = useState<DocumentoItem | null | 'novo'>(null);
  const [formPont, setFormPont] = useState(PONTUACAO_VAZIA);
  const [formDoc, setFormDoc] = useState(DOCUMENTO_VAZIO);
  const [paisConfig, setPaisConfig] = useState(PAIS_CONFIG_VAZIO);

  const podeGerenciar = permissoes.podeAlguma(['admin_clube', 'gerenciar_pontuacao', 'gerenciar_documentos']);
  const clubeId = getClubeAtivoId();
  const programaId = getProgramaAtivoId();

  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  async function carregar() {
    setLoading(true);
    try {
      const [{ data: pts, error: erroPts }, { data: docs, error: erroDocs }, cfgPais] = await Promise.all([
        supabase
          .from('pontuacao_itens')
          .select('id,titulo,sigla,valor,ordem,ativo')
          .eq('clube_id', clubeId)
          .order('ordem'),
        supabase
          .from('documentos_modelo')
          .select('id,campo,nome,obrigatorio,permite_anexo,limite_anexos,ordem,ativo')
          .eq('clube_id', clubeId)
          .order('ordem'),
        carregarDocumentosPaisConfig(clubeId),
      ]);
      if (erroPts) throw erroPts;
      if (erroDocs) throw erroDocs;
      setPontuacoes((pts ?? []) as PontuacaoItem[]);
      setDocumentos((docs ?? []) as DocumentoItem[]);
      setPaisConfig({
        pais_podem_editar: cfgPais.pais_podem_editar,
        editar_de: cfgPais.editar_de ?? '',
        editar_ate: cfgPais.editar_ate ?? '',
      });
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível carregar os modelos.');
    } finally {
      setLoading(false);
    }
  }

  const totalAtivos = useMemo(() => ({
    pontuacao: pontuacoes.filter((p) => p.ativo).length,
    documentos: documentos.filter((d) => d.ativo).length,
  }), [pontuacoes, documentos]);

  function abrirPont(item?: PontuacaoItem) {
    if (item) {
      setModalPont(item);
      setFormPont({ titulo: item.titulo, sigla: item.sigla, valor: String(item.valor) });
    } else {
      setModalPont('novo');
      setFormPont(PONTUACAO_VAZIA);
    }
  }

  function abrirDoc(item?: DocumentoItem) {
    if (item) {
      setModalDoc(item);
      setFormDoc({
        nome: item.nome,
        campo: item.campo,
        limite_anexos: String(item.limite_anexos ?? 1),
        obrigatorio: !!item.obrigatorio,
      });
    } else {
      setModalDoc('novo');
      setFormDoc(DOCUMENTO_VAZIO);
    }
  }

  async function salvarPontuacao() {
    const titulo = formPont.titulo.trim();
    const sigla = formPont.sigla.trim().toUpperCase().slice(0, 6);
    const valor = Number(formPont.valor) || 0;
    if (!titulo || !sigla) return Alert.alert('Atenção', 'Informe título e sigla.');
    try {
      const base = {
        clube_id: clubeId,
        programa_id: programaId,
        titulo,
        sigla,
        valor,
        ativo: true,
        updated_at: new Date().toISOString(),
      };
      if (modalPont && modalPont !== 'novo') {
        const { error } = await supabase.from('pontuacao_itens').update(base).eq('id', modalPont.id);
        if (error) throw error;
      } else {
        const ordem = (pontuacoes[pontuacoes.length - 1]?.ordem ?? 0) + 1;
        const { error } = await supabase.from('pontuacao_itens').insert({ ...base, ordem, padrao: false });
        if (error) throw error;
      }
      setModalPont(null);
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a pontuação.');
    }
  }

  async function salvarDocumento() {
    const nome = formDoc.nome.trim();
    const campo = (formDoc.campo.trim() || slugCampo(nome)).slice(0, 50);
    if (!nome || !campo) return Alert.alert('Atenção', 'Informe nome e campo.');
    try {
      const base = {
        clube_id: clubeId,
        programa_id: programaId,
        nome,
        campo,
        obrigatorio: formDoc.obrigatorio,
        permite_anexo: true,
        limite_anexos: Math.max(1, Number(formDoc.limite_anexos) || 1),
        ativo: true,
      };
      if (modalDoc && modalDoc !== 'novo') {
        const { error } = await supabase.from('documentos_modelo').update(base).eq('id', modalDoc.id);
        if (error) throw error;
      } else {
        const ordem = (documentos[documentos.length - 1]?.ordem ?? 0) + 1;
        const { error } = await supabase.from('documentos_modelo').insert({ ...base, ordem });
        if (error) throw error;
      }
      setModalDoc(null);
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar o documento.');
    }
  }

  async function salvarPaisConfig() {
    try {
      const { error } = await supabase
        .from('documentos_pais_config')
        .upsert({
          clube_id: clubeId,
          pais_podem_editar: paisConfig.pais_podem_editar,
          editar_de: paisConfig.editar_de || null,
          editar_ate: paisConfig.editar_ate || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clube_id' });
      if (error) throw error;
      Alert.alert('Salvo', 'Janela de edição dos responsáveis atualizada.');
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a janela de edição dos responsáveis.');
    }
  }

  async function excluirPontuacao(item: PontuacaoItem) {
    const ok = await confirmar('Excluir pontuação', `Remover "${item.titulo}" da grade de pontuação?`);
    if (!ok) return;
    const { error } = await supabase.from('pontuacao_itens').update({ ativo: false }).eq('id', item.id);
    if (error) return Alert.alert('Erro', error.message);
    await carregar();
  }

  async function excluirDocumento(item: DocumentoItem) {
    const ok = await confirmar('Excluir documento', `Remover "${item.nome}" da lista de documentos?`);
    if (!ok) return;
    const { error } = await supabase.from('documentos_modelo').update({ ativo: false }).eq('id', item.id);
    if (error) return Alert.alert('Erro', error.message);
    await carregar();
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Modelos do Clube</Text>
          <Text style={s.sub}>{contextoAtivo?.clube_nome_curto ?? contextoAtivo?.clube_nome ?? 'Clube ativo'}</Text>
        </View>
        <TouchableOpacity onPress={carregar} style={s.iconBtn}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, aba === 'pontuacao' && s.tabAtiva]} onPress={() => setAba('pontuacao')}>
          <Text style={[s.tabText, aba === 'pontuacao' && s.tabTextAtivo]}>Pontuação ({totalAtivos.pontuacao})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, aba === 'documentos' && s.tabAtiva]} onPress={() => setAba('documentos')}>
          <Text style={[s.tabText, aba === 'documentos' && s.tabTextAtivo]}>Documentos ({totalAtivos.documentos})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {aba === 'pontuacao' ? (
            <>
              <TouchableOpacity style={s.add} onPress={() => abrirPont()}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={s.addText}>Nova pontuação</Text>
              </TouchableOpacity>
              {pontuacoes.map((p) => (
                <View key={p.id} style={[s.card, !p.ativo && s.inativo]}>
                  <View style={s.sigla}><Text style={s.siglaText}>{p.sigla}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{p.titulo}</Text>
                    <Text style={s.cardSub}>{p.valor} ponto(s) • ordem {p.ordem}</Text>
                  </View>
                  <TouchableOpacity style={s.smallBtn} onPress={() => abrirPont(p)}>
                    <Ionicons name="pencil" size={18} color="#1a3a5c" />
                  </TouchableOpacity>
                  {p.ativo && (
                    <TouchableOpacity style={s.smallBtn} onPress={() => excluirPontuacao(p)}>
                      <Ionicons name="trash-outline" size={18} color="#c62828" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={s.configCard}>
                <View style={s.configHeader}>
                  <View style={s.docIcon}><Ionicons name="people" size={20} color="#1a3a5c" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>Edição pelos responsáveis</Text>
                    <Text style={s.cardSub}>Permite que pais editem documentos dos filhos dentro de uma janela definida.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={s.checkRow}
                  onPress={() => setPaisConfig((c) => ({ ...c, pais_podem_editar: !c.pais_podem_editar }))}
                >
                  <Ionicons name={paisConfig.pais_podem_editar ? 'checkbox' : 'square-outline'} size={22} color="#1a3a5c" />
                  <Text style={s.checkText}>Pais podem anexar/remover documentos dos filhos</Text>
                </TouchableOpacity>
                <View style={s.dateGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Início</Text>
                    <DateField
                      value={paisConfig.editar_de}
                      onChange={(v) => setPaisConfig((c) => ({ ...c, editar_de: v }))}
                      placeholder="Sem início"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Fim</Text>
                    <DateField
                      value={paisConfig.editar_ate}
                      onChange={(v) => setPaisConfig((c) => ({ ...c, editar_ate: v }))}
                      placeholder="Sem fim"
                    />
                  </View>
                </View>
                <TouchableOpacity style={s.secondarySave} onPress={salvarPaisConfig}>
                  <Ionicons name="save-outline" size={18} color="#1a3a5c" />
                  <Text style={s.secondarySaveText}>Salvar janela dos pais</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.add} onPress={() => abrirDoc()}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={s.addText}>Novo documento</Text>
              </TouchableOpacity>
              {documentos.map((d) => (
                <View key={d.id} style={[s.card, !d.ativo && s.inativo]}>
                  <View style={s.docIcon}><Ionicons name="document-attach" size={20} color="#1a3a5c" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{d.nome}</Text>
                    <Text style={s.cardSub}>{d.campo} • {d.obrigatorio ? 'obrigatório' : 'opcional'} • {d.limite_anexos} anexo(s)</Text>
                  </View>
                  <TouchableOpacity style={s.smallBtn} onPress={() => abrirDoc(d)}>
                    <Ionicons name="pencil" size={18} color="#1a3a5c" />
                  </TouchableOpacity>
                  {d.ativo && (
                    <TouchableOpacity style={s.smallBtn} onPress={() => excluirDocumento(d)}>
                      <Ionicons name="trash-outline" size={18} color="#c62828" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={!!modalPont} transparent animationType="slide" onRequestClose={() => setModalPont(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.modalTitle}>{modalPont === 'novo' ? 'Nova pontuação' : 'Editar pontuação'}</Text>
            <Text style={s.label}>Título</Text>
            <TextInput style={s.input} value={formPont.titulo} onChangeText={(v) => setFormPont((f) => ({ ...f, titulo: v }))} />
            <Text style={s.label}>Sigla</Text>
            <TextInput style={s.input} value={formPont.sigla} autoCapitalize="characters" onChangeText={(v) => setFormPont((f) => ({ ...f, sigla: v }))} />
            <Text style={s.label}>Valor</Text>
            <TextInput style={s.input} value={formPont.valor} keyboardType="numeric" onChangeText={(v) => setFormPont((f) => ({ ...f, valor: v }))} />
            <TouchableOpacity style={s.save} onPress={salvarPontuacao}><Text style={s.saveText}>Salvar</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancel} onPress={() => setModalPont(null)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!modalDoc} transparent animationType="slide" onRequestClose={() => setModalDoc(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.modalTitle}>{modalDoc === 'novo' ? 'Novo documento' : 'Editar documento'}</Text>
            <Text style={s.label}>Nome</Text>
            <TextInput style={s.input} value={formDoc.nome} onChangeText={(v) => setFormDoc((f) => ({ ...f, nome: v, campo: f.campo || slugCampo(v) }))} />
            <Text style={s.label}>Campo técnico</Text>
            <TextInput style={s.input} value={formDoc.campo} onChangeText={(v) => setFormDoc((f) => ({ ...f, campo: slugCampo(v) }))} />
            <Text style={s.label}>Limite de anexos</Text>
            <TextInput style={s.input} value={formDoc.limite_anexos} keyboardType="numeric" onChangeText={(v) => setFormDoc((f) => ({ ...f, limite_anexos: v }))} />
            <TouchableOpacity style={s.checkRow} onPress={() => setFormDoc((f) => ({ ...f, obrigatorio: !f.obrigatorio }))}>
              <Ionicons name={formDoc.obrigatorio ? 'checkbox' : 'square-outline'} size={22} color="#1a3a5c" />
              <Text style={s.checkText}>Documento obrigatório</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.save} onPress={salvarDocumento}><Text style={s.saveText}>Salvar</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancel} onPress={() => setModalDoc(null)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 54, paddingHorizontal: 22, paddingBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  sub: { color: '#bdd2e6', fontSize: 14, marginTop: 2 },
  tabs: { flexDirection: 'row', margin: 16, backgroundColor: '#dfe8f0', borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 11 },
  tabAtiva: { backgroundColor: '#fff' },
  tabText: { color: '#607d8b', fontWeight: '700' },
  tabTextAtivo: { color: '#1a3a5c' },
  content: { padding: 16, paddingBottom: 40 },
  add: { backgroundColor: '#1a3a5c', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
  addText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#dde6ee' },
  configCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#dbe6ef', gap: 10 },
  configHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inativo: { opacity: 0.48 },
  sigla: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  siglaText: { color: '#1a3a5c', fontWeight: '900' },
  docIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#eef5f9', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1f2933' },
  cardSub: { color: '#78909c', marginTop: 3 },
  smallBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f3f7fa', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, gap: 8 },
  modalTitle: { color: '#1a3a5c', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  label: { color: '#546e7a', fontWeight: '800', textTransform: 'uppercase', fontSize: 12, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d7e0e8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1f2933' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  checkText: { color: '#1f2933', fontWeight: '700' },
  dateGrid: { flexDirection: 'row', gap: 10 },
  secondarySave: { borderWidth: 1, borderColor: '#bfd0de', backgroundColor: '#f3f8fc', borderRadius: 14, padding: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondarySaveText: { color: '#1a3a5c', fontWeight: '900', fontSize: 15 },
  save: { backgroundColor: '#1a3a5c', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 10 },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cancel: { padding: 14, alignItems: 'center' },
  cancelText: { color: '#78909c', fontWeight: '800' },
});

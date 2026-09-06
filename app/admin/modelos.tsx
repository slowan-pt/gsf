import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { BottomNav } from '../../src/components/BottomNav';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import { avisar, useAvisoStore } from '../../src/stores/avisoStore';

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

type Aba = 'pontuacao' | 'documentos' | 'config';

const PONTUACAO_VAZIA = { titulo: '', sigla: '', valor: '0' };
const DOCUMENTO_VAZIO = { nome: '', campo: '', limite_anexos: '1', obrigatorio: true };

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
  return new Promise<boolean>((resolve) => {
    useAvisoStore.getState().mostrar({
      titulo,
      mensagem: msg,
      tipo: 'erro',
      botoes: [
        { texto: 'Cancelar', estilo: 'cancelar', onPress: () => resolve(false) },
        { texto: 'Excluir', estilo: 'padrao', onPress: () => resolve(true) },
      ],
    });
  });
}

export default function ModelosAdminScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const [aba, setAba] = useState<Aba>('pontuacao');
  const [abaDropdownAberto, setAbaDropdownAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pontuacoes, setPontuacoes] = useState<PontuacaoItem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoItem[]>([]);
  const [modalPont, setModalPont] = useState<PontuacaoItem | null | 'novo'>(null);
  const [modalDoc, setModalDoc] = useState<DocumentoItem | null | 'novo'>(null);
  const [formPont, setFormPont] = useState(PONTUACAO_VAZIA);
  const [formDoc, setFormDoc] = useState(DOCUMENTO_VAZIO);
  const [minFaltas, setMinFaltas] = useState('3');

  const podeGerenciar = permissoes.podeAlguma(['admin_clube', 'gerenciar_pontuacao', 'gerenciar_documentos']);
  const clubeId = getClubeAtivoId();
  const programaId = getProgramaAtivoId();

  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  async function carregar() {
    setLoading(true);
    try {
      const [{ data: pts, error: erroPts }, { data: docs, error: erroDocs }, { data: cfgClube }] = await Promise.all([
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
        supabase.from('clubes').select('min_faltas_faltosos').eq('id', clubeId).single(),
      ]);
      if (erroPts) throw erroPts;
      if (erroDocs) throw erroDocs;
      if (cfgClube) setMinFaltas(String((cfgClube as any).min_faltas_faltosos ?? 3));
      setPontuacoes((pts ?? []) as PontuacaoItem[]);
      setDocumentos((docs ?? []) as DocumentoItem[]);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar os modelos.', 'erro');
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
    if (!titulo || !sigla) return avisar('Informe título e sigla.', 'info', 'Atenção');
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
      avisar(e?.message ?? 'Não foi possível salvar a pontuação.', 'erro');
    }
  }

  async function salvarDocumento() {
    const nome = formDoc.nome.trim();
    const campo = (formDoc.campo.trim() || slugCampo(nome)).slice(0, 50);
    if (!nome || !campo) return avisar('Informe nome e campo.', 'info', 'Atenção');
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
      avisar(e?.message ?? 'Não foi possível salvar o documento.', 'erro');
    }
  }

  async function salvarConfig() {
    const valor = Math.max(1, Math.min(30, Number(minFaltas) || 3));
    try {
      const { error } = await supabase.from('clubes').update({ min_faltas_faltosos: valor }).eq('id', clubeId);
      if (error) throw error;
      setMinFaltas(String(valor));
      const msg = `Membros com ${valor} ou mais reuniões consecutivas sem presença serão exibidos na aba Faltosos.`;
      useAvisoStore.getState().mostrar({
        titulo: 'Configuração salva',
        mensagem: msg,
        tipo: 'sucesso',
        botoes: [
          { texto: 'Ver Faltosos', estilo: 'padrao', onPress: () => router.replace({ pathname: '/', params: { abaFaltosos: '1' } } as any) },
        ],
      });
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar.', 'erro');
    }
  }

  async function excluirPontuacao(item: PontuacaoItem) {
    const ok = await confirmar('Excluir pontuação', `Remover "${item.titulo}" da grade de pontuação?`);
    if (!ok) return;
    const { error } = await supabase.from('pontuacao_itens').update({ ativo: false }).eq('id', item.id);
    if (error) return avisar(error.message, 'erro');
    await carregar();
  }

  function extrairPathDocumentoStorage(valor?: string | null) {
    if (!valor) return null;
    const raw = String(valor);
    if (!raw.startsWith('http')) {
      return raw.startsWith('blob:') || raw.startsWith('file:') ? null : raw.replace(/^\/+/, '');
    }
    const marcador = '/storage/v1/object/';
    const idx = raw.indexOf(marcador);
    if (idx < 0 || !raw.includes('/documentos_fotos/')) return null;
    const aposObject = raw.slice(idx + marcador.length);
    const partes = aposObject.split('?')[0].split('/');
    const bucketIndex = partes.findIndex((p) => p === 'documentos_fotos');
    if (bucketIndex < 0) return null;
    return decodeURIComponent(partes.slice(bucketIndex + 1).join('/'));
  }

  async function excluirDocumento(item: DocumentoItem) {
    try {
      const [{ data: imagens, error: erroImagens }, { data: statusRows, error: erroStatus }] = await Promise.all([
        supabase.from('documento_imagens').select('id,dbv_id,url').eq('clube_id', clubeId).eq('campo', item.campo),
        supabase.from('documento_status').select('dbv_id').eq('clube_id', clubeId).eq('campo', item.campo),
      ]);
      if (erroImagens) throw erroImagens;
      if (erroStatus) throw erroStatus;

      const dbvIdsAfetados = [...new Set([
        ...((imagens ?? []).map((i: any) => Number(i.dbv_id))),
        ...((statusRows ?? []).map((s: any) => Number(s.dbv_id))),
      ])];

      let mensagem = `Remover "${item.nome}" da lista de documentos? O modelo será apagado definitivamente.`;
      if (dbvIdsAfetados.length) {
        const { data: membros } = await supabase
          .from('desbravadores')
          .select('id,nome')
          .eq('clube_id', clubeId)
          .in('id', dbvIdsAfetados);
        const nomes = (membros ?? []).map((m: any) => m.nome);
        const listaNomes = nomes.length <= 6
          ? nomes.join(', ')
          : `${nomes.slice(0, 6).join(', ')} e mais ${nomes.length - 6}`;
        const qtdAnexos = (imagens ?? []).length;
        mensagem = `"${item.nome}" já tem envios salvos de ${dbvIdsAfetados.length} membro(s): ${listaNomes}.\n\n`
          + `Excluir este modelo vai apagar definitivamente ${qtdAnexos} anexo(s) enviado(s) e o status registrado para esses membros. Esta ação não pode ser desfeita.`;
      }

      const ok = await confirmar('Excluir documento', mensagem);
      if (!ok) return;

      for (const img of (imagens ?? []) as Array<{ url: string }>) {
        const path = extrairPathDocumentoStorage(img.url);
        if (path) await supabase.storage.from('documentos_fotos').remove([path]).catch(() => null);
      }
      if (imagens?.length) {
        const { error } = await supabase.from('documento_imagens').delete().eq('clube_id', clubeId).eq('campo', item.campo);
        if (error) throw error;
      }
      if (statusRows?.length) {
        const { error } = await supabase.from('documento_status').delete().eq('clube_id', clubeId).eq('campo', item.campo);
        if (error) throw error;
      }
      const { error } = await supabase.from('documentos_modelo').delete().eq('id', item.id);
      if (error) throw error;
      await carregar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível excluir o documento.', 'erro');
    }
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
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

      <View style={s.abaSelectWrap}>
        <TouchableOpacity style={s.abaSelectBtn} onPress={() => setAbaDropdownAberto(true)}>
          <Ionicons
            name={
              aba === 'pontuacao' ? 'checkmark-circle-outline'
              : aba === 'documentos' ? 'document-text-outline'
              : 'calendar-outline'
            }
            size={17}
            color="#1a3a5c"
          />
          <Text style={s.abaSelectText}>
            {aba === 'pontuacao' ? `Pontuação (${totalAtivos.pontuacao})`
              : aba === 'documentos' ? `Documentos (${totalAtivos.documentos})`
              : 'Faltas'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#1a3a5c" />
        </TouchableOpacity>
      </View>

      <Modal visible={abaDropdownAberto} transparent animationType="fade" onRequestClose={() => setAbaDropdownAberto(false)}>
        <TouchableOpacity style={s.dropdownOverlay} activeOpacity={1} onPress={() => setAbaDropdownAberto(false)}>
          <View style={s.dropdownMenu}>
            <TouchableOpacity
              style={[s.dropdownItem, aba === 'pontuacao' && s.dropdownItemAtivo]}
              onPress={() => { setAba('pontuacao'); setAbaDropdownAberto(false); }}
            >
              <Ionicons name="checkmark-circle-outline" size={17} color={aba === 'pontuacao' ? '#1a3a5c' : '#607d8b'} />
              <Text style={[s.dropdownItemText, aba === 'pontuacao' && s.dropdownItemTextAtivo]}>Pontuação ({totalAtivos.pontuacao})</Text>
              {aba === 'pontuacao' && <Ionicons name="checkmark" size={16} color="#1a3a5c" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dropdownItem, aba === 'documentos' && s.dropdownItemAtivo]}
              onPress={() => { setAba('documentos'); setAbaDropdownAberto(false); }}
            >
              <Ionicons name="document-text-outline" size={17} color={aba === 'documentos' ? '#1a3a5c' : '#607d8b'} />
              <Text style={[s.dropdownItemText, aba === 'documentos' && s.dropdownItemTextAtivo]}>Documentos ({totalAtivos.documentos})</Text>
              {aba === 'documentos' && <Ionicons name="checkmark" size={16} color="#1a3a5c" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dropdownItem, aba === 'config' && s.dropdownItemAtivo]}
              onPress={() => { setAba('config'); setAbaDropdownAberto(false); }}
            >
              <Ionicons name="calendar-outline" size={17} color={aba === 'config' ? '#1a3a5c' : '#607d8b'} />
              <Text style={[s.dropdownItemText, aba === 'config' && s.dropdownItemTextAtivo]}>Faltas</Text>
              {aba === 'config' && <Ionicons name="checkmark" size={16} color="#1a3a5c" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.dropdownItem}
              onPress={() => { setAbaDropdownAberto(false); router.push('/admin/formativos' as any); }}
            >
              <Ionicons name="school-outline" size={17} color="#607d8b" />
              <Text style={s.dropdownItemText}>Formativos</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
          ) : aba === 'documentos' ? (
            <>
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
          ) : aba === 'config' ? (
            <View style={s.configCard}>
              <View style={s.configHeader}>
                <View style={s.docIcon}><Ionicons name="alert-circle" size={20} color="#1a3a5c" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Aba "Faltosos"</Text>
                  <Text style={s.cardSub}>Mínimo de reuniões consecutivas sem presença para o membro aparecer na aba Faltosos do dashboard.</Text>
                </View>
              </View>
              <Text style={s.label}>Reuniões consecutivas</Text>
              <TextInput
                style={s.input}
                value={minFaltas}
                keyboardType="numeric"
                onChangeText={(v) => setMinFaltas(v.replace(/[^0-9]/g, ''))}
              />
              <TouchableOpacity style={s.secondarySave} onPress={salvarConfig}>
                <Ionicons name="save-outline" size={18} color="#1a3a5c" />
                <Text style={s.secondarySaveText}>Salvar limiar de faltas</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={!!modalPont} transparent animationType="slide" onRequestClose={() => setModalPont(null)}>
        {/* Dentro de um Modal nativo o Android não encolhe a janela sozinho
            (adjustResize só vale pra tela principal) — sem behavior="height"
            aqui, o teclado cobria metade da folha sem nenhum ajuste. */}
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            <Text style={s.modalTitle}>{modalPont === 'novo' ? 'Nova pontuação' : 'Editar pontuação'}</Text>
            <Text style={s.label}>Título</Text>
            <TextInput style={s.input} value={formPont.titulo} onChangeText={(v) => setFormPont((f) => ({ ...f, titulo: v }))} />
            <Text style={s.label}>Sigla</Text>
            <TextInput style={s.input} value={formPont.sigla} autoCapitalize="characters" onChangeText={(v) => setFormPont((f) => ({ ...f, sigla: v }))} />
            <Text style={s.label}>Valor</Text>
            <TextInput style={s.input} value={formPont.valor} keyboardType="numeric" onChangeText={(v) => setFormPont((f) => ({ ...f, valor: v }))} />
            <TouchableOpacity style={s.save} onPress={salvarPontuacao}><Text style={s.saveText}>Salvar</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancel} onPress={() => setModalPont(null)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!modalDoc} transparent animationType="slide" onRequestClose={() => setModalDoc(null)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
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
          </ScrollView>
        </KeyboardAvoidingView>
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
  abaSelectWrap: { marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  abaSelectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#dbe4ec',
    paddingVertical: 12, paddingHorizontal: 14, elevation: 2,
  },
  abaSelectText: { flex: 1, color: '#1a3a5c', fontWeight: '800', fontSize: 14 },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(10,20,35,0.35)', paddingTop: 150, paddingHorizontal: 16 },
  dropdownMenu: {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 6,
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  dropdownItemAtivo: { backgroundColor: '#eef5fb' },
  dropdownItemText: { flex: 1, color: '#607d8b', fontWeight: '700', fontSize: 14 },
  dropdownItemTextAtivo: { color: '#1a3a5c' },
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

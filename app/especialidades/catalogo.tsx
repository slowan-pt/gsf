import { EstadoVazio, CampoBusca, Chip } from '../../src/components/ui';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { usePermissoes } from '../../src/lib/permissoes';
import { combinaBusca } from '../../src/lib/texto';
import {
  agruparPorCategoria,
  carregarCatalogoEspecialidades,
  categoriasDoCatalogo,
  definirEspecialidadeAtiva,
  enviarInsigniaEspecialidade,
  excluirEspecialidadeCatalogo,
  salvarEspecialidadeCatalogo,
  subcategoriasDoCatalogo,
  type EspecialidadeCatalogo,
} from '../../src/lib/especialidades';
import { avisar as avisarPadrao, confirmar } from '../../src/stores/avisoStore';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, tomTexto } from '../../src/lib/tema';
import { CabecalhoTela, BotaoCabecalho } from '../../src/components/CabecalhoTela';

/** Mantém a assinatura antiga (titulo, mensagem) usada nesta tela. */
function avisar(titulo: string, mensagem: string) {
  avisarPadrao(mensagem, 'erro', titulo);
}

function linhasRequisitos(texto?: string | null): string[] {
  return (texto ?? '')
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
}

const FORM_VAZIO = {
  id: null as string | null,
  nome: '', codigo: '', categoria: '', subcategoria: '', requisitos: '', pre_requisitos: '', observacoes: '',
  insignia_url: '',
};

export default function CatalogoEspecialidadesScreen() {
  const cores = useCores();
  const corCabecalho = useCorCabecalho();
  const permissoes = usePermissoes();
  const podeGerenciar = permissoes.temPerfil(['admin_ti', 'admin_total']);

  const [itens, setItens] = useState<EspecialidadeCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [abertasSub, setAbertasSub] = useState<Set<string>>(new Set());
  const [enviandoInsignia, setEnviandoInsignia] = useState(false);

  useFocusEffect(useCallback(() => { carregar(false); }, []));

  // Abrir a tela usa o cache (até 10 min); só recarrega do servidor depois de uma edição.
  async function carregar(forcar = false) {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await carregarCatalogoEspecialidades(true, forcar));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar o catálogo.');
    } finally {
      setCarregando(false);
    }
  }

  const categorias = useMemo(() => categoriasDoCatalogo(itens), [itens]);
  const subcategoriasDaCategoria = useMemo(
    () => (form.categoria.trim() ? subcategoriasDoCatalogo(itens, form.categoria) : []),
    [itens, form.categoria]
  );
  /** Para marcar pré-requisitos: todas as especialidades ativas, menos a que está sendo editada. */
  const especialidadesParaPreRequisito = useMemo(
    () => itens
      .filter((i) => i.ativo && i.id !== form.id && i.nome.trim())
      .map((i) => i.nome)
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [itens, form.id]
  );
  const preRequisitosSelecionados = useMemo(
    () => new Set(form.pre_requisitos.split(',').map((n) => n.trim()).filter(Boolean)),
    [form.pre_requisitos]
  );

  function alternarPreRequisito(nome: string) {
    setForm((f) => {
      const atuais = f.pre_requisitos.split(',').map((n) => n.trim()).filter(Boolean);
      const novo = atuais.includes(nome) ? atuais.filter((n) => n !== nome) : [...atuais, nome];
      return { ...f, pre_requisitos: novo.join(', ') };
    });
  }

  const grupos = useMemo(() => {
    const termo = busca.trim();
    const filtrados = termo
      ? itens.filter((i) =>
          combinaBusca(i.nome, termo)
          || combinaBusca(i.categoria, termo)
          || combinaBusca(i.subcategoria, termo))
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
      subcategoria: item.subcategoria ?? '',
      requisitos: item.requisitos ?? '',
      pre_requisitos: item.pre_requisitos ?? '',
      observacoes: item.observacoes ?? '',
      insignia_url: item.insignia_url ?? '',
    });
    setModal(true);
  }

  /** Escolhe e envia a imagem da insígnia. */
  async function escolherInsignia() {
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        avisar('Permissão necessária', 'Libere o acesso às imagens para enviar a insígnia.');
        return;
      }
      const escolha = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (escolha.canceled || !escolha.assets?.[0]) return;

      setEnviandoInsignia(true);
      const asset = escolha.assets[0];
      const resposta = await fetch(asset.uri);
      if (!resposta.ok) throw new Error('Não foi possível ler a imagem selecionada.');
      const blob = await resposta.blob();
      const url = await enviarInsigniaEspecialidade(blob);
      setForm((f) => ({ ...f, insignia_url: url }));
    } catch (e: any) {
      avisar('Erro ao enviar', e?.message ?? 'Não foi possível enviar a imagem.');
    } finally {
      setEnviandoInsignia(false);
    }
  }

  async function salvar() {
    if (!form.nome.trim()) { avisar('Atenção', 'Informe o nome da especialidade.'); return; }
    setSalvando(true);
    try {
      await salvarEspecialidadeCatalogo(form);
      setModal(false);
      await carregar(true);
    } catch (e: any) {
      avisar('Erro ao salvar', e?.message ?? 'Não foi possível salvar a especialidade.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtiva(item: EspecialidadeCatalogo) {
    try {
      await definirEspecialidadeAtiva(item.id, !item.ativo);
      await carregar(true);
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
      await carregar(true);
    } catch (e: any) {
      avisar('Erro ao excluir', e?.message ?? 'Não foi possível excluir a especialidade.');
    }
  }

  function renderItemCard(item: EspecialidadeCatalogo) {
    return (
      <View key={item.id} style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }, !item.ativo && { backgroundColor: cores.fundo }]}>
        <View style={s.cardTopo}>
          {!!item.insignia_url && (
            <Image source={{ uri: item.insignia_url }} style={s.insigniaLista} resizeMode="contain" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[s.cardNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }, !item.ativo && [s.textoInativo, cores.isEscuro && { color: '#c6ccd4' }]]}>{item.nome}</Text>
            <Text style={[s.cardSub, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>
              {item.codigo ? `${item.codigo} · ` : ''}{item.ativo ? 'Ativa' : 'Desativada'}
            </Text>
          </View>
          {podeGerenciar && (
            <View style={s.acoes}>
              <TouchableOpacity onPress={() => abrirEdicao(item)} style={s.acaoBtn}>
                <Ionicons name="create-outline" size={18} color={corIcone(cores)} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => alternarAtiva(item)} style={s.acaoBtn}>
                <Ionicons
                  name={item.ativo ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={item.ativo ? tomTexto('#b45309', cores) : tomTexto('#2e7d32', cores)}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => excluir(item)} style={s.acaoBtn}>
                <Ionicons name="trash-outline" size={18} color={tomTexto('#c0392b', cores)} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {linhasRequisitos(item.requisitos).length > 0 && (
          <View style={[s.requisitosPreview, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
            <Text style={[s.requisitosTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Requisitos</Text>
            {linhasRequisitos(item.requisitos).slice(0, 5).map((linha, idx) => (
              <View key={`${item.id}-req-${idx}`} style={s.requisitoLinha}>
                <Text style={[s.bullet, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>•</Text>
                <Text style={[s.requisitoTexto, cores.isEscuro && { color: '#aeb4bc' }, { color: cores.textoSecundario }]} numberOfLines={2}>{linha}</Text>
              </View>
            ))}
            {linhasRequisitos(item.requisitos).length > 5 && (
              <Text style={[s.requisitosMais, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>+ {linhasRequisitos(item.requisitos).length - 5} requisito(s)</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Catálogo de especialidades"
        acoes={<>
          {podeGerenciar && <BotaoCabecalho icone="add" onPress={abrirNovo} rotulo="Nova especialidade" />}
        </>}
      />

      {!podeGerenciar && (
        <Text style={[s.somenteLeitura, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>
          Só o Admin TI pode alterar o catálogo — ele é compartilhado por todos os clubes do programa.
        </Text>
      )}

      <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar por nome ou categoria..." />
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
        {!!erro && <EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} />}
        {!carregando && !erro && grupos.length === 0 && <EstadoVazio titulo="Nenhuma especialidade encontrada." />}

        {grupos.map((grupo) => {
          // Com busca ativa abre tudo, senão respeita o que o usuário expandiu.
          const aberto = !!busca.trim() || abertas.has(grupo.categoria);
          // Só vale a pena mostrar o dropdown de subcategoria quando a
          // categoria realmente foi dividida em mais de uma.
          const temSubcategorias = grupo.subgrupos.length > 1;
          return (
          <View key={grupo.categoria}>
            <TouchableOpacity
              style={[s.grupoHeader, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }]}
              onPress={() => setAbertas((prev) => {
                const novo = new Set(prev);
                if (novo.has(grupo.categoria)) novo.delete(grupo.categoria);
                else novo.add(grupo.categoria);
                return novo;
              })}
              activeOpacity={0.7}
            >
              <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={17} color={corIcone(cores)} />
              <Text style={[s.grupoTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{grupo.categoria}</Text>
              <View style={[s.grupoContador, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
                <Text style={[s.grupoContadorText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{grupo.itens.length}</Text>
              </View>
            </TouchableOpacity>

            {aberto && !temSubcategorias && grupo.itens.map((item) => renderItemCard(item))}

            {aberto && temSubcategorias && grupo.subgrupos.map((sub) => {
              const chaveSub = `${grupo.categoria}::${sub.subcategoria}`;
              const subAberto = !!busca.trim() || abertasSub.has(chaveSub);
              return (
                <View key={chaveSub}>
                  <TouchableOpacity
                    style={[s.subgrupoHeader, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }]}
                    onPress={() => setAbertasSub((prev) => {
                      const novo = new Set(prev);
                      if (novo.has(chaveSub)) novo.delete(chaveSub);
                      else novo.add(chaveSub);
                      return novo;
                    })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={subAberto ? 'chevron-down' : 'chevron-forward'} size={15} color={cores.textoSecundario} />
                    <Text style={[s.subgrupoTitulo, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>{sub.subcategoria}</Text>
                    <View style={[s.grupoContador, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.cartao }]}>
                      <Text style={[s.grupoContadorText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{sub.itens.length}</Text>
                    </View>
                  </TouchableOpacity>
                  {subAberto && sub.itens.map((item) => renderItemCard(item))}
                </View>
              );
            })}
          </View>
          );
        })}
      </ScrollView>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={[s.modalFundo, { backgroundColor: cores.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[s.modalCaixa, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{form.id ? 'Editar especialidade' : 'Nova especialidade'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={22} color={cores.textoSecundario} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={[s.label, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Insígnia</Text>
              <View style={s.insigniaLinha}>
                {form.insignia_url ? (
                  <Image source={{ uri: form.insignia_url }} style={[s.insigniaPreview, cores.isEscuro && { backgroundColor: '#1d1932' }]} resizeMode="contain" />
                ) : (
                  <View style={[s.insigniaPreview, cores.isEscuro && { backgroundColor: '#1d1932' }, s.insigniaVazia, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
                    <Ionicons name="image-outline" size={22} color={cores.textoSecundario} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 6 }}>
                  <TouchableOpacity style={[s.insigniaBtn, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]} onPress={escolherInsignia} disabled={enviandoInsignia}>
                    {enviandoInsignia ? <ActivityIndicator size="small" color={corIcone(cores)} /> : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={16} color={corIcone(cores)} />
                        <Text style={[s.insigniaBtnText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{form.insignia_url ? 'Trocar imagem' : 'Enviar imagem'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {!!form.insignia_url && (
                    <TouchableOpacity onPress={() => setForm((f) => ({ ...f, insignia_url: '' }))}>
                      <Text style={[s.insigniaRemover, cores.isEscuro && { color: '#ff9b9b' }]}>Remover imagem</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={[s.label, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Nome *</Text>
              <TextInput
                style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52', color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
                value={form.nome}
                onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))}
                placeholder="Ex.: Nós e Amarras"
                placeholderTextColor={cores.placeholder}
              />

              <Text style={[s.label, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Categoria</Text>
              {categorias.length > 0 ? (
                <View style={s.chipsWrap}>
                  {categorias.map((c) => (
                    <Chip key={c} rotulo={c} ativo={!!(form.categoria === c)} onPress={() => setForm((f) => ({ ...f, categoria: c, subcategoria: '' }))} />
                  ))}
                </View>
              ) : (
                <Text style={[s.avisoVazio, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>Nenhuma categoria cadastrada ainda no catálogo.</Text>
              )}

              <Text style={[s.label, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Subcategoria</Text>
              <TextInput
                style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52', color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
                value={form.subcategoria}
                onChangeText={(v) => setForm((f) => ({ ...f, subcategoria: v }))}
                placeholder="Opcional — ex.: Informática, Elétrica, Biologia"
                placeholderTextColor={cores.placeholder}
              />
              {subcategoriasDaCategoria.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {subcategoriasDaCategoria.map((c) => (
                    <Chip key={c} rotulo={c} ativo={!!(form.subcategoria === c)} onPress={() => setForm((f) => ({ ...f, subcategoria: c }))} />
                  ))}
                </ScrollView>
              )}

              <Text style={[s.label, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Código</Text>
              <TextInput
                style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52', color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
                value={form.codigo}
                onChangeText={(v) => setForm((f) => ({ ...f, codigo: v }))}
                placeholder="Opcional"
                placeholderTextColor={cores.placeholder}
              />

              <Text style={[s.label, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Pré-requisitos</Text>
              {especialidadesParaPreRequisito.length > 0 ? (
                <ScrollView style={[s.preRequisitosBox, cores.isEscuro && { borderColor: '#322c52' }, { borderColor: cores.borda }]} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {especialidadesParaPreRequisito.map((nome) => {
                    const marcado = preRequisitosSelecionados.has(nome);
                    return (
                      <TouchableOpacity
                        key={nome}
                        style={[s.preRequisitoLinha, cores.isEscuro && { borderBottomColor: '#322c52' }, { borderBottomColor: cores.borda }]}
                        onPress={() => alternarPreRequisito(nome)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={marcado ? 'checkbox' : 'square-outline'}
                          size={19}
                          color={marcado ? tomTexto('#4b2bb0', cores) : cores.textoSecundario}
                        />
                        <Text style={[s.preRequisitoTexto, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={[s.avisoVazio, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>Nenhuma outra especialidade cadastrada ainda para marcar como pré-requisito.</Text>
              )}

              <Text style={[s.label, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Requisitos</Text>
              <TextInput
                style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52', color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, s.inputMultiGrande, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
                value={form.requisitos}
                onChangeText={(v) => setForm((f) => ({ ...f, requisitos: v }))}
                placeholder={'1. ...\n2. ...\n3. ...'}
                placeholderTextColor={cores.placeholder}
                multiline
              />

              <Text style={[s.label, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>Observações</Text>
              <TextInput
                style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52', color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, s.inputMulti, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
                value={form.observacoes}
                onChangeText={(v) => setForm((f) => ({ ...f, observacoes: v }))}
                placeholder="Opcional"
                placeholderTextColor={cores.placeholder}
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
  container: { flex: 1, backgroundColor: '#f5f3fb' },
  header: {
    backgroundColor: '#4b2bb0', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voltar: { padding: 2 },
  headerTitulo: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  novoBtn: {
    width: 34, height: 34, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  somenteLeitura: {
    fontSize: 12, color: '#8a94a0', textAlign: 'center', paddingHorizontal: 20, paddingTop: 12,
  },

  buscaBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 18,
    borderWidth: 1, borderColor: '#e6e1f4',
  },
  busca: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#222' },

  lista: { flex: 1, marginTop: 8 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 11, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e1f4',
  },
  grupoTitulo: {
    flex: 1, fontSize: 12, fontWeight: '800', color: '#4b2bb0', textTransform: 'uppercase',
  },
  grupoContador: {
    minWidth: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 18,
    backgroundColor: '#efeaf9', alignItems: 'center',
  },
  grupoContadorText: { fontSize: 12, fontWeight: '800', color: '#4b2bb0' },
  subgrupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 26, marginTop: 7, paddingVertical: 9, paddingHorizontal: 11,
    backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#eef2f6',
  },
  subgrupoTitulo: { flex: 1, fontSize: 11, fontWeight: '700', color: '#52606d' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 18,
    borderWidth: 1, borderColor: '#e6e1f4', padding: 12,
  },
  cardInativo: { backgroundColor: '#f7f8fa' },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f1b33' },
  textoInativo: { color: '#9aa5b1', textDecorationLine: 'line-through' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
  acoes: { flexDirection: 'row', gap: 2 },
  acaoBtn: { padding: 7 },
  requisitosPreview: {
    marginTop: 8, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8,
  },
  requisitosTitulo: { color: '#4b2bb0', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 5 },
  requisitoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 3 },
  bullet: { color: '#4b2bb0', fontSize: 14, lineHeight: 18 },
  requisitoTexto: { flex: 1, fontSize: 12, color: '#6b7684', lineHeight: 17 },
  requisitosMais: { color: '#4b2bb0', fontSize: 11, fontWeight: '800', marginTop: 6 },

  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCaixa: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  modalTitulo: { flex: 1, fontSize: 17, fontWeight: '800', color: '#4b2bb0' },
  label: {
    fontSize: 12, fontWeight: '800', color: '#667', marginBottom: 6, marginTop: 12,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 16,
    padding: 12, fontSize: 15, color: '#1f1b33',
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  inputMultiGrande: { minHeight: 130, textAlignVertical: 'top' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: '#efeaf9', marginRight: 7, marginBottom: 7,
  },
  chipAtivo: { backgroundColor: '#4b2bb0' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  avisoVazio: { fontSize: 12, color: '#8a94a0', marginTop: 4, fontStyle: 'italic' },
  preRequisitosBox: {
    borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 11, marginTop: 2,
    maxHeight: 220, overflow: 'hidden',
  },
  preRequisitoLinha: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#f0f3f7',
  },
  preRequisitoTexto: { fontSize: 13, color: '#1f1b33', flex: 1 },
  insigniaLista: { width: 34, height: 34, borderRadius: 7 },
  insigniaLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  insigniaPreview: { width: 62, height: 62, borderRadius: 10, backgroundColor: '#f4f7fa' },
  insigniaVazia: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e6e1f4', borderStyle: 'dashed' },
  insigniaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 10, borderRadius: 22, backgroundColor: '#efeaf9',
  },
  insigniaBtnText: { fontSize: 12, fontWeight: '800', color: '#4b2bb0' },
  insigniaRemover: { fontSize: 11, color: '#c0392b', fontWeight: '700', textAlign: 'center' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#4a5866' },
  chipTextAtivo: { color: '#fff' },
  salvar: {
    marginTop: 20, backgroundColor: '#4b2bb0', borderRadius: 22, padding: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  salvarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

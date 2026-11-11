import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from '../../src/components/ModalSeguro';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { Botao, Cartao, Chip, Dropdown, Tag, type Tom } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/authStore';
import { useCores } from '../../src/stores/temaStore';
import { avisar } from '../../src/stores/avisoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { CampoComLista, CampoDataDigitavel, CampoMoeda } from '../../src/components/CamposPatrimonio';
import {
  atualizarItemPatrimonio, baixarItemPatrimonio, carregarItemPatrimonio, carregarItensPatrimonio,
  criarItemPatrimonio, enviarAnexoPatrimonio,
} from '../../src/lib/patrimonio';
import {
  CONDICOES_PATRIMONIO, DEPARTAMENTOS_SUGERIDOS, FORM_PATRIMONIO_VAZIO, MARCAS_SUGERIDAS, STATUS_PATRIMONIO, TIPOS_SUGERIDOS, completarMoeda,
  MAX_ANEXOS_PATRIMONIO, anexosDoItem, dataIsoParaBr, formatarMoeda, itemParaForm, lerMoeda, opcoesDistintas, tipoDoAnexo, validarForm, valorUnitario,
  type AnexoPatrimonio, type ErrosForm, type FormPatrimonio, type ItemPatrimonio, type StatusPatrimonio,
} from '../../src/lib/patrimonioNucleo';

/** Anexo escolhido nesta tela, ainda não enviado (vai junto com o Salvar). */
interface AnexoPendente { chave: string; uri: string; mime: string; nome: string; tipo: AnexoPatrimonio['tipo'] }

const TOM_STATUS: Record<StatusPatrimonio, Tom> = { ativo: 'verde', baixado: 'vermelho' };
const ROTULO_STATUS = Object.fromEntries(STATUS_PATRIMONIO.map((st) => [st.valor, st.rotulo])) as Record<StatusPatrimonio, string>;

/** Campo de texto com sugestões em chips (departamento e tipo): escolhe uma existente ou digita uma nova. */
function CampoSugestoes({ valor, onChange, opcoes, editavel, rotulo }: { valor: string; onChange: (v: string) => void; opcoes: string[]; editavel: boolean; rotulo: string }) {
  const cores = useCores();
  const busca = valor.trim().toLowerCase();
  const sugestoes = opcoes.filter((o) => o.toLowerCase().includes(busca) && o.toLowerCase() !== busca).slice(0, 8);
  return (
    <View style={{ gap: 6 }}>
      <TextInput
        style={[s.campo, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }, !editavel && s.desabilitado]}
        value={valor} onChangeText={onChange} editable={editavel} accessibilityLabel={rotulo} maxLength={60}
      />
      {editavel && sugestoes.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
          {sugestoes.map((o) => <Chip key={o} rotulo={o} onPress={() => onChange(o)} />)}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function PatrimonioItemScreen() {
  const cores = useCores();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novo = id === 'novo';
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const clubeId = getClubeAtivoId();
  const podeVer = permissoes.pode('gerenciar_patrimonio.ver');
  const podeCadastrar = permissoes.pode('gerenciar_patrimonio.cadastrar');
  const podeEditar = permissoes.pode('gerenciar_patrimonio.editar');
  const podeBaixar = permissoes.pode('gerenciar_patrimonio.baixar');

  const [item, setItem] = useState<ItemPatrimonio | null>(null);
  const [form, setForm] = useState<FormPatrimonio>(FORM_PATRIMONIO_VAZIO);
  const [anexos, setAnexos] = useState<AnexoPatrimonio[]>([]);
  const [pendentes, setPendentes] = useState<AnexoPendente[]>([]);
  const [outros, setOutros] = useState<ItemPatrimonio[]>([]);
  const [carregando, setCarregando] = useState(!novo);
  const [erroCarga, setErroCarga] = useState('');
  const [erros, setErros] = useState<ErrosForm>({});
  const [ocupado, setOcupado] = useState(false);
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [motivoBaixa, setMotivoBaixa] = useState('');
  const [escolhaFotoAberta, setEscolhaFotoAberta] = useState(false);

  const baixado = item?.status === 'baixado';
  const editavel = (novo ? podeCadastrar : podeEditar) && !baixado;

  useFocusEffect(useCallback(() => {
    let ativo = true;
    (async () => {
      try {
        // Lista do clube: alimenta as sugestões de departamento e tipo.
        carregarItensPatrimonio(clubeId).then((l) => { if (ativo) setOutros(l); }).catch(() => {});
        if (novo) return;
        const lido = await carregarItemPatrimonio(Number(id));
        if (!ativo) return;
        if (!lido) { setErroCarga('Item não encontrado.'); return; }
        setItem(lido);
        setForm(itemParaForm(lido));
        setAnexos(anexosDoItem(lido));
        setPendentes([]);
        setErroCarga('');
      } catch (e: any) {
        if (ativo) setErroCarga(e?.message ?? 'Não foi possível carregar o item. Verifique a internet.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [id, novo, clubeId]));

  const departamentos = useMemo(() => opcoesDistintas(outros.map((o) => o.departamento), DEPARTAMENTOS_SUGERIDOS), [outros]);
  const marcas = useMemo(() => opcoesDistintas(outros.map((o) => o.marca), MARCAS_SUGERIDAS), [outros]);
  const tipos = useMemo(() => opcoesDistintas(outros.map((o) => o.tipo), TIPOS_SUGERIDOS), [outros]);
  const unitario = valorUnitario(lerMoeda(form.valor_mercado) ?? 0, Number(form.quantidade) || 0);

  const set = <K extends keyof FormPatrimonio>(k: K, v: FormPatrimonio[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (erros[k]) setErros((e) => ({ ...e, [k]: undefined }));
  };

  const totalAnexos = anexos.length + pendentes.length;

  /** Adiciona fotos (câmera ou galeria, várias de uma vez) ou PDFs, até o limite de 5 anexos por item. */
  async function adicionarAnexo(origem: 'camera' | 'galeria' | 'pdf') {
    setEscolhaFotoAberta(false);
    const restante = MAX_ANEXOS_PATRIMONIO - totalAnexos;
    if (restante <= 0) { avisar(`Cada item aceita até ${MAX_ANEXOS_PATRIMONIO} fotos ou PDFs.`, 'info', 'Limite de anexos'); return; }
    try {
      let novos: AnexoPendente[] = [];
      const chave = (k: number) => `${Date.now()}_${k}_${Math.random().toString(36).slice(2, 7)}`;
      if (origem === 'pdf') {
        const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: true });
        if (r.canceled) return;
        novos = r.assets.map((a, k) => ({ chave: chave(k), uri: a.uri, mime: 'application/pdf', nome: a.name || 'Documento.pdf', tipo: 'pdf' as const }));
      } else {
        if (origem === 'camera' && Platform.OS !== 'web') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== 'granted') { avisar('Permita o acesso à câmera para fotografar o item.', 'info', 'Permissão necessária'); return; }
        }
        const r = origem === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: restante });
        if (r.canceled) return;
        novos = r.assets
          .filter((a) => tipoDoAnexo(a.fileName ?? a.uri, a.mimeType) !== 'pdf')
          .map((a, k) => ({ chave: chave(k), uri: a.uri, mime: a.mimeType ?? 'image/jpeg', nome: a.fileName || 'Foto.jpg', tipo: 'imagem' as const }));
      }
      if (novos.length === 0) return;
      if (novos.length > restante) {
        novos = novos.slice(0, restante);
        avisar(`Cada item aceita até ${MAX_ANEXOS_PATRIMONIO} fotos ou PDFs. Entraram só os ${restante} primeiros.`, 'info', 'Limite de anexos');
      }
      setPendentes((p) => [...p, ...novos]);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível adicionar o arquivo.', 'erro', 'Anexos');
    }
  }

  function abrirAnexo(a: AnexoPatrimonio) {
    if (Platform.OS === 'web') { window.open(a.url, '_blank'); return; }
    Linking.openURL(a.url).catch(() => avisar('Não foi possível abrir o arquivo.', 'erro', 'Anexos'));
  }

  async function salvar() {
    // Valores sempre completos em reais, com os centavos ("12" vira "12,00").
    const completo: FormPatrimonio = { ...form, valor_aquisicao: completarMoeda(form.valor_aquisicao), valor_mercado: completarMoeda(form.valor_mercado) };
    const e = validarForm(completo);
    setErros(e);
    setForm(completo);
    if (Object.keys(e).length > 0) { avisar('Corrija os campos destacados.', 'info', 'Campos inválidos'); return; }
    setOcupado(true);
    try {
      // Envia os arquivos escolhidos e junta com os que o item já tinha (a primeira imagem vira a capa da lista).
      const enviados: AnexoPatrimonio[] = [];
      for (const p of pendentes) enviados.push({ url: await enviarAnexoPatrimonio(clubeId, p.uri, p.mime, p.tipo), tipo: p.tipo, nome: p.nome });
      const finais = [...anexos, ...enviados];
      if (novo) {
        const criado = await criarItemPatrimonio(clubeId, completo, finais);
        avisar(`Item #${criado.codigo} cadastrado.`, 'sucesso', 'Patrimônio');
        router.replace('/patrimonio' as any);
      } else if (item) {
        const salvo = await atualizarItemPatrimonio(item, completo, finais);
        setItem(salvo); setForm(itemParaForm(salvo)); setAnexos(anexosDoItem(salvo)); setPendentes([]);
        avisar('Alterações salvas.', 'sucesso', 'Patrimônio');
      }
    } catch (err: any) {
      avisar(err?.message ?? 'Não foi possível salvar. Verifique a internet.', 'erro', 'Falha ao salvar');
    } finally {
      setOcupado(false);
    }
  }

  async function darBaixa() {
    if (!item) return;
    setOcupado(true);
    try {
      setItem(await baixarItemPatrimonio(item, motivoBaixa));
      setBaixaAberta(false); setMotivoBaixa('');
      avisar('Baixa registrada.', 'sucesso', 'Patrimônio');
    } catch (err: any) {
      avisar(err?.message ?? 'Não foi possível dar baixa.', 'erro', 'Patrimônio');
    } finally {
      setOcupado(false);
    }
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeVer || (novo && !podeCadastrar)) return <Redirect href="/" />;

  const campo = (erro?: string) => [s.campo, { backgroundColor: cores.input, color: cores.texto, borderColor: erro ? '#c62828' : cores.borda }, !editavel && s.desabilitado];
  const rotulo = (t: string) => <Text style={[s.rotulo, { color: cores.textoSecundario }]}>{t}</Text>;
  const msgErro = (t?: string) => (t ? <Text style={s.erro}>{t}</Text> : null);

  /** Miniatura de um anexo: foto ou ícone de PDF, com o "x" para remover (quando editável). */
  const miniatura = (chave: string, uri: string | null, tipo: AnexoPatrimonio['tipo'], nome: string, aoAbrir: (() => void) | null, aoRemover: () => void, novoArquivo: boolean) => (
    <View key={chave} style={s.miniaturaBox}>
      <TouchableOpacity style={[s.miniatura, { backgroundColor: cores.acentoSuave, borderColor: cores.borda }]} onPress={aoAbrir ?? undefined} disabled={!aoAbrir} accessibilityRole="button" accessibilityLabel={`${tipo === 'pdf' ? 'Abrir PDF' : 'Abrir foto'}: ${nome}`}>
        {tipo === 'imagem' && uri ? (
          <Image source={{ uri }} style={s.miniaturaImg} resizeMode="cover" />
        ) : (
          <View style={s.miniaturaPdf}>
            <Ionicons name="document-text-outline" size={30} color={cores.acento} />
            <Text style={{ color: cores.texto, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>{nome}</Text>
          </View>
        )}
        {novoArquivo ? <View style={s.selo}><Text style={s.seloTxt}>novo</Text></View> : null}
      </TouchableOpacity>
      {editavel ? (
        <TouchableOpacity style={s.remover} onPress={aoRemover} accessibilityRole="button" accessibilityLabel={`Remover ${nome}`}>
          <Ionicons name="close" size={14} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={[s.tela, { backgroundColor: cores.fundo }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CabecalhoTela titulo={novo ? 'Novo item' : item ? `Item #${item.codigo}` : 'Patrimônio'} subtitulo="Patrimônio" />
      {carregando ? <ActivityIndicator color={cores.acento} style={{ marginTop: 40 }} /> : erroCarga ? (
        <View style={{ padding: 20, gap: 12 }}>
          <Text style={{ color: cores.texto }}>{erroCarga}</Text>
          <Botao rotulo="Voltar ao patrimônio" onPress={() => router.replace('/patrimonio' as any)} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <Cartao style={{ gap: 10 }}>
            <View style={s.tituloAnexos}>
              <Text style={[s.rotuloSwitch, { color: cores.texto }]}>Fotos e PDFs</Text>
              <Text style={{ color: cores.textoSecundario, fontSize: 12, fontWeight: '700' }}>{totalAnexos}/{MAX_ANEXOS_PATRIMONIO}</Text>
            </View>
            {totalAnexos === 0 ? (
              <View style={[s.anexosVazio, { backgroundColor: cores.acentoSuave }]}>
                <Ionicons name="images-outline" size={38} color={cores.acento} />
                <Text style={{ color: cores.textoSecundario, fontSize: 12 }}>Nenhuma foto ou PDF</Text>
              </View>
            ) : (
              <View style={s.grade}>
                {anexos.map((a, i) => miniatura(`a${i}_${a.url}`, a.url, a.tipo, a.nome, () => abrirAnexo(a), () => setAnexos((l) => l.filter((_, k) => k !== i)), false))}
                {pendentes.map((p) => miniatura(p.chave, p.uri, p.tipo, p.nome, null, () => setPendentes((l) => l.filter((x) => x.chave !== p.chave)), true))}
              </View>
            )}
            {editavel && totalAnexos < MAX_ANEXOS_PATRIMONIO ? (
              <View style={s.linha}>
                <Botao rotulo="Foto / PDF" icone="add" secundario onPress={() => setEscolhaFotoAberta(true)} />
              </View>
            ) : null}
            {editavel && totalAnexos > 0 ? <Text style={{ color: cores.textoSecundario, fontSize: 11 }}>A primeira foto aparece na lista de itens. Toque numa miniatura para abrir; as novas são enviadas ao salvar.</Text> : null}
          </Cartao>

          <Cartao style={{ gap: 10 }}>
            <View>
              {rotulo('Status')}
              <View style={{ flexDirection: 'row' }}>
                <Tag texto={ROTULO_STATUS[item?.status ?? 'ativo']} tom={TOM_STATUS[item?.status ?? 'ativo']} />
              </View>
              {item?.status === 'baixado' ? <Text style={{ color: cores.textoSecundario, fontSize: 11, marginTop: 4 }}>Baixa em {dataIsoParaBr(item.data_baixa)}{item.motivo_baixa ? ` · ${item.motivo_baixa}` : ''}</Text> : null}
            </View>

            {rotulo('Descrição *')}
            <TextInput style={campo(erros.descricao)} value={form.descricao} onChangeText={(v) => set('descricao', v)} editable={editavel} maxLength={200} accessibilityLabel="Descrição" />
            {msgErro(erros.descricao)}

            {rotulo('Departamento')}
            <CampoSugestoes valor={form.departamento} onChange={(v) => set('departamento', v)} opcoes={departamentos} editavel={editavel} rotulo="Departamento" />

            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                {rotulo('Série')}
                <TextInput style={campo()} value={form.serie} onChangeText={(v) => set('serie', v)} editable={editavel} maxLength={60} accessibilityLabel="Série" />
              </View>
              <View style={{ width: 110 }}>
                {rotulo('Quantidade')}
                <TextInput style={campo(erros.quantidade)} value={form.quantidade} onChangeText={(v) => set('quantidade', v.replace(/\D/g, ''))} keyboardType="number-pad" editable={editavel} accessibilityLabel="Quantidade" />
              </View>
            </View>
            {msgErro(erros.quantidade)}

            {rotulo('Tipo')}
            <CampoSugestoes valor={form.tipo} onChange={(v) => set('tipo', v)} opcoes={tipos} editavel={editavel} rotulo="Tipo" />

            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                {rotulo('Marca')}
                <CampoComLista valor={form.marca} onChange={(v) => set('marca', v)} opcoes={marcas} editavel={editavel} estilo={campo()} rotulo="Marca" placeholder="Escolha ou escreva" />
              </View>
              <View style={{ flex: 1 }}>
                {rotulo('Modelo')}
                <TextInput style={campo()} value={form.modelo} onChangeText={(v) => set('modelo', v)} editable={editavel} maxLength={60} accessibilityLabel="Modelo" />
              </View>
            </View>

            {rotulo('Condição')}
            <Dropdown valor={form.condicao} opcoes={CONDICOES_PATRIMONIO.map((c) => ({ valor: c.valor, rotulo: c.rotulo }))} onChange={(v) => set('condicao', v as FormPatrimonio['condicao'])} vazio="Não informada" titulo="Condição" desabilitado={!editavel} />

            {rotulo('Data de aquisição')}
            <CampoDataDigitavel valor={form.data_aquisicao} onChange={(v) => set('data_aquisicao', v)} editavel={editavel} estilo={campo(erros.data_aquisicao)} rotulo="Data de aquisição" />
            {msgErro(erros.data_aquisicao)}

            <View style={s.linha}>
              <View style={{ flex: 1, minWidth: 140 }}>
                {rotulo('Valor de aquisição')}
                <CampoMoeda valor={form.valor_aquisicao} onChange={(v) => set('valor_aquisicao', v)} editavel={editavel} estilo={campo(erros.valor_aquisicao)} rotulo="Valor de aquisição" />
                {msgErro(erros.valor_aquisicao)}
              </View>
              <View style={{ flex: 1, minWidth: 140 }}>
                {rotulo('Valor de mercado')}
                <CampoMoeda valor={form.valor_mercado} onChange={(v) => set('valor_mercado', v)} editavel={editavel} estilo={campo(erros.valor_mercado)} rotulo="Valor de mercado" />
                {msgErro(erros.valor_mercado)}
              </View>
            </View>
            {rotulo('Valor unitário (mercado ÷ quantidade)')}
            <TextInput style={[...campo(), s.desabilitado]} value={formatarMoeda(unitario)} editable={false} accessibilityLabel="Valor unitário" />

            <View style={s.linhaSwitch}>
              <Text style={[s.rotuloSwitch, { color: cores.texto }]}>Fixada na parede</Text>
              <Switch value={form.fixada_parede} onValueChange={(v) => set('fixada_parede', v)} disabled={!editavel} />
            </View>
            {form.fixada_parede ? (
              <View>
                <TextInput style={campo(erros.local_fixacao)} value={form.local_fixacao} onChangeText={(v) => set('local_fixacao', v)} placeholder="Informe a Sala ou Local, andar" placeholderTextColor={cores.placeholder} editable={editavel} maxLength={120} accessibilityLabel="Sala ou local e andar" />
                {msgErro(erros.local_fixacao)}
              </View>
            ) : null}
            <View style={s.linhaSwitch}>
              <Text style={[s.rotuloSwitch, { color: cores.texto }]}>Assegurar item</Text>
              <Switch value={form.segurar} onValueChange={(v) => set('segurar', v)} disabled={!editavel} />
            </View>
          </Cartao>

          <View style={s.acoes}>
            {item && !baixado && podeBaixar ? <Botao rotulo="Dar baixa" icone="archive-outline" secundario onPress={() => setBaixaAberta(true)} desabilitado={ocupado} /> : null}
            {editavel ? <Botao rotulo={ocupado ? 'Salvando…' : 'Salvar'} icone="save-outline" onPress={salvar} desabilitado={ocupado} /> : null}
          </View>
        </ScrollView>
      )}

      <Modal visible={escolhaFotoAberta} transparent animationType="fade" onRequestClose={() => setEscolhaFotoAberta(false)}>
        <View style={[s.overlay, { backgroundColor: cores.overlay }]}>
          <View style={[s.caixa, { backgroundColor: cores.cartao }]}>
            <Text style={[s.caixaTitulo, { color: cores.texto }]}>Adicionar ao item</Text>
            <Text style={{ color: cores.textoSecundario, fontSize: 12 }}>Até {MAX_ANEXOS_PATRIMONIO} fotos ou PDFs por item. Dá para escolher várias de uma vez.</Text>
            <Botao rotulo="Tirar foto com a câmera" icone="camera-outline" onPress={() => adicionarAnexo('camera')} />
            <Botao rotulo="Escolher da galeria" icone="images-outline" secundario onPress={() => adicionarAnexo('galeria')} />
            <Botao rotulo="Escolher PDF" icone="document-text-outline" secundario onPress={() => adicionarAnexo('pdf')} />
            <Botao rotulo="Cancelar" secundario onPress={() => setEscolhaFotoAberta(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={baixaAberta} transparent animationType="fade" onRequestClose={() => setBaixaAberta(false)}>
        <View style={[s.overlay, { backgroundColor: cores.overlay }]}>
          <View style={[s.caixa, { backgroundColor: cores.cartao }]}>
            <Text style={[s.caixaTitulo, { color: cores.texto }]}>Dar baixa no item #{item?.codigo}</Text>
            <Text style={{ color: cores.textoSecundario, fontSize: 13 }}>O item sai do patrimônio, mas continua no histórico. Informe o motivo (perdido, doado, descartado...).</Text>
            <TextInput style={[s.campo, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={motivoBaixa} onChangeText={setMotivoBaixa} placeholder="Motivo da baixa" placeholderTextColor={cores.placeholder} maxLength={200} accessibilityLabel="Motivo da baixa" />
            <View style={s.linha}>
              <Botao rotulo="Cancelar" secundario onPress={() => setBaixaAberta(false)} />
              <Botao rotulo="Confirmar baixa" icone="archive" onPress={darBaixa} desabilitado={ocupado} />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1 },
  conteudo: { padding: 14, gap: 12, paddingBottom: 60 },
  linha: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' },
  rotulo: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  campo: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  desabilitado: { opacity: 0.6 },
  erro: { color: '#c62828', fontSize: 12, fontWeight: '700' },
  tituloAnexos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  anexosVazio: { height: 110, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniaturaBox: { width: 96, height: 96 },
  miniatura: { width: 96, height: 96, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  miniaturaImg: { width: '100%', height: '100%' },
  miniaturaPdf: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
  remover: { position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#c62828', alignItems: 'center', justifyContent: 'center' },
  selo: { position: 'absolute', left: 4, bottom: 4, backgroundColor: 'rgba(124,57,231,0.92)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  seloTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  rotuloSwitch: { fontSize: 14, fontWeight: '700' },
  acoes: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' },
  overlay: { flex: 1, justifyContent: 'center', padding: 18 },
  caixa: { borderRadius: 18, padding: 18, gap: 12 },
  caixaTitulo: { fontSize: 16, fontWeight: '900' },
});

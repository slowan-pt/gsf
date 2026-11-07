import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from '../../src/components/ModalSeguro';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { Botao, Cartao, Chip, Dropdown, Tag, type Tom } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/authStore';
import { useCores } from '../../src/stores/temaStore';
import { avisar, confirmar } from '../../src/stores/avisoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import {
  aprovarItemPatrimonio, atualizarItemPatrimonio, baixarItemPatrimonio, carregarItemPatrimonio, carregarItensPatrimonio,
  criarItemPatrimonio, enviarFotoPatrimonio, reabrirItemPatrimonio,
} from '../../src/lib/patrimonio';
import {
  CONDICOES_PATRIMONIO, DEPARTAMENTOS_SUGERIDOS, FORM_PATRIMONIO_VAZIO, STATUS_PATRIMONIO, TIPOS_SUGERIDOS, dataIsoParaBr,
  formatarMoeda, itemParaForm, lerMoeda, mascararData, opcoesDistintas, validarForm, valorUnitario,
  type ErrosForm, type FormPatrimonio, type ItemPatrimonio, type StatusPatrimonio,
} from '../../src/lib/patrimonioNucleo';

const TOM_STATUS: Record<StatusPatrimonio, Tom> = { pendente: 'amarelo', aprovado: 'verde', baixado: 'vermelho' };
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
  const podeAprovar = permissoes.pode('gerenciar_patrimonio.aprovar');
  const podeBaixar = permissoes.pode('gerenciar_patrimonio.baixar');

  const [item, setItem] = useState<ItemPatrimonio | null>(null);
  const [form, setForm] = useState<FormPatrimonio>(FORM_PATRIMONIO_VAZIO);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoNova, setFotoNova] = useState<{ uri: string; mime: string } | null>(null);
  const [outros, setOutros] = useState<ItemPatrimonio[]>([]);
  const [carregando, setCarregando] = useState(!novo);
  const [erroCarga, setErroCarga] = useState('');
  const [erros, setErros] = useState<ErrosForm>({});
  const [ocupado, setOcupado] = useState(false);
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [motivoBaixa, setMotivoBaixa] = useState('');

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
        setFotoUrl(lido.foto_url);
        setFotoNova(null);
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
  const tipos = useMemo(() => opcoesDistintas(outros.map((o) => o.tipo), TIPOS_SUGERIDOS), [outros]);
  const unitario = valorUnitario(lerMoeda(form.valor_mercado) ?? 0, Number(form.quantidade) || 0);

  const set = <K extends keyof FormPatrimonio>(k: K, v: FormPatrimonio[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (erros[k]) setErros((e) => ({ ...e, [k]: undefined }));
  };

  async function escolherFoto(origem: 'galeria' | 'camera') {
    try {
      if (origem === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') { avisar('Permita o acesso à câmera para fotografar o item.', 'info', 'Permissão necessária'); return; }
      }
      const r = origem === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (r.canceled || !r.assets[0]) return;
      setFotoNova({ uri: r.assets[0].uri, mime: r.assets[0].mimeType ?? 'image/jpeg' });
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível escolher a foto.', 'erro', 'Foto');
    }
  }

  async function salvar() {
    const e = validarForm(form);
    setErros(e);
    if (Object.keys(e).length > 0) { avisar('Corrija os campos destacados.', 'info', 'Campos inválidos'); return; }
    setOcupado(true);
    try {
      const urlFoto = fotoNova ? await enviarFotoPatrimonio(clubeId, fotoNova.uri, fotoNova.mime) : fotoUrl;
      if (novo) {
        const criado = await criarItemPatrimonio(clubeId, form, urlFoto);
        avisar(`Item #${criado.codigo} cadastrado como pendente.`, 'sucesso', 'Patrimônio');
        router.replace('/patrimonio' as any);
      } else if (item) {
        const salvo = await atualizarItemPatrimonio(item, form, urlFoto);
        setItem(salvo); setForm(itemParaForm(salvo)); setFotoUrl(salvo.foto_url); setFotoNova(null);
        avisar('Alterações salvas.', 'sucesso', 'Patrimônio');
      }
    } catch (err: any) {
      avisar(err?.message ?? 'Não foi possível salvar. Verifique a internet.', 'erro', 'Falha ao salvar');
    } finally {
      setOcupado(false);
    }
  }

  async function mudar(acao: 'aprovar' | 'reabrir') {
    if (!item) return;
    const ok = await confirmar(acao === 'aprovar' ? `Aprovar o item #${item.codigo}?` : `Reabrir o item #${item.codigo}? Ele volta a ficar pendente.`, acao === 'aprovar' ? 'Aprovar item' : 'Reabrir item');
    if (!ok) return;
    setOcupado(true);
    try {
      const novoItem = acao === 'aprovar' ? await aprovarItemPatrimonio(item) : await reabrirItemPatrimonio(item);
      setItem(novoItem);
      avisar(acao === 'aprovar' ? 'Item aprovado.' : 'Item reaberto.', 'sucesso', 'Patrimônio');
    } catch (err: any) {
      avisar(err?.message ?? 'Não foi possível concluir.', 'erro', 'Patrimônio');
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
  const fotoExibida = fotoNova?.uri ?? fotoUrl;

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
          <Cartao style={{ gap: 10, alignItems: 'center' }}>
            {fotoExibida ? (
              <Image source={{ uri: fotoExibida }} style={s.foto} resizeMode="cover" accessibilityLabel="Foto do item" />
            ) : (
              <View style={[s.foto, s.fotoVazia, { backgroundColor: cores.acentoSuave }]}><Ionicons name="image-outline" size={56} color={cores.acento} /></View>
            )}
            {editavel ? (
              <View style={s.linha}>
                <Botao rotulo="Galeria" icone="images-outline" secundario onPress={() => escolherFoto('galeria')} />
                {Platform.OS !== 'web' ? <Botao rotulo="Câmera" icone="camera-outline" secundario onPress={() => escolherFoto('camera')} /> : null}
                {fotoExibida ? <Botao rotulo="Remover" icone="trash-outline" secundario onPress={() => { setFotoNova(null); setFotoUrl(null); }} /> : null}
              </View>
            ) : null}
          </Cartao>

          <Cartao style={{ gap: 10 }}>
            <View style={s.linha}>
              <View style={{ width: 90 }}>
                {rotulo('Código')}
                <TextInput style={[...campo(), s.desabilitado]} value={item ? String(item.codigo) : 'Novo'} editable={false} accessibilityLabel="Código" />
              </View>
              <View style={{ flex: 1 }}>
                {rotulo('Status')}
                <View style={{ flexDirection: 'row' }}>
                  <Tag texto={ROTULO_STATUS[item?.status ?? 'pendente']} tom={TOM_STATUS[item?.status ?? 'pendente']} />
                </View>
                {item?.status === 'baixado' ? <Text style={{ color: cores.textoSecundario, fontSize: 11, marginTop: 4 }}>Baixa em {dataIsoParaBr(item.data_baixa)}{item.motivo_baixa ? ` · ${item.motivo_baixa}` : ''}</Text> : null}
              </View>
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
                <TextInput style={campo()} value={form.marca} onChangeText={(v) => set('marca', v)} editable={editavel} maxLength={60} accessibilityLabel="Marca" />
              </View>
              <View style={{ flex: 1 }}>
                {rotulo('Modelo')}
                <TextInput style={campo()} value={form.modelo} onChangeText={(v) => set('modelo', v)} editable={editavel} maxLength={60} accessibilityLabel="Modelo" />
              </View>
            </View>

            {rotulo('Condição')}
            <Dropdown valor={form.condicao} opcoes={CONDICOES_PATRIMONIO.map((c) => ({ valor: c.valor, rotulo: c.rotulo }))} onChange={(v) => set('condicao', v as FormPatrimonio['condicao'])} vazio="Não informada" titulo="Condição" desabilitado={!editavel} />

            {rotulo('Data de aquisição')}
            <TextInput style={campo(erros.data_aquisicao)} value={form.data_aquisicao} onChangeText={(v) => set('data_aquisicao', mascararData(v))} keyboardType="number-pad" placeholder="dd/mm/aaaa" placeholderTextColor={cores.placeholder} maxLength={10} editable={editavel} accessibilityLabel="Data de aquisição" />
            {msgErro(erros.data_aquisicao)}

            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                {rotulo('Valor de aquisição (R$)')}
                <TextInput style={campo(erros.valor_aquisicao)} value={form.valor_aquisicao} onChangeText={(v) => set('valor_aquisicao', v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={cores.placeholder} editable={editavel} accessibilityLabel="Valor de aquisição" />
                {msgErro(erros.valor_aquisicao)}
              </View>
              <View style={{ flex: 1 }}>
                {rotulo('Valor de mercado (R$)')}
                <TextInput style={campo(erros.valor_mercado)} value={form.valor_mercado} onChangeText={(v) => set('valor_mercado', v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={cores.placeholder} editable={editavel} accessibilityLabel="Valor de mercado" />
                {msgErro(erros.valor_mercado)}
              </View>
            </View>
            {rotulo('Valor unitário (mercado ÷ quantidade)')}
            <TextInput style={[...campo(), s.desabilitado]} value={formatarMoeda(unitario)} editable={false} accessibilityLabel="Valor unitário" />

            <View style={s.linhaSwitch}>
              <Text style={[s.rotuloSwitch, { color: cores.texto }]}>Fixada na parede</Text>
              <Switch value={form.fixada_parede} onValueChange={(v) => set('fixada_parede', v)} disabled={!editavel} />
            </View>
            <View style={s.linhaSwitch}>
              <Text style={[s.rotuloSwitch, { color: cores.texto }]}>Assegurar item</Text>
              <Switch value={form.segurar} onValueChange={(v) => set('segurar', v)} disabled={!editavel} />
            </View>
          </Cartao>

          <View style={s.acoes}>
            {item && !baixado && podeAprovar ? (
              item.status === 'pendente'
                ? <Botao rotulo="Aprovar" icone="checkmark" onPress={() => mudar('aprovar')} desabilitado={ocupado} />
                : <Botao rotulo="Reabrir" icone="refresh" secundario onPress={() => mudar('reabrir')} desabilitado={ocupado} />
            ) : null}
            {item && !baixado && podeBaixar ? <Botao rotulo="Dar baixa" icone="archive-outline" secundario onPress={() => setBaixaAberta(true)} desabilitado={ocupado} /> : null}
            {editavel ? <Botao rotulo={ocupado ? 'Salvando…' : 'Salvar'} icone="save-outline" onPress={salvar} desabilitado={ocupado} /> : null}
          </View>
        </ScrollView>
      )}

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
  foto: { width: '100%', maxWidth: 360, height: 220, borderRadius: 16 },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  rotuloSwitch: { fontSize: 14, fontWeight: '700' },
  acoes: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' },
  overlay: { flex: 1, justifyContent: 'center', padding: 18 },
  caixa: { borderRadius: 18, padding: 18, gap: 12 },
  caixaTitulo: { fontSize: 16, fontWeight: '900' },
});

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { BottomNav } from '../../src/components/BottomNav';
import { usePermissoes } from '../../src/lib/permissoes';
import { useAuthStore } from '../../src/stores/authStore';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import type { Passagem } from '../../src/lib/anoBiblico';
import {
  aplicarImportacaoExcel, carregarCatalogoAnoBiblico, exportarModeloExcel,
  importarCatalogoExcel, salvarDiaAnoBiblico, type DiaCatalogoAdmin,
} from '../../src/lib/anoBiblicoAdmin';

function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${titulo}\n\n${mensagem}`);
    return;
  }
  Alert.alert(titulo, mensagem);
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface FormPassagem {
  livro_abrev: string;
  capitulo: string;
  verso_ini: string;
  verso_fim: string;
}

const FORM_VAZIO = {
  id: 0,
  livro_abrev: '',
  livro_nome: '',
  referencia: '',
  passagens: [{ livro_abrev: '', capitulo: '', verso_ini: '', verso_fim: '' }] as FormPassagem[],
};

export default function AdminAnoBiblicoScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const permissoes = usePermissoes();
  const usuario = useAuthStore((s) => s.usuario);
  const podeEditar = permissoes.temPerfil(['admin_ti']);

  const [dias, setDias] = useState<DiaCatalogoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mesAberto, setMesAberto] = useState<number>(new Date().getMonth() + 1);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progressoImportacao, setProgressoImportacao] = useState<{ feito: number; total: number } | null>(null);
  const [resultadoImportacao, setResultadoImportacao] = useState<
    { id: number; linhaOrigem: number; ok: boolean; erro?: string }[] | null
  >(null);

  useFocusEffect(useCallback(() => { carregar(); }, []));

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setDias(await carregarCatalogoAnoBiblico());
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar o catálogo.');
    } finally {
      setCarregando(false);
    }
  }

  async function baixarModelo() {
    setExportando(true);
    try {
      await exportarModeloExcel(dias);
    } catch (e: any) {
      avisar('Não foi possível gerar o Excel', e?.message ?? 'Tente novamente.');
    } finally {
      setExportando(false);
    }
  }

  async function escolherEEnviarExcel() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;

      setImportando(true);
      setResultadoImportacao(null);
      setProgressoImportacao(null);

      const diasImportados = await importarCatalogoExcel(result.assets[0]);
      const confirmado = await confirmarImportacao(diasImportados.length);
      if (!confirmado) return;

      const resultado = await aplicarImportacaoExcel(diasImportados, usuario?.id, (feito, total) =>
        setProgressoImportacao({ feito, total })
      );
      setResultadoImportacao(resultado);
      await carregar();
    } catch (e: any) {
      avisar('Não foi possível importar', e?.message ?? 'Verifique o arquivo e tente novamente.');
    } finally {
      setImportando(false);
      setProgressoImportacao(null);
    }
  }

  async function confirmarImportacao(totalDias: number): Promise<boolean> {
    const mensagem = `Isso vai atualizar ${totalDias} dia(s) do plano, buscando o texto bíblico novo quando precisar. Continuar?`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.confirm(mensagem);
    }
    return new Promise((resolve) => {
      Alert.alert('Confirmar importação', mensagem, [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Importar', onPress: () => resolve(true) },
      ]);
    });
  }

  const porMes = useMemo(() => {
    const mapa = new Map<number, DiaCatalogoAdmin[]>();
    for (const d of dias) {
      if (!mapa.has(d.mes)) mapa.set(d.mes, []);
      mapa.get(d.mes)!.push(d);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.dia - b.dia || (a.ano_bissexto ? 1 : 0) - (b.ano_bissexto ? 1 : 0));
    return mapa;
  }, [dias]);

  function abrirEdicao(d: DiaCatalogoAdmin) {
    setForm({
      id: d.id,
      livro_abrev: d.livro_abrev,
      livro_nome: d.livro_nome,
      referencia: d.referencia,
      passagens: d.passagens.map((p) => ({
        livro_abrev: p.livro_abrev,
        capitulo: String(p.capitulo),
        verso_ini: p.verso_ini != null ? String(p.verso_ini) : '',
        verso_fim: p.verso_fim != null ? String(p.verso_fim) : '',
      })),
    });
    setModal(true);
  }

  function atualizarPassagem(idx: number, campo: keyof FormPassagem, valor: string) {
    setForm((f) => ({
      ...f,
      passagens: f.passagens.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)),
    }));
  }

  function adicionarPassagem() {
    setForm((f) => ({
      ...f,
      passagens: [...f.passagens, { livro_abrev: f.passagens[0]?.livro_abrev ?? '', capitulo: '', verso_ini: '', verso_fim: '' }],
    }));
  }

  function removerPassagem(idx: number) {
    setForm((f) => ({ ...f, passagens: f.passagens.filter((_, i) => i !== idx) }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      const passagens: Passagem[] = form.passagens.map((p) => {
        const capitulo = parseInt(p.capitulo, 10);
        if (!p.livro_abrev.trim() || Number.isNaN(capitulo)) {
          throw new Error('Preencha livro e capítulo em todas as passagens.');
        }
        const versoIni = p.verso_ini.trim() ? parseInt(p.verso_ini, 10) : null;
        const versoFim = p.verso_fim.trim() ? parseInt(p.verso_fim, 10) : versoIni;
        return { livro_abrev: p.livro_abrev.trim(), capitulo, verso_ini: versoIni, verso_fim: versoFim };
      });

      await salvarDiaAnoBiblico(
        {
          id: form.id,
          livro_abrev: form.livro_abrev.trim() || passagens[0].livro_abrev,
          livro_nome: form.livro_nome.trim(),
          referencia: form.referencia.trim(),
          passagens,
        },
        usuario?.id
      );
      setModal(false);
      await carregar();
    } catch (e: any) {
      avisar('Não foi possível salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (!podeEditar) {
    return (
      <View style={s.container}>
        <View style={[s.header, { backgroundColor: corCabecalho }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>Editar Ano Bíblico</Text>
        </View>
        <Text style={s.somenteLeitura}>Só o Admin TI pode editar o plano de leitura — ele é compartilhado por todos os clubes.</Text>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: corCabecalho }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Editar Ano Bíblico</Text>
          <Text style={s.headerSub}>{dias.length} dias no plano</Text>
        </View>
      </View>

      <Text style={s.explicacao}>
        Toque num dia para trocar o capítulo, ou baixe o plano inteiro em
        Excel para editar em massa e reenviar. O texto nos 4 idiomas é
        buscado automaticamente a cada dia salvo — se a busca falhar, o dia
        não é alterado.
      </Text>

      <View style={s.excelRow}>
        <TouchableOpacity style={s.excelBtn} onPress={baixarModelo} disabled={exportando || carregando}>
          {exportando ? <ActivityIndicator size="small" color="#1a3a5c" /> : <Ionicons name="download-outline" size={16} color="#1a3a5c" />}
          <Text style={s.excelBtnTexto}>Baixar modelo Excel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.excelBtn} onPress={escolherEEnviarExcel} disabled={importando || carregando}>
          {importando ? <ActivityIndicator size="small" color="#1a3a5c" /> : <Ionicons name="cloud-upload-outline" size={16} color="#1a3a5c" />}
          <Text style={s.excelBtnTexto}>
            {importando && progressoImportacao ? `Enviando ${progressoImportacao.feito}/${progressoImportacao.total}...` : 'Enviar Excel corrigido'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={s.erro}>{erro}</Text>}

        {!carregando && !erro && MESES.map((nomeMes, idx) => {
          const mes = idx + 1;
          const itens = porMes.get(mes) ?? [];
          if (itens.length === 0) return null;
          const aberto = mesAberto === mes;
          return (
            <View key={mes}>
              <TouchableOpacity style={s.grupoHeader} activeOpacity={0.7} onPress={() => setMesAberto(aberto ? 0 : mes)}>
                <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={17} color="#1a3a5c" />
                <Text style={s.grupoTitulo}>{nomeMes}</Text>
              </TouchableOpacity>
              {aberto && itens.map((d) => (
                <TouchableOpacity key={d.id} style={s.card} activeOpacity={0.75} onPress={() => abrirEdicao(d)}>
                  <View style={s.diaBadge}>
                    <Text style={s.diaBadgeTexto}>{String(d.dia).padStart(2, '0')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardNome}>{d.referencia}</Text>
                    <Text style={s.cardSub}>{d.livro_nome}{d.ano_bissexto ? ' · só em ano bissexto' : ''}</Text>
                  </View>
                  <Ionicons name="create-outline" size={17} color="#9aa5b1" />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!resultadoImportacao} animationType="slide" transparent onRequestClose={() => setResultadoImportacao(null)}>
        <View style={s.modalFundo}>
          <View style={s.modalConteudo}>
            <ScrollView contentContainerStyle={{ padding: 18 }}>
              <Text style={s.modalTitulo}>Resultado da importação</Text>
              <Text style={s.campoLabel}>
                {resultadoImportacao?.filter((r) => r.ok).length ?? 0} de {resultadoImportacao?.length ?? 0} dia(s) atualizado(s) com sucesso.
              </Text>
              {resultadoImportacao?.filter((r) => !r.ok).map((r) => (
                <View key={r.id} style={s.linhaErroImportacao}>
                  <Ionicons name="alert-circle" size={16} color="#c0392b" />
                  <Text style={s.linhaErroImportacaoTexto}>
                    Linha {r.linhaOrigem} (ID {r.id}): {r.erro}
                  </Text>
                </View>
              ))}
              <TouchableOpacity style={s.botaoSalvar} onPress={() => setResultadoImportacao(null)}>
                <Text style={s.botaoSalvarTexto}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalFundo}>
          <View style={s.modalConteudo}>
            <ScrollView contentContainerStyle={{ padding: 18 }}>
              <Text style={s.modalTitulo}>Editar dia</Text>

              <Text style={s.campoLabel}>Nome do livro (ex.: Gênesis)</Text>
              <TextInput style={s.input} value={form.livro_nome} onChangeText={(v) => setForm((f) => ({ ...f, livro_nome: v }))} />

              <Text style={s.campoLabel}>Referência exibida (ex.: Gn 1)</Text>
              <TextInput style={s.input} value={form.referencia} onChangeText={(v) => setForm((f) => ({ ...f, referencia: v }))} />

              <Text style={s.campoLabel}>Passagens</Text>
              {form.passagens.map((p, idx) => (
                <View key={idx} style={s.passagemLinha}>
                  <TextInput
                    style={[s.input, s.inputPequeno]}
                    value={p.livro_abrev}
                    onChangeText={(v) => atualizarPassagem(idx, 'livro_abrev', v)}
                    placeholder="Gn"
                  />
                  <TextInput
                    style={[s.input, s.inputPequeno]}
                    value={p.capitulo}
                    onChangeText={(v) => atualizarPassagem(idx, 'capitulo', v)}
                    placeholder="Cap."
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={[s.input, s.inputPequeno]}
                    value={p.verso_ini}
                    onChangeText={(v) => atualizarPassagem(idx, 'verso_ini', v)}
                    placeholder="V. ini"
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={[s.input, s.inputPequeno]}
                    value={p.verso_fim}
                    onChangeText={(v) => atualizarPassagem(idx, 'verso_fim', v)}
                    placeholder="V. fim"
                    keyboardType="number-pad"
                  />
                  {form.passagens.length > 1 && (
                    <TouchableOpacity onPress={() => removerPassagem(idx)} style={s.removerBtn}>
                      <Ionicons name="close-circle" size={20} color="#c0392b" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity onPress={adicionarPassagem} style={s.adicionarBtn}>
                <Ionicons name="add-circle-outline" size={18} color="#1a3a5c" />
                <Text style={s.adicionarTexto}>Adicionar capítulo/versículos</Text>
              </TouchableOpacity>

              <View style={s.modalBotoes}>
                <TouchableOpacity style={s.botaoCancelar} onPress={() => setModal(false)} disabled={salvando}>
                  <Text style={s.botaoCancelarTexto}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.botaoSalvar} onPress={salvar} disabled={salvando}>
                  {salvando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.botaoSalvarTexto}>Salvar</Text>}
                </TouchableOpacity>
              </View>
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
  somenteLeitura: { fontSize: 13, color: '#8a94a0', textAlign: 'center', padding: 24 },
  explicacao: { fontSize: 12, color: '#6b7684', paddingHorizontal: 20, paddingTop: 12, lineHeight: 17 },

  excelRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  excelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#d7e5f3', paddingVertical: 10,
  },
  excelBtnTexto: { color: '#1a3a5c', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  linhaErroImportacao: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  linhaErroImportacaoTexto: { flex: 1, color: '#c0392b', fontSize: 12 },

  lista: { flex: 1, marginTop: 8 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },

  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e4eaf1',
  },
  grupoTitulo: { fontSize: 13, fontWeight: '800', color: '#1a3a5c', textTransform: 'uppercase' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 12,
    borderWidth: 1, borderColor: '#e4eaf1', padding: 12,
  },
  diaBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#ede7f6', alignItems: 'center', justifyContent: 'center' },
  diaBadgeTexto: { fontSize: 13, fontWeight: '800', color: '#5e35b1' },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f2933' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },

  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalConteudo: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '85%' },
  modalTitulo: { fontSize: 17, fontWeight: '800', color: '#1a3a5c', marginBottom: 14 },
  campoLabel: { fontSize: 12, color: '#6b7684', marginTop: 10, marginBottom: 4, fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: '#e4eaf1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#222', backgroundColor: '#f8fafc',
  },
  passagemLinha: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6 },
  inputPequeno: { flex: 1, paddingHorizontal: 8 },
  removerBtn: { padding: 4 },
  adicionarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 10 },
  adicionarTexto: { color: '#1a3a5c', fontSize: 13, fontWeight: '700' },

  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  botaoCancelar: { flex: 1, padding: 13, borderRadius: 10, alignItems: 'center', backgroundColor: '#f2f5f9' },
  botaoCancelarTexto: { color: '#455a64', fontWeight: '700' },
  botaoSalvar: { flex: 1, padding: 13, borderRadius: 10, alignItems: 'center', backgroundColor: '#1a3a5c' },
  botaoSalvarTexto: { color: '#fff', fontWeight: '700' },
});

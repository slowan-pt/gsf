import { useEffect, useState, useRef, useCallback } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Platform, Pressable, Alert, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDBVStore } from '../../src/stores/dbvStore';
import { usePontuacaoStore, type ConfigPontuacaoItem } from '../../src/stores/pontuacaoStore';
import { useAuthStore } from '../../src/stores/authStore';

function proximoFimDeSemana(): Date {
  const hoje = new Date();
  const dia = hoje.getDay();
  if (dia === 0 || dia === 6) return hoje;
  const alvo = new Date(hoje);
  alvo.setDate(hoje.getDate() + (6 - dia));
  return alvo;
}

interface CheckDBV {
  dbv_id: number;
  nome: string;
  unidade_nome: string;
  presenca: boolean;
  pontualidade: boolean;
  material: boolean;
  uniforme: boolean;
  pontos_extras: number;
  custom: Record<number, number>;
}

type CampoBase = 'presenca' | 'pontualidade' | 'material' | 'uniforme';

type BaseCfg = { campo: CampoBase; nome: string; valor: number; ativo: boolean };

const BASE_CFG_KEY = 'pontuacao_base_config_v1';
const BASE_CFG_PADRAO: BaseCfg[] = [
  { campo: 'presenca', nome: 'Presença', valor: 25, ativo: true },
  { campo: 'pontualidade', nome: 'Pontualidade', valor: 100, ativo: true },
  { campo: 'material', nome: 'Material', valor: 25, ativo: true },
  { campo: 'uniforme', nome: 'Uniforme', valor: 25, ativo: true },
];

function baseSigla(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return partes.map((p) => p[0]).join('').slice(0, 3).toUpperCase();
}

export default function PontuacaoScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const { desbravadores, carregar } = useDBVStore();
  const {
    carregarPorData, lancarPontuacao, pontuacoes, config, itens, carregarConfig, salvarConfig,
    criarItemConfig, atualizarItemConfig, excluirItemConfig, salvarCustom, carregarCustomPorData,
  } = usePontuacaoStore();

  const [dataObj, setDataObj] = useState<Date>(proximoFimDeSemana());
  const [checks, setChecks] = useState<CheckDBV[]>([]);
  const [customData, setCustomData] = useState<Record<number, Record<number, number>>>({});
  const [showPicker, setShowPicker] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [salvandoIndicador, setSalvandoIndicador] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [busca, setBusca] = useState('');

  const [cfgTemp, setCfgTemp] = useState(config);
  const [itensTemp, setItensTemp] = useState<ConfigPontuacaoItem[]>([]);
  const [baseCfg, setBaseCfg] = useState<BaseCfg[]>(BASE_CFG_PADRAO);
  const [baseTemp, setBaseTemp] = useState<BaseCfg[]>(BASE_CFG_PADRAO);
  const [novoNome, setNovoNome] = useState('');
  const [novoValor, setNovoValor] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checksRef = useRef<CheckDBV[]>([]);
  const dirtyIdsRef = useRef<Set<number>>(new Set());
  const dataRef = useRef<string>('');

  const isAdmin = usuario?.perfil === 'admin_geral' || usuario?.perfil === 'admin_diretoria';
  const unidadeId = usuario?.unidade_id;
  const data = format(dataObj, 'yyyy-MM-dd');

  useEffect(() => {
    carregar();
    carregarConfig();
    carregarBaseCfg();
  }, []);

  useEffect(() => {
    setBaseCfg((prev) => prev.map((b) => ({ ...b, valor: config[b.campo] })));
  }, [config]);

  async function carregarBaseCfg() {
    try {
      const raw = await AsyncStorage.getItem(BASE_CFG_KEY);
      if (!raw) {
        setBaseCfg(BASE_CFG_PADRAO.map((b) => ({ ...b, valor: config[b.campo] })));
        return;
      }
      const salvos = JSON.parse(raw) as Partial<BaseCfg>[];
      const mesclados = BASE_CFG_PADRAO.map((padrao) => {
        const salvo = salvos.find((s) => s.campo === padrao.campo);
        return {
          ...padrao,
          nome: salvo?.nome || padrao.nome,
          ativo: typeof salvo?.ativo === 'boolean' ? salvo.ativo : padrao.ativo,
          valor: config[padrao.campo],
        };
      });
      setBaseCfg(mesclados);
    } catch {
      setBaseCfg(BASE_CFG_PADRAO.map((b) => ({ ...b, valor: config[b.campo] })));
    }
  }

  useEffect(() => {
    dataRef.current = data;
    carregarPorData(data);
    carregarCustomPorData(data).then(setCustomData);
  }, [data]);

  useEffect(() => {
    const lista = (isAdmin ? desbravadores : desbravadores.filter((d) => d.unidade_id === Number(unidadeId)))
      .slice()
      .sort((a, b) => {
        const ua = a.unidade_nome || 'Sem unidade';
        const ub = b.unidade_nome || 'Sem unidade';
        return ua.localeCompare(ub, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR');
      });

    const novos: CheckDBV[] = lista.map((d) => {
      const existente = pontuacoes.find((p) => p.dbv_id === d.id);
      return {
        dbv_id: d.id,
        nome: d.nome,
        unidade_nome: d.unidade_nome || 'Sem unidade',
        presenca: existente ? !!existente.presenca : false,
        pontualidade: existente ? !!existente.pontualidade : false,
        material: existente ? !!existente.material : false,
        uniforme: existente ? !!existente.uniforme : false,
        pontos_extras: existente?.pontos_extras ?? 0,
        custom: customData[d.id] ?? {},
      };
    });
    setChecks(novos);
    checksRef.current = novos;
  }, [desbravadores, pontuacoes, customData, itens, isAdmin, unidadeId]);

  useFocusEffect(
    useCallback(() => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        if (dirtyIdsRef.current.size > 0) executarSave(checksRef.current, dataRef.current);
      }
    }, [])
  );

  const agendarSave = useCallback((novosChecks: CheckDBV[], alterados: number[]) => {
    checksRef.current = novosChecks;
    alterados.forEach((id) => dirtyIdsRef.current.add(id));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSalvandoIndicador('saving');
    debounceRef.current = setTimeout(() => executarSave(novosChecks, dataRef.current), 1200);
  }, []);

  async function executarSave(lista: CheckDBV[], dataStr: string) {
    const ids = new Set(dirtyIdsRef.current);
    if (ids.size === 0) return;
    dirtyIdsRef.current.clear();
    try {
      for (const c of lista.filter((item) => ids.has(item.dbv_id))) {
        await lancarPontuacao({
          dbv_id: c.dbv_id,
          data: dataStr,
          presenca: c.presenca,
          pontualidade: c.pontualidade,
          material: c.material,
          uniforme: c.uniforme,
          bom_biblia: 0,
          pontos_extras: c.pontos_extras,
          classe_biblica: 0,
          especialidade: 0,
          pgm_especial: 0,
          atividade_unidade: 0,
          lancado_por: usuario?.nome,
        });
        for (const item of itens.filter((i) => i.ativo)) {
          const marcado = c.custom[item.id] ? 1 : 0;
          await salvarCustom(c.dbv_id, dataStr, item.id, marcado, item.valor);
        }
      }
      setSalvandoIndicador('saved');
      setTimeout(() => setSalvandoIndicador('idle'), 1800);
    } catch (e) {
      ids.forEach((id) => dirtyIdsRef.current.add(id));
      console.log('Erro ao salvar pontuação', e);
      setSalvandoIndicador('idle');
      Alert.alert('Erro', 'Não foi possível salvar a pontuação. Tente novamente.');
    }
  }

  function toggleBase(id: number, campo: CampoBase) {
    setChecks((prev) => {
      const novos = prev.map((c) => c.dbv_id === id ? { ...c, [campo]: !c[campo] } : c);
      agendarSave(novos, [id]);
      return novos;
    });
  }

  function toggleCustom(id: number, itemId: number) {
    setChecks((prev) => {
      const novos = prev.map((c) => c.dbv_id === id
        ? { ...c, custom: { ...c.custom, [itemId]: c.custom[itemId] ? 0 : 1 } }
        : c);
      agendarSave(novos, [id]);
      return novos;
    });
  }

  function marcarTodos(campo: CampoBase) {
    setChecks((prev) => {
      const filtradosIds = new Set(checksFiltrados.map((c) => c.dbv_id));
      const todosMarcados = prev.filter((c) => filtradosIds.has(c.dbv_id)).every((c) => c[campo]);
      const novos = prev.map((c) => filtradosIds.has(c.dbv_id) ? { ...c, [campo]: !todosMarcados } : c);
      agendarSave(novos, Array.from(filtradosIds));
      return novos;
    });
  }

  async function adicionarPontuacao() {
    const valor = Number(novoValor);
    if (!novoNome.trim()) { Alert.alert('Atenção', 'Informe o título da pontuação.'); return; }
    if (!Number.isFinite(valor) || valor <= 0) { Alert.alert('Atenção', 'Informe um valor maior que zero.'); return; }
    try {
      await criarItemConfig(novoNome.trim(), valor);
      await carregarConfig();
      setNovoNome('');
      setNovoValor('');
      setShowAdd(false);
      Alert.alert('Pronto', 'Pontuação adicionada.');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível salvar a pontuação.');
    }
  }

  function abrirConfig() {
    setCfgTemp(config);
    setBaseTemp(baseCfg.map((b) => ({ ...b, valor: config[b.campo] })));
    setItensTemp(itens.map((i) => ({ ...i })));
    setShowConfig(true);
  }

  async function aplicarConfig() {
    const baseAtualizada = baseTemp.map((b) => ({ ...b, valor: Number(b.valor) || 0 }));
    const novaConfig = baseAtualizada.reduce(
      (acc, b) => ({ ...acc, [b.campo]: b.valor }),
      cfgTemp
    );
    await salvarConfig(novaConfig);
    await AsyncStorage.setItem(
      BASE_CFG_KEY,
      JSON.stringify(baseAtualizada.map(({ campo, nome, ativo }) => ({ campo, nome, ativo })))
    );
    setBaseCfg(baseAtualizada);
    for (const item of itensTemp) {
      await atualizarItemConfig(item.id, item.nome, Number(item.valor) || 0, !!item.ativo);
    }
    await carregarConfig();
    setShowConfig(false);
    Alert.alert('Pronto', 'Configuração salva.');
  }

  async function removerItemCriado(item: ConfigPontuacaoItem) {
    try {
      await excluirItemConfig(item.id);
      setItensTemp((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível remover a pontuação.');
    }
  }

  const dataExibida = format(dataObj, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const baseAtivos = baseCfg.filter((b) => b.ativo);
  const legendaCfg = baseAtivos.map((b) => `${baseSigla(b.nome)}=${config[b.campo]}`).join(' ');
  const itensAtivos = itens.filter((i) => i.ativo);
  const checksFiltrados = checks.filter((c) =>
    c.nome.toLowerCase().includes(busca.trim().toLowerCase()) ||
    c.unidade_nome.toLowerCase().includes(busca.trim().toLowerCase())
  );

  if (!usuario) return <Redirect href="/auth/login" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.titulo}>✅ Pontuação</Text>
          <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addPontBtn}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.addPontText}>Adicionar pontuação</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={abrirConfig} style={styles.configBtn}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.dataRow} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
          <Ionicons name="calendar" size={18} color="#a8c8e8" />
          <Text style={styles.dataTexto}>{dataExibida}</Text>
          <Ionicons name="chevron-down" size={16} color="#a8c8e8" />
        </TouchableOpacity>

        <View style={styles.saveIndicador}>
          {salvandoIndicador === 'saving' && <>
            <Ionicons name="cloud-upload-outline" size={13} color="#a8c8e8" />
            <Text style={styles.saveText}>Salvando...</Text>
          </>}
          {salvandoIndicador === 'saved' && <>
            <Ionicons name="checkmark-circle-outline" size={13} color="#69f0ae" />
            <Text style={[styles.saveText, { color: '#69f0ae' }]}>Salvo!</Text>
          </>}
        </View>
      </View>

      {showPicker && (
        Platform.OS === 'web' ? (
          <Modal transparent animationType="fade">
            <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
              <Pressable style={styles.pickerBox} onPress={(e) => e.stopPropagation()}>
                <View style={styles.pickerHandle} />
                <Text style={styles.modalTitulo}>Selecionar data</Text>
                {(
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => {
                      const [ano, mes, dia] = e.currentTarget.value.split('-').map(Number);
                      if (ano && mes && dia) setDataObj(new Date(ano, mes - 1, dia, 12));
                    }}
                    style={{
                      height: 48,
                      borderRadius: 12,
                      border: '2px solid #1a3a5c',
                      padding: '0 12px',
                      fontSize: 16,
                      color: '#1a3a5c',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                ) as any}
                <TouchableOpacity style={styles.pickerOkBtn} onPress={() => setShowPicker(false)}>
                  <Text style={styles.pickerOkText}>Confirmar</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        ) : Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide">
            <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
              <Pressable style={styles.pickerBox} onPress={(e) => e.stopPropagation()}>
                <View style={styles.pickerHandle} />
                <DateTimePicker value={dataObj} mode="date" display="inline" locale="pt-BR" onChange={(_, d) => { if (d) setDataObj(d); }} />
                <TouchableOpacity style={styles.pickerOkBtn} onPress={() => setShowPicker(false)}>
                  <Text style={styles.pickerOkText}>Confirmar</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker value={dataObj} mode="date" display="calendar" onChange={(_, d) => { setShowPicker(false); if (d) setDataObj(d); }} />
        )
      )}

      <View style={styles.legendaRow}>
        {baseAtivos.map((base) => (
          <TouchableOpacity key={base.campo} style={styles.legendaBtn} onPress={() => marcarTodos(base.campo)}>
            <Text style={styles.legendaText}>{baseSigla(base.nome)}</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.legendaHint}>{legendaCfg} · toque p/ marcar todos filtrados</Text>
      </View>

      <View style={styles.buscaBox}>
        <Ionicons name="search" size={17} color="#789" />
        <TextInput
          style={styles.buscaInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar membro ou unidade..."
          placeholderTextColor="#9aa6b2"
          autoCapitalize="none"
        />
        {busca.length > 0 && <TouchableOpacity onPress={() => setBusca('')}><Ionicons name="close-circle" size={18} color="#9aa6b2" /></TouchableOpacity>}
      </View>

      <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
        {checksFiltrados.map((c, idx) => {
          const unidadeAnterior = idx > 0 ? checksFiltrados[idx - 1].unidade_nome : '';
          const mostraUnidade = idx === 0 || unidadeAnterior !== c.unidade_nome;
          return (
            <View key={c.dbv_id}>
              {mostraUnidade && <Text style={styles.unidadeTitulo}>{c.unidade_nome}</Text>}
              <View style={styles.row}>
                <View style={styles.nomeBox}>
                  <Text style={styles.rowNome} numberOfLines={2}>{c.nome}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.checksScroll}>
                  {baseAtivos.map((base) => (
                    <TouchableOpacity key={base.campo} style={styles.checkItem} onPress={() => toggleBase(c.dbv_id, base.campo)}>
                      <View style={[styles.checkBox, c[base.campo] && styles.checkBoxAtivo]}>
                        {c[base.campo] && <Ionicons name="checkmark" size={15} color="#fff" />}
                      </View>
                      <Text style={styles.checkLabel}>{baseSigla(base.nome)}</Text>
                    </TouchableOpacity>
                  ))}
                  {itensAtivos.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.checkItemCustom} onPress={() => toggleCustom(c.dbv_id, item.id)}>
                      <View style={[styles.checkBox, c.custom[item.id] ? styles.checkBoxAtivo : null]}>
                        {!!c.custom[item.id] && <Ionicons name="checkmark" size={15} color="#fff" />}
                      </View>
                      <Text style={styles.checkLabel} numberOfLines={1}>{item.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          );
        })}
        {checksFiltrados.length === 0 && <Text style={styles.vazio}>Nenhum membro encontrado.</Text>}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlayPress} onPress={() => setShowAdd(false)}>
            <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>➕ Adicionar pontuação</Text>
              <Text style={styles.modalSub}>Crie um item para aparecer como checkbox na lista.</Text>
              <Text style={styles.inputLabel}>Título</Text>
              <TextInput style={styles.textInput} value={novoNome} onChangeText={setNovoNome} placeholder="Ex.: Prova bíblica" />
              <Text style={styles.inputLabel}>Valor</Text>
              <TextInput style={styles.textInput} value={novoValor} onChangeText={setNovoValor} placeholder="Ex.: 20" keyboardType="numeric" />
              <TouchableOpacity style={styles.salvarConfigBtn} onPress={adicionarPontuacao}>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.salvarConfigText}>Salvar pontuação</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelarBtn} onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelarText}>Cancelar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showConfig} transparent animationType="slide" onRequestClose={() => setShowConfig(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlayPress} onPress={() => setShowConfig(false)}>
            <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitulo}>⚙️ Configurar pontuação</Text>
              <Text style={styles.modalSub}>Ajuste valores, títulos e remova itens da grade.</Text>

              <Text style={styles.listaItensTitulo}>Pontuações fixas</Text>
              {baseTemp.filter((b) => b.ativo).length === 0 && (
                <Text style={styles.itemOcultoText}>Todas as pontuações fixas estão ocultas.</Text>
              )}
              {baseTemp.filter((b) => b.ativo).map((base) => (
                <View key={base.campo} style={styles.customCfgRow}>
                  <TextInput
                    style={[styles.cfgInput, styles.itemNomeInput]}
                    value={base.nome}
                    onChangeText={(v) => setBaseTemp((prev) => prev.map((x) => x.campo === base.campo ? { ...x, nome: v } : x))}
                    placeholder="Título"
                  />
                  <TextInput
                    style={styles.cfgInput}
                    value={String(base.valor)}
                    onChangeText={(v) => setBaseTemp((prev) => prev.map((x) => x.campo === base.campo ? { ...x, valor: Number(v) || 0 } : x))}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    onPress={() => setBaseTemp((prev) => prev.map((x) => x.campo === base.campo ? { ...x, ativo: false } : x))}
                    style={styles.iconCfgBtn}
                  >
                    <Ionicons name="eye-off" size={18} color="#1a3a5c" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setBaseTemp((prev) => prev.map((x) => x.campo === base.campo ? { ...x, ativo: false } : x))}
                    style={styles.iconCfgBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color="#c62828" />
                  </TouchableOpacity>
                </View>
              ))}
              {baseTemp.some((b) => !b.ativo) && (
                <View style={styles.ocultosBox}>
                  <Text style={styles.ocultosTitulo}>Ocultas</Text>
                  {baseTemp.filter((b) => !b.ativo).map((base) => (
                    <TouchableOpacity
                      key={base.campo}
                      style={styles.restaurarBtn}
                      onPress={() => setBaseTemp((prev) => prev.map((x) => x.campo === base.campo ? { ...x, ativo: true } : x))}
                    >
                      <Ionicons name="add-circle-outline" size={16} color="#1a3a5c" />
                      <Text style={styles.restaurarText}>Restaurar {base.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {itensTemp.length > 0 && <Text style={styles.listaItensTitulo}>Pontuações criadas</Text>}
              {itensTemp.map((item, index) => (
                <View key={item.id} style={styles.customCfgRow}>
                  <TextInput
                    style={[styles.cfgInput, styles.itemNomeInput]}
                    value={item.nome}
                    onChangeText={(v) => setItensTemp((prev) => prev.map((x, i) => i === index ? { ...x, nome: v } : x))}
                    placeholder="Título"
                  />
                  <TextInput
                    style={styles.cfgInput}
                    value={String(item.valor)}
                    onChangeText={(v) => setItensTemp((prev) => prev.map((x, i) => i === index ? { ...x, valor: Number(v) || 0 } : x))}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    onPress={() => setItensTemp((prev) => prev.map((x, i) => i === index ? { ...x, ativo: x.ativo ? 0 : 1 } : x))}
                    style={styles.iconCfgBtn}
                  >
                    <Ionicons name={item.ativo ? 'eye' : 'eye-off'} size={18} color="#1a3a5c" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removerItemCriado(item)}
                    style={styles.iconCfgBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color="#c62828" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.salvarConfigBtn} onPress={aplicarConfig}>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.salvarConfigText}>Salvar configuração</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelarBtn} onPress={() => setShowConfig(false)}>
                <Text style={styles.cancelarText}>Cancelar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  titulo: { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1 },
  configBtn: { padding: 6 },
  addPontBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 },
  addPontText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  dataTexto: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  saveIndicador: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, minHeight: 16 },
  saveText: { color: '#a8c8e8', fontSize: 12 },
  legendaRow: { flexDirection: 'row', backgroundColor: '#e8edf2', padding: 10, alignItems: 'center', gap: 4 },
  legendaBtn: { width: 36, height: 30, backgroundColor: '#1a3a5c', borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  legendaText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  legendaHint: { flex: 1, textAlign: 'right', fontSize: 10, color: '#888' },
  buscaBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 10, marginBottom: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, elevation: 1 },
  buscaInput: { flex: 1, fontSize: 14, color: '#1f2933', paddingVertical: 4 },
  lista: { flex: 1 },
  unidadeTitulo: { marginTop: 12, marginHorizontal: 16, marginBottom: 2, color: '#1a3a5c', fontWeight: '800', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 6, padding: 10, borderRadius: 10, gap: 10, elevation: 1 },
  nomeBox: { width: 145 },
  rowNome: { fontSize: 13, fontWeight: '700', color: '#333' },
  checksScroll: { gap: 10, paddingRight: 10 },
  checkItem: { alignItems: 'center', minWidth: 36 },
  checkItemCustom: { alignItems: 'center', minWidth: 58, maxWidth: 84 },
  checkBox: { width: 30, height: 30, borderRadius: 6, borderWidth: 2, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkBoxAtivo: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  checkLabel: { marginTop: 3, fontSize: 10, color: '#667', fontWeight: '700' },
  vazio: { textAlign: 'center', color: '#999', marginTop: 32, fontSize: 14 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  pickerHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerOkBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  pickerOkText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1 },
  modalOverlayPress: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28, maxHeight: '86%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: '#1a3a5c', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#888', marginBottom: 18 },
  inputLabel: { fontSize: 13, fontWeight: '800', color: '#1a3a5c', marginBottom: 6 },
  textInput: { borderWidth: 2, borderColor: '#d9e2ec', borderRadius: 12, padding: 12, fontSize: 16, color: '#1f2933', marginBottom: 14 },
  cfgRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  cfgLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
  cfgInput: { width: 80, borderWidth: 2, borderColor: '#1a3a5c', borderRadius: 10, padding: 10, fontSize: 16, fontWeight: '700', textAlign: 'center', color: '#1a3a5c' },
  cfgSufixo: { width: 24, fontSize: 13, color: '#888' },
  listaItensTitulo: { color: '#1a3a5c', fontSize: 15, fontWeight: '800', marginTop: 8, marginBottom: 10 },
  itemOcultoText: { color: '#888', fontSize: 13, marginBottom: 10 },
  ocultosBox: { backgroundColor: '#f4f7fb', borderRadius: 12, padding: 10, marginBottom: 10 },
  ocultosTitulo: { color: '#667', fontSize: 12, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' },
  restaurarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  restaurarText: { color: '#1a3a5c', fontSize: 13, fontWeight: '700' },
  customCfgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  itemNomeInput: { flex: 1, width: undefined, textAlign: 'left' },
  iconCfgBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eef3f8', alignItems: 'center', justifyContent: 'center' },
  salvarConfigBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 },
  salvarConfigText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelarBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelarText: { color: '#999', fontSize: 15, fontWeight: '600' },
});

import { useEffect, useState, useRef, useCallback } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Platform, Pressable, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useDBVStore } from '../../src/stores/dbvStore';
import { usePontuacaoStore, type ConfigPontuacaoItem } from '../../src/stores/pontuacaoStore';
import { useAuthStore } from '../../src/stores/authStore';
import { DateField } from '../../src/components/DateField';
import { usePermissoes } from '../../src/lib/permissoes';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';

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

interface UnidadeOpcao {
  id: number | null;
  nome: string;
}

type CampoBase = 'presenca' | 'pontualidade' | 'material' | 'uniforme';

type ItemPontuacaoGrade = ConfigPontuacaoItem & { campo?: CampoBase };

const NOME_COL_WIDTH = 165;
const BASE_COL_WIDTH = 58;
const CUSTOM_COL_WIDTH = 72;
const COL_GAP = 8;

const BASE_CFG_PADRAO: Array<ItemPontuacaoGrade & { campo: CampoBase }> = [
  { id: -1, campo: 'presenca', nome: 'Presença', sigla: 'PR', valor: 25, ativo: true, ordem: 1, padrao: true },
  { id: -2, campo: 'pontualidade', nome: 'Pontualidade', sigla: 'PO', valor: 100, ativo: true, ordem: 2, padrao: true },
  { id: -3, campo: 'material', nome: 'Material', sigla: 'MA', valor: 25, ativo: true, ordem: 3, padrao: true },
  { id: -4, campo: 'uniforme', nome: 'Uniforme', sigla: 'UN', valor: 25, ativo: true, ordem: 4, padrao: true },
];

function textoNormalizado(v: unknown) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function campoPadrao(item: Pick<ConfigPontuacaoItem, 'nome' | 'sigla'>): CampoBase | undefined {
  const sigla = String(item.sigla ?? '').trim().toUpperCase();
  const nome = textoNormalizado(item.nome);
  if (sigla === 'PR' || nome === 'presenca') return 'presenca';
  if (sigla === 'PO' || nome === 'pontualidade') return 'pontualidade';
  if (sigla === 'MA' || nome === 'material') return 'material';
  if (sigla === 'UN' || nome === 'uniforme') return 'uniforme';
  return undefined;
}

function itemSigla(item: Pick<ConfigPontuacaoItem, 'nome' | 'sigla'>) {
  if (item.sigla) return String(item.sigla).toUpperCase();
  const partes = item.nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return partes.map((p) => p[0]).join('').slice(0, 3).toUpperCase();
}

function partesNomePontuacao(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return {
    primeiro: partes[0] ?? nome,
    sobrenome: partes[1] ?? '',
  };
}

function chavePrimeiroNome(nome: string) {
  return textoNormalizado(partesNomePontuacao(nome).primeiro);
}

function prioridadeUnidade(nome: string) {
  const unidade = textoNormalizado(nome);
  if (unidade === 'diretoria') return 1;
  if (unidade === 'sem unidade') return 2;
  return 0;
}

function nomeEmLinhas(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return {
    primeiroNome: partes.shift() ?? nome,
    sobrenomes: partes.join(' '),
  };
}

export default function PontuacaoScreen() {
  const params = useLocalSearchParams<{ data?: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const { desbravadores, carregar } = useDBVStore();
  const {
    carregarPorData, lancarPontuacao, pontuacoes, config, itens, carregarConfig, salvarConfig,
    criarItemConfig, atualizarItemConfig, excluirItemConfig, salvarCustom, carregarCustomPorData,
    adicionarPontosExtras, pontuacoesUnidades, carregarPontuacoesUnidades,
    criarPontuacaoUnidade, atualizarPontuacaoUnidade, excluirPontuacaoUnidade,
  } = usePontuacaoStore();

  const [aba, setAba] = useState<'membros' | 'unidades'>('membros');
  const [dataObj, setDataObj] = useState<Date>(proximoFimDeSemana());
  const [checks, setChecks] = useState<CheckDBV[]>([]);
  const [customData, setCustomData] = useState<Record<number, Record<number, number>>>({});
  const [unidades, setUnidades] = useState<UnidadeOpcao[]>([]);
  const [unidadeId, setUnidadeId] = useState<number | null>(null);
  const [unidadeNome, setUnidadeNome] = useState('');
  const [unidadePontos, setUnidadePontos] = useState('');
  const [unidadeDescricao, setUnidadeDescricao] = useState('');
  const [unidadeEditId, setUnidadeEditId] = useState<number | null>(null);
  const [buscaUnidade, setBuscaUnidade] = useState('');
  const [salvandoUnidade, setSalvandoUnidade] = useState(false);
  const unidadePontosRef = useRef<TextInput>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showDesconto, setShowDesconto] = useState(false);
  const [salvandoIndicador, setSalvandoIndicador] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [busca, setBusca] = useState('');
  const [buscaAtiva, setBuscaAtiva] = useState(false);

  // Estado do modal de desconto
  const [descontoSelecionados, setDescontoSelecionados] = useState<Set<number>>(new Set());
  const [descontoValor, setDescontoValor] = useState('');
  const [descontoObs, setDescontoObs] = useState('');
  const [descontoBusca, setDescontoBusca] = useState('');
  const [salvandoDesconto, setSalvandoDesconto] = useState(false);

  const [cfgTemp, setCfgTemp] = useState(config);
  const [itensTemp, setItensTemp] = useState<ConfigPontuacaoItem[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [novoValor, setNovoValor] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checksRef = useRef<CheckDBV[]>([]);
  const dirtyIdsRef = useRef<Set<number>>(new Set());
  const dataRef = useRef<string>('');

  const isAdmin = permissoes.pode('gerenciar_pontuacao');
  const usuarioUnidadeId = usuario?.unidade_id;
  const data = format(dataObj, 'yyyy-MM-dd');

  function setDataISO(iso: string) {
    const [ano, mes, dia] = iso.split('-').map(Number);
    if (ano && mes && dia) setDataObj(new Date(ano, mes - 1, dia, 12));
  }

  useEffect(() => {
    carregar();
    carregarConfig();
    carregarUnidades();
  }, []);

  useEffect(() => {
    if (typeof params.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.data)) {
      setDataISO(params.data);
    }
  }, [params.data]);

  useEffect(() => {
    dataRef.current = data;
    carregarPorData(data);
    carregarCustomPorData(data).then(setCustomData);
    carregarPontuacoesUnidades().catch(() => {});
  }, [data]);

  useEffect(() => {
    const lista = (isAdmin ? desbravadores : desbravadores.filter((d) => d.unidade_id === Number(usuarioUnidadeId)))
      .slice()
      .sort((a, b) => {
        const ua = a.unidade_nome || 'Sem unidade';
        const ub = b.unidade_nome || 'Sem unidade';
        return prioridadeUnidade(ua) - prioridadeUnidade(ub)
          || ua.localeCompare(ub, 'pt-BR')
          || a.nome.localeCompare(b.nome, 'pt-BR');
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
  }, [desbravadores, pontuacoes, customData, itens, isAdmin, usuarioUnidadeId]);

  async function carregarUnidades() {
    if (Platform.OS === 'web') {
      const { data: rows } = await supabase
        .from('unidades')
        .select('id, nome')
        .eq('clube_id', getClubeAtivoId())
        .order('nome');
      const reais = (rows ?? [])
        .filter((u) => u.nome !== 'Diretoria' && u.nome !== 'Sem unidade')
        .map((u) => ({ id: Number(u.id), nome: String(u.nome) }));
      if (reais.length > 0) {
        setUnidades(reais);
        if (!unidadeNome) {
          setUnidadeId(reais[0].id);
          setUnidadeNome(reais[0].nome);
        }
        return;
      }
    }
    const mapa = new Map<string, UnidadeOpcao>();
    for (const d of desbravadores) {
      const nome = d.unidade_nome || 'Sem unidade';
      if (nome === 'Diretoria' || nome === 'Sem unidade') continue;
      mapa.set(nome, { id: d.unidade_id ?? null, nome });
    }
    const lista = Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    setUnidades(lista);
    if (!unidadeNome && lista[0]) {
      setUnidadeId(lista[0].id);
      setUnidadeNome(lista[0].nome);
    }
  }

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
    debounceRef.current = setTimeout(() => executarSave(novosChecks, dataRef.current), 10000);
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
        for (const item of customAtivos) {
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
      const novos = prev.map((c) => {
        if (c.dbv_id !== id) return c;
        if (!campoHabilitado(c, campo)) return c;
        if (campo !== 'presenca') return { ...c, [campo]: !c[campo] };
        const novaPresenca = !c.presenca;
        if (novaPresenca || !presencaAtiva) return { ...c, presenca: novaPresenca };
        return {
          ...c,
          presenca: false,
          pontualidade: false,
          material: false,
          uniforme: false,
          custom: Object.fromEntries(Object.keys(c.custom).map((key) => [key, 0])),
        };
      });
      agendarSave(novos, [id]);
      return novos;
    });
  }

  function toggleCustom(id: number, itemId: number) {
    setChecks((prev) => {
      const novos = prev.map((c) => c.dbv_id === id
        ? (campoHabilitado(c) ? { ...c, custom: { ...c.custom, [itemId]: c.custom[itemId] ? 0 : 1 } } : c)
        : c);
      agendarSave(novos, [id]);
      return novos;
    });
  }

  function marcarTodos(campo: CampoBase) {
    setChecks((prev) => {
      const filtradosIds = new Set(checksFiltrados.map((c) => c.dbv_id));
      const elegiveis = prev.filter((c) => filtradosIds.has(c.dbv_id) && campoHabilitado(c, campo));
      const todosMarcados = elegiveis.length > 0 && elegiveis.every((c) => c[campo]);
      const novos = prev.map((c) => {
        if (!filtradosIds.has(c.dbv_id) || !campoHabilitado(c, campo)) return c;
        if (campo !== 'presenca') return { ...c, [campo]: !todosMarcados };
        const novaPresenca = !todosMarcados;
        if (novaPresenca || !presencaAtiva) return { ...c, presenca: novaPresenca };
        return {
          ...c,
          presenca: false,
          pontualidade: false,
          material: false,
          uniforme: false,
          custom: Object.fromEntries(Object.keys(c.custom).map((key) => [key, 0])),
        };
      });
      agendarSave(novos, elegiveis.map((c) => c.dbv_id));
      return novos;
    });
  }

  function marcarTodosCustom(itemId: number) {
    setChecks((prev) => {
      const filtradosIds = new Set(checksFiltrados.map((c) => c.dbv_id));
      const elegiveis = prev.filter((c) => filtradosIds.has(c.dbv_id) && campoHabilitado(c));
      const todosMarcados = prev
        .filter((c) => filtradosIds.has(c.dbv_id) && campoHabilitado(c))
        .every((c) => !!c.custom[itemId]);
      const novos = prev.map((c) => filtradosIds.has(c.dbv_id)
        ? (campoHabilitado(c) ? { ...c, custom: { ...c.custom, [itemId]: todosMarcados ? 0 : 1 } } : c)
        : c);
      agendarSave(novos, elegiveis.map((c) => c.dbv_id));
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
    setItensTemp(itens.map((i) => ({ ...i })));
    setShowConfig(true);
  }

  async function aplicarConfig() {
    const baseItens = itensTemp.filter((item) => campoPadrao(item));
    const novaConfig = baseItens.reduce(
      (acc, item) => {
        const campo = campoPadrao(item);
        return campo ? { ...acc, [campo]: Number(item.valor) || 0 } : acc;
      },
      cfgTemp
    );
    await salvarConfig(novaConfig);
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

  const itensModelados: ItemPontuacaoGrade[] = itens.length > 0
    ? itens.map((item) => ({ ...item, campo: campoPadrao(item) }))
    : BASE_CFG_PADRAO.map((item) => ({ ...item, valor: config[item.campo] }));
  const itensAtivos = itensModelados.filter((i) => i.ativo !== false && i.ativo !== 0);
  const baseAtivos = itensAtivos.filter((i): i is ItemPontuacaoGrade & { campo: CampoBase } => !!i.campo);
  const customAtivos = itensAtivos.filter((i) => !i.campo);
  const larguraPontuacoes = (baseAtivos.length * BASE_COL_WIDTH)
    + (customAtivos.length * CUSTOM_COL_WIDTH)
    + (Math.max(0, baseAtivos.length + customAtivos.length - 1) * COL_GAP)
    + 20;
  const presencaAtiva = baseAtivos.some((b) => b.campo === 'presenca');
  const checksFiltrados = checks.filter((c) =>
    c.nome.toLowerCase().includes(busca.trim().toLowerCase()) ||
    c.unidade_nome.toLowerCase().includes(busca.trim().toLowerCase())
  );
  const primeirosNomesRepetidos = checksFiltrados.reduce((mapa, c) => {
    const chave = chavePrimeiroNome(c.nome);
    if (chave) mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    return mapa;
  }, new Map<string, number>());

  function nomePontuacao(c: CheckDBV) {
    const partes = partesNomePontuacao(c.nome);
    const repetido = (primeirosNomesRepetidos.get(chavePrimeiroNome(c.nome)) ?? 0) > 1;
    return {
      primeiro: partes.primeiro,
      sobrenome: repetido ? partes.sobrenome : '',
    };
  }

  function campoHabilitado(c: CheckDBV, campo?: CampoBase) {
    return !presencaAtiva || campo === 'presenca' || c.presenca;
  }

  function abrirDesconto() {
    setDescontoSelecionados(new Set());
    setDescontoValor('');
    setDescontoObs('');
    setDescontoBusca('');
    setShowDesconto(true);
  }

  function toggleDescontoMembro(id: number) {
    setDescontoSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  function selecionarTodosDesconto() {
    const filtrados = checks.filter((c) =>
      c.nome.toLowerCase().includes(descontoBusca.trim().toLowerCase()) ||
      c.unidade_nome.toLowerCase().includes(descontoBusca.trim().toLowerCase())
    );
    const todosIds = new Set(filtrados.map((c) => c.dbv_id));
    const todosSelecionados = filtrados.every((c) => descontoSelecionados.has(c.dbv_id));
    if (todosSelecionados) {
      setDescontoSelecionados((prev) => {
        const novo = new Set(prev);
        todosIds.forEach((id) => novo.delete(id));
        return novo;
      });
    } else {
      setDescontoSelecionados((prev) => {
        const novo = new Set(prev);
        todosIds.forEach((id) => novo.add(id));
        return novo;
      });
    }
  }

  async function aplicarDesconto() {
    const valor = Number(descontoValor);
    if (descontoSelecionados.size === 0) {
      Alert.alert('Atenção', 'Selecione ao menos um membro.');
      return;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      Alert.alert('Atenção', 'Informe um valor maior que zero.');
      return;
    }
    if (!descontoObs.trim()) {
      Alert.alert('Atenção', 'Informe o motivo do desconto.');
      return;
    }
    setSalvandoDesconto(true);
    try {
      const ids = Array.from(descontoSelecionados);
      await adicionarPontosExtras(ids, data, -valor, descontoObs.trim(), usuario?.nome);
      setShowDesconto(false);
      const nomes = checks
        .filter((c) => descontoSelecionados.has(c.dbv_id))
        .map((c) => c.nome.split(' ')[0])
        .join(', ');
      Alert.alert(
        '−' + valor + ' pts aplicado',
        `Desconto registrado para: ${nomes}.`
      );
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível aplicar o desconto.');
    } finally {
      setSalvandoDesconto(false);
    }
  }

  function selecionarUnidade(u: UnidadeOpcao) {
    setUnidadeId(u.id);
    setUnidadeNome(u.nome);
  }

  function limparFormUnidade() {
    const primeira = unidades[0];
    setUnidadeId(primeira?.id ?? null);
    setUnidadeNome(primeira?.nome ?? '');
    setUnidadePontos('');
    setUnidadeDescricao('');
    setUnidadeEditId(null);
  }

  async function salvarPontuacaoUnidade() {
    const pontos = Number(unidadePontos);
    if (!unidadeNome.trim()) { Alert.alert('Atenção', 'Selecione uma unidade.'); return; }
    if (!Number.isFinite(pontos) || pontos === 0) { Alert.alert('Atenção', 'Informe uma pontuação diferente de zero.'); return; }
    if (!unidadeDescricao.trim()) { Alert.alert('Atenção', 'Informe a descrição da pontuação.'); return; }
    setSalvandoUnidade(true);
    try {
      const dados = {
        unidade_id: unidadeId,
        unidade_nome: unidadeNome.trim(),
        data,
        pontos,
        descricao: unidadeDescricao.trim(),
        lancado_por: usuario?.nome ?? null,
      };
      if (unidadeEditId) await atualizarPontuacaoUnidade(unidadeEditId, dados);
      else await criarPontuacaoUnidade(dados);
      limparFormUnidade();
      await carregarPontuacoesUnidades();
      Alert.alert('Pronto', 'Pontuação da unidade salva.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a pontuação da unidade.');
    } finally {
      setSalvandoUnidade(false);
    }
  }

  function editarPontuacaoUnidade(item: any) {
    setAba('unidades');
    setUnidadeEditId(item.id);
    setUnidadeId(item.unidade_id ?? null);
    setUnidadeNome(item.unidade_nome ?? '');
    setUnidadePontos(String(item.pontos ?? ''));
    setUnidadeDescricao(item.descricao ?? '');
    setDataISO(item.data);
    setTimeout(() => unidadePontosRef.current?.focus(), 120);
  }

  function confirmarExcluirPontuacaoUnidade(id: number) {
    const excluir = async () => {
      try {
        await excluirPontuacaoUnidade(id);
        await carregarPontuacoesUnidades();
        if (unidadeEditId === id) limparFormUnidade();
      } catch (e: any) {
        Alert.alert('Erro', e?.message ?? 'Não foi possível excluir.');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Excluir pontuação?\n\nEsse lançamento direto da unidade será removido do ranking.')) {
        void excluir();
      }
      return;
    }

    Alert.alert('Excluir pontuação?', 'Esse lançamento direto da unidade será removido do ranking.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: excluir,
      },
    ]);
  }

  const pontuacoesUnidadesFiltradas = pontuacoesUnidades.filter((p) =>
    p.unidade_nome.toLowerCase().includes(buscaUnidade.trim().toLowerCase()) ||
    p.descricao.toLowerCase().includes(buscaUnidade.trim().toLowerCase()) ||
    p.data.includes(buscaUnidade.trim())
  );

  if (!usuario) return <Redirect href="/auth/login" />;

  return (
    <View style={styles.container}>
      {!buscaAtiva && <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.titulo}>✅ Pontuação</Text>
          <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addPontBtn}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.addPontText}>Adicionar pontuação</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={abrirDesconto} style={styles.descontarBtn}>
            <Ionicons name="remove-circle-outline" size={18} color="#fff" />
            <Text style={styles.descontarBtnText}>Descontar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={abrirConfig} style={styles.configBtn}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.dateFieldWrap}>
          <DateField
            value={data}
            onChange={setDataISO}
            placeholder="Selecionar data"
            minimumDate={new Date(2026, 0, 1)}
            maximumDate={new Date(2035, 11, 31)}
            defaultDate={dataObj}
          />
        </View>

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
      </View>}

      {!buscaAtiva && <View style={styles.abasTipo}>
        <TouchableOpacity style={[styles.abaTipo, aba === 'membros' && styles.abaTipoAtiva]} onPress={() => setAba('membros')}>
          <Ionicons name="people-outline" size={16} color={aba === 'membros' ? '#fff' : '#1a3a5c'} />
          <Text style={[styles.abaTipoText, aba === 'membros' && styles.abaTipoTextAtiva]}>Membros</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.abaTipo, aba === 'unidades' && styles.abaTipoAtiva]} onPress={() => setAba('unidades')}>
          <Ionicons name="flag-outline" size={16} color={aba === 'unidades' ? '#fff' : '#1a3a5c'} />
          <Text style={[styles.abaTipoText, aba === 'unidades' && styles.abaTipoTextAtiva]}>Unidades</Text>
        </TouchableOpacity>
      </View>}

      {aba === 'membros' ? (
      <>
      <View style={styles.buscaBox}>
        <Ionicons name="search" size={17} color="#789" />
        <TextInput
          style={styles.buscaInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar membro ou unidade..."
          placeholderTextColor="#9aa6b2"
          autoCapitalize="none"
          onFocus={() => setBuscaAtiva(true)}
          onBlur={() => setBuscaAtiva(false)}
        />
        {busca.length > 0 && <TouchableOpacity onPress={() => setBusca('')}><Ionicons name="close-circle" size={18} color="#9aa6b2" /></TouchableOpacity>}
      </View>

      <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
        <View style={styles.gradeShell}>
          <View style={styles.nomesFixos}>
            <View style={styles.nomeHeaderBox}>
              <Text style={styles.nomeHeaderText}>Membro</Text>
            </View>
            {checksFiltrados.map((c, idx) => {
              const unidadeAnterior = idx > 0 ? checksFiltrados[idx - 1].unidade_nome : '';
              const mostraUnidade = idx === 0 || unidadeAnterior !== c.unidade_nome;
              const nomeLinha = nomeEmLinhas(c.nome);
              return (
                <View key={`nome-${c.dbv_id}`}>
                  {mostraUnidade && (
                    <View style={styles.unidadeTituloFixo}>
                      <Text style={styles.unidadeTituloTexto} numberOfLines={1}>{c.unidade_nome}</Text>
                    </View>
                  )}
                  <View style={styles.nomeRowFixa}>
                    <Text style={styles.rowPrimeiroNome} numberOfLines={1}>{nomeLinha.primeiroNome}</Text>
                    {!!nomeLinha.sobrenomes && (
                      <Text style={styles.rowSobrenomes} numberOfLines={2}>{nomeLinha.sobrenomes}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <ScrollView
            horizontal
            style={styles.pontuacoesViewport}
            contentContainerStyle={styles.pontuacoesViewportContent}
            showsHorizontalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ width: Math.max(larguraPontuacoes, 180) }}>
              <View style={styles.colunasHeader}>
                {baseAtivos.map((base) => (
                  <TouchableOpacity key={base.campo} style={styles.colunaTitulo} onPress={() => marcarTodos(base.campo)}>
                    <Text style={styles.colunaSigla}>{itemSigla(base)}</Text>
                    <Text style={styles.colunaNome} numberOfLines={2}>{base.nome}</Text>
                  </TouchableOpacity>
                ))}
                {customAtivos.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.colunaTituloCustom} onPress={() => marcarTodosCustom(item.id)}>
                    <Text style={styles.colunaSigla}>{itemSigla(item)}</Text>
                    <Text style={styles.colunaNome} numberOfLines={2}>{item.nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {checksFiltrados.map((c, idx) => {
                const unidadeAnterior = idx > 0 ? checksFiltrados[idx - 1].unidade_nome : '';
                const mostraUnidade = idx === 0 || unidadeAnterior !== c.unidade_nome;
                return (
                  <View key={`pontos-${c.dbv_id}`}>
                    {mostraUnidade && <View style={styles.unidadeEspacador} />}
                    <View style={styles.checksRow}>
                      {baseAtivos.map((base) => (
                        <TouchableOpacity
                          key={base.campo}
                          style={[styles.checkItem, !campoHabilitado(c, base.campo) && styles.checkItemDisabled]}
                          onPress={() => toggleBase(c.dbv_id, base.campo)}
                          disabled={!campoHabilitado(c, base.campo)}
                        >
                          <View style={[styles.checkBox, c[base.campo] && styles.checkBoxAtivo, !campoHabilitado(c, base.campo) && styles.checkBoxDisabled]}>
                            {c[base.campo] && <Ionicons name="checkmark" size={15} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                      ))}
                      {customAtivos.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.checkItemCustom, !campoHabilitado(c) && styles.checkItemDisabled]}
                          onPress={() => toggleCustom(c.dbv_id, item.id)}
                          disabled={!campoHabilitado(c)}
                        >
                          <View style={[styles.checkBox, c.custom[item.id] ? styles.checkBoxAtivo : null, !campoHabilitado(c) && styles.checkBoxDisabled]}>
                            {!!c.custom[item.id] && <Ionicons name="checkmark" size={15} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
        {checksFiltrados.length === 0 && <Text style={styles.vazio}>Nenhum membro encontrado.</Text>}
        <View style={{ height: 32 }} />
      </ScrollView>
      </>
      ) : (
      <ScrollView style={styles.lista} contentContainerStyle={styles.unidadesContent} keyboardShouldPersistTaps="handled">
        <View style={styles.unidadeFormCard}>
          <Text style={styles.unidadeFormTitulo}>{unidadeEditId ? 'Editar pontuação da unidade' : 'Adicionar pontuação da unidade'}</Text>
          <Text style={styles.inputLabel}>Unidade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unidadeChips}>
            {unidades.map((u) => (
              <TouchableOpacity
                key={`${u.id ?? 'nome'}-${u.nome}`}
                style={[styles.unidadeChip, unidadeNome === u.nome && styles.unidadeChipAtivo]}
                onPress={() => selecionarUnidade(u)}
              >
                <Text style={[styles.unidadeChipText, unidadeNome === u.nome && styles.unidadeChipTextAtivo]}>{u.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {unidades.length === 0 && <Text style={styles.unidadeAjuda}>Nenhuma unidade cadastrada para pontuar diretamente.</Text>}

          <View style={styles.unidadeInputsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Pontos</Text>
              <TextInput
                ref={unidadePontosRef}
                style={styles.textInput}
                value={unidadePontos}
                onChangeText={(v) => setUnidadePontos(v.replace(/[^0-9-]/g, ''))}
                placeholder="Ex.: 50"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.inputLabel}>Data</Text>
              <DateField
                value={data}
                onChange={setDataISO}
                placeholder="Selecionar data"
                minimumDate={new Date(2026, 0, 1)}
                maximumDate={new Date(2035, 11, 31)}
                defaultDate={dataObj}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Descrição</Text>
          <TextInput
            style={[styles.textInput, styles.unidadeDescricaoInput]}
            value={unidadeDescricao}
            onChangeText={setUnidadeDescricao}
            placeholder="Ex.: Organização da unidade, reunião, projeto..."
            multiline
          />
          <View style={styles.unidadeFormActions}>
            {unidadeEditId && (
              <TouchableOpacity style={styles.cancelarEdicaoUnidadeBtn} onPress={limparFormUnidade}>
                <Text style={styles.cancelarEdicaoUnidadeText}>Cancelar edição</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.salvarUnidadeBtn} onPress={salvarPontuacaoUnidade} disabled={salvandoUnidade}>
              <Ionicons name="save-outline" size={17} color="#fff" />
              <Text style={styles.salvarUnidadeText}>{salvandoUnidade ? 'Salvando...' : 'Salvar'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buscaBox}>
          <Ionicons name="search" size={17} color="#789" />
          <TextInput
            style={styles.buscaInput}
            value={buscaUnidade}
            onChangeText={setBuscaUnidade}
            placeholder="Buscar lançamento por unidade, descrição ou data..."
            placeholderTextColor="#9aa6b2"
            autoCapitalize="none"
          />
          {buscaUnidade.length > 0 && <TouchableOpacity onPress={() => setBuscaUnidade('')}><Ionicons name="close-circle" size={18} color="#9aa6b2" /></TouchableOpacity>}
        </View>

        {pontuacoesUnidadesFiltradas.map((item) => (
          <View key={item.id} style={styles.unidadeLancamentoCard}>
            <View style={styles.unidadeLancamentoIcon}>
              <Ionicons name="flag" size={18} color="#1a3a5c" />
            </View>
            <View style={styles.unidadeLancamentoInfo}>
              <Text style={styles.unidadeLancamentoNome}>{item.unidade_nome}</Text>
              <Text style={styles.unidadeLancamentoDesc}>{item.descricao}</Text>
              <Text style={styles.unidadeLancamentoMeta}>{item.data}{item.lancado_por ? ` • ${item.lancado_por}` : ''}</Text>
            </View>
            <Text style={[styles.unidadeLancamentoPts, item.pontos < 0 && { color: '#c62828' }]}>
              {item.pontos > 0 ? '+' : ''}{item.pontos}
            </Text>
            <TouchableOpacity style={styles.unidadeActionBtn} onPress={() => editarPontuacaoUnidade(item)}>
              <Ionicons name="create-outline" size={17} color="#1a3a5c" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.unidadeActionBtn} onPress={() => confirmarExcluirPontuacaoUnidade(item.id)}>
              <Ionicons name="trash-outline" size={17} color="#c62828" />
            </TouchableOpacity>
          </View>
        ))}
        {pontuacoesUnidadesFiltradas.length === 0 && (
          <Text style={styles.vazio}>Nenhuma pontuação direta de unidade registrada.</Text>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
      )}

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
                <Ionicons name="close-circle-outline" size={17} color="#999" />
                <Text style={styles.cancelarText}>Cancelar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Descontar Pontos ─────────────────────────────── */}
      <Modal visible={showDesconto} transparent animationType="slide" onRequestClose={() => setShowDesconto(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalOverlayPress} onPress={() => setShowDesconto(false)}>
            <Pressable style={[styles.modalBox, { maxHeight: '92%' }]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />

              {/* Cabeçalho */}
              <View style={styles.descontoHeader}>
                <View style={styles.descontoIconBox}>
                  <Ionicons name="remove-circle" size={22} color="#c62828" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitulo, { color: '#c62828' }]}>Descontar pontos</Text>
                  <Text style={styles.modalSub}>Selecione membros e informe o valor a descontar.</Text>
                </View>
              </View>

              {/* Valor e motivo */}
              <View style={styles.descontoInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Pontos a descontar</Text>
                  <View style={styles.descontoValorBox}>
                    <Text style={styles.descontoMinus}>−</Text>
                    <TextInput
                      style={styles.descontoValorInput}
                      value={descontoValor}
                      onChangeText={(v) => setDescontoValor(v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#aaa"
                    />
                  </View>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.inputLabel}>Motivo</Text>
                  <TextInput
                    style={[styles.textInput, { marginBottom: 0 }]}
                    value={descontoObs}
                    onChangeText={setDescontoObs}
                    placeholder="Ex.: Comportamento inadequado"
                    placeholderTextColor="#aaa"
                  />
                </View>
              </View>

              {/* Busca de membros */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                Membros{descontoSelecionados.size > 0 ? ` (${descontoSelecionados.size} selecionado${descontoSelecionados.size > 1 ? 's' : ''})` : ''}
              </Text>
              <View style={styles.descontoBuscaBox}>
                <Ionicons name="search" size={15} color="#789" />
                <TextInput
                  style={styles.descontoBuscaInput}
                  value={descontoBusca}
                  onChangeText={setDescontoBusca}
                  placeholder="Filtrar membro ou unidade..."
                  placeholderTextColor="#9aa6b2"
                  autoCapitalize="none"
                />
                {descontoBusca.length > 0 && (
                  <TouchableOpacity onPress={() => setDescontoBusca('')}>
                    <Ionicons name="close-circle" size={16} color="#9aa6b2" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Selecionar todos */}
              <TouchableOpacity style={styles.selecionarTodosBtn} onPress={selecionarTodosDesconto}>
                <Ionicons
                  name={
                    checks
                      .filter((c) =>
                        c.nome.toLowerCase().includes(descontoBusca.trim().toLowerCase()) ||
                        c.unidade_nome.toLowerCase().includes(descontoBusca.trim().toLowerCase())
                      )
                      .every((c) => descontoSelecionados.has(c.dbv_id))
                      ? 'checkbox' : 'square-outline'
                  }
                  size={17}
                  color="#1a3a5c"
                />
                <Text style={styles.selecionarTodosText}>Selecionar todos</Text>
              </TouchableOpacity>

              {/* Lista de membros */}
              <ScrollView style={styles.descontoLista} keyboardShouldPersistTaps="handled">
                {checks
                  .filter((c) =>
                    c.nome.toLowerCase().includes(descontoBusca.trim().toLowerCase()) ||
                    c.unidade_nome.toLowerCase().includes(descontoBusca.trim().toLowerCase())
                  )
                  .map((c) => {
                    const selecionado = descontoSelecionados.has(c.dbv_id);
                    return (
                      <TouchableOpacity
                        key={c.dbv_id}
                        style={[styles.descontoMembroRow, selecionado && styles.descontoMembroSelecionado]}
                        onPress={() => toggleDescontoMembro(c.dbv_id)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.descontoCheckBox, selecionado && styles.descontoCheckBoxAtivo]}>
                          {selecionado && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.descontoMembroNome, selecionado && { color: '#c62828' }]} numberOfLines={1}>
                            {c.nome}
                          </Text>
                          <Text style={styles.descontoMembroUnidade}>{c.unidade_nome}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>

              {/* Botão confirmar */}
              <TouchableOpacity
                style={[styles.descontoConfirmarBtn, (salvandoDesconto || descontoSelecionados.size === 0) && { opacity: 0.55 }]}
                onPress={aplicarDesconto}
                disabled={salvandoDesconto || descontoSelecionados.size === 0}
              >
                <Ionicons name="remove-circle-outline" size={18} color="#fff" />
                <Text style={styles.descontoConfirmarText}>
                  {salvandoDesconto
                    ? 'Aplicando...'
                    : descontoSelecionados.size === 0
                      ? 'Selecione membros'
                      : `Descontar ${descontoValor || '0'} pts de ${descontoSelecionados.size} membro${descontoSelecionados.size > 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelarBtn} onPress={() => setShowDesconto(false)}>
                <Ionicons name="close-circle-outline" size={17} color="#999" />
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

              <ScrollView style={styles.configScroll} contentContainerStyle={styles.configScrollContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.listaItensTitulo}>Itens de pontuação</Text>
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
              </ScrollView>

              <TouchableOpacity style={styles.salvarConfigBtn} onPress={aplicarConfig}>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.salvarConfigText}>Salvar configuração</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelarBtn} onPress={() => setShowConfig(false)}>
                <Ionicons name="close-circle-outline" size={17} color="#999" />
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
  dateFieldWrap: { borderRadius: 10, overflow: 'hidden' },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  dataTexto: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  saveIndicador: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, minHeight: 16 },
  saveText: { color: '#a8c8e8', fontSize: 12 },
  abasTipo: { flexDirection: 'row', gap: 8, marginHorizontal: 12, marginTop: 10, backgroundColor: '#e8edf2', borderRadius: 12, padding: 4 },
  abaTipo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  abaTipoAtiva: { backgroundColor: '#1a3a5c' },
  abaTipoText: { color: '#1a3a5c', fontSize: 13, fontWeight: '800' },
  abaTipoTextAtiva: { color: '#fff' },
  buscaBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 10, marginBottom: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, elevation: 1 },
  buscaInput: { flex: 1, fontSize: 14, color: '#1f2933', paddingVertical: 4 },
  gradeShell: { flexDirection: 'row', width: '100%', alignItems: 'flex-start' },
  nomesFixos: { width: NOME_COL_WIDTH + 12, flexShrink: 0, zIndex: 2 },
  pontuacoesViewport: { flex: 1, minWidth: 0 },
  pontuacoesViewportContent: { alignItems: 'flex-start' },
  colunasHeader: { flexDirection: 'row', alignItems: 'center', height: 62, marginTop: 8, marginRight: 12, marginBottom: 2, paddingHorizontal: 10, backgroundColor: '#e8edf2', borderTopRightRadius: 10, borderBottomRightRadius: 10, gap: COL_GAP },
  nomeHeaderBox: {
    width: NOME_COL_WIDTH,
    height: 62,
    marginTop: 8,
    marginLeft: 12,
    marginBottom: 2,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: '#e8edf2',
    borderRightWidth: 1,
    borderRightColor: '#c9d5df',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  nomeHeaderText: { color: '#1a3a5c', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  colunasScroll: { gap: COL_GAP, paddingRight: 10 },
  colunaTitulo: { alignItems: 'center', justifyContent: 'center', width: BASE_COL_WIDTH, minHeight: 44 },
  colunaTituloCustom: { alignItems: 'center', justifyContent: 'center', width: CUSTOM_COL_WIDTH, minHeight: 44 },
  colunaSigla: { color: '#1a3a5c', fontSize: 12, fontWeight: '900' },
  colunaNome: { color: '#667', fontSize: 8, fontWeight: '700', textAlign: 'center', marginTop: 2, lineHeight: 9 },
  lista: { flex: 1 },
  unidadeTituloFixo: { height: 31, justifyContent: 'flex-end', paddingBottom: 2, paddingLeft: 16 },
  unidadeTituloTexto: { color: '#1a3a5c', fontWeight: '800', fontSize: 13 },
  unidadeEspacador: { height: 31 },
  nomeRowFixa: {
    width: NOME_COL_WIDTH,
    height: 58,
    marginLeft: 12,
    marginTop: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#dde5ec',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    elevation: 1,
  },
  checksRow: { flexDirection: 'row', alignItems: 'center', height: 58, marginTop: 6, marginRight: 12, paddingHorizontal: 10, backgroundColor: '#fff', borderTopRightRadius: 10, borderBottomRightRadius: 10, gap: COL_GAP, elevation: 1 },
  rowPrimeiroNome: { fontSize: 13, fontWeight: '900', color: '#263442', lineHeight: 15 },
  rowSobrenomes: { fontSize: 10, fontWeight: '700', color: '#667788', lineHeight: 12, marginTop: 1 },
  checksScroll: { gap: 10, paddingRight: 10 },
  checkItem: { alignItems: 'center', justifyContent: 'center', width: BASE_COL_WIDTH },
  checkItemCustom: { alignItems: 'center', justifyContent: 'center', width: CUSTOM_COL_WIDTH },
  checkItemDisabled: { opacity: 0.42 },
  checkBox: { width: 30, height: 30, borderRadius: 6, borderWidth: 2, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkBoxAtivo: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  checkBoxDisabled: { backgroundColor: '#f3f5f7', borderColor: '#e1e6ea' },
  vazio: { textAlign: 'center', color: '#999', marginTop: 32, fontSize: 14 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  pickerHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerOkBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  pickerOkText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1 },
  modalOverlayPress: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28, maxHeight: '86%' },
  configScroll: { maxHeight: 430 },
  configScrollContent: { paddingBottom: 8 },
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
  cancelarBtn: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  cancelarText: { color: '#999', fontSize: 15, fontWeight: '600' },

  unidadesContent: { paddingBottom: 24 },
  unidadeFormCard: { backgroundColor: '#fff', margin: 12, padding: 14, borderRadius: 14, elevation: 2 },
  unidadeFormTitulo: { color: '#1a3a5c', fontSize: 16, fontWeight: '900', marginBottom: 12 },
  unidadeChips: { gap: 8, paddingRight: 12, marginBottom: 10 },
  unidadeChip: { borderWidth: 1.5, borderColor: '#d9e2ec', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f7f9fc' },
  unidadeChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  unidadeChipText: { color: '#1a3a5c', fontSize: 12, fontWeight: '800' },
  unidadeChipTextAtivo: { color: '#fff' },
  unidadeAjuda: { color: '#999', fontSize: 12, marginBottom: 10 },
  unidadeInputsRow: { flexDirection: 'row', gap: 10 },
  unidadeDescricaoInput: { minHeight: 84, textAlignVertical: 'top' },
  unidadeFormActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  salvarUnidadeBtn: { flex: 1, backgroundColor: '#1a3a5c', borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  salvarUnidadeText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  cancelarEdicaoUnidadeBtn: { flex: 1, backgroundColor: '#eef3f8', borderRadius: 12, padding: 13, alignItems: 'center' },
  cancelarEdicaoUnidadeText: { color: '#1a3a5c', fontSize: 13, fontWeight: '800' },
  unidadeLancamentoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 12, gap: 9, elevation: 1 },
  unidadeLancamentoIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eef3f8', alignItems: 'center', justifyContent: 'center' },
  unidadeLancamentoInfo: { flex: 1 },
  unidadeLancamentoNome: { color: '#1f2933', fontSize: 14, fontWeight: '900' },
  unidadeLancamentoDesc: { color: '#555', fontSize: 12, marginTop: 2 },
  unidadeLancamentoMeta: { color: '#8898a8', fontSize: 11, marginTop: 3 },
  unidadeLancamentoPts: { minWidth: 46, textAlign: 'right', color: '#1a3a5c', fontSize: 15, fontWeight: '900' },
  unidadeActionBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f4f7fb', alignItems: 'center', justifyContent: 'center' },

  // ── Desconto modal ──────────────────────────────────────────────
  descontarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(198,40,40,0.85)', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 },
  descontarBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  descontoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  descontoIconBox: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fdeaea', alignItems: 'center', justifyContent: 'center' },
  descontoInputRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  descontoValorBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e57373', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff5f5' },
  descontoMinus: { fontSize: 22, fontWeight: '900', color: '#c62828', marginRight: 4 },
  descontoValorInput: { fontSize: 22, fontWeight: '900', color: '#c62828', minWidth: 40, maxWidth: 80 },
  descontoBuscaBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f4f7fb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  descontoBuscaInput: { flex: 1, fontSize: 13, color: '#1f2933', paddingVertical: 2 },
  selecionarTodosBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  selecionarTodosText: { color: '#1a3a5c', fontSize: 13, fontWeight: '800' },
  descontoLista: { maxHeight: 220, borderRadius: 10, backgroundColor: '#fafbfc', marginBottom: 12 },
  descontoMembroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 3, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e9eef3' },
  descontoMembroSelecionado: { backgroundColor: '#fdeaea', borderColor: '#ef9a9a' },
  descontoCheckBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#ccd6e0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  descontoCheckBoxAtivo: { backgroundColor: '#c62828', borderColor: '#c62828' },
  descontoMembroNome: { fontSize: 14, fontWeight: '700', color: '#1f2933' },
  descontoMembroUnidade: { fontSize: 11, color: '#888', marginTop: 1 },
  descontoConfirmarBtn: { backgroundColor: '#c62828', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 4 },
  descontoConfirmarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

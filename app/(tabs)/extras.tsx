import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useDBVStore } from '../../src/stores/dbvStore';
import { usePontuacaoStore } from '../../src/stores/pontuacaoStore';
import { useAuthStore } from '../../src/stores/authStore';
import { getDB } from '../../src/lib/database';
import { adicionarFilaSync } from '../../src/lib/sync';
import { supabase } from '../../src/lib/supabase';
import { DateField } from '../../src/components/DateField';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { combinaBusca } from '../../src/lib/texto';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

type Aba = 'adicionar' | 'historico';

interface ExtraItem {
  // 'item': um lançamento individual em pontuacoes_extras_itens (id positivo,
  // igual ao id da linha lá). 'legado': lançamento antigo, de antes dessa
  // tabela existir, que só tem o total em pontuacoes.pontos_extras — usamos
  // -pontuacoes.id como id aqui só pra não colidir com os ids de 'item'.
  origem: 'item' | 'legado';
  id: number;
  /** id da linha em pontuacoes (pra ajustar pontos_extras ao editar/excluir). */
  pontuacaoId: number;
  dbv_id: number;
  nome: string;
  unidade_nome: string | null;
  data: string;
  pontos_extras: number;
  observacao: string | null;
  lancado_por: string | null;
}

const CORES_UNIDADE: Record<string, string> = {
  'Amor Perfeito': '#e91e63',
  'Sempre Viva':   '#4caf50',
  'Águia Dourada': '#ff9800',
  'Leões':         '#2196f3',
  'Diretoria':     '#9c27b0',
};

function avatarCor(nome: string): string {
  const cores = ['#e74c3c','#e67e22','#f39c12','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63'];
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
  return cores[Math.abs(h) % cores.length];
}

export default function ExtrasScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const params = useLocalSearchParams<{ aba?: string; data?: string; dbv_id?: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const { desbravadores, carregar } = useDBVStore();
  const { adicionarPontosExtras } = usePontuacaoStore();

  const [aba, setAba] = useState<Aba>('adicionar');

  // ── Aba Adicionar ──────────────────────────────────────────────────
  const [busca,        setBusca]        = useState('');
  const [data,         setData]         = useState(format(new Date(), 'yyyy-MM-dd'));
  const [pontos,       setPontos]       = useState('');
  const [descricao,    setDescricao]    = useState('');
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [salvando,     setSalvando]     = useState(false);

  // ── Aba Histórico ──────────────────────────────────────────────────
  const [historico,    setHistorico]    = useState<ExtraItem[]>([]);
  const [carregando,   setCarregando]   = useState(false);
  const [buscaHist,    setBuscaHist]    = useState('');
  const [dataHist,     setDataHist]     = useState('');

  // Modal de edição
  const [modalEdit,    setModalEdit]    = useState(false);
  const [editItem,     setEditItem]     = useState<ExtraItem | null>(null);
  const [editPontos,   setEditPontos]   = useState('');
  const [editDesc,     setEditDesc]     = useState('');
  const [editSalvando, setEditSalvando] = useState(false);

  // Seleção múltipla no histórico
  const [modoSelecao,    setModoSelecao]    = useState(false);
  const [selecionadosHist, setSelecionadosHist] = useState<Set<number>>(new Set());
  const [excluindoLote,  setExcluindoLote]  = useState(false);

  const isAdmin = permissoes.pode('gerenciar_pontuacao');

  useFocusEffect(useCallback(() => {
    carregar();
    if (aba === 'historico') carregarHistorico();
  }, [aba]));

  useFocusEffect(useCallback(() => {
    if (params.data && /^\d{4}-\d{2}-\d{2}$/.test(String(params.data))) {
      const dataParam = String(params.data);
      setData(dataParam);
      setDataHist(dataParam);
    }
    if (params.aba === 'historico') {
      setAba('historico');
      carregarHistorico();
    }
  }, [params.aba, params.data, params.dbv_id]));

  function entrarModoSelecao(id: number) {
    setModoSelecao(true);
    setSelecionadosHist(new Set([id]));
  }

  function sairModoSelecao() {
    setModoSelecao(false);
    setSelecionadosHist(new Set());
  }

  function toggleSelecaoHist(id: number) {
    setSelecionadosHist((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  async function removerPontosExtras(itens: ExtraItem[]) {
    if (itens.length === 0) return;
    const clubeId = getClubeAtivoId();

    if (Platform.OS === 'web') {
      for (const item of itens) {
        if (item.origem === 'legado') {
          const { error } = await supabase
            .from('pontuacoes')
            .update({ pontos_extras: 0, updated_at: new Date().toISOString() })
            .eq('clube_id', clubeId)
            .eq('id', item.pontuacaoId);
          if (error) throw error;
          continue;
        }
        // 'item': apaga só esse lançamento e desconta o valor dele do total
        // guardado em pontuacoes.pontos_extras (que continua existindo pros
        // cálculos que já leem essa coluna).
        const { error: erroDel } = await supabase
          .from('pontuacoes_extras_itens')
          .delete()
          .eq('clube_id', clubeId)
          .eq('id', item.id);
        if (erroDel) throw erroDel;
        const { data: pont } = await supabase
          .from('pontuacoes')
          .select('pontos_extras')
          .eq('id', item.pontuacaoId)
          .maybeSingle();
        if (pont) {
          const { error: erroUpd } = await supabase
            .from('pontuacoes')
            .update({ pontos_extras: (pont.pontos_extras ?? 0) - item.pontos_extras, updated_at: new Date().toISOString() })
            .eq('id', item.pontuacaoId);
          if (erroUpd) throw erroUpd;
        }
      }
      return;
    }

    const db = await getDB();
    for (const item of itens) {
      if (item.origem === 'legado') {
        await db.runAsync(
          `UPDATE pontuacoes SET pontos_extras = 0, updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
          [item.pontuacaoId]
        );
        await adicionarFilaSync('pontuacoes', 'UPDATE', { id: item.pontuacaoId, clube_id: clubeId, pontos_extras: 0 });
        continue;
      }
      await db.runAsync('DELETE FROM pontuacoes_extras_itens WHERE id = ?', [item.id]);
      await adicionarFilaSync('pontuacoes_extras_itens', 'DELETE', { id: item.id });
      const pont = await db.getFirstAsync<{ pontos_extras: number }>(
        'SELECT pontos_extras FROM pontuacoes WHERE id = ?', [item.pontuacaoId]
      );
      if (pont) {
        const novoTotal = (pont.pontos_extras || 0) - item.pontos_extras;
        await db.runAsync(
          `UPDATE pontuacoes SET pontos_extras = ?, updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
          [novoTotal, item.pontuacaoId]
        );
        await adicionarFilaSync('pontuacoes', 'UPDATE', { id: item.pontuacaoId, clube_id: clubeId, pontos_extras: novoTotal });
      }
    }
  }

  async function excluirLote() {
    const qtd = selecionadosHist.size;
    if (qtd === 0) return;

    if (Platform.OS === 'web') {
      const confirmado = typeof window === 'undefined'
        ? true
        : window.confirm(`Remover pontos extras de ${qtd} registro(s) selecionado(s)?`);
      if (!confirmado) return;

      setExcluindoLote(true);
      try {
        await removerPontosExtras(historico.filter((h) => selecionadosHist.has(h.id)));
        sairModoSelecao();
        await carregarHistorico();
      } catch {
        Alert.alert('Erro', 'Não foi possível excluir os registros.');
      } finally {
        setExcluindoLote(false);
      }
      return;
    }

    Alert.alert(
      'Excluir pontos extras',
      `Remover pontos extras de ${qtd} registro(s) selecionado(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            setExcluindoLote(true);
            try {
              await removerPontosExtras(historico.filter((h) => selecionadosHist.has(h.id)));
              sairModoSelecao();
              await carregarHistorico();
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir os registros.');
            } finally {
              setExcluindoLote(false);
            }
          },
        },
      ]
    );
  }

  // Muda de aba e carrega histórico quando necessário
  function mudarAba(nova: Aba) {
    setAba(nova);
    if (nova === 'historico') carregarHistorico();
  }

  async function carregarHistorico() {
    setCarregando(true);
    try {
      const clubeId = getClubeAtivoId();
      const [{ data: pontuacoes, error }, { data: itens, error: erroItens }] = await Promise.all([
        supabase
          .from('pontuacoes')
          .select('id, dbv_id, data, pontos_extras, observacao, lancado_por')
          .eq('clube_id', clubeId)
          .neq('pontos_extras', 0)
          .order('data', { ascending: false }),
        supabase
          .from('pontuacoes_extras_itens')
          .select('id, dbv_id, data, pontos, observacao, lancado_por')
          .eq('clube_id', clubeId)
          .order('data', { ascending: false }),
      ]);
      if (error) throw error;
      if (erroItens) throw erroItens;

      const ids = Array.from(new Set((pontuacoes ?? []).map((p) => Number(p.dbv_id)).filter(Boolean)));
      const { data: membros, error: membrosError } = ids.length
        ? await supabase
            .from('desbravadores')
            .select('id, nome, unidade_nome')
            .eq('clube_id', clubeId)
            .in('id', ids)
        : { data: [], error: null };
      if (membrosError) throw membrosError;

      const membrosPorId = new Map((membros ?? []).map((m) => [Number(m.id), m]));
      setHistorico(montarHistorico(pontuacoes ?? [], itens ?? [], membrosPorId));
      setCarregando(false);
      return;
    } catch {
      if (Platform.OS === 'web') { setHistorico([]); setCarregando(false); return; }
      // Offline no app instalado: cai pro cache local.
    }

    try {
      const db = await getDB();
      const pontuacoes = await db.getAllAsync<any>(
        `SELECT p.id, p.dbv_id, d.nome, d.unidade_nome, p.data, p.pontos_extras, p.observacao, p.lancado_por
         FROM pontuacoes p JOIN desbravadores d ON d.id = p.dbv_id
         WHERE p.pontos_extras != 0`
      );
      const itens = await db.getAllAsync<any>(
        `SELECT pei.id, pei.dbv_id, d.nome, d.unidade_nome, pei.data, pei.pontos, pei.observacao, pei.lancado_por
         FROM pontuacoes_extras_itens pei JOIN desbravadores d ON d.id = pei.dbv_id`
      );
      const membrosPorId = new Map(
        [...pontuacoes, ...itens].map((r: any) => [Number(r.dbv_id), { nome: r.nome, unidade_nome: r.unidade_nome }])
      );
      setHistorico(montarHistorico(pontuacoes, itens, membrosPorId));
    } catch {
      setHistorico([]);
    } finally {
      setCarregando(false);
    }
  }

  /**
   * Junta os dois lados: cada linha de pontuacoes_extras_itens vira um
   * registro próprio (origem 'item'). Um lançamento de pontuacoes só entra
   * como registro (origem 'legado', id negativo pra não colidir) quando NÃO
   * tem nenhum item correspondente — ou seja, foi lançado antes dessa tabela
   * existir e a descrição original já foi perdida (não tem como recuperar).
   */
  function montarHistorico(
    pontuacoes: any[],
    itens: any[],
    membrosPorId: Map<number, { nome: string; unidade_nome: string | null }>
  ): ExtraItem[] {
    const pontuacaoIdPorChave = new Map<string, { id: number; pontos_extras: number }>();
    for (const p of pontuacoes) {
      pontuacaoIdPorChave.set(`${p.dbv_id}|${p.data}`, { id: Number(p.id), pontos_extras: Number(p.pontos_extras) || 0 });
    }
    const chavesComItem = new Set<string>();

    const doItens: ExtraItem[] = itens.map((it: any) => {
      const chave = `${it.dbv_id}|${it.data}`;
      chavesComItem.add(chave);
      const pont = pontuacaoIdPorChave.get(chave);
      const membro = membrosPorId.get(Number(it.dbv_id));
      return {
        origem: 'item',
        id: Number(it.id),
        pontuacaoId: pont?.id ?? 0,
        dbv_id: Number(it.dbv_id),
        nome: membro?.nome ?? 'Membro',
        unidade_nome: membro?.unidade_nome ?? null,
        data: it.data,
        pontos_extras: Number(it.pontos) || 0,
        observacao: it.observacao ?? null,
        lancado_por: it.lancado_por ?? null,
      };
    });

    const doLegado: ExtraItem[] = pontuacoes
      .filter((p) => !chavesComItem.has(`${p.dbv_id}|${p.data}`))
      .map((p: any) => {
        const membro = membrosPorId.get(Number(p.dbv_id));
        return {
          origem: 'legado' as const,
          id: -Number(p.id),
          pontuacaoId: Number(p.id),
          dbv_id: Number(p.dbv_id),
          nome: membro?.nome ?? 'Membro',
          unidade_nome: membro?.unidade_nome ?? null,
          data: p.data,
          pontos_extras: Number(p.pontos_extras) || 0,
          observacao: p.observacao ?? null,
          lancado_por: p.lancado_por ?? null,
        };
      });

    return [...doItens, ...doLegado].sort(
      (a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }

  // ── Aba Adicionar ──────────────────────────────────────────────────
  const lista = desbravadores.filter((d) => {
    if (!isAdmin) return false;
    return combinaBusca(d.nome, busca) || combinaBusca(d.unidade_nome, busca);
  });

  const todosSelecionados = lista.length > 0 && lista.every((d) => selecionados.has(d.id));

  function toggleMembro(id: number) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  function toggleTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(lista.map((d) => d.id)));
  }

  async function aplicar() {
    if (selecionados.size === 0) { Alert.alert('Atenção', 'Selecione ao menos um membro.'); return; }
    const pts = Number(pontos);
    if (!pts || pts === 0) { Alert.alert('Atenção', 'Informe a quantidade de pontos.'); return; }
    setSalvando(true);
    try {
      await adicionarPontosExtras(Array.from(selecionados), data, pts, descricao.trim(), usuario?.nome);
      Alert.alert(
        '✅ Pontos aplicados!',
        `${pts > 0 ? '+' : ''}${pts} pts para ${selecionados.size} membro(s).${descricao ? `\nMotivo: ${descricao}` : ''}`,
        [{ text: 'OK' }]
      );
      setSelecionados(new Set());
      setPontos('');
      setDescricao('');
    } catch {
      Alert.alert('Erro', 'Não foi possível aplicar os pontos.');
    } finally {
      setSalvando(false);
    }
  }

  // ── Aba Histórico: editar ──────────────────────────────────────────
  function abrirEdicao(item: ExtraItem) {
    setEditItem(item);
    setEditPontos(String(item.pontos_extras));
    setEditDesc(item.observacao ?? '');
    setModalEdit(true);
  }

  async function salvarEdicao() {
    if (!editItem) return;
    const pts = Number(editPontos);
    if (isNaN(pts) || pts === 0) { Alert.alert('Atenção', 'Informe um valor de pontos válido.'); return; }
    const clubeId = getClubeAtivoId();
    setEditSalvando(true);
    try {
      if (editItem.origem === 'legado') {
        if (Platform.OS === 'web') {
          const { error } = await supabase
            .from('pontuacoes')
            .update({ pontos_extras: pts, updated_at: new Date().toISOString() })
            .eq('clube_id', clubeId)
            .eq('id', editItem.pontuacaoId);
          if (error) throw error;
        } else {
          const db = await getDB();
          await db.runAsync(
            `UPDATE pontuacoes SET pontos_extras = ?, updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
            [pts, editItem.pontuacaoId]
          );
          await adicionarFilaSync('pontuacoes', 'UPDATE', { id: editItem.pontuacaoId, clube_id: clubeId, pontos_extras: pts });
        }
      } else {
        // 'item': atualiza só esse lançamento e ajusta pontuacoes.pontos_extras
        // pela diferença (não pelo valor novo inteiro — os outros lançamentos
        // da mesma data continuam contando).
        const delta = pts - editItem.pontos_extras;
        if (Platform.OS === 'web') {
          const { error: erroItem } = await supabase
            .from('pontuacoes_extras_itens')
            .update({ pontos: pts, observacao: editDesc.trim() || null, updated_at: new Date().toISOString() })
            .eq('clube_id', clubeId)
            .eq('id', editItem.id);
          if (erroItem) throw erroItem;
          if (delta !== 0) {
            const { data: pont } = await supabase
              .from('pontuacoes')
              .select('pontos_extras')
              .eq('id', editItem.pontuacaoId)
              .maybeSingle();
            if (pont) {
              const { error: erroPont } = await supabase
                .from('pontuacoes')
                .update({ pontos_extras: (pont.pontos_extras ?? 0) + delta, updated_at: new Date().toISOString() })
                .eq('id', editItem.pontuacaoId);
              if (erroPont) throw erroPont;
            }
          }
        } else {
          const db = await getDB();
          await db.runAsync(
            `UPDATE pontuacoes_extras_itens SET pontos = ?, observacao = ?, updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
            [pts, editDesc.trim() || null, editItem.id]
          );
          await adicionarFilaSync('pontuacoes_extras_itens', 'UPDATE', {
            id: editItem.id, clube_id: clubeId, pontos: pts, observacao: editDesc.trim() || null,
          });
          if (delta !== 0) {
            const pont = await db.getFirstAsync<{ pontos_extras: number }>(
              'SELECT pontos_extras FROM pontuacoes WHERE id = ?', [editItem.pontuacaoId]
            );
            if (pont) {
              const novoTotal = (pont.pontos_extras || 0) + delta;
              await db.runAsync(
                `UPDATE pontuacoes SET pontos_extras = ?, updated_at = datetime('now'), sincronizado = 0 WHERE id = ?`,
                [novoTotal, editItem.pontuacaoId]
              );
              await adicionarFilaSync('pontuacoes', 'UPDATE', { id: editItem.pontuacaoId, clube_id: clubeId, pontos_extras: novoTotal });
            }
          }
        }
      }
      setModalEdit(false);
      await carregarHistorico();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setEditSalvando(false);
    }
  }

  async function confirmarExclusao(item: ExtraItem) {
    if (Platform.OS === 'web') {
      const confirmado = typeof window === 'undefined'
        ? true
        : window.confirm(`Remover ${item.pontos_extras} pts de ${item.nome} em ${formatarData(item.data)}?`);
      if (!confirmado) return;

      try {
        await removerPontosExtras([item]);
        await carregarHistorico();
      } catch {
        Alert.alert('Erro', 'Não foi possível excluir os pontos extras.');
      }
      return;
    }

    Alert.alert(
      'Excluir pontos extras',
      `Remover ${item.pontos_extras} pts de ${item.nome} em ${formatarData(item.data)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            await removerPontosExtras([item]);
            await carregarHistorico();
          },
        },
      ]
    );
  }

  function formatarData(d: string) {
    try {
      return format(new Date(d + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR });
    } catch { return d; }
  }

  // ── Filtro histórico ───────────────────────────────────────────────
  const historicoFiltrado = historico.filter((h) => {
    if (dataHist && h.data !== dataHist) return false;
    if (params.dbv_id && h.dbv_id !== Number(params.dbv_id)) return false;
    if (!buscaHist) return true;
    return combinaBusca(h.nome, buscaHist) ||
           combinaBusca(h.unidade_nome, buscaHist) ||
           combinaBusca(h.observacao, buscaHist);
  });

  if (!isAdmin) {
    return (
      <View style={styles.semAcesso}>
        <Ionicons name="lock-closed" size={48} color="#ccc" />
        <Text style={styles.semAcessoText}>Acesso restrito a administradores</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <Text style={styles.titulo}>⭐ Pontos Extras</Text>
        <View style={styles.abas}>
          {([
            { key: 'adicionar', label: 'Adicionar' },
            { key: 'historico', label: 'Histórico' },
          ] as { key: Aba; label: string }[]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.aba, aba === key && styles.abaAtiva]}
              onPress={() => mudarAba(key)}
            >
              <Text style={[styles.abaText, aba === key && styles.abaTextAtiva]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── ABA ADICIONAR ── */}
      {aba === 'adicionar' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          {/* Linha de data */}
          <View style={styles.dataRow}>
            <View style={{ flex: 1 }}>
              <DateField
              value={data}
              onChange={setData}
              placeholder="Selecionar data"
              minimumDate={new Date(2026, 0, 1)}
              maximumDate={new Date(2035, 11, 31)}
              />
            </View>
          </View>

          {/* Busca */}
          <View style={styles.buscaContainer}>
            <Ionicons name="search" size={16} color="#aaa" style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.buscaInput}
              value={busca}
              onChangeText={setBusca}
              placeholder="Filtrar por nome ou unidade..."
              placeholderTextColor="#aaa"
              clearButtonMode="while-editing"
            />
            {busca.length > 0 && (
              <TouchableOpacity onPress={() => setBusca('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={16} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>

          {/* Selecionar todos */}
          <TouchableOpacity style={styles.selecionarTodosRow} onPress={toggleTodos}>
            <View style={[styles.checkbox, todosSelecionados && styles.checkboxAtivo]}>
              {todosSelecionados && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.selecionarTodosText}>
              {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
            </Text>
            <Text style={styles.contadorBadge}>{selecionados.size}/{lista.length} selecionados</Text>
          </TouchableOpacity>

          {/* Lista */}
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {lista.length === 0 && <Text style={styles.vazio}>Nenhum membro encontrado.</Text>}
            {lista.map((d) => {
              const selecionado = selecionados.has(d.id);
              const cor = CORES_UNIDADE[d.unidade_nome ?? ''] ?? avatarCor(d.nome);
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.row, selecionado && styles.rowSelecionado]}
                  onPress={() => toggleMembro(d.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, selecionado && styles.checkboxAtivo]}>
                    {selecionado && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={[styles.avatar, { backgroundColor: cor }]}>
                    <Text style={styles.avatarLetra}>{d.nome[0]}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.nome} numberOfLines={1}>{d.nome}</Text>
                    <View style={[styles.unidadeTag, { backgroundColor: cor + '22' }]}>
                      <Text style={[styles.unidadeText, { color: cor }]}>
                        {d.unidade_nome ?? 'Sem unidade'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 12 }} />
          </ScrollView>

          {/* Painel inferior */}
          <View style={styles.painel}>
            <Text style={styles.painelTitulo}>
              {selecionados.size === 0 ? 'Selecione membros acima' : `${selecionados.size} membro(s) selecionado(s)`}
            </Text>
            <View style={styles.inputsRow}>
              <View style={styles.pontosBox}>
                <Text style={styles.inputLabel}>Pontos</Text>
                <TextInput
                  style={styles.pontosInput}
                  value={pontos}
                  onChangeText={setPontos}
                  keyboardType="numeric"
                  placeholder="ex: 50"
                  placeholderTextColor="#aaa"
                />
              </View>
              <View style={styles.descricaoBox}>
                <Text style={styles.inputLabel}>Motivo (opcional)</Text>
                <TextInput
                  style={styles.descricaoInput}
                  value={descricao}
                  onChangeText={setDescricao}
                  placeholder="ex: Evento especial..."
                  placeholderTextColor="#aaa"
                  maxLength={80}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.aplicarBtn, (selecionados.size === 0 || !pontos || salvando) && styles.aplicarBtnDisabled]}
              onPress={aplicar}
              disabled={selecionados.size === 0 || !pontos || salvando}
            >
              <Ionicons name="star" size={18} color="#fff" />
              <Text style={styles.aplicarText}>
                {salvando ? 'Aplicando...' : `Aplicar ${pontos ? pontos + ' pts' : 'Pontos'}`}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── ABA HISTÓRICO ── */}
      {aba === 'historico' && (
        <View style={{ flex: 1 }}>
          {/* Barra de seleção múltipla */}
          {modoSelecao ? (
            <View style={styles.selecaoBar}>
              <TouchableOpacity onPress={sairModoSelecao} style={styles.selecaoCancelar}>
                <Ionicons name="close" size={20} color="#555" />
              </TouchableOpacity>
              <Text style={styles.selecaoTexto}>
                {selecionadosHist.size} selecionado(s)
              </Text>
              <TouchableOpacity
                style={[styles.selecaoTodos]}
                onPress={() => {
                  const todosIds = new Set(historicoFiltrado.map((h) => h.id));
                  const todosMarcados = historicoFiltrado.every((h) => selecionadosHist.has(h.id));
                  setSelecionadosHist(todosMarcados ? new Set() : todosIds);
                }}
              >
                <Text style={styles.selecaoTodosText}>
                  {historicoFiltrado.every((h) => selecionadosHist.has(h.id)) ? 'Desmarcar todos' : 'Todos'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selecaoExcluir, (selecionadosHist.size === 0 || excluindoLote) && { opacity: 0.4 }]}
                onPress={excluirLote}
                disabled={selecionadosHist.size === 0 || excluindoLote}
              >
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={styles.selecaoExcluirText}>
                  {excluindoLote ? 'Excluindo...' : 'Excluir'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {dataHist ? (
                <View style={styles.filtroDataBar}>
                  <Ionicons name="calendar-outline" size={16} color="#1a3a5c" />
                  <Text style={styles.filtroDataText}>Filtrando {formatarData(dataHist)}</Text>
                  <TouchableOpacity onPress={() => setDataHist('')} style={styles.filtroDataClear}>
                    <Ionicons name="close" size={16} color="#1a3a5c" />
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.buscaContainer}>
                <Ionicons name="search" size={16} color="#aaa" style={{ marginLeft: 10 }} />
                <TextInput
                  style={styles.buscaInput}
                  value={buscaHist}
                  onChangeText={setBuscaHist}
                  placeholder="Filtrar por nome, unidade ou motivo..."
                  placeholderTextColor="#aaa"
                  clearButtonMode="while-editing"
                />
                {buscaHist.length > 0 && (
                  <TouchableOpacity onPress={() => setBuscaHist('')} style={{ padding: 8 }}>
                    <Ionicons name="close-circle" size={16} color="#aaa" />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {!modoSelecao && (
            <Text style={styles.dica}>Segure um item para selecionar vários</Text>
          )}

          <ScrollView style={{ flex: 1 }}>
            {carregando && <Text style={styles.vazio}>Carregando...</Text>}
            {!carregando && historicoFiltrado.length === 0 && (
              <Text style={styles.vazio}>Nenhum registro de pontos extras encontrado.</Text>
            )}
            {historicoFiltrado.map((item) => {
              const cor = CORES_UNIDADE[item.unidade_nome ?? ''] ?? avatarCor(item.nome);
              const marcado = selecionadosHist.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.histItem, marcado && styles.histItemMarcado]}
                  activeOpacity={0.7}
                  onLongPress={() => entrarModoSelecao(item.id)}
                  onPress={() => {
                    if (modoSelecao) {
                      toggleSelecaoHist(item.id);
                    }
                    // em modo normal, não faz nada (botões individuais cuidam)
                  }}
                  delayLongPress={350}
                >
                  {modoSelecao && (
                    <View style={[styles.checkbox, marcado && styles.checkboxAtivo]}>
                      {marcado && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  )}
                  <View style={[styles.avatar, { backgroundColor: cor }]}>
                    <Text style={styles.avatarLetra}>{item.nome[0]}</Text>
                  </View>
                  <View style={styles.histInfo}>
                    <Text style={styles.histNome} numberOfLines={1}>{item.nome}</Text>
                    <Text style={styles.histSub}>
                      {item.unidade_nome ?? 'Sem unidade'} · {formatarData(item.data)}
                    </Text>
                    {item.observacao ? (
                      <Text style={styles.histObs} numberOfLines={1}>"{item.observacao}"</Text>
                    ) : null}
                  </View>
                  <View style={styles.histDireita}>
                    <Text style={[styles.histPts, { color: item.pontos_extras > 0 ? '#2e7d32' : '#c62828' }]}>
                      {item.pontos_extras > 0 ? '+' : ''}{item.pontos_extras}
                    </Text>
                    {!modoSelecao && (
                      <View style={styles.histBotoes}>
                        <TouchableOpacity
                          style={[styles.histBtn, { backgroundColor: '#e8f0fe' }]}
                          onPress={() => abrirEdicao(item)}
                        >
                          <Ionicons name="pencil" size={14} color="#1a3a5c" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.histBtn, { backgroundColor: '#fdecea' }]}
                          onPress={() => confirmarExclusao(item)}
                        >
                          <Ionicons name="trash" size={14} color="#c62828" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      )}

      {/* ── Modal de edição ── */}
      <Modal visible={modalEdit} transparent animationType="fade" onRequestClose={() => setModalEdit(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Editar Pontos Extras</Text>
            {editItem && (
              <Text style={styles.modalSub}>{editItem.nome} · {formatarData(editItem.data)}</Text>
            )}

            <Text style={styles.inputLabel}>Pontos</Text>
            <TextInput
              style={[styles.pontosInput, { marginBottom: 12 }]}
              value={editPontos}
              onChangeText={setEditPontos}
              keyboardType="numeric"
              placeholder="ex: 50"
              placeholderTextColor="#aaa"
              autoFocus
            />

            <Text style={styles.inputLabel}>Motivo (opcional)</Text>
            <TextInput
              style={[styles.descricaoInput, { marginBottom: 16 }]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="ex: Evento especial..."
              placeholderTextColor="#aaa"
              maxLength={80}
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#f0f4f8' }]}
                onPress={() => setModalEdit(false)}
              >
                <Text style={[styles.modalBtnText, { color: '#555' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#1a3a5c' }, editSalvando && { opacity: 0.6 }]}
                onPress={salvarEdicao}
                disabled={editSalvando}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                  {editSalvando ? 'Salvando...' : 'Salvar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f4f8' },
  semAcesso:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  semAcessoText:  { color: '#aaa', fontSize: 15 },

  header:         { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52 },
  titulo:         { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  abas:           { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 3 },
  aba:            { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  abaAtiva:       { backgroundColor: '#fff' },
  abaText:        { color: '#a8c8e8', fontWeight: '600', fontSize: 13 },
  abaTextAtiva:   { color: '#1a3a5c' },

  dataRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  dataInput:      { color: '#333', fontSize: 15, fontWeight: '600' },

  buscaContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 12, marginBottom: 0, borderRadius: 12, elevation: 2 },
  buscaInput:     { flex: 1, padding: 12, fontSize: 14, color: '#222' },

  selecionarTodosRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  selecionarTodosText: { flex: 1, fontSize: 13, color: '#555', fontWeight: '600' },
  contadorBadge:  { fontSize: 12, color: '#888', fontWeight: '600' },

  vazio:          { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 6,
    padding: 12, borderRadius: 12, gap: 10, elevation: 1,
    borderWidth: 2, borderColor: 'transparent',
  },
  rowSelecionado: { borderColor: '#1a3a5c', backgroundColor: '#f0f4ff' },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#ddd',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff',
  },
  checkboxAtivo:  { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  avatar:         { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarLetra:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  info:           { flex: 1 },
  nome:           { fontSize: 14, fontWeight: '700', color: '#222' },
  unidadeTag:     { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 2 },
  unidadeText:    { fontSize: 11, fontWeight: '600' },

  painel:         { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#eee', elevation: 8 },
  painelTitulo:   { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 10, textAlign: 'center' },
  inputsRow:      { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pontosBox:      { width: 90 },
  descricaoBox:   { flex: 1 },
  inputLabel:     { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 4 },
  pontosInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 10, fontSize: 15, textAlign: 'center', fontWeight: '700', color: '#1a3a5c',
  },
  descricaoInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 10, fontSize: 13, color: '#333',
  },
  aplicarBtn: {
    backgroundColor: '#f57c00', borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  aplicarBtnDisabled: { backgroundColor: '#ccc' },
  aplicarText:    { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Histórico
  histItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8,
    padding: 12, borderRadius: 12, gap: 10, elevation: 1,
  },
  histInfo:     { flex: 1 },
  histNome:     { fontSize: 14, fontWeight: '700', color: '#222' },
  histSub:      { fontSize: 12, color: '#888', marginTop: 1 },
  histObs:      { fontSize: 11, color: '#aaa', fontStyle: 'italic', marginTop: 2 },
  histDireita:  { alignItems: 'flex-end', gap: 6 },
  histPts:      { fontSize: 18, fontWeight: '800' },
  histBotoes:   { flexDirection: 'row', gap: 6 },
  histBtn:      { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox:      { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  modalTitulo:   { fontSize: 18, fontWeight: '800', color: '#1a3a5c', marginBottom: 4 },
  modalSub:      { fontSize: 13, color: '#888', marginBottom: 16 },
  modalBotoes:   { flexDirection: 'row', gap: 10 },
  modalBtn:      { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText:  { fontWeight: '700', fontSize: 14 },

  // Seleção múltipla
  selecaoBar:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a3a5c', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  selecaoCancelar:    { padding: 4 },
  selecaoTexto:       { flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 },
  selecaoTodos:       { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8 },
  selecaoTodosText:   { color: '#fff', fontSize: 12, fontWeight: '600' },
  selecaoExcluir:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#c62828', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  selecaoExcluirText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  histItemMarcado:    { backgroundColor: '#fdecea', borderWidth: 1.5, borderColor: '#c62828' },
  dica:               { fontSize: 11, color: '#bbb', textAlign: 'center', paddingVertical: 4 },
  filtroDataBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 10, backgroundColor: '#e8f0fe', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  filtroDataText:     { flex: 1, color: '#1a3a5c', fontSize: 13, fontWeight: '700' },
  filtroDataClear:    { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});

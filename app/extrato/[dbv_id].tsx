import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { useRealtime } from '../../src/lib/realtime';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { carregarConfigRanking, anosEfetivosRanking } from '../../src/lib/rankingConfig';
import { somaPontuacaoBase, linhasCategoriasPontuacao } from '../../src/lib/categoriasPontuacao';
import { carregarExtratoMembro, type LinhaExtrato, type RegistroDia } from '../../src/lib/extratoMembro';
import { buscarPaginado } from '../../src/lib/supabasePaginado';
import { corIcone } from '../../src/lib/tema';

const PONTOS_FALLBACK = { presenca: 25, pontualidade: 100, material: 25, uniforme: 25 };

function anoDaData(data: string): number {
  return Number(String(data).slice(0, 4));
}

interface MembroInfo {
  nome: string;
  unidade_nome: string;
  total: number;
}

export default function ExtratoScreen() {
  const cores = useCores();
  const corCabecalho = useCorCabecalho();
  const { dbv_id } = useLocalSearchParams<{ dbv_id: string }>();
  const permissoes = usePermissoes();
  const podeEditar = permissoes.pode('gerenciar_pontuacao');
  const [membro, setMembro]     = useState<MembroInfo | null>(null);
  const [registros, setRegistros] = useState<RegistroDia[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (dbv_id) carregar(Number(dbv_id));
  }, [dbv_id]);

  // Mantém o extrato atualizado com a tela aberta.
  useRealtime(
    ['pontuacoes', 'pontuacoes_custom', 'pontuacoes_extras_itens'],
    () => { if (dbv_id) carregarDoServidor(Number(dbv_id)); },
    !!dbv_id
  );

  async function carregar(id: number) {
    setCarregando(true);

    // Busca sempre do servidor primeiro (web e app). Antes o app instalado só
    // lia o SQLite local, então o extrato aparecia "sem pontuação registrada"
    // até a sincronização de fundo terminar.
    const okServidor = await carregarDoServidor(id);
    if (okServidor) {
      setCarregando(false);
      return;
    }
    if (Platform.OS === 'web') {
      setMembro({ nome: '—', unidade_nome: '—', total: 0 });
      setRegistros([]);
      setCarregando(false);
      return;
    }

    // Offline no app instalado: cai pro cache local.
    const db = await getDB();

    const cfgRow = await db.getFirstAsync<{ presenca: number; pontualidade: number; material: number; uniforme: number }>(
      'SELECT presenca, pontualidade, material, uniforme FROM config_pontuacao WHERE id = 1'
    );
    const cfg = cfgRow ?? PONTOS_FALLBACK;

    const info = await db.getFirstAsync<{ nome: string; unidade_nome: string }>(
      'SELECT nome, unidade_nome FROM desbravadores WHERE id = ?',
      [id]
    );

    // Sem rede não dá pra ler a configuração de anos do ranking no servidor —
    // usa o mesmo padrão (só o ano corrente) que o ranking aplica quando o
    // clube não tem override configurado, pra bater com o total ali.
    const anos = new Set([new Date().getFullYear()]);

    const pontuacoesTodas = await db.getAllAsync<{
      data: string;
      presenca: number; pontualidade: number; material: number; uniforme: number;
      presenca_pts: number | null; pontualidade_pts: number | null;
      material_pts: number | null; uniforme_pts: number | null;
      bom_biblia: number; pontos_extras: number; classe_biblica: number;
      especialidade: number; pgm_especial: number; atividade_unidade: number;
      observacao: string | null; lancado_por: string | null;
    }>(
      `SELECT data, presenca, pontualidade, material, uniforme,
              presenca_pts, pontualidade_pts, material_pts, uniforme_pts,
              bom_biblia, pontos_extras, classe_biblica, especialidade,
              pgm_especial, atividade_unidade, observacao, lancado_por
       FROM pontuacoes WHERE dbv_id = ? ORDER BY data DESC`,
      [id]
    );
    const pontuacoes = pontuacoesTodas.filter((p) => anos.has(anoDaData(p.data)));

    const customRowsTodas = await db.getAllAsync<{ data: string; total_pontos: number; item_nome: string | null }>(
      `SELECT data, SUM(pontos) as total_pontos, GROUP_CONCAT(COALESCE(item_nome, 'Pontuação especial'), ', ') as item_nome
       FROM pontuacoes_custom WHERE dbv_id = ? GROUP BY data`,
      [id]
    );
    const customRows = customRowsTodas.filter((r) => anos.has(anoDaData(r.data)));
    const customPorData = new Map<string, { total: number; nomes: string }>();
    for (const r of customRows) customPorData.set(r.data, { total: r.total_pontos, nomes: r.item_nome ?? 'Pontuações especiais' });

    const itensExtrasRowsTodas = await db.getAllAsync<{ data: string; pontos: number; observacao: string | null }>(
      `SELECT data, pontos, observacao FROM pontuacoes_extras_itens WHERE dbv_id = ?`,
      [id]
    );
    const itensExtrasRows = itensExtrasRowsTodas.filter((r) => anos.has(anoDaData(r.data)));
    const itensExtrasPorData = new Map<string, { pontos: number; observacao: string | null }[]>();
    for (const it of itensExtrasRows) {
      const lista = itensExtrasPorData.get(it.data) ?? [];
      lista.push({ pontos: it.pontos, observacao: it.observacao });
      itensExtrasPorData.set(it.data, lista);
    }

    let total = 0;
    const dias: RegistroDia[] = pontuacoes.map((p) => {
      const linhas: LinhaExtrato[] = linhasCategoriasPontuacao(p, cfg).map((l) => ({ ...l, tipo: 'base' as const }));
      if (p.pontos_extras) {
        const itensDoDia = itensExtrasPorData.get(p.data) ?? [];
        for (const it of itensDoDia) {
          linhas.push({ label: 'Pontos Extras', pts: it.pontos, icon: 'flash-outline', observacao: it.observacao ?? undefined, tipo: 'extra' });
        }
        // Parte do agregado sem lançamento correspondente no ledger (ex.: pontos
        // lançados antes da tabela de itens existir) — sem isso a tela descartava
        // essa diferença em vez de somá-la, subestimando o extrato do membro.
        const somaItens = itensDoDia.reduce((acc, it) => acc + it.pontos, 0);
        const resto = p.pontos_extras - somaItens;
        if (resto !== 0) {
          linhas.push({ label: 'Pontos Extras', pts: resto, icon: 'flash-outline', observacao: p.observacao ?? undefined, tipo: 'extra' });
        }
      }

      const custom = customPorData.get(p.data);
      if (custom?.total) linhas.push({ label: custom.nomes, pts: custom.total, icon: 'add-circle-outline', tipo: 'custom' });

      const subtotal = somaPontuacaoBase(p, cfg) + (custom?.total ?? 0);

      total += subtotal;

      let dataFormatada = p.data;
      try {
        dataFormatada = format(parseISO(p.data), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
        dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
      } catch {}

      return { data: p.data, dataFormatada, lancado_por: p.lancado_por ?? undefined, linhas, subtotal };
    });

    // Datas só com custom (sem lançamento base)
    for (const [data, custom] of customPorData.entries()) {
      if (!pontuacoes.find((p) => p.data === data)) {
        let dataFormatada = data;
        try {
          dataFormatada = format(parseISO(data), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
          dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
        } catch {}
        dias.push({ data, dataFormatada, linhas: [{ label: custom.nomes, pts: custom.total, icon: 'add-circle-outline', tipo: 'custom' }], subtotal: custom.total });
        total += custom.total;
      }
    }
    dias.sort((a, b) => b.data.localeCompare(a.data));

    setMembro({ nome: info?.nome ?? '—', unidade_nome: info?.unidade_nome ?? '—', total });
    setRegistros(dias);
    setCarregando(false);
  }

  function irParaPontuacao(data: string) {
    router.push({ pathname: '/(tabs)/pontuacao', params: { data } });
  }

  function irParaExtras(data: string) {
    router.push({
      pathname: '/(tabs)/extras',
      params: { aba: 'historico', data, dbv_id: String(dbv_id ?? '') },
    });
  }

  function navegarLinha(dia: RegistroDia, linha: LinhaExtrato) {
    if (!podeEditar) return;
    if (linha.tipo === 'extra' || linha.label === 'Pontos Extras') {
      irParaExtras(dia.data);
      return;
    }
    irParaPontuacao(dia.data);
  }

  /** Retorna true se conseguiu carregar do Supabase; false se falhou (offline). */
  async function carregarDoServidor(id: number): Promise<boolean> {
    try {
      // A conta em si vive em src/lib/extratoMembro.ts — a tela de Ranking
      // mostra o mesmo extrato quando o clube esconde a lista completa, e as
      // duas precisam somar igual.
      const extrato = await carregarExtratoMembro(id, getClubeAtivoId());
      setMembro({ nome: extrato.nome, unidade_nome: extrato.unidade_nome, total: extrato.total });
      setRegistros(extrato.dias);
      return true;
    } catch (erro) {
      console.log('Erro ao carregar extrato do servidor', erro);
      return false;
    }
  }

  if (carregando) {
    return (
      <View style={[styles.loading, { backgroundColor: cores.fundo }]}>
        <ActivityIndicator size="large" color={corIcone(cores)} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: cores.fundo }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerNome} numberOfLines={1}>{membro?.nome}</Text>
          <Text style={styles.headerUnidade}>{membro?.unidade_nome}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalNum}>{membro?.total.toLocaleString('pt-BR')}</Text>
          <Text style={styles.totalLabel}>pts</Text>
        </View>
      </View>

      {registros.length === 0 ? (
        <View style={styles.vazio}>
          <Ionicons name="document-text-outline" size={48} color="#ccc" />
          <Text style={[styles.vazioText, { color: cores.textoSecundario }]}>Nenhuma pontuação registrada.</Text>
        </View>
      ) : (
        <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 32 }}>
          {registros.map((dia, i) => (
            <View key={i} style={[styles.diaCard, { backgroundColor: cores.cartao }]}>
              {/* Cabeçalho do dia */}
              <TouchableOpacity
                style={[styles.diaHeader, { backgroundColor: cores.fundo, borderBottomColor: cores.borda }]}
                onPress={() => podeEditar && irParaPontuacao(dia.data)}
                activeOpacity={podeEditar ? 0.75 : 1}
              >
                <View style={styles.diaHeaderLeft}>
                  <Ionicons name="calendar-outline" size={14} color={corIcone(cores)} />
                  <Text style={[styles.diaData, cores.isEscuro && { color: '#fff' }]}>{dia.dataFormatada}</Text>
                </View>
                {podeEditar && (
                  <Ionicons name="create-outline" size={16} color={corIcone(cores)} style={styles.editarDiaIcon} />
                )}
                <View style={[
                  styles.subtotalBadge,
                  dia.subtotal < 0 && { backgroundColor: '#fce4ec' },
                ]}>
                  <Text style={[
                    styles.subtotalText,
                    dia.subtotal < 0 && { color: '#c62828' },
                  ]}>
                    {dia.subtotal > 0 ? '+' : ''}{dia.subtotal.toLocaleString('pt-BR')} pts
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Linhas de pontuação */}
              {dia.linhas.length === 0 ? (
                <Text style={[styles.semPontos, { color: cores.textoSecundario }]}>Sem itens pontuados</Text>
              ) : (
                dia.linhas.map((l, j) => (
                  <TouchableOpacity
                    key={j}
                    style={[styles.linha, { borderBottomColor: cores.borda }]}
                    onPress={() => navegarLinha(dia, l)}
                    activeOpacity={podeEditar ? 0.7 : 1}
                    disabled={!podeEditar}
                  >
                    <View style={[styles.linhaIconBox, { backgroundColor: cores.fundo }]}>
                      <Ionicons name={l.icon as any} size={16} color={corIcone(cores)} />
                    </View>
                    <View style={styles.linhaInfo}>
                      <Text style={[styles.linhaLabel, { color: cores.texto }]}>{l.label}</Text>
                      {l.observacao ? (
                        <Text style={[styles.linhaObs, { color: cores.textoSecundario }]}>{l.observacao}</Text>
                      ) : null}
                    </View>
                    <Text style={[
                      styles.linhaPts,
                      l.pts < 0 && { color: '#c62828' },
                    ]}>
                      {l.pts > 0 ? '+' : ''}{l.pts}
                    </Text>
                    {podeEditar && <Ionicons name="chevron-forward" size={14} color={cores.textoSecundario} />}
                  </TouchableOpacity>
                ))
              )}

              {/* Lançado por */}
              {dia.lancado_por && (
                <Text style={[styles.lancadoPor, { color: cores.textoSecundario }]}>Lançado por: {dia.lancado_por}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f4f8' },
  loading:        { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:         { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:        { padding: 4 },
  headerInfo:     { flex: 1 },
  headerNome:     { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerUnidade:  { color: '#a8c8e8', fontSize: 13, marginTop: 2 },
  totalBox:       { alignItems: 'flex-end' },
  totalNum:       { color: '#FFD700', fontSize: 22, fontWeight: '900' },
  totalLabel:     { color: '#a8c8e8', fontSize: 11 },

  lista:          { flex: 1 },

  diaCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, overflow: 'hidden', elevation: 2,
  },
  diaHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f4f8',
    backgroundColor: '#f7f9fc',
  },
  diaHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  diaData:        { fontSize: 12, fontWeight: '700', color: '#1a3a5c', flexShrink: 1 },
  editarDiaIcon:  { marginHorizontal: 8 },
  subtotalBadge:  { backgroundColor: '#e8f5e9', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  subtotalText:   { fontSize: 12, fontWeight: '800', color: '#2e7d32' },

  semPontos:      { padding: 14, color: '#bbb', fontSize: 13, textAlign: 'center' },

  linha: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
    gap: 10,
  },
  linhaIconBox:   { width: 30, height: 30, borderRadius: 8, backgroundColor: '#eef3f9', justifyContent: 'center', alignItems: 'center' },
  linhaInfo:      { flex: 1 },
  linhaLabel:     { fontSize: 13, fontWeight: '600', color: '#333' },
  linhaObs:       { fontSize: 11, color: '#888', marginTop: 2 },
  linhaPts:       { fontSize: 14, fontWeight: '800', color: '#1a3a5c', minWidth: 44, textAlign: 'right' },

  lancadoPor:     { fontSize: 11, color: '#bbb', paddingHorizontal: 14, paddingBottom: 10, marginTop: -4 },

  vazio:          { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  vazioText:      { color: '#aaa', fontSize: 15 },
});

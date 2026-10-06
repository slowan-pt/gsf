import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { avisar, confirmar } from '../../src/stores/avisoStore';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import {
  aprovarItem,
  carregarAtividadesEmAndamento,
  carregarItensConcluidos,
  carregarItensParaAprovar,
  type AtividadeEmAndamento,
  type ItemConcluido,
  type ItemParaAprovar,
  type PendenteAtividade,
} from '../../src/lib/aprovacoesClube';
import { corIcone, estiloCartao, tomTexto } from '../../src/lib/tema';
import { Chip, EstadoVazio, Segmentado } from '../../src/components/ui';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { DateField } from '../../src/components/DateField';
import { useAuthStore } from '../../src/stores/authStore';
import { agruparPorItem, carregarAguardandoInvestidura, registrarInvestidura, totais, type ItemAguardando } from '../../src/lib/investidura';
import { devolverClasseParaDiretoria } from '../../src/lib/aprovacoesClube';
import { exportarAptosAReceber } from '../../src/lib/relatorioInvestidura';
import { carregarFilaClasses, type ItemFluxo } from '../../src/lib/fluxoClasses';
import { FilaClasses } from '../../src/components/aprovacao/FilaClasses';

const PERFIS_DIRETORIA = ['admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria'];
const PERFIS_REGIONAL = ['usuario_regional', 'admin_ti', 'admin_total'];
export const PERFIS_APROVACAO = [...PERFIS_DIRETORIA, 'usuario_regional'];

type Aba = 'aprovar' | 'investidura' | 'andamento' | 'concluidas';

function fmt(data: string | null) {
  if (!data) return null;
  const [y, m, d] = data.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function AprovacoesScreen() {
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
  const permissoes = usePermissoes();
  const podeVer = permissoes.temPerfil(PERFIS_APROVACAO);
  const podeDiretoria = permissoes.temPerfil(PERFIS_DIRETORIA);
  const podeRegional = permissoes.temPerfil(PERFIS_REGIONAL);
  // Regional puro: só enxerga a fila do regional (sem Investidura, Andamento, Recebidas).
  const soRegional = podeRegional && !podeDiretoria;
  const clubeId = getClubeAtivoId();

  const [aba, setAba] = useState<Aba>('aprovar');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aAprovar, setAAprovar] = useState<ItemParaAprovar[]>([]);
  const [andamento, setAndamento] = useState<AtividadeEmAndamento[]>([]);
  const [concluidas, setConcluidas] = useState<ItemConcluido[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'classe' | 'especialidade'>('todos');
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState<ItemAguardando[]>([]);
  const [fila, setFila] = useState<ItemFluxo[]>([]);
  const [erroInvestidura, setErroInvestidura] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [dataInvestidura, setDataInvestidura] = useState(() => new Date().toISOString().slice(0, 10));
  const [registrando, setRegistrando] = useState(false);
  const usuarioId = useAuthStore((st) => st.usuario?.id ?? null);

  useFocusEffect(useCallback(() => { if (podeVer) carregar(); }, [clubeId, podeVer]));

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      // Fila do fluxo diretoria -> regional (classes). Falha aqui não derruba o resto.
      try {
        setFila(await carregarFilaClasses(clubeId));
      } catch (e: any) {
        setFila([]);
        if (soRegional) setErro(e?.message ?? 'Não foi possível carregar a fila de classes.');
      }
      if (soRegional) {
        setAAprovar([]); setAndamento([]); setConcluidas([]); setAguardando([]);
        return;
      }
      const [pendentes, emAndamento, feitas] = await Promise.all([
        carregarItensParaAprovar(clubeId),
        carregarAtividadesEmAndamento(clubeId),
        carregarItensConcluidos(clubeId),
      ]);
      setAAprovar(pendentes);
      setAndamento(emAndamento);
      setConcluidas(feitas);
      try {
        setAguardando(await carregarAguardandoInvestidura(clubeId));
        setErroInvestidura(null);
      } catch (e: any) {
        setAguardando([]);
        setErroInvestidura(e?.message ?? 'Não foi possível carregar a investidura.');
      }
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmarAprovacao(item: ItemParaAprovar) {
    const chave = `${item.dbvId}-${item.tipo}-${item.nome}`;
    const msg = `Aprovar "${item.nome}" de ${item.dbvNome}? Ele passa a aguardar a investidura.`;
    const ok = await confirmar('Aprovar', msg, 'Aprovar');
    if (!ok) return;
    setAprovando(chave);
    try {
      await aprovarItem(clubeId, item);
      setAAprovar((prev) => prev.filter((i) => !(i.dbvId === item.dbvId && i.tipo === item.tipo && i.nome === item.nome)));
      void carregar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível registrar a entrega.', 'erro');
    } finally {
      setAprovando(null);
    }
  }

  const filaParaMim = useMemo(
    () => (filtroTipo === 'especialidade' ? [] : fila.filter((f) => (f.etapa === 'diretoria' && podeDiretoria) || (f.etapa === 'regional' && podeRegional))),
    [fila, filtroTipo, podeDiretoria, podeRegional],
  );
  const filaCorrecao = useMemo(
    () => (filtroTipo === 'especialidade' || !podeDiretoria ? [] : fila.filter((f) => f.etapa === 'correcao')),
    [fila, filtroTipo, podeDiretoria],
  );

  const gruposAAprovar = useMemo(() => {
    const porNome = new Map<string, { tipo: 'classe' | 'especialidade'; nome: string; itens: ItemParaAprovar[] }>();
    for (const item of aAprovar) {
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) continue;
      const chave = `${item.tipo}|${item.nome}`;
      const atual = porNome.get(chave) ?? { tipo: item.tipo, nome: item.nome, itens: [] };
      atual.itens.push(item);
      porNome.set(chave, atual);
    }
    return Array.from(porNome.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [aAprovar, filtroTipo]);

  const gruposAndamento = useMemo(() => {
    const porTitulo = new Map<string, { titulo: string; itemFormativoTipo: 'classe' | 'especialidade' | null; itemFormativoNome: string | null; data: string | null; entregues: number; totalEsperado: number; pendentes: PendenteAtividade[] }>();
    for (const a of andamento) {
      const chave = a.itemFormativoNome ? `${a.itemFormativoTipo}|${a.itemFormativoNome}` : `titulo|${a.titulo}`;
      const atual = porTitulo.get(chave) ?? {
        titulo: a.itemFormativoNome ?? a.titulo,
        itemFormativoTipo: a.itemFormativoTipo, itemFormativoNome: a.itemFormativoNome,
        data: a.data, entregues: 0, totalEsperado: 0, pendentes: [],
      };
      atual.entregues += a.entregues;
      atual.totalEsperado += a.totalEsperado;
      for (const p of a.pendentes) if (!atual.pendentes.some((x) => x.dbvId === p.dbvId)) atual.pendentes.push(p);
      porTitulo.set(chave, atual);
    }
    for (const grupo of porTitulo.values()) {
      grupo.pendentes.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    }
    return Array.from(porTitulo.values()).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }, [andamento]);

  const gruposConcluidas = useMemo(() => {
    const porNome = new Map<string, { tipo: 'classe' | 'especialidade'; nome: string; membros: ItemConcluido[] }>();
    for (const item of concluidas) {
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) continue;
      const chave = `${item.tipo}|${item.nome}`;
      const atual = porNome.get(chave) ?? { tipo: item.tipo, nome: item.nome, membros: [] };
      atual.membros.push(item);
      porNome.set(chave, atual);
    }
    return Array.from(porNome.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [concluidas, filtroTipo]);

  const itensInvestidura = useMemo(
    () => aguardando.filter((i) => filtroTipo === 'todos' || i.tipo === filtroTipo),
    [aguardando, filtroTipo],
  );
  const gruposInvestidura = useMemo(() => agruparPorItem(itensInvestidura), [itensInvestidura]);
  const totaisInv = useMemo(() => totais(aguardando), [aguardando]);

  function alternarMarcado(id: number) {
    setMarcados((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function alternarGrupo(ids: number[]) {
    setMarcados((prev) => {
      const n = new Set(prev);
      const todos = ids.every((i) => n.has(i));
      for (const i of ids) { if (todos) n.delete(i); else n.add(i); }
      return n;
    });
  }
  function marcarTodos() {
    const ids = itensInvestidura.map((i) => i.id);
    setMarcados((prev) => (ids.every((i) => prev.has(i)) ? new Set() : new Set(ids)));
  }

  async function voltarParaDiretoria(dbvId: number, nome: string, membro: string) {
    const ok = await confirmar('Voltar para a diretoria', `"${nome}" de ${membro} deixa de aguardar/constar como recebida e volta para a etapa da diretoria.`, 'Voltar');
    if (!ok) return;
    try {
      await devolverClasseParaDiretoria(clubeId, dbvId, nome);
      await carregar();
      avisar('Classe devolvida para a diretoria.', 'sucesso', 'Pronto');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível devolver.', 'erro', 'Aprovações');
    }
  }

  async function registrarInvestiduraRealizada() {
    const ids = itensInvestidura.filter((i) => marcados.has(i.id)).map((i) => i.id);
    if (ids.length === 0) { avisar('Marque ao menos um item.', 'info', 'Investidura'); return; }
    const ok = await confirmar(
      'Investidura realizada',
      `Registrar a entrega de ${ids.length} ${ids.length === 1 ? 'item' : 'itens'} em ${fmt(dataInvestidura)}? Eles saem desta lista e passam a constar como recebidos.`,
      'Registrar',
    );
    if (!ok) return;
    setRegistrando(true);
    try {
      await registrarInvestidura(ids, dataInvestidura, usuarioId);
      setMarcados(new Set());
      await carregar();
      avisar('Investidura registrada.', 'sucesso', 'Pronto');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível registrar a investidura.', 'erro', 'Investidura');
    } finally {
      setRegistrando(false);
    }
  }

  if (!podeVer) return <Redirect href="/" />;

  return (
    <View style={[styles.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Classes & Especialidades" />

      {!soRegional && (
      <View style={styles.abas}>
        <Segmentado
          style={{ flex: 1 }}
          valor={aba}
          onChange={(v) => setAba(v)}
          opcoes={[
            { valor: 'aprovar' as const, rotulo: 'A aprovar', contagem: aAprovar.length + filaParaMim.length },
            { valor: 'investidura' as const, rotulo: 'Aguardando', contagem: aguardando.length },
            { valor: 'andamento' as const, rotulo: 'Andamento', contagem: andamento.length },
            { valor: 'concluidas' as const, rotulo: 'Recebidas', contagem: concluidas.length },
          ]}
        />
      </View>
      )}

      {aba !== 'andamento' && !soRegional && (
        <View style={styles.filtros}>
          {([
            { id: 'todos', label: 'Todos' },
            { id: 'classe', label: 'Classes' },
            { id: 'especialidade', label: 'Especialidades' },
          ] as const).map((op) => (
            <Chip key={op.id} rotulo={op.label} ativo={filtroTipo === op.id} onPress={() => setFiltroTipo(op.id)} />
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
        {!!erro && <EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} />}

        {!loading && aba === 'aprovar' && (filaParaMim.length > 0 || filaCorrecao.length > 0) && (
          <FilaClasses
            clubeId={clubeId}
            paraMim={filaParaMim}
            emCorrecao={filaCorrecao}
            podeDiretoria={podeDiretoria}
            podeRegional={podeRegional}
            onMudou={() => { void carregar(); }}
          />
        )}
        {!loading && aba === 'aprovar' && gruposAAprovar.length === 0 && filaParaMim.length === 0 && filaCorrecao.length === 0 && (
          <EstadoVazio icone="checkmark-done-circle-outline" titulo="Tudo em dia" texto="Nada aguardando aprovação por aqui." />
        )}
        {!loading && aba === 'aprovar' && gruposAAprovar.map((grupo) => {
          const cor = grupo.tipo === 'classe' ? '#7c3aed' : '#f59e0b';
          const chaveGrupo = `${grupo.tipo}|${grupo.nome}`;
          const aberto = grupoAberto === chaveGrupo;
          return (
            <View key={chaveGrupo} style={[styles.card, cores.isEscuro && { backgroundColor: '#1d1932' }, estiloCartao(cores), { borderRadius: 20 }]}>
              <TouchableOpacity style={styles.cardTopo} activeOpacity={0.8} onPress={() => setGrupoAberto(aberto ? null : chaveGrupo)}>
                <View style={[styles.icone, { backgroundColor: `${cor}18` }]}>
                  <Ionicons name={grupo.tipo === 'classe' ? 'ribbon' : 'star'} size={20} color={cor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nome, cores.isEscuro && { color: '#f1eefc' }, { color: cores.texto }]}>{grupo.nome}</Text>
                  <Text style={[styles.sub, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>{grupo.itens.length} aguardando aprovação</Text>
                </View>
                <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color="#b8c2cc" />
              </TouchableOpacity>
              {aberto && (
                <View style={styles.pendentesBox}>
                  {grupo.itens.map((item, i) => {
                    const chaveItem = `${item.dbvId}-${item.tipo}-${item.nome}`;
                    return (
                      <View key={`${chaveItem}-${i}`} style={styles.itemAprovarLinha}>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => router.push(`/membro/${item.dbvId}?aba=${item.tipo === 'classe' ? 'classes' : 'especs'}` as any)}
                        >
                          <Text style={[styles.pendenteTexto, cores.isEscuro && { color: '#abb2b7' }, { color: cores.texto }]}>{item.dbvNome} · {item.unidadeNome}</Text>
                          {item.necessarias > 1 && (
                            <Text style={[styles.itemAprovarDetalhe, cores.isEscuro && { color: '#c6ccd4' }, { color: cores.textoSecundario }]}>{item.aprovadas}/{item.necessarias} avaliações</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.btnAprovarPequeno, aprovando === chaveItem && { opacity: 0.6 }]}
                          onPress={() => confirmarAprovacao(item)}
                          disabled={aprovando === chaveItem}
                        >
                          {aprovando === chaveItem
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Ionicons name="checkmark-done" size={14} color="#fff" />}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {!loading && aba === 'investidura' && (
          <View>
            {erroInvestidura ? (
              <EstadoVazio icone="construct-outline" titulo="Investidura ainda não disponível" texto={erroInvestidura} />
            ) : (
              <>
                <View style={[styles.invResumo, estiloCartao(cores, 17)]} accessible accessibilityLabel={`Aguardando investidura: ${totaisInv.especialidades} especialidades, ${totaisInv.classes} classes, ${totaisInv.membros} membros`}>
                  {[
                    { n: totaisInv.especialidades, l: 'Especialidades' },
                    { n: totaisInv.classes, l: 'Classes' },
                    { n: totaisInv.membros, l: 'Membros' },
                  ].map((x) => (
                    <View key={x.l} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={[styles.invResumoNum, { color: cores.texto }]}>{x.n}</Text>
                      <Text style={[styles.invResumoRot, { color: cores.textoSecundario }]}>{x.l}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.invExportar}>
                  <TouchableOpacity style={[styles.invBotaoSec, { backgroundColor: cores.acentoSuave }]} onPress={() => exportarAptosAReceber(aguardando, 'pdf')} accessibilityRole="button">
                    <Ionicons name="print-outline" size={16} color={cores.acento} />
                    <Text style={[styles.invBotaoSecTexto, { color: cores.acento }]}>PDF / Imprimir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.invBotaoSec, { backgroundColor: cores.acentoSuave }]} onPress={() => exportarAptosAReceber(aguardando, 'excel')} accessibilityRole="button">
                    <Ionicons name="grid-outline" size={16} color={cores.acento} />
                    <Text style={[styles.invBotaoSecTexto, { color: cores.acento }]}>Excel</Text>
                  </TouchableOpacity>
                </View>

                {itensInvestidura.length === 0 ? (
                  <EstadoVazio icone="ribbon-outline" titulo="Nada aguardando investidura" texto="Itens aprovados ou marcados como concluídos aparecem aqui até a investidura ser registrada." />
                ) : (
                  <>
                    <TouchableOpacity onPress={marcarTodos} style={styles.invMarcarTodos} accessibilityRole="checkbox" accessibilityState={{ checked: itensInvestidura.every((i) => marcados.has(i.id)) }}>
                      <View style={[styles.invCaixa, { borderColor: cores.borda }, itensInvestidura.every((i) => marcados.has(i.id)) && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}>
                        {itensInvestidura.every((i) => marcados.has(i.id)) ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                      </View>
                      <Text style={[styles.invMarcarTodosTexto, { color: cores.texto }]}>Marcar todos ({itensInvestidura.length})</Text>
                    </TouchableOpacity>

                    {gruposInvestidura.map((g) => {
                      const ids = g.itens.map((i) => i.id);
                      const todos = ids.every((i) => marcados.has(i));
                      return (
                        <View key={`${g.tipo}|${g.nome}`} style={[styles.card, estiloCartao(cores, 20)]}>
                          <TouchableOpacity onPress={() => alternarGrupo(ids)} style={styles.cardTopo} accessibilityRole="checkbox" accessibilityState={{ checked: todos }} accessibilityLabel={`Marcar todos de ${g.nome}`}>
                            <View style={[styles.invCaixa, { borderColor: cores.borda }, todos && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}>
                              {todos ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.nome, { color: cores.texto }]}>{g.nome}</Text>
                              <Text style={[styles.sub, { color: cores.textoSecundario }]}>{g.tipo === 'classe' ? 'Classe' : 'Especialidade'} · {g.itens.length} {g.itens.length === 1 ? 'membro' : 'membros'}</Text>
                            </View>
                          </TouchableOpacity>
                          <View style={styles.pendentesBox}>
                            {g.itens.map((i) => (
                              <TouchableOpacity key={i.id} onPress={() => alternarMarcado(i.id)} style={styles.pendenteLinha} accessibilityRole="checkbox" accessibilityState={{ checked: marcados.has(i.id) }}>
                                <View style={[styles.invCaixa, { borderColor: cores.borda }, marcados.has(i.id) && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}>
                                  {marcados.has(i.id) ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                                </View>
                                <Text style={[styles.pendenteTexto, { color: cores.texto, flex: 1 }]}>{i.membroNome} · {i.unidadeNome}</Text>
                                {i.tipo === 'classe' && (
                                  <TouchableOpacity accessibilityLabel="Voltar para a diretoria" onPress={() => voltarParaDiretoria(i.dbvId, i.nome, i.membroNome)} style={{ padding: 6 }}>
                                    <Ionicons name="arrow-undo-outline" size={18} color={cores.acento} />
                                  </TouchableOpacity>
                                )}
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      );
                    })}

                    <View style={[styles.invRegistro, estiloCartao(cores, 20)]}>
                      <Text style={[styles.invRotulo, { color: cores.textoSecundario }]}>Data da investidura</Text>
                      <DateField value={dataInvestidura} onChange={setDataInvestidura} placeholder="Selecionar data" />
                      <TouchableOpacity
                        onPress={registrarInvestiduraRealizada}
                        disabled={registrando || marcados.size === 0}
                        accessibilityRole="button"
                        style={[styles.invBotao, { backgroundColor: cores.primaria, boxShadow: `0px 4px 0px ${cores.profundo}` }, (registrando || marcados.size === 0) && { opacity: 0.5 }]}
                      >
                        {registrando ? <ActivityIndicator color="#fff" /> : <Ionicons name="ribbon" size={18} color="#fff" />}
                        <Text style={styles.invBotaoTexto}>Investidura realizada{marcados.size > 0 ? ` (${marcados.size})` : ''}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {!loading && aba === 'andamento' && gruposAndamento.length === 0 && (
          <EstadoVazio icone="hourglass-outline" titulo="Sem entregas pendentes" texto="Nenhuma atividade com entrega pendente." />
        )}
        {!loading && aba === 'andamento' && gruposAndamento.map((grupo) => {
          const chaveGrupo = grupo.itemFormativoNome ? `${grupo.itemFormativoTipo}|${grupo.itemFormativoNome}` : `titulo|${grupo.titulo}`;
          const aberto = grupoAberto === chaveGrupo;
          return (
            <View key={chaveGrupo} style={[styles.card, cores.isEscuro && { backgroundColor: '#1d1932' }, estiloCartao(cores), { borderRadius: 20 }]}>
              <TouchableOpacity style={styles.cardTopo} activeOpacity={0.8} onPress={() => setGrupoAberto(aberto ? null : chaveGrupo)}>
                <View style={[styles.icone, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="hourglass" size={18} color={tomTexto('#0369a1', cores)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nome, cores.isEscuro && { color: '#f1eefc' }, { color: cores.texto }]}>{grupo.titulo}</Text>
                  <Text style={[styles.sub, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>
                    {grupo.entregues}/{grupo.totalEsperado} entregaram{fmt(grupo.data) ? ` · prazo ${fmt(grupo.data)}` : ''}
                  </Text>
                </View>
                <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color="#b8c2cc" />
              </TouchableOpacity>
              {aberto && (
                <View style={styles.pendentesBox}>
                  <Text style={[styles.pendentesTitulo, cores.isEscuro && { color: '#fcc35a' }, { color: cores.textoSecundario }]}>Ainda não entregaram:</Text>
                  {grupo.pendentes.map((p) => (
                    <TouchableOpacity
                      key={p.dbvId}
                      style={styles.pendenteLinha}
                      onPress={() => router.push(`/membro/${p.dbvId}` as any)}
                    >
                      <Ionicons name="person-circle-outline" size={16} color={tomTexto('#7b8794', cores)} />
                      <Text style={[styles.pendenteTexto, cores.isEscuro && { color: '#abb2b7' }, { color: cores.texto }]}>{p.nome} · {p.unidadeNome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {!loading && aba === 'concluidas' && gruposConcluidas.length === 0 && (
          <EstadoVazio icone="ribbon-outline" titulo="Nada concluído ainda" texto="Nenhuma conclusão registrada ainda." />
        )}
        {!loading && aba === 'concluidas' && gruposConcluidas.map((grupo) => {
          const cor = grupo.tipo === 'classe' ? '#7c3aed' : '#f59e0b';
          const chave = `${grupo.tipo}|${grupo.nome}`;
          const aberto = grupoAberto === chave;
          return (
            <View key={chave} style={[styles.card, cores.isEscuro && { backgroundColor: '#1d1932' }, estiloCartao(cores), { borderRadius: 20 }]}>
              <TouchableOpacity
                style={styles.cardTopo}
                activeOpacity={0.8}
                onPress={() => setGrupoAberto(aberto ? null : chave)}
              >
                <View style={[styles.icone, { backgroundColor: `${cor}18` }]}>
                  <Ionicons name={grupo.tipo === 'classe' ? 'ribbon' : 'star'} size={20} color={cor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nome, cores.isEscuro && { color: '#f1eefc' }, { color: cores.texto }]}>{grupo.nome}</Text>
                  <Text style={[styles.sub, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>{grupo.membros.length} {grupo.membros.length === 1 ? 'concluiu' : 'concluíram'}</Text>
                </View>
                <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color="#b8c2cc" />
              </TouchableOpacity>
              {aberto && (
                <View style={styles.pendentesBox}>
                  {grupo.membros.map((m, i) => (
                    <TouchableOpacity
                      key={`${m.dbvId}-${i}`}
                      style={styles.pendenteLinha}
                      onPress={() => router.push(`/membro/${m.dbvId}?aba=${m.tipo === 'classe' ? 'classes' : 'especs'}` as any)}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={tomTexto('#16a34a', cores)} />
                      <Text style={[styles.pendenteTexto, cores.isEscuro && { color: '#abb2b7' }, { color: cores.texto, flex: 1 }]}>{m.dbvNome} · {m.unidadeNome}</Text>
                      {m.tipo === 'classe' && (
                        <TouchableOpacity accessibilityLabel="Voltar para a diretoria" onPress={() => voltarParaDiretoria(m.dbvId, m.nome, m.dbvNome)} style={{ padding: 6 }}>
                          <Ionicons name="arrow-undo-outline" size={18} color={cores.acento} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f3fb' },
  header: {
    backgroundColor: '#7c39e7', paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  voltar: { padding: 4 },
  headerTitulo: { color: '#fff', fontSize: 19, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  // Abas são só filtros: botões compactos, em linha (quebra se faltar espaço), sempre visíveis.
  abas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  aba: { alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#e6e1f4' },
  abaAtiva: { backgroundColor: '#7c39e7' },
  abaTexto: { color: '#4a5866', fontSize: 12, fontWeight: '700' },
  abaTextoAtivo: { color: '#fff' },
  filtros: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#e6e1f4' },
  chipAtivo: { backgroundColor: '#7c39e7' },
  chipTexto: { fontSize: 12, color: '#4a5866', fontWeight: '600' },
  chipTextoAtivo: { color: '#fff' },
  scroll: { padding: 16, paddingTop: 4 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 14 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 14, fontWeight: '700', color: '#1f1b33' },
  sub: { fontSize: 11, color: '#7b8794', marginTop: 2 },
  pendentesBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(127,127,160,0.25)', gap: 6 },
  pendentesTitulo: { fontSize: 11, fontWeight: '700', color: '#b45309', textTransform: 'uppercase' },
  pendenteLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  itemAprovarLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  itemAprovarDetalhe: { fontSize: 10, color: '#9aa5b1', marginTop: 1 },
  btnAprovarPequeno: {
    width: 30, height: 30, borderRadius: 22, backgroundColor: '#16a34a',
    alignItems: 'center', justifyContent: 'center',
  },
  pendenteTexto: { fontSize: 12, color: '#3e4c59' },
  invResumo: { flexDirection: 'row', gap: 8, padding: 14, marginBottom: 12 },
  invResumoNum: { fontSize: 20, fontWeight: '800' },
  invResumoRot: { fontSize: 11 },
  invExportar: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  invBotaoSec: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 14 },
  invBotaoSecTexto: { fontSize: 13, fontWeight: '800' },
  invMarcarTodos: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginBottom: 6 },
  invMarcarTodosTexto: { fontSize: 14, fontWeight: '800' },
  invCaixa: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  invRegistro: { padding: 16, marginTop: 6, gap: 8 },
  invRotulo: { fontSize: 12, fontWeight: '800' },
  invBotao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 14, marginTop: 6 },
  invBotaoTexto: { color: '#fff', fontSize: 15, fontWeight: '900' },
});

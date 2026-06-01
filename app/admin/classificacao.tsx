import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';

interface Criterio {
  id: string;
  item_codigo: string | null;
  requisito: string;
  estrategia: string | null;
  onde_cadastrar: string | null;
  pontuacao_maxima: number;
  observacoes: string | null;
  ordem: number;
}

interface Pontuacao {
  requisito_id: string;
  pontos_atuais: number;
}

interface Nivel {
  nome: string;
  pontos_min: number;
  pontos_max: number | null;
  estrelas: number;
  cor: string | null;
  ordem: number;
}

function numero(valor: unknown) {
  const parsed = Number(valor ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentual(valor: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, Math.round(valor / total * 100))) : 0;
}

function fmt(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function faixa(nivel: Nivel) {
  if (nivel.pontos_max == null) return `${fmt(numero(nivel.pontos_min))}+ pts`;
  return `${fmt(numero(nivel.pontos_min))} a ${fmt(numero(nivel.pontos_max))} pts`;
}

export default function ClassificacaoSGCScreen() {
  const permissoes = usePermissoes();
  const podeVer = permissoes.pode('ver_relatorios') || permissoes.pode('gerenciar_clubes');
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [pontos, setPontos] = useState<Record<string, number>>({});
  const [niveis, setNiveis] = useState<Nivel[]>([]);
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  async function carregar() {
    setCarregando(true);
    const clubeId = getClubeAtivoId();
    const programaId = getProgramaAtivoId();
    const [{ data: reqs }, { data: lancados }, { data: faixas }] = await Promise.all([
      supabase
        .from('ranking_clubes_requisitos')
        .select('id,item_codigo,requisito,estrategia,onde_cadastrar,pontuacao_maxima,observacoes,ordem')
        .eq('programa_id', programaId)
        .eq('escopo', 'SGC')
        .eq('ativo', true)
        .order('ordem'),
      supabase
        .from('ranking_clubes_pontuacoes')
        .select('requisito_id,pontos_atuais')
        .eq('clube_id', clubeId),
      supabase
        .from('ranking_clubes_niveis')
        .select('nome,pontos_min,pontos_max,estrelas,cor,ordem')
        .eq('programa_id', programaId)
        .eq('escopo', 'SGC')
        .eq('ativo', true)
        .order('ordem'),
    ]);

    setCriterios((reqs ?? []) as Criterio[]);
    const mapa: Record<string, number> = {};
    for (const p of (lancados ?? []) as Pontuacao[]) mapa[p.requisito_id] = numero(p.pontos_atuais);
    setPontos(mapa);
    setNiveis((faixas ?? []) as Nivel[]);
    setCarregando(false);
  }

  const resumo = useMemo(() => {
    const total = criterios.reduce((soma, item) => soma + numero(item.pontuacao_maxima), 0);
    const atual = criterios.reduce((soma, item) => soma + numero(pontos[item.id]), 0);
    const nivel = niveis.find((faixaAtual) => {
      const minimo = numero(faixaAtual.pontos_min);
      return atual >= minimo && (faixaAtual.pontos_max == null || atual <= numero(faixaAtual.pontos_max));
    }) ?? niveis[niveis.length - 1];
    return { atual, total, progresso: percentual(atual, total), nivel };
  }, [criterios, pontos, niveis]);

  if (!podeVer) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={44} color="#9aabba" />
          <Text style={styles.lockTitle}>Classificação restrita</Text>
          <Text style={styles.lockText}>Somente perfis autorizados do clube podem acompanhar estes critérios.</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={25} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Classificação 5 Estrelas</Text>
          <Text style={styles.subtitle}>Gestão SGC do clube</Text>
        </View>
        <TouchableOpacity onPress={carregar} style={styles.headerBtn}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1d496e" size="large" />
          <Text style={styles.loadingText}>Carregando classificação...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.definitionCard}>
            <View style={styles.definitionHeader}>
              <Ionicons name="information-circle" size={20} color="#1d496e" />
              <Text style={styles.definitionTitle}>Excelência na organização</Text>
            </View>
            <Text style={styles.definitionText}>
              Este indicador avalia a organização da secretaria e tesouraria no SGC. Não é o ranking de
              membros, unidades ou eventos: todos os clubes podem alcançar cinco estrelas.
            </Text>
          </View>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Pontuação atual</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.score}>{fmt(resumo.atual)} / {fmt(resumo.total)}</Text>
              {!!resumo.nivel && (
                <View style={styles.stars}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Ionicons
                      key={index}
                      name={index < resumo.nivel.estrelas ? 'star' : 'star-outline'}
                      size={18}
                      color={index < resumo.nivel.estrelas ? '#f6b600' : '#b8c6d2'}
                    />
                  ))}
                </View>
              )}
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${resumo.progresso}%` }]} />
            </View>
            <View style={styles.scoreFooter}>
              <Text style={styles.progressText}>{resumo.progresso}% concluído</Text>
              {!!resumo.nivel && <Text style={styles.level}>{resumo.nivel.nome}</Text>}
            </View>
            <Text style={styles.source}>Regras SGC atualizadas em 01/01/2024</Text>
          </View>

          <Text style={styles.sectionTitle}>Faixas de classificação</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.levelScroller}>
            {niveis.map((nivel) => (
              <View
                key={nivel.nome}
                style={[styles.levelCard, resumo.nivel?.nome === nivel.nome && styles.levelCardActive]}
              >
                <View style={styles.levelStars}>
                  {Array.from({ length: nivel.estrelas }).map((_, index) => (
                    <Ionicons key={index} name="star" size={12} color="#f6b600" />
                  ))}
                </View>
                <Text style={styles.levelName}>{nivel.nome}</Text>
                <Text style={styles.levelRange}>{faixa(nivel)}</Text>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>Itens avaliados</Text>
          {criterios.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Nenhum critério cadastrado para este programa.</Text>
            </View>
          ) : criterios.map((criterio) => {
            const atual = numero(pontos[criterio.id]);
            const maximo = numero(criterio.pontuacao_maxima);
            const progresso = percentual(atual, maximo);
            return (
              <View key={criterio.id} style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <View style={styles.itemCode}>
                    <Text style={styles.itemCodeText}>{criterio.item_codigo}</Text>
                  </View>
                  <View style={styles.itemNameArea}>
                    <Text style={styles.itemName}>{criterio.requisito}</Text>
                    {!!criterio.onde_cadastrar && (
                      <Text style={styles.itemPlace}>{criterio.onde_cadastrar}</Text>
                    )}
                  </View>
                  <Text style={styles.itemPoints}>{fmt(atual)}/{fmt(maximo)}</Text>
                </View>
                <View style={styles.itemBar}>
                  <View style={[styles.itemBarFill, { width: `${progresso}%` }]} />
                </View>
                {!!criterio.estrategia && <Text style={styles.itemDescription}>{criterio.estrategia}</Text>}
                {!!criterio.observacoes && <Text style={styles.itemNote}>{criterio.observacoes}</Text>}
              </View>
            );
          })}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  header: { backgroundColor: '#1d496e', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  headerText: { flex: 1 },
  title: { color: '#fff', fontSize: 23, fontWeight: '900' },
  subtitle: { color: '#b4d0e9', marginTop: 3, fontSize: 13 },
  content: { padding: 14, paddingBottom: 44 },
  center: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: '#718291', marginTop: 6 },
  lockTitle: { fontSize: 18, fontWeight: '800', color: '#1d496e', marginTop: 10 },
  lockText: { color: '#718291', textAlign: 'center', maxWidth: 320 },
  definitionCard: { padding: 15, backgroundColor: '#f4f9fd', borderRadius: 16, borderWidth: 1, borderColor: '#d2e4f2', marginBottom: 12 },
  definitionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  definitionTitle: { color: '#1d496e', fontWeight: '900', fontSize: 14 },
  definitionText: { color: '#516270', lineHeight: 19, fontSize: 13 },
  scoreCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dce5ee', padding: 16, marginBottom: 17 },
  scoreLabel: { color: '#718291', fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  scoreRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  score: { color: '#1d496e', fontSize: 27, fontWeight: '900' },
  stars: { flexDirection: 'row', gap: 2 },
  bar: { height: 12, borderRadius: 20, backgroundColor: '#e3ebf3', overflow: 'hidden', marginTop: 14 },
  barFill: { height: 12, borderRadius: 20, backgroundColor: '#2e7d32' },
  scoreFooter: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontWeight: '700', color: '#516270' },
  level: { fontWeight: '900', color: '#1d496e' },
  source: { color: '#718291', fontSize: 11, marginTop: 15 },
  sectionTitle: { color: '#1d496e', fontSize: 16, fontWeight: '900', marginBottom: 10 },
  levelScroller: { marginHorizontal: -2, marginBottom: 20 },
  levelCard: { minWidth: 118, backgroundColor: '#fff', borderRadius: 13, padding: 11, marginHorizontal: 2, marginRight: 7, borderWidth: 1, borderColor: '#dce5ee' },
  levelCardActive: { borderColor: '#f6b600', backgroundColor: '#fffaf0' },
  levelStars: { flexDirection: 'row', minHeight: 16 },
  levelName: { fontWeight: '900', color: '#1d496e', fontSize: 12, marginTop: 5 },
  levelRange: { color: '#718291', fontSize: 10, marginTop: 3 },
  itemCard: { backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#dce5ee' },
  itemTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  itemCode: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#eef5fb', alignItems: 'center', justifyContent: 'center' },
  itemCodeText: { color: '#1d496e', fontSize: 12, fontWeight: '900' },
  itemNameArea: { flex: 1 },
  itemName: { color: '#1f2933', fontSize: 14, fontWeight: '900' },
  itemPlace: { color: '#56748f', fontSize: 11, marginTop: 3, fontWeight: '700' },
  itemPoints: { color: '#1d496e', fontWeight: '900', fontSize: 12 },
  itemBar: { marginTop: 11, height: 7, backgroundColor: '#e8eef5', borderRadius: 10, overflow: 'hidden' },
  itemBarFill: { height: 7, borderRadius: 10, backgroundColor: '#f6a400' },
  itemDescription: { color: '#516270', fontSize: 12, lineHeight: 17, marginTop: 10 },
  itemNote: { color: '#718291', fontSize: 11, lineHeight: 16, marginTop: 5 },
  emptyCard: { padding: 18, backgroundColor: '#fff', borderRadius: 14, alignItems: 'center' },
  emptyText: { color: '#718291' },
});

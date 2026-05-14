import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDB } from '../../src/lib/database';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PONTOS = { presenca: 25, pontualidade: 100, material: 25, uniforme: 25 };

interface LinhaExtrato {
  label: string;
  pts: number;
  icon: string;
  observacao?: string;
}

interface RegistroDia {
  data: string;
  dataFormatada: string;
  lancado_por?: string;
  linhas: LinhaExtrato[];
  subtotal: number;
}

interface MembroInfo {
  nome: string;
  unidade_nome: string;
  total: number;
}

export default function ExtratoScreen() {
  const { dbv_id } = useLocalSearchParams<{ dbv_id: string }>();
  const [membro, setMembro]     = useState<MembroInfo | null>(null);
  const [registros, setRegistros] = useState<RegistroDia[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (dbv_id) carregar(Number(dbv_id));
  }, [dbv_id]);

  async function carregar(id: number) {
    const db = await getDB();

    const info = await db.getFirstAsync<{ nome: string; unidade_nome: string }>(
      'SELECT nome, unidade_nome FROM desbravadores WHERE id = ?',
      [id]
    );

    const pontuacoes = await db.getAllAsync<{
      data: string;
      presenca: number; pontualidade: number; material: number; uniforme: number;
      bom_biblia: number; pontos_extras: number; classe_biblica: number;
      especialidade: number; pgm_especial: number; atividade_unidade: number;
      observacao: string | null; lancado_por: string | null;
    }>(
      `SELECT data, presenca, pontualidade, material, uniforme,
              bom_biblia, pontos_extras, classe_biblica, especialidade,
              pgm_especial, atividade_unidade, observacao, lancado_por
       FROM pontuacoes WHERE dbv_id = ? ORDER BY data DESC`,
      [id]
    );

    let total = 0;
    const dias: RegistroDia[] = pontuacoes.map((p) => {
      const linhas: LinhaExtrato[] = [];

      if (p.presenca)      linhas.push({ label: 'Presença',           pts: PONTOS.presenca,      icon: 'person-outline' });
      if (p.pontualidade)  linhas.push({ label: 'Pontualidade',       pts: PONTOS.pontualidade,  icon: 'time-outline' });
      if (p.material)      linhas.push({ label: 'Material',           pts: PONTOS.material,      icon: 'book-outline' });
      if (p.uniforme)      linhas.push({ label: 'Uniforme',           pts: PONTOS.uniforme,      icon: 'shirt-outline' });
      if (p.bom_biblia)    linhas.push({ label: 'Bom da Bíblia',      pts: p.bom_biblia,         icon: 'library-outline' });
      if (p.classe_biblica) linhas.push({ label: 'Classe Bíblica',    pts: p.classe_biblica,     icon: 'ribbon-outline' });
      if (p.especialidade)  linhas.push({ label: 'Especialidade',     pts: p.especialidade,      icon: 'star-outline' });
      if (p.pgm_especial)   linhas.push({ label: 'Pgm Especial',      pts: p.pgm_especial,       icon: 'musical-notes-outline' });
      if (p.atividade_unidade) linhas.push({ label: 'Ativ. Unidade',  pts: p.atividade_unidade,  icon: 'people-outline' });
      if (p.pontos_extras)  linhas.push({
        label: 'Pontos Extras',
        pts: p.pontos_extras,
        icon: 'flash-outline',
        observacao: p.observacao ?? undefined,
      });

      const subtotal =
        (p.presenca ? PONTOS.presenca : 0) +
        (p.pontualidade ? PONTOS.pontualidade : 0) +
        (p.material ? PONTOS.material : 0) +
        (p.uniforme ? PONTOS.uniforme : 0) +
        p.bom_biblia + p.pontos_extras + p.classe_biblica +
        p.especialidade + p.pgm_especial + p.atividade_unidade;

      total += subtotal;

      let dataFormatada = p.data;
      try {
        dataFormatada = format(parseISO(p.data), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
        dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
      } catch {}

      return {
        data: p.data,
        dataFormatada,
        lancado_por: p.lancado_por ?? undefined,
        linhas,
        subtotal,
      };
    });

    setMembro({ nome: info?.nome ?? '—', unidade_nome: info?.unidade_nome ?? '—', total });
    setRegistros(dias);
    setCarregando(false);
  }

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1a3a5c" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
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
          <Text style={styles.vazioText}>Nenhuma pontuação registrada.</Text>
        </View>
      ) : (
        <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 32 }}>
          {registros.map((dia, i) => (
            <View key={i} style={styles.diaCard}>
              {/* Cabeçalho do dia */}
              <View style={styles.diaHeader}>
                <View style={styles.diaHeaderLeft}>
                  <Ionicons name="calendar-outline" size={14} color="#1a3a5c" />
                  <Text style={styles.diaData}>{dia.dataFormatada}</Text>
                </View>
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
              </View>

              {/* Linhas de pontuação */}
              {dia.linhas.length === 0 ? (
                <Text style={styles.semPontos}>Sem itens pontuados</Text>
              ) : (
                dia.linhas.map((l, j) => (
                  <View key={j} style={styles.linha}>
                    <View style={styles.linhaIconBox}>
                      <Ionicons name={l.icon as any} size={16} color="#1a3a5c" />
                    </View>
                    <View style={styles.linhaInfo}>
                      <Text style={styles.linhaLabel}>{l.label}</Text>
                      {l.observacao ? (
                        <Text style={styles.linhaObs}>{l.observacao}</Text>
                      ) : null}
                    </View>
                    <Text style={[
                      styles.linhaPts,
                      l.pts < 0 && { color: '#c62828' },
                    ]}>
                      {l.pts > 0 ? '+' : ''}{l.pts}
                    </Text>
                  </View>
                ))
              )}

              {/* Lançado por */}
              {dia.lancado_por && (
                <Text style={styles.lancadoPor}>Lançado por: {dia.lancado_por}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
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

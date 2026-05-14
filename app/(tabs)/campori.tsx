import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useDBVStore } from '../../src/stores/dbvStore';
import { useCamporiStore } from '../../src/stores/camporiStore';
import { useAuthStore } from '../../src/stores/authStore';
import type { Desbravador } from '../../src/types';

type Filtro = 'todos' | 'inscritos' | 'faltando';

export default function CamporiScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const { desbravadores, carregar, atualizarCampori } = useDBVStore();
  const { config, pagamentos, carregarConfig, carregarPagamentos, marcarPago, desmarcarPago, getResumoFinanceiro } = useCamporiStore();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [modalConfig, setModalConfig] = useState(false);
  const [dbvSelecionado, setDBVSelecionado] = useState<Desbravador | null>(null);

  useEffect(() => {
    carregar();
    carregarConfig();
    carregarPagamentos();
  }, []);

  const resumo = getResumoFinanceiro();

  if (!usuario) return <Redirect href="/auth/login" />;

  const inscritos = desbravadores.filter((d) => d.campori_dsa);
  const filtrados = desbravadores
    .filter((d) => {
      const nomeOk = d.nome.toLowerCase().includes(busca.toLowerCase());
      if (filtro === 'inscritos') return d.campori_dsa && nomeOk;
      if (filtro === 'faltando') {
        const pgts = pagamentos.filter((p) => p.dbv_id === d.id && p.pago);
        return d.campori_dsa && pgts.length < (config?.num_parcelas ?? 4) && nomeOk;
      }
      return nomeOk;
    });

  function getPagamentosDBV(dbv_id: number) {
    return pagamentos.filter((p) => p.dbv_id === dbv_id);
  }

  function getParcelaStatus(dbv_id: number, parcela: number) {
    return pagamentos.find((p) => p.dbv_id === dbv_id && p.parcela_numero === parcela);
  }

  async function toggleParcela(dbv_id: number, parcela: number) {
    const pg = getParcelaStatus(dbv_id, parcela);
    const valorParcela = config?.parcelas.find((p) => p.numero === parcela)?.valor ?? 90;
    if (pg?.pago) {
      Alert.alert('Desmarcar pagamento?', `Parcela ${parcela} de R$${valorParcela}`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desmarcar', onPress: () => desmarcarPago(dbv_id, parcela) },
      ]);
    } else {
      await marcarPago(dbv_id, parcela, valorParcela);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.titulo}>✈️ Campori DSA</Text>
          <TouchableOpacity onPress={() => setModalConfig(true)}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.resumoCards}>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoNum}>{inscritos.length}</Text>
            <Text style={styles.resumoLabel}>Inscritos</Text>
          </View>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoNum}>R${resumo.totalArrecadado.toFixed(0)}</Text>
            <Text style={styles.resumoLabel}>Arrecadado</Text>
          </View>
          <View style={styles.resumoCard}>
            <Text style={[styles.resumoNum, { color: '#ffcdd2' }]}>R${resumo.totalFaltando.toFixed(0)}</Text>
            <Text style={styles.resumoLabel}>Faltando</Text>
          </View>
        </View>

        <View style={styles.barraContainer}>
          <View style={[styles.barra, { width: `${resumo.totalEsperado > 0 ? (resumo.totalArrecadado / resumo.totalEsperado) * 100 : 0}%` }]} />
        </View>
      </View>

      <View style={styles.filtrosRow}>
        {(['todos', 'inscritos', 'faltando'] as Filtro[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroChip, filtro === f && styles.filtroChipAtivo]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filtroText, filtro === f && styles.filtroTextAtivo]}>
              {f === 'todos' ? 'Todos' : f === 'inscritos' ? 'Inscritos' : 'Com pendências'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.busca}
        value={busca}
        onChangeText={setBusca}
        placeholder="Buscar..."
        placeholderTextColor="#aaa"
      />

      <ScrollView style={styles.lista}>
        {filtrados.map((dbv) => {
          const parcelas = config?.parcelas ?? [];
          const pagas = parcelas.filter((p) => getParcelaStatus(dbv.id, p.numero)?.pago).length;

          return (
            <View key={dbv.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardNome}>{dbv.nome}</Text>
                  <Text style={styles.cardSub}>{dbv.unidade_nome}</Text>
                </View>
                <View style={styles.camporiToggle}>
                  <Text style={styles.camporiLabel}>{dbv.campori_dsa ? '✅ Vai' : '❌ Não vai'}</Text>
                  <Switch
                    value={dbv.campori_dsa}
                    onValueChange={(v) => atualizarCampori(dbv.id, v)}
                    trackColor={{ false: '#ddd', true: '#1a3a5c' }}
                    thumbColor="#fff"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
              </View>

              {dbv.campori_dsa && (
                <View style={styles.parcelasRow}>
                  {parcelas.map((p) => {
                    const pago = getParcelaStatus(dbv.id, p.numero)?.pago ?? false;
                    return (
                      <TouchableOpacity
                        key={p.numero}
                        style={[styles.parcelaBtn, pago && styles.parcelaBtnPaga]}
                        onPress={() => toggleParcela(dbv.id, p.numero)}
                      >
                        <Text style={[styles.parcelaNum, pago && { color: '#fff' }]}>{p.numero}</Text>
                        <Text style={[styles.parcelaValor, pago && { color: '#c8e6c9' }]}>R${p.valor.toFixed(0)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={styles.parcelasResumo}>
                    <Text style={styles.parcelasResumoText}>{pagas}/{parcelas.length}</Text>
                    <Text style={styles.parcelasResumoSub}>pagas</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <ConfigModal visible={modalConfig} onClose={() => setModalConfig(false)} />
    </View>
  );
}

function ConfigModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { config, salvarConfig } = useCamporiStore();
  const [numParcelas, setNumParcelas] = useState('4');
  const [valores, setValores] = useState(['130', '130', '90', '90']);

  useEffect(() => {
    if (config) {
      setNumParcelas(String(config.num_parcelas));
      setValores(config.parcelas.map((p) => String(p.valor)));
    }
  }, [config]);

  async function salvar() {
    const n = parseInt(numParcelas);
    if (isNaN(n) || n < 1 || n > 12) {
      Alert.alert('Erro', 'Número de parcelas deve ser entre 1 e 12.');
      return;
    }
    const parcelas = Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      valor: parseFloat(valores[i] ?? '90') || 90,
      descricao: `${i + 1}ª Parcela`,
    }));
    await salvarConfig(n, parcelas);
    Alert.alert('Salvo!', 'Configuração de parcelas atualizada.');
    onClose();
  }

  const n = parseInt(numParcelas) || 4;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitulo}>⚙️ Configurar Parcelas</Text>

          <Text style={styles.modalLabel}>Número de parcelas</Text>
          <TextInput
            style={styles.modalInput}
            value={numParcelas}
            onChangeText={setNumParcelas}
            keyboardType="numeric"
          />

          <Text style={styles.modalLabel}>Valores por parcela (R$)</Text>
          {Array.from({ length: Math.min(n, 12) }, (_, i) => (
            <View key={i} style={styles.parcelaInputRow}>
              <Text style={styles.parcelaInputLabel}>{i + 1}ª Parcela</Text>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                value={valores[i] ?? '90'}
                onChangeText={(v) => {
                  const novos = [...valores];
                  novos[i] = v;
                  setValores(novos);
                }}
                keyboardType="numeric"
              />
            </View>
          ))}

          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={onClose}>
              <Text style={styles.modalBtnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnSalvar} onPress={salvar}>
              <Text style={styles.modalBtnSalvarText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  titulo: { color: '#fff', fontSize: 22, fontWeight: '800' },
  resumoCards: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  resumoCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 10, alignItems: 'center' },
  resumoNum: { color: '#fff', fontSize: 18, fontWeight: '800' },
  resumoLabel: { color: '#a8c8e8', fontSize: 11, marginTop: 2 },
  barraContainer: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
  barra: { height: 6, backgroundColor: '#4caf50', borderRadius: 3 },
  filtrosRow: { flexDirection: 'row', padding: 12, gap: 8 },
  filtroChip: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff', borderRadius: 20, elevation: 1 },
  filtroChipAtivo: { backgroundColor: '#1a3a5c' },
  filtroText: { color: '#555', fontSize: 13 },
  filtroTextAtivo: { color: '#fff', fontWeight: '700' },
  busca: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 14, elevation: 1 },
  lista: { flex: 1 },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 14, padding: 14, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#222' },
  cardSub: { fontSize: 12, color: '#888', marginTop: 2 },
  camporiToggle: { alignItems: 'center' },
  camporiLabel: { fontSize: 11, color: '#555' },
  parcelasRow: { flexDirection: 'row', marginTop: 12, gap: 8, alignItems: 'center' },
  parcelaBtn: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 8, alignItems: 'center' },
  parcelaBtnPaga: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  parcelaNum: { fontSize: 13, fontWeight: '700', color: '#333' },
  parcelaValor: { fontSize: 10, color: '#888', marginTop: 2 },
  parcelasResumo: { alignItems: 'center', minWidth: 36 },
  parcelasResumoText: { fontSize: 14, fontWeight: '800', color: '#1a3a5c' },
  parcelasResumoSub: { fontSize: 10, color: '#888' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: '#1a3a5c', marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#222' },
  parcelaInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  parcelaInputLabel: { width: 80, fontSize: 13, color: '#666' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtnCancel: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  modalBtnCancelText: { color: '#666', fontWeight: '600' },
  modalBtnSalvar: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#1a3a5c', alignItems: 'center' },
  modalBtnSalvarText: { color: '#fff', fontWeight: '700' },
});

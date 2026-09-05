import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { registrarAuditoria } from '../../src/lib/auditoria';
import { BottomNav } from '../../src/components/BottomNav';
import { combinaBusca } from '../../src/lib/texto';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

interface Programa {
  id: number;
  codigo: string;
  nome: string;
  idade_minima_membro: number | null;
  idade_maxima_membro: number | null;
  idade_minima_diretoria: number | null;
}

interface Clube {
  id: number;
  programa_id: number;
  nome: string;
  nome_curto: string | null;
  codigo: string | null;
  igreja: string | null;
  distrito: string | null;
  regional: string | null;
  cidade: string | null;
  uf: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  ativo: boolean;
  min_faltas_faltosos: number | null;
  created_at?: string | null;
  programa?: Programa | null;
}

interface FormClube {
  id?: number;
  programa_id: number | null;
  nome: string;
  nome_curto: string;
  codigo: string;
  igreja: string;
  distrito: string;
  regional: string;
  cidade: string;
  uf: string;
  cor_primaria: string;
  cor_secundaria: string;
  ativo: boolean;
  min_faltas_faltosos: string;
}

const FORM_INICIAL: FormClube = {
  programa_id: null,
  nome: '',
  nome_curto: '',
  codigo: '',
  igreja: '',
  distrito: '',
  regional: '',
  cidade: '',
  uf: '',
  cor_primaria: '#1a3a5c',
  cor_secundaria: '#f39c12',
  ativo: true,
  min_faltas_faltosos: '3',
};

const CORES = ['#1a3a5c', '#e91e63', '#4caf50', '#ff9800', '#2196f3', '#9c27b0', '#00695c', '#c62828'];

function programaIcone(codigo?: string | null) {
  return codigo === 'aventureiros' ? 'leaf' : 'compass';
}

function programaResumo(p?: Programa | null) {
  if (!p) return 'Programa não informado';
  const faixa = p.idade_minima_membro && p.idade_maxima_membro ? `${p.idade_minima_membro}-${p.idade_maxima_membro} anos` : 'idade livre';
  return `${p.nome} • ${faixa}`;
}

export default function AdminClubesScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [clubes, setClubes] = useState<Clube[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [preparandoClubeId, setPreparandoClubeId] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormClube>(FORM_INICIAL);

  const podeGerenciar = permissoes.pode('gerenciar_clubes');

  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  const filtrados = useMemo(() => {
    const q = busca.trim();
    if (!q) return clubes;
    return clubes.filter((c) =>
      combinaBusca(c.nome, q) ||
      combinaBusca(c.nome_curto, q) ||
      combinaBusca(c.codigo, q) ||
      combinaBusca(c.igreja, q) ||
      combinaBusca(c.cidade, q) ||
      combinaBusca(c.programa?.nome, q)
    );
  }, [clubes, busca]);

  async function carregar() {
    setCarregando(true);
    try {
      const [{ data: programasData, error: erroProgramas }, { data: clubesData, error: erroClubes }] = await Promise.all([
        supabase
          .from('programas')
          .select('id,codigo,nome,idade_minima_membro,idade_maxima_membro,idade_minima_diretoria')
          .order('id'),
        supabase
          .from('clubes')
          .select('id,programa_id,nome,nome_curto,codigo,igreja,distrito,regional,cidade,uf,cor_primaria,cor_secundaria,ativo,min_faltas_faltosos,created_at')
          .order('nome'),
      ]);
      if (erroProgramas) throw erroProgramas;
      if (erroClubes) throw erroClubes;

      const programasLista = (programasData ?? []) as Programa[];
      const progMap = new Map(programasLista.map((p) => [p.id, p]));
      const clubesLista = ((clubesData ?? []) as Clube[]).map((c) => ({
        ...c,
        programa: progMap.get(c.programa_id) ?? null,
      }));

      setProgramas(programasLista);
      setClubes(clubesLista);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível carregar os clubes.');
    } finally {
      setCarregando(false);
    }
  }

  function abrirNovo() {
    setForm({
      ...FORM_INICIAL,
      programa_id: programas[0]?.id ?? null,
    });
    setModal(true);
  }

  function abrirEditar(clube: Clube) {
    setForm({
      id: clube.id,
      programa_id: clube.programa_id,
      nome: clube.nome ?? '',
      nome_curto: clube.nome_curto ?? '',
      codigo: clube.codigo ?? '',
      igreja: clube.igreja ?? '',
      distrito: clube.distrito ?? '',
      regional: clube.regional ?? '',
      cidade: clube.cidade ?? '',
      uf: clube.uf ?? '',
      cor_primaria: clube.cor_primaria ?? '#1a3a5c',
      cor_secundaria: clube.cor_secundaria ?? '#f39c12',
      ativo: clube.ativo,
      min_faltas_faltosos: String(clube.min_faltas_faltosos ?? 3),
    });
    setModal(true);
  }

  async function executarOnboarding(clubeId: number, silencioso = false) {
    setPreparandoClubeId(clubeId);
    try {
      const { data, error } = await supabase.rpc('onboard_clube', { target_clube_id: clubeId });
      if (error) throw error;
      await registrarAuditoria({
        acao: 'onboarding_clube',
        entidade: 'clubes',
        entidadeId: clubeId,
        depois: data,
        clubeId,
      });
      if (!silencioso) {
        Alert.alert('Clube preparado', 'Modelos, pontuações, documentos e link de pré-cadastro foram preparados.');
      }
      return true;
    } catch (e: any) {
      if (!silencioso) {
        Alert.alert('Erro no onboarding', e?.message ?? 'Não foi possível preparar os modelos do clube.');
      }
      return false;
    } finally {
      setPreparandoClubeId(null);
    }
  }

  async function salvar() {
    const nome = form.nome.trim();
    if (!nome) {
      Alert.alert('Nome obrigatório', 'Informe o nome do clube.');
      return;
    }
    if (!form.programa_id) {
      Alert.alert('Programa obrigatório', 'Escolha se o clube é de Desbravadores ou Aventureiros.');
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        programa_id: form.programa_id,
        nome,
        nome_curto: form.nome_curto.trim() || nome,
        codigo: form.codigo.trim() || null,
        igreja: form.igreja.trim() || null,
        distrito: form.distrito.trim() || null,
        regional: form.regional.trim() || null,
        cidade: form.cidade.trim() || null,
        uf: form.uf.trim().toUpperCase() || null,
        cor_primaria: form.cor_primaria || '#1a3a5c',
        cor_secundaria: form.cor_secundaria || '#f39c12',
        ativo: form.ativo,
        min_faltas_faltosos: Math.max(1, Math.min(30, Number(form.min_faltas_faltosos) || 3)),
      };

      const result = form.id
        ? await supabase.from('clubes').update(payload).eq('id', form.id)
        : await supabase.from('clubes').insert(payload).select('id').single();
      if (result.error) throw result.error;

      const clubeId = form.id ?? (result.data as any)?.id;
      if (clubeId) {
        if (!form.id) {
          await executarOnboarding(clubeId, true);
        }
        await registrarAuditoria({
          acao: form.id ? 'editar_clube' : 'criar_clube',
          entidade: 'clubes',
          entidadeId: clubeId,
          depois: payload,
          clubeId,
        });
      }

      setModal(false);
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar o clube.');
    } finally {
      setSalvando(false);
    }
  }

  function confirmarAtivo(clube: Clube) {
    const acao = clube.ativo ? 'desativar' : 'reativar';
    Alert.alert(
      clube.ativo ? 'Desativar clube' : 'Reativar clube',
      `Deseja ${acao} ${clube.nome}? Os dados não serão apagados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: clube.ativo ? 'Desativar' : 'Reativar',
          style: clube.ativo ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const { error } = await supabase.from('clubes').update({ ativo: !clube.ativo }).eq('id', clube.id);
              if (error) throw error;
              await registrarAuditoria({
                acao: clube.ativo ? 'desativar_clube' : 'reativar_clube',
                entidade: 'clubes',
                entidadeId: clube.id,
                antes: { ativo: clube.ativo },
                depois: { ativo: !clube.ativo },
                clubeId: clube.id,
              });
              await carregar();
            } catch (e: any) {
              Alert.alert('Erro', e?.message ?? 'Não foi possível alterar o status do clube.');
            }
          },
        },
      ]
    );
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerIcon}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Clubes</Text>
          <Text style={s.headerSub}>Programas, clubes e base multiclube</Text>
        </View>
        <TouchableOpacity onPress={abrirNovo} style={s.novoBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.novoText}>Novo</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search" size={20} color="#78909c" />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar clube, igreja, cidade ou programa..."
          placeholderTextColor="#90a4ae"
          style={s.searchInput}
        />
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.lista}>
          <View style={s.resumo}>
            <Text style={s.resumoNum}>{clubes.length}</Text>
            <Text style={s.resumoTxt}>clubes cadastrados</Text>
            <Text style={s.resumoNum}>{clubes.filter((c) => c.ativo).length}</Text>
            <Text style={s.resumoTxt}>ativos</Text>
          </View>

          {filtrados.map((clube) => (
            <View key={clube.id} style={[s.card, !clube.ativo && s.cardInativo]}>
              <View style={[s.linhaCor, { backgroundColor: clube.cor_primaria ?? '#1a3a5c' }]} />
              <View style={s.cardHead}>
                <View style={[s.avatar, { backgroundColor: (clube.cor_primaria ?? '#1a3a5c') + '22' }]}>
                  <Ionicons name={programaIcone(clube.programa?.codigo) as any} size={22} color={clube.cor_primaria ?? '#1a3a5c'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome}>{clube.nome}</Text>
                  <Text style={s.programa}>{programaResumo(clube.programa)}</Text>
                  <Text style={s.meta}>
                    {[clube.igreja, clube.cidade, clube.uf].filter(Boolean).join(' • ') || 'Sem igreja/cidade cadastrada'}
                  </Text>
                </View>
                <View style={[s.status, clube.ativo ? s.statusAtivo : s.statusInativo]}>
                  <Text style={[s.statusText, clube.ativo ? s.statusTextAtivo : s.statusTextInativo]}>
                    {clube.ativo ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              </View>

              <View style={s.infoGrid}>
                <View style={s.infoPill}>
                  <Text style={s.infoLabel}>Código</Text>
                  <Text style={s.infoValue}>{clube.codigo || '-'}</Text>
                </View>
                <View style={s.infoPill}>
                  <Text style={s.infoLabel}>Distrito</Text>
                  <Text style={s.infoValue}>{clube.distrito || '-'}</Text>
                </View>
                <View style={s.infoPill}>
                  <Text style={s.infoLabel}>Regional</Text>
                  <Text style={s.infoValue}>{clube.regional || '-'}</Text>
                </View>
              </View>

              <View style={s.acoes}>
                <TouchableOpacity style={s.acaoBtn} onPress={() => abrirEditar(clube)}>
                  <Ionicons name="create-outline" size={17} color="#1a3a5c" />
                  <Text style={s.acaoText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.acaoBtn}
                  onPress={async () => {
                    await executarOnboarding(clube.id);
                    await carregar();
                  }}
                  disabled={preparandoClubeId === clube.id}
                >
                  {preparandoClubeId === clube.id ? (
                    <ActivityIndicator size="small" color="#1a3a5c" />
                  ) : (
                    <Ionicons name="sparkles-outline" size={17} color="#1a3a5c" />
                  )}
                  <Text style={s.acaoText}>Preparar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.acaoBtn, clube.ativo ? s.desativarBtn : s.reativarBtn]}
                  onPress={() => confirmarAtivo(clube)}
                >
                  <Ionicons name={clube.ativo ? 'pause-circle-outline' : 'play-circle-outline'} size={17} color={clube.ativo ? '#c62828' : '#2e7d32'} />
                  <Text style={[s.acaoText, { color: clube.ativo ? '#c62828' : '#2e7d32' }]}>
                    {clube.ativo ? 'Desativar' : 'Reativar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModal(false)} style={s.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#263238" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>{form.id ? 'Editar clube' : 'Novo clube'}</Text>
            <TouchableOpacity onPress={salvar} disabled={salvando} style={s.modalHeaderBtn}>
              {salvando ? <ActivityIndicator color="#1a3a5c" /> : <Text style={s.salvarTop}>Salvar</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.form}>
            <Text style={s.label}>Programa</Text>
            <View style={s.programasWrap}>
              {programas.map((p) => {
                const ativo = form.programa_id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setForm((f) => ({ ...f, programa_id: p.id }))}
                    style={[s.programaChip, ativo && s.programaChipAtivo]}
                  >
                    <Ionicons name={programaIcone(p.codigo) as any} size={18} color={ativo ? '#fff' : '#1a3a5c'} />
                    <View>
                      <Text style={[s.programaChipText, ativo && { color: '#fff' }]}>{p.nome}</Text>
                      <Text style={[s.programaChipSub, ativo && { color: '#d9eaff' }]}>
                        {p.idade_minima_membro}-{p.idade_maxima_membro} anos
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Campo label="Nome completo" value={form.nome} onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Clube de Desbravadores Fonseca" />
            <Campo label="Nome curto" value={form.nome_curto} onChangeText={(v) => setForm((f) => ({ ...f, nome_curto: v }))} placeholder="Fonseca" />
            <Campo label="Código do clube" value={form.codigo} onChangeText={(v) => setForm((f) => ({ ...f, codigo: v }))} placeholder="5659" keyboardType="numeric" />
            <Campo label="Igreja" value={form.igreja} onChangeText={(v) => setForm((f) => ({ ...f, igreja: v }))} placeholder="IASD Fonseca" />
            <View style={s.row}>
              <Campo style={{ flex: 1 }} label="Distrito" value={form.distrito} onChangeText={(v) => setForm((f) => ({ ...f, distrito: v }))} placeholder="Distrito" />
              <Campo style={{ flex: 1 }} label="Regional" value={form.regional} onChangeText={(v) => setForm((f) => ({ ...f, regional: v }))} placeholder="Regional" />
            </View>
            <View style={s.row}>
              <Campo style={{ flex: 1 }} label="Cidade" value={form.cidade} onChangeText={(v) => setForm((f) => ({ ...f, cidade: v }))} placeholder="Cidade" />
              <Campo style={{ width: 92 }} label="UF" value={form.uf} onChangeText={(v) => setForm((f) => ({ ...f, uf: v.toUpperCase().slice(0, 2) }))} placeholder="RJ" maxLength={2} />
            </View>

            <Campo label="Faltas p/ aba Faltosos" value={form.min_faltas_faltosos} keyboardType="numeric" onChangeText={(v) => setForm((f) => ({ ...f, min_faltas_faltosos: v.replace(/[^0-9]/g, '') }))} placeholder="3" />

            <Text style={s.label}>Cor principal</Text>
            <View style={s.coresWrap}>
              {CORES.map((cor) => (
                <TouchableOpacity
                  key={cor}
                  onPress={() => setForm((f) => ({ ...f, cor_primaria: cor }))}
                  style={[s.corBtn, { backgroundColor: cor }, form.cor_primaria === cor && s.corBtnAtiva]}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setForm((f) => ({ ...f, ativo: !f.ativo }))}
              style={[s.ativoToggle, form.ativo ? s.ativoLigado : s.ativoDesligado]}
            >
              <Ionicons name={form.ativo ? 'checkmark-circle' : 'pause-circle'} size={20} color={form.ativo ? '#2e7d32' : '#c62828'} />
              <Text style={[s.ativoText, { color: form.ativo ? '#2e7d32' : '#c62828' }]}>
                {form.ativo ? 'Clube ativo' : 'Clube inativo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={salvar} disabled={salvando} style={s.salvarBtn}>
              {salvando ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={s.salvarText}>Salvar clube</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      <BottomNav />
    </View>
  );
}

function Campo(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  maxLength?: number;
  style?: object;
}) {
  return (
    <View style={[s.campoWrap, props.style]}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#b0bec5"
        keyboardType={props.keyboardType ?? 'default'}
        maxLength={props.maxLength}
        style={s.input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingBottom: 20, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  headerSub: { color: '#a8c8e8', marginTop: 2 },
  novoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22 },
  novoText: { color: '#fff', fontWeight: '900' },
  searchBox: { margin: 16, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 2 },
  searchInput: { flex: 1, color: '#263238', fontSize: 15, outlineStyle: 'none' as any },
  lista: { padding: 16, paddingTop: 0, gap: 12 },
  resumo: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 },
  resumoNum: { color: '#1a3a5c', fontSize: 22, fontWeight: '900' },
  resumoTxt: { color: '#607d8b', marginRight: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, overflow: 'hidden', elevation: 2 },
  cardInativo: { opacity: 0.72 },
  linhaCor: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  cardHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nome: { color: '#222', fontSize: 17, fontWeight: '900' },
  programa: { color: '#607d8b', fontSize: 13, marginTop: 2 },
  meta: { color: '#90a4ae', fontSize: 12, marginTop: 2 },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusAtivo: { backgroundColor: '#e8f5e9' },
  statusInativo: { backgroundColor: '#ffebee' },
  statusText: { fontSize: 11, fontWeight: '900' },
  statusTextAtivo: { color: '#2e7d32' },
  statusTextInativo: { color: '#c62828' },
  infoGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  infoPill: { flex: 1, backgroundColor: '#f6f9fc', borderRadius: 12, padding: 10 },
  infoLabel: { color: '#90a4ae', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { color: '#263238', fontWeight: '800', marginTop: 3, fontSize: 12 },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  acaoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eef3f8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  desativarBtn: { backgroundColor: '#fff0f0', borderWidth: 1, borderColor: '#ffc7c7' },
  reativarBtn: { backgroundColor: '#eefaf0', borderWidth: 1, borderColor: '#b7e5bd' },
  acaoText: { color: '#1a3a5c', fontWeight: '900', fontSize: 12 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { paddingTop: 46, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#edf2f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalHeaderBtn: { minWidth: 58, minHeight: 36, justifyContent: 'center' },
  modalTitle: { color: '#1a3a5c', fontSize: 18, fontWeight: '900' },
  salvarTop: { color: '#1a3a5c', fontWeight: '900', textAlign: 'right' },
  form: { padding: 18, paddingBottom: 40 },
  label: { color: '#607d8b', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', marginBottom: 7 },
  programasWrap: { flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  programaChip: { borderWidth: 1, borderColor: '#dce5ec', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff' },
  programaChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  programaChipText: { color: '#1a3a5c', fontWeight: '900' },
  programaChipSub: { color: '#78909c', fontSize: 11, marginTop: 1 },
  campoWrap: { marginBottom: 14 },
  input: { borderWidth: 1, borderColor: '#dce5ec', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: '#263238', backgroundColor: '#fff', outlineStyle: 'none' as any },
  row: { flexDirection: 'row', gap: 10 },
  coresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  corBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff', elevation: 2 },
  corBtnAtiva: { borderColor: '#263238', transform: [{ scale: 1.08 }] },
  ativoToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 18 },
  ativoLigado: { backgroundColor: '#e8f5e9' },
  ativoDesligado: { backgroundColor: '#ffebee' },
  ativoText: { fontWeight: '900' },
  salvarBtn: { backgroundColor: '#1a3a5c', borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  salvarText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});

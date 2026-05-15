import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Pressable,
  Platform, KeyboardAvoidingView, ActivityIndicator, Image,
  ActionSheetIOS,
} from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useDBVStore } from '../../src/stores/dbvStore';
import { useAuthStore } from '../../src/stores/authStore';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { DateField } from '../../src/components/DateField';
import type { Desbravador, Documento } from '../../src/types';

async function uploadFotoMembro(dbv_id: number, uri: string): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const path = `${dbv_id}/perfil_${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('fotos_membros')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('fotos_membros').getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch { return null; }
}

/* ─── Avatar colorido ─────────────────────────────────────────── */
const AVATAR_CORES = ['#e74c3c','#e67e22','#f39c12','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#16a085','#d35400'];
function avatarCor(nome: string): string {
  let h = 0; for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_CORES[Math.abs(h) % AVATAR_CORES.length];
}

/* ─── Cargos com variação de gênero ──────────────────────────── */
const CARGOS: Array<{ masc: string; fem: string }> = [
  { masc: 'Desbravador',           fem: 'Desbravadora'           },
  { masc: 'Diretoria',             fem: 'Diretoria'              },
  { masc: 'Secretaria do Clube',   fem: 'Secretaria do Clube'    },
  { masc: 'Capelania',             fem: 'Capelania'              },
  { masc: 'Tesouraria',            fem: 'Tesouraria'             },
  { masc: 'Conselheiro',           fem: 'Conselheira'            },
  { masc: 'Capitão',               fem: 'Capitã'                 },
  { masc: 'Secretaria da Unidade', fem: 'Secretaria da Unidade'  },
];

function cargoLabel(c: { masc: string; fem: string }, genero: string) {
  return genero === 'F' ? c.fem : c.masc;
}

/** Quando o gênero muda, converte o cargo armazenado para a variante correta. */
function adaptarCargo(cargo: string, paraGenero: string): string {
  const c = CARGOS.find((x) => x.masc === cargo || x.fem === cargo);
  if (!c) return cargo;
  return paraGenero === 'F' ? c.fem : c.masc;
}

function idadePorNascimento(data?: string | null) {
  if (!data || data.length < 10) return null;
  const nasc = new Date(`${data.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mes = hoje.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function normalizarCargo(cargo: string) {
  return cargo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function cargoForcaDesbravador(cargo: string) {
  const c = normalizarCargo(cargo);
  return c === 'desbravador' || c === 'desbravadora' || c === 'capitao' || c === 'capita' || c === 'secretaria da unidade';
}

function cargoBloqueadoPorIdade(cargo: string, idade: number | null) {
  if (idade === null || idade <= 16) return false;
  const c = normalizarCargo(cargo);
  return c === 'capitao' || c === 'capita' || c === 'secretaria da unidade';
}

/* ─── Campos do formulário ────────────────────────────────────── */
interface FormDBV {
  nome: string; genero: string; data_nascimento: string; cargo: string;
  unidade_id: string; unidade_nome: string; email: string; contato: string;
  camisa: string; nome_responsavel: string; contato_responsavel: string;
  foto_url: string; senha: string; perfil_login: PerfilLogin;
}

const FORM_VAZIO: FormDBV = {
  nome: '', genero: 'M', data_nascimento: '', cargo: '', unidade_id: '',
  unidade_nome: '', email: '', contato: '', camisa: '', nome_responsavel: '', contato_responsavel: '',
  foto_url: '', senha: '', perfil_login: 'desbravador',
};

type PerfilLogin = 'admin_geral' | 'admin_diretoria' | 'desbravador';
const PERFIS_LOGIN: Array<{ valor: PerfilLogin; label: string; desc: string }> = [
  { valor: 'desbravador', label: 'Desbravador', desc: 'Acesso próprio' },
  { valor: 'admin_diretoria', label: 'Diretoria', desc: 'Gerencia unidade/clube' },
  { valor: 'admin_geral', label: 'Admin geral', desc: 'Acesso total' },
];

interface UnidadeDB { id: number; nome: string; cor: string; }
interface DocStat { entregues: number; pendentes: number; anexos: number; }
const UNIDADES_PADRAO: UnidadeDB[] = [
  { id: 1, nome: 'Amor Perfeito', cor: '#e91e63' },
  { id: 2, nome: 'Sempre Viva', cor: '#4caf50' },
  { id: 3, nome: 'Águia Dourada', cor: '#ff9800' },
  { id: 4, nome: 'Leões', cor: '#2196f3' },
];

export default function MembrosScreen() {
  const usuario  = useAuthStore((s) => s.usuario);
  const { desbravadores, carregar, criarDesbravador, editarDesbravador, excluirDesbravador, atualizarFoto } = useDBVStore();
  const [busca, setBusca]       = useState('');
  const [filtroUn, setFiltroUn] = useState('Todas');
  const [unidades, setUnidades] = useState<UnidadeDB[]>([]);
  const [docStats, setDocStats] = useState<Record<number, DocStat>>({});

  // Modal CRUD
  const [modal, setModal]     = useState(false);
  const [editId, setEditId]   = useState<number | null>(null);
  const [form, setForm]       = useState<FormDBV>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [upFoto,   setUpFoto]  = useState(false);

  const isAdmin = usuario?.perfil === 'admin_geral' || usuario?.perfil === 'admin_diretoria';
  const meuCadastro = desbravadores.find((d) => d.id === usuario?.dbv_id);
  const isConselheiro = normalizarCargo(meuCadastro?.cargo ?? '').includes('conselheiro') || normalizarCargo(meuCadastro?.cargo ?? '') === 'con';
  const nascimentoDefault = new Date();
  nascimentoDefault.setFullYear(nascimentoDefault.getFullYear() - 10);
  const nascimentoMin = new Date(1950, 0, 1);
  const idadeForm = idadePorNascimento(form.data_nascimento);
  const perfilTravadoComoDesbravador = cargoForcaDesbravador(form.cargo);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    async function init() {
      await carregarUnidades();
      if (ativo) {
        await carregar();
        await carregarDocStats();
      }
    }
    init();
    return () => { ativo = false; };
  }, []));

  async function carregarDocStats() {
    const campos = ['rg','cpf','rg_resp','cartao_sus','cartao_plano','ficha_saude','carteira_vacinacao','laudo_medico','ficha_reg','comp_residencia','aut_saida','aut_viagem','ri_assinado','foto','ant_criminais'];
    const stats: Record<number, DocStat> = {};

    if (Platform.OS === 'web') {
      const [{ data: docs }, { data: imgs }] = await Promise.all([
        supabase.from('documentos').select('*'),
        supabase.from('documento_imagens').select('dbv_id'),
      ]);
      for (const d of (docs ?? []) as Documento[]) {
        const entregues = campos.filter((c) => (d as any)[c] === 'OK' || (d as any)[c] === 'NA').length;
        stats[d.dbv_id] = { entregues, pendentes: campos.length - entregues, anexos: 0 };
      }
      for (const img of (imgs ?? []) as Array<{ dbv_id: number }>) {
        stats[img.dbv_id] = stats[img.dbv_id] ?? { entregues: 0, pendentes: campos.length, anexos: 0 };
        stats[img.dbv_id].anexos += 1;
      }
      setDocStats(stats);
      return;
    }

    const db = await getDB();
    const docs = await db.getAllAsync<Documento>('SELECT * FROM documentos');
    const imgs = await db.getAllAsync<{ dbv_id: number; total: number }>('SELECT dbv_id, COUNT(*) as total FROM documento_imagens GROUP BY dbv_id');
    for (const d of docs) {
      const entregues = campos.filter((c) => (d as any)[c] === 'OK' || (d as any)[c] === 'NA').length;
      stats[d.dbv_id] = { entregues, pendentes: campos.length - entregues, anexos: 0 };
    }
    for (const img of imgs) {
      stats[img.dbv_id] = stats[img.dbv_id] ?? { entregues: 0, pendentes: campos.length, anexos: 0 };
      stats[img.dbv_id].anexos = img.total;
    }
    setDocStats(stats);
  }

  async function carregarUnidades() {
    if (Platform.OS === 'web') {
      const { data } = await supabase.from('unidades').select('id, nome, cor').order('nome');
      setUnidades((data && data.length > 0 ? data : UNIDADES_PADRAO) as UnidadeDB[]);
      return;
    }

    const db = await getDB();
    for (const u of UNIDADES_PADRAO) {
      const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ?', [u.nome]);
      if (!existeNome) {
        const existeId = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE id = ?', [u.id]);
        if (existeId) {
          await db.runAsync('INSERT INTO unidades (nome, cor) VALUES (?, ?)', [u.nome, u.cor]);
        } else {
          await db.runAsync('INSERT INTO unidades (id, nome, cor) VALUES (?, ?, ?)', [u.id, u.nome, u.cor]);
        }
      }
    }
    const derivadas = await db.getAllAsync<{ unidade_id: number | null; unidade_nome: string | null }>(
      `SELECT DISTINCT unidade_id, unidade_nome FROM desbravadores
       WHERE unidade_nome IS NOT NULL AND unidade_nome != 'Diretoria'`
    );
    for (const u of derivadas) {
      if (!u.unidade_nome) continue;
      const padrao = UNIDADES_PADRAO.find((x) => x.nome === u.unidade_nome);
      if (u.unidade_id && u.unidade_id > 0) {
        const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ?', [u.unidade_nome]);
        if (!existeNome) {
          const existeId = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE id = ?', [u.unidade_id]);
          if (existeId) {
            await db.runAsync('INSERT INTO unidades (nome, cor) VALUES (?, ?)', [u.unidade_nome, padrao?.cor ?? '#1a3a5c']);
          } else {
            await db.runAsync('INSERT INTO unidades (id, nome, cor) VALUES (?, ?, ?)', [u.unidade_id, u.unidade_nome, padrao?.cor ?? '#1a3a5c']);
          }
        }
      } else {
        const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ?', [u.unidade_nome]);
        if (!existeNome) {
          await db.runAsync('INSERT INTO unidades (nome, cor) VALUES (?, ?)', [u.unidade_nome, padrao?.cor ?? '#1a3a5c']);
        }
      }
    }
    const lista = await db.getAllAsync<UnidadeDB>('SELECT id, nome, cor FROM unidades ORDER BY nome');
    if (lista.length === 0) {
      const { data } = await supabase.from('unidades').select('id, nome, cor').order('nome');
      setUnidades((data ?? UNIDADES_PADRAO) as UnidadeDB[]);
    } else {
      setUnidades(lista);
    }
  }

  const filtros = ['Todas', ...unidades.map((u) => u.nome), 'Diretoria'];

  const filtrados = desbravadores.filter((d) => {
    const nomeOk = d.nome.toLowerCase().includes(busca.toLowerCase());
    const unOk   = filtroUn === 'Todas' || d.unidade_nome === filtroUn;
    return nomeOk && unOk;
  });

  /* ── Abrir criar ── */
  function abrirCriar() {
    setEditId(null);
    setForm(FORM_VAZIO);
    setModal(true);
  }

  /* ── Abrir editar ── */
  function abrirEditar(d: Desbravador) {
    const cargoInicial = d.cargo ?? '';
    setEditId(d.id);
    setForm({
      nome: d.nome, genero: d.genero ?? 'M',
      data_nascimento: d.data_nascimento ?? '',
      cargo: cargoInicial, unidade_id: String(d.unidade_id ?? ''),
      unidade_nome: d.unidade_nome ?? '', email: d.email ?? '',
      contato: d.contato ?? '', camisa: d.camisa ?? '',
      nome_responsavel: d.nome_responsavel ?? '',
      contato_responsavel: d.contato_responsavel ?? '',
      foto_url: d.foto_url ?? '',
      senha: '',
      perfil_login: cargoForcaDesbravador(cargoInicial) ? 'desbravador' : 'desbravador',
    });
    carregarPerfilLogin(d.id, d.email ?? '');
    setModal(true);
  }

  async function carregarPerfilLogin(dbvId: number, email: string) {
    let { data } = await supabase
      .from('usuarios')
      .select('email, perfil')
      .eq('dbv_id', dbvId)
      .maybeSingle();
    if (!data && email) {
      const resp = await supabase
        .from('usuarios')
        .select('email, perfil')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      data = resp.data;
    }
    const perfil = data?.perfil as PerfilLogin | undefined;
    if (data?.email || (perfil && PERFIS_LOGIN.some((p) => p.valor === perfil))) {
      setForm((f) => ({
        ...f,
        email: data?.email ?? f.email,
        perfil_login: cargoForcaDesbravador(f.cargo) ? 'desbravador' : (perfil && PERFIS_LOGIN.some((p) => p.valor === perfil) ? perfil : f.perfil_login),
      }));
    }
  }

  /* ── Escolher foto de perfil ── */
  async function escolherFotoPerfil() {
    const opcoes = ['📷 Tirar foto', '🖼️ Escolher da galeria', 'Cancelar'];
    const escolha = await new Promise<number>((resolve) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: opcoes, cancelButtonIndex: 2 },
          resolve
        );
      } else {
        Alert.alert('Foto de perfil', 'Escolha uma opção', [
          { text: opcoes[0], onPress: () => resolve(0) },
          { text: opcoes[1], onPress: () => resolve(1) },
          { text: opcoes[2], style: 'cancel', onPress: () => resolve(2) },
        ]);
      }
    });
    if (escolha === 2) return;

    let result: ImagePicker.ImagePickerResult;
    if (escolha === 0) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Permita acesso à câmera.'); return; }
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.75 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Permita acesso à galeria.'); return; }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.75,
      });
    }
    if (result.canceled || !result.assets[0]) return;
    setForm((f) => ({ ...f, foto_url: result.assets[0].uri }));
  }

  /* ── Salvar ── */
  async function salvar() {
    if (!form.nome.trim()) { Alert.alert('Atenção', 'Nome é obrigatório.'); return; }
    setSalvando(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        genero: form.genero as 'M' | 'F',
        data_nascimento: form.data_nascimento || null,
        cargo: form.cargo || null,
        unidade_id: form.unidade_id ? Number(form.unidade_id) : null,
        unidade_nome: form.unidade_nome || null,
        email: form.email || null,
        contato: form.contato || null,
        camisa: form.camisa || null,
        nome_responsavel: form.nome_responsavel || null,
        contato_responsavel: form.contato_responsavel || null,
      };

      let dbvId = editId;
      if (editId) {
        await editarDesbravador(editId, dados as any);
      } else {
        dbvId = await criarDesbravador(dados as any);
      }

      if (dbvId && form.email.trim() && form.senha.trim()) {
        await criarLoginMembro(dbvId, form.email.trim().toLowerCase(), form.senha.trim(), form.nome.trim(), dados.unidade_id, form.perfil_login);
      } else if (dbvId && form.email.trim()) {
        await atualizarPerfilLoginExistente(dbvId, form.email.trim().toLowerCase(), form.nome.trim(), dados.unidade_id, form.perfil_login);
      }

      // Upload foto se foi escolhida (URI local = file://)
      if (dbvId && form.foto_url && form.foto_url.startsWith('file://')) {
        setUpFoto(true);
        const url = await uploadFotoMembro(dbvId, form.foto_url);
        const fotoFinal = url ?? form.foto_url;
        await atualizarFoto(dbvId, fotoFinal);
        if (!url) Alert.alert('Atenção', 'Foto salva localmente. Será enviada ao conectar à internet.');
        setUpFoto(false);
      }

      setModal(false);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSalvando(false);
      setUpFoto(false);
    }
  }

  async function atualizarPerfilLoginExistente(dbvId: number, email: string, nome: string, unidadeId: number | null, perfil: PerfilLogin) {
    let { data: existente } = await supabase
      .from('usuarios')
      .select('id')
      .eq('dbv_id', dbvId)
      .maybeSingle();
    if (!existente) {
      const resp = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      existente = resp.data;
    }

    if (existente?.id) {
      await supabase.from('usuarios').update({ email, nome, perfil, unidade_id: unidadeId, dbv_id: dbvId }).eq('id', existente.id);
    }
  }

  async function criarLoginMembro(dbvId: number, email: string, senha: string, nome: string, unidadeId: number | null, perfil: PerfilLogin) {
    if (senha.length < 6) {
      Alert.alert('Login não criado', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    const { data: existente } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existente?.id) {
      await supabase.from('usuarios').update({ nome, perfil, unidade_id: unidadeId, dbv_id: dbvId }).eq('id', existente.id);
      return;
    }

    const { data: sessaoAtual } = await supabase.auth.getSession();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome, perfil, unidade_id: unidadeId, dbv_id: dbvId },
        emailRedirectTo: 'dbvfonseca://auth/callback',
      },
    });

    if (sessaoAtual.session) {
      await supabase.auth.setSession({
        access_token: sessaoAtual.session.access_token,
        refresh_token: sessaoAtual.session.refresh_token,
      });
    }

    if (error) throw error;
    if (data.user?.id) {
      await supabase.from('usuarios').upsert({
        id: data.user.id,
        email,
        nome,
        perfil,
        unidade_id: unidadeId,
        dbv_id: dbvId,
      });
    }
  }

  /* ── Excluir ── */
  function confirmarExcluir(d: Desbravador) {
    Alert.alert(
      'Excluir membro',
      `Isso removerá ${d.nome} e todos seus dados (pontuações, documentos, etc).\n\nDeseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => excluirDesbravador(d.id) },
      ]
    );
  }

  /* ── Selecionar unidade no form ── */
  function selecionarUnidade(u: UnidadeDB) {
    setForm((f) => ({ ...f, unidade_id: String(u.id), unidade_nome: u.nome }));
  }

  if (!usuario) return <Redirect href="/auth/login" />;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>👥 Membros</Text>
          <Text style={s.subtitulo}>{desbravadores.length} membros cadastrados</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity style={s.addBtn} onPress={abrirCriar}>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={s.addBtnText}>Novo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.buscaContainer}>
        <Ionicons name="search" size={17} color="#aaa" style={{ marginLeft: 12 }} />
        <TextInput
          style={s.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar desbravador..."
          placeholderTextColor="#aaa"
          clearButtonMode="while-editing"
        />
      </View>

      <View style={s.filtrosWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtrosContent}>
          {filtros.map((u) => {
            const cor = unidades.find((x) => x.nome === u)?.cor ?? '#1a3a5c';
            const ativo = filtroUn === u;
            return (
              <TouchableOpacity
                key={u}
                style={[s.filtroChip, ativo && { backgroundColor: u === 'Todas' ? '#1a3a5c' : cor }]}
                onPress={() => setFiltroUn(u)}
              >
                <Text style={[s.filtroText, ativo && { color: '#fff' }]}>{u}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={s.lista}>
        <Text style={s.contador}>{filtrados.length} membro(s)</Text>
        {filtrados.map((dbv) => {
          const cor = unidades.find((u) => u.nome === dbv.unidade_nome)?.cor ?? avatarCor(dbv.nome);
          const proprioCadastro = dbv.id === usuario?.dbv_id;
          const mesmaUnidade = !!usuario?.unidade_id && dbv.unidade_id === Number(usuario.unidade_id);
          const podeAbrir = isAdmin || proprioCadastro || isConselheiro || mesmaUnidade;
          const mostrarSomenteNome = !isAdmin && !isConselheiro && !proprioCadastro && !mesmaUnidade;
          const stat = docStats[dbv.id];
          return (
            <View key={dbv.id} style={s.card}>
              <TouchableOpacity
                style={s.cardMain}
                onPress={() => isAdmin ? abrirEditar(dbv) : (podeAbrir ? router.push({ pathname: '/membro/[id]', params: { id: dbv.id } }) : undefined)}
                activeOpacity={0.8}
                disabled={!podeAbrir}
              >
                {dbv.foto_url ? (
                  <Image source={{ uri: dbv.foto_url }} style={[s.avatar, { borderRadius: 23 }]} />
                ) : (
                  <View style={[s.avatar, { backgroundColor: avatarCor(dbv.nome) }]}>
                    <Text style={s.avatarLetra}>{dbv.nome[0]}</Text>
                  </View>
                )}
                <View style={s.info}>
                  <Text style={s.nome}>{dbv.nome}</Text>
                  {!mostrarSomenteNome && (
                    <View style={s.tags}>
                      {dbv.unidade_nome && (
                        <View style={[s.tag, { backgroundColor: cor + '22' }]}>
                          <Text style={[s.tagText, { color: cor }]}>{dbv.unidade_nome}</Text>
                        </View>
                      )}
                      {dbv.cargo ? (
                        <View style={s.cargoTag}>
                          <Text style={s.cargoTagText}>{dbv.cargo}</Text>
                        </View>
                      ) : null}
                      {dbv.idade ? <Text style={s.idade}>{dbv.idade} anos</Text> : null}
                      {(mesmaUnidade || proprioCadastro || isConselheiro) && stat ? (
                        <View style={[s.docStatusTag, stat.pendentes > 0 ? s.docPendenteTag : s.docOkTag]}>
                          <Text style={[s.docStatusText, stat.pendentes > 0 ? s.docPendenteText : s.docOkText]}>
                            {stat.pendentes > 0 ? `${stat.pendentes} docs pendentes` : 'Docs OK'}
                          </Text>
                        </View>
                      ) : null}
                      {isConselheiro && stat?.anexos ? (
                        <View style={s.anexoTag}><Text style={s.anexoTagText}>{stat.anexos} anexo(s)</Text></View>
                      ) : null}
                    </View>
                  )}
                </View>
                {podeAbrir && <Ionicons name="chevron-forward" size={18} color="#ccc" />}
              </TouchableOpacity>

              {/* Ações admin */}
              {isAdmin && (
                <View style={s.cardAcoes}>
                  <TouchableOpacity onPress={() => abrirEditar(dbv)} style={s.acaoBtn}>
                    <Ionicons name="pencil" size={15} color="#1a3a5c" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmarExcluir(dbv)} style={s.acaoBtn}>
                    <Ionicons name="trash-outline" size={15} color="#c62828" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {filtrados.length === 0 && <Text style={s.vazio}>Nenhum membro encontrado.</Text>}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Modal CRUD ── */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalContainer}>
            {/* Header modal */}
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={s.modalTitulo}>{editId ? 'Editar membro' : 'Novo membro'}</Text>
              <TouchableOpacity onPress={salvar} disabled={salvando} style={s.modalSalvar}>
                {salvando
                  ? <ActivityIndicator size="small" color="#1a3a5c" />
                  : <Text style={s.modalSalvarText}>Salvar</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              {/* Avatar / Foto de perfil */}
              <TouchableOpacity style={s.avatarModal} onPress={escolherFotoPerfil} activeOpacity={0.8}>
                {form.foto_url ? (
                  <Image source={{ uri: form.foto_url }} style={s.avatarModalImg} />
                ) : (
                  <View style={[s.avatarModalImg, { backgroundColor: form.nome ? avatarCor(form.nome) : '#90a4ae', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={s.avatarModalLetra}>
                      {form.nome ? form.nome[0].toUpperCase() : '?'}
                    </Text>
                  </View>
                )}
                <View style={s.avatarModalOverlay}>
                  {upFoto
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="camera" size={18} color="#fff" />}
                </View>
              </TouchableOpacity>
              <Text style={s.avatarModalDica}>Toque para {form.foto_url ? 'alterar' : 'adicionar'} foto</Text>

              {/* Nome */}
              <Campo label="Nome completo *">
                <TextInput style={s.input} value={form.nome} onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome do desbravador" autoFocus />
              </Campo>

              {/* Gênero */}
              <Campo label="Gênero">
                <View style={s.generoRow}>
                  {(['M', 'F'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setForm((f) => ({
                        ...f,
                        genero: g,
                        cargo: adaptarCargo(f.cargo, g),
                        perfil_login: cargoForcaDesbravador(adaptarCargo(f.cargo, g)) ? 'desbravador' : f.perfil_login,
                      }))}
                      style={[s.generoBtn, form.genero === g && s.generoBtnAtivo]}
                    >
                      <Text style={[s.generoBtnText, form.genero === g && { color: '#fff' }]}>
                        {g === 'M' ? '♂ Masculino' : '♀ Feminino'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Campo>

              {/* Data de nascimento */}
              <Campo label="Data de nascimento">
                <DateField
                  value={form.data_nascimento}
                  onChange={(v) => setForm((f) => {
                    const idade = idadePorNascimento(v);
                    const cargo = cargoBloqueadoPorIdade(f.cargo, idade) ? '' : f.cargo;
                    return { ...f, data_nascimento: v, cargo, perfil_login: cargoForcaDesbravador(cargo) ? 'desbravador' : f.perfil_login };
                  })}
                  placeholder="Selecionar nascimento"
                  minimumDate={nascimentoMin}
                  defaultDate={nascimentoDefault}
                />
              </Campo>

              {/* Cargo */}
              <Campo label="Cargo">
                <View style={s.generoRow}>
                  {CARGOS.map((c) => {
                    const label = cargoLabel(c, form.genero);
                    const bloqueado = cargoBloqueadoPorIdade(label, idadeForm);
                    const ativo = form.cargo === c.masc || form.cargo === c.fem;
                    return (
                      <TouchableOpacity
                        key={c.masc}
                        disabled={bloqueado}
                        onPress={() => setForm((f) => ({
                          ...f,
                          cargo: ativo ? '' : cargoLabel(c, f.genero),
                          perfil_login: !ativo && cargoForcaDesbravador(cargoLabel(c, f.genero)) ? 'desbravador' : f.perfil_login,
                        }))}
                        style={[s.cargoChip, ativo && s.cargoChipAtivo, bloqueado && s.cargoChipDesabilitado]}
                      >
                        <Text style={[s.cargoChipText, ativo && s.cargoChipTextAtivo, bloqueado && s.cargoChipTextDesabilitado]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Campo>

              {/* Unidade */}
              <Campo label="Unidade">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {[...unidades, { id: 0, nome: 'Diretoria', cor: '#9c27b0' }].map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => selecionarUnidade(u as UnidadeDB)}
                      style={[s.unChip, form.unidade_nome === u.nome && { backgroundColor: u.cor }]}
                    >
                      <Text style={[s.unChipText, form.unidade_nome === u.nome && { color: '#fff' }]}>{u.nome}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => setForm((f) => ({ ...f, unidade_id: '', unidade_nome: '' }))}
                    style={[s.unChip, !form.unidade_nome && { backgroundColor: '#90a4ae' }]}
                  >
                    <Text style={[s.unChipText, !form.unidade_nome && { color: '#fff' }]}>Sem unidade</Text>
                  </TouchableOpacity>
                </ScrollView>
              </Campo>

              {/* Email */}
              <Campo label="E-mail">
                <TextInput style={s.input} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" />
              </Campo>

              <Campo label={editId ? 'Senha de login (se ainda não tiver usuário)' : 'Senha de login'}>
                <TextInput
                  style={s.input}
                  value={form.senha}
                  onChangeText={(v) => setForm((f) => ({ ...f, senha: v }))}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                />
              </Campo>

              <Campo label="Tipo de acesso do login">
                <View style={s.perfilGrid}>
                  {PERFIS_LOGIN.map((p) => {
                    const ativo = form.perfil_login === p.valor;
                    const desabilitado = perfilTravadoComoDesbravador && p.valor !== 'desbravador';
                    return (
                      <TouchableOpacity
                        key={p.valor}
                        disabled={desabilitado}
                        style={[s.perfilChip, ativo && s.perfilChipAtivo, desabilitado && s.perfilChipDesabilitado]}
                        onPress={() => setForm((f) => ({ ...f, perfil_login: p.valor }))}
                      >
                        <Text style={[s.perfilChipText, ativo && s.perfilChipTextAtivo, desabilitado && s.perfilChipTextDesabilitado]}>{p.label}</Text>
                        <Text style={[s.perfilChipDesc, ativo && s.perfilChipDescAtivo, desabilitado && s.perfilChipTextDesabilitado]}>{p.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {perfilTravadoComoDesbravador && (
                  <Text style={s.perfilAviso}>Este cargo usa acesso de desbravador automaticamente.</Text>
                )}
              </Campo>

              {/* Contato */}
              <Campo label="Telefone/WhatsApp">
                <TextInput style={s.input} value={form.contato} onChangeText={(v) => setForm((f) => ({ ...f, contato: v }))} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
              </Campo>

              {/* Camisa */}
              <Campo label="Tamanho da camisa">
                <View style={s.generoRow}>
                  {['PP','P','M','G','GG','XG'].map((t) => (
                    <TouchableOpacity
                      key={t} onPress={() => setForm((f) => ({ ...f, camisa: t }))}
                      style={[s.generoBtn, form.camisa === t && s.generoBtnAtivo, { minWidth: 44 }]}
                    >
                      <Text style={[s.generoBtnText, form.camisa === t && { color: '#fff' }]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Campo>

              {/* Responsável */}
              <Campo label="Nome do responsável">
                <TextInput style={s.input} value={form.nome_responsavel} onChangeText={(v) => setForm((f) => ({ ...f, nome_responsavel: v }))} placeholder="Nome do pai/mãe/responsável" />
              </Campo>

              <Campo label="Telefone do responsável">
                <TextInput style={s.input} value={form.contato_responsavel} onChangeText={(v) => setForm((f) => ({ ...f, contato_responsavel: v }))} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
              </Campo>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.campo}>
      <Text style={s.campoLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f0f4f8' },
  header:      { backgroundColor: '#1a3a5c', paddingHorizontal: 24, paddingTop: 52, paddingBottom: 28, flexDirection: 'row', alignItems: 'center' },
  titulo:      { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitulo:   { color: 'rgba(255,255,255,0.78)', fontSize: 15, marginTop: 6 },
  addBtn:      { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtnText:  { color: '#fff', fontSize: 15, fontWeight: '800' },
  buscaContainer: {
    marginHorizontal: 18, marginTop: 18, marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 14, minHeight: 58,
    flexDirection: 'row', alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  busca:       { flex: 1, paddingHorizontal: 10, paddingVertical: 14, fontSize: 16, color: '#222' },
  filtrosWrap: { minHeight: 48, marginBottom: 4 },
  filtrosContent: { paddingHorizontal: 18, paddingBottom: 8, gap: 8 },
  filtroChip:  { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 22, marginRight: 8, elevation: 1 },
  filtroText:  { color: '#1a3a5c', fontSize: 13, fontWeight: '700' },

  lista:       { flex: 1, padding: 16 },
  contador:    { color: '#888', fontSize: 13, marginBottom: 10 },

  card:        { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, elevation: 2, overflow: 'hidden' },
  cardMain:    { flexDirection: 'row', alignItems: 'center', padding: 14 },
  cardAcoes:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  acaoBtn:     { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' },

  avatar:      { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarLetra: { color: '#fff', fontSize: 20, fontWeight: '700' },
  info:        { flex: 1 },
  nome:        { fontSize: 15, fontWeight: '700', color: '#222' },
  tags:        { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6, flexWrap: 'wrap' },
  tag:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tagText:     { fontSize: 11, fontWeight: '600' },
  idade:       { fontSize: 11, color: '#888' },
  camporiTag:  { backgroundColor: '#e3f2fd', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  camporiText: { fontSize: 11, color: '#1565c0', fontWeight: '600' },
  docStatusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  docPendenteTag: { backgroundColor: '#fff3e0' },
  docOkTag: { backgroundColor: '#e8f5e9' },
  docStatusText: { fontSize: 11, fontWeight: '700' },
  docPendenteText: { color: '#ef6c00' },
  docOkText: { color: '#2e7d32' },
  anexoTag: { backgroundColor: '#e8f0fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  anexoTagText: { fontSize: 11, color: '#1a3a5c', fontWeight: '700' },
  vazio:       { textAlign: 'center', color: '#999', marginTop: 40 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 44, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalClose:     { padding: 4 },
  modalTitulo:    { flex: 1, fontSize: 17, fontWeight: '800', color: '#1a3a5c', textAlign: 'center' },
  modalSalvar:    { minWidth: 52, alignItems: 'flex-end' },
  modalSalvarText:{ fontSize: 16, fontWeight: '700', color: '#1a3a5c' },
  modalScroll:    { padding: 16, gap: 4 },

  campo:       { marginBottom: 14 },
  campoLabel:  { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 6 },
  input:       { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },

  generoRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  generoBtn:   { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  generoBtnAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  generoBtnText:  { fontSize: 13, fontWeight: '600', color: '#555' },

  unChip:      { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa', marginRight: 8 },
  unChipText:  { fontSize: 13, fontWeight: '600', color: '#555' },
  perfilGrid:  { gap: 8 },
  perfilChip:  { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 12, backgroundColor: '#fafafa' },
  perfilChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  perfilChipDesabilitado: { opacity: 0.45 },
  perfilChipText: { color: '#333', fontSize: 14, fontWeight: '800' },
  perfilChipTextAtivo: { color: '#fff' },
  perfilChipTextDesabilitado: { color: '#999' },
  perfilChipDesc: { color: '#888', fontSize: 11, marginTop: 2 },
  perfilChipDescAtivo: { color: '#cde4fb' },
  perfilAviso: { color: '#777', fontSize: 12, marginTop: 8 },

  // Avatar no modal
  avatarModal:      { alignSelf: 'center', marginBottom: 4, marginTop: 4 },
  avatarModalImg:   { width: 96, height: 96, borderRadius: 48 },
  avatarModalLetra: { color: '#fff', fontSize: 38, fontWeight: '800' },
  avatarModalOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1a3a5c', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarModalDica:  { textAlign: 'center', fontSize: 11, color: '#aaa', marginBottom: 16 },

  // Cargo chips (formulário)
  cargoChip:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  cargoChipAtivo:   { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  cargoChipDesabilitado: { opacity: 0.38 },
  cargoChipText:    { fontSize: 13, fontWeight: '600', color: '#555' },
  cargoChipTextAtivo: { color: '#fff' },
  cargoChipTextDesabilitado: { color: '#999' },

  // Cargo tag (card)
  cargoTag:     { backgroundColor: '#e8eaf6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  cargoTagText: { fontSize: 11, color: '#3949ab', fontWeight: '600' },
});

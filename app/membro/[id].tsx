import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Alert, Image, ActivityIndicator, ActionSheetIOS,
  Platform, Modal, FlatList,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getDB } from '../../src/lib/database';
import { useDBVStore } from '../../src/stores/dbvStore';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import type { Desbravador, Documento, ProgressoClasse } from '../../src/types';

type Aba = 'docs' | 'classes' | 'especs';
type StatusDoc = 'OK' | 'NOK' | 'NA' | null;

const DOCS_LABELS: Record<string, string> = {
  rg: 'RG', cpf: 'CPF', rg_resp: 'RG Responsável', cartao_sus: 'Cartão SUS',
  cartao_plano: 'Cartão de Plano', ficha_saude: 'Ficha de Saúde',
  carteira_vacinacao: 'Carteira de Vacinação', laudo_medico: 'Laudo Médico',
  ficha_reg: 'Ficha de Reg. Atualizada', comp_residencia: 'Comp. Residência',
  aut_saida: 'Aut. Saída', aut_viagem: 'Aut. Viagem Autenticada',
  ri_assinado: 'RI Assinado', foto: 'Foto', ant_criminais: 'Ant. Criminais',
};

const CLASSES_LABELS: Record<string, string> = {
  amigo: 'Amigo', amigo_nat: 'Amigo da Natureza', companheiro: 'Companheiro',
  comp_exc: 'Comp. Excursionista', pesquisador: 'Pesquisador', pesquisador_cb: 'Pesquisador C.B.',
  pioneiro: 'Pioneiro', pioneiro_nf: 'Pioneiro N.F.', excursionista: 'Excursionista',
  exc_mata: 'Exc. da Mata', guia: 'Guia', guia_exp: 'Guia Exploração',
  agrupada: 'Agrupada', lider: 'Líder', lider_master: 'Líder Master', lider_ma: 'Líder MA',
};

const CORES_UNIDADE: Record<string, string> = {
  'Amor Perfeito': '#e91e63', 'Sempre Viva': '#4caf50',
  'Águia Dourada': '#ff9800', 'Leões': '#2196f3', 'Diretoria': '#9c27b0',
};

// Paleta de cores para avatares gerados por nome
const AVATAR_CORES = [
  '#e74c3c','#e67e22','#f39c12','#2ecc71','#1abc9c',
  '#3498db','#2980b9','#9b59b6','#8e44ad','#e91e63',
  '#16a085','#27ae60','#d35400','#c0392b','#7f8c8d',
];

function avatarCor(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_CORES[Math.abs(hash) % AVATAR_CORES.length];
}

const MAX_FOTOS = 5;

/* ─── Helpers Supabase Storage ──────────────────────────────────── */
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

async function uploadFotoDocumento(dbv_id: number, campo: string, uri: string): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const path = `${dbv_id}/${campo}_${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('documentos_fotos')
      .upload(path, blob, { upsert: false, contentType: 'image/jpeg' });
    if (error) throw error;
    const { data: signed } = await supabase.storage
      .from('documentos_fotos')
      .createSignedUrl(data.path, 3600);
    return signed?.signedUrl ?? null;
  } catch { return null; }
}

/* ─── Componente principal ──────────────────────────────────────── */
export default function MembroScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const [dbv,     setDBV]     = useState<Desbravador | null>(null);
  const [doc,     setDoc]     = useState<Documento | null>(null);
  const [classe,  setClasse]  = useState<ProgressoClasse | null>(null);
  const [especs,  setEspecs]  = useState<Array<{ nome: string; status: string }>>([]);
  const [aba,     setAba]     = useState<Aba>('docs');
  const [upFoto,  setUpFoto]  = useState(false);

  // Múltiplas fotos por campo: campo → string[]
  const [fotosDoc, setFotosDoc] = useState<Record<string, string[]>>({});
  const [fotoDocCarregando, setFotoDocCarregando] = useState<string | null>(null);
  const [souConselheiro, setSouConselheiro] = useState(false);

  // Modal de visualização de fotos
  const [fotoViewer, setFotoViewer] = useState<{ campo: string; uris: string[]; idx: number } | null>(null);

  const { atualizarCampori, atualizarDocumento, atualizarClasse, atualizarFoto } = useDBVStore();
  const usuario  = useAuthStore((s) => s.usuario);
  const isAdmin  = usuario?.perfil === 'admin_geral' || usuario?.perfil === 'admin_diretoria';
  const ehProprioMembro = String(usuario?.dbv_id) === id;
  const podeEditar = isAdmin || ehProprioMembro;
  const podeVerFotosDoc = isAdmin || ehProprioMembro;

  useEffect(() => { carregarDados(); }, [id]);

  async function carregarDados() {
    const db = await getDB();
    const d  = await db.getFirstAsync<Desbravador>('SELECT * FROM desbravadores WHERE id = ?', [id]);
    const dc = await db.getFirstAsync<Documento>('SELECT * FROM documentos WHERE dbv_id = ?', [id]);
    const cl = await db.getFirstAsync<ProgressoClasse>('SELECT * FROM progresso_classes WHERE dbv_id = ?', [id]);
    const es = await db.getAllAsync<{ nome: string; status: string }>('SELECT nome, status FROM especialidades WHERE dbv_id = ?', [id]);
    if (usuario?.dbv_id) {
      const meu = await db.getFirstAsync<{ cargo: string | null }>('SELECT cargo FROM desbravadores WHERE id = ?', [usuario.dbv_id]);
      const cargo = String(meu?.cargo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      setSouConselheiro(cargo.includes('conselheiro') || cargo === 'con');
    } else {
      setSouConselheiro(false);
    }

    // Carrega fotos de documentos (múltiplas)
    const imgs = await db.getAllAsync<{ campo: string; url: string }>(
      'SELECT campo, url FROM documento_imagens WHERE dbv_id = ? ORDER BY created_at ASC', [id]
    );
    const fotosMap: Record<string, string[]> = {};
    for (const img of imgs) {
      if (!fotosMap[img.campo]) fotosMap[img.campo] = [];
      fotosMap[img.campo].push(img.url);
    }

    setDBV(d); setDoc(dc); setClasse(cl); setEspecs(es); setFotosDoc(fotosMap);
  }

  /* ─── Foto de perfil (câmera ou galeria) ─────────────────────── */
  async function escolherFotoPerfil() {
    if (!podeEditar) return;
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
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita acesso à câmera.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, aspect: [1, 1], quality: 0.75,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita acesso à galeria.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.75,
      });
    }

    if (result.canceled || !result.assets[0]) return;
    setUpFoto(true);
    const url = await uploadFotoMembro(Number(id), result.assets[0].uri);
    const fotoFinal = url ?? result.assets[0].uri;
    await atualizarFoto(Number(id), fotoFinal);
    setDBV((prev) => prev ? { ...prev, foto_url: fotoFinal } : prev);
    if (!url) Alert.alert('Atenção', 'Salvo localmente. Será enviado ao conectar à internet.');
    setUpFoto(false);
  }

  /* ─── Foto de documento: câmera ou galeria, até MAX_FOTOS ────── */
  async function escolherFotoDoc(campo: string) {
    if (!podeEditar) return;
    const atual = fotosDoc[campo] ?? [];
    if (atual.length >= MAX_FOTOS) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_FOTOS} fotos por documento.`);
      return;
    }

    const opcoes = ['📷 Tirar foto agora', '🖼️ Escolher da galeria', 'Cancelar'];
    const escolha = await new Promise<number>((resolve) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: opcoes, cancelButtonIndex: 2 },
          resolve
        );
      } else {
        Alert.alert('Foto do documento', 'Escolha uma opção', [
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
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita acesso à câmera.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita acesso à galeria.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.85,
      });
    }

    if (result.canceled || !result.assets[0]) return;

    setFotoDocCarregando(campo);
    const uri = result.assets[0].uri;
    const url = await uploadFotoDocumento(Number(id), campo, uri);
    const fotoFinal = url ?? uri;
    let remoteId: number | null = null;
    if (url) {
      const { data } = await supabase
        .from('documento_imagens')
        .insert({ dbv_id: Number(id), campo, url })
        .select('id')
        .maybeSingle();
      remoteId = data?.id ?? null;
    }

    // Salva no DB local
    const db = await getDB();
    if (remoteId) {
      await db.runAsync(
        'INSERT OR REPLACE INTO documento_imagens (id, dbv_id, campo, url) VALUES (?, ?, ?, ?)',
        [remoteId, Number(id), campo, fotoFinal]
      );
    } else {
      await db.runAsync(
        'INSERT INTO documento_imagens (dbv_id, campo, url) VALUES (?, ?, ?)',
        [Number(id), campo, fotoFinal]
      );
    }

    setFotosDoc((prev) => ({
      ...prev,
      [campo]: [...(prev[campo] ?? []), fotoFinal],
    }));
    if (!url) Alert.alert('Atenção', 'Salvo localmente. Será enviado ao conectar.');
    setFotoDocCarregando(null);
  }

  async function removerFotoDoc(campo: string, uri: string) {
    Alert.alert('Remover foto', 'Deseja remover esta imagem?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          const db = await getDB();
          await db.runAsync(
            'DELETE FROM documento_imagens WHERE dbv_id = ? AND campo = ? AND url = ?',
            [Number(id), campo, uri]
          );
          setFotosDoc((prev) => ({
            ...prev,
            [campo]: (prev[campo] ?? []).filter((u) => u !== uri),
          }));
          setFotoViewer(null);
        },
      },
    ]);
  }

  /* ─── Status documento: OK → NA → null → OK ─────────────────── */
  async function toggleDoc(campo: string, valorAtual: StatusDoc) {
    const ciclo: StatusDoc[] = ['OK', 'NA', null];
    const idx = ciclo.indexOf(valorAtual);
    const novoValor = ciclo[(idx + 1) % ciclo.length];
    await atualizarDocumento(Number(id), campo, novoValor ?? '');
    setDoc((prev) => prev ? { ...prev, [campo]: novoValor } : prev);
  }

  async function toggleClasse(campo: string, valorAtual: string | null) {
    const opts = [null, 'Em Andamento', 'OK'];
    const idx = opts.indexOf(valorAtual);
    const novoValor = opts[(idx + 1) % opts.length];
    await atualizarClasse(Number(id), campo, novoValor ?? '');
    setClasse((prev) => prev ? { ...prev, [campo]: novoValor } : prev);
  }

  if (!dbv) return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#1a3a5c" />
    </View>
  );

  const cor         = CORES_UNIDADE[dbv.unidade_nome] ?? avatarCor(dbv.nome);
  const avatarColor = dbv.foto_url ? cor : avatarCor(dbv.nome);
  const docsOk      = doc ? Object.keys(DOCS_LABELS).filter((k) => (doc as any)[k] === 'OK').length : 0;
  const docsTotal   = Object.keys(DOCS_LABELS).length;

  function statusDocIcon(val: StatusDoc): { icon: string; color: string; label: string } {
    if (val === 'OK')  return { icon: 'checkmark-circle', color: '#2e7d32', label: 'OK' };
    if (val === 'NA')  return { icon: 'remove-circle',    color: '#78909c', label: 'N/A' };
    return               { icon: 'close-circle',          color: '#c62828', label: '—' };
  }

  return (
    <View style={styles.container}>
      {/* Header com foto */}
      <View style={[styles.header, { backgroundColor: cor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={escolherFotoPerfil} style={styles.avatarWrapper} disabled={upFoto}>
          {dbv.foto_url ? (
            <Image source={{ uri: dbv.foto_url }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarGrande, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarLetra}>{dbv.nome[0]}</Text>
            </View>
          )}
          {upFoto ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" size="small" />
            </View>
          ) : podeEditar ? (
            <View style={styles.avatarCameraBtn}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          ) : null}
        </TouchableOpacity>

        <Text style={styles.nome}>{dbv.nome}</Text>
        <Text style={styles.sub}>{dbv.unidade_nome} • {dbv.cargo} • {dbv.idade} anos</Text>

        {isAdmin && (
          <View style={styles.camporiRow}>
            <Text style={styles.camporiLabel}>Vai ao Campori DSA?</Text>
            <Switch
              value={dbv.campori_dsa}
              onValueChange={async (v) => { await atualizarCampori(dbv.id, v); setDBV({ ...dbv, campori_dsa: v }); }}
              trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#fff' }}
              thumbColor={dbv.campori_dsa ? cor : '#ddd'}
            />
          </View>
        )}
      </View>

      {/* Abas */}
      <View style={styles.abas}>
        {([
          { key: 'docs',    label: `Docs (${docsOk}/${docsTotal})` },
          { key: 'classes', label: 'Classes'        },
          { key: 'especs',  label: 'Especialidades' },
        ] as { key: Aba; label: string }[]).map(({ key, label }) => (
          <TouchableOpacity key={key} style={[styles.aba, aba === key && styles.abaAtiva]} onPress={() => setAba(key)}>
            <Text style={[styles.abaText, aba === key && styles.abaTextAtiva]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ── Documentos ── */}
        {aba === 'docs' && (
          <View>
            {(isAdmin || ehProprioMembro || souConselheiro) && (
              <View style={styles.docSegurancaNote}>
                <Ionicons name="shield-checkmark" size={16} color="#1565c0" />
                <Text style={styles.docSegurancaText}>
                  Imagens dos documentos ficam restritas ao próprio membro e administradores.
                </Text>
              </View>
            )}

            {/* Legenda dos estados */}
            <View style={styles.legendaRow}>
              <View style={styles.legendaItem}>
                <Ionicons name="checkmark-circle" size={16} color="#2e7d32" />
                <Text style={styles.legendaText}>Entregue</Text>
              </View>
              <View style={styles.legendaItem}>
                <Ionicons name="remove-circle" size={16} color="#78909c" />
                <Text style={styles.legendaText}>Não se aplica</Text>
              </View>
              <View style={styles.legendaItem}>
                <Ionicons name="close-circle" size={16} color="#c62828" />
                <Text style={styles.legendaText}>Pendente</Text>
              </View>
            </View>

            {Object.entries(DOCS_LABELS).map(([campo, label]) => {
              const val = doc ? (doc as any)[campo] as StatusDoc : null;
              const fotos = fotosDoc[campo] ?? [];
              const carregando = fotoDocCarregando === campo;
              const { icon, color } = statusDocIcon(val);
              const podeAdicionarFoto = podeEditar && fotos.length < MAX_FOTOS;

              return (
                <View key={campo} style={styles.docCard}>
                  <View style={styles.docRow}>
                    {/* Status toggle */}
                    <TouchableOpacity
                      onPress={() => podeEditar && toggleDoc(campo, val)}
                      disabled={!podeEditar}
                      style={styles.statusBtn}
                    >
                      <Ionicons name={icon as any} size={24} color={color} />
                    </TouchableOpacity>

                    <Text style={styles.itemLabel}>{label}</Text>

                    {/* Contador de fotos */}
                    {fotos.length > 0 && (
                      <TouchableOpacity
                        style={styles.fotoCountBadge}
                        onPress={() => podeVerFotosDoc ? setFotoViewer({ campo, uris: fotos, idx: 0 }) : undefined}
                        disabled={!podeVerFotosDoc}
                      >
                        <Ionicons name="images" size={14} color="#1a3a5c" />
                        <Text style={styles.fotoCountText}>{fotos.length}/{MAX_FOTOS}</Text>
                      </TouchableOpacity>
                    )}

                    {/* Botão câmera */}
                    {podeEditar && (
                      <TouchableOpacity
                        onPress={() => escolherFotoDoc(campo)}
                        style={[styles.docFotoBtn, !podeAdicionarFoto && { opacity: 0.4 }]}
                        disabled={carregando || !podeAdicionarFoto}
                      >
                        {carregando
                          ? <ActivityIndicator size="small" color="#1a3a5c" />
                          : <Ionicons
                              name={fotos.length >= MAX_FOTOS ? 'camera-outline' : 'camera'}
                              size={20}
                              color={fotos.length > 0 ? '#1a3a5c' : '#aaa'}
                            />
                        }
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Miniaturas das fotos */}
                  {fotos.length > 0 && podeVerFotosDoc && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotosRow}>
                      {fotos.map((uri, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => setFotoViewer({ campo, uris: fotos, idx })}
                          style={styles.miniThumb}
                        >
                          <Image source={{ uri }} style={styles.miniThumbImg} />
                          <View style={styles.miniThumbNum}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{idx + 1}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Classes ── */}
        {aba === 'classes' && (
          <View>
            {Object.entries(CLASSES_LABELS).map(([campo, label]) => {
              const val = classe ? (classe as any)[campo] : null;
              const corC = val === 'OK' ? '#2e7d32' : val === 'Em Andamento' ? '#f57c00' : '#bbb';
              return (
                <TouchableOpacity
                  key={campo} style={styles.itemRow}
                  onPress={() => isAdmin && toggleClasse(campo, val)}
                  disabled={!isAdmin}
                >
                  <View style={[styles.classeIndicador, { backgroundColor: corC }]} />
                  <Text style={styles.itemLabel}>{label}</Text>
                  <Text style={[styles.classeStatus, { color: corC }]}>{val ?? '—'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Especialidades ── */}
        {aba === 'especs' && (
          <View>
            {especs.length === 0 && <Text style={styles.vazio}>Nenhuma especialidade registrada.</Text>}
            {especs.map((e, i) => (
              <View key={i} style={styles.itemRow}>
                <Ionicons name={e.status === 'OK' ? 'star' : 'star-outline'} size={20} color={e.status === 'OK' ? '#ff9800' : '#ccc'} />
                <Text style={styles.itemLabel}>{e.nome}</Text>
                <Text style={{ color: e.status === 'OK' ? '#2e7d32' : '#c62828', fontSize: 12 }}>{e.status}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Viewer de fotos ── */}
      <Modal visible={!!fotoViewer} transparent animationType="fade">
        <View style={styles.viewerBg}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setFotoViewer(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          {fotoViewer && (
            <>
              <Image
                source={{ uri: fotoViewer.uris[fotoViewer.idx] }}
                style={styles.viewerImg}
                resizeMode="contain"
              />
              <View style={styles.viewerNav}>
                <TouchableOpacity
                  onPress={() => setFotoViewer((p) => p ? { ...p, idx: Math.max(0, p.idx - 1) } : p)}
                  disabled={fotoViewer.idx === 0}
                  style={[styles.viewerNavBtn, fotoViewer.idx === 0 && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.viewerCounter}>
                  {fotoViewer.idx + 1} / {fotoViewer.uris.length}
                </Text>
                <TouchableOpacity
                  onPress={() => setFotoViewer((p) => p ? { ...p, idx: Math.min(p.uris.length - 1, p.idx + 1) } : p)}
                  disabled={fotoViewer.idx === fotoViewer.uris.length - 1}
                  style={[styles.viewerNavBtn, fotoViewer.idx === fotoViewer.uris.length - 1 && { opacity: 0.3 }]}
                >
                  <Ionicons name="chevron-forward" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              {podeEditar && (
                <TouchableOpacity
                  style={styles.viewerDelete}
                  onPress={() => removerFotoDoc(fotoViewer.campo, fotoViewer.uris[fotoViewer.idx])}
                >
                  <Ionicons name="trash" size={22} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Remover</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f0f4f8' },
  loading:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:      { paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center' },
  backBtn:     { position: 'absolute', top: 52, left: 16, padding: 8 },

  avatarWrapper:   { position: 'relative', marginBottom: 12 },
  avatarImg:       { width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarGrande:    { width: 86, height: 86, borderRadius: 43, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarLetra:     { color: '#fff', fontSize: 36, fontWeight: '800' },
  avatarOverlay:   { position: 'absolute', inset: 0, borderRadius: 43, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  avatarCameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },

  nome:        { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub:         { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  camporiRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  camporiLabel:{ color: '#fff', fontSize: 14 },

  abas:        { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  aba:         { flex: 1, paddingVertical: 12, alignItems: 'center' },
  abaAtiva:    { borderBottomWidth: 2, borderBottomColor: '#1a3a5c' },
  abaText:     { fontSize: 12, color: '#888', fontWeight: '600' },
  abaTextAtiva:{ color: '#1a3a5c' },

  content:     { flex: 1, padding: 12 },

  docSegurancaNote: { flexDirection: 'row', backgroundColor: '#e3f2fd', borderRadius: 10, padding: 10, marginBottom: 8, gap: 8, alignItems: 'flex-start' },
  docSegurancaText: { flex: 1, fontSize: 12, color: '#1565c0', lineHeight: 16 },

  legendaRow:  { flexDirection: 'row', gap: 16, marginBottom: 10, paddingHorizontal: 4 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendaText: { fontSize: 11, color: '#666' },

  docCard:     { backgroundColor: '#fff', borderRadius: 12, marginBottom: 6, overflow: 'hidden', elevation: 1 },
  docRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  statusBtn:   { padding: 2 },
  itemLabel:   { flex: 1, fontSize: 13, color: '#333', fontWeight: '500' },
  fotoCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e8f0fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fotoCountText:  { fontSize: 11, color: '#1a3a5c', fontWeight: '700' },
  docFotoBtn:  { padding: 6, borderRadius: 8, backgroundColor: '#f0f4f8' },

  fotosRow:    { paddingHorizontal: 12, paddingBottom: 10, gap: 6 },
  miniThumb:   { position: 'relative', marginRight: 6 },
  miniThumbImg:{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
  miniThumbNum:{ position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },

  itemRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 6, gap: 12, elevation: 1 },
  classeIndicador: { width: 12, height: 12, borderRadius: 6 },
  classeStatus:{ fontSize: 12, fontWeight: '600' },
  vazio:       { textAlign: 'center', color: '#999', marginTop: 30 },

  // Viewer
  viewerBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
  viewerImg:   { width: '100%', height: '70%' },
  viewerNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, marginTop: 16 },
  viewerNavBtn:{ padding: 10 },
  viewerCounter:{ color: '#fff', fontSize: 16, fontWeight: '600', minWidth: 60, textAlign: 'center' },
  viewerDelete:{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 20, backgroundColor: 'rgba(231,76,60,0.8)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
});

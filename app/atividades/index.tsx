import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '../../src/stores/authStore';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { enviarParaAlvos } from '../../src/lib/notifications';
import { DateField } from '../../src/components/DateField';
import { getPublicMenuIds } from '../../src/lib/publicMenuConfig';

/* ─── Types ──────────────────────────────────────────────────────── */
interface Atividade {
  id: number; supabase_id?: number; titulo: string;
  descricao: string | null; data: string | null;
  destino: 'todos' | 'unidade' | 'desbravador';
  unidade_id: number | null; unidade_nome: string | null;
  dbv_id: number | null; dbv_nome: string | null;
  criado_por: string | null; created_at: string;
}
interface Anexo {
  id: number; supabase_id?: number; atividade_id: number;
  nome: string; url: string; tipo: 'image' | 'pdf' | 'word' | 'outro';
}
interface Resposta {
  id: number; supabase_id?: number; atividade_id: number;
  dbv_id: number; dbv_nome: string | null;
  texto: string | null; anexo_url: string | null; anexo_nome: string | null;
  created_at: string;
}
interface AnexoPendente { uri: string; nome: string; tipo: Anexo['tipo']; }
interface UnidadeLocal { id: number; nome: string; cor: string; }
interface DBVLocal { id: number; nome: string; unidade_nome: string; }
interface MembroProgresso { id: number; nome: string; resposta: Resposta | null; }

/* ─── Helpers ────────────────────────────────────────────────────── */
function fmt(d: string | null) {
  if (!d) return '';
  try { return format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
}
function tipoAnexo(nome: string, mime?: string): Anexo['tipo'] {
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  if (mime?.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['doc','docx'].includes(ext) || mime?.includes('word')) return 'word';
  return 'outro';
}
function tipoIcon(tipo: Anexo['tipo']): { name: string; color: string } {
  if (tipo === 'pdf')   return { name: 'document-text',  color: '#c62828' };
  if (tipo === 'word')  return { name: 'document-text',  color: '#1565c0' };
  if (tipo === 'image') return { name: 'image',          color: '#2e7d32' };
  return                       { name: 'attach',         color: '#555'    };
}

async function uploadParaStorage(
  path: string, uri: string, mime: string
): Promise<string | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    const { data, error } = await supabase.storage
      .from('atividades')
      .upload(path, blob, { upsert: true, contentType: mime });
    if (error) throw error;
    return supabase.storage.from('atividades').getPublicUrl(data.path).data.publicUrl;
  } catch { return null; }
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function AtividadesScreen() {
  const usuario  = useAuthStore((s) => s.usuario);
  const isAdmin  = usuario?.perfil === 'admin_geral' || usuario?.perfil === 'admin_diretoria';

  const [atividades,  setAtividades]  = useState<Atividade[]>([]);
  const [anexosMap,   setAnexosMap]   = useState<Record<number, Anexo[]>>({});
  const [respostasMap,setRespostasMap]= useState<Record<number, Resposta[]>>({});
  const [loading,     setLoading]     = useState(true);
  const [ehConselheiro, setEhConselheiro] = useState(false);

  /* ─── Tabs ── */
  const [aba, setAba] = useState<'lista' | 'progresso'>('lista');

  /* ─── Modal criar/editar ── */
  const [modalCRUD,   setModalCRUD]   = useState(false);
  const [editando,    setEditando]    = useState<Atividade | null>(null);
  const [fTitulo,     setFTitulo]     = useState('');
  const [fDesc,       setFDesc]       = useState('');
  const [fData,       setFData]       = useState('');
  const [fDestino,    setFDestino]    = useState<Atividade['destino']>('todos');
  const [fUnidade,    setFUnidade]    = useState<UnidadeLocal | null>(null);
  const [fDbv,        setFDbv]        = useState<DBVLocal | null>(null);
  const [buscaDbv,    setBuscaDbv]    = useState('');
  const [anexosPend,  setAnexosPend]  = useState<AnexoPendente[]>([]);
  const [salvando,    setSalvando]    = useState(false);
  const [unidades,    setUnidades]    = useState<UnidadeLocal[]>([]);
  const [dbvs,        setDbvs]        = useState<DBVLocal[]>([]);

  /* ─── Modal responder ── */
  const [modalResp,   setModalResp]   = useState(false);
  const [respAtiv,    setRespAtiv]    = useState<Atividade | null>(null);
  const [respTexto,   setRespTexto]   = useState('');
  const [respAnexo,   setRespAnexo]   = useState<AnexoPendente | null>(null);
  const [enviandoResp,setEnviandoResp]= useState(false);

  /* ─── Modal progresso ── */
  const [modalProg,   setModalProg]   = useState(false);
  const [progAtiv,    setProgAtiv]    = useState<Atividade | null>(null);
  const [membrosStatus, setMembrosStatus] = useState<MembroProgresso[]>([]);
  const [publicoLiberado, setPublicoLiberado] = useState(false);
  const [loadingProg, setLoadingProg] = useState(false);

  /* ─── Check conselheiro ── */
  useEffect(() => {
    if (!usuario?.dbv_id) return;
    getDB().then(async db => {
      const d = await db.getFirstAsync<{ cargo: string | null }>(
        'SELECT cargo FROM desbravadores WHERE id = ?', [usuario.dbv_id as number]
      );
      const c = (d?.cargo ?? '').toLowerCase();
      setEhConselheiro(c.includes('conselheiro') || c.includes('conselheira'));
    }).catch(() => {});
  }, [usuario?.dbv_id]);

  const podeVerProgresso = isAdmin || ehConselheiro;

  /* ─── Focus sync ── */
  useFocusEffect(useCallback(() => {
    getPublicMenuIds().then((ids) => setPublicoLiberado(ids.includes('atividades')));
    sincronizar().then(carregar);
  }, [isAdmin, usuario]));

  async function sincronizar() {
    try {
      const db = await getDB();
      const { data: ats } = await supabase.from('atividades').select('*');
      if (ats) for (const a of ats) {
        await db.runAsync(
          `INSERT OR REPLACE INTO atividades
           (supabase_id,titulo,descricao,data,destino,unidade_id,unidade_nome,dbv_id,dbv_nome,criado_por,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [a.id,a.titulo,a.descricao,a.data,a.destino,a.unidade_id,a.unidade_nome,a.dbv_id,a.dbv_nome,a.criado_por,a.created_at]
        );
      }
      const { data: anexos } = await supabase.from('atividades_anexos').select('*');
      if (anexos) for (const x of anexos) {
        await db.runAsync(
          `INSERT OR REPLACE INTO atividades_anexos (supabase_id,atividade_id,nome,url,tipo,created_at)
           SELECT ?,a.id,?,?,?,? FROM atividades a WHERE a.supabase_id=?`,
          [x.id,x.nome,x.url,x.tipo,x.created_at,x.atividade_id]
        );
      }
      const { data: resps } = await supabase.from('atividades_respostas').select('*');
      if (resps) for (const r of resps) {
        await db.runAsync(
          `INSERT OR REPLACE INTO atividades_respostas
           (supabase_id,atividade_id,dbv_id,dbv_nome,texto,anexo_url,anexo_nome,created_at,updated_at)
           SELECT ?,a.id,?,?,?,?,?,?,? FROM atividades a WHERE a.supabase_id=?`,
          [r.id,r.dbv_id,r.dbv_nome,r.texto,r.anexo_url,r.anexo_nome,r.created_at,r.updated_at,r.atividade_id]
        );
      }
    } catch { /* offline */ }
  }

  async function carregar() {
    setLoading(true);
    try {
      const db = await getDB();
      let rows: Atividade[];
      if (isAdmin) {
        rows = await db.getAllAsync<Atividade>('SELECT * FROM atividades ORDER BY created_at DESC');
      } else {
        rows = await db.getAllAsync<Atividade>(
          `SELECT * FROM atividades
           WHERE destino='todos'
              OR (destino='unidade' AND unidade_id=?)
              OR (destino='desbravador' AND dbv_id=?)
           ORDER BY created_at DESC`,
          [usuario?.unidade_id ?? -1, usuario?.dbv_id ?? -1]
        );
      }
      setAtividades(rows);

      // Anexos
      const allAnexos = await db.getAllAsync<Anexo>('SELECT * FROM atividades_anexos');
      const am: Record<number, Anexo[]> = {};
      for (const x of allAnexos) {
        if (!am[x.atividade_id]) am[x.atividade_id] = [];
        am[x.atividade_id].push(x);
      }
      setAnexosMap(am);

      // Respostas
      const allResps = await db.getAllAsync<Resposta>('SELECT * FROM atividades_respostas');
      const rm: Record<number, Resposta[]> = {};
      for (const r of allResps) {
        if (!rm[r.atividade_id]) rm[r.atividade_id] = [];
        rm[r.atividade_id].push(r);
      }
      setRespostasMap(rm);
    } finally { setLoading(false); }
  }

  /* ─── CRUD atividade ─────────────────────────────────────────────── */
  async function carregarUnidadesDbvs() {
    const db = await getDB();
    setUnidades(await db.getAllAsync<UnidadeLocal>('SELECT id,nome,cor FROM unidades ORDER BY nome'));
    setDbvs(await db.getAllAsync<DBVLocal>('SELECT id,nome,unidade_nome FROM desbravadores ORDER BY nome'));
  }

  function abrirCriar() {
    setEditando(null); setFTitulo(''); setFDesc(''); setFData('');
    setFDestino('todos'); setFUnidade(null); setFDbv(null);
    setBuscaDbv(''); setAnexosPend([]);
    carregarUnidadesDbvs();
    setModalCRUD(true);
  }

  function abrirEditar(a: Atividade) {
    setEditando(a); setFTitulo(a.titulo); setFDesc(a.descricao ?? '');
    setFData(a.data ?? ''); setFDestino(a.destino);
    setFUnidade(a.unidade_id ? { id: a.unidade_id, nome: a.unidade_nome ?? '', cor: '' } : null);
    setFDbv(a.dbv_id ? { id: a.dbv_id, nome: a.dbv_nome ?? '', unidade_nome: '' } : null);
    setBuscaDbv(a.dbv_nome ?? ''); setAnexosPend([]);
    carregarUnidadesDbvs();
    setModalCRUD(true);
  }

  async function escolherAnexo() {
    if (anexosPend.length >= 5) { Alert.alert('Limite', 'Máximo de 5 anexos.'); return; }
    Alert.alert('Adicionar anexo', 'Escolha o tipo de arquivo', [
      {
        text: '📷 Imagem', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!r.canceled && r.assets[0]) {
            const a = r.assets[0];
            const nome = `imagem_${Date.now()}.jpg`;
            setAnexosPend(p => [...p, { uri: a.uri, nome, tipo: 'image' }]);
          }
        },
      },
      {
        text: '📄 PDF / Word', onPress: async () => {
          const r = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf','application/msword',
                   'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            copyToCacheDirectory: true,
          });
          if (!r.canceled && r.assets[0]) {
            const a = r.assets[0];
            setAnexosPend(p => [...p, { uri: a.uri, nome: a.name, tipo: tipoAnexo(a.name, a.mimeType ?? '') }]);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function salvarAtividade() {
    if (!fTitulo.trim()) { Alert.alert('Atenção', 'Título obrigatório.'); return; }
    if (fDestino === 'unidade' && !fUnidade) { Alert.alert('Atenção', 'Selecione uma unidade.'); return; }
    if (fDestino === 'desbravador' && !fDbv) { Alert.alert('Atenção', 'Selecione um desbravador.'); return; }
    setSalvando(true);
    try {
      const payload = {
        titulo: fTitulo.trim(), descricao: fDesc.trim() || null,
        data: fData.trim() || null, destino: fDestino,
        unidade_id: fDestino === 'unidade' ? fUnidade!.id : null,
        unidade_nome: fDestino === 'unidade' ? fUnidade!.nome : null,
        dbv_id: fDestino === 'desbravador' ? fDbv!.id : null,
        dbv_nome: fDestino === 'desbravador' ? fDbv!.nome : null,
        criado_por: usuario?.nome ?? null,
      };
      const db = await getDB();
      let supId: number | null = editando?.supabase_id ?? null;

      if (editando) {
        if (supId) await supabase.from('atividades').update(payload).eq('id', supId);
        await db.runAsync(
          `UPDATE atividades SET titulo=?,descricao=?,data=?,destino=?,
           unidade_id=?,unidade_nome=?,dbv_id=?,dbv_nome=?,criado_por=? WHERE id=?`,
          [payload.titulo,payload.descricao,payload.data,payload.destino,
           payload.unidade_id,payload.unidade_nome,payload.dbv_id,payload.dbv_nome,
           payload.criado_por,editando.id]
        );
      } else {
        const { data: ins } = await supabase.from('atividades').insert(payload).select().single();
        supId = ins?.id ?? null;
        const { lastInsertRowId } = await db.runAsync(
          `INSERT INTO atividades (supabase_id,titulo,descricao,data,destino,unidade_id,unidade_nome,dbv_id,dbv_nome,criado_por)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [supId,payload.titulo,payload.descricao,payload.data,payload.destino,
           payload.unidade_id,payload.unidade_nome,payload.dbv_id,payload.dbv_nome,payload.criado_por]
        );
        // upload & save pending attachments
        for (const ap of anexosPend) {
          const mime = ap.tipo === 'image' ? 'image/jpeg' :
                       ap.tipo === 'pdf'   ? 'application/pdf' : 'application/octet-stream';
          const path = `${supId ?? lastInsertRowId}/anexo_${Date.now()}_${ap.nome}`;
          const url = await uploadParaStorage(path, ap.uri, mime) ?? ap.uri;
          const { data: xIns } = await supabase.from('atividades_anexos')
            .insert({ atividade_id: supId, nome: ap.nome, url, tipo: ap.tipo })
            .select().single();
          await db.runAsync(
            `INSERT INTO atividades_anexos (supabase_id,atividade_id,nome,url,tipo) VALUES (?,?,?,?,?)`,
            [xIns?.id ?? null, lastInsertRowId, ap.nome, url, ap.tipo]
          );
        }
      }

      // Upload anexos pendentes para edição também
      if (editando && anexosPend.length > 0) {
        const localId = editando.id;
        for (const ap of anexosPend) {
          const mime = ap.tipo === 'image' ? 'image/jpeg' :
                       ap.tipo === 'pdf'   ? 'application/pdf' : 'application/octet-stream';
          const path = `${supId ?? localId}/anexo_${Date.now()}_${ap.nome}`;
          const url = await uploadParaStorage(path, ap.uri, mime) ?? ap.uri;
          const { data: xIns } = await supabase.from('atividades_anexos')
            .insert({ atividade_id: supId, nome: ap.nome, url, tipo: ap.tipo })
            .select().single();
          await db.runAsync(
            `INSERT INTO atividades_anexos (supabase_id,atividade_id,nome,url,tipo) VALUES (?,?,?,?,?)`,
            [xIns?.id ?? null, localId, ap.nome, url, ap.tipo]
          );
        }
      }

      await enviarParaAlvos(
        editando ? `📋 Atividade atualizada: ${payload.titulo}` : `📋 Nova atividade: ${payload.titulo}`,
        payload.descricao ?? 'Toque para ver detalhes',
        { tela: 'atividades' },
        fDestino, payload.unidade_id ?? undefined, payload.dbv_id ?? undefined
      );
      setModalCRUD(false);
      await sincronizar(); await carregar();
    } catch { Alert.alert('Erro', 'Não foi possível salvar.'); }
    finally { setSalvando(false); }
  }

  async function excluirAtividade(a: Atividade) {
    Alert.alert('Excluir', `Remover "${a.titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        const db = await getDB();
        if (a.supabase_id) await supabase.from('atividades').delete().eq('id', a.supabase_id);
        await db.runAsync('DELETE FROM atividades_anexos WHERE atividade_id=?', [a.id]);
        await db.runAsync('DELETE FROM atividades_respostas WHERE atividade_id=?', [a.id]);
        await db.runAsync('DELETE FROM atividades WHERE id=?', [a.id]);
        await carregar();
      }},
    ]);
  }

  /* ─── Responder ──────────────────────────────────────────────────── */
  function abrirResponder(a: Atividade) {
    const resp = respostasMap[a.id]?.find(r => r.dbv_id === usuario?.dbv_id);
    setRespAtiv(a);
    setRespTexto(resp?.texto ?? '');
    setRespAnexo(null);
    setModalResp(true);
  }

  async function escolherAnexoResposta() {
    Alert.alert('Anexar à resposta', 'Escolha', [
      {
        text: '📷 Imagem', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!r.canceled && r.assets[0]) {
            setRespAnexo({ uri: r.assets[0].uri, nome: `imagem_${Date.now()}.jpg`, tipo: 'image' });
          }
        },
      },
      {
        text: '📄 Documento', onPress: async () => {
          const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
          if (!r.canceled && r.assets[0]) {
            const a = r.assets[0];
            setRespAnexo({ uri: a.uri, nome: a.name, tipo: tipoAnexo(a.name, a.mimeType ?? '') });
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function enviarResposta() {
    if (!respTexto.trim() && !respAnexo) { Alert.alert('Atenção', 'Escreva um texto ou anexe um arquivo.'); return; }
    if (!usuario?.dbv_id) { Alert.alert('Atenção', 'Seu perfil não está vinculado a um desbravador.'); return; }
    setEnviandoResp(true);
    try {
      const db = await getDB();
      const dbvId = usuario.dbv_id;
      const supId = respAtiv!.supabase_id;

      let anexoUrl: string | null = null;
      let anexoNome: string | null = null;
      if (respAnexo) {
        const mime = respAnexo.tipo === 'image' ? 'image/jpeg' : 'application/octet-stream';
        const path = `${supId ?? respAtiv!.id}/resposta_${dbvId}_${Date.now()}_${respAnexo.nome}`;
        anexoUrl = await uploadParaStorage(path, respAnexo.uri, mime) ?? respAnexo.uri;
        anexoNome = respAnexo.nome;
      }

      const payload = {
        atividade_id: supId,
        dbv_id: dbvId,
        dbv_nome: usuario.nome,
        texto: respTexto.trim() || null,
        anexo_url: anexoUrl,
        anexo_nome: anexoNome,
        updated_at: new Date().toISOString(),
      };

      // Supabase upsert
      const { data: rIns } = await supabase.from('atividades_respostas')
        .upsert(payload, { onConflict: 'atividade_id,dbv_id' }).select().single();

      // SQLite upsert
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM atividades_respostas WHERE atividade_id=? AND dbv_id=?',
        [respAtiv!.id, dbvId]
      );
      if (existing) {
        await db.runAsync(
          `UPDATE atividades_respostas SET texto=?,anexo_url=?,anexo_nome=?,supabase_id=?,updated_at=datetime('now') WHERE id=?`,
          [payload.texto, anexoUrl, anexoNome, rIns?.id ?? null, existing.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO atividades_respostas (supabase_id,atividade_id,dbv_id,dbv_nome,texto,anexo_url,anexo_nome)
           VALUES (?,?,?,?,?,?,?)`,
          [rIns?.id ?? null, respAtiv!.id, dbvId, usuario.nome, payload.texto, anexoUrl, anexoNome]
        );
      }

      setModalResp(false);
      await carregar();
      Alert.alert('✅ Resposta enviada!', 'Sua resposta foi registrada.');
    } catch { Alert.alert('Erro', 'Não foi possível enviar a resposta.'); }
    finally { setEnviandoResp(false); }
  }

  /* ─── Progresso ──────────────────────────────────────────────────── */
  async function abrirProgresso(a: Atividade) {
    setProgAtiv(a); setLoadingProg(true); setModalProg(true);
    try {
      const db = await getDB();
      let membros: { id: number; nome: string }[] = [];
      if (a.destino === 'todos') {
        membros = await db.getAllAsync<{ id: number; nome: string }>(
          `SELECT id, nome FROM desbravadores WHERE unidade_nome != 'Diretoria' OR unidade_nome IS NULL ORDER BY nome`
        );
      } else if (a.destino === 'unidade') {
        membros = await db.getAllAsync<{ id: number; nome: string }>(
          'SELECT id, nome FROM desbravadores WHERE unidade_id=? ORDER BY nome', [a.unidade_id]
        );
      } else {
        membros = await db.getAllAsync<{ id: number; nome: string }>(
          'SELECT id, nome FROM desbravadores WHERE id=?', [a.dbv_id]
        );
      }
      const resps = respostasMap[a.id] ?? [];
      setMembrosStatus(membros.map(m => ({
        id: m.id, nome: m.nome,
        resposta: resps.find(r => r.dbv_id === m.id) ?? null,
      })));
    } finally { setLoadingProg(false); }
  }

  /* ─── Render helpers ─────────────────────────────────────────────── */
  const dbvsFiltrados = buscaDbv.length >= 2
    ? dbvs.filter(d => d.nome.toLowerCase().includes(buscaDbv.toLowerCase()))
    : [];

  function meuStatus(a: Atividade): 'respondido' | 'pendente' | 'na' {
    if (!usuario?.dbv_id) return 'na';
    return respostasMap[a.id]?.some(r => r.dbv_id === usuario.dbv_id) ? 'respondido' : 'pendente';
  }

  const pendentesCount = isAdmin ? 0 : atividades.filter(a => meuStatus(a) === 'pendente').length;

  if (!usuario && !publicoLiberado) return <Redirect href="/auth/login" />;

  /* ─── Render ─────────────────────────────────────────────────────── */
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>📋 Atividades</Text>
        {isAdmin && (
          <TouchableOpacity onPress={abrirCriar} style={{ padding: 4 }}>
            <Ionicons name="add-circle-outline" size={26} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs (admin/conselheiro) */}
      {podeVerProgresso && (
        <View style={s.tabs}>
          {(['lista','progresso'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.tab, aba === t && s.tabAtiva]} onPress={() => setAba(t)}>
              <Text style={[s.tabText, aba === t && s.tabTextAtiva]}>
                {t === 'lista' ? 'Atividades' : 'Progresso'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Badge pendentes (member) */}
      {!isAdmin && pendentesCount > 0 && (
        <View style={s.pendBanner}>
          <Ionicons name="alert-circle" size={16} color="#ff6b35" />
          <Text style={s.pendBannerText}>{pendentesCount} atividade(s) pendente(s) de resposta</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a3a5c" />
      ) : aba === 'lista' ? (
        /* ── Lista ── */
        <ScrollView contentContainerStyle={s.list}>
          {atividades.length === 0 && (
            <View style={s.emptyWrap}>
              <Ionicons name="clipboard-outline" size={64} color="#ccc" />
              <Text style={s.emptyText}>Nenhuma atividade encontrada</Text>
            </View>
          )}
          {atividades.map(a => {
            const anexos = anexosMap[a.id] ?? [];
            const resps  = respostasMap[a.id] ?? [];
            const status = meuStatus(a);
            const minhaResp = resps.find(r => r.dbv_id === usuario?.dbv_id);
            return (
              <View key={a.id} style={s.card}>
                {/* Cabeçalho */}
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitulo}>{a.titulo}</Text>
                    {a.data && <Text style={s.cardData}>{fmt(a.data)}</Text>}
                  </View>
                  {isAdmin && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity style={s.acaoBtn} onPress={() => abrirEditar(a)}>
                        <Ionicons name="pencil-outline" size={16} color="#1a3a5c" />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.acaoBtn} onPress={() => excluirAtividade(a)}>
                        <Ionicons name="trash-outline" size={16} color="#c62828" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {a.descricao ? <Text style={s.cardDesc} numberOfLines={3}>{a.descricao}</Text> : null}

                {/* Badge destino */}
                <View style={s.badgeRow}>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>
                      {a.destino === 'todos' ? '👥 Todos' : a.destino === 'unidade' ? `🏠 ${a.unidade_nome}` : `👤 ${a.dbv_nome}`}
                    </Text>
                  </View>
                  {a.criado_por && <Text style={s.criadoPor}>por {a.criado_por}</Text>}
                </View>

                {/* Anexos da atividade */}
                {anexos.length > 0 && (
                  <View style={s.anexosRow}>
                    {anexos.map(x => (
                      <TouchableOpacity key={x.id} style={s.anexoChip}
                        onPress={() => Linking.openURL(x.url)}>
                        {x.tipo === 'image' ? (
                          <Image source={{ uri: x.url }} style={s.anexoThumb} />
                        ) : (
                          <Ionicons name={tipoIcon(x.tipo).name as any} size={18} color={tipoIcon(x.tipo).color} />
                        )}
                        <Text style={s.anexoNome} numberOfLines={1}>{x.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Status membro / botão responder */}
                {!isAdmin && status !== 'na' && (
                  status === 'respondido' ? (
                    <View style={s.respondidoBox}>
                      <Ionicons name="checkmark-circle" size={16} color="#2e7d32" />
                      <Text style={s.respondidoText}>Respondido</Text>
                      {minhaResp?.texto && <Text style={s.respPreview} numberOfLines={1}>{minhaResp.texto}</Text>}
                      <TouchableOpacity onPress={() => abrirResponder(a)}>
                        <Text style={s.editarRespText}>Editar</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.responderBtn} onPress={() => abrirResponder(a)}>
                      <Ionicons name="send-outline" size={15} color="#fff" />
                      <Text style={s.responderBtnText}>Responder</Text>
                    </TouchableOpacity>
                  )
                )}

                {/* Stats para admin/conselheiro */}
                {podeVerProgresso && (
                  <TouchableOpacity style={s.statsRow} onPress={() => abrirProgresso(a)}>
                    <Text style={s.statsText}>
                      ✅ {resps.length} responderam
                    </Text>
                    <View style={s.verProg}>
                      <Text style={s.verProgText}>Ver progresso</Text>
                      <Ionicons name="chevron-forward" size={12} color="#1a3a5c" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      ) : (
        /* ── Aba Progresso ── */
        <ScrollView contentContainerStyle={s.list}>
          {atividades.map(a => {
            const resps = respostasMap[a.id] ?? [];
            return (
              <TouchableOpacity key={a.id} style={s.card} onPress={() => abrirProgresso(a)} activeOpacity={0.8}>
                <Text style={s.cardTitulo}>{a.titulo}</Text>
                {a.data && <Text style={s.cardData}>{fmt(a.data)}</Text>}
                <View style={[s.statsRow, { marginTop: 8 }]}>
                  <Text style={s.statsText}>✅ {resps.length} responderam</Text>
                  <Ionicons name="chevron-forward" size={16} color="#1a3a5c" />
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ═══ Modal criar/editar ═══ */}
      <Modal visible={modalCRUD} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalCRUD(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalCRUD(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={s.modalTitulo}>{editando ? 'Editar atividade' : 'Nova atividade'}</Text>
              <TouchableOpacity onPress={salvarAtividade} disabled={salvando}>
                {salvando ? <ActivityIndicator size="small" color="#1a3a5c" />
                          : <Text style={s.modalSalvar}>Salvar</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Título *</Text>
              <TextInput style={s.input} value={fTitulo} onChangeText={setFTitulo} placeholder="Título da atividade" autoFocus />

              <Text style={s.label}>Descrição</Text>
              <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={fDesc} onChangeText={setFDesc} placeholder="Descrição (opcional)" multiline />

              <Text style={s.label}>Data</Text>
              <DateField
                value={fData}
                onChange={setFData}
                placeholder="Selecionar data"
                minimumDate={new Date(2026, 0, 1)}
                maximumDate={new Date(2035, 11, 31)}
              />

              <Text style={s.label}>Destino</Text>
              <View style={s.chipRow}>
                {(['todos','unidade','desbravador'] as const).map(d => (
                  <TouchableOpacity key={d}
                    style={[s.chip, fDestino === d && s.chipAtivo]}
                    onPress={() => { setFDestino(d); setFUnidade(null); setFDbv(null); setBuscaDbv(''); }}>
                    <Text style={[s.chipText, fDestino === d && s.chipTextAtivo]}>
                      {d === 'todos' ? '👥 Todos' : d === 'unidade' ? '🏠 Unidade' : '👤 Desbravador'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {fDestino === 'unidade' && (
                <>
                  <Text style={s.label}>Unidade</Text>
                  <View style={s.chipRow}>
                    {unidades.map(u => (
                      <TouchableOpacity key={u.id}
                        style={[s.chip, fUnidade?.id === u.id && s.chipAtivo]}
                        onPress={() => setFUnidade(u)}>
                        <Text style={[s.chipText, fUnidade?.id === u.id && s.chipTextAtivo]}>{u.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {fDestino === 'desbravador' && (
                <>
                  <Text style={s.label}>Buscar desbravador</Text>
                  <TextInput style={s.input} value={buscaDbv} onChangeText={setBuscaDbv}
                    placeholder="Digite o nome (mín. 2 letras)" />
                  {dbvsFiltrados.slice(0, 6).map(d => (
                    <TouchableOpacity key={d.id} style={[s.dbvItem, fDbv?.id === d.id && s.dbvItemAtivo]}
                      onPress={() => { setFDbv(d); setBuscaDbv(d.nome); }}>
                      <Text style={[s.dbvNome, fDbv?.id === d.id && { color: '#fff' }]}>{d.nome}</Text>
                      <Text style={[s.dbvSub, fDbv?.id === d.id && { color: '#cde' }]}>{d.unidade_nome}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Anexos */}
              <Text style={s.label}>Anexos ({anexosPend.length}/5)</Text>
              {anexosPend.map((ap, i) => (
                <View key={i} style={s.anexoPendItem}>
                  {ap.tipo === 'image'
                    ? <Image source={{ uri: ap.uri }} style={s.anexoPendThumb} />
                    : <Ionicons name={tipoIcon(ap.tipo).name as any} size={22} color={tipoIcon(ap.tipo).color} />}
                  <Text style={s.anexoPendNome} numberOfLines={1}>{ap.nome}</Text>
                  <TouchableOpacity onPress={() => setAnexosPend(p => p.filter((_, j) => j !== i))}>
                    <Ionicons name="close-circle" size={20} color="#c62828" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.addAnexoBtn} onPress={escolherAnexo}>
                <Ionicons name="attach" size={18} color="#1a3a5c" />
                <Text style={s.addAnexoText}>Adicionar arquivo</Text>
              </TouchableOpacity>

              {/* Anexos já salvos (em edição) */}
              {editando && (anexosMap[editando.id] ?? []).length > 0 && (
                <>
                  <Text style={[s.label, { marginTop: 8 }]}>Arquivos já anexados</Text>
                  {(anexosMap[editando.id] ?? []).map(x => (
                    <View key={x.id} style={s.anexoPendItem}>
                      {x.tipo === 'image'
                        ? <Image source={{ uri: x.url }} style={s.anexoPendThumb} />
                        : <Ionicons name={tipoIcon(x.tipo).name as any} size={22} color={tipoIcon(x.tipo).color} />}
                      <Text style={s.anexoPendNome} numberOfLines={1}>{x.nome}</Text>
                    </View>
                  ))}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Modal responder ═══ */}
      <Modal visible={modalResp} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalResp(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalResp(false)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
              <Text style={s.modalTitulo} numberOfLines={1}>Responder: {respAtiv?.titulo}</Text>
              <TouchableOpacity onPress={enviarResposta} disabled={enviandoResp}>
                {enviandoResp ? <ActivityIndicator size="small" color="#1a3a5c" />
                              : <Text style={s.modalSalvar}>Enviar</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Sua resposta</Text>
              <TextInput style={[s.input, { minHeight: 120, textAlignVertical: 'top' }]}
                value={respTexto} onChangeText={setRespTexto}
                placeholder="Escreva sua resposta aqui..." multiline autoFocus />

              <Text style={s.label}>Anexo (opcional)</Text>
              {respAnexo ? (
                <View style={s.anexoPendItem}>
                  {respAnexo.tipo === 'image'
                    ? <Image source={{ uri: respAnexo.uri }} style={s.anexoPendThumb} />
                    : <Ionicons name={tipoIcon(respAnexo.tipo).name as any} size={22} color={tipoIcon(respAnexo.tipo).color} />}
                  <Text style={s.anexoPendNome} numberOfLines={1}>{respAnexo.nome}</Text>
                  <TouchableOpacity onPress={() => setRespAnexo(null)}>
                    <Ionicons name="close-circle" size={20} color="#c62828" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.addAnexoBtn} onPress={escolherAnexoResposta}>
                  <Ionicons name="attach" size={18} color="#1a3a5c" />
                  <Text style={s.addAnexoText}>Anexar arquivo ou imagem</Text>
                </TouchableOpacity>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Modal progresso ═══ */}
      <Modal visible={modalProg} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalProg(false)}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModalProg(false)}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
            <Text style={s.modalTitulo} numberOfLines={1}>{progAtiv?.titulo}</Text>
            <View style={{ width: 40 }} />
          </View>

          {loadingProg ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a3a5c" /> : (
            <ScrollView contentContainerStyle={s.modalScroll}>
              <View style={s.progStats}>
                <View style={[s.progStat, { backgroundColor: '#e8f5e9' }]}>
                  <Text style={[s.progStatNum, { color: '#2e7d32' }]}>
                    {membrosStatus.filter(m => m.resposta).length}
                  </Text>
                  <Text style={s.progStatLabel}>Responderam</Text>
                </View>
                <View style={[s.progStat, { backgroundColor: '#fff3e0' }]}>
                  <Text style={[s.progStatNum, { color: '#e65100' }]}>
                    {membrosStatus.filter(m => !m.resposta).length}
                  </Text>
                  <Text style={s.progStatLabel}>Pendentes</Text>
                </View>
              </View>

              {membrosStatus.map(m => (
                <View key={m.id} style={s.progItem}>
                  <View style={[s.progDot, { backgroundColor: m.resposta ? '#2e7d32' : '#e65100' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.progNome}>{m.nome}</Text>
                    {m.resposta ? (
                      <>
                        {m.resposta.texto && <Text style={s.progResp} numberOfLines={2}>{m.resposta.texto}</Text>}
                        {m.resposta.anexo_url && (
                          <TouchableOpacity onPress={() => Linking.openURL(m.resposta!.anexo_url!)}>
                            <Text style={s.progAnexo}>📎 {m.resposta.anexo_nome ?? 'Ver anexo'}</Text>
                          </TouchableOpacity>
                        )}
                        <Text style={s.progData}>{fmt(m.resposta.created_at)}</Text>
                      </>
                    ) : (
                      <Text style={s.progPendente}>Ainda não respondeu</Text>
                    )}
                  </View>
                  <Ionicons
                    name={m.resposta ? 'checkmark-circle' : 'time-outline'}
                    size={20}
                    color={m.resposta ? '#2e7d32' : '#e65100'}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f4f8' },
  header:         { backgroundColor: '#1a3a5c', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  headerTitle:    { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700' },

  tabs:           { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab:            { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabAtiva:       { borderBottomWidth: 2, borderBottomColor: '#1a3a5c' },
  tabText:        { fontSize: 14, fontWeight: '600', color: '#aaa' },
  tabTextAtiva:   { color: '#1a3a5c' },

  pendBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff3e0', paddingHorizontal: 16, paddingVertical: 10 },
  pendBannerText: { color: '#e65100', fontSize: 13, fontWeight: '600' },

  list:           { padding: 16, gap: 12 },
  emptyWrap:      { alignItems: 'center', marginTop: 60 },
  emptyText:      { color: '#aaa', fontSize: 15, marginTop: 12 },

  card:           { backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 2 },
  cardTop:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cardTitulo:     { fontSize: 16, fontWeight: '700', color: '#1a3a5c' },
  cardData:       { fontSize: 12, color: '#888', marginTop: 2 },
  cardDesc:       { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 8 },
  acaoBtn:        { padding: 6, backgroundColor: '#f0f4f8', borderRadius: 8 },

  badgeRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 },
  badge:          { backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText:      { fontSize: 12, fontWeight: '600', color: '#1a3a5c' },
  criadoPor:      { fontSize: 11, color: '#aaa' },

  anexosRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  anexoChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 6, maxWidth: 180 },
  anexoThumb:     { width: 36, height: 36, borderRadius: 6 },
  anexoNome:      { fontSize: 12, color: '#333', flex: 1 },

  respondidoBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e8f5e9', borderRadius: 10, padding: 10, marginTop: 4 },
  respondidoText: { fontSize: 13, color: '#2e7d32', fontWeight: '700' },
  respPreview:    { flex: 1, fontSize: 12, color: '#555' },
  editarRespText: { fontSize: 12, color: '#1a3a5c', fontWeight: '600', textDecorationLine: 'underline' },

  responderBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a3a5c', borderRadius: 10, padding: 10, marginTop: 8, justifyContent: 'center' },
  responderBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  statsRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 4 },
  statsText:      { fontSize: 12, color: '#888' },
  verProg:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  verProgText:    { fontSize: 12, color: '#1a3a5c', fontWeight: '600' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitulo:    { flex: 1, fontSize: 17, fontWeight: '800', color: '#1a3a5c', textAlign: 'center' },
  modalSalvar:    { fontSize: 16, fontWeight: '700', color: '#1a3a5c' },
  modalScroll:    { padding: 16 },

  label:          { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input:          { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#333', backgroundColor: '#fafafa' },

  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f4f8', borderWidth: 1.5, borderColor: '#dde4f0' },
  chipAtivo:      { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  chipText:       { fontSize: 13, fontWeight: '600', color: '#555' },
  chipTextAtivo:  { color: '#fff' },

  dbvItem:        { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginTop: 4 },
  dbvItemAtivo:   { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  dbvNome:        { fontSize: 14, fontWeight: '600', color: '#222' },
  dbvSub:         { fontSize: 12, color: '#888' },

  addAnexoBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#1a3a5c', borderStyle: 'dashed', borderRadius: 10, padding: 12, marginTop: 8 },
  addAnexoText:   { color: '#1a3a5c', fontWeight: '600', fontSize: 14 },
  anexoPendItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f5f5f5', borderRadius: 10, padding: 10, marginTop: 6 },
  anexoPendThumb: { width: 44, height: 44, borderRadius: 6 },
  anexoPendNome:  { flex: 1, fontSize: 13, color: '#333' },

  // Progresso
  progStats:      { flexDirection: 'row', gap: 12, marginBottom: 16 },
  progStat:       { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  progStatNum:    { fontSize: 32, fontWeight: '800' },
  progStatLabel:  { fontSize: 12, color: '#666', marginTop: 2 },
  progItem:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 8 },
  progDot:        { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  progNome:       { fontSize: 14, fontWeight: '700', color: '#222' },
  progResp:       { fontSize: 13, color: '#555', marginTop: 2 },
  progAnexo:      { fontSize: 12, color: '#1a3a5c', marginTop: 2, textDecorationLine: 'underline' },
  progData:       { fontSize: 11, color: '#aaa', marginTop: 2 },
  progPendente:   { fontSize: 12, color: '#e65100', marginTop: 2 },
});

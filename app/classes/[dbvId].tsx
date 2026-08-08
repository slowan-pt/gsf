import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { RequisitoLinha, type ContextoRequisito } from '../../src/components/classes/RequisitoLinha';
import {
  agruparClasse,
  cancelarAtividadeDeRequisito,
  carregarArquivos,
  carregarAtividadesDeRequisitos,
  carregarCatalogoClasses,
  carregarProgressoClube,
  carregarRespostas,
  classesDoCatalogo,
  definirRequisito,
  enviarArquivoRequisito,
  enviarRequisitosComoAtividade,
  enviarRespostaParaAvaliacao,
  estadoGrupos,
  nivelPara,
  removerArquivoRequisito,
  resumirPorClasse,
  salvarResposta,
  type ArquivoRequisito,
  type AtividadeDeRequisito,
  type ProgressoRequisito,
  type RequisitoCatalogo,
} from '../../src/lib/classesRequisitos';

const PERFIS_QUE_MARCAM = ['admin_ti', 'admin_clube', 'admin_geral', 'admin_total', 'usuario_secretaria'];

function paraISO(ddmmaaaa: string) {
  const [d, m, a] = ddmmaaaa.split('/');
  if (!d || !m || !a || a.length !== 4) return null;
  const iso = `${a}-${m}-${d}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

function mascaraData(t: string) {
  const d = t.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

export default function ClasseMembroScreen() {
  const { dbvId } = useLocalSearchParams<{ dbvId: string }>();
  const membroId = Number(dbvId);
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const clubeId = getClubeAtivoId();

  const podeMarcar = permissoes.temPerfil(PERFIS_QUE_MARCAM);
  const podeEnviar = permissoes.pode('gerenciar_atividades');
  const ehProprioMembro = (usuario?.dbv_id ?? contextoAtivo?.membro_id) === membroId;
  const podePreencher = podeMarcar || ehProprioMembro || permissoes.pode('ver_filhos');

  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [membro, setMembro] = useState<{ nome: string; unidade: string; foto: string | null } | null>(null);
  const [catalogo, setCatalogo] = useState<RequisitoCatalogo[]>([]);
  const [progresso, setProgresso] = useState<ProgressoRequisito[]>([]);
  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [arquivos, setArquivos] = useState<Record<number, ArquivoRequisito[]>>({});
  const [atividades, setAtividades] = useState<AtividadeDeRequisito[]>([]);
  const [classeAtiva, setClasseAtiva] = useState('');
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({});

  // Envio em lote
  const [modoLote, setModoLote] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [modalEnvio, setModalEnvio] = useState<RequisitoCatalogo[] | null>(null);
  const [prazoTexto, setPrazoTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  useFocusEffect(useCallback(() => { carregar(); }, [clubeId, membroId]));

  async function carregar() {
    if (!Number.isFinite(membroId)) { setErro('Membro inválido.'); setLoading(false); return; }
    setLoading(true);
    setErro(null);
    try {
      const [cat, membroRes, prog, resp, arqs, ativs] = await Promise.all([
        carregarCatalogoClasses(),
        supabase.from('desbravadores').select('nome,unidade_nome,foto_url').eq('id', membroId).maybeSingle(),
        carregarProgressoClube(clubeId, [membroId]),
        carregarRespostas(clubeId, membroId),
        carregarArquivos(clubeId, membroId),
        carregarAtividadesDeRequisitos(clubeId, [membroId]),
      ]);
      if (membroRes.error) throw membroRes.error;
      setCatalogo(cat);
      setProgresso(prog);
      setAtividades(ativs);
      setRespostas(Object.fromEntries(resp.map((r) => [r.requisito_id, r.texto ?? ''])));
      const porReq: Record<number, ArquivoRequisito[]> = {};
      arqs.forEach((a) => { (porReq[a.requisito_id] ??= []).push(a); });
      setArquivos(porReq);
      setMembro(
        membroRes.data
          ? { nome: membroRes.data.nome, unidade: membroRes.data.unidade_nome || 'Sem unidade', foto: membroRes.data.foto_url ?? null }
          : null
      );
      const classes = classesDoCatalogo(cat);
      setClasseAtiva((atual) => (atual && classes.includes(atual) ? atual : classes[0] ?? ''));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar os requisitos.');
    } finally {
      setLoading(false);
    }
  }

  const concluidos = useMemo(() => new Set(progresso.map((p) => p.requisito_id)), [progresso]);
  const origens = useMemo(() => {
    const m = new Map<number, string>();
    progresso.forEach((p) => m.set(p.requisito_id, p.origem));
    return m;
  }, [progresso]);
  const atividadesPorRequisito = useMemo(() => {
    const m = new Map<number, AtividadeDeRequisito>();
    atividades.forEach((a) => m.set(a.classe_requisito_id, a));
    return m;
  }, [atividades]);

  const classes = useMemo(() => classesDoCatalogo(catalogo), [catalogo]);
  const resumos = useMemo(() => resumirPorClasse(catalogo, concluidos), [catalogo, concluidos]);
  const resumoAtual = resumos.find((r) => r.classe === classeAtiva);
  const secoes = useMemo(() => (classeAtiva ? agruparClasse(catalogo, classeAtiva) : []), [catalogo, classeAtiva]);
  const grupos = useMemo(() => estadoGrupos(catalogo, concluidos), [catalogo, concluidos]);

  function bloqueadoPorGrupo(req: RequisitoCatalogo) {
    if (!req.grupo_escolha) return false;
    const g = grupos.get(req.grupo_escolha);
    return !!g && g.completo && !concluidos.has(req.id);
  }

  async function recarregarProgresso() {
    const [prog, ativs] = await Promise.all([
      carregarProgressoClube(clubeId, [membroId]),
      carregarAtividadesDeRequisitos(clubeId, [membroId]),
    ]);
    setProgresso(prog);
    setAtividades(ativs);
  }

  async function alternar(req: RequisitoCatalogo) {
    if (!podeMarcar || salvandoId) return;
    setSalvandoId(req.id);
    try {
      await definirRequisito({
        clubeId, dbvId: membroId, requisito: req,
        concluido: !concluidos.has(req.id), usuarioId: usuario?.id ?? null,
      });
      await recarregarProgresso();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível atualizar o requisito.');
    } finally {
      setSalvandoId(null);
    }
  }

  async function confirmarEnvio() {
    if (!modalEnvio || !membro) return;
    const prazo = prazoTexto.trim() ? paraISO(prazoTexto) : null;
    if (prazoTexto.trim() && !prazo) {
      Alert.alert('Data inválida', 'Use o formato dd/mm/aaaa ou deixe em branco.');
      return;
    }
    setEnviando(true);
    try {
      const { criadas, ignoradas } = await enviarRequisitosComoAtividade({
        clubeId,
        requisitos: modalEnvio,
        membros: [{ id: membroId, nome: membro.nome }],
        prazo,
        criadoPor: usuario?.nome ?? null,
      });
      await recarregarProgresso();
      setModalEnvio(null);
      setPrazoTexto('');
      setModoLote(false);
      setSelecionados(new Set());
      const msg = `${criadas} atividade(s) enviada(s)${ignoradas ? ` · ${ignoradas} já estavam enviadas` : ''}.`;
      if (typeof window !== 'undefined') window.alert(msg);
      else Alert.alert('Pronto', msg);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  }

  async function cancelarEnvio(atividade: AtividadeDeRequisito) {
    const ok = typeof window !== 'undefined'
      ? window.confirm(`Cancelar o envio de "${atividade.titulo}"?\n\nA atividade some do painel do membro.`)
      : true;
    if (!ok) return;
    try {
      await cancelarAtividadeDeRequisito(atividade.id);
      await recarregarProgresso();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível cancelar.');
    }
  }

  const ctx: ContextoRequisito = {
    concluidos, origens, respostas, arquivos,
    atividades: atividadesPorRequisito,
    podeMarcar, podePreencher, podeEnviar, salvandoId, modoLote, selecionados,
    onAlternar: alternar,
    onSelecionar: (req) => setSelecionados((p) => {
      const n = new Set(p);
      n.has(req.id) ? n.delete(req.id) : n.add(req.id);
      return n;
    }),
    onEnviar: (req) => { setPrazoTexto(''); setModalEnvio([req]); },
    onCancelar: cancelarEnvio,
    onEnviarParaAvaliacao: async (req, ativ) => {
      try {
        await enviarRespostaParaAvaliacao({
          clubeId, atividadeId: ativ.id, dbvId: membroId,
          dbvNome: membro?.nome ?? '', texto: respostas[req.id] ?? '', arquivos: arquivos[req.id] ?? [],
        });
        const msg = 'Resposta enviada para avaliação. Quando o avaliador aprovar, o requisito é concluído automaticamente.';
        if (typeof window !== 'undefined') window.alert(msg);
        else Alert.alert('Enviado', msg);
      } catch (e: any) {
        Alert.alert('Erro', e?.message ?? 'Não foi possível enviar para avaliação.');
      }
    },
    onSalvarTexto: async (req, texto) => {
      await salvarResposta({ clubeId, dbvId: membroId, requisitoId: req.id, texto, usuarioId: usuario?.id ?? null });
      setRespostas((p) => ({ ...p, [req.id]: texto }));
    },
    onEnviarArquivo: async (req, a) => {
      await enviarArquivoRequisito({
        clubeId, dbvId: membroId, requisito: req,
        uri: a.uri, nome: a.nome, mime: a.mime, usuarioId: usuario?.id ?? null,
      });
      setArquivos(() => ({}));
      const atualizados = await carregarArquivos(clubeId, membroId);
      const porReq: Record<number, ArquivoRequisito[]> = {};
      atualizados.forEach((x) => { (porReq[x.requisito_id] ??= []).push(x); });
      setArquivos(porReq);
      await recarregarProgresso();
    },
    onRemoverArquivo: async (id) => {
      await removerArquivoRequisito(id);
      const atualizados = await carregarArquivos(clubeId, membroId);
      const porReq: Record<number, ArquivoRequisito[]> = {};
      atualizados.forEach((x) => { (porReq[x.requisito_id] ??= []).push(x); });
      setArquivos(porReq);
    },
  };

  const nivel = nivelPara(resumoAtual?.pct ?? 0);
  const requisitosSelecionados = catalogo.filter((r) => selecionados.has(r.id));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.fotoMoldura}>
          {membro?.foto ? (
            <Image source={{ uri: membro.foto }} style={styles.foto} resizeMode="cover" />
          ) : (
            <View style={[styles.foto, styles.fotoVazia]}>
              <Ionicons name="person" size={20} color="#8fa3b8" />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo} numberOfLines={1}>{membro?.nome ?? 'Membro'}</Text>
          <Text style={styles.headerSub}>{membro?.unidade ?? ''}</Text>
        </View>
        {podeEnviar && (
          <TouchableOpacity
            style={[styles.btnLote, modoLote && styles.btnLoteAtivo]}
            onPress={() => { setModoLote((v) => !v); setSelecionados(new Set()); }}
          >
            <Ionicons name={modoLote ? 'close' : 'checkbox-outline'} size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {modoLote && (
        <View style={styles.barraLote}>
          <Text style={styles.barraLoteTexto}>{selecionados.size} requisito(s) selecionado(s)</Text>
          <TouchableOpacity
            style={[styles.barraLoteBtn, selecionados.size === 0 && { opacity: 0.5 }]}
            disabled={selecionados.size === 0}
            onPress={() => { setPrazoTexto(''); setModalEnvio(requisitosSelecionados); }}
          >
            <Ionicons name="paper-plane" size={15} color="#fff" />
            <Text style={styles.barraLoteBtnText}>Enviar em lote</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={styles.erro}>{erro}</Text>}
        {!loading && classes.length === 0 && <Text style={styles.vazio}>Nenhuma classe no catálogo.</Text>}

        {!loading && classes.length > 0 && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {resumos.map((r) => (
                <TouchableOpacity
                  key={r.classe}
                  style={[styles.chip, classeAtiva === r.classe && styles.chipAtivo]}
                  onPress={() => setClasseAtiva(r.classe)}
                >
                  <Text style={[styles.chipText, classeAtiva === r.classe && styles.chipTextAtivo]}>
                    {r.nivel.emoji} {r.classe} · {r.pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {!!resumoAtual && (
              <View style={[styles.cardProgresso, { borderColor: nivel.cor }]}>
                <Text style={styles.nivelEmoji}>{nivel.emoji}</Text>
                <Text style={[styles.nivelTitulo, { color: nivel.cor }]}>{nivel.titulo}</Text>
                <View style={styles.barraFundo}>
                  <View style={[styles.barraPreenchida, { width: `${resumoAtual.pct}%`, backgroundColor: nivel.cor }]} />
                </View>
                <Text style={styles.progressoTexto}>
                  <Text style={{ fontWeight: '800', color: nivel.cor }}>{resumoAtual.concluidos}</Text>
                  {` de ${resumoAtual.total} requisitos · faltam ${Math.max(0, resumoAtual.total - resumoAtual.concluidos)}`}
                </Text>
                {!podeMarcar && (
                  <Text style={styles.somenteLeitura}>
                    Só admin do clube e secretaria marcam requisitos como concluídos.
                  </Text>
                )}
              </View>
            )}

            {secoes.map((s) => {
              const aberta = secoesAbertas[s.secao] ?? true;
              const total = s.raizes.filter((r) => r.raiz.pontua).length;
              const feitos = s.raizes.filter((r) => r.raiz.pontua && concluidos.has(r.raiz.id)).length;
              return (
                <View key={s.secao} style={styles.secaoBox}>
                  <TouchableOpacity
                    style={styles.secaoHeader}
                    onPress={() => setSecoesAbertas((p) => ({ ...p, [s.secao]: !aberta }))}
                  >
                    <Ionicons name={aberta ? 'chevron-down' : 'chevron-forward'} size={18} color="#1a3a5c" />
                    <Text style={styles.secaoTitulo}>{s.secao}</Text>
                    {s.avancada && <Text style={styles.badgeAvancada}>avançada</Text>}
                    <Text style={styles.secaoContagem}>{feitos}/{total}</Text>
                  </TouchableOpacity>
                  {aberta && s.raizes.map(({ raiz, filhos }) => (
                    <RequisitoLinha
                      key={raiz.id}
                      requisito={raiz}
                      filhos={filhos}
                      bloqueado={bloqueadoPorGrupo(raiz)}
                      ctx={ctx}
                    />
                  ))}
                </View>
              );
            })}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={!!modalEnvio} transparent animationType="fade" onRequestClose={() => setModalEnvio(null)}>
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Enviar como atividade</Text>
            <Text style={styles.modalSub}>
              {modalEnvio?.length === 1
                ? modalEnvio[0].texto
                : `${modalEnvio?.length ?? 0} requisitos serão enviados para ${membro?.nome}.`}
            </Text>
            <Text style={styles.modalLabel}>Prazo de entrega (opcional)</Text>
            <TextInput
              style={styles.modalInput}
              value={prazoTexto}
              onChangeText={(t) => setPrazoTexto(mascaraData(t))}
              placeholder="dd/mm/aaaa"
              placeholderTextColor="#a8b3bf"
              keyboardType="numeric"
              maxLength={10}
            />
            <Text style={styles.modalDica}>Deixe em branco para enviar sem prazo.</Text>
            <View style={styles.modalAcoes}>
              <TouchableOpacity style={styles.modalBtnSec} onPress={() => setModalEnvio(null)}>
                <Text style={styles.modalBtnSecText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, enviando && { opacity: 0.6 }]}
                onPress={confirmarEnvio}
                disabled={enviando}
              >
                <Text style={styles.modalBtnText}>{enviando ? 'Enviando...' : 'Enviar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  header: {
    backgroundColor: '#1a3a5c', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voltar: { padding: 2 },
  fotoMoldura: { width: 39, height: 52, borderRadius: 7, borderWidth: 2, borderColor: '#7fa8cc', overflow: 'hidden' },
  foto: { width: '100%', height: '100%' },
  fotoVazia: { backgroundColor: '#2b5079', alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  btnLote: { backgroundColor: '#2b5079', borderRadius: 8, padding: 8 },
  btnLoteAtivo: { backgroundColor: '#c62828' },
  barraLote: {
    backgroundColor: '#1e40af', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10,
  },
  barraLoteTexto: { color: '#dbeafe', fontSize: 12, fontWeight: '600' },
  barraLoteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  barraLoteBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  scroll: { padding: 16 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  chipsRow: { marginBottom: 12 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e4eaf1', marginRight: 8 },
  chipAtivo: { backgroundColor: '#1a3a5c' },
  chipText: { fontSize: 12, color: '#4a5866', fontWeight: '700' },
  chipTextAtivo: { color: '#fff' },
  cardProgresso: {
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 2, padding: 18,
    alignItems: 'center', marginBottom: 16, elevation: 2,
  },
  nivelEmoji: { fontSize: 34 },
  nivelTitulo: { fontSize: 16, fontWeight: '800', marginTop: 4, marginBottom: 10 },
  barraFundo: { width: '100%', height: 14, borderRadius: 999, backgroundColor: '#e4eaf1', overflow: 'hidden' },
  barraPreenchida: { height: '100%', borderRadius: 999 },
  progressoTexto: { fontSize: 13, color: '#52606d', marginTop: 8 },
  somenteLeitura: { fontSize: 11, color: '#9aa5b1', marginTop: 6, textAlign: 'center' },
  secaoBox: { marginBottom: 12 },
  secaoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  secaoTitulo: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1a3a5c' },
  badgeAvancada: {
    fontSize: 9, fontWeight: '700', color: '#7c3aed', backgroundColor: '#ede9fe',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  secaoContagem: { fontSize: 12, color: '#7b8794', fontWeight: '700' },
  modalFundo: { flex: 1, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, gap: 8 },
  modalTitulo: { fontSize: 17, fontWeight: '800', color: '#1a3a5c' },
  modalSub: { fontSize: 12, color: '#52606d', lineHeight: 17 },
  modalLabel: { fontSize: 11, fontWeight: '700', color: '#52606d', marginTop: 6, textTransform: 'uppercase' },
  modalInput: {
    borderWidth: 1, borderColor: '#dde4ec', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1f2933',
  },
  modalDica: { fontSize: 11, color: '#9aa5b1' },
  modalAcoes: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtnSec: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#eef2f6', alignItems: 'center' },
  modalBtnSecText: { color: '#52606d', fontWeight: '700', fontSize: 13 },
  modalBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

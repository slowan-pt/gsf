import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { BottomNav } from '../../src/components/BottomNav';

/* ─── URL do HTML estático ───────────────────────────────────────── */
const HTML_PATH = '/joias-da-eternidade.html';

/* ─── Todos os campo IDs possíveis (para upsert) ────────────────── */
const TODOS_CAMPOS = [
  'ep1_q1','ep1_q2','ep1_q3','ep1_q4','ep1_p1','ep1_p2',
  'ep2_q1','ep2_q2','ep2_q3','ep2_q4','ep2_p1',
  'ep3_q1','ep3_q2','ep3_q3','ep3_q4','ep3_p1',
  'ep4_q1','ep4_q2','ep4_q3','ep4_q4','ep4_p1',
  'ep5_q1','ep5_q2','ep5_q3','ep5_q4','ep5_p1',
  'ep6_q1','ep6_q2','ep6_q3','ep6_q4','ep6_p1','ep6_p2',
  'ep7_q1','ep7_q2','ep7_q3','ep7_q4','ep7_p1',
  'ep8_q1','ep8_q2','ep8_q3','ep8_q4','ep8_p1',
  'ep9_q1','ep9_q2','ep9_q3','ep9_q4','ep9_p1',
  'ep10_q1','ep10_q2','ep10_q3','ep10_q4','ep10_p1',
  'ep11_q1','ep11_q2','ep11_q3','ep11_q4','ep11_p1',
  'ep12_q1','ep12_q2','ep12_q3','ep12_q4','ep12_p1',
  'ep13_q1','ep13_portas','ep13_tribos','ep13_formato','ep13_material','ep13_luz','ep13_q2','ep13_p1',
  'ep14_q1','ep14_q2','ep14_q3','ep14_q4','ep14_p1',
];

/* ─── Componente ─────────────────────────────────────────────────── */
export default function ClasseBiblicaScreen() {
  const usuario   = useAuthStore((s) => s.usuario);
  const [loading, setLoading]   = useState(true);
  const [salvando, setSalvando] = useState(false);
  const iframeRef = useRef<any>(null);

  /* Carrega as respostas do Supabase e injeta no iframe */
  useFocusEffect(useCallback(() => {
    carregar();
  }, []));

  async function carregar() {
    if (!usuario?.id) { setLoading(false); return; }
    try {
      const clubeId = getClubeAtivoId();
      const { data } = await supabase
        .from('classe_biblica_respostas')
        .select('campo_id, resposta')
        .eq('usuario_id', usuario.id)
        .eq('clube_id', clubeId);

      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.campo_id] = r.resposta; });
      setLoading(false);
      // Envia ao iframe assim que ele estiver pronto
      pendingDataRef.current = map;
      enviarAoIframe(map);
    } catch {
      setLoading(false);
    }
  }

  const pendingDataRef = useRef<Record<string, string> | null>(null);

  function enviarAoIframe(dados: Record<string, string>) {
    if (Platform.OS !== 'web') return;
    const iframe = iframeRef.current as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'jde_load', dados }, '*');
  }

  async function salvarNoSupabase(dados: Record<string, string>) {
    if (!usuario?.id) return;
    setSalvando(true);
    try {
      const clubeId = getClubeAtivoId();
      const rows = Object.entries(dados)
        .filter(([campo_id, resposta]) => TODOS_CAMPOS.includes(campo_id) && resposta.trim().length > 0)
        .map(([campo_id, resposta]) => ({
          usuario_id: usuario.id,
          clube_id:   clubeId,
          campo_id,
          resposta,
          updated_at: new Date().toISOString(),
        }));
      if (rows.length > 0) {
        await supabase
          .from('classe_biblica_respostas')
          .upsert(rows, { onConflict: 'usuario_id,clube_id,campo_id' });
      }
      // Limpa registros que foram apagados
      const camposVazios = TODOS_CAMPOS.filter((id) => !dados[id] || dados[id].trim().length === 0);
      if (camposVazios.length > 0) {
        await supabase
          .from('classe_biblica_respostas')
          .delete()
          .eq('usuario_id', usuario.id)
          .eq('clube_id', getClubeAtivoId())
          .in('campo_id', camposVazios);
      }
    } catch { /* offline */ }
    setSalvando(false);
  }

  /* Bridge: escuta mensagens do iframe ─────────────────────────── */
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    function handleMessage(e: MessageEvent) {
      if (!e.data) return;
      if (e.data.type === 'jde_ready') {
        // Iframe carregou — envia dados pendentes
        if (pendingDataRef.current) {
          enviarAoIframe(pendingDataRef.current);
        }
      } else if (e.data.type === 'jde_save') {
        salvarNoSupabase(e.data.dados ?? {});
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [usuario?.id]);

  /* URL do iframe com userId+clubeId para chave localStorage única */
  const uid = usuario?.id ?? '';
  const cid = String(getClubeAtivoId() ?? '');
  const iframeUrl = `${HTML_PATH}?uid=${encodeURIComponent(uid)}&cid=${encodeURIComponent(cid)}`;

  /* ─── Render ──────────────────────────────────────────────────── */
  return (
    <View style={s.container}>
      {/* Header do app */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>⛏️ JÓIAS DA ETERNIDADE</Text>
          <Text style={s.headerSub}>Estudo Bíblico · Classe Bíblica</Text>
        </View>
        {salvando && (
          <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" style={{ marginRight: 4 }} />
        )}
      </View>

      {/* Iframe / loading */}
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#2a6f3c" />
          <Text style={s.loadingText}>Carregando estudo...</Text>
        </View>
      ) : (
        Platform.OS === 'web' ? (
          <WebIframe
            ref={iframeRef}
            src={iframeUrl}
            onLoad={() => {
              // Depois que o iframe carrega, tenta enviar dados
              if (pendingDataRef.current) {
                setTimeout(() => enviarAoIframe(pendingDataRef.current!), 300);
              }
            }}
          />
        ) : (
          <View style={s.loadingBox}>
            <Ionicons name="book-outline" size={48} color="#2a6f3c" />
            <Text style={s.loadingText}>Disponível apenas na versão web.</Text>
          </View>
        )
      )}

      <BottomNav />
    </View>
  );
}

/* ─── Wrapper do iframe (só renderizado no web) ──────────────────── */
import { forwardRef } from 'react';

const WebIframe = forwardRef<any, { src: string; onLoad?: () => void }>(
  function WebIframe({ src, onLoad }, ref) {
    if (Platform.OS !== 'web') return null;
    // Usamos dangerouslySetInnerHTML / elemento nativo via ref
    return (
      <View style={s.iframeWrapper}>
        {/* @ts-ignore — iframe não existe no RN nativo, mas funciona no web */}
        <iframe
          ref={ref}
          src={src}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            flex: 1,
          }}
          onLoad={onLoad}
          title="Jóias da Eternidade"
          allow="fullscreen"
        />
      </View>
    );
  }
);

/* ─── Estilos ─────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5ede0' },

  header: {
    backgroundColor: '#2a6f3c',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn:      { padding: 6 },
  headerTitle:  { color: '#f5c518', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  headerSub:    { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', marginTop: 2 },

  iframeWrapper: { flex: 1 },

  loadingBox:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText:  { color: '#555', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { BottomNav } from '../../src/components/BottomNav';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { ClasseHtmlView } from '../../src/components/ClasseHtmlView';
import { useCores } from '../../src/stores/temaStore';
import {
  carregarClasse, carregarRespostas, salvarRespostas, SLUG_INTEGRADA, type ClasseBiblica,
} from '../../src/lib/classeBiblica';
import { tomTexto } from '../../src/lib/tema';

const HTML_INTEGRADA = '/joias-da-eternidade.html';

/** Campos que a classe integrada aceita (ela só grava os que estão nesta lista). */
const CAMPOS_INTEGRADA: ReadonlySet<string> = new Set([
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
]);

export default function ClasseBiblicaLeitor() {
  const cores = useCores();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const [classe, setClasse] = useState<ClasseBiblica | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const filaSalvar = useRef<Promise<unknown>>(Promise.resolve());

  const clubeId = getClubeAtivoId();

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      const c = await carregarClasse(String(slug));
      if (!ativo) return;
      if (!c) { setNaoEncontrada(true); setCarregando(false); return; }
      setClasse(c);
      setCarregando(false);
      if (usuario?.id) {
        const salvas = await carregarRespostas(usuario.id, clubeId, c.slug);
        if (ativo) setRespostas(salvas);
      }
    })();
    return () => { ativo = false; };
  }, [slug, usuario?.id, clubeId]);

  const aoSalvar = useCallback((dados: Record<string, string>) => {
    if (!usuario?.id || !classe) return;
    const permitidos = classe.slug === SLUG_INTEGRADA ? CAMPOS_INTEGRADA : undefined;
    setSalvando(true);
    // Uma gravação por vez, na ordem em que chegaram.
    filaSalvar.current = filaSalvar.current
      .then(() => salvarRespostas(usuario.id, clubeId, classe.slug, dados, permitidos))
      .catch(() => false)
      .then(() => setSalvando(false));
  }, [usuario?.id, clubeId, classe]);

  const srcEstatico = `${HTML_INTEGRADA}?uid=${encodeURIComponent(usuario?.id ?? '')}&cid=${encodeURIComponent(String(clubeId ?? ''))}`;

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela
        titulo={classe?.titulo ?? 'Classe Bíblica'}
      />

      {carregando ? (
        <View style={s.centro}>
          <ActivityIndicator size="large" color={tomTexto('#2a6f3c', cores)} />
          <Text style={[s.texto, { color: cores.textoSecundario }]}>Carregando estudo...</Text>
        </View>
      ) : naoEncontrada || !classe ? (
        <View style={s.centro}>
          <Ionicons name="alert-circle-outline" size={44} color={cores.textoSecundario} />
          <Text style={[s.texto, { color: cores.textoSecundario }]}>Esta classe não está disponível.</Text>
        </View>
      ) : (
        <ClasseHtmlView
          key={classe.slug}
          html={classe.integrada ? null : classe.html}
          srcEstatico={srcEstatico}
          titulo={classe.titulo}
          respostas={respostas}
          onSalvar={aoSalvar}
        />
      )}

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 24 },
  texto: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

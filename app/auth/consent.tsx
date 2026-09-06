import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { buscarTermoAtivo, registrarAceiteLgpd, type TermoLgpd } from '../../src/lib/lgpd';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import { avisar } from '../../src/stores/avisoStore';

export default function ConsentScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario = useAuthStore((s) => s.usuarioConsentimentoPendente);
  const pendente = useAuthStore((s) => s.consentimentoPendente);
  const concluirConsentimento = useAuthStore((s) => s.concluirConsentimento);
  const cancelarConsentimento = useAuthStore((s) => s.cancelarConsentimento);
  const carregarContextos = useContextoStore((s) => s.carregarContextos);

  const [termo, setTermo] = useState<TermoLgpd | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [liTudo, setLiTudo] = useState(false);

  useEffect(() => {
    carregarTermo();
  }, []);

  if (!pendente || !usuario) return <Redirect href="/auth/login" />;
  const usuarioAtual = usuario;

  async function carregarTermo() {
    setCarregando(true);
    try {
      const atual = await buscarTermoAtivo();
      if (!atual) {
        avisar('Nenhum termo LGPD ativo foi encontrado. Avise a administração.', 'info', 'Termo indisponível');
      }
      setTermo(atual);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar o termo.', 'erro', 'Erro');
    } finally {
      setCarregando(false);
    }
  }

  async function aceitar() {
    if (!termo) return;
    if (!liTudo) {
      avisar('Marque que leu e concorda com o termo antes de continuar.', 'info', 'Confirmação necessária');
      return;
    }
    setSalvando(true);
    try {
      await registrarAceiteLgpd(usuarioAtual, termo);
      await concluirConsentimento();
      const usuarioLogado = useAuthStore.getState().usuario;
      if (usuarioLogado) {
        await carregarContextos(usuarioLogado);
      }
      router.replace(useContextoStore.getState().selecaoPendente ? '/auth/contexto' : '/(tabs)');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível registrar o aceite.', 'erro', 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    await cancelarConsentimento();
    router.replace('/auth/login');
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.card}>
        <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
          <View style={s.iconCircle}>
            <Ionicons name="document-text" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Termo LGPD</Text>
            <Text style={s.sub}>Consentimento e responsabilidade com os dados</Text>
          </View>
        </View>

        {carregando ? (
          <ActivityIndicator color="#1a3a5c" style={{ marginVertical: 40 }} />
        ) : (
          <>
            <Text style={s.termTitle}>{termo?.titulo ?? 'Termo indisponível'}</Text>
            {termo?.versao ? <Text style={s.version}>Versão {termo.versao}</Text> : null}
            <ScrollView style={s.termBox} contentContainerStyle={{ padding: 14 }}>
              <Text style={s.termText}>{termo?.conteudo ?? 'Nenhum termo ativo foi encontrado.'}</Text>
            </ScrollView>

            <TouchableOpacity style={s.checkRow} onPress={() => setLiTudo((v) => !v)}>
              <View style={[s.check, liTudo && s.checkOn]}>
                {liTudo && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
              <Text style={s.checkText}>
                Li, compreendi e aceito o termo de consentimento e responsabilidade.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btn, (!termo || salvando) && s.btnDisabled]}
              disabled={!termo || salvando}
              onPress={aceitar}
            >
              {salvando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                  <Text style={s.btnText}>Aceitar e entrar</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={s.cancelBtn} onPress={sair}>
          <Text style={s.cancelText}>Cancelar login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3a5c', justifyContent: 'center', padding: 18 },
  card: { maxHeight: '92%', backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, elevation: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#1a3a5c', fontSize: 23, fontWeight: '900' },
  sub: { color: '#607d8b', marginTop: 2 },
  termTitle: { color: '#263238', fontSize: 17, fontWeight: '900' },
  version: { color: '#78909c', marginTop: 3, marginBottom: 10 },
  termBox: { maxHeight: 350, borderRadius: 14, backgroundColor: '#f4f8fb', borderWidth: 1, borderColor: '#dce5ec', marginTop: 10 },
  termText: { color: '#263238', fontSize: 14, lineHeight: 21 },
  checkRow: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkOn: { backgroundColor: '#1a3a5c' },
  checkText: { flex: 1, color: '#37474f', fontWeight: '700', lineHeight: 20 },
  btn: { marginTop: 16, backgroundColor: '#1a3a5c', borderRadius: 12, padding: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnDisabled: { opacity: 0.55 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  cancelBtn: { marginTop: 12, padding: 8, alignItems: 'center' },
  cancelText: { color: '#78909c', fontWeight: '800' },
});

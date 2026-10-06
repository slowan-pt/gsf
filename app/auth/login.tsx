import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Linking, ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { supabase } from '../../src/lib/supabase';
import { avisar, confirmar } from '../../src/stores/avisoStore';
import {
  autenticarBiometria, biometriaAtivada, biometriaDisponivel, lerCredenciaisBiometria,
  nomeBiometria, removerCredenciaisBiometria, salvarCredenciaisBiometria,
} from '../../src/lib/dispositivoSeguro';
import { guardarOfertaBiometria } from '../../src/lib/ofertaBiometria';
import { useCores } from '../../src/stores/temaStore';
import { corIcone } from '../../src/lib/tema';

const LOGIN_HISTORY_KEY = 'login_history_emails_v1';
const BIOMETRIA_RECUSADA_KEY = 'biometria_login_recusada_v1';

export default function LoginScreen() {
  const cores = useCores();
  const emailRef = useRef<TextInput>(null);
  const senhaRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [salvarLogin, setSalvarLogin] = useState(true);
  const [historico, setHistorico] = useState<string[]>([]);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [bioDisponivel, setBioDisponivel] = useState(false);
  const [bioAtiva, setBioAtiva] = useState(false);
  const [nomeBio, setNomeBio] = useState('biometria');
  // Pede a biometria sozinha ao abrir (uma vez por abertura da tela); cancelou = segue no formulário.
  const autoTentada = useRef(false);
  const entrarBioRef = useRef<(nome?: string) => Promise<void>>(async () => {});
  const { login, carregando, erro } = useAuthStore();
  const carregarContextos = useContextoStore((s) => s.carregarContextos);

  useEffect(() => {
    AsyncStorage.getItem(LOGIN_HISTORY_KEY).then((raw) => {
      if (!raw) return;
      try {
        const lista = JSON.parse(raw);
        setHistorico(lista);
        if (lista[0]) setEmail((atual) => atual || lista[0]);
      } catch {}
    });
  }, []);

  // A senha nunca fica guardada: toda vez que a tela de login aparece, o campo volta vazio.
  useFocusEffect(useCallback(() => {
    setSenha('');
    let ativo = true;
    (async () => {
      const [disp, ativa, nome] = await Promise.all([biometriaDisponivel(), biometriaAtivada(), nomeBiometria()]);
      if (!ativo) return;
      setBioDisponivel(disp);
      setBioAtiva(disp && ativa);
      setNomeBio(nome);
      if (disp && ativa && !autoTentada.current) {
        autoTentada.current = true;
        setTimeout(() => { if (ativo) void entrarBioRef.current(nome); }, 350);
      }
    })();
    return () => { ativo = false; setSenha(''); };
  }, []));

  const handleLogin = async (emailParam?: string, senhaParam?: string, viaBiometria = false) => {
    const senhaUsada = senhaParam ?? senha;
    if (!(emailParam ?? email).trim()) {
      emailRef.current?.focus();
      avisar('Preencha o email.', 'info', 'Atenção');
      return;
    }
    if (!senhaUsada) {
      senhaRef.current?.focus();
      avisar('Preencha a senha.', 'info', 'Atenção');
      return;
    }
    const emailFinal = (emailParam ?? email).trim().toLowerCase();
    await login(emailFinal, senhaUsada);
    const resultado = useAuthStore.getState();
    const entrou = !resultado.erro && !!(resultado.usuario || resultado.mfaPendente || resultado.consentimentoPendente);
    if (!entrou && viaBiometria) {
      // Senha mudou ou conta inválida: o atalho salvo não serve mais.
      await removerCredenciaisBiometria();
      setBioAtiva(false);
      avisar('A senha salva não funciona mais. Entre com a senha e ative a biometria de novo.', 'info', 'Biometria');
    }
    if (entrou && !viaBiometria) await oferecerBiometria(emailFinal, senhaUsada);
    setSenha('');
    await seguirAposLogin(emailFinal);
  };

  async function oferecerBiometria(emailFinal: string, senhaUsada: string) {
    if (!bioDisponivel || bioAtiva) return;
    try {
      if ((await AsyncStorage.getItem(BIOMETRIA_RECUSADA_KEY)) === '1') return;
      // Não pergunta agora: o aviso aparece quando a tela Início carregar (depois do MFA, se houver).
      guardarOfertaBiometria(emailFinal, senhaUsada);
    } catch {}
  }

  async function entrarComBiometria(nomeParam?: string) {
    const ok = await autenticarBiometria(`Entrar no DBV+ com ${nomeParam ?? nomeBio}`);
    if (!ok) return;
    const c = await lerCredenciaisBiometria();
    if (!c) {
      setBioAtiva(false);
      avisar('Não encontrei a senha salva. Entre com a senha para ativar de novo.', 'info', 'Biometria');
      return;
    }
    setEmail(c.email);
    await handleLogin(c.email, c.senha, true);
  }

  entrarBioRef.current = entrarComBiometria;

  const seguirAposLogin = async (emailFinal: string) => {
    const { usuario, mfaPendente, consentimentoPendente } = useAuthStore.getState();
    if (usuario) {
      await carregarContextos(usuario);
      if (salvarLogin) {
        const novaLista = [emailFinal, ...historico.filter((x) => x !== emailFinal)].slice(0, 5);
        setHistorico(novaLista);
        await AsyncStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(novaLista));
      }
      router.replace(useContextoStore.getState().selecaoPendente ? '/auth/contexto' : '/(tabs)');
    } else if (mfaPendente) {
      router.replace('/auth/mfa');
    } else if (consentimentoPendente) {
      router.replace('/auth/consent');
    }
  };

  async function esqueciSenha() {
    const emailFinal = email.trim().toLowerCase();
    if (!emailFinal) {
      emailRef.current?.focus();
      avisar('Digite seu e-mail de login acima e toque em "Esqueci minha senha" de novo.', 'info', 'Informe o e-mail');
      return;
    }
    setEnviandoReset(true);
    try {
      const origin = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://dbvplus.pages.dev';
      const { error } = await supabase.auth.resetPasswordForEmail(emailFinal, {
        redirectTo: `${origin}/auth/recuperar-senha`,
      });
      if (error) throw error;
      avisar('Se este e-mail estiver cadastrado, você vai receber um link para redefinir a senha.', 'sucesso', 'Verifique seu e-mail');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível enviar o e-mail de recuperação.', 'erro');
    } finally {
      setEnviandoReset(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.inner}>
        <View style={styles.logoArea}>
          {/* A MESMA arte do ícone do app, da tela de abertura e do favicon —
              antes aqui havia só um emoji de barraca, destoando do resto. */}
          <Image
            source={require('../../assets/logo-transparente.png')}
            style={styles.logoImagem}
            resizeMode="contain"
          />
          <Text style={styles.logoTitle}>DBV+</Text>
          <Text style={styles.logoSub}>Desbravadores</Text>
        </View>

        <View style={[styles.form, { backgroundColor: cores.cartao }]}>
          <Text style={[styles.label, { color: cores.textoSecundario }]}>Email</Text>
          <TextInput
            ref={emailRef}
            style={[styles.input, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={cores.placeholder}
            returnKeyType="next"
            autoComplete="email"
            textContentType="username"
            onSubmitEditing={() => {
              if (!email.trim()) emailRef.current?.focus();
              else if (senha) handleLogin();
              else senhaRef.current?.focus();
            }}
          />

          {historico.length > 0 && (
            <View style={styles.historyWrap}>
              {historico.map((item) => (
                <TouchableOpacity key={item} style={[styles.historyChip, { backgroundColor: cores.fundo }]} onPress={() => setEmail(item)}>
                  <Ionicons name="person-circle-outline" size={15} color={corIcone(cores)} />
                  <Text style={[styles.historyText, cores.isEscuro && { color: '#fff' }]} numberOfLines={1}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.label, { color: cores.textoSecundario }]}>Senha</Text>
          <TextInput
            ref={senhaRef}
            style={[styles.input, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
            value={senha}
            onChangeText={setSenha}
            placeholder="••••••••"
            secureTextEntry
            placeholderTextColor={cores.placeholder}
            returnKeyType="go"
            autoComplete="off"
            textContentType="none"
            autoCorrect={false}
            onSubmitEditing={() => handleLogin()}
          />

          <TouchableOpacity onPress={esqueciSenha} disabled={enviandoReset} style={styles.esqueciSenhaRow}>
            <Text style={[styles.esqueciSenhaText, cores.isEscuro && { color: '#fff' }]}>
              {enviandoReset ? 'Enviando...' : 'Esqueci minha senha'}
            </Text>
          </TouchableOpacity>

          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          <TouchableOpacity style={styles.saveLoginRow} onPress={() => setSalvarLogin((v) => !v)}>
            <View style={[styles.check, salvarLogin && styles.checkOn]}>
              {salvarLogin && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={[styles.saveLoginText, { color: cores.textoSecundario }]}>Lembrar este email neste aparelho</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, carregando && styles.btnDisabled]}
            onPress={() => handleLogin()}
            disabled={carregando}
          >
            {carregando
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={styles.btnContent}>
                  <Ionicons name="log-in-outline" size={20} color="#fff" />
                  <Text style={styles.btnText}>Entrar</Text>
                </View>
              )
            }
          </TouchableOpacity>
          {bioAtiva ? (
            <TouchableOpacity
              style={[styles.bioBtn, { backgroundColor: cores.acentoSuave, borderColor: cores.borda }]}
              onPress={() => entrarComBiometria()}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityLabel={`Entrar com ${nomeBio}`}
            >
              <Ionicons name="finger-print" size={22} color={cores.acento} />
              <Text style={[styles.bioTexto, { color: cores.acento }]}>Entrar com {nomeBio}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.demoBtn, { backgroundColor: cores.cartao }]}
          onPress={() => router.push('/demo' as any)}
        >
          <Ionicons name="eye-outline" size={17} color={corIcone(cores)} />
          <Text style={[styles.demoBtnText]}>Explorar o DBV+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cadastroBox}
          onPress={() => Linking.openURL('https://dbvplus.pages.dev/suporte')}
        >
          <Text style={styles.cadastroLink}>Quero o DBV+ no meu clube</Text>
        </TouchableOpacity>

        <View style={styles.rodapeLinksRow}>
          <TouchableOpacity
            style={styles.faleConoscoRow}
            onPress={() => Linking.openURL('https://dbvplus.pages.dev/suporte')}
          >
            <Ionicons name="help-buoy-outline" size={15} color="#a8c8e8" />
            <Text style={styles.faleConoscoText}>Fale conosco</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.faleConoscoRow}
            onPress={() => Linking.openURL('https://dbvplus.pages.dev/privacidade')}
          >
            <Ionicons name="shield-checkmark-outline" size={15} color="#a8c8e8" />
            <Text style={styles.faleConoscoText}>Privacidade</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>DBV+ — Sistema de Gerenciamento de Clubes</Text>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bioBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 22, borderWidth: 1, minHeight: 48, paddingHorizontal: 16 },
  bioTexto: { fontSize: 14, fontWeight: '800' },
  container: { flex: 1, backgroundColor: '#7c39e7' },
  scrollContent: { flexGrow: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingBottom: 40 },
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 22, padding: 14, marginTop: 18,
  },
  demoBtnText: { color: '#4b2bb0', fontWeight: '800', fontSize: 14 },
  demoApoioTexto: { color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
  cadastroBox: { marginTop: 16, alignItems: 'center' },
  cadastroTexto: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  cadastroLink: { color: '#f9c74f', fontWeight: '800', fontSize: 14, marginTop: 6 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoImagem: { width: 132, height: 132, marginBottom: 12 },
  logoTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.5, textAlign: 'center' },
  logoSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'center' },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, padding: 14, fontSize: 15, color: '#222', backgroundColor: '#fafafa' },
  historyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  historyChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', backgroundColor: '#efeaf9', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  historyText: { color: '#4b2bb0', fontSize: 11, fontWeight: '700', maxWidth: 190 },
  erro: { color: '#e53935', fontSize: 13, marginTop: 10, textAlign: 'center' },
  esqueciSenhaRow: { alignSelf: 'flex-end', marginTop: 10 },
  esqueciSenhaText: { color: '#4b2bb0', fontSize: 13, fontWeight: '700' },
  saveLoginRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#7c39e7', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#7c39e7' },
  saveLoginText: { color: '#555', fontSize: 13, fontWeight: '600' },
  btn: { backgroundColor: '#7c39e7', borderRadius: 22, padding: 16, alignItems: 'center', marginTop: 20 },
  btnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  rodapeLinksRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 28 },
  faleConoscoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  faleConoscoText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 10 },
});

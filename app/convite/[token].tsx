import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';

export const CONVITE_KEY = 'fonseca_convite_pendente';

type Tela = 'carregando' | 'form' | 'processando' | 'confirmacao_email' | 'sucesso' | 'erro_email' | 'erro';
type FormAba = 'registrar' | 'login';

export default function ConviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const usuario = useAuthStore((s) => s.usuario);
  const carregarContextos = useContextoStore((s) => s.carregarContextos);

  const [tela, setTela] = useState<Tela>('carregando');
  const [formAba, setFormAba] = useState<FormAba>('registrar');
  const [emailConvite, setEmailConvite] = useState('');
  const [nomeFilho, setNomeFilho] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!token) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      localStorage.setItem(CONVITE_KEY, token);
    }
    init();
  }, [token]);

  async function init() {
    if (usuario) {
      setTela('processando');
      await processarConvite();
      return;
    }
    setTela('form');
  }

  async function processarConvite() {
    try {
      const { data: result, error } = await supabase.rpc('aceitar_convite_responsavel', { p_token: token });
      if (error) throw error;

      if (result?.error === 'email_mismatch') {
        setEmailConvite(result.esperado ?? '');
        setTela('erro_email');
        return;
      }
      if (result?.error) {
        setTela('erro');
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        localStorage.removeItem(CONVITE_KEY);
      }

      if (result?.membro_id) {
        const { data: m } = await supabase
          .from('desbravadores')
          .select('nome')
          .eq('id', result.membro_id)
          .maybeSingle();
        setNomeFilho(m?.nome ?? '');
      }

      setTela('sucesso');
      const u = useAuthStore.getState().usuario;
      if (u) await carregarContextos(u).catch(() => {});
      setTimeout(() => router.replace('/auth/contexto'), 2500);
    } catch {
      setTela('erro');
    }
  }

  async function handleCriarConta() {
    if (!senha || senha.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres.'); return; }
    if (senha !== confirmarSenha) { setErro('As senhas não coincidem.'); return; }
    setErro('');
    setSalvando(true);
    try {
      const origin = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://gsf-clubes.pages.dev';
      const { error: signUpErr } = await supabase.auth.signUp({
        email: emailConvite,
        password: senha,
        options: { emailRedirectTo: `${origin}/convite/${token}` },
      });
      if (signUpErr) { setErro(signUpErr.message); return; }

      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        // Email confirmation not required — log in
        await useAuthStore.getState().login(emailConvite, senha);
        const u = useAuthStore.getState().usuario;
        if (u) {
          setTela('processando');
          await processarConvite();
        }
      } else {
        setTela('confirmacao_email');
      }
    } finally {
      setSalvando(false);
    }
  }

  async function handleLogin() {
    if (!senhaLogin) { setErro('Informe sua senha.'); return; }
    setErro('');
    setSalvando(true);
    try {
      await useAuthStore.getState().login(emailConvite, senhaLogin);
      const { usuario: u, erro: erroLogin } = useAuthStore.getState();
      if (erroLogin || !u) { setErro(erroLogin ?? 'Email ou senha incorretos.'); return; }
      setTela('processando');
      await processarConvite();
    } finally {
      setSalvando(false);
    }
  }

  if (tela === 'carregando' || tela === 'processando') {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#1a3a5c" />
        <Text style={s.sub}>{tela === 'processando' ? 'Vinculando acesso...' : 'Carregando...'}</Text>
      </View>
    );
  }

  if (tela === 'sucesso') {
    return (
      <View style={s.center}>
        <Ionicons name="checkmark-circle" size={72} color="#2e7d32" />
        <Text style={s.title}>Acesso ativado!</Text>
        {nomeFilho ? <Text style={s.sub}>Você agora acompanha {nomeFilho}.</Text> : null}
        <Text style={s.hint}>Redirecionando...</Text>
      </View>
    );
  }

  if (tela === 'confirmacao_email') {
    return (
      <View style={s.center}>
        <Ionicons name="mail" size={64} color="#1a3a5c" />
        <Text style={s.title}>Confirme seu e-mail</Text>
        <Text style={s.sub}>
          Enviamos um link para{'\n'}<Text style={{ fontWeight: '900' }}>{emailConvite}</Text>
          {'\n\n'}Clique no link para ativar sua conta e o acesso ao clube.
        </Text>
      </View>
    );
  }

  if (tela === 'erro_email') {
    return (
      <View style={s.center}>
        <Ionicons name="warning" size={60} color="#f57c00" />
        <Text style={s.title}>E-mail diferente</Text>
        <Text style={s.sub}>
          Este convite foi enviado para{'\n'}<Text style={{ fontWeight: '900' }}>{emailConvite}</Text>
          {'\n\n'}Faça login com esse endereço.
        </Text>
        <TouchableOpacity style={s.btn} onPress={() => router.replace('/auth/login')}>
          <Text style={s.btnText}>Ir para login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (tela === 'erro') {
    return (
      <View style={s.center}>
        <Ionicons name="close-circle" size={72} color="#c62828" />
        <Text style={s.title}>Convite inválido</Text>
        <Text style={s.sub}>Este link pode ter expirado ou já foi utilizado.</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.replace('/auth/login')}>
          <Text style={s.btnText}>Ir para login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // tela === 'form'
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Ionicons name="people-circle" size={40} color="#fff" />
        <Text style={s.headerTitle}>Convite de acesso</Text>
        <Text style={s.headerSub}>Acompanhe seu filho no clube pelo app</Text>
      </View>

      <View style={s.card}>
        <Text style={s.instrucao}>
          Digite o e-mail para o qual o convite foi enviado e crie sua conta ou faça login.
        </Text>

        <Text style={s.label}>E-mail do convite</Text>
        <TextInput
          style={s.input}
          value={emailConvite}
          onChangeText={setEmailConvite}
          placeholder="seu@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#aaa"
        />

        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, formAba === 'registrar' && s.tabAtivo]}
            onPress={() => { setFormAba('registrar'); setErro(''); }}
          >
            <Text style={[s.tabText, formAba === 'registrar' && s.tabTextoAtivo]}>Criar conta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, formAba === 'login' && s.tabAtivo]}
            onPress={() => { setFormAba('login'); setErro(''); }}
          >
            <Text style={[s.tabText, formAba === 'login' && s.tabTextoAtivo]}>Já tenho conta</Text>
          </TouchableOpacity>
        </View>

        {formAba === 'registrar' && (
          <>
            <Text style={s.label}>Senha</Text>
            <TextInput
              style={s.input}
              value={senha}
              onChangeText={setSenha}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              placeholderTextColor="#aaa"
            />
            <Text style={s.label}>Confirmar senha</Text>
            <TextInput
              style={s.input}
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              placeholder="Repita a senha"
              secureTextEntry
              placeholderTextColor="#aaa"
            />
          </>
        )}

        {formAba === 'login' && (
          <>
            <Text style={s.label}>Senha</Text>
            <TextInput
              style={s.input}
              value={senhaLogin}
              onChangeText={setSenhaLogin}
              placeholder="Sua senha"
              secureTextEntry
              placeholderTextColor="#aaa"
            />
          </>
        )}

        {erro ? <Text style={s.erro}>{erro}</Text> : null}

        <TouchableOpacity
          style={[s.btnAction, salvando && { opacity: 0.6 }]}
          onPress={formAba === 'registrar' ? handleCriarConta : handleLogin}
          disabled={salvando}
        >
          {salvando
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnActionText}>
                {formAba === 'registrar' ? 'Criar conta e ativar acesso' : 'Entrar e ativar acesso'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 32, backgroundColor: '#eef3f8' },
  header: { backgroundColor: '#1a3a5c', padding: 28, paddingTop: 56, alignItems: 'center', gap: 8 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  headerSub: { color: '#a8c8e8', fontSize: 14, textAlign: 'center' },
  card: { margin: 18, backgroundColor: '#fff', borderRadius: 18, padding: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8 },
  instrucao: { fontSize: 13, color: '#546e7a', lineHeight: 19, marginBottom: 4 },
  tabs: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e8f0', marginVertical: 14 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f5f8fb' },
  tabAtivo: { backgroundColor: '#1a3a5c' },
  tabText: { color: '#546e7a', fontWeight: '700', fontSize: 13 },
  tabTextoAtivo: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 13, fontSize: 15, color: '#222' },
  erro: { color: '#e53935', fontSize: 13, marginTop: 8 },
  btnAction: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 16 },
  btnActionText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  title: { fontSize: 22, fontWeight: '900', color: '#1a3a5c', textAlign: 'center' },
  sub: { fontSize: 15, color: '#546e7a', textAlign: 'center', lineHeight: 22 },
  hint: { fontSize: 13, color: '#90a4ae', marginTop: 4 },
  btn: { marginTop: 20, backgroundColor: '#1a3a5c', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});

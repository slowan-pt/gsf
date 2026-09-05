import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';

function avisar(mensagem: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(mensagem);
    return;
  }
  // No app nativo o link do e-mail abre no navegador do aparelho, então esta
  // tela na prática só roda na Web — isto aqui é só um fallback de segurança.
  console.warn(mensagem);
}

/**
 * Tela que recebe o link de "esqueci minha senha" enviado pelo Supabase.
 * O cliente Supabase deste app usa detectSessionInUrl:false (ver
 * src/lib/supabase.ts), então o token de recuperação que vem no hash da URL
 * (#access_token=...&refresh_token=...&type=recovery) precisa ser lido e
 * aplicado manualmente aqui — sem isso a sessão de recuperação nunca é
 * estabelecida e updateUser() falharia com "not authenticated".
 */
export default function RecuperarSenhaScreen() {
  const [verificando, setVerificando] = useState(true);
  const [sessaoValida, setSessaoValida] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    async function estabelecerSessaoDeRecuperacao() {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) {
          const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            // Limpa o token da URL — evita reaplicar/expor no histórico do navegador.
            window.history.replaceState(null, '', window.location.pathname);
            setSessaoValida(true);
            return;
          }
        }
        // Sem token no hash: talvez o usuário já tenha uma sessão válida
        // (ex.: reabriu a aba). Confere antes de desistir.
        const { data } = await supabase.auth.getSession();
        setSessaoValida(!!data.session);
      } catch (e) {
        setSessaoValida(false);
      } finally {
        setVerificando(false);
      }
    }
    estabelecerSessaoDeRecuperacao();
  }, []);

  async function salvar() {
    if (novaSenha.length < 6) {
      avisar('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      avisar('As senhas não conferem.');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      await supabase.auth.signOut();
      setFeito(true);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível alterar a senha. Peça um novo link de recuperação.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.logoArea}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImagem} resizeMode="contain" />
          <Text style={styles.logoTitle}>Redefinir senha</Text>
        </View>

        <View style={styles.form}>
          {verificando ? (
            <ActivityIndicator color="#1a3a5c" size="large" style={{ marginVertical: 20 }} />
          ) : feito ? (
            <>
              <Ionicons name="checkmark-circle" size={40} color="#2e7d32" style={{ alignSelf: 'center', marginBottom: 8 }} />
              <Text style={styles.mensagem}>Senha alterada com sucesso! Faça login com a nova senha.</Text>
              <TouchableOpacity style={styles.btn} onPress={() => router.replace('/auth/login')}>
                <Text style={styles.btnText}>Ir para o login</Text>
              </TouchableOpacity>
            </>
          ) : !sessaoValida ? (
            <>
              <Ionicons name="alert-circle" size={40} color="#c0392b" style={{ alignSelf: 'center', marginBottom: 8 }} />
              <Text style={styles.mensagem}>
                Este link de recuperação é inválido ou expirou. Volte à tela de login e toque em
                "Esqueci minha senha" para receber um novo link.
              </Text>
              <TouchableOpacity style={styles.btn} onPress={() => router.replace('/auth/login')}>
                <Text style={styles.btnText}>Voltar ao login</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Nova senha</Text>
              <TextInput
                style={styles.input}
                value={novaSenha}
                onChangeText={setNovaSenha}
                placeholder="Mínimo 6 caracteres"
                secureTextEntry
                placeholderTextColor="#aaa"
              />
              <Text style={styles.label}>Confirmar nova senha</Text>
              <TextInput
                style={styles.input}
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                placeholder="Repita a nova senha"
                secureTextEntry
                placeholderTextColor="#aaa"
                onSubmitEditing={salvar}
              />
              <TouchableOpacity style={[styles.btn, salvando && styles.btnDisabled]} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar nova senha</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3a5c' },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoImagem: { width: 96, height: 96, borderRadius: 20, marginBottom: 12 },
  logoTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, color: '#222', backgroundColor: '#fafafa' },
  mensagem: { fontSize: 14, color: '#444', textAlign: 'center', lineHeight: 20 },
  btn: { backgroundColor: '#1a3a5c', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

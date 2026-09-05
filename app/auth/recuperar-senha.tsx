import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../src/lib/supabase';
import { avisar } from '../../src/stores/avisoStore';

/**
 * Tela que recebe o link de "esqueci minha senha" enviado pelo Supabase.
 * O cliente Supabase deste app usa detectSessionInUrl:false (ver
 * src/lib/supabase.ts), então o token de recuperação que vem no hash da URL
 * (#access_token=...&refresh_token=...&type=recovery) precisa ser lido e
 * aplicado manualmente aqui — sem isso a sessão de recuperação nunca é
 * estabelecida e updateUser() falharia com "not authenticated".
 *
 * Contas com dupla autenticação (diretoria/admin) ficam numa sessão AAL1
 * mesmo com o token de recuperação — o Supabase exige AAL2 (MFA verificado)
 * pra trocar senha/e-mail nessas contas ("AAL2 session is required..."),
 * então aqui tem um passo extra pedindo o código do Authenticator antes de
 * liberar os campos de nova senha, só quando a conta realmente tem MFA.
 */
export default function RecuperarSenhaScreen() {
  const [verificando, setVerificando] = useState(true);
  const [sessaoValida, setSessaoValida] = useState(false);
  const [precisaMfa, setPrecisaMfa] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [codigoMfa, setCodigoMfa] = useState('');
  const [verificandoMfa, setVerificandoMfa] = useState(false);
  const [erroMfa, setErroMfa] = useState('');
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
            await conferirNivelMfa();
            return;
          }
        }
        // Sem token no hash: talvez o usuário já tenha uma sessão válida
        // (ex.: reabriu a aba). Confere antes de desistir.
        const { data } = await supabase.auth.getSession();
        if (data.session) await conferirNivelMfa();
        else setSessaoValida(false);
      } catch (e) {
        setSessaoValida(false);
      } finally {
        setVerificando(false);
      }
    }
    estabelecerSessaoDeRecuperacao();
  }, []);

  /** Descobre se esta conta tem MFA e, se tiver, exige o código antes de liberar a troca de senha. */
  async function conferirNivelMfa() {
    const mfa = (supabase.auth as any).mfa;
    const { data: aal } = await mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === 'aal2' || aal?.nextLevel !== 'aal2') {
      // Ou já está no nível exigido, ou a conta nem tem MFA cadastrado — nada a fazer.
      setSessaoValida(true);
      return;
    }
    const { data: factors } = await mfa.listFactors();
    const fator = (factors?.totp ?? []).find((f: any) => f.status === 'verified');
    if (!fator) {
      setSessaoValida(true);
      return;
    }
    setMfaFactorId(fator.id);
    setPrecisaMfa(true);
    setSessaoValida(true);
  }

  async function verificarMfa() {
    const code = codigoMfa.trim().replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      setErroMfa('Digite o código de 6 números do Google Authenticator.');
      return;
    }
    setVerificandoMfa(true);
    setErroMfa('');
    try {
      const mfa = (supabase.auth as any).mfa;
      const challenge = await mfa.challenge({ factorId: mfaFactorId });
      if (challenge.error) throw challenge.error;
      const verify = await mfa.verify({ factorId: mfaFactorId, challengeId: challenge.data.id, code });
      if (verify.error) throw verify.error;
      setPrecisaMfa(false);
    } catch {
      setCodigoMfa('');
      setErroMfa('Código incorreto. Digite ou cole novamente.');
    } finally {
      setVerificandoMfa(false);
    }
  }

  async function salvar() {
    if (novaSenha.length < 6) {
      avisar('A senha precisa ter pelo menos 6 caracteres.', 'info', 'Atenção');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      avisar('As senhas não conferem.', 'info', 'Atenção');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      await supabase.auth.signOut();
      setFeito(true);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível alterar a senha. Peça um novo link de recuperação.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function colarCodigoMfa() {
    try {
      const texto = await Clipboard.getStringAsync();
      const code = texto.replace(/\D/g, '').slice(0, 6);
      if (!code) {
        avisar('Não encontrei nenhum código numérico na área de transferência.', 'info', 'Colar código');
        return;
      }
      setCodigoMfa(code);
      setErroMfa('');
      if (code.length === 6) {
        setTimeout(() => verificarMfa(), 0);
      }
    } catch {
      avisar('Não foi possível ler a área de transferência.', 'erro', 'Colar código');
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
          ) : precisaMfa ? (
            <>
              <Text style={styles.mensagem}>
                Sua conta tem dupla autenticação. Digite o código do Google Authenticator pra continuar.
              </Text>
              <Text style={styles.label}>Código de 6 dígitos</Text>
              <View style={styles.codigoField}>
                <TextInput
                  style={[styles.input, { textAlign: 'center', letterSpacing: 6, fontWeight: '800', fontSize: 20, paddingRight: 92 }]}
                  value={codigoMfa}
                  onChangeText={(v) => { setCodigoMfa(v.replace(/\D/g, '').slice(0, 6)); setErroMfa(''); }}
                  placeholder="000000"
                  keyboardType="number-pad"
                  autoFocus
                  onSubmitEditing={verificarMfa}
                />
                <TouchableOpacity style={styles.pasteBtn} onPress={colarCodigoMfa}>
                  <Ionicons name="clipboard-outline" size={15} color="#1a3a5c" />
                  <Text style={styles.pasteText}>Colar</Text>
                </TouchableOpacity>
              </View>
              {erroMfa ? <Text style={styles.erro}>{erroMfa}</Text> : null}
              <TouchableOpacity style={[styles.btn, verificandoMfa && styles.btnDisabled]} onPress={verificarMfa} disabled={verificandoMfa}>
                {verificandoMfa ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verificar código</Text>}
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
                autoComplete="new-password"
                textContentType="newPassword"
                importantForAutofill="no"
              />
              <Text style={styles.label}>Confirmar nova senha</Text>
              <TextInput
                style={styles.input}
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                placeholder="Repita a nova senha"
                secureTextEntry
                placeholderTextColor="#aaa"
                autoComplete="new-password"
                textContentType="newPassword"
                importantForAutofill="no"
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
  codigoField: { position: 'relative', justifyContent: 'center' },
  pasteBtn: { position: 'absolute', right: 8, top: 8, bottom: 8, paddingHorizontal: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, backgroundColor: '#eef3f8' },
  pasteText: { color: '#1a3a5c', fontWeight: '900', fontSize: 12 },
  mensagem: { fontSize: 14, color: '#444', textAlign: 'center', lineHeight: 20 },
  erro: { color: '#c62828', marginTop: 10, textAlign: 'center' },
  btn: { backgroundColor: '#1a3a5c', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

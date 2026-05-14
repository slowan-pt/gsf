import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';

const LOGIN_HISTORY_KEY = 'login_history_emails_v1';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [salvarLogin, setSalvarLogin] = useState(true);
  const [historico, setHistorico] = useState<string[]>([]);
  const { login, carregando, erro } = useAuthStore();

  useEffect(() => {
    AsyncStorage.getItem(LOGIN_HISTORY_KEY).then((raw) => {
      if (!raw) return;
      try { setHistorico(JSON.parse(raw)); } catch {}
    });
  }, []);

  const handleLogin = async () => {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Preencha email e senha.');
      return;
    }
    const emailFinal = email.trim().toLowerCase();
    await login(emailFinal, senha);
    const usuario = useAuthStore.getState().usuario;
    if (usuario) {
      if (salvarLogin) {
        const novaLista = [emailFinal, ...historico.filter((x) => x !== emailFinal)].slice(0, 5);
        setHistorico(novaLista);
        await AsyncStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(novaLista));
      }
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.logoArea}>
          <Text style={styles.logoEmoji}>🏕️</Text>
          <Text style={styles.logoTitle}>FONSECA 2026</Text>
          <Text style={styles.logoSub}>Clube de Desbravadores</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#aaa"
          />

          {historico.length > 0 && (
            <View style={styles.historyWrap}>
              {historico.map((item) => (
                <TouchableOpacity key={item} style={styles.historyChip} onPress={() => setEmail(item)}>
                  <Ionicons name="person-circle-outline" size={15} color="#1a3a5c" />
                  <Text style={styles.historyText} numberOfLines={1}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={senha}
            onChangeText={setSenha}
            placeholder="••••••••"
            secureTextEntry
            placeholderTextColor="#aaa"
          />

          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          <TouchableOpacity style={styles.saveLoginRow} onPress={() => setSalvarLogin((v) => !v)}>
            <View style={[styles.check, salvarLogin && styles.checkOn]}>
              {salvarLogin && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={styles.saveLoginText}>Salvar este login neste aparelho</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, carregando && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={carregando}
          >
            {carregando
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Entrar</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Clube Fonseca • DSA 2026</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3a5c' },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 64, marginBottom: 8 },
  logoTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  logoSub: { fontSize: 14, color: '#a8c8e8', marginTop: 4 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, color: '#222', backgroundColor: '#fafafa' },
  historyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  historyChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', backgroundColor: '#eef3f8', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  historyText: { color: '#1a3a5c', fontSize: 11, fontWeight: '700', maxWidth: 190 },
  erro: { color: '#e53935', fontSize: 13, marginTop: 10, textAlign: 'center' },
  saveLoginRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#1a3a5c' },
  saveLoginText: { color: '#555', fontSize: 13, fontWeight: '600' },
  btn: { backgroundColor: '#1a3a5c', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { textAlign: 'center', color: '#a8c8e8', fontSize: 12, marginTop: 32 },
});

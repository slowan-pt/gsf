import { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { BottomNav } from '../src/components/BottomNav';

export default function PerfilScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const atualizarUsuarioLocal = useAuthStore((s) => s.atualizarUsuarioLocal);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    setNome(usuario.nome ?? '');
    setEmail(usuario.email ?? '');
  }, [usuario]);

  if (!usuario) return <Redirect href="/auth/login" />;
  const usuarioAtual = usuario;

  async function salvar() {
    if (!nome.trim()) { Alert.alert('Atenção', 'Informe seu nome de exibição.'); return; }
    if (!email.trim()) { Alert.alert('Atenção', 'Informe seu e-mail.'); return; }
    if (senha && senha.length < 6) { Alert.alert('Atenção', 'A nova senha precisa ter pelo menos 6 caracteres.'); return; }

    setSalvando(true);
    try {
      const authPayload: { email?: string; password?: string; data?: Record<string, unknown> } = {
        data: { nome: nome.trim() },
      };
      if (email.trim().toLowerCase() !== usuarioAtual.email.toLowerCase()) authPayload.email = email.trim().toLowerCase();
      if (senha.trim()) authPayload.password = senha.trim();

      const { error: authError } = await supabase.auth.updateUser(authPayload);
      if (authError) throw authError;

      const novoUsuario = {
        ...usuarioAtual,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
      };

      const { error: perfilError } = await supabase
        .from('usuarios')
        .update({ nome: novoUsuario.nome, email: novoUsuario.email })
        .eq('id', usuarioAtual.id);
      if (perfilError) throw perfilError;

      // Se o e-mail mudou e o usuário é responsável, sincroniza no vínculo do filho
      const emailMudou = novoUsuario.email !== usuarioAtual.email.toLowerCase();
      if (emailMudou) {
        try {
          const { data: vinculos } = await supabase
            .from('responsavel_membros')
            .select('membro_id')
            .eq('usuario_id', usuarioAtual.id)
            .eq('ativo', true);
          if (vinculos && vinculos.length > 0) {
            const ids = (vinculos as Array<{ membro_id: number }>).map((v) => v.membro_id);
            // Atualiza apenas desbravadores cujo e-mail ainda era o e-mail antigo do responsável
            await supabase
              .from('desbravadores')
              .update({ email: novoUsuario.email })
              .in('id', ids)
              .eq('email', usuarioAtual.email.toLowerCase());
          }
        } catch { /* sincronização best-effort — não bloqueia o save */ }
      }

      atualizarUsuarioLocal(novoUsuario);
      setSenha('');
      Alert.alert('Pronto', 'Seus dados foram atualizados.');
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível salvar seus dados.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Meu perfil</Text>
          <Text style={s.sub}>Dados de acesso e exibição</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Nome de exibição</Text>
        <TextInput style={s.input} value={nome} onChangeText={setNome} placeholder="Seu nome" />

        <Text style={s.label}>E-mail de login</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email@exemplo.com"
        />

        <Text style={s.label}>Nova senha</Text>
        <TextInput
          style={s.input}
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          placeholder="Deixe em branco para manter"
        />

        <TouchableOpacity style={s.save} onPress={salvar} disabled={salvando}>
          {salvando ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={s.saveText}>Salvar alterações</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      <BottomNav />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { padding: 6 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#a8c8e8', marginTop: 3 },
  content: { padding: 20 },
  label: { fontSize: 13, fontWeight: '800', color: '#667', marginBottom: 7, marginTop: 14, textTransform: 'uppercase' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 12, padding: 14, fontSize: 16, color: '#1f2933' },
  save: { marginTop: 24, backgroundColor: '#1a3a5c', borderRadius: 14, padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

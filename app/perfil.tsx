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
import { normalizarPerfil } from '../src/lib/permissoes';
import { diagnosticarPush, enviarPushDeTeste } from '../src/lib/notifications';
import { idadePorNascimento } from '../src/lib/classesRequisitos';

const ROTULO_PERFIL: Record<string, string> = {
  admin_ti: 'Admin TI',
  admin_clube: 'Admin do clube',
  usuario_secretaria: 'Secretaria',
  usuario_tesouraria: 'Tesouraria',
  usuario_conselheiro: 'Conselheiro',
  usuario_diretoria: 'Diretoria',
  usuario_regional: 'Regional',
  usuario_distrital: 'Distrital',
  usuario_pastor: 'Pastor',
  usuario_capelao: 'Capelão',
  usuario_pais: 'Pais/Responsável',
  responsavel: 'Pais/Responsável',
  usuario_desbravador: 'Desbravador',
  usuario_aventureiro: 'Aventureiro',
};

export default function PerfilScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const atualizarUsuarioLocal = useAuthStore((s) => s.atualizarUsuarioLocal);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [checandoPush, setChecandoPush] = useState(false);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);
  // Enquanto não sabemos a idade, trava por segurança (evita um flash de
  // campos editáveis pra quem é menor de 16).
  const [podeEditarNomeEmail, setPodeEditarNomeEmail] = useState(false);
  const [verificandoIdade, setVerificandoIdade] = useState(true);

  /** Mostra por que a notificação não chega e tenta enviar uma de teste. */
  async function verificarPush() {
    if (!usuario) return;
    setChecandoPush(true);
    setDiagnostico(null);
    try {
      const d = await diagnosticarPush(usuario.id);
      if (!d.ehDispositivo) {
        setDiagnostico('Emulador/navegador não recebe push. Teste no celular.');
        return;
      }
      if (d.permissao !== 'granted') {
        setDiagnostico(`Permissão de notificação: ${d.permissao}. Libere nas configurações do Android.`);
        return;
      }
      if (!d.tokenLocal) {
        setDiagnostico(`Este aparelho não conseguiu gerar o token${d.erro ? `: ${d.erro}` : ' (falta configuração do Firebase).'}`);
        return;
      }
      if (!d.tokenNoServidor) {
        setDiagnostico('Token gerado, mas não salvo no servidor. Saia e entre de novo.');
        return;
      }
      setDiagnostico(await enviarPushDeTeste(usuario.id));
    } catch (e: any) {
      setDiagnostico(e?.message ?? 'Falha ao verificar.');
    } finally {
      setChecandoPush(false);
    }
  }

  useEffect(() => {
    if (!usuario) return;
    setNome(usuario.nome ?? '');
    setEmail(usuario.email ?? '');
  }, [usuario]);

  // Membro com menos de 16 anos: nome e e-mail passam a ser só visualização
  // — quem altera é o pai/responsável ou alguém com esse perfil, pela ficha
  // do membro. Contas sem dbv_id (admin, diretoria, pais) não são afetadas.
  useEffect(() => {
    let ativo = true;
    async function checarIdade() {
      if (!usuario?.dbv_id) {
        if (ativo) { setPodeEditarNomeEmail(true); setVerificandoIdade(false); }
        return;
      }
      try {
        const { data } = await supabase
          .from('desbravadores')
          .select('data_nascimento')
          .eq('id', usuario.dbv_id)
          .maybeSingle();
        const idade = idadePorNascimento(data?.data_nascimento ?? null);
        if (ativo) setPodeEditarNomeEmail(idade == null || idade >= 16);
      } catch {
        if (ativo) setPodeEditarNomeEmail(true); // offline: não bloqueia sem certeza
      } finally {
        if (ativo) setVerificandoIdade(false);
      }
    }
    checarIdade();
    return () => { ativo = false; };
  }, [usuario?.dbv_id]);

  if (!usuario) return <Redirect href="/auth/login" />;
  const usuarioAtual = usuario;
  const perfilNormalizado = normalizarPerfil(usuarioAtual.perfil) ?? usuarioAtual.perfil;
  const rotuloPerfil = ROTULO_PERFIL[perfilNormalizado] ?? perfilNormalizado;

  async function salvar() {
    if (podeEditarNomeEmail) {
      if (!nome.trim()) { Alert.alert('Atenção', 'Informe seu nome de exibição.'); return; }
      if (!email.trim()) { Alert.alert('Atenção', 'Informe seu e-mail.'); return; }
    }
    if (senha && senha.length < 6) { Alert.alert('Atenção', 'A nova senha precisa ter pelo menos 6 caracteres.'); return; }
    if (!senha.trim() && !podeEditarNomeEmail) { Alert.alert('Atenção', 'Informe a nova senha.'); return; }

    setSalvando(true);
    try {
      const authPayload: { email?: string; password?: string; data?: Record<string, unknown> } = {};
      if (podeEditarNomeEmail) {
        authPayload.data = { nome: nome.trim() };
        if (email.trim().toLowerCase() !== usuarioAtual.email.toLowerCase()) authPayload.email = email.trim().toLowerCase();
      }
      if (senha.trim()) authPayload.password = senha.trim();

      const { error: authError } = await supabase.auth.updateUser(authPayload);
      if (authError) throw authError;

      const novoUsuario = {
        ...usuarioAtual,
        nome: podeEditarNomeEmail ? nome.trim() : usuarioAtual.nome,
        email: podeEditarNomeEmail ? email.trim().toLowerCase() : usuarioAtual.email,
      };

      if (podeEditarNomeEmail) {
        const { error: perfilError } = await supabase
          .from('usuarios')
          .update({ nome: novoUsuario.nome, email: novoUsuario.email })
          .eq('id', usuarioAtual.id);
        if (perfilError) throw perfilError;
      }

      // Se o e-mail mudou e o usuário é responsável, sincroniza no vínculo do filho
      const emailMudou = podeEditarNomeEmail && novoUsuario.email !== usuarioAtual.email.toLowerCase();
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
        <View style={s.cardUsuario}>
          <View style={s.cardUsuarioIcon}>
            <Ionicons name="person-circle-outline" size={28} color="#1a3a5c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardUsuarioNome}>{usuarioAtual.nome}</Text>
            <Text style={s.cardUsuarioPerfil}>{rotuloPerfil}</Text>
          </View>
        </View>

        {perfilNormalizado === 'admin_ti' && (
          <TouchableOpacity style={s.verFicha} onPress={verificarPush} disabled={checandoPush}>
            <Ionicons name="notifications-outline" size={20} color="#1a3a5c" />
            <View style={{ flex: 1 }}>
              <Text style={s.verFichaTitulo}>Testar notificações</Text>
              <Text style={s.verFichaSub}>
                {diagnostico ?? 'Verifica se este aparelho recebe notificações'}
              </Text>
            </View>
            {checandoPush
              ? <ActivityIndicator size="small" color="#1a3a5c" />
              : <Ionicons name="chevron-forward" size={18} color="#9aa5b1" />}
          </TouchableOpacity>
        )}

        {!!usuarioAtual.dbv_id && (
          <TouchableOpacity
            style={s.verFicha}
            onPress={() => router.push({ pathname: '/membro/[id]', params: { id: String(usuarioAtual.dbv_id) } })}
          >
            <Ionicons name="id-card-outline" size={20} color="#1a3a5c" />
            <View style={{ flex: 1 }}>
              <Text style={s.verFichaTitulo}>Minha ficha de membro</Text>
              <Text style={s.verFichaSub}>Ver e editar seus dados completos de cadastro</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9aa5b1" />
          </TouchableOpacity>
        )}

        {!podeEditarNomeEmail && !verificandoIdade && (
          <View style={s.avisoMenor}>
            <Ionicons name="information-circle-outline" size={16} color="#8a6412" />
            <Text style={s.avisoMenorTexto}>
              Nome e e-mail só podem ser alterados pelo pai/responsável (ou por quem já tem esse
              acesso), pela ficha do membro.
            </Text>
          </View>
        )}

        <Text style={s.label}>Nome de exibição</Text>
        <TextInput
          style={[s.input, !podeEditarNomeEmail && s.inputTravado]}
          value={nome}
          onChangeText={setNome}
          placeholder="Seu nome"
          editable={podeEditarNomeEmail}
        />

        <Text style={s.label}>E-mail de login</Text>
        <TextInput
          style={[s.input, !podeEditarNomeEmail && s.inputTravado]}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email@exemplo.com"
          editable={podeEditarNomeEmail}
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
  cardUsuario: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e4eaf1',
  },
  cardUsuarioIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#eef3f8',
    alignItems: 'center', justifyContent: 'center',
  },
  cardUsuarioNome: { fontSize: 16, fontWeight: '800', color: '#1f2933' },
  cardUsuarioPerfil: { fontSize: 12, color: '#667', marginTop: 2, fontWeight: '700', textTransform: 'uppercase' },
  verFicha: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: '#e4eaf1',
  },
  verFichaTitulo: { fontSize: 14, fontWeight: '800', color: '#1f2933' },
  verFichaSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
  label: { fontSize: 13, fontWeight: '800', color: '#667', marginBottom: 7, marginTop: 14, textTransform: 'uppercase' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 12, padding: 14, fontSize: 16, color: '#1f2933' },
  inputTravado: { backgroundColor: '#f0f2f5', color: '#7d8894' },
  avisoMenor: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fff8e8', borderWidth: 1, borderColor: '#e0b563',
    borderRadius: 10, padding: 10, marginTop: 14,
  },
  avisoMenorTexto: { flex: 1, fontSize: 12, color: '#8a6412', lineHeight: 17 },
  save: { marginTop: 24, backgroundColor: '#1a3a5c', borderRadius: 14, padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

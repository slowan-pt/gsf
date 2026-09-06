import { useEffect, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { BottomNav } from '../src/components/BottomNav';
import { normalizarPerfil } from '../src/lib/permissoes';
import { diagnosticarPush, enviarPushDeTeste } from '../src/lib/notifications';
import { idadePorNascimento } from '../src/lib/classesRequisitos';
import { uriParaUploadBodies } from '../src/lib/storageUpload';
import { avatarCor, AvatarBadge, type BadgeFoto } from '../src/components/common/Avatar';
import { useAparenciaStore } from '../src/stores/aparenciaStore';
import { avisar } from '../src/stores/avisoStore';

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
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
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
  const [upFoto, setUpFoto] = useState(false);
  const [filhosBadge, setFilhosBadge] = useState<BadgeFoto[]>([]);

  useEffect(() => {
    let ativo = true;
    async function carregarFilhos() {
      if (!usuario || normalizarPerfil(usuario.perfil) !== 'usuario_pais') { setFilhosBadge([]); return; }
      const { data: vinculos } = await supabase
        .from('responsavel_membros')
        .select('membro_id')
        .eq('usuario_id', usuario.id)
        .eq('ativo', true);
      const ids = (vinculos ?? []).map((v: any) => v.membro_id).filter(Boolean);
      if (ids.length === 0) { if (ativo) setFilhosBadge([]); return; }
      const { data: filhos } = await supabase.from('desbravadores').select('nome, foto_url').in('id', ids);
      if (ativo) setFilhosBadge((filhos ?? []).map((f: any) => ({ nome: f.nome, foto_url: f.foto_url ?? null })));
    }
    carregarFilhos();
    return () => { ativo = false; };
  }, [usuario?.id, usuario?.perfil]);

  async function escolherFoto() {
    if (!usuario || upFoto) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      avisar('Autorize o acesso às fotos para trocar sua imagem de perfil.', 'info', 'Permissão necessária');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setUpFoto(true);
    try {
      const contentType = asset.mimeType || 'image/jpeg';
      const [body] = await uriParaUploadBodies(asset.uri, contentType);
      const ext = (asset.fileName ?? 'foto.jpg').split('.').pop() || 'jpg';
      const path = `responsaveis/${usuario.id}/foto_${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from('fotos_membros')
        .upload(path, body as any, { upsert: false, contentType });
      if (error) throw error;
      if (!data?.path) throw new Error('O servidor não retornou o caminho da foto.');
      const { data: urlData } = supabase.storage.from('fotos_membros').getPublicUrl(data.path);
      if (!urlData.publicUrl) throw new Error('O servidor não retornou a URL da foto.');

      const { error: dbError } = await supabase
        .from('usuarios')
        .update({ foto_url: urlData.publicUrl })
        .eq('id', usuario.id);
      if (dbError) throw dbError;

      atualizarUsuarioLocal({ ...usuario, foto_url: urlData.publicUrl });
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível trocar a foto.', 'erro', 'Erro');
    } finally {
      setUpFoto(false);
    }
  }

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
      if (!nome.trim()) { avisar('Informe seu nome de exibição.', 'info', 'Atenção'); return; }
      if (!email.trim()) { avisar('Informe seu e-mail.', 'info', 'Atenção'); return; }
    }
    if (senha && senha.length < 6) { avisar('A nova senha precisa ter pelo menos 6 caracteres.', 'info', 'Atenção'); return; }
    if (!senha.trim() && !podeEditarNomeEmail) { avisar('Informe a nova senha.', 'info', 'Atenção'); return; }

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
      avisar('Seus dados foram atualizados.', 'sucesso', 'Pronto');
    } catch (e: any) {
      avisar(e.message ?? 'Não foi possível salvar seus dados.', 'erro', 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
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
          <TouchableOpacity
            style={[s.cardUsuarioIcon, perfilNormalizado === 'usuario_pais' && s.cardUsuarioIconGrande]}
            onPress={perfilNormalizado === 'usuario_pais' ? escolherFoto : undefined}
            disabled={perfilNormalizado !== 'usuario_pais' || upFoto}
          >
            {usuarioAtual.foto_url ? (
              <Image
                source={{ uri: usuarioAtual.foto_url }}
                style={[s.cardUsuarioFoto, perfilNormalizado === 'usuario_pais' && s.cardUsuarioFotoGrande]}
              />
            ) : perfilNormalizado === 'usuario_pais' ? (
              <View style={[s.cardUsuarioFotoVazia, s.cardUsuarioFotoGrande, { backgroundColor: avatarCor(usuarioAtual.nome) }]}>
                <Text style={s.cardUsuarioFotoLetra}>{usuarioAtual.nome[0]?.toUpperCase()}</Text>
              </View>
            ) : (
              <Ionicons name="person-circle-outline" size={28} color="#1a3a5c" />
            )}
            {upFoto ? (
              <View style={s.cardUsuarioFotoOverlay}><ActivityIndicator color="#fff" size="small" /></View>
            ) : perfilNormalizado === 'usuario_pais' ? (
              <View style={s.cardUsuarioFotoEditIcon}>
                <Ionicons name="camera" size={11} color="#fff" />
              </View>
            ) : null}
            {perfilNormalizado === 'usuario_pais' && filhosBadge.length > 0 && (
              <AvatarBadge fotos={filhosBadge} size={72} />
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.cardUsuarioNome}>{usuarioAtual.nome}</Text>
            <Text style={s.cardUsuarioPerfil}>{rotuloPerfil}</Text>
            {perfilNormalizado === 'usuario_pais' && (
              <Text style={s.cardUsuarioFotoHint}>Toque na foto para alterar</Text>
            )}
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
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
  },
  cardUsuarioIconGrande: { width: 72, height: 72, borderRadius: 36 },
  cardUsuarioFoto: { width: 44, height: 44, borderRadius: 22 },
  cardUsuarioFotoGrande: { width: 72, height: 72, borderRadius: 36 },
  cardUsuarioFotoVazia: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardUsuarioFotoLetra: { color: '#fff', fontWeight: '900', fontSize: 18 },
  cardUsuarioFotoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  cardUsuarioFotoEditIcon: {
    position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  cardUsuarioFotoHint: { fontSize: 11, color: '#9aa5b1', marginTop: 3 },
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

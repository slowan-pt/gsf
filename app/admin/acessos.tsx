import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useDBVStore } from '../../src/stores/dbvStore';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import type { Perfil } from '../../src/types';
import { registrarAuditoria } from '../../src/lib/auditoria';

type PerfilAcesso = Perfil | 'sem_acesso';

interface UsuarioAcesso {
  id: string;
  user_id: string | null;
  email: string;
  nome: string;
  perfil: PerfilAcesso;
  dbv_id: number | null;
  unidade_id: number | null;
  dbv_nome?: string;
}

const PERFIS: Array<{ valor: PerfilAcesso; label: string; desc: string; icon: string; cor: string }> = [
  { valor: 'sem_acesso', label: 'Sem acesso', desc: 'Ainda sem login vinculado', icon: 'lock-closed', cor: '#78909c' },
  { valor: 'admin_ti', label: 'Admin TI', desc: 'Controle total da plataforma', icon: 'shield', cor: '#c0392b' },
  { valor: 'admin_clube', label: 'Admin clube', desc: 'Controle total do clube', icon: 'shield-checkmark', cor: '#e74c3c' },
  { valor: 'usuario_secretaria', label: 'Secretaria', desc: 'Membros, documentos e relatórios', icon: 'albums', cor: '#1565c0' },
  { valor: 'usuario_tesouraria', label: 'Tesouraria', desc: 'Financeiro e relatórios', icon: 'cash', cor: '#2e7d32' },
  { valor: 'usuario_diretoria', label: 'Diretoria', desc: 'Operação do clube', icon: 'star', cor: '#9b59b6' },
  { valor: 'usuario_conselheiro', label: 'Conselheiro', desc: 'Unidade e membros vinculados', icon: 'people', cor: '#00897b' },
  { valor: 'usuario_desbravador', label: 'Desbravador', desc: 'Acesso próprio DBV', icon: 'person', cor: '#2980b9' },
  { valor: 'usuario_aventureiro', label: 'Aventureiro', desc: 'Acesso próprio AVT', icon: 'leaf', cor: '#43a047' },
  { valor: 'usuario_pais', label: 'Pais/responsável', desc: 'Acesso aos filhos vinculados', icon: 'people-circle', cor: '#f57c00' },
  { valor: 'usuario_regional', label: 'Regional', desc: 'Acompanhamento regional', icon: 'map', cor: '#6d4c41' },
  { valor: 'usuario_distrital', label: 'Distrital', desc: 'Acompanhamento distrital', icon: 'navigate', cor: '#5e35b1' },
  { valor: 'usuario_pastor', label: 'Pastor', desc: 'Acompanhamento pastoral', icon: 'book', cor: '#455a64' },
  { valor: 'usuario_capelao', label: 'Capelão', desc: 'Capelania e atividades', icon: 'heart', cor: '#ad1457' },
];

const PERFIS_EDITAVEIS = PERFIS.filter((p) => p.valor !== 'sem_acesso') as Array<
  { valor: Exclude<PerfilAcesso, 'sem_acesso'>; label: string; desc: string; icon: string; cor: string }
>;

function perfilParaContexto(perfil: Exclude<PerfilAcesso, 'sem_acesso'>) {
  if (perfil === 'admin_total') return 'admin_ti';
  if (perfil === 'admin_geral') return 'admin_clube';
  if (perfil === 'admin_diretoria') return 'usuario_diretoria';
  if (perfil === 'desbravador') return getProgramaAtivoId() === 2 ? 'usuario_aventureiro' : 'usuario_desbravador';
  return perfil;
}

function normalizarPerfilAdmin(perfil?: string | null): Exclude<PerfilAcesso, 'sem_acesso'> | null {
  if (!perfil) return null;
  if (perfil === 'admin_total') return 'admin_ti';
  if (perfil === 'admin_geral') return 'admin_clube';
  if (perfil === 'admin_diretoria') return 'usuario_diretoria';
  if (perfil === 'desbravador') return getProgramaAtivoId() === 2 ? 'usuario_aventureiro' : 'usuario_desbravador';
  return perfil as Exclude<PerfilAcesso, 'sem_acesso'>;
}

export default function AdminAcessosScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const { desbravadores, carregar } = useDBVStore();
  const [usuarios, setUsuarios] = useState<UsuarioAcesso[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [modalUsuario, setModalUsuario] = useState<UsuarioAcesso | null>(null);
  const [buscaMembro, setBuscaMembro] = useState('');
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null);
  const [mfaConfirmandoId, setMfaConfirmandoId] = useState<string | null>(null);
  const [mfaMensagem, setMfaMensagem] = useState<{ userId: string; tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const podeGerenciar = permissoes.pode('gerenciar_acessos');

  useFocusEffect(useCallback(() => {
    carregarTudo();
  }, []));

  async function carregarTudo() {
    setCarregando(true);
    try {
      await carregar();
      const clubeId = getClubeAtivoId();
      const [{ data, error }, { data: membros, error: erroMembros }, { data: vinculos, error: erroVinculos }] = await Promise.all([
        supabase
        .from('usuarios')
        .select('id,email,nome,perfil,dbv_id,unidade_id')
          .order('nome'),
        supabase
          .from('desbravadores')
          .select('id,nome,email,unidade_id,unidade_nome')
          .eq('clube_id', clubeId)
          .order('nome'),
        supabase
          .from('usuario_clubes')
          .select('usuario_id,membro_id,perfil,unidade_id,ativo')
          .eq('clube_id', clubeId)
          .eq('ativo', true),
      ]);
      if (error) throw error;
      if (erroMembros) throw erroMembros;
      if (erroVinculos) throw erroVinculos;

      const membrosLista = (membros ?? []) as Array<{
        id: number; nome: string; email: string | null; unidade_id: number | null; unidade_nome: string | null;
      }>;
      const usuariosLista = (data ?? []) as Array<{
        id: string; email: string; nome: string; perfil: PerfilAcesso; dbv_id: number | null; unidade_id: number | null;
      }>;
      const vinculosPorUsuario = new Map((vinculos ?? []).map((v: any) => [String(v.usuario_id), v]));

      const porDbv = new Map<number, UsuarioAcesso>();
      const porEmail = new Map<string, UsuarioAcesso>();

      const normalizados: UsuarioAcesso[] = usuariosLista.map((u) => {
        const vinculo = vinculosPorUsuario.get(String(u.id));
        const perfilContexto = normalizarPerfilAdmin(vinculo?.perfil);
        const membroId = Number(vinculo?.membro_id ?? u.dbv_id) || null;
        const unidadeId = Number(vinculo?.unidade_id ?? u.unidade_id) || null;
        const membro = membrosLista.find((d) => d.id === membroId)
          ?? membrosLista.find((d) => d.email && u.email && d.email.toLowerCase() === u.email.toLowerCase());
        const item: UsuarioAcesso = {
          id: `user-${u.id}`,
          user_id: u.id,
          email: u.email,
          nome: membro?.nome || u.nome || u.email,
          perfil: perfilContexto ?? normalizarPerfilAdmin(u.perfil) ?? 'sem_acesso',
          dbv_id: membro?.id ?? membroId,
          unidade_id: membro?.unidade_id ?? unidadeId,
          dbv_nome: membro?.nome,
        };
        if (item.dbv_id) porDbv.set(item.dbv_id, item);
        if (item.email) porEmail.set(item.email.toLowerCase(), item);
        return item;
      });

      for (const m of membrosLista) {
        const jaExiste = porDbv.has(m.id) || (!!m.email && porEmail.has(m.email.toLowerCase()));
        if (jaExiste) continue;
        normalizados.push({
          id: `dbv-${m.id}`,
          user_id: null,
          email: m.email ?? '',
          nome: m.nome,
          perfil: 'sem_acesso',
          dbv_id: m.id,
          unidade_id: m.unidade_id,
          dbv_nome: m.nome,
        });
      }

      setUsuarios(normalizados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível carregar os acessos.');
    } finally {
      setCarregando(false);
    }
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      u.nome?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.dbv_nome?.toLowerCase().includes(q) ||
      (u.perfil === 'sem_acesso' && 'sem acesso'.includes(q)) ||
      u.perfil?.toLowerCase().includes(q)
    );
  }, [usuarios, busca]);

  const membrosFiltrados = useMemo(() => {
    const q = buscaMembro.trim().toLowerCase();
    return desbravadores.filter((d) =>
      !q || d.nome.toLowerCase().includes(q) || d.unidade_nome?.toLowerCase().includes(q)
    );
  }, [desbravadores, buscaMembro]);

  async function aplicarPerfil(u: UsuarioAcesso, perfil: Exclude<PerfilAcesso, 'sem_acesso'>, dbvId = u.dbv_id) {
    if (!u.user_id) {
      Alert.alert(
        'Sem login vinculado',
        'Este membro ainda não tem usuário de login. Abra o cadastro dele em Membros, informe e-mail e senha, salve, e depois ajuste o perfil aqui.'
      );
      return;
    }
    if (u.user_id === usuario?.id && perfil !== 'admin_ti' && permissoes.pode('admin_plataforma')) {
      Alert.alert('Ação bloqueada', 'Não remova seu próprio acesso de admin total por aqui.');
      return;
    }
    setSalvandoId(u.id);
    try {
      const clubeId = getClubeAtivoId();
      const { error } = await supabase.rpc('gerenciar_acesso_usuario', {
        target_user_id: u.user_id,
        novo_perfil: perfil,
        novo_dbv_id: dbvId,
        remover_acesso: false,
      });
      if (error) throw error;

      const membro = dbvId ? desbravadores.find((d) => d.id === dbvId) : null;
      const { data: vinculoExistente, error: erroVinculo } = await supabase
        .from('usuario_clubes')
        .select('id')
        .eq('usuario_id', u.user_id)
        .eq('clube_id', clubeId)
        .maybeSingle();
      if (erroVinculo) throw erroVinculo;

      const payload = {
        usuario_id: u.user_id,
        clube_id: clubeId,
        membro_id: dbvId ?? null,
        perfil: perfilParaContexto(perfil),
        unidade_id: membro?.unidade_id ?? u.unidade_id ?? null,
        ativo: true,
      };
      const resp = vinculoExistente?.id
        ? await supabase.from('usuario_clubes').update(payload).eq('id', vinculoExistente.id)
        : await supabase.from('usuario_clubes').insert(payload);
      if (resp.error) throw resp.error;

      await registrarAuditoria({
        acao: 'alterar_perfil_acesso',
        entidade: 'usuario_clubes',
        entidadeId: vinculoExistente?.id ?? u.user_id,
        membroId: dbvId ?? null,
        alvoUserId: u.user_id,
        antes: { perfil: u.perfil, dbv_id: u.dbv_id, unidade_id: u.unidade_id },
        depois: payload,
      });

      setDropdownAberto(null);
      await carregarTudo();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível alterar o acesso.');
    } finally {
      setSalvandoId(null);
    }
  }

  function confirmarRemoverAcesso(u: UsuarioAcesso) {
    if (!u.user_id) {
      Alert.alert('Sem acesso', 'Este membro ainda não tem login para remover.');
      return;
    }
    if (u.user_id === usuario?.id) {
      Alert.alert('Ação bloqueada', 'Você não pode remover seu próprio acesso enquanto está logado.');
      return;
    }
    Alert.alert(
      'Remover acesso',
      `Remover todas as permissões de login de ${u.nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setSalvandoId(u.id);
            try {
              const { error } = await supabase.rpc('gerenciar_acesso_usuario', {
                target_user_id: u.user_id,
                novo_perfil: getProgramaAtivoId() === 2 ? 'usuario_aventureiro' : 'usuario_desbravador',
                novo_dbv_id: null,
                remover_acesso: true,
              });
              if (error) throw error;
              await supabase
                .from('usuario_clubes')
                .update({ ativo: false })
                .eq('usuario_id', u.user_id)
                .eq('clube_id', getClubeAtivoId());
              await registrarAuditoria({
                acao: 'remover_acesso',
                entidade: 'usuarios',
                entidadeId: u.user_id,
                membroId: u.dbv_id ?? null,
                alvoUserId: u.user_id,
                antes: { perfil: u.perfil, dbv_id: u.dbv_id, unidade_id: u.unidade_id },
                depois: { removido: true },
              });
              await carregarTudo();
            } catch (e: any) {
              Alert.alert('Erro', e?.message ?? 'Não foi possível remover o acesso.');
            } finally {
              setSalvandoId(null);
            }
          },
        },
      ]
    );
  }

  async function executarResetMfa(u: UsuarioAcesso) {
    if (!u.user_id) return;
    setMfaConfirmandoId(null);
    setMfaMensagem(null);
    setSalvandoId(u.id);
    try {
      const { error } = await supabase.rpc('resetar_mfa_usuario', { target_user_id: u.user_id });
      if (error) throw error;
      await registrarAuditoria({
        acao: 'resetar_mfa',
        entidade: 'auth.mfa_factors',
        entidadeId: u.user_id,
        membroId: u.dbv_id ?? null,
        alvoUserId: u.user_id,
      });
      setMfaMensagem({ userId: u.id, tipo: 'ok', texto: 'MFA resetado com sucesso. No próximo login precisará configurar novamente.' });
    } catch (e: any) {
      setMfaMensagem({ userId: u.id, tipo: 'erro', texto: e?.message ?? 'Não foi possível resetar o MFA.' });
    } finally {
      setSalvandoId(null);
    }
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Administração</Text>
          <Text style={s.headerSub}>Acessos, perfis e MFA</Text>
        </View>
        <TouchableOpacity onPress={carregarTudo} style={s.iconBtn}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search" size={18} color="#78909c" />
        <TextInput
          style={s.searchInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar usuário, e-mail, membro ou perfil..."
          placeholderTextColor="#90a4ae"
        />
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.lista}>
          {filtrados.map((u) => {
            const perfil = PERFIS.find((p) => p.valor === u.perfil) ?? PERFIS[PERFIS.length - 1];
            const salvando = salvandoId === u.id;
            return (
              <View key={u.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.avatar, { backgroundColor: perfil.cor + '22' }]}>
                    <Ionicons name={perfil.icon as any} size={22} color={perfil.cor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nome}>{u.nome || u.email}</Text>
                    <Text style={s.email}>{u.email}</Text>
                    <Text style={[s.perfilAtual, { color: perfil.cor }]}>{perfil.label}</Text>
                    <Text style={s.vinculo}>{u.dbv_nome ? `Membro: ${u.dbv_nome}` : 'Sem membro vinculado'}</Text>
                  </View>
                  {salvando && <ActivityIndicator color="#1a3a5c" />}
                </View>

                <View style={s.dropdownWrap}>
                  <Text style={s.dropdownLabel}>Perfil de acesso</Text>
                  <TouchableOpacity
                    disabled={salvando}
                    onPress={() => setDropdownAberto(dropdownAberto === u.id ? null : u.id)}
                    style={s.dropdownBtn}
                  >
                    <View style={[s.dropdownIcon, { backgroundColor: perfil.cor + '22' }]}>
                      <Ionicons name={perfil.icon as any} size={16} color={perfil.cor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.dropdownText}>{perfil.label}</Text>
                      <Text style={s.dropdownDesc}>{perfil.desc}</Text>
                    </View>
                    <Ionicons name={dropdownAberto === u.id ? 'chevron-up' : 'chevron-down'} size={18} color="#607d8b" />
                  </TouchableOpacity>

                  {dropdownAberto === u.id && (
                    <View style={s.dropdownMenu}>
                      {PERFIS_EDITAVEIS.map((p) => {
                        const ativo = u.perfil === p.valor;
                        const bloqueado = p.valor === 'admin_ti' && !permissoes.pode('admin_plataforma');
                        return (
                          <TouchableOpacity
                            key={p.valor}
                            disabled={salvando || bloqueado}
                            onPress={() => aplicarPerfil(u, p.valor)}
                            style={[s.dropdownOption, ativo && { backgroundColor: p.cor + '14' }, bloqueado && s.disabled]}
                          >
                            <View style={[s.dropdownIcon, { backgroundColor: p.cor + '22' }]}>
                              <Ionicons name={p.icon as any} size={16} color={p.cor} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.optionTitle}>{p.label}</Text>
                              <Text style={s.optionDesc}>{p.desc}</Text>
                            </View>
                            {ativo && <Ionicons name="checkmark-circle" size={20} color={p.cor} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={s.acoes}>
                  <TouchableOpacity style={s.acaoBtn} onPress={() => { setModalUsuario(u); setBuscaMembro(''); }}>
                    <Ionicons name="link" size={15} color="#1a3a5c" />
                    <Text style={s.acaoText}>Vincular membro</Text>
                  </TouchableOpacity>
                  {u.user_id && (
                    mfaConfirmandoId === u.id ? (
                      <View style={s.mfaConfirmBox}>
                        <Text style={s.mfaConfirmTexto}>Remover Google Authenticator de {u.nome}?</Text>
                        <View style={s.mfaConfirmBotoes}>
                          <TouchableOpacity style={s.mfaConfirmCancelar} onPress={() => setMfaConfirmandoId(null)}>
                            <Text style={s.mfaConfirmCancelarText}>Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.mfaConfirmOk} onPress={() => executarResetMfa(u)} disabled={!!salvandoId}>
                            <Text style={s.mfaConfirmOkText}>Confirmar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View>
                        {mfaMensagem?.userId === u.id && (
                          <View style={[s.mfaMensagemBox, mfaMensagem.tipo === 'ok' ? s.mfaMensagemOk : s.mfaMensagemErro]}>
                            <Text style={[s.mfaMensagemText, { color: mfaMensagem.tipo === 'ok' ? '#2e7d32' : '#c62828' }]}>{mfaMensagem.texto}</Text>
                          </View>
                        )}
                        <TouchableOpacity style={[s.acaoBtn, s.mfaBtn]} onPress={() => { setMfaMensagem(null); setMfaConfirmandoId(u.id); }} disabled={!!salvandoId}>
                          <Ionicons name="key-outline" size={15} color="#7d4f00" />
                          <Text style={[s.acaoText, { color: '#7d4f00' }]}>Resetar MFA</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  )}
                  <TouchableOpacity style={[s.acaoBtn, s.removerBtn]} onPress={() => confirmarRemoverAcesso(u)} disabled={salvando}>
                    <Ionicons name="trash-outline" size={15} color="#c62828" />
                    <Text style={[s.acaoText, { color: '#c62828' }]}>Remover acesso</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!modalUsuario} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Vincular membro</Text>
            <TouchableOpacity onPress={() => setModalUsuario(null)}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={s.searchBox}>
            <Ionicons name="search" size={18} color="#78909c" />
            <TextInput
              style={s.searchInput}
              value={buscaMembro}
              onChangeText={setBuscaMembro}
              placeholder="Buscar membro..."
              placeholderTextColor="#90a4ae"
              autoFocus
            />
          </View>
          <FlatList
            data={membrosFiltrados}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 14, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.membroItem}
                onPress={async () => {
                  if (!modalUsuario) return;
                  const perfilAtual = modalUsuario.perfil === 'sem_acesso'
                    ? (getProgramaAtivoId() === 2 ? 'usuario_aventureiro' : 'usuario_desbravador')
                    : modalUsuario.perfil;
                  await aplicarPerfil(modalUsuario, perfilAtual, item.id);
                  setModalUsuario(null);
                }}
              >
                <View style={s.membroAvatar}><Text style={s.membroAvatarText}>{item.nome[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.membroNome}>{item.nome}</Text>
                  <Text style={s.membroUnidade}>{item.unidade_nome || 'Sem unidade'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#bbb" />
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingBottom: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { padding: 4 },
  iconBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  headerSub: { color: '#a8c8e8', marginTop: 2 },
  searchBox: { margin: 14, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 1 },
  searchInput: { flex: 1, color: '#222', fontSize: 14, outlineStyle: 'none' as any },
  lista: { padding: 14, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 16, fontWeight: '900', color: '#222' },
  email: { color: '#78909c', fontSize: 12, marginTop: 2 },
  perfilAtual: { fontSize: 12, fontWeight: '900', marginTop: 3 },
  vinculo: { color: '#666', fontSize: 12, marginTop: 3 },
  dropdownWrap: { gap: 7 },
  dropdownLabel: { color: '#607d8b', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  dropdownBtn: { borderWidth: 1, borderColor: '#dce5ec', backgroundColor: '#f9fbfd', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dropdownText: { color: '#1a3a5c', fontSize: 15, fontWeight: '900' },
  dropdownDesc: { color: '#78909c', fontSize: 12, marginTop: 1 },
  dropdownMenu: { borderWidth: 1, borderColor: '#dce5ec', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  dropdownOption: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#edf2f6' },
  optionTitle: { color: '#263238', fontWeight: '900' },
  optionDesc: { color: '#78909c', fontSize: 12, marginTop: 1 },
  disabled: { opacity: 0.4 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  acaoBtn: { backgroundColor: '#eef3f8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  mfaBtn: { backgroundColor: '#fff7e6', borderWidth: 1, borderColor: '#ffd58a' },
  mfaConfirmBox: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffb74d', borderRadius: 8, padding: 10, gap: 8, marginVertical: 4 },
  mfaConfirmTexto: { color: '#5d3200', fontSize: 12, lineHeight: 17 },
  mfaConfirmBotoes: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  mfaConfirmCancelar: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#bbb', backgroundColor: '#f5f5f5' },
  mfaConfirmCancelarText: { color: '#555', fontWeight: '700', fontSize: 12 },
  mfaConfirmOk: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#c62828' },
  mfaConfirmOkText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  mfaMensagemBox: { padding: 8, borderRadius: 6, marginBottom: 4, borderWidth: 1 },
  mfaMensagemOk: { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' },
  mfaMensagemErro: { backgroundColor: '#ffebee', borderColor: '#ef9a9a' },
  mfaMensagemText: { fontSize: 11, fontWeight: '600', lineHeight: 16 },
  removerBtn: { backgroundColor: '#fff0f0', borderWidth: 1, borderColor: '#ffc7c7' },
  acaoText: { color: '#1a3a5c', fontWeight: '800', fontSize: 12 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#1a3a5c', fontSize: 18, fontWeight: '900' },
  membroItem: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  membroAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center' },
  membroAvatarText: { color: '#fff', fontWeight: '900' },
  membroNome: { color: '#222', fontWeight: '800' },
  membroUnidade: { color: '#78909c', fontSize: 12 },
});

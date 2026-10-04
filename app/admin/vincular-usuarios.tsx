import { EstadoVazio, CampoBusca } from '../../src/components/ui';
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal, FlatList, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useDBVStore } from '../../src/stores/dbvStore';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { combinaBusca } from '../../src/lib/texto';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, tomTexto, corLegivel } from '../../src/lib/tema';
import { CabecalhoTela, BotaoCabecalho } from '../../src/components/CabecalhoTela';

interface UsuarioRow {
  id: string;
  email: string;
  nome: string;
  perfil: string;
  dbv_id: number | null;
  dbv_nome?: string;
}

interface Dbv {
  id: number;
  nome: string;
  unidade_nome: string;
}

function labelPerfil(perfil: string) {
  if (perfil === 'admin_total') return 'admin total';
  if (perfil === 'admin_geral') return 'admin diretoria';
  if (perfil === 'admin_diretoria') return 'diretoria';
  return perfil.replace('_', ' ');
}

export default function VincularUsuariosScreen() {
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
  const usuarioLogado = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const [usuarios, setUsuarios]     = useState<UsuarioRow[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando]     = useState<string | null>(null);
  const podeResetarMfa = permissoes.pode('gerenciar_acessos');

  const [desvinculandoId, setDesvinculandoId]   = useState<string | null>(null);
  const [mfaConfirmandoId, setMfaConfirmandoId] = useState<string | null>(null);
  const [mfaMensagem, setMfaMensagem] = useState<{ userId: string; tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  // Modal de seleção de desbravador
  const [modalUsuario, setModalUsuario] = useState<UsuarioRow | null>(null);
  const [busca, setBusca]               = useState('');

  const { desbravadores, carregar: carregarDesbravadores } = useDBVStore();

  useFocusEffect(
    useCallback(() => {
      carregarTudo();
    }, [])
  );

  async function carregarTudo() {
    setCarregando(true);
    try {
      await carregarDesbravadores();

      const { data, error } = await supabase
        .from('usuarios')
        .select('id, email, nome, perfil, dbv_id');

      if (error) throw error;

      const enriquecidos: UsuarioRow[] = (data ?? []).map((u) => {
        const dbv = desbravadores.find((d) => d.id === u.dbv_id);
        return { ...u, dbv_nome: dbv?.nome };
      });

      setUsuarios(enriquecidos);
    } catch (e: any) {
      setErroGeral(e.message ?? 'Não foi possível carregar usuários');
    } finally {
      setCarregando(false);
    }
  }

  async function vincular(usuario_id: string, dbv: Dbv) {
    setSalvando(usuario_id);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ dbv_id: dbv.id })
        .eq('id', usuario_id);

      if (error) throw error;

      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === usuario_id
            ? { ...u, dbv_id: dbv.id, dbv_nome: dbv.nome }
            : u
        )
      );
      setModalUsuario(null);
    } catch (e: any) {
      setErroGeral(e.message ?? 'Não foi possível vincular');
    } finally {
      setSalvando(null);
    }
  }

  async function confirmarDesvincular(usuario_id: string) {
    setDesvinculandoId(null);
    setSalvando(usuario_id);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ dbv_id: null })
        .eq('id', usuario_id);

      if (error) throw error;

      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === usuario_id ? { ...u, dbv_id: null, dbv_nome: undefined } : u
        )
      );
    } catch (e: any) {
      setErroGeral(e.message ?? 'Não foi possível remover o vínculo.');
    } finally {
      setSalvando(null);
    }
  }

  async function executarResetMfa(usuario: UsuarioRow) {
    setMfaConfirmandoId(null);
    setMfaMensagem(null);
    setSalvando(usuario.id);
    try {
      const { error } = await supabase.rpc('resetar_mfa_usuario', {
        target_user_id: usuario.id,
      });
      if (error) throw error;
      setMfaMensagem({ userId: usuario.id, tipo: 'ok', texto: 'MFA resetado com sucesso. No próximo login o usuário precisará configurar novamente.' });
    } catch (e: any) {
      setMfaMensagem({ userId: usuario.id, tipo: 'erro', texto: e?.message ?? 'Não foi possível resetar o MFA.' });
    } finally {
      setSalvando(null);
    }
  }

  const dbvsFiltrados = desbravadores.filter((d) =>
    combinaBusca(d.nome, busca) ||
    combinaBusca(d.unidade_nome, busca)
  );

  // Ícone por perfil
  function iconePerfil(perfil: string) {
    if (perfil === 'admin_total')     return { icon: 'shield',           cor: '#c0392b' };
    if (perfil === 'admin_geral')     return { icon: 'shield-checkmark', cor: '#e74c3c' };
    if (perfil === 'admin_diretoria') return { icon: 'star',             cor: '#9b59b6' };
    return                                   { icon: 'person',           cor: '#2980b9' };
  }

  const naoVinculados = usuarios.filter((u) => !u.dbv_id).length;

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      {/* Header */}
      <CabecalhoTela titulo="Vincular Usuários"
        acoes={<>
          <BotaoCabecalho icone="refresh" onPress={carregarTudo} rotulo="Atualizar" />
        </>}
      />

      {/* Legenda */}
      <View style={[s.legenda, cores.isEscuro && { backgroundColor: '#413e46' }]}>
        <Text style={[s.legendaText, cores.isEscuro && { color: '#f5d97a' }, cores.isEscuro && { color: '#f5d97a' }]}>
          🔗 Vincule cada usuário ao seu desbravador para que ele possa gerenciar as próprias fotos e documentos.
        </Text>
      </View>

      {erroGeral && (
        <View style={[s.mfaMensagemBox, s.mfaMensagemErro]}>
          <Text style={[s.mfaMensagemText, cores.isEscuro && { color: '#ececf3' }]}>{erroGeral}</Text>
          <TouchableOpacity onPress={() => setErroGeral(null)} style={{ marginTop: 6 }}>
            <Text style={{ color: tomTexto('#c0392b', cores), fontWeight: '700', fontSize: 13 }}>Fechar</Text>
          </TouchableOpacity>
        </View>
      )}

      {carregando ? (
        <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {usuarios.map((u) => {
            const { icon, cor } = iconePerfil(u.perfil);
            const estaSalvando  = salvando === u.id;
            const vinculado     = !!u.dbv_id;

            return (
              <View key={u.id} style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }, vinculado ? s.cardOk : s.cardPendente]}>
                {/* Linha principal */}
                <View style={s.cardTop}>
                  <View style={[s.perfilIcon, { backgroundColor: cor + '22' }]}>
                    <Ionicons name={icon as any} size={20} color={corLegivel(cor, cores, 3)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nomeUsuario, cores.isEscuro && { color: '#f1eefc' }, { color: cores.texto }]}>{u.nome}</Text>
                    <Text style={[s.emailUsuario, cores.isEscuro && { color: '#c4c4d2' }, { color: cores.textoSecundario }]}>{u.email}</Text>
                    <Text style={[s.perfilLabel, { color: corLegivel(cor, cores) }]}>
                      {labelPerfil(u.perfil)}
                    </Text>
                  </View>
                  {estaSalvando ? (
                    <ActivityIndicator size="small" color={corIcone(cores)} />
                  ) : (
                    <View style={s.statusBadge}>
                      <Ionicons
                        name={vinculado ? 'checkmark-circle' : 'alert-circle'}
                        size={20}
                        color={vinculado ? '#27ae60' : '#e67e22'}
                      />
                    </View>
                  )}
                </View>

                {/* Vínculo atual */}
                <View style={[s.vinculoRow, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
                  <Ionicons name="link" size={14} color={cores.textoSecundario} />
                  <Text style={[s.vinculoText, cores.isEscuro && { color: '#d4d4de' }, { color: cores.textoSecundario }, !vinculado && { color: '#e67e22' }]}>
                    {vinculado ? u.dbv_nome ?? `Desbravador #${u.dbv_id}` : 'Sem vínculo'}
                  </Text>
                </View>

                {/* Ações */}
                <View style={s.acoes}>
                  <TouchableOpacity
                    style={[s.btnAcao, s.btnVincular]}
                    onPress={() => { setModalUsuario(u); setBusca(''); }}
                    disabled={estaSalvando}
                  >
                    <Ionicons name="person-add" size={14} color="#fff" />
                    <Text style={s.btnAcaoText}>
                      {vinculado ? 'Trocar vínculo' : 'Vincular'}
                    </Text>
                  </TouchableOpacity>

                  {vinculado && desvinculandoId !== u.id && (
                    <TouchableOpacity
                      style={[s.btnAcao, s.btnDesvincular, cores.isEscuro && { backgroundColor: '#3a1c24', borderColor: '#5c2a35' }]}
                      onPress={() => setDesvinculandoId(u.id)}
                      disabled={estaSalvando}
                    >
                      <Ionicons name="unlink" size={14} color={cores.isEscuro ? '#ff9b9b' : '#c0392b'} />
                      <Text style={[s.btnAcaoText, { color: cores.isEscuro ? '#ff9b9b' : '#c0392b' }]}>Remover</Text>
                    </TouchableOpacity>
                  )}

                  {podeResetarMfa && u.id !== usuarioLogado?.id && mfaConfirmandoId !== u.id && (
                    <TouchableOpacity
                      style={[s.btnAcao, s.btnMfa]}
                      onPress={() => { setMfaConfirmandoId(u.id); setMfaMensagem(null); }}
                      disabled={estaSalvando}
                    >
                      <Ionicons name="key-outline" size={14} color={tomTexto('#7d4f00', cores)} />
                      <Text style={[s.btnAcaoText, { color: '#7d4f00' }]}>Resetar MFA</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Confirmação de desvincular */}
                {desvinculandoId === u.id && (
                  <View style={[s.confirmBox, cores.isEscuro && { backgroundColor: '#413d47', borderColor: '#322c52' }]}>
                    <Text style={[s.confirmTexto, cores.isEscuro && { color: '#c6b18f' }, cores.isEscuro && { color: '#c6b18f' }]}>Remover a vinculação de {u.nome}?</Text>
                    <View style={s.confirmBotoes}>
                      <TouchableOpacity style={[s.confirmCancelar, cores.isEscuro && { backgroundColor: '#1d1932' }]} onPress={() => setDesvinculandoId(null)}>
                        <Text style={[s.confirmCancelarText, cores.isEscuro && { color: '#d4d4de' }]}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.confirmOk} onPress={() => confirmarDesvincular(u.id)}>
                        <Text style={s.confirmOkText}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Confirmação de reset MFA */}
                {mfaConfirmandoId === u.id && (
                  <View style={[s.confirmBox, cores.isEscuro && { backgroundColor: '#413d47', borderColor: '#322c52' }]}>
                    <Text style={[s.confirmTexto, cores.isEscuro && { color: '#c6b18f' }, cores.isEscuro && { color: '#c6b18f' }]}>
                      Remover o Google Authenticator de {u.nome}?{'\n'}No próximo login ele precisará configurar novamente.
                    </Text>
                    <View style={s.confirmBotoes}>
                      <TouchableOpacity style={[s.confirmCancelar, cores.isEscuro && { backgroundColor: '#1d1932' }]} onPress={() => setMfaConfirmandoId(null)}>
                        <Text style={[s.confirmCancelarText, cores.isEscuro && { color: '#d4d4de' }]}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.confirmOk} onPress={() => executarResetMfa(u)}>
                        <Text style={s.confirmOkText}>Confirmar reset</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Mensagem resultado MFA */}
                {mfaMensagem?.userId === u.id && (
                  <View style={[s.mfaMensagemBox, mfaMensagem.tipo === 'ok' ? [s.mfaMensagemOk, cores.isEscuro && { backgroundColor: '#1d1932' }] : [s.mfaMensagemErro, cores.isEscuro && { backgroundColor: '#413b48', borderColor: '#322c52' }]]}>
                    <Text style={[s.mfaMensagemText, cores.isEscuro && { color: '#ececf3' }]}>{mfaMensagem.texto}</Text>
                  </View>
                )}
              </View>
            );
          })}

          {usuarios.length === 0 && (
            <EstadoVazio titulo="Nenhum usuário encontrado." />
          )}
        </ScrollView>
      )}

      {/* Modal de seleção de desbravador */}
      <Modal visible={!!modalUsuario} animationType="slide" presentationStyle="pageSheet">
        <View style={[s.modal, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
          <View style={[s.modalHeader, cores.isEscuro && { borderBottomColor: '#322c52' }, { borderBottomColor: cores.borda }]}>
            <Text style={[s.modalTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Selecionar Desbravador</Text>
            <TouchableOpacity onPress={() => setModalUsuario(null)}>
              <Ionicons name="close" size={26} color={cores.texto} />
            </TouchableOpacity>
          </View>

          {modalUsuario && (
            <View style={[s.modalSubHeader, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
              <Ionicons name="person-circle-outline" size={18} color={cores.textoSecundario} />
              <Text style={[s.modalSubText, cores.isEscuro && { color: '#d4d4de' }, { color: cores.textoSecundario }]}>
                Vinculando: <Text style={{ fontWeight: '700' }}>{modalUsuario.nome}</Text>
              </Text>
            </View>
          )}

          <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
            <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar nome ou unidade..." />
          </View>

          <FlatList
            data={dbvsFiltrados}
            keyExtractor={(d) => String(d.id)}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item: dbv }) => {
              const jaVinculado = usuarios.some(
                (u) => u.dbv_id === dbv.id && u.id !== modalUsuario?.id
              );
              return (
                <TouchableOpacity
                  style={[s.dbvItem, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }, jaVinculado && s.dbvItemOcupado]}
                  onPress={() => modalUsuario && !jaVinculado && vincular(modalUsuario.id, dbv)}
                  disabled={jaVinculado}
                  activeOpacity={0.7}
                >
                  <View style={s.dbvAvatar}>
                    <Text style={s.dbvAvatarText}>{dbv.nome[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.dbvNome, cores.isEscuro && { color: '#f1eefc' }, { color: cores.texto }, jaVinculado && { color: cores.textoSecundario }]}>{dbv.nome}</Text>
                    <Text style={[s.dbvUnidade, cores.isEscuro && { color: '#c4c4d2' }, { color: cores.textoSecundario }]}>{dbv.unidade_nome ?? 'Sem unidade'}</Text>
                  </View>
                  {jaVinculado ? (
                    <View style={[s.ocupadoBadge, cores.isEscuro && { backgroundColor: '#1d1932' }]}>
                      <Text style={s.ocupadoText}>Vinculado</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={cores.textoSecundario} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <EstadoVazio titulo="Nenhum desbravador encontrado." />
            }
          />
        </View>
      </Modal>
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f5f3fb' },

  header:         { backgroundColor: '#4b2bb0', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back:           { padding: 4 },
  headerTitle:    { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:      { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  refreshBtn:     { padding: 6 },

  legenda:        { backgroundColor: '#fff8e1', padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#f39c12' },
  legendaText:    { fontSize: 12, color: '#7d6608', lineHeight: 18 },

  card:           { backgroundColor: '#fff', borderRadius: 18, padding: 14, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)', borderLeftWidth: 4 },
  cardOk:         { borderLeftColor: '#27ae60' },
  cardPendente:   { borderLeftColor: '#e67e22' },

  cardTop:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  perfilIcon:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  nomeUsuario:    { fontSize: 15, fontWeight: '700', color: '#222' },
  emailUsuario:   { fontSize: 12, color: '#888', marginTop: 1 },
  perfilLabel:    { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  statusBadge:    { padding: 4 },

  vinculoRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8f9fa', padding: 8, borderRadius: 8, marginBottom: 10 },
  vinculoText:    { fontSize: 13, color: '#555', fontWeight: '500' },

  acoes:          { flexDirection: 'row', gap: 8 },
  btnAcao:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnVincular:    { backgroundColor: '#4b2bb0' },
  btnDesvincular: { backgroundColor: '#fef0f0', borderWidth: 1, borderColor: '#fcc' },
  btnMfa:         { backgroundColor: '#fff7e6', borderWidth: 1, borderColor: '#ffd58a' },
  btnAcaoText:    { color: '#fff', fontSize: 13, fontWeight: '600' },

  vazio:          { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 },

  // Modal
  modal:          { flex: 1, backgroundColor: '#fff' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitulo:    { fontSize: 18, fontWeight: '800', color: '#4b2bb0' },
  modalSubHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f5f3fb' },
  modalSubText:   { fontSize: 13, color: '#555' },

  buscaRow:       { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: '#f8f9fa', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#eee' },
  buscaInput:     { flex: 1, fontSize: 14, color: '#333' },

  dbvItem:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 18, padding: 12, gap: 12 },
  dbvItemOcupado: { opacity: 0.5 },
  dbvAvatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4b2bb0', justifyContent: 'center', alignItems: 'center' },
  dbvAvatarText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  dbvNome:        { fontSize: 14, fontWeight: '600', color: '#222' },
  dbvUnidade:     { fontSize: 12, color: '#888', marginTop: 2 },
  ocupadoBadge:   { backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ocupadoText:    { fontSize: 11, color: '#27ae60', fontWeight: '600' },

  confirmBox:          { backgroundColor: '#fff7e6', borderRadius: 18, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#ffd58a' },
  confirmTexto:        { fontSize: 13, color: '#7d4f00', marginBottom: 10, lineHeight: 18 },
  confirmBotoes:       { flexDirection: 'row', gap: 8 },
  confirmCancelar:     { flex: 1, paddingVertical: 8, borderRadius: 22, backgroundColor: '#eee', alignItems: 'center' },
  confirmCancelarText: { fontSize: 13, color: '#555', fontWeight: '600' },
  confirmOk:           { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e74c3c', alignItems: 'center' },
  confirmOkText:       { fontSize: 13, color: '#fff', fontWeight: '700' },

  mfaMensagemBox:  { borderRadius: 8, padding: 10, marginTop: 8 },
  mfaMensagemOk:   { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#a8d5b5' },
  mfaMensagemErro: { backgroundColor: '#fdecea', borderWidth: 1, borderColor: '#f5c6cb' },
  mfaMensagemText: { fontSize: 13, color: '#333', lineHeight: 18 },
});

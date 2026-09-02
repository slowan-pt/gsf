import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { combinaBusca } from '../../src/lib/texto';

interface LinkPreCadastro {
  id: string;
  token: string;
  titulo: string | null;
  ativo: boolean;
}

interface PreCadastro {
  id: string;
  clube_id: number;
  nome: string;
  data_nascimento: string | null;
  genero: string | null;
  email: string | null;
  contato: string | null;
  camisa: string | null;
  calca: string | null;
  nome_responsavel: string | null;
  email_responsavel: string | null;
  contato_responsavel: string | null;
  parentesco_responsavel: string | null;
  status: string;
  convertido_membro_id?: number | null;
  created_at: string;
}

interface PreCadastroResponsavel {
  id: string;
  pre_cadastro_id: string;
  clube_id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  parentesco: string | null;
  responsavel_principal: boolean | null;
  usuario_id: string | null;
}

interface ClubeInfo {
  id: number;
  programa_id: number;
  programa_codigo: string;
}

export default function PreCadastrosAdminScreen() {
  const permissoes = usePermissoes();
  const [links, setLinks] = useState<LinkPreCadastro[]>([]);
  const [lista, setLista] = useState<PreCadastro[]>([]);
  const [responsaveisPorPre, setResponsaveisPorPre] = useState<Record<string, PreCadastroResponsavel[]>>({});
  const [clubeInfo, setClubeInfo] = useState<ClubeInfo | null>(null);
  const [busca, setBusca] = useState('');
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const podeGerenciar = permissoes.pode('gerenciar_membros') || permissoes.pode('admin_clube');

  useFocusEffect(useCallback(() => { carregar(); }, []));

  async function carregar() {
    const clubeId = getClubeAtivoId();
    const [{ data: linksData }, { data: pres }, { data: respData }, { data: clube }] = await Promise.all([
      supabase.from('pre_cadastro_links').select('*').eq('clube_id', clubeId).order('created_at', { ascending: false }),
      supabase.from('pre_cadastros').select('*').eq('clube_id', clubeId).order('created_at', { ascending: false }),
      supabase
        .from('pre_cadastro_responsaveis')
        .select('*')
        .eq('clube_id', clubeId)
        .order('responsavel_principal', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase.from('clubes').select('id,programa_id,programas(codigo)').eq('id', clubeId).maybeSingle(),
    ]);
    setLinks((linksData ?? []) as LinkPreCadastro[]);
    setLista((pres ?? []) as PreCadastro[]);
    const mapa: Record<string, PreCadastroResponsavel[]> = {};
    for (const r of (respData ?? []) as PreCadastroResponsavel[]) {
      mapa[r.pre_cadastro_id] = [...(mapa[r.pre_cadastro_id] ?? []), r];
    }
    setResponsaveisPorPre(mapa);
    setClubeInfo(clube ? {
      id: (clube as any).id,
      programa_id: (clube as any).programa_id,
      programa_codigo: (clube as any).programas?.codigo ?? 'desbravadores',
    } : null);
  }

  async function copiar(link: string) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      Alert.alert('Link copiado', 'O link foi copiado para a área de transferência.');
      return;
    }
    Alert.alert('Link de pré-cadastro', link);
  }

  const filtrados = useMemo(() => {
    const t = busca.trim();
    if (!t) return lista;
    return lista.filter((p) =>
      combinaBusca(p.nome, t) ||
      combinaBusca(p.email, t) ||
      combinaBusca(p.contato, t) ||
      combinaBusca(p.nome_responsavel, t)
    );
  }, [lista, busca]);

  function calcularIdade(data?: string | null) {
    if (!data) return null;
    const nasc = new Date(`${data}T00:00:00`);
    if (Number.isNaN(nasc.getTime())) return null;
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
  }

  function senhaTemporaria() {
    return `Fonseca@${Math.floor(100000 + Math.random() * 900000)}`;
  }

  function perfilMembroPorPrograma() {
    return clubeInfo?.programa_codigo === 'aventureiros' ? 'usuario_aventureiro' : 'usuario_desbravador';
  }

  function responsaveisDoPre(pre: PreCadastro) {
    const novos = responsaveisPorPre[pre.id] ?? [];
    if (novos.length > 0) return novos;
    if (!pre.nome_responsavel && !pre.email_responsavel && !pre.contato_responsavel) return [];
    return [{
      id: `legacy-${pre.id}`,
      pre_cadastro_id: pre.id,
      clube_id: pre.clube_id,
      nome: pre.nome_responsavel || 'Responsável',
      email: pre.email_responsavel,
      telefone: pre.contato_responsavel,
      parentesco: pre.parentesco_responsavel || 'Responsável',
      responsavel_principal: true,
      usuario_id: null,
    }] as PreCadastroResponsavel[];
  }

  async function restaurarSessaoAtual(sessaoAtual: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']) {
    if (sessaoAtual.session) {
      await supabase.auth.setSession({
        access_token: sessaoAtual.session.access_token,
        refresh_token: sessaoAtual.session.refresh_token,
      });
    }
  }

  async function criarOuAtualizarUsuario(params: {
    email: string;
    senha: string;
    nome: string;
    perfil: string;
    dbvId?: number | null;
    unidadeId?: number | null;
  }) {
    const email = params.email.trim().toLowerCase();
    if (!email) return { userId: null as string | null, senha: null as string | null };

    let { data: existente } = await supabase
      .from('usuarios')
      .select('id,email,nome,perfil')
      .eq('email', email)
      .maybeSingle();

    let userId = existente?.id as string | undefined;

    if (!userId) {
      const { data: sessaoAtual } = await supabase.auth.getSession();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: params.senha,
        options: {
          data: {
            nome: params.nome || email.split('@')[0],
            perfil: params.perfil,
            dbv_id: params.dbvId ?? null,
            unidade_id: params.unidadeId ?? null,
          },
          emailRedirectTo: 'https://dbv-fonseca.pages.dev/auth/login',
        },
      });

      await restaurarSessaoAtual(sessaoAtual);

      if (error) throw error;
      userId = data.user?.id;
      if (!userId) throw new Error('Não foi possível criar o usuário.');

      await supabase.from('usuarios').upsert({
        id: userId,
        email,
        nome: params.nome || email.split('@')[0],
        perfil: params.perfil,
        dbv_id: params.dbvId ?? null,
        unidade_id: params.unidadeId ?? null,
      });
      return { userId, senha: params.senha };
    }

    const perfilAtual = String(existente?.perfil || '');
    const perfilFinal = ['admin_ti', 'admin_clube', 'admin_total'].includes(perfilAtual) ? perfilAtual : params.perfil;
    const { error: erroUpdate } = await supabase.from('usuarios').update({
      email,
      nome: params.nome || existente?.nome || email.split('@')[0],
      perfil: perfilFinal,
      dbv_id: params.dbvId ?? null,
      unidade_id: params.unidadeId ?? null,
    }).eq('id', userId);
    if (erroUpdate) throw erroUpdate;

    return { userId, senha: null as string | null };
  }

  async function sincronizarVinculoClube(userId: string, pre: PreCadastro, membroId: number, unidadeId: number | null, perfil: string) {
    const { data: existente, error: erroBusca } = await supabase
      .from('usuario_clubes')
      .select('id')
      .eq('usuario_id', userId)
      .eq('clube_id', pre.clube_id)
      .maybeSingle();
    if (erroBusca) throw erroBusca;

    const payload = {
      usuario_id: userId,
      clube_id: pre.clube_id,
      membro_id: membroId,
      unidade_id: unidadeId,
      perfil,
      ativo: true,
    };
    const resp = existente?.id
      ? await supabase.from('usuario_clubes').update(payload).eq('id', existente.id)
      : await supabase.from('usuario_clubes').insert(payload);
    if (resp.error) throw resp.error;
  }

  async function criarOuVincularMembro(pre: PreCadastro, membroId: number, unidadeId: number | null, senha: string) {
    const email = String(pre.email || '').trim().toLowerCase();
    if (!email) return { userId: null as string | null, senha: null as string | null };
    const perfil = perfilMembroPorPrograma();
    const resp = await criarOuAtualizarUsuario({
      email,
      senha,
      nome: pre.nome,
      perfil,
      dbvId: membroId,
      unidadeId,
    });
    if (resp.userId) await sincronizarVinculoClube(resp.userId, pre, membroId, unidadeId, perfil);
    return resp;
  }

  async function criarOuVincularResponsavel(pre: PreCadastro, responsavel: PreCadastroResponsavel, membroId: number, programaId: number, senha: string) {
    const email = String(responsavel.email || '').trim().toLowerCase();
    if (!email) return { userId: null as string | null, senha: null as string | null };

    const resp = await criarOuAtualizarUsuario({
      email,
      senha,
      nome: responsavel.nome || email.split('@')[0],
      perfil: 'usuario_pais',
      dbvId: null,
      unidadeId: null,
    });

    if (!resp.userId) return resp;

    if (!String(responsavel.id).startsWith('legacy-')) {
      await supabase.from('pre_cadastro_responsaveis').update({ usuario_id: resp.userId }).eq('id', responsavel.id);
    }

    const { error: erroRespMembro } = await supabase.from('responsavel_membros').upsert({
      usuario_id: resp.userId,
      membro_id: membroId,
      clube_id: pre.clube_id,
      programa_id: programaId,
      parentesco: responsavel.parentesco || 'Responsável',
      responsavel_principal: !!responsavel.responsavel_principal,
      pode_visualizar: true,
      pode_visualizar_documentos: false,
      pode_enviar_documentos: true,
      pode_responder_atividades: true,
      ativo: true,
    }, { onConflict: 'usuario_id,membro_id' });
    if (erroRespMembro) throw erroRespMembro;

    return resp;
  }

  async function aprovar(pre: PreCadastro) {
    if (pre.status === 'convertido') {
      Alert.alert('Pré-cadastro', 'Este pré-cadastro já foi convertido em membro.');
      return;
    }
    if (!clubeInfo) {
      Alert.alert('Erro', 'Não foi possível identificar o clube atual.');
      return;
    }

    const senha = senhaTemporaria();
    setProcessandoId(pre.id);
    try {
      const idade = calcularIdade(pre.data_nascimento);
      const cargo = clubeInfo.programa_codigo === 'aventureiros' ? 'Aventureiro' : 'Desbravador';
      const { data: maxRow } = await supabase
        .from('desbravadores')
        .select('idx')
        .eq('clube_id', pre.clube_id)
        .order('idx', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: membro, error: erroMembro } = await supabase
        .from('desbravadores')
        .insert({
          clube_id: pre.clube_id,
          idx: Number((maxRow as any)?.idx || 0) + 1,
          nome: pre.nome,
          data_nascimento: pre.data_nascimento || null,
          idade,
          genero: pre.genero || null,
          cargo,
          contato: pre.contato || null,
          email: pre.email || null,
          camisa: pre.camisa || null,
          calca: pre.calca || null,
          nome_responsavel: pre.nome_responsavel || null,
          contato_responsavel: pre.contato_responsavel || null,
        })
        .select('id')
        .single();

      if (erroMembro) throw erroMembro;
      const membroId = (membro as any).id as number;

      await Promise.all([
        supabase.from('documentos').insert({ dbv_id: membroId, clube_id: pre.clube_id }),
        supabase.from('progresso_classes').insert({ dbv_id: membroId, clube_id: pre.clube_id }),
      ]);

      const senhaMembro = senhaTemporaria();
      const loginMembro = await criarOuVincularMembro(pre, membroId, null, senhaMembro);
      const responsaveis = responsaveisDoPre(pre);
      const loginsResponsaveis = [];
      let primeiroResponsavelUserId: string | null = null;
      for (const responsavel of responsaveis) {
        const loginResp = await criarOuVincularResponsavel(pre, responsavel, membroId, clubeInfo.programa_id, senhaTemporaria());
        if (!primeiroResponsavelUserId && loginResp.userId) primeiroResponsavelUserId = loginResp.userId;
        if (loginResp.userId && loginResp.senha) {
          loginsResponsaveis.push({ email: responsavel.email, senha: loginResp.senha, nome: responsavel.nome });
        }
      }
      const { data: sessao } = await supabase.auth.getSession();
      await supabase.from('pre_cadastros').update({
        status: 'convertido',
        convertido_membro_id: membroId,
        responsavel_usuario_id: primeiroResponsavelUserId,
        aprovado_por: sessao.session?.user.id ?? null,
        aprovado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', pre.id);

      await carregar();
      const credenciais = [
        loginMembro.senha ? `Membro: ${pre.email}\nSenha: ${loginMembro.senha}` : null,
        ...loginsResponsaveis.map((r) => `${r.nome}: ${r.email}\nSenha: ${r.senha}`),
      ].filter(Boolean);
      Alert.alert(
        'Pré-cadastro aprovado',
        credenciais.length
          ? `Membro criado e responsáveis vinculados.\n\nCredenciais temporárias:\n\n${credenciais.join('\n\n')}`
          : 'Membro criado e responsáveis vinculados.'
      );
    } catch (e: any) {
      Alert.alert('Erro ao aprovar', e?.message ?? 'Não foi possível aprovar este pré-cadastro.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function rejeitar(pre: PreCadastro) {
    Alert.alert('Rejeitar pré-cadastro', `Deseja rejeitar o pré-cadastro de ${pre.nome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rejeitar',
        style: 'destructive',
        onPress: async () => {
          setProcessandoId(pre.id);
          try {
            const { data: sessao } = await supabase.auth.getSession();
            await supabase.from('pre_cadastros').update({
              status: 'rejeitado',
              rejeitado_por: sessao.session?.user.id ?? null,
              rejeitado_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', pre.id);
            await carregar();
          } finally {
            setProcessandoId(null);
          }
        },
      },
    ]);
  }

  if (!podeGerenciar) {
    return (
      <View style={s.container}>
        <View style={s.center}>
          <Ionicons name="lock-closed" size={48} color="#bbb" />
          <Text style={s.centerText}>Pré-cadastros disponíveis apenas para secretaria/diretoria.</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>📝 Pré-cadastros</Text>
          <Text style={s.subtitle}>Links e inscrições recebidas</Text>
        </View>
        <TouchableOpacity onPress={carregar} style={s.backBtn}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 36 }}>
        <Text style={s.section}>Link do clube</Text>
        {links.map((l) => {
          const url = `https://dbv-fonseca.pages.dev/pre-cadastro/${l.token}`;
          return (
            <View key={l.id} style={s.card}>
              <Text style={s.cardTitle}>{l.titulo || 'Pré-cadastro'}</Text>
              <Text style={s.url}>{url}</Text>
              <TouchableOpacity style={s.btn} onPress={() => copiar(url)}>
                <Ionicons name="copy" size={17} color="#fff" />
                <Text style={s.btnText}>Copiar link</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={s.search}>
          <Ionicons name="search" size={20} color="#789" />
          <TextInput value={busca} onChangeText={setBusca} style={s.searchInput} placeholder="Buscar pré-cadastro..." />
        </View>

        <Text style={s.section}>{filtrados.length} inscrição(ões)</Text>
        {filtrados.map((p) => {
          const responsaveis = responsaveisDoPre(p);
          return (
          <View key={p.id} style={s.card}>
            <View style={s.row}>
              <View style={s.avatar}><Text style={s.avatarText}>{p.nome[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.nome}>{p.nome}</Text>
                <Text style={s.meta}>{p.email || 'sem e-mail'} {p.contato ? `· ${p.contato}` : ''}</Text>
                <Text style={s.meta}>Camisa {p.camisa || '-'} · Calça {p.calca || '-'}</Text>
                {p.convertido_membro_id ? <Text style={s.meta}>Membro criado: #{p.convertido_membro_id}</Text> : null}
              </View>
              <Text style={s.status}>{p.status}</Text>
            </View>
            <View style={s.respLista}>
              <Text style={s.respLabel}>Responsáveis ({responsaveis.length})</Text>
              {responsaveis.length === 0 ? (
                <Text style={s.meta}>Nenhum responsável informado.</Text>
              ) : responsaveis.map((r) => (
                <View key={r.id} style={s.respLinha}>
                  <Ionicons name={r.responsavel_principal ? 'star' : 'person'} size={15} color={r.responsavel_principal ? '#f59e0b' : '#1a3a5c'} />
                  <Text style={s.respTexto}>
                    {r.nome}{r.parentesco ? ` · ${r.parentesco}` : ''}{r.email ? ` · ${r.email}` : ''}{r.telefone ? ` · ${r.telefone}` : ''}
                  </Text>
                </View>
              ))}
            </View>
            {['novo', 'em_analise'].includes(p.status) ? (
              <View style={s.acoes}>
                <TouchableOpacity style={[s.acaoBtn, s.aprovarBtn]} onPress={() => aprovar(p)} disabled={processandoId === p.id}>
                  {processandoId === p.id ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={18} color="#fff" />}
                  <Text style={s.acaoTextClaro}>Aprovar e criar membro</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.acaoBtn, s.rejeitarBtn]} onPress={() => rejeitar(p)} disabled={processandoId === p.id}>
                  <Ionicons name="close-circle" size={18} color="#b42318" />
                  <Text style={s.acaoTextVermelho}>Rejeitar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );})}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { color: '#789', textAlign: 'center', marginTop: 8 },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingBottom: 22, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 6 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#a8c8e8', fontSize: 13, marginTop: 3 },
  scroll: { flex: 1, padding: 14 },
  section: { color: '#1a3a5c', fontWeight: '900', fontSize: 15, marginVertical: 10 },
  card: { backgroundColor: '#fff', borderRadius: 15, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#dce5ee' },
  cardTitle: { color: '#1a3a5c', fontWeight: '900', fontSize: 16 },
  url: { color: '#456', marginVertical: 8, fontSize: 12 },
  btn: { alignSelf: 'flex-start', backgroundColor: '#1a3a5c', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '900' },
  search: { minHeight: 52, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#dce5ee', marginTop: 8 },
  searchInput: { flex: 1, color: '#1f2933' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  nome: { color: '#1f2933', fontWeight: '900', fontSize: 15 },
  meta: { color: '#667', fontSize: 12, marginTop: 2 },
  status: { color: '#1a3a5c', fontWeight: '900', fontSize: 12 },
  respLista: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eef2f6', gap: 6 },
  respLabel: { color: '#1a3a5c', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  respLinha: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  respTexto: { flex: 1, color: '#465866', fontSize: 12, lineHeight: 17 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  acaoBtn: { minHeight: 42, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  aprovarBtn: { backgroundColor: '#1a3a5c', flex: 1, minWidth: 190 },
  rejeitarBtn: { backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#ffd0d0' },
  acaoTextClaro: { color: '#fff', fontWeight: '900' },
  acaoTextVermelho: { color: '#b42318', fontWeight: '900' },
});

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { BottomNav } from '../../src/components/BottomNav';
import { combinaBusca } from '../../src/lib/texto';
import { useCores } from '../../src/stores/temaStore';
import { corIcone } from '../../src/lib/tema';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { Avatar, avatarCor } from '../../src/components/common/Avatar';
import {
  CATEGORIAS_AUDITORIA, alteracoesDoEvento, categoriaDoEvento, detalhesDoEvento,
  dispositivoDoEvento, rotuloAcao, rotuloEntidade, type CategoriaAuditoria,
} from '../../src/lib/auditoriaExibicao';

interface EventoAuditoria {
  id: string;
  clube_id: number | null;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  membro_id: number | null;
  alvo_user_id: string | null;
  ator_user_id: string | null;
  antes: unknown;
  depois: unknown;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface Pessoa { nome: string; detalhe: string; foto: string | null }
interface MembroBasico { nome: string; foto: string | null }

type Periodo = 'hoje' | '7d' | '30d' | 'tudo';
const PERIODOS: { chave: Periodo; rotulo: string }[] = [
  { chave: 'hoje', rotulo: 'Hoje' },
  { chave: '7d', rotulo: '7 dias' },
  { chave: '30d', rotulo: '30 dias' },
  { chave: 'tudo', rotulo: 'Tudo' },
];

const LIMITE_EVENTOS = 300;
const TAMANHO_AVATAR = 34;

function inicioDoPeriodo(periodo: Periodo): string | null {
  if (periodo === 'tudo') return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (periodo === '7d') d.setDate(d.getDate() - 6);
  if (periodo === '30d') d.setDate(d.getDate() - 29);
  return d.toISOString();
}

function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(d, hoje)) return 'Hoje';
  if (mesmoDia(d, ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function AuditoriaScreen() {
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const ehPlataforma = permissoes.pode('admin_plataforma');
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [usuarios, setUsuarios] = useState<Record<string, Pessoa>>({});
  const [membros, setMembros] = useState<Record<number, MembroBasico>>({});
  const [clubes, setClubes] = useState<Record<number, string>>({});
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [categoria, setCategoria] = useState<CategoriaAuditoria | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const podeVer = permissoes.podeAlguma(['admin_plataforma', 'admin_clube', 'gerenciar_acessos']);

  const carregar = useCallback(async (puxou = false) => {
    if (puxou) setAtualizando(true); else setCarregando(true);
    setErro(null);
    try {
      let query = supabase
        .from('auditoria_eventos')
        .select('id,clube_id,acao,entidade,entidade_id,membro_id,alvo_user_id,ator_user_id,antes,depois,metadata,ip,user_agent,created_at')
        .order('created_at', { ascending: false })
        .limit(LIMITE_EVENTOS);
      const desde = inicioDoPeriodo(periodo);
      if (desde) query = query.gte('created_at', desde);
      if (!ehPlataforma) query = query.eq('clube_id', getClubeAtivoId());

      const { data, error } = await query;
      if (error) throw error;
      const lista = (data ?? []) as EventoAuditoria[];
      setEventos(lista);

      // Resolve ids em nomes: quem fez, em quem e em qual clube.
      const idsUsuarios = Array.from(new Set(lista.flatMap((e) => [e.ator_user_id, e.alvo_user_id]).filter((v): v is string => !!v)));
      const idsMembros = Array.from(new Set(lista.map((e) => e.membro_id).filter((v): v is number => v != null)));
      const idsClubes = Array.from(new Set(lista.map((e) => e.clube_id).filter((v): v is number => v != null)));
      const [u, c] = await Promise.all([
        idsUsuarios.length ? supabase.from('usuarios').select('id,nome,email,perfil,dbv_id').in('id', idsUsuarios) : Promise.resolve({ data: [] }),
        ehPlataforma && idsClubes.length ? supabase.from('clubes').select('id,nome_curto,nome').in('id', idsClubes) : Promise.resolve({ data: [] }),
      ]);
      const linhasUsuarios = (u.data ?? []) as any[];
      // Foto de quem tem ficha de membro: a do próprio evento (membro_id) e a do usuário (dbv_id).
      const idsFichas = Array.from(new Set([...idsMembros, ...linhasUsuarios.map((x) => x.dbv_id).filter((v) => v != null)]));
      const fichas = idsFichas.length
        ? ((await supabase.from('desbravadores').select('id,nome,foto_url').in('id', idsFichas)).data ?? []) as any[]
        : [];
      const porFicha: Record<number, MembroBasico> = Object.fromEntries(fichas.map((x) => [x.id, { nome: x.nome, foto: x.foto_url ?? null }]));
      setMembros(porFicha);
      setUsuarios(Object.fromEntries(linhasUsuarios.map((x) => [x.id, {
        nome: x.nome || x.email || 'Usuário',
        detalhe: [x.perfil, x.email].filter(Boolean).join(' · '),
        foto: x.dbv_id != null ? porFicha[x.dbv_id]?.foto ?? null : null,
      }])));
      setClubes(Object.fromEntries(((c.data ?? []) as any[]).map((x) => [x.id, x.nome_curto || x.nome])));
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar a auditoria.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [periodo, ehPlataforma]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const nomeAtor = (e: EventoAuditoria): Pessoa | null =>
    e.ator_user_id ? usuarios[e.ator_user_id] ?? { nome: 'Usuário removido', detalhe: '', foto: null } : null;

  /** Em quem/o quê: a ficha do membro (com foto) ou o usuário alvo. */
  const sobre = (e: EventoAuditoria): { nome: string; foto: string | null } | null => {
    if (e.membro_id != null) {
      const m = membros[e.membro_id];
      return { nome: m?.nome ?? 'Membro removido', foto: m?.foto ?? null };
    }
    if (e.alvo_user_id && usuarios[e.alvo_user_id]) {
      const u = usuarios[e.alvo_user_id];
      return { nome: u.nome, foto: u.foto };
    }
    return null;
  };

  const filtrados = useMemo(() => {
    const q = busca.trim();
    return eventos.filter((e) => {
      if (categoria && categoriaDoEvento(e.acao, e.entidade) !== categoria) return false;
      if (!q) return true;
      const ator = e.ator_user_id ? usuarios[e.ator_user_id] : null;
      const alvo = e.alvo_user_id ? usuarios[e.alvo_user_id] : null;
      return combinaBusca(rotuloAcao(e.acao), q)
        || combinaBusca(e.acao, q)
        || combinaBusca(ator?.nome, q) || combinaBusca(ator?.detalhe, q)
        || combinaBusca(alvo?.nome, q) || combinaBusca(alvo?.detalhe, q)
        || combinaBusca(e.membro_id != null ? membros[e.membro_id]?.nome : null, q);
    });
  }, [eventos, busca, categoria, usuarios, membros]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, EventoAuditoria[]>();
    for (const e of filtrados) {
      const dia = rotuloDia(e.created_at);
      mapa.set(dia, [...(mapa.get(dia) ?? []), e]);
    }
    return Array.from(mapa.entries());
  }, [filtrados]);

  function alternar(id: string) {
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeVer) return <Redirect href="/" />;

  const texto = { color: cores.texto };
  const suave = { color: cores.textoSecundario };

  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Auditoria" />

      <ScrollView
        contentContainerStyle={s.lista}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => carregar(true)} />}
      >
        <View style={[s.searchBox, { backgroundColor: cores.cartao }]}>
          <Ionicons name="search" size={18} color={cores.textoSecundario} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por pessoa, ação ou e-mail..."
            placeholderTextColor={cores.placeholder}
            style={[s.searchInput, texto]}
          />
        </View>

        <View style={s.chips}>
          {PERIODOS.map((p) => (
            <TouchableOpacity
              key={p.chave}
              onPress={() => setPeriodo(p.chave)}
              style={[s.chip, { backgroundColor: cores.cartao, borderColor: cores.borda }, periodo === p.chave && s.chipAtivo]}
            >
              <Text style={[s.chipTexto, suave, periodo === p.chave && s.chipTextoAtivo]}>{p.rotulo}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <TouchableOpacity
            onPress={() => setCategoria(null)}
            style={[s.chip, { backgroundColor: cores.cartao, borderColor: cores.borda }, categoria === null && s.chipAtivo]}
          >
            <Text style={[s.chipTexto, suave, categoria === null && s.chipTextoAtivo]}>Todas</Text>
          </TouchableOpacity>
          {CATEGORIAS_AUDITORIA.map((c) => (
            <TouchableOpacity
              key={c.chave}
              onPress={() => setCategoria(categoria === c.chave ? null : c.chave)}
              style={[s.chip, { backgroundColor: cores.cartao, borderColor: cores.borda }, categoria === c.chave && s.chipAtivo]}
            >
              <Text style={[s.chipTexto, suave, categoria === c.chave && s.chipTextoAtivo]}>{c.rotulo}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {carregando ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={corIcone(cores)} />
        ) : erro ? (
          <Text style={[s.vazio, suave]}>{erro}</Text>
        ) : (
          <>
            <Text style={[s.contagem, suave]}>
              {filtrados.length} {filtrados.length === 1 ? 'evento' : 'eventos'}
              {eventos.length >= LIMITE_EVENTOS ? ` (mostrando os ${LIMITE_EVENTOS} mais recentes)` : ''}
            </Text>
            {grupos.map(([dia, lista]) => (
              <View key={dia}>
                <Text style={[s.dia, suave]}>{dia}</Text>
                {lista.map((e) => {
                  const cat = CATEGORIAS_AUDITORIA.find((c) => c.chave === categoriaDoEvento(e.acao, e.entidade))!;
                  const ator = nomeAtor(e);
                  const alvo = sobre(e);
                  const aberto = abertos.has(e.id);
                  const mudancas = alteracoesDoEvento(e.antes, e.depois);
                  const extras = detalhesDoEvento(e.metadata);
                  const dispositivo = dispositivoDoEvento(e.user_agent);
                  const temDetalhes = mudancas.length > 0 || extras.length > 0 || !!dispositivo || !!e.ip;
                  return (
                    <TouchableOpacity
                      key={e.id}
                      activeOpacity={temDetalhes ? 0.7 : 1}
                      onPress={() => temDetalhes && alternar(e.id)}
                      style={[s.card, { backgroundColor: cores.cartao, borderLeftColor: cat.cor }]}
                    >
                      <View style={s.cardTop}>
                        <Ionicons name={cat.icone as any} size={20} color={cat.cor} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.acao, texto]}>{rotuloAcao(e.acao)}</Text>
                          <Text style={[s.meta, suave]}>
                            {hora(e.created_at)} · {cat.rotulo}{ehPlataforma && e.clube_id != null && clubes[e.clube_id] ? ` · ${clubes[e.clube_id]}` : ''}
                          </Text>
                        </View>
                        {temDetalhes && <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSecundario} />}
                      </View>

                      <View style={s.pessoaLinha}>
                        <Text style={[s.rotulo, suave]}>Por</Text>
                        <Avatar nome={ator ? ator.nome : 'Sistema'} foto_url={ator?.foto} cor={avatarCor(ator ? ator.nome : 'Sistema')} size={TAMANHO_AVATAR} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.valor, texto]} numberOfLines={1}>{ator ? ator.nome : 'Sistema'}</Text>
                          {ator?.detalhe ? <Text style={[s.sub, suave]} numberOfLines={1}>{ator.detalhe}</Text> : null}
                        </View>
                      </View>
                      {alvo && (
                        <View style={s.pessoaLinha}>
                          <Text style={[s.rotulo, suave]}>Em</Text>
                          <Avatar nome={alvo.nome} foto_url={alvo.foto} cor={avatarCor(alvo.nome)} size={TAMANHO_AVATAR} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.valor, texto]} numberOfLines={1}>{alvo.nome}</Text>
                            {rotuloEntidade(e.entidade) ? <Text style={[s.sub, suave]}>{rotuloEntidade(e.entidade)}</Text> : null}
                          </View>
                        </View>
                      )}

                      {aberto && (
                        <View style={[s.detalhes, { borderTopColor: cores.borda }]}>
                          {mudancas.map((m) => (
                            <View key={m.campo} style={s.linhas}>
                              <Text style={[s.rotulo, suave]}>{m.campo}</Text>
                              <Text style={[s.valor, texto]}>
                                <Text style={suave}>{m.antes}</Text>{'  →  '}{m.depois}
                              </Text>
                            </View>
                          ))}
                          {extras.map((x) => (
                            <View key={x.campo} style={s.linhas}>
                              <Text style={[s.rotulo, suave]}>{x.campo}</Text>
                              <Text style={[s.valor, texto]}>{x.valor}</Text>
                            </View>
                          ))}
                          {dispositivo && (
                            <View style={s.linhas}>
                              <Text style={[s.rotulo, suave]}>Origem</Text>
                              <Text style={[s.valor, texto]}>{dispositivo}{e.ip ? ` · IP ${e.ip}` : ''}</Text>
                            </View>
                          )}
                          {!dispositivo && e.ip ? (
                            <View style={s.linhas}>
                              <Text style={[s.rotulo, suave]}>IP</Text>
                              <Text style={[s.valor, texto]}>{e.ip}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            {filtrados.length === 0 && <Text style={[s.vazio, suave]}>Nenhum evento neste período ou filtro.</Text>}
          </>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  lista: { padding: 16, paddingBottom: 40 },
  searchBox: { borderRadius: 14, paddingHorizontal: 14, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  chipAtivo: { backgroundColor: '#4b2bb0', borderColor: '#4b2bb0' },
  chipTexto: { fontSize: 13, fontWeight: '700' },
  chipTextoAtivo: { color: '#fff' },
  contagem: { fontSize: 12, marginTop: 14 },
  dia: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 16, marginBottom: 8 },
  card: { borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  acao: { fontWeight: '800', fontSize: 15 },
  meta: { fontSize: 12, marginTop: 2 },
  linhas: { flexDirection: 'row', gap: 10, marginTop: 3 },
  pessoaLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  sub: { fontSize: 11, marginTop: 1 },
  rotulo: { width: 70, fontSize: 12, fontWeight: '700' },
  valor: { flex: 1, fontSize: 13 },
  detalhes: { marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  vazio: { textAlign: 'center', marginTop: 40 },
});

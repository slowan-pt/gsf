import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { Avatar, avatarCor } from '../../src/components/common/Avatar';
import { usePermissoes } from '../../src/lib/permissoes';
import { useRealtime } from '../../src/lib/realtime';
import { useAuthStore } from '../../src/stores/authStore';
import { useContextoStore } from '../../src/stores/contextoStore';
import { supabase } from '../../src/lib/supabase';
import {
  agruparPorCategoria,
  carregarCatalogoEspecialidades,
  carregarConquistasClube,
  carregarMembrosClube,
  origemDaEspecialidade,
  SEM_CATEGORIA,
  type EspecialidadeCatalogo,
  type EspecialidadeConquistada,
  type MembroResumo, normalizarNomeParaComparar } from '../../src/lib/especialidades';
import { ModalMarcarEspecialidade } from '../../src/components/especialidades/ModalMarcarEspecialidade';
import { ModalEspecialidadeEmLote } from '../../src/components/especialidades/ModalEspecialidadeEmLote';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, estiloCartao, tomTexto } from '../../src/lib/tema';
import { Chip, CampoBusca, EstadoVazio, Segmentado } from '../../src/components/ui';
import { CabecalhoTela, BotaoCabecalho } from '../../src/components/CabecalhoTela';
import { getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { SeloEspecialidade } from '../../src/components/SeloEspecialidade';

type Visao = 'membros' | 'especialidades';

const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: 'membros', rotulo: 'Por membro' },
  { valor: 'especialidades', rotulo: 'Por especialidade' },
];

function normalizar(txt: string) {
  return txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function EspecialidadesScreen() {
  const cores = useCores();
  const corCabecalho = useCorCabecalho();
  const permissoes = usePermissoes();
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const podeGerenciarCatalogo = permissoes.temPerfil(['admin_ti', 'admin_total']);
  // Conselheiro pra cima (mesmo conjunto de permissões usado no hub de
  // Classes) continua vendo todo mundo; abaixo disso, só o que é seu.
  const verTodos = permissoes.podeAlguma([
    'admin_clube', 'gerenciar_membros', 'ver_relatorios', 'ver_unidade', 'validar_classes',
  ]);
  const ehResponsavel = permissoes.pode('ver_filhos');
  const dbvProprio = usuario?.dbv_id ?? contextoAtivo?.membro_id ?? null;
  const podeMarcar = permissoes.pode('gerenciar_membros') || permissoes.temPerfil(['admin_ti', 'admin_clube', 'usuario_secretaria']);

  const [visao, setVisao] = useState<Visao>('membros');
  const [membroParaMarcar, setMembroParaMarcar] = useState<MembroResumo | null>(null);
  const [modalLote, setModalLote] = useState(false);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [membros, setMembros] = useState<MembroResumo[]>([]);
  const [conquistas, setConquistas] = useState<EspecialidadeConquistada[]>([]);
  const [catalogo, setCatalogo] = useState<EspecialidadeCatalogo[]>([]);
  const [insignias, setInsignias] = useState<Map<string, string | null>>(new Map());
  useEffect(() => {
    let ativo = true;
    supabase
      .from('especialidades_modelo')
      .select('nome,insignia_url')
      .eq('programa_id', getProgramaAtivoId())
      .then(({ data }) => {
        if (ativo && data) {
          const mapa = new Map<string, string | null>();
          for (const e of data as any[]) {
            const chave = normalizarNomeParaComparar(e.nome ?? '');
            if (e.insignia_url || !mapa.has(chave)) mapa.set(chave, e.insignia_url ?? null);
          }
          setInsignias(mapa);
        }
      });
    return () => { ativo = false; };
  }, []);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [categoriasAbertas, setCategoriasAbertas] = useState<Set<string>>(new Set());
  const [subcategoriasAbertas, setSubcategoriasAbertas] = useState<Set<string>>(new Set());

  const cargaEmAndamento = useRef<Promise<void> | null>(null);
  const recargaPendente = useRef(false);
  const cargaCatalogoEmAndamento = useRef<Promise<void> | null>(null);

  useFocusEffect(useCallback(() => { carregar(); }, [verTodos, dbvProprio, ehResponsavel, usuario?.id]));
  useRealtime(['especialidades', 'desbravadores'], () => { carregar(); });
  useRealtime(['especialidades_modelo'], () => {
    if (visao === 'especialidades') void carregarCatalogo(true);
  });

  function carregar(): Promise<void> {
    if (cargaEmAndamento.current) {
      recargaPendente.current = true;
      return cargaEmAndamento.current;
    }

    const execucao = executarCarga().finally(() => {
      cargaEmAndamento.current = null;
      if (recargaPendente.current) {
        recargaPendente.current = false;
        void carregar();
      }
    });
    cargaEmAndamento.current = execucao;
    return execucao;
  }

  function carregarCatalogo(forcarAtualizacao = false): Promise<void> {
    if (cargaCatalogoEmAndamento.current) return cargaCatalogoEmAndamento.current;
    setCarregandoCatalogo(true);
    const execucao = carregarCatalogoEspecialidades(false, forcarAtualizacao)
      .then(setCatalogo)
      .catch((e: any) => setErro(e?.message ?? 'Não foi possível carregar o catálogo de especialidades.'))
      .finally(() => {
        setCarregandoCatalogo(false);
        cargaCatalogoEmAndamento.current = null;
      });
    cargaCatalogoEmAndamento.current = execucao;
    return execucao;
  }

  async function executarCarga() {
    setCarregando(true);
    setErro(null);
    try {
      let idsPermitidos: number[] | undefined;
      if (!verTodos) {
        const ids = new Set<number>();
        if (dbvProprio) ids.add(dbvProprio);
        if (ehResponsavel && usuario?.id) {
          const { data } = await supabase
            .from('responsavel_membros')
            .select('membro_id')
            .eq('usuario_id', usuario.id)
            .eq('ativo', true);
          (data ?? []).forEach((r: any) => ids.add(r.membro_id));
        }
        idsPermitidos = Array.from(ids);
        if (idsPermitidos.length === 0) {
          setMembros([]);
          setConquistas([]);
          return;
        }
      }

      const [ms, cs] = await Promise.all([
        carregarMembrosClube(idsPermitidos),
        carregarConquistasClube(idsPermitidos),
      ]);
      setMembros(ms);
      setConquistas(cs);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar as especialidades.');
    } finally {
      setCarregando(false);
    }
  }

  const conquistasPorMembro = useMemo(() => {
    const mapa = new Map<number, EspecialidadeConquistada[]>();
    for (const c of conquistas) {
      if (!mapa.has(c.dbv_id)) mapa.set(c.dbv_id, []);
      mapa.get(c.dbv_id)!.push(c);
    }
    return mapa;
  }, [conquistas]);

  const membrosPorEspecialidade = useMemo(() => {
    const nomePorId = new Map(membros.map((m) => [m.id, m]));
    const mapa = new Map<string, MembroResumo[]>();
    for (const c of conquistas) {
      const membro = nomePorId.get(c.dbv_id);
      if (!membro) continue;
      if (!mapa.has(c.nome)) mapa.set(c.nome, []);
      mapa.get(c.nome)!.push(membro);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }
    return mapa;
  }, [conquistas, membros]);

  const termo = normalizar(busca.trim());

  const membrosFiltrados = useMemo(() => {
    if (!termo) return membros;
    return membros.filter((m) => {
      if (normalizar(m.nome).includes(termo)) return true;
      // Também acha o membro pelo nome de uma especialidade que ele tem.
      return (conquistasPorMembro.get(m.id) ?? []).some((c) => normalizar(c.nome).includes(termo));
    });
  }, [membros, termo, conquistasPorMembro]);

  /** No modo "por especialidade" listamos o catálogo + qualquer nome já conquistado
   *  que não esteja mais no catálogo (para o histórico não sumir da tela). */
  const gruposEspecialidades = useMemo(() => {
    const doCatalogo = new Map(catalogo.map((c) => [c.nome, c]));
    const extras: EspecialidadeCatalogo[] = [];
    for (const nome of membrosPorEspecialidade.keys()) {
      if (!doCatalogo.has(nome)) {
        extras.push({
          id: `fora-catalogo:${nome}`, nome, codigo: null, categoria: null, subcategoria: null,
          requisitos: null, pre_requisitos: null, observacoes: null,
          insignia_url: null, ativo: true, status: null,
        });
      }
    }
    const todas = [...catalogo, ...extras].filter((e) =>
      !termo
      || normalizar(e.nome).includes(termo)
      || normalizar(e.categoria ?? '').includes(termo)
      || normalizar(e.subcategoria ?? '').includes(termo)
    );
    return agruparPorCategoria(todas);
  }, [catalogo, membrosPorEspecialidade, termo]);

  function renderEspecialidadeCard(esp: EspecialidadeCatalogo) {
    const quem = membrosPorEspecialidade.get(esp.nome) ?? [];
    const aberto = expandido === `e:${esp.id}`;
    return (
      <View key={esp.id} style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, estiloCartao(cores), { borderRadius: 20, borderColor: cores.borda }]}>
        <TouchableOpacity
          style={s.cardTopo}
          onPress={() => setExpandido(aberto ? null : `e:${esp.id}`)}
          activeOpacity={0.75}
        >
          <SeloEspecialidade url={esp.insignia_url} indice={esp.nome.length} />
          <View style={{ flex: 1 }}>
            <Text style={[s.cardNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{esp.nome}</Text>
            <Text style={[s.cardSub, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>
              {quem.length === 0 ? 'Ninguém concluiu ainda' : `${quem.length} membro(s)`}
              {esp.codigo ? ` · ${esp.codigo}` : ''}
            </Text>
          </View>
          <View style={[s.contadorPill, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }, quem.length === 0 && [s.contadorPillVazio, cores.isEscuro && { backgroundColor: '#1d1932' }]]}>
            <Text style={[s.contadorText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }, quem.length === 0 && [s.contadorTextVazio, cores.isEscuro && { color: '#c6ccd4' }]]}>{quem.length}</Text>
          </View>
          <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSecundario} />
        </TouchableOpacity>

        {aberto && (
          <View style={[s.expandido, cores.isEscuro && { borderTopColor: '#322c52' }, { borderTopColor: cores.borda }]}>
            {quem.length === 0 && <Text style={[s.vazioInline, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>Nenhum membro concluiu esta especialidade.</Text>}
            {quem.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={s.itemLinha}
                onPress={() => router.push({ pathname: '/membro/[id]', params: { id: String(m.id), aba: 'especs' } })}
              >
                <Avatar nome={m.nome} foto_url={m.foto_url ?? undefined} cor={avatarCor(m.nome)} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{m.nome}</Text>
                  <Text style={[s.itemOrigem, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>{m.unidade_nome || 'Sem unidade'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={cores.textoSecundario} />
              </TouchableOpacity>
            ))}
            {!!esp.requisitos && (
              <View style={[s.requisitosBox, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
                <Text style={[s.requisitosTitulo, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>Requisitos</Text>
                <Text style={[s.requisitosTexto, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>{esp.requisitos}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Especialidades"
        acoes={<>
          {podeMarcar && <BotaoCabecalho icone="people-outline" onPress={() => setModalLote(true)} rotulo="Em lote" />}
          {podeGerenciarCatalogo && <BotaoCabecalho icone="settings-outline" onPress={() => router.push('/especialidades/catalogo')} rotulo="Catálogo" />}
        </>}
      />

      <Segmentado
        style={s.segmentado}
        opcoes={VISOES.map((opt) => ({ valor: opt.valor, rotulo: opt.rotulo }))}
        valor={visao}
        onChange={(v) => {
          setVisao(v);
          setExpandido(null);
          if (v === 'especialidades' && catalogo.length === 0) void carregarCatalogo();
        }}
      />

      <View style={s.buscaBox}>
        <CampoBusca
          valor={busca}
          onChange={setBusca}
          placeholder={visao === 'membros' ? 'Buscar membro ou especialidade...' : 'Buscar especialidade ou categoria...'}
        />
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />}
        {!carregando && visao === 'especialidades' && carregandoCatalogo && (
          <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 40 }} />
        )}
        {!!erro && <View style={{ marginHorizontal: 16 }}><EstadoVazio icone="warning-outline" titulo="Não foi possível carregar" texto={erro} acao="Tentar novamente" aoAcao={() => { void carregar(); }} /></View>}

        {!carregando && !erro && visao === 'membros' && (
          <>
            {membrosFiltrados.length === 0 && <View style={{ marginHorizontal: 16 }}><EstadoVazio icone="people-outline" titulo="Nenhum membro encontrado" texto="Ajuste a busca para ver outros resultados." /></View>}
            {membrosFiltrados.map((m) => {
              const lista = conquistasPorMembro.get(m.id) ?? [];
              const aberto = expandido === `m:${m.id}`;
              return (
                <View key={m.id} style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, estiloCartao(cores), { borderRadius: 20, borderColor: cores.borda }]}>
                  <TouchableOpacity
                    style={s.cardTopo}
                    onPress={() => setExpandido(aberto ? null : `m:${m.id}`)}
                    activeOpacity={0.75}
                  >
                    <Avatar nome={m.nome} foto_url={m.foto_url ?? undefined} cor={avatarCor(m.nome)} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{m.nome}</Text>
                      <Text style={[s.cardSub, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>{m.unidade_nome || 'Sem unidade'}</Text>
                    </View>
                    <View style={[s.contadorPill, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
                      <Text style={[s.contadorText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{lista.length}</Text>
                    </View>
                    <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSecundario} />
                  </TouchableOpacity>

                  {aberto && (
                    <View style={[s.expandido, cores.isEscuro && { borderTopColor: '#322c52' }, { borderTopColor: cores.borda }]}>
                      {lista.length === 0 && <Text style={[s.vazioInline, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>Nenhuma especialidade concluída ainda.</Text>}
                      {lista.map((c) => {
                        const origem = origemDaEspecialidade(c);
                        return (
                          <View key={c.id} style={s.itemLinha}>
                            <SeloEspecialidade url={insignias.get(normalizarNomeParaComparar(c.nome)) ?? null} indice={lista.indexOf(c)} />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.itemNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{c.nome}</Text>
                              <Text style={[s.itemOrigem, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }, origem.automatica && { color: tomTexto('#2e7d32', cores) }]}>
                                {origem.texto}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        {podeMarcar && (
                          <TouchableOpacity
                            style={[s.abrirFicha, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }, { flex: 1, backgroundColor: '#ede7f6' }]}
                            onPress={() => setMembroParaMarcar(m)}
                          >
                            <Ionicons name="ribbon-outline" size={15} color={tomTexto('#5e35b1', cores)} />
                            <Text style={[s.abrirFichaText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }, { color: tomTexto('#5e35b1', cores) }]}>Marcar especialidade</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[s.abrirFicha, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }, { flex: 1, backgroundColor: cores.fundo }]}
                          onPress={() => router.push({ pathname: '/membro/[id]', params: { id: String(m.id), aba: 'especs' } })}
                        >
                          <Ionicons name="open-outline" size={15} color={corIcone(cores)} />
                          <Text style={[s.abrirFichaText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Abrir ficha</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {!carregando && !carregandoCatalogo && !erro && visao === 'especialidades' && (
          <>
            {gruposEspecialidades.length === 0 && <View style={{ marginHorizontal: 16 }}><EstadoVazio icone="ribbon-outline" titulo="Nenhuma especialidade encontrada" texto="Ajuste a busca ou a categoria." /></View>}
            {gruposEspecialidades.map((grupo) => {
              // Com busca ativa abre tudo, senão respeita o que foi expandido.
              const categoriaAberta = !!termo || categoriasAbertas.has(grupo.categoria);
              const pessoasNaCategoria = grupo.itens.reduce(
                (soma, e) => soma + (membrosPorEspecialidade.get(e.nome)?.length ?? 0), 0
              );
              // Só divide em dropdown de subcategoria quando a categoria
              // realmente tem mais de uma (ex.: Ciência e Tecnologia -> Informática, Elétrica, Biologia).
              const temSubcategorias = grupo.subgrupos.length > 1;
              return (
              <View key={grupo.categoria} style={s.grupoBox}>
                <TouchableOpacity
                  style={[s.grupoHeader, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, estiloCartao(cores), { borderRadius: 18, borderColor: cores.borda }]}
                  activeOpacity={0.7}
                  onPress={() => setCategoriasAbertas((prev) => {
                    const novo = new Set(prev);
                    if (novo.has(grupo.categoria)) novo.delete(grupo.categoria);
                    else novo.add(grupo.categoria);
                    return novo;
                  })}
                >
                  <Ionicons name={categoriaAberta ? 'chevron-down' : 'chevron-forward'} size={17} color={cores.acento} />
                  <Text style={[s.grupoTitulo, cores.isEscuro && { color: '#cdbcff' }, { color: cores.acento }]}>{grupo.categoria}</Text>
                  <Text style={[s.grupoResumo, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>
                    {grupo.itens.length} esp. · {pessoasNaCategoria} conclusão(ões)
                  </Text>
                </TouchableOpacity>

                {categoriaAberta && !temSubcategorias && grupo.itens.map((esp) => renderEspecialidadeCard(esp))}

                {categoriaAberta && temSubcategorias && grupo.subgrupos.map((sub) => {
                  const chaveSub = `${grupo.categoria}::${sub.subcategoria}`;
                  const subAberto = !!termo || subcategoriasAbertas.has(chaveSub);
                  const pessoasNaSub = sub.itens.reduce(
                    (soma, e) => soma + (membrosPorEspecialidade.get(e.nome)?.length ?? 0), 0
                  );
                  return (
                    <View key={chaveSub}>
                      <TouchableOpacity
                        style={[s.subgrupoHeader, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }]}
                        activeOpacity={0.7}
                        onPress={() => setSubcategoriasAbertas((prev) => {
                          const novo = new Set(prev);
                          if (novo.has(chaveSub)) novo.delete(chaveSub);
                          else novo.add(chaveSub);
                          return novo;
                        })}
                      >
                        <Ionicons name={subAberto ? 'chevron-down' : 'chevron-forward'} size={15} color={cores.textoSecundario} />
                        <Text style={[s.subgrupoTitulo, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>{sub.subcategoria}</Text>
                        <Text style={[s.grupoResumo, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>
                          {sub.itens.length} esp. · {pessoasNaSub} conclusão(ões)
                        </Text>
                      </TouchableOpacity>
                      {subAberto && sub.itens.map((esp) => renderEspecialidadeCard(esp))}
                    </View>
                  );
                })}
              </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {membroParaMarcar && (
        <ModalMarcarEspecialidade
          visible={!!membroParaMarcar}
          onClose={() => setMembroParaMarcar(null)}
          dbvId={membroParaMarcar.id}
          usuarioId={usuario?.id ?? null}
          usuarioNome={usuario?.nome ?? null}
          titulo={`Marcar especialidade — ${membroParaMarcar.nome}`}
          onMarcado={() => carregar()}
        />
      )}

      <ModalEspecialidadeEmLote
        visible={modalLote}
        onClose={() => setModalLote(false)}
        membros={membros}
        usuarioId={usuario?.id ?? null}
        usuarioNome={usuario?.nome ?? null}
        onConcluido={() => carregar()}
      />

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f3fb' },
  header: {
    backgroundColor: '#4b2bb0', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voltar: { padding: 2 },
  headerTitulo: { color: '#fff', fontSize: 19, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  gerirBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 11, paddingVertical: 7,
  },
  gerirBtnText: { color: '#4b2bb0', fontSize: 12, fontWeight: '800' },

  segmentado: { marginHorizontal: 16, marginTop: 14 },
  segmentoBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentoBtnAtivo: { backgroundColor: '#4b2bb0' },
  segmentoText: { fontSize: 12, fontWeight: '700', color: '#4a5866' },
  segmentoTextAtivo: { color: '#fff' },

  buscaBox: { marginHorizontal: 16, marginTop: 12 },
  busca: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#222' },

  lista: { flex: 1, marginTop: 12 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  vazioInline: { color: '#8a94a0', fontSize: 12, paddingVertical: 6 },

  grupoBox: { marginBottom: 6 },
  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 11, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6e1f4',
  },
  grupoTitulo: {
    flex: 1, fontSize: 12, fontWeight: '800', color: '#4b2bb0', textTransform: 'uppercase',
  },
  grupoResumo: { fontSize: 11, color: '#8a94a0', fontWeight: '600' },
  subgrupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 26, marginTop: 7, paddingVertical: 9, paddingHorizontal: 11,
    backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#eef2f6',
  },
  subgrupoTitulo: { flex: 1, fontSize: 11, fontWeight: '700', color: '#52606d' },
  espInsignia: { width: 38, height: 38, borderRadius: 8 },
  contadorPillVazio: { backgroundColor: '#f5f3fb' },
  contadorTextVazio: { color: '#9aa5b1' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 18,
    borderWidth: 1, borderColor: '#e6e1f4', overflow: 'hidden',
  },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f1b33' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
  espIcone: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3eeff',
    alignItems: 'center', justifyContent: 'center',
  },
  contadorPill: {
    minWidth: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#efeaf9', alignItems: 'center',
  },
  contadorText: { fontSize: 12, fontWeight: '800', color: '#4b2bb0' },

  expandido: { borderTopWidth: 1, borderTopColor: '#eef2f6', paddingHorizontal: 12, paddingBottom: 10 },
  itemLinha: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  itemNome: { fontSize: 15, fontWeight: '700', color: '#322049' },
  itemOrigem: { fontSize: 13, color: '#756183', marginTop: 3 },
  abrirFicha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 6, paddingVertical: 9, borderRadius: 9, backgroundColor: '#efeaf9',
  },
  abrirFichaText: { fontSize: 12, fontWeight: '800', color: '#4b2bb0' },

  requisitosBox: { marginTop: 8, padding: 10, backgroundColor: '#f8fafc', borderRadius: 18 },
  requisitosTitulo: { fontSize: 11, fontWeight: '800', color: '#52606d', textTransform: 'uppercase', marginBottom: 4 },
  requisitosTexto: { fontSize: 12, color: '#4a5866', lineHeight: 18 },
});

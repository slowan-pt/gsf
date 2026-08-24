import { useCallback, useMemo, useState } from 'react';
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
  type MembroResumo,
} from '../../src/lib/especialidades';

type Visao = 'membros' | 'especialidades';

const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: 'membros', rotulo: 'Por membro' },
  { valor: 'especialidades', rotulo: 'Por especialidade' },
];

function normalizar(txt: string) {
  return txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function EspecialidadesScreen() {
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

  const [visao, setVisao] = useState<Visao>('membros');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [membros, setMembros] = useState<MembroResumo[]>([]);
  const [conquistas, setConquistas] = useState<EspecialidadeConquistada[]>([]);
  const [catalogo, setCatalogo] = useState<EspecialidadeCatalogo[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [categoriasAbertas, setCategoriasAbertas] = useState<Set<string>>(new Set());
  const [subcategoriasAbertas, setSubcategoriasAbertas] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => { carregar(); }, [verTodos, dbvProprio]));
  useRealtime(['especialidades', 'especialidades_modelo', 'desbravadores'], () => { carregar(); });

  async function carregar() {
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
          setMembros([]); setConquistas([]); setCatalogo(await carregarCatalogoEspecialidades());
          setCarregando(false);
          return;
        }
      }

      const [ms, cs, cat] = await Promise.all([
        carregarMembrosClube(idsPermitidos),
        carregarConquistasClube(idsPermitidos),
        carregarCatalogoEspecialidades(),
      ]);
      setMembros(ms);
      setConquistas(cs);
      setCatalogo(cat);
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
      <View key={esp.id} style={s.card}>
        <TouchableOpacity
          style={s.cardTopo}
          onPress={() => setExpandido(aberto ? null : `e:${esp.id}`)}
          activeOpacity={0.75}
        >
          {esp.insignia_url ? (
            <Image source={{ uri: esp.insignia_url }} style={s.espInsignia} resizeMode="contain" />
          ) : (
            <View style={s.espIcone}>
              <Ionicons name="ribbon-outline" size={18} color="#7c3aed" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.cardNome}>{esp.nome}</Text>
            <Text style={s.cardSub}>
              {quem.length === 0 ? 'Ninguém concluiu ainda' : `${quem.length} membro(s)`}
              {esp.codigo ? ` · ${esp.codigo}` : ''}
            </Text>
          </View>
          <View style={[s.contadorPill, quem.length === 0 && s.contadorPillVazio]}>
            <Text style={[s.contadorText, quem.length === 0 && s.contadorTextVazio]}>{quem.length}</Text>
          </View>
          <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color="#9aa5b1" />
        </TouchableOpacity>

        {aberto && (
          <View style={s.expandido}>
            {quem.length === 0 && <Text style={s.vazioInline}>Nenhum membro concluiu esta especialidade.</Text>}
            {quem.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={s.itemLinha}
                onPress={() => router.push({ pathname: '/membro/[id]', params: { id: String(m.id), aba: 'especs' } })}
              >
                <Avatar nome={m.nome} foto_url={m.foto_url ?? undefined} cor={avatarCor(m.nome)} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={s.itemNome}>{m.nome}</Text>
                  <Text style={s.itemOrigem}>{m.unidade_nome || 'Sem unidade'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#ccc" />
              </TouchableOpacity>
            ))}
            {!!esp.requisitos && (
              <View style={s.requisitosBox}>
                <Text style={s.requisitosTitulo}>Requisitos</Text>
                <Text style={s.requisitosTexto}>{esp.requisitos}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.voltar}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Especialidades</Text>
          <Text style={s.headerSub}>{conquistas.length} conquista(s) no clube</Text>
        </View>
        {podeGerenciarCatalogo && (
          <TouchableOpacity onPress={() => router.push('/especialidades/catalogo')} style={s.gerirBtn}>
            <Ionicons name="settings-outline" size={16} color="#1a3a5c" />
            <Text style={s.gerirBtnText}>Catálogo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.segmentado}>
        {VISOES.map((opt) => (
          <TouchableOpacity
            key={opt.valor}
            style={[s.segmentoBtn, visao === opt.valor && s.segmentoBtnAtivo]}
            onPress={() => { setVisao(opt.valor); setExpandido(null); }}
          >
            <Text style={[s.segmentoText, visao === opt.valor && s.segmentoTextAtivo]}>{opt.rotulo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.buscaBox}>
        <Ionicons name="search" size={18} color="#8a94a0" />
        <TextInput
          style={s.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder={visao === 'membros' ? 'Buscar membro ou especialidade...' : 'Buscar especialidade ou categoria...'}
          placeholderTextColor="#aaa"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {carregando && <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 40 }} />}
        {!!erro && <Text style={s.erro}>{erro}</Text>}

        {!carregando && !erro && visao === 'membros' && (
          <>
            {membrosFiltrados.length === 0 && <Text style={s.vazio}>Nenhum membro encontrado.</Text>}
            {membrosFiltrados.map((m) => {
              const lista = conquistasPorMembro.get(m.id) ?? [];
              const aberto = expandido === `m:${m.id}`;
              return (
                <View key={m.id} style={s.card}>
                  <TouchableOpacity
                    style={s.cardTopo}
                    onPress={() => setExpandido(aberto ? null : `m:${m.id}`)}
                    activeOpacity={0.75}
                  >
                    <Avatar nome={m.nome} foto_url={m.foto_url ?? undefined} cor={avatarCor(m.nome)} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{m.nome}</Text>
                      <Text style={s.cardSub}>{m.unidade_nome || 'Sem unidade'}</Text>
                    </View>
                    <View style={s.contadorPill}>
                      <Text style={s.contadorText}>{lista.length}</Text>
                    </View>
                    <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color="#9aa5b1" />
                  </TouchableOpacity>

                  {aberto && (
                    <View style={s.expandido}>
                      {lista.length === 0 && <Text style={s.vazioInline}>Nenhuma especialidade concluída ainda.</Text>}
                      {lista.map((c) => {
                        const origem = origemDaEspecialidade(c);
                        return (
                          <View key={c.id} style={s.itemLinha}>
                            <Ionicons name="ribbon" size={16} color="#7c3aed" />
                            <View style={{ flex: 1 }}>
                              <Text style={s.itemNome}>{c.nome}</Text>
                              <Text style={[s.itemOrigem, origem.automatica && { color: '#2e7d32' }]}>
                                {origem.texto}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      <TouchableOpacity
                        style={s.abrirFicha}
                        onPress={() => router.push({ pathname: '/membro/[id]', params: { id: String(m.id), aba: 'especs' } })}
                      >
                        <Ionicons name="open-outline" size={15} color="#1a3a5c" />
                        <Text style={s.abrirFichaText}>Abrir ficha do membro</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {!carregando && !erro && visao === 'especialidades' && (
          <>
            {gruposEspecialidades.length === 0 && <Text style={s.vazio}>Nenhuma especialidade encontrada.</Text>}
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
                  style={s.grupoHeader}
                  activeOpacity={0.7}
                  onPress={() => setCategoriasAbertas((prev) => {
                    const novo = new Set(prev);
                    if (novo.has(grupo.categoria)) novo.delete(grupo.categoria);
                    else novo.add(grupo.categoria);
                    return novo;
                  })}
                >
                  <Ionicons name={categoriaAberta ? 'chevron-down' : 'chevron-forward'} size={17} color="#1a3a5c" />
                  <Text style={s.grupoTitulo}>{grupo.categoria}</Text>
                  <Text style={s.grupoResumo}>
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
                        style={s.subgrupoHeader}
                        activeOpacity={0.7}
                        onPress={() => setSubcategoriasAbertas((prev) => {
                          const novo = new Set(prev);
                          if (novo.has(chaveSub)) novo.delete(chaveSub);
                          else novo.add(chaveSub);
                          return novo;
                        })}
                      >
                        <Ionicons name={subAberto ? 'chevron-down' : 'chevron-forward'} size={15} color="#52606d" />
                        <Text style={s.subgrupoTitulo}>{sub.subcategoria}</Text>
                        <Text style={s.grupoResumo}>
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

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f5f9' },
  header: {
    backgroundColor: '#1a3a5c', paddingTop: 48, paddingBottom: 16, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voltar: { padding: 2 },
  headerTitulo: { color: '#fff', fontSize: 19, fontWeight: '800' },
  headerSub: { color: '#c7d6e5', fontSize: 12, marginTop: 2 },
  gerirBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7,
  },
  gerirBtnText: { color: '#1a3a5c', fontSize: 12, fontWeight: '800' },

  segmentado: {
    flexDirection: 'row', backgroundColor: '#e4eaf1', borderRadius: 12, padding: 4,
    marginHorizontal: 16, marginTop: 12,
  },
  segmentoBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentoBtnAtivo: { backgroundColor: '#1a3a5c' },
  segmentoText: { fontSize: 12, fontWeight: '700', color: '#4a5866' },
  segmentoTextAtivo: { color: '#fff' },

  buscaBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#e4eaf1',
  },
  busca: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#222' },

  lista: { flex: 1, marginTop: 12 },
  erro: { color: '#c0392b', textAlign: 'center', marginVertical: 12 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  vazioInline: { color: '#8a94a0', fontSize: 12, paddingVertical: 6 },

  grupoBox: { marginBottom: 6 },
  grupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 11, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e4eaf1',
  },
  grupoTitulo: {
    flex: 1, fontSize: 12, fontWeight: '800', color: '#1a3a5c', textTransform: 'uppercase',
  },
  grupoResumo: { fontSize: 11, color: '#8a94a0', fontWeight: '600' },
  subgrupoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 26, marginTop: 7, paddingVertical: 9, paddingHorizontal: 11,
    backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#eef2f6',
  },
  subgrupoTitulo: { flex: 1, fontSize: 11, fontWeight: '700', color: '#52606d' },
  espInsignia: { width: 38, height: 38, borderRadius: 8 },
  contadorPillVazio: { backgroundColor: '#f2f5f9' },
  contadorTextVazio: { color: '#9aa5b1' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 14,
    borderWidth: 1, borderColor: '#e4eaf1', overflow: 'hidden',
  },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  cardNome: { fontSize: 14, fontWeight: '700', color: '#1f2933' },
  cardSub: { fontSize: 12, color: '#8a94a0', marginTop: 2 },
  espIcone: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3eeff',
    alignItems: 'center', justifyContent: 'center',
  },
  contadorPill: {
    minWidth: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#eef3f8', alignItems: 'center',
  },
  contadorText: { fontSize: 12, fontWeight: '800', color: '#1a3a5c' },

  expandido: { borderTopWidth: 1, borderTopColor: '#eef2f6', paddingHorizontal: 12, paddingBottom: 10 },
  itemLinha: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  itemNome: { fontSize: 13, fontWeight: '600', color: '#1f2933' },
  itemOrigem: { fontSize: 11, color: '#8a94a0', marginTop: 1 },
  abrirFicha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 6, paddingVertical: 9, borderRadius: 9, backgroundColor: '#eef3f8',
  },
  abrirFichaText: { fontSize: 12, fontWeight: '800', color: '#1a3a5c' },

  requisitosBox: { marginTop: 8, padding: 10, backgroundColor: '#f8fafc', borderRadius: 9 },
  requisitosTitulo: { fontSize: 11, fontWeight: '800', color: '#52606d', textTransform: 'uppercase', marginBottom: 4 },
  requisitosTexto: { fontSize: 12, color: '#4a5866', lineHeight: 18 },
});

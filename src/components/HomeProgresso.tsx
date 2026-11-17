import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal } from './ModalSeguro';
import { dataBr } from './faixa/pecas';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCores } from '../stores/temaStore';
import { useAuthStore } from '../stores/authStore';
import { useContextoStore } from '../stores/contextoStore';
import { supabase } from '../lib/supabase';
import { getClubeAtivoId, getProgramaAtivoId } from '../lib/contextoAtual';
import {
  carregarProgressoClube, carregarResumoCatalogoClasses, idadePorNascimento, imagemDaClasse,
  organizarClassesParaExibicao, resumirPorClasseSeparado, type ResumoClasseSeparado,
} from '../lib/classesRequisitos';
import { carregarCatalogoEspecialidades, carregarConquistasClube, normalizarNomeParaComparar, type EspecialidadeCatalogo } from '../lib/especialidades';
import { Carrossel } from './Carrossel';
import { SeloAguardando } from './SeloAguardando';
import { carregarAguardandoMembro, type AguardandoMembro } from '../lib/aguardandoMembro';
import { chaveItemFluxo } from '../lib/fluxoClasses';
import { gravarCacheHome, lerCacheHome, lerCacheHomeDoDisco } from '../lib/cacheHome';
import { textoSobre } from '../lib/tema';
import { TituloSecao } from './ui';

type Situacao = 'concluida' | 'andamento' | 'nao_iniciada';

function situacaoDe(r: ResumoClasseSeparado): Situacao {
  if (r.total > 0 && r.concluidos >= r.total) return 'concluida';
  if (r.concluidos > 0) return 'andamento';
  return 'nao_iniciada';
}

function useDbvAtual() {
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  return contextoAtivo?.membro_id ?? usuario?.dbv_id ?? null;
}

/** Itens do membro que aguardam aprovação (selo laranja). Começa do cache e atualiza por trás. */
export function useAguardandoMembro(): AguardandoMembro {
  const dbvId = useDbvAtual();
  const chave = dbvId ? `aguard:${getClubeAtivoId()}:${dbvId}` : null;
  const [dados, setDados] = useState<AguardandoMembro>(() => (chave ? lerCacheHome<AguardandoMembro>(chave) : undefined) ?? { classes: [], especialidades: [] });
  useEffect(() => {
    if (!chave) { setDados({ classes: [], especialidades: [] }); return; }
    const emMemoria = lerCacheHome<AguardandoMembro>(chave);
    if (emMemoria) { setDados(emMemoria); return; }
    let ativo = true;
    lerCacheHomeDoDisco<AguardandoMembro>(chave).then((v) => { if (ativo && v) setDados(v); });
    return () => { ativo = false; };
  }, [chave]);
  useFocusEffect(
    useCallback(() => {
      if (!dbvId) return;
      let ativo = true;
      const clubeId = getClubeAtivoId();
      carregarAguardandoMembro(clubeId, dbvId).then((r) => {
        gravarCacheHome(`aguard:${clubeId}:${dbvId}`, r);
        if (ativo) setDados(r);
      }).catch(() => {});
      return () => { ativo = false; };
    }, [dbvId]),
  );
  return dados;
}

/** Classe que o membro está fazendo agora: a primeira em andamento; senão a primeira não iniciada. */
export function classeAtualDe(itens: ResumoClasseSeparado[] | null): ResumoClasseSeparado | null {
  if (!itens) return null;
  return itens.find((r) => situacaoDe(r) === 'andamento') ?? itens.find((r) => situacaoDe(r) === 'nao_iniciada' && r.total > 0) ?? null;
}

/** Classes do membro do contexto atual, na ordem do carrossel (regular → avançada → agrupadas → liderança). */
export function useClassesMembro() {
  const dbvId = useDbvAtual();
  const chave = dbvId ? `classes:${getClubeAtivoId()}:${dbvId}` : null;
  // Começa já com o último resultado: o banner e o carrossel não somem ao voltar para a Início.
  const [itens, setItens] = useState<ResumoClasseSeparado[] | null>(() => (chave ? lerCacheHome<ResumoClasseSeparado[]>(chave) ?? null : null));
  useEffect(() => {
    if (!chave) { setItens(null); return; }
    const emMemoria = lerCacheHome<ResumoClasseSeparado[]>(chave);
    if (emMemoria) { setItens(emMemoria); return; }
    let ativo = true;
    lerCacheHomeDoDisco<ResumoClasseSeparado[]>(chave).then((v) => { if (ativo && v) setItens((atual) => atual ?? v); });
    return () => { ativo = false; };
  }, [chave]);
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        if (!dbvId) return;
        try {
          const clubeId = getClubeAtivoId();
          const [cat, progresso, { data: m }] = await Promise.all([
            carregarResumoCatalogoClasses(),
            carregarProgressoClube(clubeId, [dbvId]),
            supabase.from('desbravadores').select('data_nascimento').eq('id', dbvId).maybeSingle(),
          ]);
          const concluidos = new Set(progresso.map((p) => p.requisito_id));
          const idade = idadePorNascimento((m as any)?.data_nascimento);
          const resumos = resumirPorClasseSeparado(cat, concluidos, idade);
          const lista = [
            // Regular seguida da avançada correspondente: Amigo | Amigo da Natureza | Companheiro…
            ...organizarClassesParaExibicao(resumos, 'regular', idade),
            ...organizarClassesParaExibicao(resumos, 'agrupada', idade),
            ...organizarClassesParaExibicao(resumos, 'lider', idade),
          ];
          gravarCacheHome(`classes:${clubeId}:${dbvId}`, lista);
          if (ativo) setItens(lista);
        } catch {
          // Sem rede ou erro: mantém o que já está na tela.
        }
      })();
      return () => { ativo = false; };
    }, [dbvId])
  );
  return itens;
}

/* ─── Minhas classes: um carrossel (regulares → avançadas → agrupadas → liderança) ── */
/** `lado`: a seção ocupa metade da linha (lado a lado com a outra) em vez da largura toda. */
export function ClassesCarrossel({ itens, lado }: { itens: ResumoClasseSeparado[] | null; lado?: boolean }) {
  const cores = useCores();
  const dbvId = useDbvAtual();
  const aguardando = useAguardandoMembro();
  // Quem toca numa classe vê os PRÓPRIOS requisitos, não a lista geral de membros.
  const abrirClasse = (chave?: string) => router.push((dbvId ? `/classes/${dbvId}${chave ? `?chave=${encodeURIComponent(chave)}` : ''}` : '/classes') as any);
  const [semImagem, setSemImagem] = useState<Record<string, boolean>>({});
  const [posicoes, setPosicoes] = useState<Record<string, number>>({});
  const atual = classeAtualDe(itens);

  if (!itens || itens.length === 0) return null;

  // Cores dos blocos (.class-tile, .progress, .done e variantes do modo escuro).
  const tom = (sit: Situacao) => {
    if (sit === 'andamento') return cores.isEscuro
      ? { fundo: '#4d391a', borda: '#c39235', sombra: '#241a0c', texto: '#fff3c4', sub: '#f5da9d' }
      : { fundo: cores.secundaria, borda: '#eed457', sombra: '#b69b22', texto: '#322049', sub: '#4f3a5c' };
    if (sit === 'concluida') return cores.isEscuro
      ? { fundo: '#294632', borda: '#6a925c', sombra: '#12251a', texto: '#e2f7d9', sub: '#c4e8b7' }
      : { fundo: '#e6f8d3', borda: '#b0d483', sombra: '#8fb664', texto: '#322049', sub: '#3e651c' };
    return cores.isEscuro
      ? { fundo: '#2b2739', borda: '#4b445c', sombra: '#100b1b', texto: '#c8c1d5', sub: '#c2bace' }
      : { fundo: '#eae6ee', borda: '#cfc5db', sombra: '#c1b8ce', texto: '#4a3d5c', sub: '#5d5270' };
  };

  return (
    <View style={[s.secao, lado && s.lado]}>
      <TituloSecao titulo="Minhas classes" linhaUnica={lado} />
      <Carrossel rotulo="classes" topoSeta={LARGURA_CARD_ALTURA / 2 - 13} larguraItem={LARGURA_CARD} itemInicial={atual ? posicoes[atual.chave] : undefined} aoVerTodas={() => router.push((dbvId ? `/membro/${dbvId}?aba=classes` : '/classes') as any)}>
        {itens.map((r) => {
          const chaveFluxo = chaveItemFluxo(r.classe, r.avancada);
          const emCorrecao = (aguardando.correcoes ?? []).includes(chaveFluxo);
          const aguardandoAprovacao = !emCorrecao && aguardando.classes.includes(chaveFluxo);
          const sit = situacaoDe(r);
          // Em análise: bloco cinza com a faixa laranja (não parece aprovada ainda).
          const t = tom(aguardandoAprovacao || emCorrecao ? 'nao_iniciada' : sit);
          const img = semImagem[r.chave] ? null : imagemDaClasse(r.classe, r.avancada);
          const nao = sit === 'nao_iniciada';
          const status = emCorrecao ? 'Em andamento' : aguardandoAprovacao ? 'Em análise' : sit === 'concluida' ? 'Concluída' : sit === 'andamento' ? 'Em andamento' : 'Não iniciada';
          const ehAtual = atual?.chave === r.chave;
          return (
            <TouchableOpacity
              key={r.chave}
              onLayout={(e) => { const x = e.nativeEvent.layout.x; setPosicoes((p) => (p[r.chave] === x ? p : { ...p, [r.chave]: x })); }}
              activeOpacity={0.85}
              onPress={() => abrirClasse(r.chave)}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}: ${status}${sit === 'andamento' ? `, ${r.pct}%` : ''}`}
              style={[s.classe, { backgroundColor: t.fundo, borderColor: ehAtual ? cores.primaria : t.borda, boxShadow: `0px 4px 0px ${t.sombra}` }, ehAtual && { borderWidth: 4 }]}
            >
              {img ? (
                <Image
                  source={img}
                  resizeMode="contain"
                  onError={() => setSemImagem((a) => ({ ...a, [r.chave]: true }))}
                  style={[
                    r.avancada ? s.emblemaAvancado : s.emblema,
                    nao && { opacity: 0.45 },
                    nao && Platform.OS === 'web' ? ({ filter: 'grayscale(1)' } as any) : null,
                  ]}
                />
              ) : (
                <View style={[s.emblema, s.emblemaVazio]}><Ionicons name="ribbon" size={26} color={t.sub} /></View>
              )}
              <Text style={[s.classeNome, { color: t.texto }]} numberOfLines={2}>{r.label}</Text>
              <Text style={[s.classeStatus, { color: t.sub }]} numberOfLines={1}>{status}</Text>
              {emCorrecao ? <SeloAguardando tipo="correcoes" /> : aguardandoAprovacao ? <SeloAguardando /> : sit === 'concluida' ? <SeloAguardando tipo="concluida" /> : null}
            </TouchableOpacity>
          );
        })}
      </Carrossel>
    </View>
  );
}

/* ─── Minhas especialidades (mais recentes primeiro), ícone real em selo redondo ── */
interface EspConquistada { nome: string; insignia: string | null; concluidaEm?: string | null }

// .badge / :nth-child(3n+2) / :nth-child(3n): secundária, ciano e verde.
const SELOS = [
  { fundo: '', borda: '#fce786', sombra: '#c09522' },
  { fundo: '#36dce6', borda: '#9af2f8', sombra: '#23a4ad' },
  { fundo: '#c4f590', borda: '#e6ffbc', sombra: '#91b460' },
];

export function EspecialidadesConquistadas({ lado }: { lado?: boolean } = {}) {
  const cores = useCores();
  const aguardando = useAguardandoMembro();
  const dbvId = useDbvAtual();
  const chave = dbvId ? `esp:${getClubeAtivoId()}:${dbvId}` : null;
  const [itens, setItens] = useState<EspConquistada[]>(() => (chave ? lerCacheHome<EspConquistada[]>(chave) ?? [] : []));
  const [semImagem, setSemImagem] = useState<Record<string, boolean>>({});
  const [aberta, setAberta] = useState<EspConquistada | null>(null);
  const [catalogo, setCatalogo] = useState<EspecialidadeCatalogo[] | null>(null);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);

  /** Abre o popup e busca o catálogo (requisitos) só na primeira vez; depois reaproveita. */
  function abrirEspecialidade(e: EspConquistada) {
    setAberta(e);
    if (catalogo || carregandoCatalogo) return;
    setCarregandoCatalogo(true);
    carregarCatalogoEspecialidades()
      .then(setCatalogo)
      .catch(() => setCatalogo([]))
      .finally(() => setCarregandoCatalogo(false));
  }
  const detalhe = aberta ? (catalogo ?? []).find((c) => normalizarNomeParaComparar(c.nome) === normalizarNomeParaComparar(aberta.nome)) ?? null : null;
  useEffect(() => {
    if (!chave) { setItens([]); return; }
    const emMemoria = lerCacheHome<EspConquistada[]>(chave);
    if (emMemoria) { setItens(emMemoria); return; }
    let ativo = true;
    lerCacheHomeDoDisco<EspConquistada[]>(chave).then((v) => { if (ativo && v) setItens((atual) => (atual.length > 0 ? atual : v)); });
    return () => { ativo = false; };
  }, [chave]);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        if (!dbvId) return;
        try {
          const conquistas = await carregarConquistasClube([dbvId]);
          const ordenadas = [...conquistas].sort((a, b) =>
            String(b.marcado_em ?? b.updated_at ?? '').localeCompare(String(a.marcado_em ?? a.updated_at ?? '')));
          const nomes = Array.from(new Set(ordenadas.map((c) => c.nome)));
          const concluidaPor = new Map<string, string | null>();
          for (const c of ordenadas) if (!concluidaPor.has(c.nome)) concluidaPor.set(c.nome, (c.marcado_em ?? c.updated_at ?? null) as string | null);
          if (nomes.length === 0) {
            gravarCacheHome(`esp:${getClubeAtivoId()}:${dbvId}`, []);
            if (ativo) setItens([]);
            return;
          }
          // Compara pelo nome normalizado (sem acento/maiúscula), como o resto do app:
          // "Arte de acampar" e "Arte de Acampar" são a mesma especialidade.
          const { data } = await supabase
            .from('especialidades_modelo')
            .select('nome,insignia_url')
            .eq('programa_id', getProgramaAtivoId());
          const insignias = new Map<string, string | null>();
          for (const e of (data ?? []) as any[]) {
            const chave = normalizarNomeParaComparar(e.nome ?? '');
            if (e.insignia_url || !insignias.has(chave)) insignias.set(chave, e.insignia_url ?? null);
          }
          const lista = nomes.map((nome) => ({ nome, insignia: insignias.get(normalizarNomeParaComparar(nome)) ?? null, concluidaEm: concluidaPor.get(nome) ?? null }));
          gravarCacheHome(`esp:${getClubeAtivoId()}:${dbvId}`, lista);
          if (ativo) setItens(lista);
        } catch {
          // Sem rede ou erro: mantém o que já está na tela.
        }
      })();
      return () => { ativo = false; };
    }, [dbvId])
  );

  if (itens.length === 0) return null;

  return (
    <View style={[s.secao, lado && s.lado]}>
      <TituloSecao titulo="Minhas especialidades" linhaUnica={lado} />
      <Carrossel rotulo="especialidades" topoSeta={LARGURA_CARD_ALTURA / 2 - 13} larguraItem={LARGURA_CARD} aoVerTodas={() => router.push((dbvId ? `/membro/${dbvId}?aba=especs` : '/especialidades') as any)}>
        {itens.map((e, i) => {
          const selo = SELOS[i % 3];
          const emAnalise = aguardando.especialidades.includes(normalizarNomeParaComparar(e.nome));
          return (
            <TouchableOpacity
              key={e.nome}
              activeOpacity={0.85}
              onPress={() => abrirEspecialidade(e)}
              style={[s.esp, { backgroundColor: cores.cartao, borderColor: cores.borda, boxShadow: `0px 3px 0px ${cores.sombra}` }]}
              accessibilityRole="button"
              accessibilityLabel={`Especialidade ${e.nome}. Toque para ver os requisitos`}
            >
              <View style={[s.selo, { backgroundColor: selo.fundo || cores.secundaria, borderColor: selo.borda, boxShadow: `0px 4px 0px ${selo.sombra}` }]}>
                {e.insignia && !semImagem[e.nome] ? (
                  <Image source={{ uri: e.insignia }} style={s.seloImagem} resizeMode="contain" onError={() => setSemImagem((a) => ({ ...a, [e.nome]: true }))} />
                ) : (
                  <Ionicons name="ribbon" size={26} color="#432958" />
                )}
              </View>
              <Text style={[s.espNome, { color: cores.texto }]} numberOfLines={2}>{e.nome}</Text>
              {emAnalise ? <SeloAguardando compacto /> : null}
            </TouchableOpacity>
          );
        })}
      </Carrossel>

      <Modal visible={!!aberta} transparent animationType="fade" onRequestClose={() => setAberta(null)}>
        <View style={[s.fundoModal, { backgroundColor: cores.overlay }]}>
          <View style={[s.caixa, { backgroundColor: cores.cartao }]}>
            <View style={s.caixaTopo}>
              <View style={[s.selo, { backgroundColor: cores.secundaria, borderColor: SELOS[0].borda }]}>
                {aberta?.insignia && !semImagem[aberta.nome] ? (
                  <Image source={{ uri: aberta.insignia }} style={s.seloImagem} resizeMode="contain" />
                ) : (
                  <Ionicons name="ribbon" size={26} color="#432958" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.caixaTitulo, { color: cores.texto }]}>{aberta?.nome}</Text>
                {detalhe?.categoria ? <Text style={[s.caixaSub, { color: cores.textoSecundario }]}>{detalhe.categoria}</Text> : null}
                {dataBr(aberta?.concluidaEm) ? <Text style={[s.caixaSub, { color: cores.textoSecundario }]}>Concluída em {dataBr(aberta?.concluidaEm)}</Text> : null}
              </View>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {carregandoCatalogo && !catalogo ? (
                <Text style={[s.texto, { color: cores.textoSecundario }]}>Carregando requisitos...</Text>
              ) : (
                <>
                  {detalhe?.pre_requisitos ? (
                    <>
                      <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Pré-requisitos</Text>
                      <Text style={[s.texto, { color: cores.texto }]}>{detalhe.pre_requisitos}</Text>
                    </>
                  ) : null}
                  <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Requisitos</Text>
                  <Text style={[s.texto, { color: cores.texto }]}>{detalhe?.requisitos || 'Os requisitos desta especialidade ainda não estão cadastrados.'}</Text>
                  {detalhe?.observacoes ? (
                    <>
                      <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Observações</Text>
                      <Text style={[s.texto, { color: cores.texto }]}>{detalhe.observacoes}</Text>
                    </>
                  ) : null}
                </>
              )}
            </ScrollView>
            <TouchableOpacity style={[s.fechar, { backgroundColor: cores.primaria }]} onPress={() => setAberta(null)} accessibilityRole="button">
              <Text style={{ color: textoSobre(cores.primaria), fontWeight: '900' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Classes e especialidades usam a mesma caixa, para as duas fileiras ficarem iguais. */
const LARGURA_CARD = 116;
const LARGURA_CARD_ALTURA = 156;

const s = StyleSheet.create({
  secao: { marginVertical: 12 },
  lado: { flex: 1, minWidth: 0 },
  classe: { width: LARGURA_CARD, height: LARGURA_CARD_ALTURA, paddingVertical: 8, paddingHorizontal: 8, borderWidth: 2, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emblema: { width: 34, height: 34, marginBottom: 6 },
  emblemaAvancado: { width: 60, height: 34, marginBottom: 6 },
  emblemaVazio: { alignItems: 'center', justifyContent: 'center' },
  classeNome: { fontSize: 12, fontWeight: '800', lineHeight: 15, textAlign: 'center' },
  continuar: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  continuarTexto: { fontSize: 11, fontWeight: '900' },
  classeStatus: { fontSize: 11, marginTop: 3, textAlign: 'center' },
  esp: { width: LARGURA_CARD, height: LARGURA_CARD_ALTURA, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 18, borderWidth: 1.5 },
  selo: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  seloImagem: { width: 40, height: 40, borderRadius: 20 },
  espNome: { fontSize: 13, fontWeight: '800', lineHeight: 17, textAlign: 'center' },
  fundoModal: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  caixa: { width: '100%', maxWidth: 460, borderRadius: 20, padding: 18, gap: 8 },
  caixaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  caixaTitulo: { fontSize: 17, fontWeight: '900' },
  caixaSub: { fontSize: 12, marginTop: 2 },
  rotulo: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  texto: { fontSize: 14, lineHeight: 20 },
  fechar: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});

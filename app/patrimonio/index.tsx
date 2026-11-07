import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BottomNav } from '../../src/components/BottomNav';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { Botao, Cartao, Chip, Dropdown, EstadoVazio, Tag, type Tom } from '../../src/components/ui';
import { useAuthStore } from '../../src/stores/authStore';
import { useCores } from '../../src/stores/temaStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { carregarItensPatrimonio } from '../../src/lib/patrimonio';
import {
  DEPARTAMENTOS_SUGERIDOS, FILTROS_VAZIOS, STATUS_PATRIMONIO, filtrarItens, formatarMoeda, opcoesDistintas,
  totaisPatrimonio, valorUnitario, type FiltrosPatrimonio, type ItemPatrimonio, type StatusPatrimonio,
} from '../../src/lib/patrimonioNucleo';

const TOM_STATUS: Record<StatusPatrimonio, Tom> = { pendente: 'amarelo', aprovado: 'verde', baixado: 'vermelho' };
const ROTULO_STATUS = Object.fromEntries(STATUS_PATRIMONIO.map((s) => [s.valor, s.rotulo])) as Record<StatusPatrimonio, string>;

export default function PatrimonioScreen() {
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const podeVer = permissoes.pode('gerenciar_patrimonio.ver');
  const podeCadastrar = permissoes.pode('gerenciar_patrimonio.cadastrar');

  const [itens, setItens] = useState<ItemPatrimonio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState<FiltrosPatrimonio>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const carregar = useCallback(async (puxou = false) => {
    if (puxou) setAtualizando(true);
    try {
      setItens(await carregarItensPatrimonio(getClubeAtivoId()));
      setErro('');
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar o patrimônio. Verifique a internet.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { if (podeVer) void carregar(); }, [carregar, podeVer]));

  const visiveis = useMemo(() => filtrarItens(itens, filtros), [itens, filtros]);
  const totais = useMemo(() => totaisPatrimonio(visiveis), [visiveis]);
  const departamentos = useMemo(
    () => opcoesDistintas(itens.map((i) => i.departamento), DEPARTAMENTOS_SUGERIDOS).map((d) => ({ valor: d, rotulo: d })),
    [itens],
  );
  const filtrando = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VAZIOS);

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeVer) return <Redirect href="/" />;

  const campo = [s.campo, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }];
  const atualizar = <K extends keyof FiltrosPatrimonio>(k: K, v: FiltrosPatrimonio[K]) => setFiltros((f) => ({ ...f, [k]: v }));

  return (
    <View style={[s.tela, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Patrimônio" subtitulo={`${totais.quantidadeItens} item(ns) · ${formatarMoeda(totais.valorMercado)}`} />

      <ScrollView
        contentContainerStyle={s.conteudo}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => carregar(true)} />}
      >
        <View style={s.barra}>
          <TouchableOpacity style={[s.btnFiltro, { backgroundColor: cores.cartao, borderColor: cores.borda }]} onPress={() => setFiltrosAbertos((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: filtrosAbertos }}>
            <Ionicons name="search" size={16} color={cores.acento} />
            <Text style={[s.btnFiltroTxt, { color: cores.texto }]}>Pesquisar{filtrando ? ' (filtrado)' : ''}</Text>
            <Ionicons name={filtrosAbertos ? 'chevron-up' : 'chevron-down'} size={16} color={cores.textoSecundario} />
          </TouchableOpacity>
          {podeCadastrar ? <Botao rotulo="Novo" icone="add" onPress={() => router.push('/patrimonio/novo' as any)} /> : null}
        </View>

        {filtrosAbertos ? (
          <Cartao style={{ gap: 10 }}>
            <View style={s.linha}>
              <View style={{ width: 90 }}>
                <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Código</Text>
                <TextInput style={campo} value={filtros.codigo} onChangeText={(v) => atualizar('codigo', v.replace(/\D/g, ''))} keyboardType="number-pad" accessibilityLabel="Código" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Descrição</Text>
                <TextInput style={campo} value={filtros.descricao} onChangeText={(v) => atualizar('descricao', v)} accessibilityLabel="Descrição" />
              </View>
            </View>
            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Departamento</Text>
                <Dropdown valor={filtros.departamento} opcoes={departamentos} onChange={(v) => atualizar('departamento', v)} vazio="Todos" titulo="Departamento" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Série</Text>
                <TextInput style={campo} value={filtros.serie} onChangeText={(v) => atualizar('serie', v)} accessibilityLabel="Série" />
              </View>
            </View>
            <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Status</Text>
            <View style={s.chips}>
              <Chip rotulo="Todos" ativo={!filtros.status} onPress={() => atualizar('status', '')} />
              {STATUS_PATRIMONIO.map((st) => (
                <Chip key={st.valor} rotulo={st.rotulo} ativo={filtros.status === st.valor} onPress={() => atualizar('status', st.valor)} />
              ))}
            </View>
            {filtrando ? <Botao rotulo="Limpar filtros" secundario icone="close" onPress={() => setFiltros(FILTROS_VAZIOS)} /> : null}
          </Cartao>
        ) : null}

        {carregando ? <ActivityIndicator color={cores.acento} style={{ marginTop: 30 }} /> : null}

        {!carregando && erro ? (
          <EstadoVazio icone="cloud-offline-outline" titulo="Não foi possível carregar" texto={`${erro} O patrimônio precisa de internet.`} acao="Tentar de novo" aoAcao={() => { setCarregando(true); void carregar(); }} />
        ) : null}

        {!carregando && !erro && visiveis.length === 0 ? (
          <EstadoVazio
            icone="cube-outline"
            titulo={filtrando ? 'Nenhum item encontrado' : 'Nenhum item cadastrado'}
            texto={filtrando ? 'Ajuste ou limpe os filtros.' : podeCadastrar ? 'Toque em Novo para cadastrar o primeiro bem do clube.' : undefined}
          />
        ) : null}

        {visiveis.map((i) => (
          <Cartao key={i.id} onPress={() => router.push({ pathname: '/patrimonio/[id]', params: { id: String(i.id) } } as any)} rotulo={`Item ${i.codigo}: ${i.descricao}`} style={[s.item, i.status === 'baixado' && { opacity: 0.7 }]}>
            {i.foto_url ? (
              <Image source={{ uri: i.foto_url }} style={s.foto} />
            ) : (
              <View style={[s.foto, s.fotoVazia, { backgroundColor: cores.acentoSuave }]}><Ionicons name="image-outline" size={26} color={cores.acento} /></View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.itemTitulo, { color: cores.texto }]} numberOfLines={2}>#{i.codigo} · {i.descricao}</Text>
              <Text style={{ color: cores.textoSecundario, fontSize: 12 }} numberOfLines={1}>
                {[i.departamento, i.tipo, i.marca].filter(Boolean).join(' · ') || 'Sem departamento'}
              </Text>
              <View style={s.chips}>
                <Tag texto={ROTULO_STATUS[i.status]} tom={TOM_STATUS[i.status]} />
                {i.segurar ? <Tag texto="Segurado" tom="ciano" icone="shield-checkmark" /> : null}
              </View>
              <Text style={{ color: cores.textoSecundario, fontSize: 12 }}>
                {i.quantidade} un. · {formatarMoeda(i.valor_mercado)}{i.quantidade > 1 ? ` (${formatarMoeda(valorUnitario(i.valor_mercado, i.quantidade))} cada)` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={cores.textoSecundario} />
          </Cartao>
        ))}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1 },
  conteudo: { padding: 14, gap: 12, paddingBottom: 110 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnFiltro: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  btnFiltroTxt: { flex: 1, fontWeight: '800', fontSize: 14 },
  linha: { flexDirection: 'row', gap: 10 },
  rotulo: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  campo: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: 64, height: 64, borderRadius: 12 },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontSize: 15, fontWeight: '800' },
});

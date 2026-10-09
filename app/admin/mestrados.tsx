import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { BottomNav } from '../../src/components/BottomNav';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { Segmentado } from '../../src/components/ui';
import { usePermissoes } from '../../src/lib/permissoes';
import {
  carregarEspecialidadesDoMestrado, carregarMestrados, salvarMestrado,
  type Mestrado, type SituacaoMestrado,
} from '../../src/lib/mestrados';
import { carregarCatalogoEspecialidades, type EspecialidadeCatalogo } from '../../src/lib/especialidades';
import { enviarImagemMestrado } from '../../src/lib/mestradoImagem';
import { avisar } from '../../src/stores/avisoStore';
import { useCores } from '../../src/stores/temaStore';
import { estiloCartao, textoSobre } from '../../src/lib/tema';

interface Form {
  id: string | null;
  codigo: string; nome: string; imagemUrl: string; areas: string; grupo: string;
  ordem: string; prioridade: string; quantidade: string; fonte: string; edicao: string; observacoes: string;
  situacao: SituacaoMestrado;
}

const FORM_VAZIO: Form = {
  id: null, codigo: '', nome: '', imagemUrl: '', areas: '', grupo: '', ordem: '100', prioridade: '100',
  quantidade: '7', fonte: '', edicao: '', observacoes: '', situacao: 'rascunho',
};

const ROTULO_SITUACAO: Record<SituacaoMestrado, string> = { rascunho: 'Rascunho', ativo: 'Ativo', inativo: 'Inativo' };

function norm(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Formativos → Mestrados. Somente ADMIN TI: as regras ficam no banco e podem mudar sem publicar o app. */
export default function MestradosAdminScreen() {
  const cores = useCores();
  const permissoes = usePermissoes();
  const ehAdminTi = permissoes.temPerfil(['admin_ti']);

  const [lista, setLista] = useState<Mestrado[]>([]);
  const [catalogo, setCatalogo] = useState<EspecialidadeCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [selecionadas, setSelecionadas] = useState<Map<string, boolean>>(new Map()); // id -> obrigatória
  const [busca, setBusca] = useState('');
  const [area, setArea] = useState<string | null>(null);
  const [soSelecionadas, setSoSelecionadas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [ms, cat] = await Promise.all([carregarMestrados(), carregarCatalogoEspecialidades(true)]);
      setLista(ms);
      setCatalogo(cat);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar os mestrados. Aplique a migration 137 no banco.', 'erro');
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { if (ehAdminTi) void carregar(); }, [ehAdminTi, carregar]));

  const areas = useMemo(
    () => Array.from(new Set(catalogo.map((e) => (e.categoria ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [catalogo],
  );

  const filtradas = useMemo(() => {
    const q = norm(busca);
    return catalogo.filter((e) => {
      if (soSelecionadas && !selecionadas.has(e.id)) return false;
      if (area && (e.categoria ?? '').trim() !== area) return false;
      if (!q) return true;
      return norm(e.nome).includes(q) || norm(e.codigo ?? '').includes(q);
    });
  }, [catalogo, busca, area, soSelecionadas, selecionadas]);

  const totalSelecionadas = selecionadas.size;
  const totalObrigatorias = Array.from(selecionadas.values()).filter(Boolean).length;

  async function abrir(m: Mestrado | null) {
    setErro(null); setBusca(''); setArea(null); setSoSelecionadas(false);
    if (!m) {
      setSelecionadas(new Map());
      setForm({ ...FORM_VAZIO, codigo: `ME-${String(lista.length + 1).padStart(3, '0')}`, ordem: String((lista.length + 1) * 10), prioridade: String((lista.length + 1) * 10) });
      return;
    }
    setForm({
      id: m.id, codigo: m.codigo, nome: m.nome, imagemUrl: m.imagem_url ?? '', areas: (m.areas ?? []).join(', '),
      grupo: m.grupo_exibicao ?? '', ordem: String(m.ordem_exibicao), prioridade: String(m.prioridade_exibicao),
      quantidade: String(m.quantidade_exigida), fonte: m.fonte ?? '', edicao: m.edicao ?? '', observacoes: m.observacoes ?? '',
      situacao: m.situacao,
    });
    try {
      const esp = await carregarEspecialidadesDoMestrado(m.id);
      setSelecionadas(new Map(esp.map((e) => [e.id, e.obrigatoria])));
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar a lista de especialidades.', 'erro');
      setSelecionadas(new Map());
    }
  }

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const novo = new Map(atual);
      if (novo.has(id)) novo.delete(id); else novo.set(id, false);
      return novo;
    });
  }

  function alternarObrigatoria(id: string) {
    setSelecionadas((atual) => {
      if (!atual.has(id)) return atual;
      const novo = new Map(atual);
      novo.set(id, !novo.get(id));
      return novo;
    });
  }

  function marcarFiltradas(marcar: boolean) {
    setSelecionadas((atual) => {
      const novo = new Map(atual);
      for (const e of filtradas) { if (marcar) { if (!novo.has(e.id)) novo.set(e.id, false); } else novo.delete(e.id); }
      return novo;
    });
  }

  async function escolherImagem() {
    if (!form) return;
    try {
      let uri: string | null = null;
      if (Platform.OS === 'web') {
        uri = await new Promise<string | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = () => { const f = input.files?.[0]; resolve(f ? URL.createObjectURL(f) : null); };
          input.click();
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { avisar('Permita o acesso às fotos para escolher a imagem.', 'info'); return; }
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
        uri = r.canceled ? null : r.assets?.[0]?.uri ?? null;
      }
      if (!uri) return;
      setEnviandoImagem(true);
      const url = await enviarImagemMestrado(uri, form.codigo || 'mestrado');
      setForm((f) => (f ? { ...f, imagemUrl: url } : f));
      avisar('Imagem enviada (reduzida e com fundo transparente). Salve para aplicar.', 'sucesso');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível enviar a imagem.', 'erro');
    } finally {
      setEnviandoImagem(false);
    }
  }

  async function salvar() {
    if (!form) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await salvarMestrado({
        id: form.id, codigo: form.codigo.trim(), nome: form.nome.trim(), imagem_url: form.imagemUrl.trim() || null,
        areas: form.areas.split(',').map((a) => a.trim()).filter(Boolean),
        grupo_exibicao: form.grupo.trim() || null,
        ordem_exibicao: Number(form.ordem) || 100, prioridade_exibicao: Number(form.prioridade) || 100,
        quantidade_exigida: Number(form.quantidade) || 0,
        fonte: form.fonte.trim() || null, edicao: form.edicao.trim() || null, observacoes: form.observacoes.trim() || null,
        situacao: form.situacao,
        especialidades: Array.from(selecionadas.entries()).map(([id, obrigatoria]) => ({ id, obrigatoria })),
      });
      avisar(
        r.situacao === 'ativo'
          ? `Mestrado salvo (versão ${r.versao}). ${r.reavaliados} membro(s) reavaliado(s).`
          : `Mestrado salvo como ${ROTULO_SITUACAO[r.situacao].toLowerCase()} (versão ${r.versao}).`,
        'sucesso', 'Salvo',
      );
      setForm(null);
      await carregar();
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (!permissoes.usuario) return <Redirect href="/auth/login" />;
  if (!ehAdminTi) {
    return (
      <View style={[st.container, { backgroundColor: cores.fundo }]}>
        <CabecalhoTela titulo="Mestrados" aoVoltar={() => router.replace('/' as any)} />
        <View style={st.vazio}>
          <Ionicons name="lock-closed" size={40} color={cores.textoSecundario} />
          <Text style={[st.vazioTitulo, { color: cores.texto }]}>Acesso restrito ao ADMIN TI</Text>
          <Text style={[st.vazioSub, { color: cores.textoSecundario }]}>As regras dos mestrados só podem ser alteradas pelo ADMIN TI. A diretoria analisa as solicitações em Aprovações.</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  // ---------------- editor ----------------
  if (form) {
    const campo = (rotulo: string, valor: string, aoMudar: (v: string) => void, extra: object = {}) => (
      <View style={{ marginBottom: 10 }}>
        <Text style={[st.rotulo, { color: cores.textoSecundario }]}>{rotulo}</Text>
        <TextInput
          value={valor}
          onChangeText={aoMudar}
          placeholderTextColor={cores.placeholder}
          style={[st.input, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }]}
          {...extra}
        />
      </View>
    );
    const cabecalhoLista = (
      <View>
        {campo('Código', form.codigo, (v) => setForm({ ...form, codigo: v }), { autoCapitalize: 'characters' })}
        {campo('Nome', form.nome, (v) => setForm({ ...form, nome: v }))}

        <Text style={[st.rotulo, { color: cores.textoSecundario }]}>Imagem do mestrado</Text>
        <View style={st.imagemLinha}>
          <View style={[st.imagemCaixa, { backgroundColor: cores.input, borderColor: cores.borda }]}>
            {form.imagemUrl ? <Image source={{ uri: form.imagemUrl }} style={{ width: 96, height: 68 }} resizeMode="contain" /> : <Ionicons name="image-outline" size={26} color={cores.textoSecundario} />}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <TouchableOpacity style={[st.botaoSec, { backgroundColor: cores.acentoSuave }]} onPress={escolherImagem} disabled={enviandoImagem} accessibilityRole="button">
              {enviandoImagem ? <ActivityIndicator size="small" color={cores.acento} /> : <Ionicons name="cloud-upload-outline" size={16} color={cores.acento} />}
              <Text style={[st.botaoSecTexto, { color: cores.acento }]}>{form.imagemUrl ? 'Trocar imagem' : 'Escolher imagem'}</Text>
            </TouchableOpacity>
            <Text style={[st.dica, { color: cores.textoSecundario }]}>É reduzida automaticamente (até 240 px) e o fundo liso vira transparente, para ficar leve no celular.</Text>
          </View>
        </View>

        {campo('Área ou áreas relacionadas (separe por vírgula)', form.areas, (v) => setForm({ ...form, areas: v }))}
        {campo('Grupo de exibição na faixa', form.grupo, (v) => setForm({ ...form, grupo: v }))}
        <View style={st.linha3}>
          <View style={{ flex: 1 }}>{campo('Ordem na faixa', form.ordem, (v) => setForm({ ...form, ordem: v }), { keyboardType: 'numeric' })}</View>
          <View style={{ flex: 1 }}>{campo('Prioridade', form.prioridade, (v) => setForm({ ...form, prioridade: v }), { keyboardType: 'numeric' })}</View>
          <View style={{ flex: 1 }}>{campo('Exige (qtd)', form.quantidade, (v) => setForm({ ...form, quantidade: v }), { keyboardType: 'numeric' })}</View>
        </View>
        <Text style={[st.dica, { color: cores.textoSecundario, marginBottom: 10 }]}>Ordem e prioridade só definem como a faixa é organizada (a menor prioridade vence quando uma especialidade serve a mais de um mestrado). Não alteram quem é elegível.</Text>
        {campo('Fonte', form.fonte, (v) => setForm({ ...form, fonte: v }))}
        {campo('Edição', form.edicao, (v) => setForm({ ...form, edicao: v }))}
        {campo('Observações', form.observacoes, (v) => setForm({ ...form, observacoes: v }), { multiline: true })}

        <Text style={[st.rotulo, { color: cores.textoSecundario }]}>Situação</Text>
        <Segmentado
          style={{ marginBottom: 14 }}
          opcoes={(['rascunho', 'ativo', 'inativo'] as SituacaoMestrado[]).map((v) => ({ valor: v, rotulo: ROTULO_SITUACAO[v] }))}
          valor={form.situacao}
          onChange={(v) => setForm({ ...form, situacao: v as SituacaoMestrado })}
        />

        <Text style={[st.secao, { color: cores.texto }]}>Especialidades elegíveis</Text>
        <Text style={[st.contador, { color: cores.acento }]} accessibilityLiveRegion="polite">
          {totalSelecionadas} {totalSelecionadas === 1 ? 'selecionada' : 'selecionadas'}{totalObrigatorias > 0 ? ` · ${totalObrigatorias} obrigatória(s)` : ''} · exige {Number(form.quantidade) || 0}
        </Text>
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome ou código"
          placeholderTextColor={cores.placeholder}
          style={[st.input, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto, marginBottom: 8 }]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
          {[null, ...areas].map((a) => {
            const ativo = area === a;
            return (
              <TouchableOpacity key={a ?? 'todas'} onPress={() => setArea(a)} accessibilityRole="button" accessibilityState={{ selected: ativo }}
                style={[st.chip, { backgroundColor: ativo ? cores.primaria : cores.cartao, borderColor: ativo ? cores.primaria : cores.borda }]}>
                <Text style={{ color: ativo ? textoSobre(cores.primaria) : cores.texto, fontWeight: '800', fontSize: 12 }}>{a ?? 'Todas as áreas'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={st.acoesLista}>
          <TouchableOpacity onPress={() => setSoSelecionadas((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: soSelecionadas }} style={st.chk}>
            <View style={[st.caixa, { borderColor: cores.borda }, soSelecionadas && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}>{soSelecionadas ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}</View>
            <Text style={{ color: cores.texto, fontSize: 12, fontWeight: '700' }}>Só selecionadas</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => marcarFiltradas(true)} accessibilityRole="button"><Text style={[st.link, { color: cores.acento }]}>Marcar as {filtradas.length} da lista</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => marcarFiltradas(false)} accessibilityRole="button"><Text style={[st.link, { color: cores.acento }]}>Limpar</Text></TouchableOpacity>
        </View>
      </View>
    );

    return (
      <View style={[st.container, { backgroundColor: cores.fundo }]}>
        <CabecalhoTela titulo={form.id ? 'Editar mestrado' : 'Novo mestrado'} subtitulo="Formativos · Mestrados" aoVoltar={() => setForm(null)} />
        <FlatList
          data={filtradas}
          keyExtractor={(e) => e.id}
          initialNumToRender={24}
          windowSize={7}
          contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
          ListHeaderComponent={cabecalhoLista}
          ListEmptyComponent={<Text style={{ color: cores.textoSecundario, textAlign: 'center', padding: 20 }}>Nenhuma especialidade encontrada.</Text>}
          renderItem={({ item }) => {
            const marcada = selecionadas.has(item.id);
            const obrigatoria = selecionadas.get(item.id) === true;
            return (
              <View style={[st.linhaEsp, { borderColor: cores.borda }]}>
                <TouchableOpacity style={st.linhaEspPrincipal} onPress={() => alternar(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }}>
                  <View style={[st.caixa, { borderColor: cores.borda }, marcada && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}>{marcada ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: cores.texto, fontWeight: '700', fontSize: 13 }} numberOfLines={2}>{item.nome}{item.ativo === false ? ' (inativa)' : ''}</Text>
                    <Text style={{ color: cores.textoSecundario, fontSize: 11 }} numberOfLines={1}>{[item.codigo, item.categoria].filter(Boolean).join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
                {marcada ? (
                  <TouchableOpacity onPress={() => alternarObrigatoria(item.id)} accessibilityRole="switch" accessibilityState={{ checked: obrigatoria }}
                    style={[st.chipObrig, { backgroundColor: obrigatoria ? cores.secundaria : cores.acentoSuave }]}>
                    <Text style={{ color: obrigatoria ? '#432958' : cores.acento, fontSize: 10, fontWeight: '900' }}>{obrigatoria ? 'OBRIGATÓRIA' : 'obrigatória?'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
        <View style={[st.rodape, { backgroundColor: cores.cartao, borderTopColor: cores.borda }]}>
          {erro ? <Text style={st.erro} accessibilityRole="alert">{erro}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[st.botao, { flex: 1, backgroundColor: cores.fundo }]} onPress={() => setForm(null)} accessibilityRole="button">
              <Text style={{ color: cores.texto, fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.botao, { flex: 1, backgroundColor: cores.primaria }, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando} accessibilityRole="button">
              {salvando ? <ActivityIndicator color="#fff" /> : <Text style={{ color: textoSobre(cores.primaria), fontWeight: '900' }}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ---------------- lista ----------------
  return (
    <View style={[st.container, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela titulo="Mestrados" subtitulo="Formativos · só ADMIN TI" aoVoltar={() => (router.canGoBack() ? router.back() : router.replace('/' as any))} />
      {carregando ? (
        <ActivityIndicator size="large" color={cores.primaria} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={[st.dica, { color: cores.textoSecundario, marginBottom: 12 }]}>
            Regras iniciais entram como rascunho: só geram solicitações depois que você conferir a lista de especialidades de cada mestrado e ativar. Conferir com o manual completo de 2025.
          </Text>
          {lista.map((m) => (
            <TouchableOpacity key={m.id} onPress={() => abrir(m)} accessibilityRole="button" style={[st.card, estiloCartao(cores, 18)]}>
              <View style={[st.miniatura, { backgroundColor: cores.input, borderColor: cores.borda }]}>
                {m.imagem_url ? <Image source={{ uri: m.imagem_url }} style={{ width: 64, height: 46 }} resizeMode="contain" /> : <Ionicons name="ribbon-outline" size={22} color={cores.textoSecundario} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: cores.texto, fontWeight: '900', fontSize: 14 }} numberOfLines={1}>{m.codigo} · {m.nome}</Text>
                <Text style={{ color: cores.textoSecundario, fontSize: 12 }}>Exige {m.quantidade_exigida} · versão {m.versao}{m.fonte ? ` · ${m.fonte}` : ''}</Text>
              </View>
              <View style={[st.selo, { backgroundColor: m.situacao === 'ativo' ? '#2e7d3222' : m.situacao === 'inativo' ? '#78909c33' : '#f59e0b22' }]}>
                <Text style={{ color: m.situacao === 'ativo' ? '#2e7d32' : m.situacao === 'inativo' ? '#546e7a' : '#b45309', fontSize: 11, fontWeight: '900' }}>{ROTULO_SITUACAO[m.situacao]}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[st.botao, { backgroundColor: cores.primaria, marginTop: 8 }]} onPress={() => abrir(null)} accessibilityRole="button">
            <Text style={{ color: textoSobre(cores.primaria), fontWeight: '900' }}>+ Novo mestrado</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  vazioTitulo: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  vazioSub: { fontSize: 13, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10 },
  miniatura: { width: 72, height: 54, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  selo: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  rotulo: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  dica: { fontSize: 11, lineHeight: 15 },
  linha3: { flexDirection: 'row', gap: 8 },
  imagemLinha: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  imagemCaixa: { width: 110, height: 82, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  botaoSec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38, borderRadius: 12, paddingHorizontal: 12 },
  botaoSecTexto: { fontSize: 12, fontWeight: '800' },
  secao: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  contador: { fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  acoesLista: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 8 },
  chk: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caixa: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 12, fontWeight: '800' },
  linhaEsp: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
  linhaEspPrincipal: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chipObrig: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rodape: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, borderTopWidth: 1, gap: 8 },
  erro: { color: '#c62828', fontSize: 12, fontWeight: '700' },
  botao: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

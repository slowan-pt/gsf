import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { ClasseHtmlView } from '../../src/components/ClasseHtmlView';
import { useCores } from '../../src/stores/temaStore';
import { corIcone } from '../../src/lib/tema';
import { avisar, useAvisoStore } from '../../src/stores/avisoStore';
import { registrarAuditoria } from '../../src/lib/auditoria';
import { slugDoTitulo, SLUG_INTEGRADA } from '../../src/lib/classeBiblica';

interface ItemLista {
  id: number;
  slug: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  versao: number;
}

interface Formulario {
  id: number | null;
  titulo: string;
  slug: string;
  descricao: string;
  ordem: string;
  ativo: boolean;
  html: string;
  versao: number;
}

const FORM_VAZIO: Formulario = { id: null, titulo: '', slug: '', descricao: '', ordem: '0', ativo: true, html: '', versao: 0 };
/** Acima disso o texto não é mostrado no campo (fica só o resumo), pra não travar a tela. */
const LIMITE_EDITAVEL = 100_000;
const REGEX_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const tamanhoKb = (texto: string) => `${Math.max(1, Math.round(texto.length / 1024))} KB`;

/** Cadastro das classes bíblicas em HTML (só Admin TI). Valem para todos os clubes. */
export default function ClassesBiblicasAdmin() {
  const cores = useCores();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const podeGerenciar = permissoes.pode('admin_plataforma');
  const [lista, setLista] = useState<ItemLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<Formulario | null>(null);
  const [slugEditado, setSlugEditado] = useState(false);
  const [previa, setPrevia] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('classes_biblicas')
        .select('id,slug,titulo,descricao,ordem,ativo,versao')
        .order('ordem')
        .order('titulo');
      if (error) throw error;
      setLista((data ?? []) as ItemLista[]);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível carregar as classes. Aplique a migration 123 no banco.', 'erro', 'Erro');
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function abrir(item: ItemLista) {
    const { data, error } = await supabase.from('classes_biblicas').select('html').eq('id', item.id).maybeSingle();
    if (error) { avisar(error.message, 'erro', 'Erro'); return; }
    setSlugEditado(true);
    setPrevia(false);
    setForm({
      id: item.id, titulo: item.titulo, slug: item.slug, descricao: item.descricao ?? '',
      ordem: String(item.ordem), ativo: item.ativo, html: (data as any)?.html ?? '', versao: item.versao,
    });
  }

  function nova() {
    setSlugEditado(false);
    setPrevia(false);
    setForm({ ...FORM_VAZIO });
  }

  function mudar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setForm((f) => {
      if (!f) return f;
      const novo = { ...f, [campo]: valor };
      if (campo === 'titulo' && !slugEditado && f.id == null) novo.slug = slugDoTitulo(String(valor));
      return novo;
    });
  }

  async function escolherArquivo() {
    try {
      let texto: string | null = null;
      if (Platform.OS === 'web') {
        texto = await new Promise<string | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.html,.htm,text/html';
          input.onchange = async () => {
            const arquivo = input.files?.[0];
            resolve(arquivo ? await arquivo.text() : null);
          };
          input.click();
        });
      } else {
        const r = await DocumentPicker.getDocumentAsync({ type: ['text/html', '*/*'], copyToCacheDirectory: true });
        if (r.canceled || !r.assets?.[0]) return;
        texto = await new File(r.assets[0].uri).text();
      }
      if (texto != null) mudar('html', texto);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível ler o arquivo.', 'erro', 'Erro');
    }
  }

  async function salvar() {
    if (!form) return;
    const titulo = form.titulo.trim();
    const slug = form.slug.trim();
    if (!titulo) { avisar('Informe o título da classe.', 'info', 'Campo obrigatório'); return; }
    if (!REGEX_SLUG.test(slug)) { avisar('O identificador só pode ter letras minúsculas, números e hífen (ex.: perolas-para-a-eternidade).', 'info', 'Identificador inválido'); return; }
    if (slug === SLUG_INTEGRADA && form.id == null) { avisar('Este identificador é da classe integrada ao app. Use outro.', 'info', 'Identificador reservado'); return; }
    if (!form.html.trim()) { avisar('Cole o HTML da classe ou escolha um arquivo .html.', 'info', 'HTML obrigatório'); return; }

    setSalvando(true);
    try {
      const campos = {
        slug, titulo, descricao: form.descricao.trim() || null, html: form.html,
        ordem: Number(form.ordem) || 0, ativo: form.ativo, updated_at: new Date().toISOString(),
      };
      const { error } = form.id == null
        ? await supabase.from('classes_biblicas').insert({ ...campos, criado_por: usuario?.id ?? null })
        : await supabase.from('classes_biblicas').update({ ...campos, versao: form.versao + 1 }).eq('id', form.id);
      if (error) {
        throw new Error(error.code === '23505' ? 'Já existe uma classe com este identificador.' : error.message);
      }
      registrarAuditoria({ acao: form.id == null ? 'classe_biblica_criar' : 'classe_biblica_editar', entidade: 'classes_biblicas', entidadeId: slug, metadata: { titulo } });
      avisar('Classe salva. Ela já está disponível para todos os clubes.', 'sucesso', 'Pronto');
      setForm(null);
      carregar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar.', 'erro', 'Erro');
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExcluir() {
    if (!form?.id) return;
    const alvo = form;
    useAvisoStore.getState().mostrar({
      titulo: 'Excluir classe?',
      mensagem: `"${alvo.titulo}" some para todos os clubes. As respostas já dadas ficam guardadas, mas sem a classe não podem ser vistas.`,
      tipo: 'info',
      botoes: [
        { texto: 'Cancelar', estilo: 'cancelar' },
        {
          texto: 'Excluir', estilo: 'padrao',
          onPress: async () => {
            const { error } = await supabase.from('classes_biblicas').delete().eq('id', alvo.id!);
            if (error) { avisar(error.message, 'erro', 'Erro'); return; }
            registrarAuditoria({ acao: 'classe_biblica_excluir', entidade: 'classes_biblicas', entidadeId: alvo.slug, metadata: { titulo: alvo.titulo } });
            setForm(null);
            carregar();
          },
        },
      ],
    });
  }

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!podeGerenciar) return <Redirect href="/" />;

  const texto = { color: cores.texto };
  const suave = { color: cores.textoSecundario };
  const campoEstilo = [s.input, { backgroundColor: cores.input, borderColor: cores.borda, color: cores.texto }];

  /* ─── Pré-visualização ─── */
  if (form && previa) {
    return (
      <View style={[s.container, { backgroundColor: cores.fundo }]}>
        <CabecalhoTela titulo="Pré-visualização" aoVoltar={() => setPrevia(false)} />
        <ClasseHtmlView html={form.html} titulo={form.titulo} respostas={{}} />
        <BottomNav />
      </View>
    );
  }

  /* ─── Editor ─── */
  if (form) {
    const grande = form.html.length > LIMITE_EDITAVEL;
    return (
      <View style={[s.container, { backgroundColor: cores.fundo }]}>
        <CabecalhoTela titulo={form.id == null ? 'Nova classe' : 'Editar classe'} aoVoltar={() => setForm(null)} />
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={[s.rotulo, suave]}>Título</Text>
          <TextInput style={campoEstilo} value={form.titulo} onChangeText={(v) => mudar('titulo', v)} placeholder="Ex.: Pérolas para a Eternidade" placeholderTextColor={cores.placeholder} />

          <Text style={[s.rotulo, suave]}>Identificador (endereço)</Text>
          <TextInput
            style={campoEstilo} value={form.slug} autoCapitalize="none" autoCorrect={false}
            editable={form.id == null}
            onChangeText={(v) => { setSlugEditado(true); mudar('slug', v.toLowerCase()); }}
            placeholder="perolas-para-a-eternidade" placeholderTextColor={cores.placeholder}
          />
          {form.id != null && <Text style={[s.ajuda, suave]}>O identificador não muda depois de criado (as respostas dos usuários ficam ligadas a ele).</Text>}

          <Text style={[s.rotulo, suave]}>Descrição (aparece no menu)</Text>
          <TextInput style={campoEstilo} value={form.descricao} onChangeText={(v) => mudar('descricao', v)} placeholder="Estudo bíblico · ..." placeholderTextColor={cores.placeholder} />

          <View style={s.linha}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rotulo, suave]}>Ordem no menu</Text>
              <TextInput style={campoEstilo} value={form.ordem} keyboardType="numeric" onChangeText={(v) => mudar('ordem', v.replace(/[^0-9-]/g, ''))} />
            </View>
            <View style={s.ativoBox}>
              <Text style={[s.rotulo, suave]}>Disponível</Text>
              <Switch value={form.ativo} onValueChange={(v) => mudar('ativo', v)} />
            </View>
          </View>

          <Text style={[s.rotulo, suave]}>HTML da classe</Text>
          <Text style={[s.ajuda, suave]}>
            Os campos que recebem resposta (input, textarea, select) precisam ter id, name ou data-campo. As respostas de cada usuário são salvas no aparelho e sincronizadas com a conta.
          </Text>
          <TouchableOpacity style={[s.botaoSec, { borderColor: cores.borda, backgroundColor: cores.cartao }]} onPress={escolherArquivo}>
            <Ionicons name="document-attach-outline" size={18} color={corIcone(cores)} />
            <Text style={[s.botaoSecTexto, texto]}>Escolher arquivo .html</Text>
          </TouchableOpacity>
          {grande ? (
            <View style={[s.resumo, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
              <Ionicons name="checkmark-circle" size={20} color="#2e7d32" />
              <Text style={[s.resumoTexto, texto]}>HTML carregado ({tamanhoKb(form.html)}). Use “Pré-visualizar” para conferir.</Text>
              <TouchableOpacity onPress={() => mudar('html', '')}><Text style={s.remover}>Remover</Text></TouchableOpacity>
            </View>
          ) : (
            <TextInput
              style={[...campoEstilo, s.html]} value={form.html} onChangeText={(v) => mudar('html', v)}
              multiline autoCapitalize="none" autoCorrect={false} textAlignVertical="top"
              placeholder="<html>… cole aqui o HTML …</html>" placeholderTextColor={cores.placeholder}
            />
          )}

          <TouchableOpacity style={[s.botaoSec, { borderColor: cores.borda, backgroundColor: cores.cartao }]} onPress={() => form.html.trim() ? setPrevia(true) : avisar('Cole o HTML antes de pré-visualizar.', 'info', 'Sem HTML')}>
            <Ionicons name="eye-outline" size={18} color={corIcone(cores)} />
            <Text style={[s.botaoSecTexto, texto]}>Pré-visualizar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.botaoSalvar, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={20} color="#fff" />}
            <Text style={s.botaoSalvarTexto}>Salvar classe</Text>
          </TouchableOpacity>

          {form.id != null && (
            <TouchableOpacity style={s.botaoExcluir} onPress={confirmarExcluir}>
              <Ionicons name="trash-outline" size={18} color="#c62828" />
              <Text style={s.botaoExcluirTexto}>Excluir classe</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        <BottomNav />
      </View>
    );
  }

  /* ─── Lista ─── */
  return (
    <View style={[s.container, { backgroundColor: cores.fundo }]}>
      <CabecalhoTela
        titulo="Classes Bíblicas"
        aoVoltar={() => router.back()}
        acoes={
          <TouchableOpacity style={s.botaoNova} onPress={nova}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.botaoNovaTexto}>Nova</Text>
          </TouchableOpacity>
        }
      />
      {carregando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={corIcone(cores)} />
      ) : (
        <ScrollView contentContainerStyle={s.conteudo}>
          <Text style={[s.ajuda, suave]}>
            “Jóias da Eternidade” é integrada ao app e sempre aparece no menu. As classes abaixo são as que você cadastrou.
          </Text>
          {lista.map((c) => (
            <TouchableOpacity key={c.id} activeOpacity={0.8} onPress={() => abrir(c)} style={[s.card, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitulo, texto]}>{c.titulo}</Text>
                <Text style={[s.cardSub, suave]}>{c.slug} · v{c.versao} · ordem {c.ordem}</Text>
              </View>
              <Text style={[s.status, { color: c.ativo ? '#2e7d32' : '#9e9e9e' }]}>{c.ativo ? 'Ativa' : 'Inativa'}</Text>
              <Ionicons name="chevron-forward" size={18} color={cores.textoSecundario} />
            </TouchableOpacity>
          ))}
          {lista.length === 0 && <Text style={[s.vazio, suave]}>Nenhuma classe cadastrada ainda. Toque em “Nova”.</Text>}
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  conteudo: { padding: 16, paddingBottom: 48, gap: 6 },
  rotulo: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginTop: 12 },
  ajuda: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  html: { minHeight: 260, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: 12 },
  linha: { flexDirection: 'row', gap: 16, alignItems: 'flex-end' },
  ativoBox: { alignItems: 'flex-start', gap: 6, paddingBottom: 6 },
  botaoSec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  botaoSecTexto: { fontWeight: '700' },
  resumo: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 },
  resumoTexto: { flex: 1, fontSize: 13 },
  remover: { color: '#c62828', fontWeight: '800', fontSize: 13 },
  botaoSalvar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1a3a5c', borderRadius: 14, padding: 15, marginTop: 18 },
  botaoSalvarTexto: { color: '#fff', fontWeight: '900', fontSize: 16 },
  botaoExcluir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, marginTop: 8 },
  botaoExcluirTexto: { color: '#c62828', fontWeight: '800' },
  botaoNova: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  botaoNovaTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 8 },
  cardTitulo: { fontSize: 15, fontWeight: '800' },
  cardSub: { fontSize: 12, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '800' },
  vazio: { textAlign: 'center', marginTop: 40 },
});

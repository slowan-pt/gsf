import { EstadoVazio } from '../../src/components/ui';
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { enviarArquivo } from '../../src/lib/arquivos';
import { getDB } from '../../src/lib/database';
import { adicionarFilaSync } from '../../src/lib/sync';
import { enviarParaTodos } from '../../src/lib/notifications';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { avisar, useAvisoStore } from '../../src/stores/avisoStore';
import { uriParaUploadBody } from '../../src/lib/storageUpload';
import { useCores } from '../../src/stores/temaStore';
import { corIcone, tomTexto } from '../../src/lib/tema';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';

function confirmarAcao(titulo: string, mensagem: string) {
  return new Promise<boolean>((resolve) => {
    useAvisoStore.getState().mostrar({
      titulo,
      mensagem,
      tipo: 'info',
      botoes: [
        { texto: 'Cancelar', estilo: 'cancelar', onPress: () => resolve(false) },
        { texto: 'Confirmar', estilo: 'padrao', onPress: () => resolve(true) },
      ],
    });
  });
}

/**
 * A imagem que aparece na notificação (Expo Push `richContent.image`) precisa
 * de uma URL pública — envia pro mesmo bucket já usado pelos anexos de
 * atividades, que já é público e tem as permissões certas.
 */
async function uploadImagemPush(uri: string): Promise<string> {
  // Antes lia com fetch(uri) puro, que falha com "Network request failed" pra
  // URIs file:// no Android (mesmo problema já resolvido pros anexos de
  // atividades e foto de perfil) — uriParaUploadBody trata isso lendo o
  // arquivo local pela API de arquivos em vez de tentar buscá-lo pela rede.
  const body = await uriParaUploadBody(uri, 'image/jpeg');
  const path = `push/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  return await enviarArquivo('atividades', path, body, { upsert: true, contentType: 'image/jpeg' });
}

function escolherArquivoImagemWeb(onUri: (uri: string) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const arquivo = input.files?.[0];
    if (arquivo) onUri(URL.createObjectURL(arquivo));
  };
  input.click();
}

interface Mensagem {
  id: number | string;
  titulo: string;
  corpo: string;
  enviado_por: string | null;
  created_at: string;
}

export default function MensagensScreen() {
  const cores = useCores();
  const usuario  = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const isAdmin = permissoes.pode('enviar_mensagens.enviar');

  const [titulo,    setTitulo]    = useState('');
  const [corpo,     setCorpo]     = useState('');
  const [enviando,  setEnviando]  = useState(false);
  const [imagemUri, setImagemUri] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  useFocusEffect(useCallback(() => { void carregarHistorico(); }, []));

  async function carregarHistorico() {
    if (Platform.OS === 'web') {
      const { data } = await supabase
        .from('mensagens_clube')
        .select('*')
        .eq('clube_id', getClubeAtivoId())
        .order('created_at', { ascending: false })
        .limit(50);
      setHistorico((data ?? []) as Mensagem[]);
      return;
    }
    const db = await getDB();
    const lista = await db.getAllAsync<Mensagem>(
      'SELECT * FROM mensagens_clube ORDER BY created_at DESC LIMIT 50'
    );
    setHistorico(lista);
  }

  async function escolherImagem() {
    if (Platform.OS === 'web') {
      escolherArquivoImagemWeb((uri) => setImagemUri(uri));
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
    if (!r.canceled && r.assets[0]) setImagemUri(r.assets[0].uri);
  }

  async function enviar() {
    if (!titulo.trim()) { avisar('Informe um título.', 'info', 'Atenção'); return; }
    if (!corpo.trim())  { avisar('Escreva a mensagem.', 'info', 'Atenção'); return; }

    async function confirmarEnviar() {
      setEnviando(true);
      try {
        // Sobe a imagem ANTES de gravar o aviso — assim ela fica salva na
        // própria mensagem (não só no payload do push), e quem abrir o
        // aviso mais tarde no app consegue ver a imagem, não só o texto.
        let imagemUrl: string | null = null;
        let erroImagem: string | null = null;
        if (imagemUri) {
          try {
            imagemUrl = await uploadImagemPush(imagemUri);
          } catch (e: any) {
            // Envio segue sem imagem — não trava o aviso por causa do anexo,
            // mas antes esse erro sumia em silêncio: a mensagem "salva com
            // sucesso" não deixava claro que a imagem tinha ficado de fora.
            erroImagem = e?.message ?? 'Erro desconhecido ao enviar a imagem.';
          }
        }

        const payload = {
          clube_id: getClubeAtivoId(),
          titulo: titulo.trim(),
          corpo: corpo.trim(),
          imagem_url: imagemUrl,
          enviado_por: usuario?.nome ?? 'Diretoria',
        };

        if (Platform.OS === 'web') {
          const { error } = await supabase.from('mensagens_clube').insert(payload);
          if (error) throw error;
        } else {
          const db = await getDB();
          const result = await db.runAsync(
            'INSERT INTO mensagens_clube (clube_id, titulo, corpo, imagem_url, enviado_por) VALUES (?,?,?,?,?)',
            [payload.clube_id, payload.titulo, payload.corpo, payload.imagem_url, payload.enviado_por]
          );
          const localId = result.lastInsertRowId;
          try {
            // Insere direto no Supabase e reconcilia o id local com o UUID
            // real — sem isso, o registro local fica com um id numérico que
            // nunca bate com o UUID do Postgres (e "excluir para todos" falha).
            const { data, error } = await supabase.from('mensagens_clube').insert(payload).select('id').single();
            if (error) throw error;
            if (data?.id) {
              await db.runAsync('UPDATE mensagens_clube SET supabase_id = ? WHERE id = ?', [data.id, localId]);
            }
          } catch {
            // Sem internet agora — fica na fila de sincronização e será reconciliado depois.
            await adicionarFilaSync('mensagens_clube', 'INSERT', { id: localId, ...payload });
          }
        }
        const resultadoPush = await enviarParaTodos(
          `📢 ${payload.titulo}`,
          `${usuario?.nome?.trim() ? `${usuario.nome.trim()}: ` : ''}${payload.corpo}`,
          { tela: 'mensagens' },
          imagemUrl
        );
        setTitulo('');
        setCorpo('');
        setImagemUri(null);
        await carregarHistorico();
        const avisoPush = resultadoPush.tokens === 0
          ? '\n\nNenhum aparelho com notificação ativa foi encontrado. Abra o app no celular e aceite a permissão de notificações.'
          : resultadoPush.erros.length > 0
            ? `\n\nMensagem salva, mas houve falha no push: ${resultadoPush.erros[0]}`
            : `\n\nPush enviado para ${resultadoPush.enviados} aparelho(s).`;
        const avisoImagem = erroImagem ? `\n\n⚠️ A imagem NÃO foi enviada: ${erroImagem}` : '';
        avisar(
          `Mensagem salva e será sincronizada automaticamente.${avisoPush}${avisoImagem}`,
          erroImagem ? 'erro' : 'sucesso',
          erroImagem ? 'Salvo com aviso' : 'Salvo!'
        );
      } catch (e: any) {
        avisar(e.message ?? 'Não foi possível salvar a mensagem.', 'erro');
      } finally {
        setEnviando(false);
      }
    }

    if (await confirmarAcao('Enviar mensagem', `Enviar "${titulo}" por notificação aos membros do clube?`)) {
      void confirmarEnviar();
    }
  }

  function formatarData(d: string) {
    try { return format(new Date(d), "dd/MM HH:mm", { locale: ptBR }); } catch { return d; }
  }

  if (!isAdmin) {
    return (
      <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
        <View style={s.semAcesso}>
          <Ionicons name="lock-closed" size={48} color={cores.textoSecundario} />
          <Text style={[s.semAcessoText, cores.isEscuro && { color: '#cbcbd6' }, { color: cores.textoSecundario }]}>Acesso restrito à diretoria</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      {/* Header */}
      <CabecalhoTela titulo="Mensagens para o Clube" tamanhoTitulo={19} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Formulário de envio */}
          <View style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
            <Text style={[s.secaoTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Nova mensagem</Text>

            <Text style={[s.label, cores.isEscuro && { color: '#c4c4d2' }, { color: cores.textoSecundario }]}>Título</Text>
            <TextInput
              style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52', color: '#ececf3' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
              value={titulo}
              onChangeText={setTitulo}
              placeholder="Ex: Reunião cancelada, Aviso importante..."
              placeholderTextColor={cores.placeholder}
              maxLength={80}
            />

            <Text style={[s.label, cores.isEscuro && { color: '#c4c4d2' }, { color: cores.textoSecundario }]}>Mensagem</Text>
            <TextInput
              style={[s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52', color: '#ececf3' }, s.inputMulti, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
              value={corpo}
              onChangeText={setCorpo}
              placeholder="Escreva a mensagem completa aqui..."
              placeholderTextColor={cores.placeholder}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={[s.contador, cores.isEscuro && { color: '#d0d0da' }, { color: cores.textoSecundario }]}>{corpo.length}/500</Text>

            {imagemUri ? (
              <View style={[s.imagemPreviewBox, cores.isEscuro && { borderColor: '#322c52' }, { borderColor: cores.borda }]}>
                <Image source={{ uri: imagemUri }} style={[s.imagemPreview, cores.isEscuro && { backgroundColor: '#1d1932' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.imagemPreviewTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Imagem anexada</Text>
                  <Text style={[s.imagemPreviewSub, cores.isEscuro && { color: '#c4c4d2' }, { color: cores.textoSecundario }]}>Aparece na notificação push</Text>
                </View>
                <TouchableOpacity onPress={() => setImagemUri(null)} style={s.imagemRemoverBtn}>
                  <Ionicons name="close-circle" size={22} color={tomTexto('#c62828', cores)} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[s.imagemAdicionarBtn, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.fundo, borderColor: cores.borda }]} onPress={escolherImagem}>
                <Ionicons name="image-outline" size={17} color={corIcone(cores)} />
                <Text style={[s.imagemAdicionarText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Anexar imagem à notificação (opcional)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[s.enviarBtn, (!titulo || !corpo || enviando) && [s.enviarBtnDisabled, { backgroundColor: cores.isEscuro ? '#3a3556' : '#8e8aa3' }]]}
              onPress={enviar}
              disabled={!titulo || !corpo || enviando}
            >
              {enviando
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={18} color="#fff" />}
              <Text style={s.enviarText}>{enviando ? 'Enviando...' : 'Enviar notificação para todos'}</Text>
            </TouchableOpacity>
          </View>

          {/* Histórico */}
          <Text style={[s.secaoTitulo2, cores.isEscuro && { color: '#d4d4de' }, { color: cores.textoSecundario }]}>Histórico</Text>
          {historico.length === 0 && (
            <EstadoVazio titulo="Nenhuma mensagem enviada ainda." />
          )}
          {historico.map((m) => (
            <View key={m.id} style={[s.histItem, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
              <View style={s.histHeader}>
                <Text style={[s.histTitulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>{m.titulo}</Text>
                <Text style={[s.histData, cores.isEscuro && { color: '#cbcbd6' }, { color: cores.textoSecundario }]}>{formatarData(m.created_at)}</Text>
              </View>
              <Text style={[s.histCorpo, cores.isEscuro && { color: '#e2e2ea' }, { color: cores.texto }]}>{m.corpo}</Text>
              {m.enviado_por && (
                <Text style={[s.histPor, cores.isEscuro && { color: '#d0d0da' }, { color: cores.textoSecundario }]}>Enviado por: {m.enviado_por}</Text>
              )}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f5f3fb' },
  semAcesso:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  semAcessoText:   { color: '#aaa', fontSize: 15 },

  header:          { backgroundColor: '#7c39e7', padding: 20, paddingTop: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:         { padding: 4 },
  titulo:          { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },

  scroll:          { flex: 1 },
  card:            { backgroundColor: '#fff', margin: 16, borderRadius: 18, padding: 16, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  secaoTitulo:     { fontSize: 15, fontWeight: '800', color: '#4b2bb0', marginBottom: 14 },
  secaoTitulo2:    { fontSize: 14, fontWeight: '700', color: '#555', marginHorizontal: 16, marginBottom: 8, marginTop: 4 },

  label:           { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input:           { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, padding: 12, fontSize: 14, color: '#333', backgroundColor: '#fafafa' },
  inputMulti:      { minHeight: 100, textAlignVertical: 'top' },
  contador:        { fontSize: 11, color: '#bbb', textAlign: 'right', marginTop: 4 },
  imagemAdicionarBtn: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, backgroundColor: '#f5f3fb', borderWidth: 1, borderColor: '#d9e2ec', borderStyle: 'dashed' },
  imagemAdicionarText: { color: '#4b2bb0', fontSize: 13, fontWeight: '700' },
  imagemPreviewBox: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#d9e2ec', padding: 8 },
  imagemPreview:    { width: 48, height: 48, borderRadius: 8, backgroundColor: '#eee' },
  imagemPreviewTitulo: { fontSize: 13, fontWeight: '800', color: '#4b2bb0' },
  imagemPreviewSub: { fontSize: 11, color: '#888', marginTop: 2 },
  imagemRemoverBtn: { padding: 4 },

  enviarBtn:       { backgroundColor: '#7c39e7', borderRadius: 22, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
  enviarBtnDisabled: { backgroundColor: '#ccc' },
  enviarText:      { color: '#fff', fontWeight: '800', fontSize: 15 },

  histItem:        { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 18, padding: 14, boxShadow: '0px 4px 0px rgba(80,38,142,0.2)' },
  histHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  histTitulo:      { fontSize: 14, fontWeight: '800', color: '#4b2bb0', flex: 1, marginRight: 8 },
  histData:        { fontSize: 11, color: '#aaa' },
  histCorpo:       { fontSize: 13, color: '#444', lineHeight: 20 },
  histPor:         { fontSize: 11, color: '#bbb', marginTop: 6, fontStyle: 'italic' },

  vazio:           { textAlign: 'center', color: '#aaa', marginTop: 24, fontSize: 14 },







});

import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  aceitaArquivo,
  aceitaTexto,
  assinarArquivo,
  type ArquivoRequisito,
  type RequisitoCatalogo,
} from '../../lib/classesRequisitos';

interface Props {
  requisito: RequisitoCatalogo;
  texto: string;
  arquivos: ArquivoRequisito[];
  editavel: boolean;
  /** Existe uma atividade enviada para este requisito aguardando resposta. */
  atividadeEnviada?: boolean;
  onSalvarTexto: (texto: string) => Promise<void>;
  onEnviarArquivo: (arquivo: { uri: string; nome: string; mime: string }) => Promise<void>;
  onRemoverArquivo: (id: number) => Promise<void>;
  /** Presente somente quando há atividade enviada — manda a resposta para avaliação. */
  onEnviarParaAvaliacao?: () => Promise<void>;
}

export function PainelResposta({
  requisito,
  texto,
  arquivos,
  editavel,
  atividadeEnviada,
  onSalvarTexto,
  onEnviarArquivo,
  onRemoverArquivo,
  onEnviarParaAvaliacao,
}: Props) {
  const [rascunho, setRascunho] = useState(texto);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const sujo = rascunho !== texto;
  const temConteudo = !!rascunho.trim() || arquivos.length > 0;

  useEffect(() => { setRascunho(texto); }, [texto]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const pares = await Promise.all(
        arquivos.map(async (a) => [a.id, await assinarArquivo(a.url)] as const)
      );
      if (cancelado) return;
      const mapa: Record<number, string> = {};
      pares.forEach(([id, url]) => { if (url) mapa[id] = url; });
      setUrls(mapa);
    })();
    return () => { cancelado = true; };
  }, [arquivos]);

  async function salvar() {
    setSalvando(true);
    try { await onSalvarTexto(rascunho); } finally { setSalvando(false); }
  }

  // O documento de identidade sincroniza com a ficha do membro — só aceita imagem.
  const somenteImagem = requisito.documento_campo === 'rg';

  async function escolher(origem: 'camera' | 'arquivo') {
    if (arquivos.length >= requisito.max_arquivos) return;
    let uri = '';
    let nome = '';
    let mime = '';

    if (origem === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
      if (r.canceled || !r.assets[0]) return;
      uri = r.assets[0].uri;
      nome = `foto_${Date.now()}.jpg`;
      mime = 'image/jpeg';
    } else {
      const r = await DocumentPicker.getDocumentAsync({
        type: somenteImagem ? ['image/*'] : ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets[0]) return;
      uri = r.assets[0].uri;
      nome = r.assets[0].name || `arquivo_${Date.now()}`;
      mime = r.assets[0].mimeType || 'application/octet-stream';
    }

    setEnviando(true);
    try { await onEnviarArquivo({ uri, nome, mime }); } finally { setEnviando(false); }
  }

  const podeAnexarMais = arquivos.length < requisito.max_arquivos;

  return (
    <View style={s.box}>
      {aceitaTexto(requisito) && (
        <>
          {!!requisito.rotulo && <Text style={s.rotulo}>{requisito.rotulo}</Text>}
          <TextInput
            style={s.input}
            value={rascunho}
            onChangeText={setRascunho}
            editable={editavel}
            multiline
            placeholder={editavel ? 'Escreva aqui...' : 'Sem resposta registrada.'}
            placeholderTextColor="#a8b3bf"
          />
          {editavel && (
            <TouchableOpacity
              style={[s.btnSalvar, (!sujo || salvando) && s.btnDesativado]}
              onPress={salvar}
              disabled={!sujo || salvando}
            >
              {salvando
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="save-outline" size={14} color="#fff" />}
              <Text style={s.btnSalvarText}>{sujo ? 'Salvar' : 'Salvo'}</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {aceitaArquivo(requisito) && (
        <>
          <Text style={s.rotulo}>
            Anexos ({arquivos.length}/{requisito.max_arquivos})
            {somenteImagem ? ' · aceita apenas foto do documento (sincroniza com a ficha)' : ''}
          </Text>

          <View style={s.anexos}>
            {arquivos.map((a) => (
              <View key={a.id} style={s.anexo}>
                {urls[a.id] && a.tipo === 'image' ? (
                  <Image source={{ uri: urls[a.id] }} style={s.miniatura} resizeMode="cover" />
                ) : (
                  <View style={[s.miniatura, s.miniaturaDoc]}>
                    <Ionicons name={a.tipo === 'pdf' ? 'document-text' : 'document'} size={20} color="#5c6b7a" />
                  </View>
                )}
                <Text style={s.anexoNome} numberOfLines={1}>{a.nome}</Text>
                {a.origem === 'documento' && <Text style={s.anexoOrigem}>da ficha</Text>}
                {editavel && a.origem === 'upload' && (
                  <TouchableOpacity style={s.remover} onPress={() => onRemoverArquivo(a.id)}>
                    <Ionicons name="close-circle" size={16} color="#c62828" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {editavel && podeAnexarMais && (
            <View style={s.botoesUpload}>
              {Platform.OS !== 'web' && (
                <TouchableOpacity style={s.btnUpload} onPress={() => escolher('camera')} disabled={enviando}>
                  <Ionicons name="camera-outline" size={15} color="#1a3a5c" />
                  <Text style={s.btnUploadText}>Câmera</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnUpload} onPress={() => escolher('arquivo')} disabled={enviando}>
                {enviando
                  ? <ActivityIndicator size="small" color="#1a3a5c" />
                  : <Ionicons name="cloud-upload-outline" size={15} color="#1a3a5c" />}
                <Text style={s.btnUploadText}>{enviando ? 'Enviando...' : somenteImagem ? 'Foto' : 'Foto ou PDF'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {!!onEnviarParaAvaliacao && (
        <View style={s.avaliacaoBox}>
          <Text style={s.avaliacaoTexto}>
            {atividadeEnviada ? 'Atividade enviada — preencha e mande para avaliação.' : ''}
          </Text>
          <TouchableOpacity
            style={[s.btnAvaliacao, (!editavel || !temConteudo || enviandoAvaliacao) && s.btnDesativado]}
            disabled={!editavel || !temConteudo || enviandoAvaliacao}
            onPress={async () => {
              setEnviandoAvaliacao(true);
              try { await onEnviarParaAvaliacao(); } finally { setEnviandoAvaliacao(false); }
            }}
          >
            {enviandoAvaliacao
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="checkmark-done" size={16} color="#fff" />}
            <Text style={s.btnAvaliacaoText}>
              {enviandoAvaliacao ? 'Enviando...' : 'Enviar para avaliação'}
            </Text>
          </TouchableOpacity>
          {!temConteudo && editavel && (
            <Text style={s.avaliacaoDica}>Escreva algo ou anexe um arquivo antes de enviar.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginTop: 8, gap: 6 },
  rotulo: { fontSize: 11, fontWeight: '700', color: '#52606d', textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dde4ec',
    padding: 10,
    fontSize: 13,
    color: '#1f2933',
    minHeight: 64,
    textAlignVertical: 'top',
  },
  btnSalvar: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1a3a5c',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnDesativado: { backgroundColor: '#9fb0c2' },
  btnSalvarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  anexos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  anexo: { width: 78, alignItems: 'center' },
  miniatura: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#e8eef4' },
  miniaturaDoc: { alignItems: 'center', justifyContent: 'center' },
  anexoNome: { fontSize: 9, color: '#5c6b7a', marginTop: 3, textAlign: 'center' },
  anexoOrigem: { fontSize: 8, color: '#7c3aed', fontWeight: '700' },
  remover: { position: 'absolute', top: -4, right: 4 },
  botoesUpload: { flexDirection: 'row', gap: 8 },
  btnUpload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#eef5fb',
    borderWidth: 1,
    borderColor: '#cfe0ef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnUploadText: { fontSize: 12, fontWeight: '700', color: '#1a3a5c' },
  avaliacaoBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 6 },
  avaliacaoTexto: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  btnAvaliacao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10,
  },
  btnAvaliacaoText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  avaliacaoDica: { fontSize: 10, color: '#9aa5b1', textAlign: 'center' },
});

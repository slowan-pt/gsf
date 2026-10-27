import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from './ModalSeguro';
import { avisar } from '../stores/avisoStore';
import { useCores } from '../stores/temaStore';
import { corIcone } from '../lib/tema';
import {
  CONFIG_LER_HOJE_PADRAO,
  TAMANHO_MAXIMO_SOM,
  carregarConfigLerHoje,
  enviarSomLerHoje,
  salvarConfigLerHoje,
  tipoSomPermitido,
  type ConfigLerHoje,
} from '../lib/lerHojeConfig';
import { prepararSomArcade, tocarBatida } from '../lib/somArcade';
import { reagendarLembreteLerHoje } from '../lib/lembreteLerHoje';

interface Props {
  visivel: boolean;
  clubeId: number;
  /** Membro do usuário logado, para reagendar o lembrete neste aparelho depois de salvar. */
  dbvId?: number | string | null;
  onFechar: () => void;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const soNumeros = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

/** Som das batidas da bolinha "Ler hoje" e lembrete diário de estudo — valem para todo o clube. */
export function LerHojeConfigModal({ visivel, clubeId, dbvId, onFechar }: Props) {
  const cores = useCores();
  const [config, setConfig] = useState<ConfigLerHoje>(CONFIG_LER_HOJE_PADRAO);
  const [hora, setHora] = useState('19');
  const [minuto, setMinuto] = useState('00');
  const [carregando, setCarregando] = useState(false);
  const [enviandoSom, setEnviandoSom] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visivel) return;
    let ativo = true;
    setCarregando(true);
    carregarConfigLerHoje(clubeId)
      .then((c) => {
        if (!ativo) return;
        setConfig(c);
        setHora(doisDigitos(c.lembrete_hora));
        setMinuto(doisDigitos(c.lembrete_minuto));
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [visivel, clubeId]);

  const atualizar = <K extends keyof ConfigLerHoje>(campo: K, valor: ConfigLerHoje[K]) =>
    setConfig((c) => ({ ...c, [campo]: valor }));

  async function escolherSom() {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets[0]) return;
      const arq = r.assets[0];
      const mime = tipoSomPermitido(arq.name || '', arq.mimeType);
      if (!mime) { avisar('Use um arquivo de som MP3, WAV, OGG, M4A ou AAC.', 'erro', 'Formato não permitido'); return; }
      if (arq.size && arq.size > TAMANHO_MAXIMO_SOM) { avisar('O som deve ter no máximo 1 MB. Use um efeito curto.', 'erro', 'Arquivo grande'); return; }
      setEnviandoSom(true);
      const corpo = await (await fetch(arq.uri)).blob();
      const url = await enviarSomLerHoje(clubeId, corpo, mime);
      atualizar('som_url', url);
      await prepararSomArcade({ som_ativo: true, som_url: url });
      tocarBatida();
      avisar('Som enviado. Toque em Salvar para aplicar em todos os aparelhos.', 'sucesso', 'Som pronto');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível enviar o som.', 'erro', 'Falha no envio');
    } finally {
      setEnviandoSom(false);
    }
  }

  async function testarSom() {
    await prepararSomArcade({ som_ativo: true, som_url: config.som_url });
    tocarBatida();
  }

  async function salvar() {
    const h = Number(hora);
    const m = Number(minuto);
    if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
      avisar('Informe um horário válido (hora de 0 a 23, minuto de 0 a 59).', 'erro', 'Horário inválido');
      return;
    }
    setSalvando(true);
    try {
      const salva = await salvarConfigLerHoje(clubeId, { ...config, lembrete_hora: h, lembrete_minuto: m });
      await prepararSomArcade(salva);
      reagendarLembreteLerHoje(clubeId, dbvId ?? null).catch(() => {});
      avisar('Os aparelhos recebem a nova configuração na próxima vez que abrirem o app.', 'sucesso', 'Salvo');
      onFechar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar.', 'erro', 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  const entrada = [s.input, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }];
  const botao = [s.botaoSec, { borderColor: cores.borda, backgroundColor: cores.cartao }];

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={[s.overlay, { backgroundColor: cores.overlay }]}>
        <View style={[s.caixa, { backgroundColor: cores.cartao }]}>
          <Text style={[s.titulo, { color: cores.texto }]}>Ler hoje: som e lembrete</Text>
          {carregando ? <ActivityIndicator color={corIcone(cores)} style={{ marginVertical: 24 }} /> : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[s.secao, { color: cores.texto }]}>Som da bolinha</Text>
              <View style={s.linha}>
                <Text style={[s.rotulo, { color: cores.texto }]}>Tocar som ao bater nas bordas</Text>
                <Switch value={config.som_ativo} onValueChange={(v) => atualizar('som_ativo', v)} />
              </View>
              <Text style={[s.dica, { color: cores.textoSecundario }]}>
                {config.som_url ? 'Som personalizado do clube ativo.' : 'Usando o som de fliperama padrão do app.'} O mesmo som toca em todos os aparelhos.
              </Text>
              <View style={s.linha}>
                <TouchableOpacity style={botao} onPress={escolherSom} disabled={enviandoSom} accessibilityRole="button">
                  {enviandoSom ? <ActivityIndicator size="small" color={corIcone(cores)} /> : <Ionicons name="cloud-upload-outline" size={17} color={corIcone(cores)} />}
                  <Text style={[s.botaoTxt, { color: cores.texto }]}>Subir som</Text>
                </TouchableOpacity>
                <TouchableOpacity style={botao} onPress={testarSom} accessibilityRole="button">
                  <Ionicons name="play-outline" size={17} color={corIcone(cores)} />
                  <Text style={[s.botaoTxt, { color: cores.texto }]}>Testar</Text>
                </TouchableOpacity>
                {config.som_url ? (
                  <TouchableOpacity style={botao} onPress={() => atualizar('som_url', null)} accessibilityRole="button">
                    <Ionicons name="refresh-outline" size={17} color={corIcone(cores)} />
                    <Text style={[s.botaoTxt, { color: cores.texto }]}>Padrão</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={[s.dica, { color: cores.textoSecundario }]}>MP3, WAV, OGG, M4A ou AAC, até 1 MB. Prefira efeitos curtos.</Text>

              <Text style={[s.secao, { color: cores.texto, marginTop: 18 }]}>Lembrete diário de estudo</Text>
              <View style={s.linha}>
                <Text style={[s.rotulo, { color: cores.texto }]}>Enviar lembrete todos os dias</Text>
                <Switch value={config.lembrete_ativo} onValueChange={(v) => atualizar('lembrete_ativo', v)} />
              </View>
              {config.lembrete_ativo ? (
                <>
                  <View style={s.linha}>
                    <Text style={[s.rotulo, { color: cores.texto }]}>Horário</Text>
                    <TextInput style={[...entrada, s.hora]} value={hora} onChangeText={(v) => setHora(soNumeros(v, 2))} keyboardType="number-pad" maxLength={2} accessibilityLabel="Hora do lembrete" />
                    <Text style={{ color: cores.texto, fontWeight: '900' }}>:</Text>
                    <TextInput style={[...entrada, s.hora]} value={minuto} onChangeText={(v) => setMinuto(soNumeros(v, 2))} keyboardType="number-pad" maxLength={2} accessibilityLabel="Minuto do lembrete" />
                  </View>
                  <Text style={[s.dica, { color: cores.textoSecundario }]}>Horário do aparelho de cada pessoa. Quem já leu no dia não recebe o lembrete.</Text>
                  <TextInput style={entrada} value={config.lembrete_titulo} onChangeText={(v) => atualizar('lembrete_titulo', v)} maxLength={80} placeholder="Título" placeholderTextColor={cores.textoSecundario} />
                  <TextInput style={[...entrada, { minHeight: 64, textAlignVertical: 'top' }]} value={config.lembrete_texto} onChangeText={(v) => atualizar('lembrete_texto', v)} maxLength={180} multiline placeholder="Mensagem" placeholderTextColor={cores.textoSecundario} />
                  <Text style={[s.dica, { color: cores.textoSecundario }]}>Ao tocar na notificação, o app abre direto no Ler hoje.</Text>
                </>
              ) : null}
            </ScrollView>
          )}
          <View style={s.rodape}>
            <TouchableOpacity style={botao} onPress={onFechar} accessibilityRole="button"><Text style={[s.botaoTxt, { color: cores.texto }]}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[s.botaoPri, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando || carregando} accessibilityRole="button">
              {salvando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.botaoPriTxt}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 16 },
  caixa: { borderRadius: 16, padding: 18, maxHeight: '90%' },
  titulo: { fontSize: 17, fontWeight: '900', marginBottom: 10 },
  secao: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6, flexWrap: 'wrap' },
  rotulo: { flex: 1, fontSize: 14, minWidth: 140 },
  dica: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginTop: 6 },
  hora: { width: 54, textAlign: 'center', marginTop: 0 },
  botaoSec: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  botaoTxt: { fontSize: 13, fontWeight: '700' },
  rodape: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  botaoPri: { backgroundColor: '#4b2bb0', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, minWidth: 90, alignItems: 'center' },
  botaoPriTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

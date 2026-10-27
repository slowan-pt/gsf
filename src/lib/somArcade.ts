import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { bytesParaBase64 } from './logoClube';
import type { ConfigLerHoje } from './lerHojeConfig';

/**
 * Som das batidas da bolinha "Ler hoje". Sem som enviado pelo admin, usa três "blips" de
 * fliperama gerados aqui mesmo (onda quadrada com varredura de tom) — nenhum arquivo no app.
 * Com som enviado, toca o do clube em toda batida.
 */
const TAXA = 22050;
const INTERVALO_MIN_MS = 70; // batidas em sequência rápida não viram um chiado.

/** Blip: onda quadrada que sobe de f0 a f1 com decaimento rápido. Devolve um WAV 16 bits mono. */
function gerarBlipWav(f0: number, f1: number, duracaoMs: number): Uint8Array {
  const n = Math.floor((TAXA * duracaoMs) / 1000);
  const dados = new Int16Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = f0 + (f1 - f0) * t;
    fase += freq / TAXA;
    const quadrada = fase % 1 < 0.5 ? 1 : -1;
    const envelope = Math.pow(1 - t, 1.6);
    dados[i] = Math.round(quadrada * envelope * 0.35 * 32767);
  }
  const bytes = new Uint8Array(44 + dados.length * 2);
  const v = new DataView(bytes.buffer);
  const texto = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  texto(0, 'RIFF'); v.setUint32(4, 36 + dados.length * 2, true); texto(8, 'WAVE');
  texto(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, TAXA, true); v.setUint32(28, TAXA * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  texto(36, 'data'); v.setUint32(40, dados.length * 2, true);
  for (let i = 0; i < dados.length; i++) v.setInt16(44 + i * 2, dados[i], true);
  return bytes;
}

const VARIACOES_PADRAO: [number, number, number][] = [
  [520, 1250, 110],
  [740, 1560, 95],
  [390, 980, 130],
];

let players: AudioPlayer[] = [];
let fonteAtual = '';
let indice = 0;
let ultimoToque = 0;
let preparando: Promise<void> | null = null;

async function urisPadrao(): Promise<string[]> {
  const wavs = VARIACOES_PADRAO.map(([a, b, d]) => gerarBlipWav(a, b, d));
  if (Platform.OS === 'web') {
    return wavs.map((w) => `data:audio/wav;base64,${bytesParaBase64(w)}`);
  }
  const saida: string[] = [];
  for (let i = 0; i < wavs.length; i++) {
    const destino = `${FileSystemLegacy.cacheDirectory}ler_hoje_blip_${i}.wav`;
    await FileSystemLegacy.writeAsStringAsync(destino, bytesParaBase64(wavs[i]), {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    saida.push(destino);
  }
  return saida;
}

function liberar() {
  for (const p of players) { try { p.remove(); } catch { /* já liberado */ } }
  players = [];
}

/** Carrega os players do som atual (o do clube ou o padrão). Chame ao montar a bolinha e ao mudar a configuração. */
export function prepararSomArcade(config: Pick<ConfigLerHoje, 'som_ativo' | 'som_url'>): Promise<void> {
  const fonte = config.som_ativo ? (config.som_url ?? 'padrao') : 'mudo';
  if (fonte === fonteAtual && players.length > 0) return Promise.resolve();
  if (fonte === 'mudo') { liberar(); fonteAtual = fonte; return Promise.resolve(); }

  preparando = (async () => {
    try {
      // Efeito de jogo: toca junto com outros áudios e mesmo com o celular no silencioso do iOS.
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
      const uris = fonte === 'padrao' ? await urisPadrao() : [fonte];
      liberar();
      players = uris.map((uri) => createAudioPlayer({ uri }, { keepAudioSessionActive: false } as any));
      fonteAtual = fonte;
      indice = 0;
    } catch {
      // Sem som não é motivo para atrapalhar a bolinha.
      liberar();
      fonteAtual = '';
    }
  })();
  return preparando;
}


/** Toca a batida. Seguro de chamar a cada quique: ignora se não houver som ou se for cedo demais. */
export function tocarBatida() {
  const agora = Date.now();
  if (players.length === 0 || agora - ultimoToque < INTERVALO_MIN_MS) return;
  ultimoToque = agora;
  const player = players[indice % players.length];
  indice++;
  try {
    player.seekTo(0).catch?.(() => {});
    player.play();
  } catch {
    // ignora falhas de reprodução
  }
}

/** Libera os players (desmontagem da bolinha). */
export function liberarSomArcade() {
  liberar();
  fonteAtual = '';
}

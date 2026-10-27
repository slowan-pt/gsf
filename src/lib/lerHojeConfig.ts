import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { enviarArquivo } from './arquivos';

export interface ConfigLerHoje {
  som_ativo: boolean;
  /** null = som arcade padrão do app. */
  som_url: string | null;
  lembrete_ativo: boolean;
  lembrete_hora: number;
  lembrete_minuto: number;
  lembrete_titulo: string;
  lembrete_texto: string;
}

export const CONFIG_LER_HOJE_PADRAO: ConfigLerHoje = {
  som_ativo: true,
  som_url: null,
  lembrete_ativo: true,
  lembrete_hora: 19,
  lembrete_minuto: 0,
  lembrete_titulo: 'Hora do estudo 📖',
  lembrete_texto: 'Sua leitura de hoje está esperando. Toque para ler agora.',
};

const CAMPOS = Object.keys(CONFIG_LER_HOJE_PADRAO).join(', ');
const chaveCache = (clubeId: number) => `config_ler_hoje_v1_${clubeId}`;

function inteiro(valor: unknown, min: number, max: number, padrao: number) {
  const n = Math.trunc(Number(valor));
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
}

export function normalizarConfigLerHoje(bruto: Partial<ConfigLerHoje> | null | undefined): ConfigLerHoje {
  const b = bruto ?? {};
  const p = CONFIG_LER_HOJE_PADRAO;
  return {
    som_ativo: typeof b.som_ativo === 'boolean' ? b.som_ativo : p.som_ativo,
    som_url: typeof b.som_url === 'string' && /^https?:\/\//i.test(b.som_url) ? b.som_url : null,
    lembrete_ativo: typeof b.lembrete_ativo === 'boolean' ? b.lembrete_ativo : p.lembrete_ativo,
    lembrete_hora: inteiro(b.lembrete_hora, 0, 23, p.lembrete_hora),
    lembrete_minuto: inteiro(b.lembrete_minuto, 0, 59, p.lembrete_minuto),
    lembrete_titulo: String(b.lembrete_titulo ?? '').trim().slice(0, 80) || p.lembrete_titulo,
    lembrete_texto: String(b.lembrete_texto ?? '').trim().slice(0, 180) || p.lembrete_texto,
  };
}

/** Última configuração conhecida neste aparelho (funciona offline). */
export async function configLerHojeEmCache(clubeId: number): Promise<ConfigLerHoje> {
  try {
    const raw = await AsyncStorage.getItem(chaveCache(clubeId));
    return normalizarConfigLerHoje(raw ? JSON.parse(raw) : null);
  } catch {
    return CONFIG_LER_HOJE_PADRAO;
  }
}

/** Lê do servidor (sem linha = padrão) e guarda a cópia local. Sem rede, devolve a cópia local. */
export async function carregarConfigLerHoje(clubeId: number): Promise<ConfigLerHoje> {
  try {
    const { data, error } = await supabase
      .from('config_ler_hoje')
      .select(CAMPOS)
      .eq('clube_id', clubeId)
      .maybeSingle();
    if (error) throw error;
    const config = normalizarConfigLerHoje(data as Partial<ConfigLerHoje> | null);
    AsyncStorage.setItem(chaveCache(clubeId), JSON.stringify(config)).catch(() => {});
    return config;
  } catch {
    return configLerHojeEmCache(clubeId);
  }
}

export async function salvarConfigLerHoje(clubeId: number, config: ConfigLerHoje): Promise<ConfigLerHoje> {
  const limpa = normalizarConfigLerHoje(config);
  const { error } = await supabase
    .from('config_ler_hoje')
    .upsert({ clube_id: clubeId, ...limpa, updated_at: new Date().toISOString() }, { onConflict: 'clube_id' });
  if (error) throw error;
  AsyncStorage.setItem(chaveCache(clubeId), JSON.stringify(limpa)).catch(() => {});
  return limpa;
}

export const TAMANHO_MAXIMO_SOM = 1024 * 1024; // 1 MB: som curto, baixado em todos os aparelhos.

const EXTENSOES_SOM: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
};

/** Tipo MIME aceito para o som, ou null se o arquivo não for um áudio permitido. */
export function tipoSomPermitido(nome: string, mime?: string | null): string | null {
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  if (EXTENSOES_SOM[ext]) return EXTENSOES_SOM[ext];
  return mime && /^audio\/(mpeg|wav|x-wav|ogg|mp4|aac)$/i.test(mime) ? mime : null;
}

/** Envia o som do clube (sobrescreve o anterior) e devolve a URL pública, já com versão para furar o cache. */
export async function enviarSomLerHoje(clubeId: number, corpo: Blob, mime: string): Promise<string> {
  if (corpo.size > TAMANHO_MAXIMO_SOM) throw new Error('O som deve ter no máximo 1 MB. Use um efeito curto.');
  const ext = Object.entries(EXTENSOES_SOM).find(([, m]) => m === mime)?.[0] ?? 'mp3';
  const url = await enviarArquivo('atividades', `sons/ler-hoje-${clubeId}-${Date.now()}.${ext}`, corpo, { contentType: mime });
  return url;
}

import { supabase } from './supabase';

export interface ConfigRanking {
  diretoria_tipo_dbv: boolean;
  diretoria_tipo_diretoria: boolean;
  diretoria_tipo_conselheiros: boolean;
  diretoria_tipo_unidades: boolean;
  membros_tipo_dbv: boolean;
  membros_tipo_diretoria: boolean;
  membros_tipo_conselheiros: boolean;
  membros_tipo_unidades: boolean;
  /** Sem acesso à lista completa, um DBV/pai ainda vê o próprio cartão de
   * posição — esses dois controlam o que aparece nele. */
  membros_ve_pontuacao: boolean;
  membros_ve_posicao: boolean;
  /** Anos cujos pontos contam pro ranking. Vazio = só o ano corrente (padrão). */
  anos_ranking: number[];
}

export const CONFIG_RANKING_PADRAO: ConfigRanking = {
  diretoria_tipo_dbv: true,
  diretoria_tipo_diretoria: true,
  diretoria_tipo_conselheiros: true,
  diretoria_tipo_unidades: true,
  membros_tipo_dbv: true,
  membros_tipo_diretoria: true,
  membros_tipo_conselheiros: true,
  membros_tipo_unidades: true,
  membros_ve_pontuacao: true,
  membros_ve_posicao: true,
  anos_ranking: [],
};

const CAMPOS_BOOLEANOS = (Object.keys(CONFIG_RANKING_PADRAO) as (keyof ConfigRanking)[])
  .filter((c) => c !== 'anos_ranking');

/** Anos que devem contar pro ranking, já resolvendo o padrão (vazio = ano corrente). */
export function anosEfetivosRanking(config: Pick<ConfigRanking, 'anos_ranking'>): number[] {
  if (config.anos_ranking && config.anos_ranking.length > 0) return config.anos_ranking;
  return [new Date().getFullYear()];
}

/** Sem linha configurada ainda para o clube = tudo visível (comportamento anterior a esta funcionalidade). */
export async function carregarConfigRanking(clubeId: number): Promise<ConfigRanking> {
  try {
    const { data, error } = await supabase
      .from('config_ranking')
      .select([...CAMPOS_BOOLEANOS, 'anos_ranking'].join(', '))
      .eq('clube_id', clubeId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return CONFIG_RANKING_PADRAO;
    const linha = data as unknown as Record<string, boolean | number[] | null>;
    const resultado = { ...CONFIG_RANKING_PADRAO };
    for (const campo of CAMPOS_BOOLEANOS) {
      resultado[campo] = (linha[campo] as boolean) ?? true;
    }
    resultado.anos_ranking = Array.isArray(linha.anos_ranking) ? linha.anos_ranking.map(Number) : [];
    return resultado;
  } catch {
    return CONFIG_RANKING_PADRAO;
  }
}

export async function salvarConfigRanking(clubeId: number, config: ConfigRanking): Promise<void> {
  const { error } = await supabase
    .from('config_ranking')
    .upsert({ clube_id: clubeId, ...config, updated_at: new Date().toISOString() }, { onConflict: 'clube_id' });
  if (error) throw error;
}

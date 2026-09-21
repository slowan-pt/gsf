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
};

/** Configuracao conservadora usada enquanto a leitura remota nao terminou. */
export const CONFIG_RANKING_RESTRITA: ConfigRanking = {
  ...CONFIG_RANKING_PADRAO,
  membros_tipo_dbv: false,
  membros_tipo_diretoria: false,
  membros_tipo_conselheiros: false,
  membros_tipo_unidades: false,
  membros_ve_pontuacao: false,
  membros_ve_posicao: false,
};

const CAMPOS_BOOLEANOS = Object.keys(CONFIG_RANKING_PADRAO) as (keyof ConfigRanking)[];

/** O ranking e os extratos sempre representam somente o ano corrente. */
export function anosEfetivosRanking(_config?: ConfigRanking): number[] {
  return [new Date().getFullYear()];
}

/** Sem linha configurada ainda para o clube = tudo visível (comportamento anterior a esta funcionalidade). */
export async function carregarConfigRanking(clubeId: number): Promise<ConfigRanking> {
  try {
    const { data, error } = await supabase
      .from('config_ranking')
      .select(CAMPOS_BOOLEANOS.join(', '))
      .eq('clube_id', clubeId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return CONFIG_RANKING_PADRAO;
    const linha = data as unknown as Record<string, boolean | null>;
    const resultado = { ...CONFIG_RANKING_PADRAO };
    for (const campo of CAMPOS_BOOLEANOS) {
      resultado[campo] = (linha[campo] as boolean) ?? true;
    }
    return resultado;
  } catch (error) {
    // Falha de permissao/rede nao pode virar "tudo liberado".
    throw error;
  }
}

export async function salvarConfigRanking(clubeId: number, config: ConfigRanking): Promise<void> {
  const { error } = await supabase
    .from('config_ranking')
    .upsert({ clube_id: clubeId, ...config, updated_at: new Date().toISOString() }, { onConflict: 'clube_id' });
  if (error) throw error;
}

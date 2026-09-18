import { supabase } from './supabase';

export interface ConfigRanking {
  visivel_diretoria: boolean;
  visivel_membros: boolean;
  diretoria_tipo_dbv: boolean;
  diretoria_tipo_diretoria: boolean;
  diretoria_tipo_conselheiros: boolean;
  diretoria_tipo_unidades: boolean;
  membros_tipo_dbv: boolean;
  membros_tipo_diretoria: boolean;
  membros_tipo_conselheiros: boolean;
  membros_tipo_unidades: boolean;
}

export const CONFIG_RANKING_PADRAO: ConfigRanking = {
  visivel_diretoria: true,
  visivel_membros: true,
  diretoria_tipo_dbv: true,
  diretoria_tipo_diretoria: true,
  diretoria_tipo_conselheiros: true,
  diretoria_tipo_unidades: true,
  membros_tipo_dbv: true,
  membros_tipo_diretoria: true,
  membros_tipo_conselheiros: true,
  membros_tipo_unidades: true,
};

const CAMPOS = Object.keys(CONFIG_RANKING_PADRAO) as (keyof ConfigRanking)[];

/** Sem linha configurada ainda para o clube = tudo visível (comportamento anterior a esta funcionalidade). */
export async function carregarConfigRanking(clubeId: number): Promise<ConfigRanking> {
  try {
    const { data, error } = await supabase
      .from('config_ranking')
      .select(CAMPOS.join(', '))
      .eq('clube_id', clubeId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return CONFIG_RANKING_PADRAO;
    const linha = data as unknown as Record<string, boolean | null>;
    const resultado = { ...CONFIG_RANKING_PADRAO };
    for (const campo of CAMPOS) {
      resultado[campo] = linha[campo] ?? true;
    }
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

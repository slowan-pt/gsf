import { supabase } from './supabase';

export interface ConfigRanking {
  visivel_diretoria: boolean;
  visivel_membros: boolean;
  tipo_dbv: boolean;
  tipo_diretoria: boolean;
  tipo_conselheiros: boolean;
  tipo_unidades: boolean;
}

export const CONFIG_RANKING_PADRAO: ConfigRanking = {
  visivel_diretoria: true,
  visivel_membros: true,
  tipo_dbv: true,
  tipo_diretoria: true,
  tipo_conselheiros: true,
  tipo_unidades: true,
};

/** Sem linha configurada ainda para o clube = tudo visível (comportamento anterior a esta funcionalidade). */
export async function carregarConfigRanking(clubeId: number): Promise<ConfigRanking> {
  try {
    const { data, error } = await supabase
      .from('config_ranking')
      .select('visivel_diretoria, visivel_membros, tipo_dbv, tipo_diretoria, tipo_conselheiros, tipo_unidades')
      .eq('clube_id', clubeId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return CONFIG_RANKING_PADRAO;
    return {
      visivel_diretoria: data.visivel_diretoria ?? true,
      visivel_membros: data.visivel_membros ?? true,
      tipo_dbv: data.tipo_dbv ?? true,
      tipo_diretoria: data.tipo_diretoria ?? true,
      tipo_conselheiros: data.tipo_conselheiros ?? true,
      tipo_unidades: data.tipo_unidades ?? true,
    };
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

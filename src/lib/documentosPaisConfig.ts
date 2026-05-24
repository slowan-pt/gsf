import { supabase } from './supabase';
import { getClubeAtivoId } from './contextoAtual';

export interface DocumentosPaisConfig {
  clube_id: number;
  pais_podem_editar: boolean;
  editar_de: string | null;
  editar_ate: string | null;
}

export async function carregarDocumentosPaisConfig(clubeId = getClubeAtivoId()): Promise<DocumentosPaisConfig> {
  try {
    const { data, error } = await supabase
      .from('documentos_pais_config')
      .select('clube_id,pais_podem_editar,editar_de,editar_ate')
      .eq('clube_id', clubeId)
      .maybeSingle();
    if (error) throw error;
    return {
      clube_id: clubeId,
      pais_podem_editar: !!data?.pais_podem_editar,
      editar_de: data?.editar_de ?? null,
      editar_ate: data?.editar_ate ?? null,
    };
  } catch {
    return { clube_id: clubeId, pais_podem_editar: false, editar_de: null, editar_ate: null };
  }
}

export function janelaPaisAberta(config: DocumentosPaisConfig, hoje = new Date()) {
  if (!config.pais_podem_editar) return false;
  const hojeIso = hoje.toISOString().slice(0, 10);
  if (config.editar_de && hojeIso < config.editar_de) return false;
  if (config.editar_ate && hojeIso > config.editar_ate) return false;
  return true;
}

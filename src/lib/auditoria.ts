import { supabase } from './supabase';
import { getClubeAtivoId } from './contextoAtual';

interface AuditoriaInput {
  acao: string;
  entidade?: string | null;
  entidadeId?: string | number | null;
  membroId?: number | null;
  alvoUserId?: string | null;
  antes?: unknown;
  depois?: unknown;
  metadata?: Record<string, unknown>;
  clubeId?: number;
}

export async function registrarAuditoria(input: AuditoriaInput): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('registrar_auditoria', {
      p_clube_id: input.clubeId ?? getClubeAtivoId(),
      p_acao: input.acao,
      p_entidade: input.entidade ?? null,
      p_entidade_id: input.entidadeId == null ? null : String(input.entidadeId),
      p_membro_id: input.membroId ?? null,
      p_alvo_user_id: input.alvoUserId ?? null,
      p_antes: input.antes ?? null,
      p_depois: input.depois ?? null,
      p_metadata: input.metadata ?? {},
    });
    if (error) throw error;
    return data as string;
  } catch (e) {
    console.warn('Falha ao registrar auditoria:', e);
    return null;
  }
}


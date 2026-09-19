import { supabase } from './supabase';

export type ModoExibicaoMembro = 'nome' | 'nome_foto' | 'foto';

export const MODO_EXIBICAO_PADRAO: ModoExibicaoMembro = 'nome';

/**
 * Modo de exibição (nome/foto) nos relatórios é por USUÁRIO, não por clube —
 * mesmo raciocínio de `paletaAtividades.ts`: cada pessoa escolhe o próprio e
 * ele aparece assim em qualquer aparelho em que fizer login.
 */
export async function carregarModoExibicaoRelatorios(usuarioId?: string | null): Promise<ModoExibicaoMembro> {
  if (!usuarioId) return MODO_EXIBICAO_PADRAO;
  const { data, error } = await supabase
    .from('configuracoes_visuais_usuario')
    .select('modo_exibicao_relatorios')
    .eq('usuario_id', usuarioId)
    .maybeSingle();
  if (error || !data) return MODO_EXIBICAO_PADRAO;
  return (data.modo_exibicao_relatorios as ModoExibicaoMembro) ?? MODO_EXIBICAO_PADRAO;
}

export async function salvarModoExibicaoRelatorios(usuarioId: string, modo: ModoExibicaoMembro): Promise<void> {
  const { error } = await supabase
    .from('configuracoes_visuais_usuario')
    .upsert({ usuario_id: usuarioId, modo_exibicao_relatorios: modo, updated_at: new Date().toISOString() }, { onConflict: 'usuario_id' });
  if (error) throw error;
}

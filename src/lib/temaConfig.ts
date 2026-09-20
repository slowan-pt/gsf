import { supabase } from './supabase';

/** Modo escuro é por USUÁRIO (login) — mesma tabela/raciocínio de
 * configuracoes_visuais_usuario já usada pra cor de cabeçalho/relatórios. */
export async function carregarModoEscuro(usuarioId?: string | null): Promise<boolean> {
  if (!usuarioId) return false;
  const { data, error } = await supabase
    .from('configuracoes_visuais_usuario')
    .select('modo_escuro')
    .eq('usuario_id', usuarioId)
    .maybeSingle();
  if (error || !data) return false;
  return !!data.modo_escuro;
}

export async function salvarModoEscuro(usuarioId: string, escuro: boolean): Promise<void> {
  const { error } = await supabase
    .from('configuracoes_visuais_usuario')
    .upsert({ usuario_id: usuarioId, modo_escuro: escuro, updated_at: new Date().toISOString() }, { onConflict: 'usuario_id' });
  if (error) throw error;
}

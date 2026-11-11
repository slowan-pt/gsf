import { supabase } from './supabase';
import { buscarPaginado } from './supabasePaginado';
import { enviarArquivo } from './arquivos';
import { uriParaUploadBody } from './storageUpload';
import { registrarAuditoria } from './auditoria';
import { capaDosAnexos, formParaPayload, type AnexoPatrimonio, type FormPatrimonio, type ItemPatrimonio } from './patrimonioNucleo';

/** Módulo Patrimônio (inventário). Tabela patrimonio_itens; regras de permissão no banco (migration 154). */

export async function carregarItensPatrimonio(clubeId: number): Promise<ItemPatrimonio[]> {
  return buscarPaginado<ItemPatrimonio>((q) => q.eq('clube_id', clubeId), 'patrimonio_itens', '*', 'codigo');
}

export async function carregarItemPatrimonio(id: number): Promise<ItemPatrimonio | null> {
  const { data, error } = await supabase.from('patrimonio_itens').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as ItemPatrimonio | null) ?? null;
}

/** Cria o item (entra como ativo; o código é definido pelo banco) e devolve a linha criada. */
export async function criarItemPatrimonio(clubeId: number, form: FormPatrimonio, anexos: AnexoPatrimonio[]): Promise<ItemPatrimonio> {
  const { data, error } = await supabase
    .from('patrimonio_itens')
    .insert({ clube_id: clubeId, ...formParaPayload(form), anexos, foto_url: capaDosAnexos(anexos) })
    .select('*')
    .single();
  if (error) throw error;
  const item = data as ItemPatrimonio;
  void registrarAuditoria({ clubeId, acao: 'patrimonio.cadastrar', entidade: 'patrimonio_itens', entidadeId: item.id, depois: { codigo: item.codigo, descricao: item.descricao } });
  return item;
}

export async function atualizarItemPatrimonio(item: ItemPatrimonio, form: FormPatrimonio, anexos: AnexoPatrimonio[]): Promise<ItemPatrimonio> {
  const { data, error } = await supabase
    .from('patrimonio_itens')
    .update({ ...formParaPayload(form), anexos, foto_url: capaDosAnexos(anexos) })
    .eq('id', item.id)
    .select('*')
    .single();
  if (error) throw error;
  void registrarAuditoria({ clubeId: item.clube_id, acao: 'patrimonio.editar', entidade: 'patrimonio_itens', entidadeId: item.id, metadata: { codigo: item.codigo } });
  return data as ItemPatrimonio;
}

async function mudarStatus(item: ItemPatrimonio, status: ItemPatrimonio['status'], extra: Record<string, unknown> = {}, acao: string): Promise<ItemPatrimonio> {
  const { data, error } = await supabase
    .from('patrimonio_itens')
    .update({ status, ...extra })
    .eq('id', item.id)
    .select('*')
    .single();
  if (error) throw error;
  void registrarAuditoria({ clubeId: item.clube_id, acao, entidade: 'patrimonio_itens', entidadeId: item.id, antes: { status: item.status }, depois: { status }, metadata: { codigo: item.codigo } });
  return data as ItemPatrimonio;
}

export const baixarItemPatrimonio = (item: ItemPatrimonio, motivo: string) =>
  mudarStatus(item, 'baixado', { motivo_baixa: motivo.trim() || null }, 'patrimonio.baixar');

/** Envia um anexo do item (foto da câmera/galeria ou PDF) e devolve a URL pública. Fotos são reduzidas; PDF vai como está. */
export async function enviarAnexoPatrimonio(clubeId: number, uri: string, mime: string, tipo: AnexoPatrimonio['tipo']): Promise<string> {
  const pdf = tipo === 'pdf';
  const tipoArquivo = pdf ? 'application/pdf' : mime || 'image/jpeg';
  const corpo = await uriParaUploadBody(uri, tipoArquivo, pdf ? undefined : { maxDimensao: 1280, qualidade: 0.75 });
  const ext = pdf ? 'pdf' : tipoArquivo.includes('png') ? 'png' : 'jpg';
  const nome = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  return enviarArquivo('atividades', `patrimonio/${clubeId}/${nome}`, corpo as any, { contentType: tipoArquivo });
}

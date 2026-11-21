export type DadosMembroImportacao = {
  nome: string; id_sgc: string | null; genero?: string; data_nascimento?: string; idade?: number;
  cargo?: string; cargo_adicional?: string; unidade_id?: number | null; unidade_nome?: string;
  email?: string; contato?: string; camisa?: string; calca?: string; tipo_sanguineo?: string; fator_rh?: string;
};

export const CAMPOS_IMPORTACAO_MEMBRO = [
  ['nome', 'Nome completo'], ['genero', 'Gênero'], ['data_nascimento', 'Data de nascimento'],
  ['cargo', 'Cargo'], ['cargo_adicional', 'Função adicional'], ['unidade_nome', 'Unidade'],
  ['email', 'E-mail'], ['contato', 'Telefone/WhatsApp'], ['camisa', 'Tamanho da camisa'],
  ['calca', 'Tamanho da calça'], ['tipo_sanguineo', 'Tipo sanguíneo'], ['fator_rh', 'Fator Rh'],
] as const;

export type CampoMembroImportacao = typeof CAMPOS_IMPORTACAO_MEMBRO[number][0];
export type MembroImportacao = { id: number; id_sgc: string | null; nome: string; idade?: number | null } &
  Partial<Record<Exclude<keyof DadosMembroImportacao, 'id_sgc' | 'nome' | 'idade'>, string | number | null>>;
export type DestinoImportacaoMembro = number | 'novo' | 'ignorar';

export function valorVazio(valor: unknown) {
  return valor == null || (typeof valor === 'string' && !valor.trim());
}

export function nomesSemelhantes(a: string, b: string) {
  const partes = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((p) => !['da', 'das', 'de', 'do', 'dos', 'e'].includes(p)) ?? [];
  const x = partes(a);
  const y = partes(b);
  if (!x.length || !y.length || x[0] !== y[0]) return false;
  return x.join(' ') === y.join(' ') || x.slice(1).some((parte) => y.slice(1).includes(parte));
}

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getClubeAtivoId, getProgramaAtivoId } from './contextoAtual';

export interface CargoModelo {
  id?: number;
  codigo: string;
  masc: string;
  fem: string;
  tipo: string;
  idade_minima: number | null;
  idade_maxima: number | null;
  perfil_sugerido: string | null;
}

export interface ClasseModelo {
  id?: number;
  nome: string;
  tipo?: string | null;
  idade_indicada?: number | null;
  ordem?: number | null;
}

export interface DocumentoModelo {
  campo: string;
  nome: string;
  obrigatorio?: boolean;
  permite_anexo?: boolean;
  limite_anexos?: number;
  ordem?: number | null;
}

export interface EspecialidadeModelo {
  id: string;
  programa_id: number;
  nome: string;
  codigo?: string | null;
  categoria?: string | null;
  area?: string | null;
  nivel?: string | null;
  tipo_nivel?: string | null;
  idade_indicada?: number | null;
  quantidade_requisitos?: number | null;
  insignia_url?: string | null;
  fonte_oficial?: string | null;
  item_url?: string | null;
}

export interface RequisitoMdaModelo {
  id: string;
  programa_id: number;
  item_tipo: 'Classe' | 'Especialidade';
  item_nome: string;
  item_codigo?: string | null;
  item_url: string;
  classe_id?: number | null;
  especialidade_id?: string | null;
  secao?: string | null;
  ordem: number;
  texto: string;
}

export const CARGOS_DBV_FALLBACK: CargoModelo[] = [
  { codigo: 'desbravador', masc: 'Desbravador', fem: 'Desbravadora', tipo: 'membro', idade_minima: 10, idade_maxima: 15, perfil_sugerido: 'usuario_desbravador' },
  { codigo: 'diretor', masc: 'Diretor', fem: 'Diretora', tipo: 'diretoria', idade_minima: 16, idade_maxima: null, perfil_sugerido: 'usuario_diretoria' },
  { codigo: 'diretor_associado', masc: 'Diretor associado', fem: 'Diretora associada', tipo: 'diretoria', idade_minima: 16, idade_maxima: null, perfil_sugerido: 'usuario_diretoria' },
  { codigo: 'secretario', masc: 'Secretário', fem: 'Secretária', tipo: 'diretoria', idade_minima: 16, idade_maxima: null, perfil_sugerido: 'usuario_secretaria' },
  { codigo: 'tesoureiro', masc: 'Tesoureiro', fem: 'Tesoureira', tipo: 'diretoria', idade_minima: 16, idade_maxima: null, perfil_sugerido: 'usuario_tesouraria' },
  { codigo: 'capelao', masc: 'Capelão', fem: 'Capelã', tipo: 'diretoria', idade_minima: 16, idade_maxima: null, perfil_sugerido: 'usuario_capelao' },
  { codigo: 'instrutor_classes', masc: 'Instrutor de classes', fem: 'Instrutora de classes', tipo: 'diretoria', idade_minima: 16, idade_maxima: null, perfil_sugerido: 'usuario_diretoria' },
  { codigo: 'instrutor_especialidades', masc: 'Instrutor de especialidades', fem: 'Instrutora de especialidades', tipo: 'diretoria', idade_minima: 16, idade_maxima: null, perfil_sugerido: 'usuario_diretoria' },
  { codigo: 'conselheiro', masc: 'Conselheiro', fem: 'Conselheira', tipo: 'unidade', idade_minima: 16, idade_maxima: null, perfil_sugerido: 'usuario_conselheiro' },
  { codigo: 'capitao_unidade', masc: 'Capitão de unidade', fem: 'Capitã de unidade', tipo: 'unidade', idade_minima: 10, idade_maxima: 15, perfil_sugerido: 'usuario_desbravador' },
  { codigo: 'secretario_unidade', masc: 'Secretário de unidade', fem: 'Secretária de unidade', tipo: 'unidade', idade_minima: 10, idade_maxima: 15, perfil_sugerido: 'usuario_desbravador' },
  { codigo: 'comunicacao', masc: 'Comunicação', fem: 'Comunicação', tipo: 'diretoria', idade_minima: 16, idade_maxima: null, perfil_sugerido: 'usuario_diretoria' },
];

export const CARGOS_AVT_FALLBACK: CargoModelo[] = [
  { codigo: 'aventureiro', masc: 'Aventureiro', fem: 'Aventureira', tipo: 'membro', idade_minima: 6, idade_maxima: 9, perfil_sugerido: 'usuario_aventureiro' },
  ...CARGOS_DBV_FALLBACK
    .filter((c) => !['desbravador', 'capitao_unidade', 'secretario_unidade'].includes(c.codigo))
    .map((c) => ({ ...c })),
];

export const CLASSES_DBV_FALLBACK: ClasseModelo[] = [
  'Amigo', 'Amigo da Natureza', 'Companheiro', 'Companheiro de Excursionismo',
  'Pesquisador', 'Pesquisador de Campo e Bosque', 'Pioneiro', 'Pioneiro de Novas Fronteiras',
  'Excursionista', 'Excursionista na Mata', 'Guia', 'Guia de Exploração',
].map((nome, idx) => ({ nome, ordem: idx + 1 }));

export const CLASSES_AVT_FALLBACK: ClasseModelo[] = [
  { nome: 'Abelhinhas Laboriosas', idade_indicada: 6, ordem: 1 },
  { nome: 'Luminares', idade_indicada: 7, ordem: 2 },
  { nome: 'Edificadores', idade_indicada: 8, ordem: 3 },
  { nome: 'Mãos Ajudadoras', idade_indicada: 9, ordem: 4 },
];

export const DOCUMENTOS_FALLBACK: DocumentoModelo[] = [
  ['rg', 'RG'], ['cpf', 'CPF'], ['rg_resp', 'RG Responsável'], ['cartao_sus', 'Cartão SUS'],
  ['cartao_plano', 'Cartão de Plano'], ['ficha_saude', 'Ficha de Saúde'],
  ['carteira_vacinacao', 'Carteira de Vacinação'], ['laudo_medico', 'Laudo Médico'],
  ['ficha_reg', 'Ficha de Reg. Atualizada'], ['comp_residencia', 'Comp. Residência'],
  ['aut_saida', 'Aut. Saída'], ['aut_viagem', 'Aut. Viagem Autenticada'],
  ['ri_assinado', 'RI Assinado'], ['foto', 'Foto'], ['ant_criminais', 'Ant. Criminais'],
].map(([campo, nome], idx) => ({ campo, nome, limite_anexos: campo === 'foto' ? 1 : 5, ordem: idx + 1 }));

function programaEhAventureiros() {
  return getProgramaAtivoId() === 2;
}

export function cargosFallback(): CargoModelo[] {
  return programaEhAventureiros() ? CARGOS_AVT_FALLBACK : CARGOS_DBV_FALLBACK;
}

export function classesFallback(): ClasseModelo[] {
  return programaEhAventureiros() ? CLASSES_AVT_FALLBACK : CLASSES_DBV_FALLBACK;
}

export async function carregarCargosModelo(): Promise<CargoModelo[]> {
  if (Platform.OS !== 'web') return cargosFallback();
  const { data, error } = await supabase
    .from('cargos_modelo')
    .select('id,codigo,nome_masculino,nome_feminino,tipo,idade_minima,idade_maxima,perfil_sugerido')
    .eq('programa_id', getProgramaAtivoId())
    .eq('ativo', true)
    .order('tipo')
    .order('id');
  if (error || !data?.length) return cargosFallback();
  return data.map((c: any) => ({
    id: c.id,
    codigo: c.codigo,
    masc: c.nome_masculino,
    fem: c.nome_feminino,
    tipo: c.tipo,
    idade_minima: c.idade_minima,
    idade_maxima: c.idade_maxima,
    perfil_sugerido: c.perfil_sugerido,
  }));
}

export async function carregarClassesModelo(): Promise<ClasseModelo[]> {
  if (Platform.OS !== 'web') return classesFallback();
  const { data, error } = await supabase
    .from('classes_modelo')
    .select('id,nome,tipo,idade_indicada,ordem')
    .eq('programa_id', getProgramaAtivoId())
    .eq('ativo', true)
    .order('ordem');
  if (error || !data?.length) return classesFallback();
  return data as ClasseModelo[];
}

export async function carregarDocumentosModelo(): Promise<DocumentoModelo[]> {
  if (Platform.OS !== 'web') return DOCUMENTOS_FALLBACK;
  const programaId = getProgramaAtivoId();
  const clubeId = getClubeAtivoId();
  const { data, error } = await supabase
    .from('documentos_modelo')
    .select('campo,nome,obrigatorio,permite_anexo,limite_anexos,ordem')
    .eq('ativo', true)
    .or(`clube_id.eq.${clubeId},and(clube_id.is.null,programa_id.eq.${programaId})`)
    .order('ordem');
  if (error || !data?.length) return DOCUMENTOS_FALLBACK;
  const porCampo = new Map<string, DocumentoModelo>();
  for (const d of data as DocumentoModelo[]) porCampo.set(d.campo, d);
  return Array.from(porCampo.values()).sort((a, b) => (a.ordem ?? 100) - (b.ordem ?? 100));
}

export async function carregarEspecialidadesModelo(filtros?: {
  busca?: string;
  categoria?: string;
  limite?: number;
}): Promise<EspecialidadeModelo[]> {
  if (Platform.OS !== 'web') return [];
  let query = supabase
    .from('especialidades_modelo')
    .select('id,programa_id,nome,codigo,categoria,area,nivel,tipo_nivel,idade_indicada,quantidade_requisitos,insignia_url,fonte_oficial,item_url')
    .eq('programa_id', getProgramaAtivoId())
    .eq('ativo', true)
    .order('categoria')
    .order('nome');

  const busca = filtros?.busca?.trim();
  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,codigo.ilike.%${busca}%,categoria.ilike.%${busca}%,area.ilike.%${busca}%`);
  }
  if (filtros?.categoria) query = query.eq('categoria', filtros.categoria);
  if (filtros?.limite) query = query.limit(filtros.limite);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EspecialidadeModelo[];
}

export async function carregarRequisitosMda(params: {
  itemTipo: 'Classe' | 'Especialidade';
  classeId?: number | null;
  especialidadeId?: string | null;
  itemUrl?: string | null;
}): Promise<RequisitoMdaModelo[]> {
  if (Platform.OS !== 'web') return [];
  let query = supabase
    .from('mda_requisitos_modelo')
    .select('id,programa_id,item_tipo,item_nome,item_codigo,item_url,classe_id,especialidade_id,secao,ordem,texto')
    .eq('programa_id', getProgramaAtivoId())
    .eq('item_tipo', params.itemTipo)
    .order('ordem');

  if (params.especialidadeId) query = query.eq('especialidade_id', params.especialidadeId);
  else if (params.classeId) query = query.eq('classe_id', params.classeId);
  else if (params.itemUrl) query = query.eq('item_url', params.itemUrl);
  else return [];

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as RequisitoMdaModelo[];
}

import { supabase } from './supabase';
import {
  CLASSES_BASE_ORDEM,
  CLASSES_LIDER,
  ehClasseAgrupada,
  limparCacheCatalogoClasses,
  NOME_AVANCADA,
  type RequisitoCatalogo,
} from './classesRequisitos';

export const CATEGORIAS_CLASSE = ['Regulares', 'Avançadas', 'Líder', 'Agrupadas'] as const;
export type CategoriaClasse = (typeof CATEGORIAS_CLASSE)[number];

/**
 * Uma "classe" na visão do catálogo. Avançada NÃO é uma classe separada no
 * banco: é a mesma classe_nome com os requisitos marcados como `avancada`.
 * Por isso a identidade aqui é o par (classe_nome, avancada).
 */
export interface ClasseDoCatalogo {
  classe_nome: string;
  avancada: boolean;
  /** Nome mostrado — nas avançadas usa o nome oficial (Amigo da Natureza...). */
  rotulo: string;
  categoria: CategoriaClasse;
  totalRequisitos: number;
  /** Quantos realmente contam para o progresso (os demais são subitens). */
  totalPontuam: number;
}

export function categoriaDe(classeNome: string, avancada: boolean): CategoriaClasse {
  if (ehClasseAgrupada(classeNome)) return 'Agrupadas';
  if (CLASSES_LIDER.includes(classeNome)) return 'Líder';
  return avancada ? 'Avançadas' : 'Regulares';
}

function rotuloDe(classeNome: string, avancada: boolean): string {
  if (!avancada) return classeNome;
  return NOME_AVANCADA[classeNome] ?? `${classeNome} (avançada)`;
}

/** Monta a lista de classes a partir dos requisitos já cadastrados. */
export async function carregarClassesDoCatalogo(): Promise<ClasseDoCatalogo[]> {
  const porChave = new Map<string, ClasseDoCatalogo>();
  const PAGINA = 1000;
  let pagina = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('classes_requisitos_catalogo')
      .select('classe_nome,avancada,pontua')
      .eq('ativo', true)
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
    if (error) throw error;
    const lote = data ?? [];

    for (const linha of lote) {
      const avancada = !!linha.avancada;
      const chave = `${linha.classe_nome}::${avancada ? 'av' : 'reg'}`;
      let item = porChave.get(chave);
      if (!item) {
        item = {
          classe_nome: linha.classe_nome,
          avancada,
          rotulo: rotuloDe(linha.classe_nome, avancada),
          categoria: categoriaDe(linha.classe_nome, avancada),
          totalRequisitos: 0,
          totalPontuam: 0,
        };
        porChave.set(chave, item);
      }
      item.totalRequisitos += 1;
      if (linha.pontua) item.totalPontuam += 1;
    }

    if (lote.length < PAGINA) break;
    pagina += 1;
  }

  const ordemBase = new Map(CLASSES_BASE_ORDEM.map((n, i) => [n, i]));
  return Array.from(porChave.values()).sort(
    (a, b) =>
      (ordemBase.get(a.classe_nome) ?? 99) - (ordemBase.get(b.classe_nome) ?? 99) ||
      a.rotulo.localeCompare(b.rotulo, 'pt-BR')
  );
}

export async function carregarRequisitosDaClasse(
  classeNome: string,
  avancada: boolean
): Promise<RequisitoCatalogo[]> {
  const { data, error } = await supabase
    .from('classes_requisitos_catalogo')
    .select('*')
    .eq('classe_nome', classeNome)
    .eq('avancada', avancada)
    .eq('ativo', true)
    .order('secao_ordem')
    .order('ordem');
  if (error) throw error;
  return (data ?? []) as unknown as RequisitoCatalogo[];
}

export interface RequisitoEditavel {
  id?: number;
  classe_nome: string;
  avancada: boolean;
  secao: string;
  secao_ordem: number;
  ordem: number;
  codigo: string;
  texto: string;
  pontua: boolean;
  especialidade_nome?: string | null;
}

export async function salvarRequisito(dados: RequisitoEditavel): Promise<void> {
  const texto = dados.texto.trim();
  const secao = dados.secao.trim();
  const codigo = dados.codigo.trim();
  if (!texto) throw new Error('Escreva o texto do requisito.');
  if (!secao) throw new Error('Informe a seção.');
  if (!codigo) throw new Error('Informe o código (ex.: 1, 2a, 3).');

  const payload = {
    classe_nome: dados.classe_nome,
    avancada: dados.avancada,
    secao,
    secao_ordem: dados.secao_ordem,
    ordem: dados.ordem,
    codigo,
    // Requisito de primeiro nível: a raiz é ele mesmo.
    codigo_raiz: codigo,
    texto,
    pontua: dados.pontua,
    especialidade_nome: dados.especialidade_nome?.trim() || null,
    ativo: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = dados.id
    ? await supabase.from('classes_requisitos_catalogo').update(payload).eq('id', dados.id)
    : await supabase.from('classes_requisitos_catalogo').insert(payload);
  if (error) throw error;

  // O catálogo fica em cache na memória; sem limpar, a mudança só apareceria
  // nas telas dos membros depois de fechar o app.
  limparCacheCatalogoClasses();
}

/**
 * Desativa em vez de apagar: o progresso já registrado dos membros aponta para
 * o id do requisito, e apagar de vez deixaria esse histórico órfão. Desativado,
 * ele some de todas as telas e do cálculo, mas o histórico continua íntegro.
 */
export async function excluirRequisito(id: number): Promise<void> {
  const { error } = await supabase
    .from('classes_requisitos_catalogo')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  limparCacheCatalogoClasses();
}

/** Seções já usadas na classe, para sugerir no formulário. */
export function secoesDe(requisitos: RequisitoCatalogo[]): { secao: string; ordem: number }[] {
  const mapa = new Map<string, number>();
  for (const r of requisitos) {
    if (!mapa.has(r.secao)) mapa.set(r.secao, r.secao_ordem);
  }
  return Array.from(mapa.entries())
    .map(([secao, ordem]) => ({ secao, ordem }))
    .sort((a, b) => a.ordem - b.ordem);
}

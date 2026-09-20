/**
 * Lista única das categorias de pontos que existem na tabela `pontuacoes`.
 *
 * NOVA CATEGORIA DE PONTOS? Adicione uma migration com a coluna nova e um
 * item em CATEGORIAS_CONFIGURAVEIS (se o valor vier de config_pontuacao,
 * como Presença/Pontualidade) ou em CATEGORIAS_DIRETAS (se a coluna já é o
 * valor em pontos, como Bom da Bíblia). Só isso — soma do ranking
 * (somaPontuacaoBase), a mesma soma em SQL puro pro modo offline
 * (gerarExpressaoSomaSQL), as linhas do extrato individual e as colunas do
 * relatório de pontuação (linhasCategoriasPontuacao) passam a incluir a
 * categoria nova automaticamente, sem precisar tocar em mais nenhum arquivo.
 *
 * Antes desta lista existir, cada uma dessas 4 coisas tinha sua própria
 * cópia manual da lista de campos, e uma categoria nova (Bom da Bíblia)
 * ficou de fora da soma do ranking por meses sem ninguém notar.
 */

export interface ConfigPontuacaoCampos {
  presenca: number;
  pontualidade: number;
  material: number;
  uniforme: number;
}

export interface CategoriaConfiguravel {
  /** Coluna booleana em `pontuacoes` (0/1). */
  campo: 'presenca' | 'pontualidade' | 'material' | 'uniforme';
  /** Coluna com o valor em pontos já gravado no lançamento (histórico). */
  campoPts: string;
  /** Campo correspondente em config_pontuacao, usado quando campoPts ainda não foi gravado. */
  campoConfig: keyof ConfigPontuacaoCampos;
  label: string;
  icon: string;
}

export interface CategoriaDireta {
  /** Coluna em `pontuacoes` cujo valor já é o total em pontos. */
  campo: 'bom_biblia' | 'classe_biblica' | 'especialidade' | 'pgm_especial' | 'atividade_unidade';
  label: string;
  icon: string;
}

export const CATEGORIAS_CONFIGURAVEIS: CategoriaConfiguravel[] = [
  { campo: 'presenca', campoPts: 'presenca_pts', campoConfig: 'presenca', label: 'Presença', icon: 'person-outline' },
  { campo: 'pontualidade', campoPts: 'pontualidade_pts', campoConfig: 'pontualidade', label: 'Pontualidade', icon: 'time-outline' },
  { campo: 'material', campoPts: 'material_pts', campoConfig: 'material', label: 'Material', icon: 'book-outline' },
  { campo: 'uniforme', campoPts: 'uniforme_pts', campoConfig: 'uniforme', label: 'Uniforme', icon: 'shirt-outline' },
];

export const CATEGORIAS_DIRETAS: CategoriaDireta[] = [
  { campo: 'bom_biblia', label: 'Bom da Bíblia', icon: 'library-outline' },
  { campo: 'classe_biblica', label: 'Classe Bíblica', icon: 'ribbon-outline' },
  { campo: 'especialidade', label: 'Especialidade', icon: 'star-outline' },
  { campo: 'pgm_especial', label: 'Pgm Especial', icon: 'musical-notes-outline' },
  { campo: 'atividade_unidade', label: 'Ativ. Unidade', icon: 'people-outline' },
];

export function valorCategoriaConfiguravel(p: any, cat: CategoriaConfiguravel, cfg: ConfigPontuacaoCampos): number {
  const gravado = p[cat.campoPts];
  if (gravado != null) return Number(gravado) || 0;
  return p[cat.campo] ? Number(cfg[cat.campoConfig]) || 0 : 0;
}

export function valorCategoriaDireta(p: any, cat: CategoriaDireta): number {
  return Number(p[cat.campo]) || 0;
}

/**
 * Soma canônica de pontos de um lançamento (`pontuacoes`), incluindo pontos
 * extras avulsos — a mesma conta usada pelo ranking, extrato de unidade e
 * "minha pontuação/posição" do dashboard.
 */
export function somaPontuacaoBase(p: any, cfg: ConfigPontuacaoCampos): number {
  let total = Number(p.pontos_extras) || 0;
  for (const cat of CATEGORIAS_CONFIGURAVEIS) total += valorCategoriaConfiguravel(p, cat, cfg);
  for (const cat of CATEGORIAS_DIRETAS) total += valorCategoriaDireta(p, cat);
  return total;
}

/** Mesma soma de somaPontuacaoBase, em SQL puro, pro fallback offline (SQLite). */
export function gerarExpressaoSomaSQL(cfg: ConfigPontuacaoCampos): string {
  const partes = [
    ...CATEGORIAS_CONFIGURAVEIS.map((c) => `COALESCE(p.${c.campoPts}, p.${c.campo} * ${cfg[c.campoConfig]}, 0)`),
    ...CATEGORIAS_DIRETAS.map((c) => `COALESCE(p.${c.campo}, 0)`),
    'COALESCE(p.pontos_extras, 0)',
  ];
  return `(\n    ${partes.join(' +\n    ')}\n  )`;
}

/** Linhas de exibição (extrato) pros pontos "base" de um lançamento — só as categorias com valor diferente de zero. */
export function linhasCategoriasPontuacao(p: any, cfg: ConfigPontuacaoCampos): Array<{ label: string; pts: number; icon: string }> {
  const linhas: Array<{ label: string; pts: number; icon: string }> = [];
  for (const cat of CATEGORIAS_CONFIGURAVEIS) {
    const pts = valorCategoriaConfiguravel(p, cat, cfg);
    if (pts) linhas.push({ label: cat.label, pts, icon: cat.icon });
  }
  for (const cat of CATEGORIAS_DIRETAS) {
    const pts = valorCategoriaDireta(p, cat);
    if (pts) linhas.push({ label: cat.label, pts, icon: cat.icon });
  }
  return linhas;
}

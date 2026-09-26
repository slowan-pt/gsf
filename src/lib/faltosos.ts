/** Quem entra na contagem da aba Faltosos do dashboard (config por clube em clubes.config_faltosos). */
export interface ConfigFaltosos {
  dbv: boolean;
  diretoria: boolean;
  inativos: boolean;
  sem_unidade: boolean;
  /** Ids de membros que ficam de fora mesmo com o grupo marcado. */
  excluidos: number[];
}

export type GrupoFaltosos = 'dbv' | 'diretoria' | 'inativos' | 'sem_unidade';

/** Padrão = comportamento anterior: todos os ativos contam, inativos não. */
export const CONFIG_FALTOSOS_PADRAO: ConfigFaltosos = {
  dbv: true,
  diretoria: true,
  inativos: false,
  sem_unidade: true,
  excluidos: [],
};

export const GRUPOS_FALTOSOS: { chave: GrupoFaltosos; rotulo: string }[] = [
  { chave: 'dbv', rotulo: 'DBV' },
  { chave: 'diretoria', rotulo: 'Diretoria' },
  { chave: 'inativos', rotulo: 'Inativos' },
  { chave: 'sem_unidade', rotulo: 'Sem unidade' },
];

export function normalizarConfigFaltosos(bruto: unknown): ConfigFaltosos {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const bool = (v: unknown, padrao: boolean) => (typeof v === 'boolean' ? v : padrao);
  return {
    dbv: bool(b.dbv, CONFIG_FALTOSOS_PADRAO.dbv),
    diretoria: bool(b.diretoria, CONFIG_FALTOSOS_PADRAO.diretoria),
    inativos: bool(b.inativos, CONFIG_FALTOSOS_PADRAO.inativos),
    sem_unidade: bool(b.sem_unidade, CONFIG_FALTOSOS_PADRAO.sem_unidade),
    excluidos: Array.isArray(b.excluidos)
      ? b.excluidos.map(Number).filter((n) => Number.isFinite(n))
      : [],
  };
}

interface MembroClassificavel {
  id: number;
  unidade_nome?: string | null;
  ativo?: boolean | number | null;
}

/** Grupo do membro: inativo primeiro; depois Diretoria (unidade "Diretoria"), sem unidade ou DBV. */
export function grupoFaltosos(m: MembroClassificavel): GrupoFaltosos {
  if (m.ativo === false || m.ativo === 0) return 'inativos';
  const unidade = (m.unidade_nome ?? '').trim();
  if (!unidade) return 'sem_unidade';
  if (unidade.toLowerCase() === 'diretoria') return 'diretoria';
  return 'dbv';
}

export function entraNaContagemFaltosos(m: MembroClassificavel, cfg: ConfigFaltosos): boolean {
  if (cfg.excluidos.includes(m.id)) return false;
  return cfg[grupoFaltosos(m)];
}

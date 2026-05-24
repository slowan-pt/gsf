import { useContextoStore } from '../stores/contextoStore';
import type { ContextoAcesso } from '../types';

export const CLUBE_PADRAO_ID = 1;
export const PROGRAMA_PADRAO_ID = 1;

export function getContextoAtivo(): ContextoAcesso | null {
  return useContextoStore.getState().contextoAtivo;
}

export function getClubeAtivoId(): number {
  return getContextoAtivo()?.clube_id ?? CLUBE_PADRAO_ID;
}

export function getProgramaAtivoId(): number {
  return getContextoAtivo()?.programa_id ?? PROGRAMA_PADRAO_ID;
}

export function getContextoPerfil(): string | null {
  return getContextoAtivo()?.perfil ?? null;
}

export function getContextoUnidadeId(): number | null {
  return getContextoAtivo()?.unidade_id ?? null;
}

export function getContextoMembroId(): number | null {
  return getContextoAtivo()?.membro_id ?? null;
}

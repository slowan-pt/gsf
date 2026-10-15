import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { supabase } from './supabase';

/**
 * Menus da Início que o admin do clube pode esconder de cada tipo de perfil
 * (clubes.menus_ocultos). Esconder só tira o atalho da tela — as permissões
 * continuam sendo as de Modelos → Permissões.
 */
export interface MenuConfiguravel { id: string; rotulo: string; icone: string }

/** Ids iguais aos de ALL_SHORTCUTS em app/(tabs)/index.tsx. */
export const MENUS_CONFIGURAVEIS: MenuConfiguravel[] = [
  { id: 'ranking', rotulo: 'Ranking', icone: 'trophy' },
  { id: 'membros', rotulo: 'Membros', icone: 'people' },
  { id: 'agenda', rotulo: 'Agenda', icone: 'calendar' },
  { id: 'pontuacao', rotulo: 'Pontuação', icone: 'checkmark-circle' },
  { id: 'unidades', rotulo: 'Unidades', icone: 'flag' },
  { id: 'importar', rotulo: 'Importar', icone: 'cloud-upload-outline' },
  { id: 'relatorios', rotulo: 'Relatórios', icone: 'bar-chart' },
  { id: 'preCadastros', rotulo: 'Pré-cadastros', icone: 'person-add' },
  { id: 'aparencia', rotulo: 'Aparência', icone: 'color-palette' },
  { id: 'classificacao', rotulo: 'Classificação', icone: 'star-outline' },
  { id: 'rankingClubes', rotulo: 'Ranking do Campo', icone: 'ribbon' },
  { id: 'auditoria', rotulo: 'Auditoria', icone: 'shield-checkmark' },
  { id: 'lgpd', rotulo: 'LGPD', icone: 'document-text' },
  { id: 'avisos', rotulo: 'Avisos', icone: 'notifications' },
  { id: 'mensagens', rotulo: 'Mensagens', icone: 'megaphone' },
  { id: 'atividades', rotulo: 'Atividades', icone: 'clipboard' },
  { id: 'classeBiblica', rotulo: 'Classe Bíblica', icone: 'book' },
  { id: 'anoBiblico', rotulo: 'Ano Bíblico', icone: 'book-outline' },
  { id: 'classes', rotulo: 'Classes', icone: 'ribbon' },
  { id: 'especialidades', rotulo: 'Especialidades', icone: 'medal' },
  { id: 'aprovacoes', rotulo: 'Aprovações', icone: 'checkmark-done-circle' },
];

/** Nunca podem ser escondidos do Admin do clube (ele perderia o acesso a esta própria configuração). */
export const MENUS_TRAVADOS_ADMIN_CLUBE = ['modelos'];

export type MenusOcultos = Record<string, string[]>;

const CHAVE_CACHE = 'menus_ocultos_v1';

export function normalizarMenusOcultos(bruto: unknown): MenusOcultos {
  const resultado: MenusOcultos = {};
  if (!bruto || typeof bruto !== 'object') return resultado;
  for (const [perfil, lista] of Object.entries(bruto as Record<string, unknown>)) {
    if (Array.isArray(lista)) resultado[perfil] = lista.filter((x): x is string => typeof x === 'string');
  }
  return resultado;
}

interface MenusState {
  ocultos: MenusOcultos;
  definir: (ocultos: MenusOcultos) => void;
}

export const useMenusOcultosStore = create<MenusState>((set) => ({
  ocultos: {},
  definir: (ocultos) => set({ ocultos }),
}));

/** Lê do banco (com cópia no aparelho para funcionar sem rede). Tolera a coluna ainda não existir. */
export async function carregarMenusOcultos(clubeId: number | null | undefined): Promise<MenusOcultos> {
  const chave = `${CHAVE_CACHE}_${clubeId ?? 0}`;
  try {
    if (!clubeId) throw new Error('sem clube');
    const { data, error } = await supabase.from('clubes').select('menus_ocultos').eq('id', clubeId).maybeSingle();
    if (error) throw error;
    const ocultos = normalizarMenusOcultos((data as any)?.menus_ocultos);
    await AsyncStorage.setItem(chave, JSON.stringify(ocultos)).catch(() => {});
    useMenusOcultosStore.getState().definir(ocultos);
    return ocultos;
  } catch {
    try {
      const bruto = await AsyncStorage.getItem(chave);
      const ocultos = bruto ? normalizarMenusOcultos(JSON.parse(bruto)) : {};
      useMenusOcultosStore.getState().definir(ocultos);
      return ocultos;
    } catch {
      return {};
    }
  }
}

export async function salvarMenusOcultos(clubeId: number, ocultos: MenusOcultos): Promise<void> {
  const { error } = await supabase.from('clubes').update({ menus_ocultos: ocultos }).eq('id', clubeId);
  if (error) throw error;
  await AsyncStorage.setItem(`${CHAVE_CACHE}_${clubeId}`, JSON.stringify(ocultos)).catch(() => {});
  useMenusOcultosStore.getState().definir(ocultos);
}

/** Recarrega os menus ocultos sempre que o clube ativo muda. */
export function useCarregarMenusOcultos(clubeId: number | null | undefined) {
  useEffect(() => { void carregarMenusOcultos(clubeId); }, [clubeId]);
}

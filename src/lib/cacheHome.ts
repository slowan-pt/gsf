import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache dos blocos fixos da Início (banner da classe em andamento, "Minhas classes",
 * "Minhas especialidades"). A barra inferior recria a tela a cada troca, então o estado
 * do componente começa vazio; aqui os últimos dados ficam em memória (volta imediata)
 * e em disco (abertura do app já com tudo no lugar). A atualização acontece por trás
 * e só troca os números/itens que mudaram.
 */
const PREFIXO = 'home_cache_v1:';
const memoria = new Map<string, unknown>();

export function lerCacheHome<T>(chave: string): T | undefined {
  return memoria.get(chave) as T | undefined;
}

export async function lerCacheHomeDoDisco<T>(chave: string): Promise<T | undefined> {
  if (memoria.has(chave)) return memoria.get(chave) as T;
  try {
    const bruto = await AsyncStorage.getItem(PREFIXO + chave);
    if (!bruto) return undefined;
    const valor = JSON.parse(bruto) as T;
    memoria.set(chave, valor);
    return valor;
  } catch {
    return undefined;
  }
}

export function gravarCacheHome(chave: string, valor: unknown): void {
  memoria.set(chave, valor);
  AsyncStorage.setItem(PREFIXO + chave, JSON.stringify(valor)).catch(() => {});
}

/** Ao sair da conta: nada de uma pessoa pode aparecer para a próxima. */
export async function limparCacheHome(): Promise<void> {
  memoria.clear();
  try {
    const chaves = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIXO));
    if (chaves.length > 0) await AsyncStorage.multiRemove(chaves);
  } catch {
    // sem efeito: o cache só acelera a tela
  }
}

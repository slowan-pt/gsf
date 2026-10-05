import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Cache de "quando carregou pela última vez" por tela.
 *
 * As telas de aba ficam montadas enquanto o app está aberto, então voltar para
 * uma delas não precisa refazer todas as consultas: se carregou há pouco, só
 * mostra o que já está na tela. Dados que mudam são atualizados por três vias:
 *  - tempo (TTL) — passou o prazo, a próxima visita recarrega;
 *  - tempo real — as telas que usam `useRealtime` já se atualizam sozinhas;
 *  - manual — botão de atualizar no cabeçalho e puxar para atualizar.
 *
 * A entrada é apagada quando a tela desmonta (telas de pilha perdem o estado
 * ao sair, então precisam recarregar ao voltar) e quando a pessoa sai da conta.
 */
const ultimaCarga = new Map<string, number>();

export function limparCacheTelas(): void {
  ultimaCarga.clear();
}

/** Marca telas como desatualizadas (ex.: depois de lançar pontos em outra tela). */
export function invalidarCacheTelas(prefixo = ''): void {
  for (const chave of Array.from(ultimaCarga.keys())) {
    if (chave.startsWith(prefixo)) ultimaCarga.delete(chave);
  }
}

/**
 * Carrega ao focar a tela só se os dados estiverem velhos.
 * `chave` deve incluir tudo que muda o conteúdo (tela + clube + membro + perfil).
 * Devolve `atualizar()`, que força a recarga agora.
 */
export function useFocoComCache(
  chave: string,
  carregar: () => void | Promise<unknown>,
  ttlMs = 120_000,
): () => Promise<void> {
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;

  useFocusEffect(
    useCallback(() => {
      const t = ultimaCarga.get(chave);
      if (t && Date.now() - t < ttlMs) return;
      ultimaCarga.set(chave, Date.now());
      void carregarRef.current();
    }, [chave, ttlMs]),
  );

  useEffect(() => () => { ultimaCarga.delete(chave); }, [chave]);

  return useCallback(async () => {
    ultimaCarga.set(chave, Date.now());
    await carregarRef.current();
  }, [chave]);
}

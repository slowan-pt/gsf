import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect, useNavigation } from 'expo-router';
import { supabase } from './supabase';

/**
 * Assina mudanças no Postgres e chama `aoMudar` quando alguma das tabelas muda.
 *
 * Serve para o caso em que a tela já está aberta e parada: sem isso, uma
 * pontuação lançada no computador só aparecia no celular depois de sair e
 * voltar para a tela.
 *
 * - As chamadas são agrupadas (debounce): uma rajada de alterações — como
 *   salvar a presença de vários membros de uma vez — provoca uma única recarga.
 * - `ativo` permite pausar a recarga em telas com edição pendente, para não
 *   sobrescrever o que o usuário ainda não salvou.
 */
// Cada recarga baixa dados de novo (egresso do Supabase); 3 s agrupa rajadas
// de lançamentos numa única recarga sem deixar a tela desatualizada.
const INTERVALO_AGRUPAMENTO_MS = 10_000;

export function useRealtime(tabelas: string[], aoMudar: () => void, ativo = true) {
  const callbackRef = useRef(aoMudar);
  callbackRef.current = aoMudar;
  const ativoRef = useRef(ativo);
  ativoRef.current = ativo;
  const navigation = useNavigation();
  // Tela que não está visível (aba em segundo plano, ou outra tela por cima)
  // não recarrega na hora: marca como pendente e recarrega ao voltar. Antes
  // todas as abas abertas baixavam os dados a cada lançamento, em todos os
  // aparelhos conectados — o que mais pesava no egresso do Supabase.
  const pendenteRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (pendenteRef.current && ativoRef.current) {
        pendenteRef.current = false;
        callbackRef.current();
      }
    }, [])
  );

  // Evita reassinar quando o array é recriado a cada render.
  const chaveTabelas = tabelas.join(',');

  useEffect(() => {
    if (!ativo || !chaveTabelas) return;

    let temporizador: ReturnType<typeof setTimeout> | null = null;
    const agendarRecarga = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        temporizador = null;
        if (!navigation.isFocused()) {
          pendenteRef.current = true;
          return;
        }
        callbackRef.current();
      }, INTERVALO_AGRUPAMENTO_MS);
    };

    const canal = supabase.channel(`gsf:${chaveTabelas}:${Math.random().toString(36).slice(2)}`);
    for (const tabela of chaveTabelas.split(',')) {
      canal.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: tabela },
        agendarRecarga
      );
    }
    canal.subscribe();

    return () => {
      if (temporizador) clearTimeout(temporizador);
      supabase.removeChannel(canal);
    };
  }, [chaveTabelas, ativo, navigation]);
}

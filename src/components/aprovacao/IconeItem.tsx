import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getProgramaAtivoId } from '../../lib/contextoAtual';
import { imagemDoItemClasse } from '../../lib/classesRequisitos';
import { normalizarNomeParaComparar } from '../../lib/especialidades';
import { SeloEspecialidade } from '../SeloEspecialidade';

let cacheInsignias: Map<string, string | null> | null = null;
let carregando: Promise<Map<string, string | null>> | null = null;

/** Insígnias das especialidades por nome normalizado (uma busca só para o app inteiro). */
export function useInsigniasEspecialidades(): Map<string, string | null> {
  const [mapa, setMapa] = useState<Map<string, string | null>>(cacheInsignias ?? new Map());
  useEffect(() => {
    if (cacheInsignias) return;
    let ativo = true;
    carregando ??= Promise.resolve(
      supabase.from('especialidades_modelo').select('nome,insignia_url').eq('programa_id', getProgramaAtivoId()),
    ).then(({ data }) => {
      const m = new Map<string, string | null>();
      for (const e of (data ?? []) as any[]) {
        const chave = normalizarNomeParaComparar(e.nome ?? '');
        if (e.insignia_url || !m.has(chave)) m.set(chave, e.insignia_url ?? null);
      }
      cacheInsignias = m;
      return m;
    }).catch(() => new Map<string, string | null>());
    carregando.then((m) => { if (ativo) setMapa(m); });
    return () => { ativo = false; };
  }, []);
  return mapa;
}

/** Ícone real da classe (brasão/faixa) ou da especialidade (insígnia). */
export function IconeItem({ tipo, nome, insignias, tamanho = 40 }: {
  tipo: 'classe' | 'especialidade';
  nome: string;
  insignias: Map<string, string | null>;
  tamanho?: number;
}) {
  if (tipo === 'especialidade') {
    return <SeloEspecialidade url={insignias.get(normalizarNomeParaComparar(nome)) ?? null} indice={nome.length} tamanho={tamanho} />;
  }
  const img = imagemDoItemClasse(nome);
  return (
    <View style={{ width: tamanho + 6, height: tamanho, alignItems: 'center', justifyContent: 'center' }}>
      {img
        ? <Image source={img} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        : <Ionicons name="ribbon" size={tamanho * 0.7} color="#7c3aed" />}
    </View>
  );
}

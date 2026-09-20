import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getClubeAtivoId } from '../lib/contextoAtual';
import { useContextoStore } from '../stores/contextoStore';

/**
 * Fica na mesma posição (canto superior direito) onde antes ficava o botão
 * flutuante "Sair" — esse botão foi pro rodapé (ver BottomNav), e esse espaço
 * agora mostra a logo do clube, enviada pelo admin em Modelos > Clube. Sem
 * logo cadastrada ainda, não mostra nada (não sobra um espaço vazio chamando
 * atenção).
 */
export function LogoClube() {
  const insets = useSafeAreaInsets();
  const clubeId = useContextoStore((s) => s.contextoAtivo?.clube_id ?? getClubeAtivoId());
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!clubeId) { setLogoUrl(null); return; }
    (async () => {
      try {
        const { data } = await supabase.from('clubes').select('logo_url').eq('id', clubeId).maybeSingle();
        if (ativo) setLogoUrl(data?.logo_url ?? null);
      } catch {
        if (ativo) setLogoUrl(null);
      }
    })();
    return () => { ativo = false; };
  }, [clubeId]);

  if (!logoUrl) return null;

  return (
    <Image
      source={{ uri: logoUrl }}
      resizeMode="contain"
      style={[styles.logo, { top: Math.max(insets.top + 10, 18) }]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    position: 'absolute',
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 8,
    zIndex: 999,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});

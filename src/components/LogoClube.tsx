import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
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
  const pathname = usePathname();
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const clubeId = contextoAtivo?.clube_id ?? getClubeAtivoId();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [clubeNome, setClubeNome] = useState(
    contextoAtivo?.clube_nome_curto ?? contextoAtivo?.clube_nome ?? ''
  );

  useEffect(() => {
    let ativo = true;
    if (!clubeId) { setLogoUrl(null); return; }
    (async () => {
      try {
        const { data } = await supabase.from('clubes').select('logo_url,nome,nome_curto').eq('id', clubeId).maybeSingle();
        if (ativo) {
          setLogoUrl(data?.logo_url ?? null);
          setClubeNome(data?.nome_curto ?? data?.nome ?? contextoAtivo?.clube_nome_curto ?? contextoAtivo?.clube_nome ?? '');
        }
      } catch {
        if (ativo) setLogoUrl(null);
      }
    })();
    const canal = supabase
      .channel(`logo-clube-${clubeId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clubes', filter: `id=eq.${clubeId}` },
        (payload) => {
          const clube = payload.new as { logo_url?: string | null; nome?: string; nome_curto?: string | null };
          if (!ativo) return;
          setLogoUrl(clube.logo_url ?? null);
          setClubeNome(clube.nome_curto ?? clube.nome ?? clubeNome);
        }
      )
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [clubeId, contextoAtivo?.clube_nome, contextoAtivo?.clube_nome_curto]);

  const rotaSemMarca = pathname.startsWith('/auth/')
    || pathname.startsWith('/convite/')
    || pathname.startsWith('/pre-cadastro/');
  if (!logoUrl || rotaSemMarca) return null;

  return (
    <View pointerEvents="none" style={[styles.marca, { top: Math.max(insets.top + 6, 14) }]}>
      <Image source={{ uri: logoUrl }} resizeMode="contain" style={styles.logo} />
      {!!clubeNome && <Text style={styles.nome} numberOfLines={1}>{clubeNome}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  marca: {
    position: 'absolute',
    right: 56,
    width: 62,
    alignItems: 'center',
    zIndex: 999,
    elevation: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  nome: {
    color: '#fff',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    textAlign: 'center',
    width: 62,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
});

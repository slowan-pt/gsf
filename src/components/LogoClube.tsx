import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { getClubeAtivoId } from '../lib/contextoAtual';
import { useContextoStore } from '../stores/contextoStore';
import { useLogoClubeStore } from '../stores/logoClubeStore';

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
  const logoAtualizada = useLogoClubeStore((s) => (clubeId ? s.logos[clubeId] : undefined));
  const versaoLogo = useLogoClubeStore((s) => (clubeId ? s.versoes[clubeId] ?? 0 : 0));
  const atualizarLogoClube = useLogoClubeStore((s) => s.atualizarLogoClube);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [clubeNome, setClubeNome] = useState(
    contextoAtivo?.clube_nome_curto ?? contextoAtivo?.clube_nome ?? ''
  );

  useEffect(() => {
    if (logoAtualizada !== undefined) setLogoUrl(logoAtualizada);
  }, [logoAtualizada]);

  useEffect(() => {
    let ativo = true;
    if (!clubeId) { setLogoUrl(null); return; }
    (async () => {
      try {
        const { data } = await supabase.from('clubes').select('logo_url,nome,nome_curto').eq('id', clubeId).maybeSingle();
        if (ativo) {
          const novaLogo = data?.logo_url ?? null;
          setLogoUrl(novaLogo);
          atualizarLogoClube(clubeId, novaLogo);
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
          const novaLogo = clube.logo_url ?? null;
          setLogoUrl(novaLogo);
          atualizarLogoClube(clubeId, novaLogo);
          setClubeNome(clube.nome_curto ?? clube.nome ?? clubeNome);
        }
      )
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [atualizarLogoClube, clubeId, contextoAtivo?.clube_nome, contextoAtivo?.clube_nome_curto]);

  const logoExibicao = useMemo(() => {
    if (!logoUrl) return null;
    const separador = logoUrl.includes('?') ? '&' : '?';
    return `${logoUrl}${separador}v=${versaoLogo || 1}`;
  }, [logoUrl, versaoLogo]);

  const rotaSemMarca = pathname.startsWith('/auth/')
    || pathname.startsWith('/convite/')
    || pathname.startsWith('/pre-cadastro/');
  if (!logoExibicao || rotaSemMarca) return null;

  return (
    <View pointerEvents="none" style={[styles.marca, { top: Math.max(insets.top + 6, 14) }]}>
      <Image key={logoExibicao} source={{ uri: logoExibicao }} resizeMode="contain" style={styles.logo} />
      {!!clubeNome && <Text style={styles.nome} numberOfLines={1}>{clubeNome}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  marca: {
    position: 'absolute',
    right: 6,
    width: 54,
    alignItems: 'center',
    zIndex: 999,
    elevation: 12,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  nome: {
    color: '#fff',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    textAlign: 'center',
    width: 54,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
});

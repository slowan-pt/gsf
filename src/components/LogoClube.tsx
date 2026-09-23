import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useContextoStore } from '../stores/contextoStore';
import { useLogoClubeStore } from '../stores/logoClubeStore';

/**
 * Mostra a logo do clube ativo para qualquer perfil logado naquele clube. A
 * posição acompanha a linha dos avatares/cabeçalhos e o formato é circular,
 * igual à foto do usuário/membro.
 */
export function LogoClube() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const clubeId = contextoAtivo?.clube_id ?? null;
  const logoAtualizada = useLogoClubeStore((s) => (clubeId ? s.logos[clubeId] : undefined));
  const versaoLogo = useLogoClubeStore((s) => (clubeId ? s.versoes[clubeId] ?? 0 : 0));
  const atualizarLogoClube = useLogoClubeStore((s) => s.atualizarLogoClube);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
        }
      )
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [atualizarLogoClube, clubeId]);

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
    <View pointerEvents="none" style={[styles.marca, { top: Math.max(insets.top + 18, 48) }]}>
      <Image key={logoExibicao} source={{ uri: logoExibicao }} resizeMode="contain" style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  marca: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 999,
    elevation: 12,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
});

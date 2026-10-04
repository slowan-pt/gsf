import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useContextoStore } from '../stores/contextoStore';
import { useLogoClubeStore } from '../stores/logoClubeStore';
import { TAMANHO_FOTO_CABECALHO } from '../lib/tema';
import { useMarcaCabecalhoStore } from '../lib/marcaCabecalho';
import { useMedidasCabecalho } from './CabecalhoTela';


/**
 * Mostra a logo do clube ativo para qualquer perfil logado naquele clube. A
 * posição acompanha a linha dos avatares/cabeçalhos e o formato é circular,
 * igual à foto do usuário/membro.
 */
export function LogoClube() {
  const pathname = usePathname();
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const clubeId = contextoAtivo?.clube_id ?? null;
  const logoAtualizada = useLogoClubeStore((s) => (clubeId ? s.logos[clubeId] : undefined));
  const versaoLogo = useLogoClubeStore((s) => (clubeId ? s.versoes[clubeId] ?? 0 : 0));
  const atualizarLogoClube = useLogoClubeStore((s) => s.atualizarLogoClube);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const centroCabecalho = useMarcaCabecalhoStore((s) => s.centros[pathname]);
  const { topo: topoPadrao } = useMedidasCabecalho();
  const areaRef = useRef<View>(null);
  const [origemY, setOrigemY] = useState(0);

  useEffect(() => {
    if (logoAtualizada !== undefined) setLogoUrl(logoAtualizada);
  }, [logoAtualizada]);

  useEffect(() => {
    let ativo = true;
    if (!clubeId) { setLogoUrl(null); return; }
    // Erro de rede/sessão não pode apagar a logo: só grava "sem logo" quando a
    // consulta respondeu de fato. Refaz a busca quando o app volta ao primeiro
    // plano ou a sessão é renovada, pra não depender de uma única tentativa.
    const buscar = async () => {
      try {
        const { data, error } = await supabase.from('clubes').select('logo_url').eq('id', clubeId).maybeSingle();
        if (!ativo || error || !data) return;
        const novaLogo = data.logo_url ?? null;
        setLogoUrl(novaLogo);
        atualizarLogoClube(clubeId, novaLogo);
      } catch {
        // mantém a logo atual
      }
    };
    buscar();
    const estadoApp = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') buscar();
    });
    const { data: assinaturaAuth } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED') buscar();
    });
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
      estadoApp.remove();
      assinaturaAuth.subscription.unsubscribe();
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

  // Centro da linha do cabeçalho da tela atual (foto/título); sem registro, topo padrão.
  const topo = centroCabecalho !== undefined
    ? Math.max(0, centroCabecalho - origemY - TAMANHO_FOTO_CABECALHO / 2)
    : topoPadrao;

  return (
    <View
      ref={areaRef}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: 999, elevation: 12 }]}
      onLayout={() => areaRef.current?.measureInWindow((_x, y) => setOrigemY(Number.isFinite(y) ? y : 0))}
    >
      <View style={[styles.marca, { top: topo }]}>
        <Image key={logoExibicao} source={{ uri: logoExibicao }} resizeMode="contain" style={styles.logo} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  marca: {
    position: 'absolute',
    right: 16,
    width: TAMANHO_FOTO_CABECALHO,
    height: TAMANHO_FOTO_CABECALHO,
    borderRadius: TAMANHO_FOTO_CABECALHO / 2,
    // Protótipo: logo em círculo branco com sombra sólida roxa (0 3px 0 #4c218d).
    backgroundColor: '#ffffff',
    boxShadow: '0px 3px 0px #4c218d',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 12,
  },
  // 86% do círculo: a folga evita que os cantos de uma logo quadrada sejam cortados.
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: TAMANHO_FOTO_CABECALHO / 2,
  },
});

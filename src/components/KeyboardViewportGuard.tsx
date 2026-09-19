import { useEffect } from 'react';
import { Platform } from 'react-native';

function alturaTecladoAproximada(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

function instalarCss() {
  if (document.getElementById('gsf-keyboard-viewport-guard')) return;
  const style = document.createElement('style');
  style.id = 'gsf-keyboard-viewport-guard';
  style.textContent = `
    :root {
      --gsf-keyboard-safe-bottom: 0px;
    }

    body {
      padding-bottom: var(--gsf-keyboard-safe-bottom) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Só reserva espaço embaixo quando o teclado virtual do celular está aberto,
 * pra botões no rodapé não ficarem escondidos atrás dele. NÃO mexe em scroll
 * (nem scrollIntoView, nem scrollBy) — o próprio navegador (iOS Safari, Chrome
 * Android) já rola o campo focado pra cima do teclado sozinho, e uma correção
 * nossa por cima disso só brigava com a do navegador: o campo pulava pro
 * lugar errado e piscava a cada tecla digitada (cada evento de resize do
 * teclado reacionava nossa correção).
 */
export function KeyboardViewportGuard() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    instalarCss();

    let ultimoExtra = 0;
    let timer: number | null = null;

    const ajustar = () => {
      const gap = alturaTecladoAproximada();
      const extra = gap > 80 ? Math.round((gap + 24) / 8) * 8 : 0;
      if (extra === ultimoExtra) return;
      ultimoExtra = extra;
      document.documentElement.style.setProperty('--gsf-keyboard-safe-bottom', `${extra}px`);
    };

    const aoRedimensionar = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(ajustar, 80);
    };

    window.visualViewport?.addEventListener('resize', aoRedimensionar);
    window.addEventListener('resize', aoRedimensionar);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.visualViewport?.removeEventListener('resize', aoRedimensionar);
      window.removeEventListener('resize', aoRedimensionar);
      document.documentElement.style.removeProperty('--gsf-keyboard-safe-bottom');
    };
  }, []);

  return null;
}

import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Tira o "glow" preto translúcido que o Android/Chrome desenha na borda de
 * uma lista quando ela é rolada além do conteúdo (efeito nativo do
 * navegador, não é nada que o app desenha) — é a "película preta" que
 * aparece por um instante ao rolar rápido e some ao soltar. Instalado como
 * PWA em standalone, esse glow fica ainda mais visível porque não há barra
 * de endereço absorvendo o gesto.
 */
export function OverscrollGuard() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (document.getElementById('gsf-overscroll-guard')) return;

    const style = document.createElement('style');
    style.id = 'gsf-overscroll-guard';
    style.textContent = `
      html, body, #root {
        overscroll-behavior: none;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return null;
}

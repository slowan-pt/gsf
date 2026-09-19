import { useEffect } from 'react';
import { Platform } from 'react-native';

const CAMPO_EDITAVEL =
  'input, textarea, [contenteditable="true"], [role="textbox"]';

function ehCampoEditavel(alvo: EventTarget | null): alvo is HTMLElement {
  return alvo instanceof HTMLElement && alvo.matches(CAMPO_EDITAVEL);
}

function scrollavel(el: HTMLElement): boolean {
  const estilo = window.getComputedStyle(el);
  const overflowY = estilo.overflowY;
  if (!/(auto|scroll|overlay)/.test(overflowY)) return false;
  return el.scrollHeight > el.clientHeight + 4;
}

function ancestraisScrollaveis(el: HTMLElement): HTMLElement[] {
  const itens: HTMLElement[] = [];
  let atual = el.parentElement;
  while (atual && atual !== document.body) {
    if (scrollavel(atual)) itens.push(atual);
    atual = atual.parentElement;
  }
  return itens;
}

function alturaTecladoAproximada(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

function ajustarVariavelDeTeclado() {
  const gap = alturaTecladoAproximada();
  const extra = gap > 80 ? gap + 96 : 0;
  document.documentElement.style.setProperty('--gsf-keyboard-safe-bottom', `${extra}px`);
}

/** Só corrige quando o campo está mesmo fora da área segura — nunca reposiciona
 * um campo que já está visível, pra não ficar "puxando" a rolagem a cada
 * verificação (era isso que causava o scroll indevido a cada foco). */
function garantirCampoVisivel(campo: HTMLElement) {
  ajustarVariavelDeTeclado();

  const scrolls = ancestraisScrollaveis(campo);
  scrolls.forEach((el) => el.setAttribute('data-gsf-keyboard-scroll', 'true'));

  const vv = window.visualViewport;
  const topoVisivel = vv?.offsetTop ?? 0;
  const alturaVisivel = vv?.height ?? window.innerHeight;
  const margemSuperior = 18;
  const margemInferior = Math.max(120, alturaTecladoAproximada() + 28);
  const fundoVisivel = topoVisivel + alturaVisivel - margemInferior;
  const rect = campo.getBoundingClientRect();

  if (rect.bottom > fundoVisivel || rect.top < topoVisivel + margemSuperior) {
    // 'auto' (instantâneo) em vez de 'smooth': duas rolagens suaves
    // concorrentes (essa + a do próximo timer/resize) é o que fazia a página
    // parecer que não parava de descer.
    campo.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  }
}

function instalarCss() {
  if (document.getElementById('gsf-keyboard-viewport-guard')) return;
  const style = document.createElement('style');
  style.id = 'gsf-keyboard-viewport-guard';
  style.textContent = `
    :root {
      --gsf-keyboard-safe-bottom: 0px;
    }

    html,
    body {
      scroll-padding-bottom: calc(var(--gsf-keyboard-safe-bottom) + 32px) !important;
    }

    body {
      padding-bottom: var(--gsf-keyboard-safe-bottom) !important;
    }

    input,
    textarea,
    [contenteditable="true"],
    [role="textbox"] {
      scroll-margin-top: 18px;
      scroll-margin-bottom: calc(var(--gsf-keyboard-safe-bottom) + 36px);
    }

    [data-gsf-keyboard-scroll="true"] {
      scroll-padding-bottom: calc(var(--gsf-keyboard-safe-bottom) + 32px) !important;
      padding-bottom: max(var(--gsf-keyboard-safe-bottom), env(safe-area-inset-bottom)) !important;
    }
  `;
  document.head.appendChild(style);
}

export function KeyboardViewportGuard() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    instalarCss();

    let campoAtual: HTMLElement | null = null;
    let timer: number | null = null;

    // Uma única correção pendente por vez: foco e os vários eventos de
    // redimensionamento que o teclado do celular dispara enquanto abre/fecha
    // colapsam num só agendamento, em vez de empilhar correções concorrentes.
    const agendarAjuste = (campo: HTMLElement, atraso: number) => {
      if (timer != null) window.clearTimeout(timer);
      campoAtual = campo;
      timer = window.setTimeout(() => {
        timer = null;
        garantirCampoVisivel(campo);
      }, atraso);
    };

    const aoFocar = (evento: FocusEvent) => {
      if (!ehCampoEditavel(evento.target)) return;
      agendarAjuste(evento.target, 320);
    };

    const aoDesfocar = () => {
      if (timer != null) { window.clearTimeout(timer); timer = null; }
      campoAtual = null;
      ajustarVariavelDeTeclado();
    };

    const aoRedimensionar = () => {
      ajustarVariavelDeTeclado();
      if (campoAtual) agendarAjuste(campoAtual, 120);
    };

    document.addEventListener('focusin', aoFocar);
    document.addEventListener('focusout', aoDesfocar);
    window.visualViewport?.addEventListener('resize', aoRedimensionar);
    window.visualViewport?.addEventListener('scroll', aoRedimensionar);
    window.addEventListener('resize', aoRedimensionar);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener('focusin', aoFocar);
      document.removeEventListener('focusout', aoDesfocar);
      window.visualViewport?.removeEventListener('resize', aoRedimensionar);
      window.visualViewport?.removeEventListener('scroll', aoRedimensionar);
      window.removeEventListener('resize', aoRedimensionar);
      document.documentElement.style.removeProperty('--gsf-keyboard-safe-bottom');
    };
  }, []);

  return null;
}

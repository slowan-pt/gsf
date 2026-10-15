import { useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, TextInput, type TextStyle } from 'react-native';
import * as Font from 'expo-font';
import { FONTES_NATIVAS } from './fontesNativas';
import { FONTES_LOCAIS } from './fontesLocais';

/** Fontes embutidas: as do Google (só no celular) e as com arquivo próprio (web e celular). */
const FONTES: Record<string, { pesos: Record<number, string>; arquivos: Record<string, any> }> = { ...FONTES_NATIVAS, ...FONTES_LOCAIS };
import { fonteAtividadesPorId } from './paletaAtividades';
import { CORES_CLARO, CORES_ESCURO } from './tema';

/**
 * Fonte escolhida em Aparência, aplicada em TODO o app (não só nos blocos de atividades):
 *  - web: usa a família do Google Fonts (carregada por CSS em paletaAtividades.ts);
 *  - Android/iPhone: usa os arquivos embutidos (fontesNativas.native.ts), escolhendo o peso certo
 *    (normal, negrito ou extranegrito) conforme o `fontWeight` de cada texto.
 * Texto que já define a própria `fontFamily` (ex.: monoespaçada) não é alterado.
 */
interface ConfigFonte {
  /** Família na web (nome do CSS). */
  web?: string;
  /** Família única (fonte do sistema) quando não há arquivos por peso. */
  unica?: string;
  /** Nome por peso (nativo): {400:'Nunito_400Regular', 700:..., 900:...}. */
  pesos?: Record<number, string>;
}

let atual: ConfigFonte | null = null;
/** Cor escolhida para os textos (null = a do tema). */
let corTexto: string | null = null;
let estado: { config: ConfigFonte | null; cor: string | null } = { config: atual, cor: corTexto };
const ouvintes = new Set<() => void>();
const assinar = (fn: () => void) => { ouvintes.add(fn); return () => { ouvintes.delete(fn); }; };
const obter = () => estado;

function notificar() {
  estado = { config: atual, cor: corTexto };
  ouvintes.forEach((fn) => fn());
}

/** Marca um Text para manter a fonte original do app (ex.: nomes das opções em Aparência): `<Text {...SEM_FONTE_GLOBAL}>`. */
export const SEM_FONTE_GLOBAL: any = { semFonteGlobal: true };

/** Define (ou, com null, restaura) a cor dos textos em todo o app. */
export function definirCorTextoGlobal(cor: string | null) {
  instalarPatch();
  corTexto = cor;
  notificar();
}

const CORES_TEXTO_TEMA = new Set([CORES_CLARO.texto.toLowerCase(), CORES_ESCURO.texto.toLowerCase()]);

/** Troca só o texto que usa a cor padrão do tema; texto com cor própria (branco no cabeçalho, status etc.) fica como está. */
function estiloComCor(cor: string, estilo: any): any {
  const plano = StyleSheet.flatten(estilo) as TextStyle | undefined;
  const atualCor = typeof plano?.color === 'string' ? plano.color.toLowerCase() : null;
  return atualCor && CORES_TEXTO_TEMA.has(atualCor) ? [estilo, { color: cor }] : estilo;
}

/** Famílias do sistema para as fontes que não são do Google Fonts. */
const SISTEMA_NATIVO: Record<string, string | undefined> = {
  classica: Platform.select({ ios: 'Georgia', android: 'serif' }),
  editorial: Platform.select({ ios: 'Times New Roman', android: 'serif' }),
  tecnica: Platform.select({ ios: 'Courier New', android: 'monospace' }),
};

const carregadas = new Set<string>();

async function carregarArquivos(fonteId: string): Promise<void> {
  const def = FONTES[fonteId];
  if (!def || carregadas.has(fonteId)) return;
  await Font.loadAsync(def.arquivos);
  carregadas.add(fonteId);
}

/** Carrega as 12 fontes embutidas (para a tela Aparência mostrar a amostra de cada uma). Só no celular. */
export async function carregarTodasFontesNativas(): Promise<void> {
  const ids = Platform.OS === 'web' ? Object.keys(FONTES_LOCAIS) : Object.keys(FONTES);
  await Promise.all(ids.map((id) => carregarArquivos(id).catch(() => {})));
}

/** Aplica (ou remove, com "padrao") a fonte global. */
export async function aplicarFonteGlobal(fonteId?: string | null): Promise<void> {
  instalarPatch();
  const fonte = fonteAtividadesPorId(fonteId);
  if (!fonte.fontFamily || fonte.id === 'padrao') {
    atual = null;
    notificar();
    return;
  }
  if (Platform.OS === 'web') {
    const local = FONTES_LOCAIS[fonte.id];
    if (local) {
      try { await carregarArquivos(fonte.id); } catch { /* usa a fonte do navegador */ }
    }
    atual = { web: fonte.fontFamily };
    notificar();
    return;
  }
  const def = FONTES[fonte.id];
  if (def) {
    try {
      await carregarArquivos(fonte.id);
      atual = { pesos: def.pesos };
    } catch {
      atual = null; // sem os arquivos: mantém a fonte do sistema
    }
  } else {
    atual = SISTEMA_NATIVO[fonte.id] ? { unica: SISTEMA_NATIVO[fonte.id] } : null;
  }
  notificar();
}

function pesoNumerico(valor: TextStyle['fontWeight']): number {
  if (valor == null || valor === 'normal') return 400;
  if (valor === 'bold') return 700;
  const n = parseInt(String(valor), 10);
  return Number.isFinite(n) ? n : 400;
}

/** Peso disponível mais próximo, preferindo o mais forte quando não há o exato. */
function pesoDisponivel(pesos: Record<number, string>, desejado: number): string {
  const lista = Object.keys(pesos).map(Number).sort((a, b) => a - b);
  const acima = lista.find((p) => p >= desejado);
  return pesos[acima ?? lista[lista.length - 1]];
}

/** Estilo de uma amostra da fonte (tela Aparência), independente da fonte global em uso. */
export function estiloAmostraFonte(fonteId: string, peso = 700): TextStyle | null {
  const fonte = fonteAtividadesPorId(fonteId);
  if (!fonte.fontFamily || fonte.id === 'padrao') return null;
  if (Platform.OS === 'web') return { fontFamily: fonte.fontFamily };
  const def = FONTES[fonte.id];
  if (def) return { fontFamily: pesoDisponivel(def.pesos, peso), fontWeight: 'normal' };
  return SISTEMA_NATIVO[fonte.id] ? { fontFamily: SISTEMA_NATIVO[fonte.id] } : null;
}

function estiloComFonte(config: ConfigFonte, estilo: any): any {
  if (config.web) return [{ fontFamily: config.web }, estilo];
  const plano = StyleSheet.flatten(estilo) as TextStyle | undefined;
  if (plano?.fontFamily) return estilo; // o texto já escolheu a própria fonte
  if (config.unica) return [estilo, { fontFamily: config.unica }];
  if (config.pesos) {
    return [estilo, { fontFamily: pesoDisponivel(config.pesos, pesoNumerico(plano?.fontWeight)), fontWeight: 'normal' }];
  }
  return estilo;
}

let instalado = false;
/** Envolve o render de Text e TextInput para aplicar a fonte global. Idempotente. */
function instalarPatch() {
  if (instalado) return;
  instalado = true;
  for (const Componente of [Text, TextInput] as any[]) {
    const original = Componente?.render;
    if (typeof original !== 'function') continue;
    Componente.render = function renderComFonte(props: any, ref: any) {
      // Assina a fonte e a cor globais: quando mudam, todos os textos se redesenham sem recarregar o app.
      const { config, cor } = useSyncExternalStore(assinar, obter, obter);
      const { semFonteGlobal, ...resto } = props ?? {};
      if ((!config || semFonteGlobal) && !cor) return original.call(this, resto, ref);
      let estilo = resto.style;
      if (config && !semFonteGlobal) estilo = estiloComFonte(config, estilo);
      if (cor) estilo = estiloComCor(cor, estilo);
      return original.call(this, { ...resto, style: estilo }, ref);
    };
  }
}

/** Chamada uma vez no início do app (antes de qualquer tela). */
export function iniciarFonteGlobal() {
  instalarPatch();
}

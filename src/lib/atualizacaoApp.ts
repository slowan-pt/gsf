import { Platform } from 'react-native';
import Constants from 'expo-constants';
import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAtualizacaoStore } from '../stores/atualizacaoStore';

/**
 * Checa se há uma versão nova na Play Store e, se houver, dispara o fluxo
 * "immediate" do Play Core: uma tela cheia do próprio Google Play cobre o
 * app, baixa e instala a atualização, e reinicia o app sozinho — sem sair
 * do app e sem o usuário conseguir cancelar/voltar (é assim que a Play
 * Store implementa "obrigatório": não existe um jeito de fechar essa tela
 * sem atualizar). Só roda no Android e só faz efeito em instalação vinda
 * da Play Store — instalação via APK direto (sideload) não tem como saber
 * a versão da loja, então isso não bloqueia nada nesse caso.
 */
export async function verificarAtualizacaoObrigatoria(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  // 1) Versão mínima definida no servidor (vale para Android, iPhone, TestFlight e APK fora da loja).
  //    Se o build instalado estiver abaixo do mínimo, a tela de atualização obrigatória cobre o app.
  if (await verificarVersaoMinima()) return;
  if (Platform.OS === 'ios') { void verificarAtualizacaoIos(); return; }
  try {
    const inAppUpdates = new SpInAppUpdates(false);
    const resultado = await inAppUpdates.checkNeedsUpdate();
    if (!resultado.shouldUpdate) return;
    await inAppUpdates.startUpdate({ updateType: IAUUpdateKind.IMMEDIATE });
  } catch {
    // Sem Play Store disponível, sem internet, ou instalação fora da loja:
    // não pode travar o app por causa disso.
  }
}

const CHAVE_CACHE_MINIMA = 'app_versao_minima_cache_v1';

interface ExigenciaVersao { build_minimo: number; versao_exibida: string | null; url_loja: string | null }

/** Número do build instalado: CFBundleVersion no iPhone, versionCode no Android. */
function buildInstalado(): number {
  const bruto = (Constants as any).nativeBuildVersion
    ?? (Platform.OS === 'android' ? Constants.expoConfig?.android?.versionCode : Constants.expoConfig?.ios?.buildNumber);
  const n = parseInt(String(bruto ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Consulta app_versao_minima. Sem rede, vale a última exigência guardada no aparelho (quem já foi
 * bloqueado continua bloqueado até atualizar). Sem link da loja não há como bloquear: não bloqueia.
 * Devolve true quando o app está bloqueado por versão antiga.
 */
async function verificarVersaoMinima(): Promise<boolean> {
  const { definir } = useAtualizacaoStore.getState();
  let exigencia: ExigenciaVersao | null = null;
  try {
    const consulta = supabase
      .from('app_versao_minima')
      .select('build_minimo,versao_exibida,url_loja')
      .eq('plataforma', Platform.OS)
      .maybeSingle();
    const resposta: any = await Promise.race([
      consulta,
      new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 3000)),
    ]);
    if (!resposta?.timeout && !resposta?.error) {
      exigencia = (resposta?.data as ExigenciaVersao | null) ?? null;
      await AsyncStorage.setItem(CHAVE_CACHE_MINIMA, JSON.stringify(exigencia)).catch(() => {});
    }
  } catch { /* cai no que está guardado */ }
  if (!exigencia) {
    try {
      const guardado = await AsyncStorage.getItem(CHAVE_CACHE_MINIMA);
      exigencia = guardado ? (JSON.parse(guardado) as ExigenciaVersao | null) : null;
    } catch { /* sem cache */ }
  }
  if (exigencia && exigencia.build_minimo > 0 && exigencia.url_loja && buildInstalado() < exigencia.build_minimo) {
    definir(exigencia.url_loja, exigencia.versao_exibida);
    return true;
  }
  return false;
}

function versaoMaior(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/**
 * iPhone: consulta a App Store (iTunes Lookup) pelo bundle id. Se a versão da loja
 * for maior que a instalada, liga o aviso obrigatório (componente
 * AtualizacaoObrigatoria) com link direto para a página do app. Falha de rede,
 * app ainda não publicado ou TestFlight (versão igual/maior) não bloqueiam nada.
 */
async function verificarAtualizacaoIos(): Promise<void> {
  const { definir } = useAtualizacaoStore.getState();
  try {
    const bundleId = Constants.expoConfig?.ios?.bundleIdentifier;
    const instalada = Constants.expoConfig?.version;
    if (!bundleId || !instalada) return;
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 7000);
    const resp = await fetch(`https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=br&t=${Date.now()}`, { signal: controle.signal });
    clearTimeout(timer);
    const json = await resp.json();
    const loja = json?.results?.[0];
    if (loja?.version && loja?.trackViewUrl && versaoMaior(String(loja.version), instalada)) {
      definir(String(loja.trackViewUrl), String(loja.version));
    } else {
      definir(null, null);
    }
  } catch {
    // Sem internet ou sem resposta da loja: não trava o app.
  }
}

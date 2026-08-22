import { Platform } from 'react-native';
import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates';

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
  if (Platform.OS !== 'android') return;
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

import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { htmlComPonte } from '../lib/classeBiblica';

/** Site publicado: no app nativo não existe "mesma origem" para o HTML estático. */
const WEB_ORIGIN = 'https://dbvplus.pages.dev';

/** Dentro da WebView nativa, o HTML estático fala com o pai pela ponte nativa. */
const PONTE_NATIVA_ESTATICA_JS = `
(function () {
  try {
    window.parent.postMessage = function (data) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    };
  } catch (e) {}
})();
true;
`;

interface Props {
  /** HTML cadastrado (classe do Admin TI). Sem ele, usa o arquivo estático `srcEstatico`. */
  html?: string | null;
  /** Caminho do HTML estático integrado ao app (ex.: /joias-da-eternidade.html). */
  srcEstatico?: string;
  titulo: string;
  /** Respostas já dadas pelo usuário (campo → texto), enviadas ao HTML quando ele avisa que está pronto. */
  respostas: Record<string, string>;
  /** Chamado com o retrato atual dos campos a cada alteração. */
  onSalvar?: (dados: Record<string, string>) => void;
}

/**
 * Mostra uma classe bíblica. Dois protocolos de mensagem:
 *  - integrada (arquivo estático): jde_ready / jde_save / jde_load;
 *  - cadastrada (HTML do banco, com a ponte injetada): cb_ready / cb_save / cb_load.
 * No navegador o HTML cadastrado roda em iframe isolado (sem allow-same-origin),
 * então não enxerga a sessão nem os dados do app.
 */
export function ClasseHtmlView({ html, srcEstatico, titulo, respostas, onSalvar }: Props) {
  const iframeRef = useRef<any>(null);
  const webviewRef = useRef<WebView>(null);
  const respostasRef = useRef(respostas);
  const cadastrada = html != null;
  const tipoCarga = cadastrada ? 'cb_load' : 'jde_load';

  const enviarRespostas = useCallback(() => {
    const msg = { type: tipoCarga, dados: respostasRef.current };
    if (Platform.OS === 'web') iframeRef.current?.contentWindow?.postMessage(msg, '*');
    else webviewRef.current?.postMessage(JSON.stringify(msg));
  }, [tipoCarga]);

  // Respostas que chegam depois do HTML (sincronização da nuvem) também são enviadas.
  useEffect(() => {
    respostasRef.current = respostas;
    enviarRespostas();
  }, [respostas, enviarRespostas]);

  const tratar = useCallback((dados: any) => {
    if (!dados || typeof dados !== 'object') return;
    if (dados.type === 'jde_ready' || dados.type === 'cb_ready') enviarRespostas();
    else if ((dados.type === 'jde_save' || dados.type === 'cb_save') && dados.dados && typeof dados.dados === 'object') {
      onSalvar?.(dados.dados as Record<string, string>);
    }
  }, [enviarRespostas, onSalvar]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const escutar = (e: MessageEvent) => {
      // Só mensagens do nosso iframe.
      if (e.source !== iframeRef.current?.contentWindow) return;
      tratar(e.data);
    };
    window.addEventListener('message', escutar);
    return () => window.removeEventListener('message', escutar);
  }, [tratar]);

  if (Platform.OS === 'web') {
    return (
      <View style={estilos.area}>
        {/* @ts-ignore — iframe só existe no navegador */}
        <iframe
          ref={iframeRef}
          {...(cadastrada
            ? { srcDoc: htmlComPonte(html as string), sandbox: 'allow-scripts allow-forms allow-modals allow-popups' }
            : { src: srcEstatico })}
          style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
          onLoad={() => setTimeout(enviarRespostas, 300)}
          title={titulo}
          allow="fullscreen"
        />
      </View>
    );
  }

  return (
    <View style={estilos.area}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={cadastrada ? { html: htmlComPonte(html as string) } : { uri: `${WEB_ORIGIN}${srcEstatico}` }}
        injectedJavaScriptBeforeContentLoaded={cadastrada ? undefined : PONTE_NATIVA_ESTATICA_JS}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        style={estilos.area}
        onMessage={(ev) => {
          try { tratar(JSON.parse(ev.nativeEvent.data)); } catch { /* mensagem que não é da ponte */ }
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1 },
});

const { withAndroidManifest } = require('@expo/config-plugins');

// O Google Play deduz "recursos obrigatorios" a partir das permissoes (Wi-Fi) e da orientacao fixa em
// retrato, e passa a esconder o app em aparelhos sem eles. Declarar o recurso como opcional
// (required=false) mantem o app disponivel para todos os aparelhos.
const OPCIONAIS = ['android.hardware.wifi', 'android.hardware.screen.portrait'];

module.exports = function withHardwareOpcional(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const existentes = manifest['uses-feature'] ?? [];
    for (const nome of OPCIONAIS) {
      const ja = existentes.find((f) => f.$['android:name'] === nome);
      if (ja) ja.$['android:required'] = 'false';
      else existentes.push({ $: { 'android:name': nome, 'android:required': 'false' } });
    }
    manifest['uses-feature'] = existentes;
    return cfg;
  });
};

const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withGradleProperties, withDangerousMod } = require('@expo/config-plugins');

// Cabeia a keystore de release (fora de /android, que o `expo prebuild --clean`
// apaga e recria do zero a cada build) para dentro do projeto Android gerado,
// sempre que o prebuild roda. Sem isso o template do Expo assina o `release`
// com `signingConfigs.debug`, gerando um AAB com a fingerprint errada para o
// Google Play (foi o que causou o erro de "assinado com chave incorreta").
function lerCredenciais(projectRoot) {
  const propsPath = path.join(projectRoot, 'credentials', 'release-signing.properties');
  const conteudo = fs.readFileSync(propsPath, 'utf8');
  const props = {};
  for (const linha of conteudo.split('\n')) {
    const l = linha.trim();
    if (!l || l.startsWith('#')) continue;
    const idx = l.indexOf('=');
    if (idx === -1) continue;
    props[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
  }
  return props;
}

function withReleaseKeystoreCopy(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const origem = path.join(projectRoot, 'credentials', 'release.keystore');
      const destino = path.join(config.modRequest.platformProjectRoot, 'app', 'release.keystore');
      if (fs.existsSync(origem)) {
        fs.copyFileSync(origem, destino);
      }
      return config;
    },
  ]);
}

function withReleaseSigningProperties(config) {
  return withGradleProperties(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const propsPath = path.join(projectRoot, 'credentials', 'release-signing.properties');
    if (!fs.existsSync(propsPath)) return config;
    const props = lerCredenciais(projectRoot);
    for (const [chave, valor] of Object.entries(props)) {
      config.modResults = config.modResults.filter((item) => !(item.type === 'property' && item.key === chave));
      config.modResults.push({ type: 'property', key: chave, value: valor });
    }
    return config;
  });
}

function withReleaseSigningConfig(config) {
  return withAppBuildGradle(config, (config) => {
    let conteudo = config.modResults.contents;

    if (!conteudo.includes('signingConfigs.release')) {
      conteudo = conteudo.replace(
        /signingConfigs\s*\{\s*debug\s*\{[^}]*\}\s*\}/,
        (match) => match.replace(
          /\}\s*\}$/,
          `}
        release {
            storeFile file(RELEASE_STORE_FILE)
            storePassword RELEASE_STORE_PASSWORD
            keyAlias RELEASE_KEY_ALIAS
            keyPassword RELEASE_KEY_PASSWORD
        }
    }`
        )
      );

      conteudo = conteudo.replace(
        /(release\s*\{\s*(?:\/\/[^\n]*\n\s*)*)signingConfig signingConfigs\.debug/,
        '$1signingConfig signingConfigs.release'
      );
    }

    config.modResults.contents = conteudo;
    return config;
  });
}

module.exports = function withReleaseSigning(config) {
  config = withReleaseSigningProperties(config);
  config = withReleaseKeystoreCopy(config);
  config = withReleaseSigningConfig(config);
  return config;
};

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Permite que Metro resolva e sirva arquivos .wasm (necessário para expo-sqlite no web)
config.resolver.assetExts.push('wasm');
// Modelo do Word da autorização de investidura (assets/modelos), embutido no app.
config.resolver.assetExts.push('docx');

module.exports = config;

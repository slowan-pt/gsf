/**
 * Fontes embutidas no app (Android e iPhone), geradas a partir dos pacotes @expo-google-fonts.
 * Cada fonte traz até três pesos (normal, negrito e extranegrito); fontes de peso único aparecem com um só.
 * Na web as fontes vêm do Google Fonts (ver paletaAtividades.ts) e este arquivo é substituído por fontesNativas.ts.
 */
export const FONTES_NATIVAS: Record<string, { pesos: Record<number, string>; arquivos: Record<string, any> }> = {
  nunito: {
    pesos: { 400: 'Nunito_400Regular', 700: 'Nunito_700Bold', 900: 'Nunito_900Black' },
    arquivos: {
      Nunito_400Regular: require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'),
      Nunito_700Bold: require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
      Nunito_900Black: require('@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf'),
    },
  },
  montserrat: {
    pesos: { 400: 'Montserrat_400Regular', 700: 'Montserrat_700Bold', 900: 'Montserrat_900Black' },
    arquivos: {
      Montserrat_400Regular: require('@expo-google-fonts/montserrat/400Regular/Montserrat_400Regular.ttf'),
      Montserrat_700Bold: require('@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf'),
      Montserrat_900Black: require('@expo-google-fonts/montserrat/900Black/Montserrat_900Black.ttf'),
    },
  },
  sora: {
    pesos: { 400: 'Sora_400Regular', 700: 'Sora_700Bold', 800: 'Sora_800ExtraBold' },
    arquivos: {
      Sora_400Regular: require('@expo-google-fonts/sora/400Regular/Sora_400Regular.ttf'),
      Sora_700Bold: require('@expo-google-fonts/sora/700Bold/Sora_700Bold.ttf'),
      Sora_800ExtraBold: require('@expo-google-fonts/sora/800ExtraBold/Sora_800ExtraBold.ttf'),
    },
  },
  barlow: {
    pesos: { 400: 'Barlow_400Regular', 700: 'Barlow_700Bold', 900: 'Barlow_900Black' },
    arquivos: {
      Barlow_400Regular: require('@expo-google-fonts/barlow/400Regular/Barlow_400Regular.ttf'),
      Barlow_700Bold: require('@expo-google-fonts/barlow/700Bold/Barlow_700Bold.ttf'),
      Barlow_900Black: require('@expo-google-fonts/barlow/900Black/Barlow_900Black.ttf'),
    },
  },
  figtree: {
    pesos: { 400: 'Figtree_400Regular', 700: 'Figtree_700Bold', 900: 'Figtree_900Black' },
    arquivos: {
      Figtree_400Regular: require('@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf'),
      Figtree_700Bold: require('@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf'),
      Figtree_900Black: require('@expo-google-fonts/figtree/900Black/Figtree_900Black.ttf'),
    },
  },
  karla: {
    pesos: { 400: 'Karla_400Regular', 700: 'Karla_700Bold', 800: 'Karla_800ExtraBold' },
    arquivos: {
      Karla_400Regular: require('@expo-google-fonts/karla/400Regular/Karla_400Regular.ttf'),
      Karla_700Bold: require('@expo-google-fonts/karla/700Bold/Karla_700Bold.ttf'),
      Karla_800ExtraBold: require('@expo-google-fonts/karla/800ExtraBold/Karla_800ExtraBold.ttf'),
    },
  },
  saira: {
    pesos: { 400: 'Saira_400Regular', 700: 'Saira_700Bold', 900: 'Saira_900Black' },
    arquivos: {
      Saira_400Regular: require('@expo-google-fonts/saira/400Regular/Saira_400Regular.ttf'),
      Saira_700Bold: require('@expo-google-fonts/saira/700Bold/Saira_700Bold.ttf'),
      Saira_900Black: require('@expo-google-fonts/saira/900Black/Saira_900Black.ttf'),
    },
  },
  'google-sans-flex': {
    pesos: { 400: 'GoogleSansFlex_400Regular', 700: 'GoogleSansFlex_700Bold', 900: 'GoogleSansFlex_900Black' },
    arquivos: {
      GoogleSansFlex_400Regular: require('@expo-google-fonts/google-sans-flex/400Regular/GoogleSansFlex_400Regular.ttf'),
      GoogleSansFlex_700Bold: require('@expo-google-fonts/google-sans-flex/700Bold/GoogleSansFlex_700Bold.ttf'),
      GoogleSansFlex_900Black: require('@expo-google-fonts/google-sans-flex/900Black/GoogleSansFlex_900Black.ttf'),
    },
  },
  'jersey-20': {
    pesos: { 400: 'Jersey20_400Regular' },
    arquivos: {
      Jersey20_400Regular: require('@expo-google-fonts/jersey-20/400Regular/Jersey20_400Regular.ttf'),
    },
  },
  jaro: {
    pesos: { 400: 'Jaro_400Regular' },
    arquivos: {
      Jaro_400Regular: require('@expo-google-fonts/jaro/400Regular/Jaro_400Regular.ttf'),
    },
  },
  montez: {
    pesos: { 400: 'Montez_400Regular' },
    arquivos: {
      Montez_400Regular: require('@expo-google-fonts/montez/400Regular/Montez_400Regular.ttf'),
    },
  },
  kablammo: {
    pesos: { 400: 'Kablammo_400Regular' },
    arquivos: {
      Kablammo_400Regular: require('@expo-google-fonts/kablammo/400Regular/Kablammo_400Regular.ttf'),
    },
  },
  'dancing-script': {
    pesos: { 400: 'DancingScript_400Regular', 700: 'DancingScript_700Bold' },
    arquivos: {
      DancingScript_400Regular: require('@expo-google-fonts/dancing-script/400Regular/DancingScript_400Regular.ttf'),
      DancingScript_700Bold: require('@expo-google-fonts/dancing-script/700Bold/DancingScript_700Bold.ttf'),
    },
  },
  isometra: {
    pesos: { 400: 'Isometra_400Regular' },
    arquivos: {
      Isometra_400Regular: require('@expo-google-fonts/isometra/400Regular/Isometra_400Regular.ttf'),
    },
  },
};

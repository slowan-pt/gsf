/**
 * Fontes com arquivo próprio no app (assets/fonts), de licença livre também para uso comercial:
 *  - Assassin's Creed (Alphabet & Type, freeware pessoal e profissional);
 *  - Matcha Style e Matcha World (Khurasan Studio, grátis pessoal e comercial);
 *  - The Wild Breath of Zelda (uso livre; não é endossada pela Nintendo);
 *  - Science Gothic (SIL Open Font License; cópia da licença em assets/fonts/ScienceGothic-OFL.txt).
 * Valem na web e no celular (carregadas por expo-font).
 */
export const FONTES_LOCAIS: Record<string, { pesos: Record<number, string>; arquivos: Record<string, any> }> = {
  assassin: {
    pesos: { 400: 'AssassinsCreed' },
    arquivos: { AssassinsCreed: require('../../assets/fonts/Assassin.ttf') },
  },
  'matcha-style': {
    pesos: { 400: 'MatchaStyle' },
    arquivos: { MatchaStyle: require('../../assets/fonts/MatchaStyle.ttf') },
  },
  'matcha-world': {
    pesos: { 400: 'MatchaWorld' },
    arquivos: { MatchaWorld: require('../../assets/fonts/MatchaWorld.ttf') },
  },
  'science-gothic': {
    pesos: { 400: 'ScienceGothicMedium', 700: 'ScienceGothicBlack' },
    arquivos: {
      ScienceGothicMedium: require('../../assets/fonts/ScienceGothic-Medium.ttf'),
      ScienceGothicBlack: require('../../assets/fonts/ScienceGothic-Blk.ttf'),
    },
  },
  zelda: {
    pesos: { 400: 'WildBreathOfZelda' },
    arquivos: { WildBreathOfZelda: require('../../assets/fonts/WildBreathOfZelda.otf') },
  },
};

/**
 * Versão Web: não existe "atualização obrigatória" fora de app nativo — o
 * deploy do site já é a versão mais nova assim que publicado. Arquivo
 * separado (em vez de um `if (Platform.OS === 'web') return` dentro do
 * mesmo módulo) porque a lib sp-react-native-in-app-updates não tem
 * variante Web e quebra o bundler do site se for importada estaticamente
 * aqui — o Metro escolhe este arquivo no build Web e nem chega a resolver
 * o outro.
 */
export async function verificarAtualizacaoObrigatoria(): Promise<void> {}

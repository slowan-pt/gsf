/** Cada canal RGB acima disso conta como "branco" (tolera JPEG e degradê leve). */
const LIMITE_BRANCO = 236;
/** Faixa de suavização da borda: do branco puro até este valor o pixel vira semitransparente. */
const LIMITE_BORDA = 190;

/**
 * Remove o fundo branco de uma imagem RGBA (8 bits, 4 canais) *in place*.
 * Só some o branco que encosta na borda da imagem (preenchimento a partir das
 * bordas), então o branco de dentro da logo — olhos, letras, brilhos — fica.
 * Pixels já transparentes também deixam o preenchimento passar, para funcionar
 * depois da margem transparente. Devolve quantos pixels foram removidos.
 */
export function removerFundoBranco(rgba: Uint8Array | Uint8ClampedArray, largura: number, altura: number): number {
  const total = largura * altura;
  const fundo = new Uint8Array(total);
  const fila = new Int32Array(total);
  let ini = 0;
  let fim = 0;

  const ehFundo = (p: number) => {
    const i = p * 4;
    return rgba[i + 3] < 16 || (rgba[i] >= LIMITE_BRANCO && rgba[i + 1] >= LIMITE_BRANCO && rgba[i + 2] >= LIMITE_BRANCO);
  };
  const semear = (p: number) => {
    if (!fundo[p] && ehFundo(p)) { fundo[p] = 1; fila[fim++] = p; }
  };

  for (let x = 0; x < largura; x++) { semear(x); semear((altura - 1) * largura + x); }
  for (let y = 0; y < altura; y++) { semear(y * largura); semear(y * largura + largura - 1); }

  while (ini < fim) {
    const p = fila[ini++];
    const x = p % largura;
    const y = (p - x) / largura;
    if (x > 0) semear(p - 1);
    if (x < largura - 1) semear(p + 1);
    if (y > 0) semear(p - largura);
    if (y < altura - 1) semear(p + largura);
  }

  let removidos = 0;
  for (let p = 0; p < total; p++) {
    if (fundo[p]) { rgba[p * 4 + 3] = 0; removidos++; }
  }

  // Suaviza a borda: pixel claro colado no fundo removido vira semitransparente,
  // sem deixar o halo branco em volta da logo.
  for (let p = 0; p < total; p++) {
    if (fundo[p]) continue;
    const x = p % largura;
    const y = (p - x) / largura;
    const colado = (x > 0 && fundo[p - 1]) || (x < largura - 1 && fundo[p + 1])
      || (y > 0 && fundo[p - largura]) || (y < altura - 1 && fundo[p + largura]);
    if (!colado) continue;
    const i = p * 4;
    const menor = Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
    if (menor <= LIMITE_BORDA) continue;
    const fator = (255 - menor) / (255 - LIMITE_BORDA);
    rgba[i + 3] = Math.round(rgba[i + 3] * Math.max(0, Math.min(1, fator)));
  }
  return removidos;
}

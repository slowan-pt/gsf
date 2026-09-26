/** Diferença máxima (por canal) para um pixel ainda contar como o fundo. */
const TOLERANCIA = 36;
/** Até esta diferença, um pixel colado no fundo removido vira semitransparente (borda suave). */
const FAIXA_BORDA = 100;
/** Cantos que discordam mais que isso indicam foto/degradê, não fundo liso. */
const DISCORDANCIA_CANTOS = 40;

type Cor = [number, number, number];

/** Média de um bloco 3x3 no canto, ignorando pixels transparentes. Null se o canto já é transparente. */
function amostrarCanto(rgba: Uint8Array | Uint8ClampedArray, largura: number, altura: number, cx: number, cy: number): Cor | null {
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const x = Math.min(largura - 1, Math.max(0, cx + dx * (cx === 0 ? 1 : -1)));
      const y = Math.min(altura - 1, Math.max(0, cy + dy * (cy === 0 ? 1 : -1)));
      const i = (y * largura + x) * 4;
      if (rgba[i + 3] < 16) continue;
      r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
    }
  }
  return n ? [r / n, g / n, b / n] : null;
}

/** Cor do fundo liso branco ou preto pelos cantos, ou null se não houver (fundo colorido, foto, já transparente). */
function detectarFundo(rgba: Uint8Array | Uint8ClampedArray, largura: number, altura: number): Cor | null {
  const cantos = [
    amostrarCanto(rgba, largura, altura, 0, 0),
    amostrarCanto(rgba, largura, altura, largura - 1, 0),
    amostrarCanto(rgba, largura, altura, 0, altura - 1),
    amostrarCanto(rgba, largura, altura, largura - 1, altura - 1),
  ].filter((c): c is Cor => c !== null);
  if (cantos.length === 0) return null;

  const media: Cor = [0, 1, 2].map((k) => cantos.reduce((s, c) => s + c[k], 0) / cantos.length) as Cor;
  const discorda = cantos.some((c) => Math.max(Math.abs(c[0] - media[0]), Math.abs(c[1] - media[1]), Math.abs(c[2] - media[2])) > DISCORDANCIA_CANTOS);
  if (discorda) return null;

  const menor = Math.min(...media);
  const maior = Math.max(...media);
  if (menor >= 215) return [255, 255, 255];
  if (maior <= 45) return [0, 0, 0];
  return null;
}

/**
 * Remove o fundo liso branco ou preto de uma imagem RGBA (8 bits, 4 canais)
 * *in place*. O fundo é detectado pelos cantos; some só o que está ligado à
 * borda (preenchimento a partir dela), então branco/preto de dentro da logo
 * (letras, contornos, brilhos) fica. Pixels já transparentes deixam o
 * preenchimento passar, para funcionar depois da margem transparente.
 * Devolve quantos pixels foram removidos (0 se não há fundo branco/preto).
 */
export function removerFundo(rgba: Uint8Array | Uint8ClampedArray, largura: number, altura: number): number {
  const ref = detectarFundo(rgba, largura, altura);
  if (!ref) return 0;

  const total = largura * altura;
  const fundo = new Uint8Array(total);
  const fila = new Int32Array(total);
  let ini = 0;
  let fim = 0;

  const distancia = (p: number) => {
    const i = p * 4;
    return Math.max(Math.abs(rgba[i] - ref[0]), Math.abs(rgba[i + 1] - ref[1]), Math.abs(rgba[i + 2] - ref[2]));
  };
  const ehFundo = (p: number) => rgba[p * 4 + 3] < 16 || distancia(p) <= TOLERANCIA;
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

  // Borda suave: pixel colado no fundo removido e ainda parecido com ele vira
  // semitransparente, sem deixar halo branco/preto em volta da logo.
  for (let p = 0; p < total; p++) {
    if (fundo[p]) continue;
    const x = p % largura;
    const y = (p - x) / largura;
    const colado = (x > 0 && fundo[p - 1]) || (x < largura - 1 && fundo[p + 1])
      || (y > 0 && fundo[p - largura]) || (y < altura - 1 && fundo[p + largura]);
    if (!colado) continue;
    const d = distancia(p);
    if (d >= FAIXA_BORDA) continue;
    const fator = (d - TOLERANCIA) / (FAIXA_BORDA - TOLERANCIA);
    rgba[p * 4 + 3] = Math.round(rgba[p * 4 + 3] * Math.max(0, Math.min(1, fator)));
  }
  return removidos;
}

/**
 * Carrega o fast-png só quando precisa e depois de tornar o TextDecoder seguro.
 *
 * O fast-png cria `new TextDecoder('latin1')` assim que o módulo é carregado. O Hermes (Android/iPhone) só aceita utf-8
 * e lança "RangeError: Unknown encoding: latin1", o que derrubava o app na abertura. Por isso o import é preguiçoso e
 * o latin1 é emulado quando o motor não o conhece.
 */
type FastPng = typeof import('fast-png');
export type PngDecodificado = ReturnType<FastPng['decode']>;

let modulo: FastPng | null = null;

function garantirTextDecoderLatin1(): void {
  const Nativo = (globalThis as { TextDecoder?: new (rotulo?: string, opcoes?: unknown) => { decode(b?: ArrayBufferView | ArrayBuffer, o?: unknown): string } }).TextDecoder;
  if (Nativo) {
    try { new Nativo('latin1'); return; } catch { /* segue e instala o substituto */ }
  }
  const LATIN1 = new Set(['latin1', 'iso-8859-1', 'iso8859-1', 'l1', 'ascii', 'us-ascii', 'windows-1252', 'cp1252']);
  class DecoderSeguro {
    private readonly latin1: boolean;
    private readonly nativo: { decode(b?: ArrayBufferView | ArrayBuffer, o?: unknown): string } | null;
    constructor(rotulo = 'utf-8', opcoes?: unknown) {
      this.latin1 = LATIN1.has(String(rotulo).trim().toLowerCase());
      this.nativo = this.latin1 || !Nativo ? null : new Nativo(rotulo, opcoes);
    }
    decode(entrada?: ArrayBufferView | ArrayBuffer, opcoes?: unknown): string {
      if (!this.latin1) return this.nativo ? this.nativo.decode(entrada, opcoes) : '';
      if (!entrada) return '';
      const bytes = ArrayBuffer.isView(entrada)
        ? new Uint8Array(entrada.buffer, entrada.byteOffset, entrada.byteLength)
        : new Uint8Array(entrada);
      let texto = '';
      for (let i = 0; i < bytes.length; i += 4096) {
        texto += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 4096)));
      }
      return texto;
    }
  }
  (globalThis as { TextDecoder?: unknown }).TextDecoder = DecoderSeguro;
}

export function fastPng(): FastPng {
  if (!modulo) {
    garantirTextDecoderLatin1();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = require('fast-png') as FastPng;
  }
  return modulo;
}

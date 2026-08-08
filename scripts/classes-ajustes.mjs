// Ajustes editoriais e de comportamento aplicados sobre os checklists XLSX.
// Consumido por scripts/gerar-seed-classes.mjs.

/** Formato inferido pelo texto do requisito, quando nao ha ajuste explicito. */
export const PADRAO_UPLOAD = /\bilustre\b|\bilustrar\b|tire fotos|cole as fotos|recorte revistas/i;
export const PADRAO_TEXTO =
  /\bexpliqu|\bexplicar\b|relat[óo]rio|\brelate\b|\bescreva\b|\bescrever\b|\bdescreva\b|\bmencione\b|\bliste\b|\blista\b|registrar|\bregistre\b|reda[çc][ãa]o|par[áa]grafo|\bconte\b|\bqual\b|\bcomo\b|significado|compromisso/i;

export function formatoPeloTexto(texto) {
  const up = PADRAO_UPLOAD.test(texto);
  const tx = PADRAO_TEXTO.test(texto);
  if (up && tx) return 'texto_upload';
  if (up) return 'upload';
  if (tx) return 'texto';
  return 'nenhum';
}

/** Linhas de especialidade detalhadas nao entram: a classe lista so a especialidade. */
export const TIPOS_REMOVIDOS = new Set(['Subitem de especialidade']);

const A = 'Amigo';
const C = 'Companheiro';

/**
 * Ajustes por linha. Chave: `classe::prefixoSecao::codigo::subitem`.
 * O prefixo da seção casa pelo início do nome (ex.: 'I. G' pega 'I. Geral'/'I. Gerais').
 */
export const AJUSTES = {
  // ── I. Geral ────────────────────────────────────────────────────────────
  [`${A}::I. G::1::`]: {
    formato: 'upload',
    chaveCompartilhada: 'documento_identidade',
    idadeMinima: 10,
    documentoCampo: 'rg',
    maxArquivos: 2,
    rotulo: 'Documento de identidade',
  },
  [`${C}::I. G::1::`]: {
    formato: 'upload',
    chaveCompartilhada: 'documento_identidade',
    idadeMinima: 11,
    documentoCampo: 'rg',
    maxArquivos: 2,
    rotulo: 'Documento de identidade',
  },
  [`${A}::I. G::2::a`]: { formato: 'texto' },
  [`${A}::I. G::2::b`]: { formato: 'upload', maxArquivos: 3 },
  [`${A}::I. G::3::c`]: { formato: 'texto' },
  [`${A}::I. G::3::f`]: { formato: 'texto' },
  [`${A}::I. G::4::1`]: { formato: 'texto' },
  [`${A}::I. G::4::2`]: { formato: 'texto' },
  [`${A}::I. G::4::3`]: { formato: 'texto' },
  [`${A}::I. G::4::4`]: { formato: 'texto' },
  [`${A}::I. G::4::5`]: { formato: 'texto' },
  [`${A}::I. G::5::a`]: { formato: 'texto' },
  [`${A}::I. G::5::b`]: { formato: 'texto' },
  [`${A}::I. G::6::a`]: { formato: 'texto' },
  [`${A}::I. G::6::b`]: { formato: 'texto' },
  [`${A}::I. G::6::c`]: { formato: 'texto' },
  [`${A}::I. G::6::d`]: { formato: 'texto' },

  // ── II. Descoberta espiritual ───────────────────────────────────────────
  [`${A}::II.::1::a.1`]: { texto: 'Escreva o que Deus criou em cada dia da Criação.', formato: 'texto' },
  [`${A}::II.::1::b.1`]: {
    texto: 'Quais as 10 pragas que caíram sobre o Egito. Depois, localize-as no caça-palavras. Confira lendo Êxodo 7:14 a Êxodo 12:36.',
    formato: 'texto',
  },
  [`${A}::II.::1::c.1`]: { formato: 'texto' },
  [`${A}::II.::1::d.1`]: { texto: 'Escreva quais são os 39 livros do Antigo Testamento.', formato: 'texto' },
  [`${A}::II.::1::d.2`]: { formato: 'texto' },
  [`${A}::II.::2::a`]: { formato: 'upload', maxArquivos: 3 },

  // ── III. Servindo a outros (escolher duas) ──────────────────────────────
  [`${A}::III.::1::a`]: { grupoEscolha: 'servindo_duas', escolhasNecessarias: 2, formato: 'texto_upload' },
  [`${A}::III.::1::b`]: { grupoEscolha: 'servindo_duas', escolhasNecessarias: 2, formato: 'texto_upload' },
  [`${A}::III.::1::c`]: { grupoEscolha: 'servindo_duas', escolhasNecessarias: 2, formato: 'texto_upload' },
  [`${A}::III.::2::a`]: {
    texto: 'Liste 5 palavras que representam o caráter de um bom cidadão.',
    formato: 'texto',
  },

  // ── IV. Desenvolvendo amizade ───────────────────────────────────────────
  [`${A}::IV.::1::a`]: { remover: true },
  [`${A}::IV.::1::b`]: { formato: 'texto' },
  [`${A}::IV.::1::c`]: { formato: 'texto' },
  [`${A}::IV.::1::d`]: { formato: 'texto' },
  [`${A}::IV.::2::a`]: { formato: 'texto' },
  [`${A}::IV.::2::b`]: { formato: 'texto' },
  [`${A}::IV.::2::c`]: { formato: 'texto' },
  [`${A}::IV.::2::d`]: { formato: 'texto' },

  // ── V. Saúde e aptidão física ───────────────────────────────────────────
  [`${A}::V.::2::a`]: { formato: 'texto' },
  [`${A}::V.::2::b`]: { formato: 'nenhum' },
  [`${A}::V.::2::c`]: { formato: 'texto' },
  [`${A}::V.::2::a.1`]: { formato: 'texto' },
  [`${A}::V.::2::b.1`]: { remover: true },
  [`${A}::V.::2::c.1`]: { formato: 'texto' },
  [`${A}::V.::3::a`]: {
    texto: 'Envie figuras ou desenhos conforme os grupos: carboidratos, vitaminas e minerais, proteínas e gorduras; coloque ao menos três alimentos em cada grupo.',
    formato: 'nenhum',
  },
  [`${A}::V.::3::b`]: { texto: 'Explicar Gênesis 1:29.', formato: 'texto' },
  [`${A}::V.::3::c`]: { formato: 'texto' },
  [`${A}::V.::3::d`]: { remover: true },

  // ── VI. Organização e liderança ─────────────────────────────────────────
  [`${A}::VI.::1::a`]: { formato: 'texto' },
  [`${A}::VI.::1::b`]: { formato: 'texto' },
  [`${A}::VI.::1::c`]: { texto: 'Liste coisas que viu durante a caminhada.', formato: 'texto' },

  // ── VII. Estudo da natureza ─────────────────────────────────────────────
  [`${A}::VII.::2::a`]: { formato: 'texto' },
  [`${A}::VII.::2::b`]: { formato: 'texto' },
  [`${A}::VII.::2::c`]: { formato: 'texto' },
  [`${A}::VII.::3::a`]: { formato: 'texto' },
  [`${A}::VII.::3::b`]: { formato: 'texto' },

  // ── VIII. Arte de acampar ───────────────────────────────────────────────
  [`${A}::VIII.::1::a`]: { formato: 'texto' },
  [`${A}::VIII.::1::b`]: { formato: 'nenhum' },
  [`${A}::VIII.::3::a`]: { formato: 'texto' },
  [`${A}::VIII.::3::b`]: { formato: 'texto' },
  [`${A}::VIII.::4::a`]: { formato: 'texto' },
  [`${A}::VIII.::4::b`]: { formato: 'texto' },

  // ── Classe avançada — Amigo da Natureza ─────────────────────────────────
  [`${A}::Classe avan::1::a`]: { formato: 'nenhum' },
  [`${A}::Classe avan::2::a`]: { formato: 'texto' },
  [`${A}::Classe avan::2::b`]: { formato: 'texto' },
  [`${A}::Classe avan::2::c`]: { formato: 'texto' },
  [`${A}::Classe avan::2::d`]: { formato: 'texto' },
  [`${A}::Classe avan::3::a`]: { formato: 'texto' },
  [`${A}::Classe avan::4::a`]: { formato: 'texto' },
  [`${A}::Classe avan::4::b`]: { formato: 'texto' },
  [`${A}::Classe avan::4::c`]: { formato: 'texto' },
  [`${A}::Classe avan::6::a`]: { formato: 'texto' },
  [`${A}::Classe avan::6::b`]: { formato: 'texto_upload', maxArquivos: 10 },
  [`${A}::Classe avan::6::c`]: { formato: 'texto_upload', maxArquivos: 10 },
  [`${A}::Classe avan::7::a`]: { formato: 'texto' },
  [`${A}::Classe avan::8::a`]: { remover: true },
  [`${A}::Classe avan::8::b`]: { formato: 'texto' },
};

const NOS = [
  'Nó simples', 'Nó cego', 'Nó direito', 'Nó de cirurgião', 'Lais de guia',
  'Lais de guia duplo', 'Escota', 'Catau', 'Nó de pescador', 'Volta do fiel',
  'Nó de gancho', 'Volta da ribeira', 'Nó ordinário',
];

const HINO = [
  'Nós somos os desbravadores', 'os servos do Rei dos reis',
  'sempre avante assim marchamos', 'Fiéis às suas leis',
  'Devemos ao mundo anunciar', 'as novas da salvação',
  'que Cristo virá em breve', 'dar o galardão',
];

const GRUPOS_ALIMENTARES = ['Carboidratos', 'Vitaminas', 'Minerais', 'Proteínas', 'Gorduras'];

/** Linhas novas, inseridas logo depois da linha-âncora informada em `depoisDe`. */
export const NOVOS = [
  // Leitura bíblica de Gênesis e Êxodo vira checkbox
  ...['Gênesis', 'Êxodo'].map((livro, i) => ({
    depoisDe: `${A}::II.::3::`,
    classe: A, codigo: '3', subitem: `L${i + 1}`,
    texto: `Concluí a leitura de ${livro}.`,
    tipo: 'Leitura', formato: 'nenhum', rotulo: livro,
  })),

  // Grupos alimentares (V.3.a)
  ...GRUPOS_ALIMENTARES.map((grupo, i) => ({
    depoisDe: `${A}::V.::3::a`,
    classe: A, codigo: '3', subitem: `a.${i + 1}`,
    texto: `${grupo}: envie ao menos 3 figuras ou desenhos.`,
    tipo: 'Atividade', formato: 'upload', maxArquivos: 6, rotulo: grupo,
  })),

  // Nós (VIII.1.b)
  ...NOS.map((no, i) => ({
    depoisDe: `${A}::VIII.::1::b`,
    classe: A, codigo: '1', subitem: `b.${i + 1}`,
    texto: `${no}: descreva sua função e uso prático.`,
    tipo: 'Nó', formato: 'texto_upload', maxArquivos: 2, rotulo: no,
  })),

  // Hino dos Desbravadores (Classe avançada 1.a)
  ...HINO.map((trecho, i) => ({
    depoisDe: `${A}::Classe avan::1::a`,
    classe: A, codigo: '1', subitem: `a.${i + 1}`,
    texto: `${trecho.toUpperCase()}: escreva o significado deste trecho.`,
    tipo: 'Atividade', formato: 'texto', rotulo: trecho.toUpperCase(),
  })),
];

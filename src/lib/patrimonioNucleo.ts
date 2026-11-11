/**
 * Regras puras do módulo Patrimônio (sem React Native nem rede): tipos, validação do formulário,
 * conversão de dinheiro no formato brasileiro, valor unitário e filtros da lista.
 * Testadas com "node --test" (ver "npm run test:patrimonio").
 */

/** Sem aprovação: o item está em uso ("ativo") ou saiu do patrimônio ("baixado"). */
export type StatusPatrimonio = 'ativo' | 'baixado';
export type CondicaoPatrimonio = 'novo' | 'bom' | 'regular' | 'ruim' | 'inservivel';

export const STATUS_PATRIMONIO: { valor: StatusPatrimonio; rotulo: string }[] = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'baixado', rotulo: 'Baixado' },
];

export const CONDICOES_PATRIMONIO: { valor: CondicaoPatrimonio; rotulo: string }[] = [
  { valor: 'novo', rotulo: 'Novo' },
  { valor: 'bom', rotulo: 'Bom' },
  { valor: 'regular', rotulo: 'Regular' },
  { valor: 'ruim', rotulo: 'Ruim' },
  { valor: 'inservivel', rotulo: 'Inservível' },
];

/** Sugestões iniciais; os valores já usados no clube também aparecem nas listas. */
export const DEPARTAMENTOS_SUGERIDOS = ['Secretaria', 'Tesouraria', 'Diretoria', 'Almoxarifado', 'Cozinha', 'Música', 'Camping', 'Esportes', 'Saúde'];
export const TIPOS_SUGERIDOS = ['Equipamento', 'Móvel', 'Eletrônico', 'Instrumento musical', 'Barraca', 'Utensílio', 'Uniforme', 'Material esportivo', 'Ferramenta'];

/** Marcas mais comuns nos bens de um clube (som, informática, camping, cozinha, ferramentas, instrumentos). As já usadas no clube também aparecem. */
export const MARCAS_SUGERIDAS = [
  'Acer', 'Behringer', 'Black+Decker', 'Bosch', 'Brastemp', 'Britânia', 'Coleman', 'Consul', 'Dell', 'Electrolux', 'Epson', 'Giannini',
  'Guepardo', 'HP', 'Intelbras', 'JBL', 'LG', 'Lenovo', 'Makita', 'Mondial', 'Mor', 'Multilaser', 'Nautika', 'Philips', 'Positivo',
  'Samsung', 'Sony', 'Tagima', 'TCL', 'Tramontina', 'Yamaha',
];

/** Até 5 anexos (fotos e PDFs) por item. */
export const MAX_ANEXOS_PATRIMONIO = 5;

export interface AnexoPatrimonio {
  url: string;
  tipo: 'imagem' | 'pdf';
  nome: string;
}

/** "imagem", "pdf" ou null (tipo não aceito), pelo nome e/ou tipo do arquivo. */
export function tipoDoAnexo(nome: string, mime?: string | null): AnexoPatrimonio['tipo'] | null {
  const m = String(mime ?? '').toLowerCase();
  const n = String(nome ?? '').toLowerCase();
  if (m === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
  if (m.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/.test(n)) return 'imagem';
  return null;
}

/** Anexos de um item: os guardados (válidos, no máximo 5) ou, em item antigo, a foto única como primeiro anexo. */
export function anexosDoItem(item: { anexos?: unknown; foto_url?: string | null }): AnexoPatrimonio[] {
  const lista = Array.isArray(item.anexos) ? item.anexos : [];
  const validos: AnexoPatrimonio[] = [];
  for (const a of lista) {
    const x = a as Partial<AnexoPatrimonio> | null;
    if (!x || typeof x.url !== 'string' || !x.url.trim()) continue;
    validos.push({ url: x.url, tipo: x.tipo === 'pdf' ? 'pdf' : 'imagem', nome: String(x.nome ?? '').trim() || (x.tipo === 'pdf' ? 'Documento.pdf' : 'Foto') });
    if (validos.length >= MAX_ANEXOS_PATRIMONIO) break;
  }
  if (validos.length === 0 && item.foto_url) validos.push({ url: item.foto_url, tipo: 'imagem', nome: 'Foto' });
  return validos;
}

/** URL da capa (primeira imagem) para a lista e os relatórios; null se só houver PDFs. */
export function capaDosAnexos(anexos: AnexoPatrimonio[]): string | null {
  return anexos.find((a) => a.tipo === 'imagem')?.url ?? null;
}

export interface ItemPatrimonio {
  id: number;
  clube_id: number;
  codigo: number;
  status: StatusPatrimonio;
  descricao: string;
  departamento: string | null;
  serie: string | null;
  quantidade: number;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  condicao: CondicaoPatrimonio | null;
  fixada_parede: boolean;
  /** Sala ou local e andar, quando o item é fixado na parede. */
  local_fixacao: string | null;
  segurar: boolean;
  data_aquisicao: string | null;
  valor_aquisicao: number;
  valor_mercado: number;
  data_baixa: string | null;
  motivo_baixa: string | null;
  /** Capa: a primeira imagem dos anexos. */
  foto_url: string | null;
  anexos: AnexoPatrimonio[];
}

/** Campos do formulário, todos como texto (como o usuário digita). */
export interface FormPatrimonio {
  descricao: string;
  departamento: string;
  serie: string;
  quantidade: string;
  tipo: string;
  marca: string;
  modelo: string;
  condicao: CondicaoPatrimonio | '';
  fixada_parede: boolean;
  /** Só vale com fixada_parede ligado. */
  local_fixacao: string;
  segurar: boolean;
  /** dd/mm/aaaa */
  data_aquisicao: string;
  valor_aquisicao: string;
  valor_mercado: string;
}

export const FORM_PATRIMONIO_VAZIO: FormPatrimonio = {
  descricao: '', departamento: '', serie: '', quantidade: '1', tipo: '', marca: '', modelo: '', condicao: '',
  fixada_parede: false, local_fixacao: '', segurar: false, data_aquisicao: '', valor_aquisicao: '', valor_mercado: '',
};

/** "1.234,56" / "1234,56" / "1234.56" / "1.234" (milhar) / "R$ 10" -> número; vazio -> 0; inválido -> null. */
export function lerMoeda(texto: string): number | null {
  const limpo = String(texto ?? '').replace(/R\$|\s/g, '');
  if (!limpo) return 0;
  // Sem vírgula, "1.234" ou "12.345.678" é milhar (a máscara do formulário escreve assim); "12.5" e "12.50" são centavos.
  const milhar = !limpo.includes(',') && /^\d{1,3}(\.\d{3})+$/.test(limpo);
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : milhar ? limpo.replace(/\./g, '') : limpo;
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  const n = Number(normalizado);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/**
 * Máscara de digitação do valor em reais: milhar com ".", centavos com ",". Aceita "." ou "," para começar os centavos
 * ("12.5" e "12,5" viram "12,5"); sem separador, só digita os reais ("1234" -> "1.234").
 * `anterior` é o texto antes da digitação: ao apagar, um "." de milhar não vira separador de centavos.
 */
export function mascararMoeda(novo: string, anterior = ''): string {
  const t = String(novo ?? '').replace(/[^\d.,]/g, '');
  const apagando = String(novo ?? '').length < anterior.length;
  let inteiro: string;
  let cent: string | null = null;
  const iv = t.lastIndexOf(',');
  if (iv >= 0) {
    inteiro = t.slice(0, iv).replace(/\D/g, '');
    cent = t.slice(iv + 1).replace(/\D/g, '').slice(0, 2);
  } else {
    const ip = t.lastIndexOf('.');
    if (ip >= 0 && !apagando) {
      const depois = t.slice(ip + 1).replace(/\D/g, '');
      // "12." (acabou de digitar o ponto), "12.5" ou "12.50" são centavos; "1.234" é milhar.
      const decimal = ip === t.length - 1 || depois.length <= 2;
      if (decimal) { inteiro = t.slice(0, ip).replace(/\D/g, ''); cent = depois.slice(0, 2); }
      else inteiro = t.replace(/\D/g, '');
    } else {
      inteiro = t.replace(/\D/g, '');
    }
  }
  inteiro = inteiro.replace(/^0+(?=\d)/, '');
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return cent === null ? milhar : `${milhar || '0'},${cent}`;
}

/** Valor completo em reais com os centavos ("12" -> "12,00", "12,5" -> "12,50"); vazio continua vazio. */
export function completarMoeda(texto: string): string {
  const t = mascararMoeda(texto, '');
  if (!t) return '';
  const [inteiro, cent = ''] = t.split(',');
  return `${inteiro || '0'},${(cent + '00').slice(0, 2)}`;
}

/** Número -> "1.234,50" (para preencher o formulário). */
export function numeroParaMoeda(n: number): string {
  const [i, c] = (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).split('.');
  return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${c}`;
}

export function formatarMoeda(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Valor unitário = valor de mercado dividido pela quantidade. */
export function valorUnitario(valorMercado: number, quantidade: number): number {
  if (!Number.isFinite(valorMercado) || !Number.isFinite(quantidade) || quantidade < 1) return 0;
  return Math.round((valorMercado / quantidade) * 100) / 100;
}

/** dd/mm/aaaa -> aaaa-mm-dd (null se vazio ou inválido). */
export function dataBrParaIso(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto ?? '').trim());
  if (!m) return null;
  const [, dd, mm, aaaa] = m;
  const d = new Date(Date.UTC(Number(aaaa), Number(mm) - 1, Number(dd)));
  if (d.getUTCFullYear() !== Number(aaaa) || d.getUTCMonth() !== Number(mm) - 1 || d.getUTCDate() !== Number(dd)) return null;
  return `${aaaa}-${mm}-${dd}`;
}

export function dataIsoParaBr(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Máscara de digitação dd/mm/aaaa. */
export function mascararData(texto: string): string {
  const d = String(texto ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export type ErrosForm = Partial<Record<keyof FormPatrimonio, string>>;

export function validarForm(f: FormPatrimonio, hoje = new Date()): ErrosForm {
  const erros: ErrosForm = {};
  if (!f.descricao.trim()) erros.descricao = 'Informe a descrição.';
  else if (f.descricao.trim().length > 200) erros.descricao = 'Use até 200 caracteres.';
  const q = Number(f.quantidade);
  if (!Number.isInteger(q) || q < 1 || q > 100000) erros.quantidade = 'Quantidade inteira, de 1 em diante.';
  if (f.fixada_parede && f.local_fixacao.trim().length > 120) erros.local_fixacao = 'Use até 120 caracteres.';
  if (lerMoeda(f.valor_aquisicao) === null) erros.valor_aquisicao = 'Valor inválido.';
  if (lerMoeda(f.valor_mercado) === null) erros.valor_mercado = 'Valor inválido.';
  if (f.data_aquisicao.trim()) {
    const iso = dataBrParaIso(f.data_aquisicao);
    if (!iso) erros.data_aquisicao = 'Use o formato dd/mm/aaaa.';
    else if (new Date(`${iso}T00:00:00Z`).getTime() > hoje.getTime() + 24 * 3600 * 1000) erros.data_aquisicao = 'A data não pode ser futura.';
  }
  return erros;
}

const vazioParaNulo = (t: string) => (t.trim() ? t.trim() : null);

/** Formulário já validado -> colunas da tabela (sem clube_id, que o chamador acrescenta). */
export function formParaPayload(f: FormPatrimonio) {
  return {
    descricao: f.descricao.trim(),
    departamento: vazioParaNulo(f.departamento),
    serie: vazioParaNulo(f.serie),
    quantidade: Number(f.quantidade),
    tipo: vazioParaNulo(f.tipo),
    marca: vazioParaNulo(f.marca),
    modelo: vazioParaNulo(f.modelo),
    condicao: f.condicao || null,
    fixada_parede: f.fixada_parede,
    local_fixacao: f.fixada_parede ? vazioParaNulo(f.local_fixacao) : null,
    segurar: f.segurar,
    data_aquisicao: f.data_aquisicao.trim() ? dataBrParaIso(f.data_aquisicao) : null,
    valor_aquisicao: lerMoeda(f.valor_aquisicao) ?? 0,
    valor_mercado: lerMoeda(f.valor_mercado) ?? 0,
  };
}

export function itemParaForm(i: ItemPatrimonio): FormPatrimonio {
  const dinheiro = (n: number) => (n ? numeroParaMoeda(n) : '');
  return {
    descricao: i.descricao, departamento: i.departamento ?? '', serie: i.serie ?? '', quantidade: String(i.quantidade),
    tipo: i.tipo ?? '', marca: i.marca ?? '', modelo: i.modelo ?? '', condicao: i.condicao ?? '',
    fixada_parede: i.fixada_parede, local_fixacao: i.local_fixacao ?? '', segurar: i.segurar, data_aquisicao: dataIsoParaBr(i.data_aquisicao),
    valor_aquisicao: dinheiro(i.valor_aquisicao), valor_mercado: dinheiro(i.valor_mercado),
  };
}

export interface FiltrosPatrimonio {
  codigo: string;
  descricao: string;
  departamento: string;
  serie: string;
  status: StatusPatrimonio | '';
}

export const FILTROS_VAZIOS: FiltrosPatrimonio = { codigo: '', descricao: '', departamento: '', serie: '', status: '' };

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function filtrarItens(itens: ItemPatrimonio[], f: FiltrosPatrimonio): ItemPatrimonio[] {
  const codigo = f.codigo.replace(/\D/g, '');
  const descricao = semAcento(f.descricao);
  const serie = semAcento(f.serie);
  return itens.filter((i) => {
    if (codigo && String(i.codigo) !== codigo) return false;
    if (descricao && !semAcento(i.descricao).includes(descricao)) return false;
    if (f.departamento && semAcento(i.departamento ?? '') !== semAcento(f.departamento)) return false;
    if (serie && !semAcento(i.serie ?? '').includes(serie)) return false;
    if (f.status && i.status !== f.status) return false;
    return true;
  });
}

export function totaisPatrimonio(itens: ItemPatrimonio[]) {
  const ativos = itens.filter((i) => i.status !== 'baixado');
  return {
    quantidadeItens: ativos.length,
    quantidadePecas: ativos.reduce((s, i) => s + i.quantidade, 0),
    valorMercado: Math.round(ativos.reduce((s, i) => s + i.valor_mercado, 0) * 100) / 100,
  };
}

export type SituacaoRelatorioPatrimonio = 'ativos' | 'todos' | 'baixados';

/** Itens de um relatório: situação (ativos = os que não receberam baixa) e, se houver, um departamento. */
export function itensDoRelatorio(itens: ItemPatrimonio[], situacao: SituacaoRelatorioPatrimonio, departamento = ''): ItemPatrimonio[] {
  return itens.filter((i) => {
    if (situacao === 'ativos' && i.status === 'baixado') return false;
    if (situacao === 'baixados' && i.status !== 'baixado') return false;
    if (departamento && semAcento(i.departamento ?? '') !== semAcento(departamento)) return false;
    return true;
  });
}

const ROTULO_CONDICAO = Object.fromEntries(CONDICOES_PATRIMONIO.map((c) => [c.valor, c.rotulo])) as Record<string, string>;
const ROTULO_STATUS = Object.fromEntries(STATUS_PATRIMONIO.map((s) => [s.valor, s.rotulo])) as Record<string, string>;
export const rotuloCondicao = (c: CondicaoPatrimonio | null) => (c ? ROTULO_CONDICAO[c] ?? c : '');
export const rotuloStatusPatrimonio = (s: StatusPatrimonio) => ROTULO_STATUS[s] ?? s;

export const CABECALHO_PLANILHA_PATRIMONIO = [
  'Código', 'Status', 'Descrição', 'Departamento', 'Tipo', 'Marca', 'Modelo', 'Série', 'Quantidade', 'Condição',
  'Fixada na parede', 'Local na parede', 'Segurado', 'Data de aquisição', 'Valor de aquisição (R$)', 'Valor de mercado (R$)',
  'Valor unitário (R$)', 'Data de baixa', 'Motivo da baixa', 'Foto',
];

/** Uma linha por item, com todos os campos, na ordem de CABECALHO_PLANILHA_PATRIMONIO. Valores em número (não texto). */
export function linhasPlanilhaPatrimonio(itens: ItemPatrimonio[]): (string | number)[][] {
  return [...itens].sort((a, b) => a.codigo - b.codigo).map((i) => [
    i.codigo, rotuloStatusPatrimonio(i.status), i.descricao, i.departamento ?? '', i.tipo ?? '', i.marca ?? '', i.modelo ?? '',
    i.serie ?? '', i.quantidade, rotuloCondicao(i.condicao), i.fixada_parede ? 'Sim' : 'Não', i.fixada_parede ? i.local_fixacao ?? '' : '', i.segurar ? 'Sim' : 'Não',
    dataIsoParaBr(i.data_aquisicao), i.valor_aquisicao, i.valor_mercado, valorUnitario(i.valor_mercado, i.quantidade),
    dataIsoParaBr(i.data_baixa), i.motivo_baixa ?? '', i.foto_url ?? '',
  ]);
}

export interface ResumoDepartamento { departamento: string; itens: number; pecas: number; valorMercado: number }

/** Totais por departamento (itens baixados ficam de fora); sem departamento aparece como "Sem departamento". */
export function resumoPorDepartamento(itens: ItemPatrimonio[]): ResumoDepartamento[] {
  const mapa = new Map<string, ResumoDepartamento>();
  for (const i of itens) {
    if (i.status === 'baixado') continue;
    const nome = (i.departamento ?? '').trim() || 'Sem departamento';
    const chave = semAcento(nome);
    const atual = mapa.get(chave) ?? { departamento: nome, itens: 0, pecas: 0, valorMercado: 0 };
    atual.itens += 1;
    atual.pecas += i.quantidade;
    atual.valorMercado = Math.round((atual.valorMercado + i.valor_mercado) * 100) / 100;
    mapa.set(chave, atual);
  }
  return Array.from(mapa.values()).sort((a, b) => a.departamento.localeCompare(b.departamento, 'pt-BR'));
}

/** Departamentos/tipos distintos já usados + sugestões, sem repetir (ignora acento e caixa). */
export function opcoesDistintas(usados: (string | null)[], sugeridos: string[]): string[] {
  const mapa = new Map<string, string>();
  for (const v of [...usados, ...sugeridos]) {
    const t = (v ?? '').trim();
    if (t && !mapa.has(semAcento(t))) mapa.set(semAcento(t), t);
  }
  return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

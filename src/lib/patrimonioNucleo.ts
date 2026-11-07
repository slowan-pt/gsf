/**
 * Regras puras do módulo Patrimônio (sem React Native nem rede): tipos, validação do formulário,
 * conversão de dinheiro no formato brasileiro, valor unitário e filtros da lista.
 * Testadas com "node --test" (ver "npm run test:patrimonio").
 */

export type StatusPatrimonio = 'pendente' | 'aprovado' | 'baixado';
export type CondicaoPatrimonio = 'novo' | 'bom' | 'regular' | 'ruim' | 'inservivel';

export const STATUS_PATRIMONIO: { valor: StatusPatrimonio; rotulo: string }[] = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'aprovado', rotulo: 'Aprovado' },
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
  segurar: boolean;
  data_aquisicao: string | null;
  valor_aquisicao: number;
  valor_mercado: number;
  data_baixa: string | null;
  motivo_baixa: string | null;
  foto_url: string | null;
  aprovado_em: string | null;
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
  segurar: boolean;
  /** dd/mm/aaaa */
  data_aquisicao: string;
  valor_aquisicao: string;
  valor_mercado: string;
}

export const FORM_PATRIMONIO_VAZIO: FormPatrimonio = {
  descricao: '', departamento: '', serie: '', quantidade: '1', tipo: '', marca: '', modelo: '', condicao: '',
  fixada_parede: false, segurar: false, data_aquisicao: '', valor_aquisicao: '', valor_mercado: '',
};

/** "1.234,56" / "1234,56" / "1234.56" / "R$ 10" -> número; vazio -> 0; inválido -> null. */
export function lerMoeda(texto: string): number | null {
  const limpo = String(texto ?? '').replace(/R\$|\s/g, '');
  if (!limpo) return 0;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  const n = Number(normalizado);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
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
    segurar: f.segurar,
    data_aquisicao: f.data_aquisicao.trim() ? dataBrParaIso(f.data_aquisicao) : null,
    valor_aquisicao: lerMoeda(f.valor_aquisicao) ?? 0,
    valor_mercado: lerMoeda(f.valor_mercado) ?? 0,
  };
}

export function itemParaForm(i: ItemPatrimonio): FormPatrimonio {
  const dinheiro = (n: number) => (n ? String(n).replace('.', ',') : '');
  return {
    descricao: i.descricao, departamento: i.departamento ?? '', serie: i.serie ?? '', quantidade: String(i.quantidade),
    tipo: i.tipo ?? '', marca: i.marca ?? '', modelo: i.modelo ?? '', condicao: i.condicao ?? '',
    fixada_parede: i.fixada_parede, segurar: i.segurar, data_aquisicao: dataIsoParaBr(i.data_aquisicao),
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

/** Itens de um relatório: situação (ativos = pendentes e aprovados) e, se houver, um departamento. */
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
  'Fixada na parede', 'Segurado', 'Data de aquisição', 'Valor de aquisição (R$)', 'Valor de mercado (R$)',
  'Valor unitário (R$)', 'Data de baixa', 'Motivo da baixa', 'Foto',
];

/** Uma linha por item, com todos os campos, na ordem de CABECALHO_PLANILHA_PATRIMONIO. Valores em número (não texto). */
export function linhasPlanilhaPatrimonio(itens: ItemPatrimonio[]): (string | number)[][] {
  return [...itens].sort((a, b) => a.codigo - b.codigo).map((i) => [
    i.codigo, rotuloStatusPatrimonio(i.status), i.descricao, i.departamento ?? '', i.tipo ?? '', i.marca ?? '', i.modelo ?? '',
    i.serie ?? '', i.quantidade, rotuloCondicao(i.condicao), i.fixada_parede ? 'Sim' : 'Não', i.segurar ? 'Sim' : 'Não',
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

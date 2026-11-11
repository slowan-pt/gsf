/**
 * Regras puras dos mestrados no app: andamento de cada mestrado para um membro e o texto da situação.
 * A contagem OFICIAL fica no banco (função mestrado_contagem, usada pelos gatilhos); aqui só se interpreta o resultado
 * dela. "avaliarMestrado" é o espelho exato dessa contagem e existe para os testes registrarem a regra
 * (src/lib/__tests__/mestradoProgresso.test.ts). Sem imports: roda com "node --test".
 */

export type EtapaProcessoMestrado = 'diretoria' | 'devolvido' | 'aprovado' | 'investido';

/** Mesma chave do banco (mestrado_norm): sem acento, minúscula, espaços simples. */
export function chaveEspecialidade(nome: string): string {
  return String(nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface RegraMestrado {
  quantidade: number;
  especialidades: { nome: string; obrigatoria?: boolean }[];
}

export interface ContagemMestrado {
  total: number;
  necessarias: number;
  obrigatoriasOk: number;
  obrigatoriasTotal: number;
  atende: boolean;
  contadas: string[];
}

/**
 * Espelho de mestrado_contagem: conta só especialidades CONCLUÍDAS (a lista recebida já deve ter só as aprovadas),
 * que constam na lista do mestrado, uma vez por especialidade (nunca duas para a mesma). Obrigatórias contam no total.
 */
export function avaliarMestrado(regra: RegraMestrado, concluidas: string[], ignorar: string[] = []): ContagemMestrado {
  const fora = new Set(ignorar.map(chaveEspecialidade));
  const feitas = new Set(concluidas.map(chaveEspecialidade));
  const contadas = new Map<string, boolean>();
  for (const e of regra.especialidades) {
    const k = chaveEspecialidade(e.nome);
    if (fora.has(k) || !feitas.has(k)) continue;
    contadas.set(k, (contadas.get(k) ?? false) || !!e.obrigatoria);
  }
  const obrigatoriasTotal = new Set(regra.especialidades.filter((e) => e.obrigatoria).map((e) => chaveEspecialidade(e.nome))).size;
  const obrigatoriasOk = [...contadas.values()].filter(Boolean).length;
  const total = contadas.size;
  return {
    total, necessarias: regra.quantidade, obrigatoriasOk, obrigatoriasTotal, contadas: [...contadas.keys()],
    atende: total >= regra.quantidade && obrigatoriasOk >= obrigatoriasTotal,
  };
}

/** Resultado do elegível para o processo: o que a avaliação automática faz com o membro (espelho de mestrado_avaliar_membro). */
export function decisaoAutomatica(atende: boolean, etapa: EtapaProcessoMestrado | null): 'encaminhar' | 'sinalizar' | 'restabelecer' | 'nada' {
  if (etapa === null) return atende ? 'encaminhar' : 'nada';
  if (etapa === 'diretoria') return atende ? 'restabelecer' : 'sinalizar';
  return 'nada'; // devolvido / aprovado / investido: não gera outro processo
}

export interface ProgressoMestrado {
  id: string;
  codigo: string;
  nome: string;
  imagemUrl: string | null;
  etapa: EtapaProcessoMestrado | null;
  alertaRequisitos: boolean;
  total: number;
  necessarias: number;
  obrigatoriasOk: number;
  obrigatoriasTotal: number;
  atende: boolean;
  especialidades: string[];
}

/** Converte a resposta de mestrado_progresso. */
export function lerProgressoMestrados(dados: any): ProgressoMestrado[] {
  if (!Array.isArray(dados)) return [];
  return dados.map((l) => {
    const c = l?.contagem ?? {};
    return {
      id: String(l.id), codigo: String(l.codigo ?? ''), nome: String(l.nome ?? ''), imagemUrl: l.imagem_url ?? null,
      etapa: (l.etapa ?? null) as EtapaProcessoMestrado | null,
      alertaRequisitos: !!l.alerta_requisitos,
      total: Number(c.total ?? 0), necessarias: Number(c.necessarias ?? 0),
      obrigatoriasOk: Number(c.obrigatorias_ok ?? 0), obrigatoriasTotal: Number(c.obrigatorias_total ?? 0),
      atende: !!c.atende,
      especialidades: Array.isArray(c.contadas) ? c.contadas.map((x: any) => String(x?.nome ?? '')) : [],
    };
  });
}

export type TomSituacao = 'andamento' | 'diretoria' | 'pronto' | 'investido' | 'devolvido' | 'alerta';

export interface SituacaoMestrado {
  tom: TomSituacao;
  rotulo: string;
  /** Texto de progresso: "5/7 especialidades" ou "Obrigatórias 2/3 · Opcionais 5/4". */
  progresso: string;
  detalhe: string | null;
  /** 0 a 1 para a barra. */
  fracao: number;
}

/** Quantas especialidades OPCIONAIS o mestrado pede (total exigido menos as obrigatórias) e quantas o membro já tem. */
export function opcionais(p: Pick<ProgressoMestrado, 'total' | 'necessarias' | 'obrigatoriasOk' | 'obrigatoriasTotal'>) {
  return { feitas: Math.max(0, p.total - p.obrigatoriasOk), exigidas: Math.max(0, p.necessarias - p.obrigatoriasTotal) };
}

export function situacaoDoMestrado(p: ProgressoMestrado): SituacaoMestrado {
  const temObrig = p.obrigatoriasTotal > 0;
  const op = opcionais(p);
  const progresso = temObrig
    ? `Obrigatórias ${p.obrigatoriasOk}/${p.obrigatoriasTotal} · Opcionais ${op.feitas}/${op.exigidas}`
    : `${p.total}/${p.necessarias} especialidades`;
  const fracao = p.necessarias > 0 ? Math.min(1, p.total / p.necessarias) : 0;

  if (p.etapa === 'investido') return { tom: 'investido', rotulo: 'Investido', progresso, detalhe: null, fracao: 1 };
  if (p.etapa === 'aprovado') return { tom: 'pronto', rotulo: 'PRONTO PARA INVESTIDURA', progresso, detalhe: 'Aprovado pela diretoria; aguardando a investidura.', fracao: 1 };
  if (p.etapa === 'diretoria') {
    return p.alertaRequisitos
      ? { tom: 'alerta', rotulo: 'Requisitos deixaram de ser cumpridos', progresso, detalhe: 'A diretoria foi sinalizada; a aprovação fica bloqueada.', fracao }
      : { tom: 'diretoria', rotulo: 'Aguardando a diretoria', progresso, detalhe: 'Requisitos cumpridos; encaminhado automaticamente para aprovação.', fracao: 1 };
  }
  if (p.etapa === 'devolvido') return { tom: 'devolvido', rotulo: 'Devolvido pela diretoria', progresso, detalhe: null, fracao };
  if (p.atende) return { tom: 'diretoria', rotulo: 'Requisitos cumpridos', progresso, detalhe: 'Será encaminhado à diretoria automaticamente.', fracao: 1 };

  const faltaObrig = p.obrigatoriasTotal - p.obrigatoriasOk;
  const faltam = Math.max(0, p.necessarias - p.total);
  const detalhe = faltaObrig > 0
    ? `Falta${faltaObrig > 1 ? 'm' : ''} ${faltaObrig} especialidade${faltaObrig > 1 ? 's' : ''} obrigatória${faltaObrig > 1 ? 's' : ''}.`
    : `Falta${faltam > 1 ? 'm' : ''} ${faltam} especialidade${faltam > 1 ? 's' : ''}.`;
  return { tom: 'andamento', rotulo: 'Em andamento', progresso, detalhe, fracao };
}

/** Mestrados que valem mostrar no andamento: os que o membro já começou ou já tem; os zerados ficam de fora. */
export function mestradosParaMostrar(lista: ProgressoMestrado[]): ProgressoMestrado[] {
  const peso = (p: ProgressoMestrado) => (p.etapa === 'aprovado' ? 0 : p.etapa === 'diretoria' ? 1 : p.atende ? 1 : p.etapa === 'devolvido' ? 2 : p.etapa === 'investido' ? 4 : 3);
  return lista
    .filter((p) => p.etapa !== null || p.total > 0)
    .sort((a, b) => peso(a) - peso(b) || (b.total / (b.necessarias || 1)) - (a.total / (a.necessarias || 1)) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

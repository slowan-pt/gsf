/**
 * Dados fictícios da demonstração pública do app (acessível sem login).
 * Nada aqui vem do Supabase — este módulo não importa nenhum cliente de rede,
 * de auth ou de banco. Isso é intencional: é a garantia de que a demo nunca
 * toca em dados reais, mesmo por engano.
 */

export const CLUBE_DEMO = {
  nome: 'Clube Demonstração',
  unidade: 'Desbravadores',
  cidade: 'Cidade Exemplo/UF',
};

export interface UnidadeDemo {
  id: string;
  nome: string;
  cor: string;
  membros: number;
}

export const UNIDADES_DEMO: UnidadeDemo[] = [
  { id: 'u1', nome: 'Águias', cor: '#1a3a5c', membros: 8 },
  { id: 'u2', nome: 'Falcões', cor: '#2e7d32', membros: 7 },
  { id: 'u3', nome: 'Leões', cor: '#c62828', membros: 6 },
];

export interface MembroDemo {
  id: string;
  nome: string;
  unidade: string;
  classe: string;
  pontos: number;
}

export const MEMBROS_DEMO: MembroDemo[] = [
  { id: 'm1', nome: 'Ana Exemplo', unidade: 'Águias', classe: 'Amigo', pontos: 340 },
  { id: 'm2', nome: 'Bruno Exemplo', unidade: 'Falcões', classe: 'Companheiro', pontos: 295 },
  { id: 'm3', nome: 'Carla Exemplo', unidade: 'Leões', classe: 'Pesquisador', pontos: 410 },
  { id: 'm4', nome: 'Davi Exemplo', unidade: 'Águias', classe: 'Amigo', pontos: 180 },
  { id: 'm5', nome: 'Elisa Exemplo', unidade: 'Falcões', classe: 'Guia', pontos: 275 },
];

/** Quem a "Visão do membro" da demo representa. */
export const MEMBRO_LOGADO_DEMO: MembroDemo = MEMBROS_DEMO[0];

export interface EventoAgendaDemo {
  id: string;
  data: string;
  titulo: string;
  local: string;
}

export const AGENDA_DEMO: EventoAgendaDemo[] = [
  { id: 'a1', data: 'Sáb, 10h', titulo: 'Reunião semanal do clube', local: 'Sede do clube' },
  { id: 'a2', data: 'Sáb próximo, 08h', titulo: 'Acampamento de unidade', local: 'Sítio Exemplo' },
  { id: 'a3', data: 'Em 3 semanas', titulo: 'Investidura de classes', local: 'Igreja Exemplo' },
];

export interface AvisoDemo {
  id: string;
  titulo: string;
  corpo: string;
  data: string;
}

export const AVISOS_DEMO: AvisoDemo[] = [
  { id: 'v1', titulo: 'Uniforme completo neste sábado', corpo: 'Trazer uniforme de gala para a reunião.', data: 'Há 2 dias' },
  { id: 'v2', titulo: 'Pagamento da mensalidade', corpo: 'Lembrete sobre o pagamento mensal do clube.', data: 'Há 5 dias' },
];

export interface AtividadeDemo {
  id: string;
  titulo: string;
  descricao: string;
  status: 'concluída' | 'em andamento' | 'planejada';
}

export const ATIVIDADES_DEMO: AtividadeDemo[] = [
  { id: 't1', titulo: 'Trilha ecológica', descricao: 'Caminhada com observação de fauna e flora.', status: 'concluída' },
  { id: 't2', titulo: 'Gincana bíblica', descricao: 'Atividade em equipes sobre o livro de Atos.', status: 'em andamento' },
  { id: 't3', titulo: 'Noite de talentos', descricao: 'Apresentações organizadas pelas unidades.', status: 'planejada' },
];

export interface ClasseDemo {
  id: string;
  nome: string;
  progresso: number; // 0-100
  requisitosConcluidos: number;
  requisitosTotal: number;
}

export const CLASSES_DEMO: ClasseDemo[] = [
  { id: 'c1', nome: 'Amigo', progresso: 100, requisitosConcluidos: 20, requisitosTotal: 20 },
  { id: 'c2', nome: 'Companheiro', progresso: 65, requisitosConcluidos: 13, requisitosTotal: 20 },
  { id: 'c3', nome: 'Pesquisador', progresso: 10, requisitosConcluidos: 2, requisitosTotal: 20 },
];

export interface EspecialidadeDemo {
  id: string;
  nome: string;
  area: string;
  concluida: boolean;
}

export const ESPECIALIDADES_DEMO: EspecialidadeDemo[] = [
  { id: 'e1', nome: 'Primeiros Socorros', area: 'Saúde', concluida: true },
  { id: 'e2', nome: 'Nós e Amarras', area: 'Atividades ao ar livre', concluida: true },
  { id: 'e3', nome: 'Astronomia', area: 'Ciência', concluida: false },
];

export interface RankingDemo {
  posicao: number;
  nome: string;
  pontos: number;
}

export const RANKING_DEMO: RankingDemo[] = MEMBROS_DEMO
  .slice()
  .sort((a, b) => b.pontos - a.pontos)
  .map((m, i) => ({ posicao: i + 1, nome: m.nome, pontos: m.pontos }));

export const RELATORIO_RESUMO_DEMO = {
  totalMembros: MEMBROS_DEMO.length,
  presencaMediaPercentual: 82,
  classesEmAndamento: 5,
  especialidadesConcluidasNoMes: 3,
  pontosDistribuidosNoMes: 1240,
};

export const ANO_BIBLICO_DEMO = {
  diaAtual: 'Dia 259 de 365',
  referencia: 'Salmos 119:1-24',
  percentualConcluido: 71,
};

export const PERFIL_MEMBRO_DEMO = {
  nome: MEMBRO_LOGADO_DEMO.nome,
  unidade: MEMBRO_LOGADO_DEMO.unidade,
  classeAtual: MEMBRO_LOGADO_DEMO.classe,
  entradaNoClube: 'Membro desde 2023 (exemplo)',
};

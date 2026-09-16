/**
 * Dados fictícios da demonstração pública do app (acessível sem login, em
 * iOS, Android e web). Nada aqui vem do Supabase — este módulo não importa
 * nenhum cliente de rede, de auth ou de banco. Isso é intencional: é a
 * garantia de que a demo nunca toca em dados reais, mesmo por engano.
 *
 * Nenhum nome, unidade, e-mail, documento ou pontuação aqui reproduz dados
 * reais do Supabase de produção — tudo foi inventado para esta demo.
 */

export const CLUBE_DEMO = {
  nome: 'Clube Horizonte',
  tipo: 'Clube de Desbravadores',
  cidade: 'Cidade Demonstrativa – SP',
  codigo: 'DEMO-001',
};

export interface UnidadeDemo {
  id: string;
  nome: string;
  cor: string;
  conselheiro: string;
  membros: number;
  pontos: number;
  posicao: number;
  progressoMedio: number; // 0-100
}

export const UNIDADES_DEMO: UnidadeDemo[] = [
  { id: 'u1', nome: 'Unidade Aurora', cor: '#1a3a5c', conselheiro: 'Fernanda Costa (fictícia)', membros: 4, pontos: 1180, posicao: 1, progressoMedio: 74 },
  { id: 'u2', nome: 'Unidade Pioneiros', cor: '#2e7d32', conselheiro: 'Rodrigo Nunes (fictício)', membros: 4, pontos: 1040, posicao: 2, progressoMedio: 61 },
  { id: 'u3', nome: 'Unidade Guardiões', cor: '#c62828', conselheiro: 'Patrícia Lima (fictícia)', membros: 4, pontos: 960, posicao: 3, progressoMedio: 55 },
  { id: 'u4', nome: 'Unidade Estrela do Norte', cor: '#6a1b9a', conselheiro: 'Marcos Teixeira (fictício)', membros: 4, pontos: 890, posicao: 4, progressoMedio: 48 },
];

export type SituacaoMembroDemo = 'ativo' | 'em observação';

export interface MembroDemo {
  id: string;
  nome: string;
  iniciais: string;
  unidade: string;
  funcao: string;
  classe: string;
  pontos: number;
  situacao: SituacaoMembroDemo;
  progressoResumo: string;
}

export const MEMBROS_DEMO: MembroDemo[] = [
  { id: 'm1', nome: 'Marina Alves', iniciais: 'MA', unidade: 'Unidade Aurora', funcao: 'Diretora de demonstração', classe: 'Liderança', pontos: 520, situacao: 'ativo', progressoResumo: 'Curso de liderança concluído' },
  { id: 'm2', nome: 'Lucas Ribeiro', iniciais: 'LR', unidade: 'Unidade Aurora', funcao: 'Membro de demonstração', classe: 'Companheiro', pontos: 410, situacao: 'ativo', progressoResumo: '13/20 requisitos concluídos' },
  { id: 'm3', nome: 'Beatriz Souza', iniciais: 'BS', unidade: 'Unidade Aurora', funcao: 'Membro', classe: 'Pesquisador', pontos: 385, situacao: 'ativo', progressoResumo: '8/20 requisitos concluídos' },
  { id: 'm4', nome: 'Thiago Martins', iniciais: 'TM', unidade: 'Unidade Aurora', funcao: 'Membro', classe: 'Amigo', pontos: 260, situacao: 'ativo', progressoResumo: '20/20 requisitos concluídos' },
  { id: 'm5', nome: 'Camila Fernandes', iniciais: 'CF', unidade: 'Unidade Pioneiros', funcao: 'Membro', classe: 'Guia', pontos: 470, situacao: 'ativo', progressoResumo: 'Classe avançada em andamento' },
  { id: 'm6', nome: 'Gabriel Oliveira', iniciais: 'GO', unidade: 'Unidade Pioneiros', funcao: 'Membro', classe: 'Companheiro', pontos: 300, situacao: 'ativo', progressoResumo: '11/20 requisitos concluídos' },
  { id: 'm7', nome: 'Isabela Rocha', iniciais: 'IR', unidade: 'Unidade Pioneiros', funcao: 'Membro', classe: 'Pesquisador', pontos: 275, situacao: 'em observação', progressoResumo: '4/20 requisitos concluídos' },
  { id: 'm8', nome: 'Rafael Pereira', iniciais: 'RP', unidade: 'Unidade Pioneiros', funcao: 'Membro', classe: 'Amigo', pontos: 190, situacao: 'ativo', progressoResumo: '16/20 requisitos concluídos' },
  { id: 'm9', nome: 'Larissa Gomes', iniciais: 'LG', unidade: 'Unidade Guardiões', funcao: 'Membro', classe: 'Companheiro', pontos: 340, situacao: 'ativo', progressoResumo: '15/20 requisitos concluídos' },
  { id: 'm10', nome: 'Eduardo Barbosa', iniciais: 'EB', unidade: 'Unidade Guardiões', funcao: 'Membro', classe: 'Amigo', pontos: 220, situacao: 'ativo', progressoResumo: '18/20 requisitos concluídos' },
  { id: 'm11', nome: 'Juliana Cardoso', iniciais: 'JC', unidade: 'Unidade Guardiões', funcao: 'Membro', classe: 'Pesquisador', pontos: 255, situacao: 'ativo', progressoResumo: '9/20 requisitos concluídos' },
  { id: 'm12', nome: 'Vinícius Araújo', iniciais: 'VA', unidade: 'Unidade Guardiões', funcao: 'Membro', classe: 'Guia', pontos: 145, situacao: 'em observação', progressoResumo: '5/20 requisitos concluídos' },
  { id: 'm13', nome: 'Amanda Dias', iniciais: 'AD', unidade: 'Unidade Estrela do Norte', funcao: 'Membro', classe: 'Companheiro', pontos: 310, situacao: 'ativo', progressoResumo: '12/20 requisitos concluídos' },
  { id: 'm14', nome: 'Felipe Correia', iniciais: 'FC', unidade: 'Unidade Estrela do Norte', funcao: 'Membro', classe: 'Amigo', pontos: 200, situacao: 'ativo', progressoResumo: '17/20 requisitos concluídos' },
  { id: 'm15', nome: 'Sofia Ramos', iniciais: 'SR', unidade: 'Unidade Estrela do Norte', funcao: 'Membro', classe: 'Pesquisador', pontos: 230, situacao: 'ativo', progressoResumo: '7/20 requisitos concluídos' },
  { id: 'm16', nome: 'Daniel Moura', iniciais: 'DM', unidade: 'Unidade Estrela do Norte', funcao: 'Membro', classe: 'Amigo', pontos: 150, situacao: 'em observação', progressoResumo: '10/20 requisitos concluídos' },
];

/** Quem a "Visão da diretoria" da demo representa. */
export const DIRETORA_DEMO = MEMBROS_DEMO[0];

/** Quem a "Visão do membro" da demo representa. */
export const MEMBRO_LOGADO_DEMO = MEMBROS_DEMO[1];

export interface EventoAgendaDemo {
  id: string;
  data: string;
  titulo: string;
  local: string;
  quando: 'passado' | 'futuro';
}

export const AGENDA_DEMO: EventoAgendaDemo[] = [
  { id: 'a1', data: 'Há 2 semanas', titulo: 'Treinamento de especialidade', local: 'Sede do clube', quando: 'passado' },
  { id: 'a2', data: 'Há 1 semana', titulo: 'Atividade comunitária', local: 'Centro comunitário demonstrativo', quando: 'passado' },
  { id: 'a3', data: 'Sáb, 10h', titulo: 'Reunião semanal do clube', local: 'Sede do clube', quando: 'futuro' },
  { id: 'a4', data: 'Sáb próximo, 08h', titulo: 'Acampamento demonstrativo', local: 'Sítio Horizonte (fictício)', quando: 'futuro' },
  { id: 'a5', data: 'Em 2 semanas', titulo: 'Reunião de responsáveis', local: 'Salão social', quando: 'futuro' },
  { id: 'a6', data: 'Em 4 semanas', titulo: 'Cerimônia de investidura', local: 'Igreja Demonstrativa', quando: 'futuro' },
];

export interface AvisoDemo {
  id: string;
  titulo: string;
  corpo: string;
  data: string;
  categoria: string;
}

export const AVISOS_DEMO: AvisoDemo[] = [
  { id: 'v1', titulo: 'Uniforme completo neste sábado', corpo: 'Trazer uniforme de gala para a reunião semanal.', data: 'Há 1 dia', categoria: 'Uniforme' },
  { id: 'v2', titulo: 'Pagamento da mensalidade', corpo: 'Lembrete sobre o pagamento mensal do clube.', data: 'Há 2 dias', categoria: 'Financeiro' },
  { id: 'v3', titulo: 'Inscrições para o acampamento', corpo: 'Últimos dias para confirmar presença no acampamento demonstrativo.', data: 'Há 4 dias', categoria: 'Eventos' },
  { id: 'v4', titulo: 'Nova especialidade disponível', corpo: 'A especialidade de Informática já pode ser iniciada pelos membros.', data: 'Há 6 dias', categoria: 'Classes' },
  { id: 'v5', titulo: 'Reunião de pais e responsáveis', corpo: 'Encontro para apresentar o planejamento do próximo trimestre.', data: 'Há 9 dias', categoria: 'Responsáveis' },
];

export type CategoriaAtividadeDemo =
  | 'Missionária e comunitária' | 'Profissional' | 'Recreativa'
  | 'Ciência e saúde' | 'Estudo da natureza' | 'Vida familiar';

export interface AtividadeDemo {
  id: string;
  titulo: string;
  descricao: string;
  categoria: CategoriaAtividadeDemo;
  status: 'concluída' | 'em andamento' | 'planejada';
}

export const ATIVIDADES_DEMO: AtividadeDemo[] = [
  { id: 't1', titulo: 'Mutirão no asilo demonstrativo', descricao: 'Visita e ação social com os idosos da comunidade fictícia.', categoria: 'Missionária e comunitária', status: 'concluída' },
  { id: 't2', titulo: 'Oficina de primeiros socorros', descricao: 'Prática de técnicas básicas de atendimento emergencial.', categoria: 'Ciência e saúde', status: 'concluída' },
  { id: 't3', titulo: 'Trilha ecológica', descricao: 'Caminhada com observação de fauna e flora.', categoria: 'Estudo da natureza', status: 'concluída' },
  { id: 't4', titulo: 'Gincana bíblica', descricao: 'Atividade em equipes sobre o livro de Atos.', categoria: 'Vida familiar', status: 'em andamento' },
  { id: 't5', titulo: 'Feira de profissões', descricao: 'Convidados apresentam suas carreiras aos membros.', categoria: 'Profissional', status: 'em andamento' },
  { id: 't6', titulo: 'Noite de talentos', descricao: 'Apresentações organizadas pelas unidades.', categoria: 'Recreativa', status: 'planejada' },
  { id: 't7', titulo: 'Campanha do agasalho', descricao: 'Arrecadação de roupas para doação no inverno.', categoria: 'Missionária e comunitária', status: 'planejada' },
];

export interface ClasseDemo {
  id: string;
  nome: string;
  categoria: string;
  progresso: number; // 0-100
  requisitosConcluidos: number;
  requisitosEmAndamento: number;
  requisitosPendentes: number;
  requisitosTotal: number;
}

export const CLASSES_DEMO: ClasseDemo[] = [
  { id: 'c1', nome: 'Amigo', categoria: 'Classe regular', progresso: 100, requisitosConcluidos: 20, requisitosEmAndamento: 0, requisitosPendentes: 0, requisitosTotal: 20 },
  { id: 'c2', nome: 'Companheiro', categoria: 'Classe regular', progresso: 65, requisitosConcluidos: 13, requisitosEmAndamento: 3, requisitosPendentes: 4, requisitosTotal: 20 },
  { id: 'c3', nome: 'Pesquisador', categoria: 'Classe regular', progresso: 35, requisitosConcluidos: 7, requisitosEmAndamento: 2, requisitosPendentes: 11, requisitosTotal: 20 },
  { id: 'c4', nome: 'Guia', categoria: 'Classe avançada', progresso: 10, requisitosConcluidos: 2, requisitosEmAndamento: 1, requisitosPendentes: 17, requisitosTotal: 20 },
];

export interface EspecialidadeDemo {
  id: string;
  nome: string;
  area: string;
  status: 'concluída' | 'em andamento' | 'disponível';
}

export const ESPECIALIDADES_DEMO: EspecialidadeDemo[] = [
  { id: 'e1', nome: 'Primeiros Socorros', area: 'Saúde', status: 'concluída' },
  { id: 'e2', nome: 'Acampamento', area: 'Atividades ao ar livre', status: 'concluída' },
  { id: 'e3', nome: 'Nós e Amarras', area: 'Atividades ao ar livre', status: 'concluída' },
  { id: 'e4', nome: 'Astronomia', area: 'Ciência', status: 'em andamento' },
  { id: 'e5', nome: 'Conservação Ambiental', area: 'Natureza', status: 'em andamento' },
  { id: 'e6', nome: 'Culinária', area: 'Habilidades domésticas', status: 'disponível' },
  { id: 'e7', nome: 'Informática', area: 'Habilidades manuais', status: 'disponível' },
  { id: 'e8', nome: 'Civismo', area: 'Vida cristã e cidadania', status: 'disponível' },
];

export interface RankingItemDemo {
  posicao: number;
  nome: string;
  pontos: number;
}

export const RANKING_GERAL_DEMO: RankingItemDemo[] = MEMBROS_DEMO
  .slice()
  .sort((a, b) => b.pontos - a.pontos)
  .map((m, i) => ({ posicao: i + 1, nome: m.nome, pontos: m.pontos }));

export const RANKING_UNIDADES_DEMO: RankingItemDemo[] = UNIDADES_DEMO
  .slice()
  .sort((a, b) => b.pontos - a.pontos)
  .map((u, i) => ({ posicao: i + 1, nome: u.nome, pontos: u.pontos }));

export const RANKING_INDIVIDUAL_DEMO = RANKING_GERAL_DEMO.slice(0, 8);

export const HISTORICO_PONTOS_DEMO = [
  { id: 'h1', quando: 'Esta semana', descricao: 'Pontos de participação na reunião semanal', pontos: 40 },
  { id: 'h2', quando: 'Semana passada', descricao: 'Pontos extras por atividade comunitária', pontos: 60 },
  { id: 'h3', quando: 'Há 2 semanas', descricao: 'Pontos de presença e uniforme', pontos: 25 },
];

export const RELATORIO_RESUMO_DEMO = {
  totalMembros: MEMBROS_DEMO.length,
  presencaMediaPercentual: 82,
  atividadesConcluidas: ATIVIDADES_DEMO.filter((a) => a.status === 'concluída').length,
  classesEmAndamento: CLASSES_DEMO.filter((c) => c.progresso > 0 && c.progresso < 100).length,
  especialidadesConcluidasNoMes: ESPECIALIDADES_DEMO.filter((e) => e.status === 'concluída').length,
  pontosDistribuidosNoMes: 1240,
  pontosPorUnidade: UNIDADES_DEMO.map((u) => ({ unidade: u.nome, pontos: u.pontos })),
};

export const ANO_BIBLICO_DEMO = {
  diaAtual: 'Dia 259 de 365',
  referencia: 'Salmos 119:1-24',
  sequenciaDias: 14,
  percentualConcluido: 71,
  registrosRecentes: [
    { dia: 'Dia 259', referencia: 'Salmos 119:1-24' },
    { dia: 'Dia 258', referencia: 'Salmos 118' },
    { dia: 'Dia 257', referencia: 'Salmos 116-117' },
  ],
};

/** Módulos administrativos exibidos (somente leitura) na visão da diretoria. */
export const MODULOS_ADMIN_DEMO = [
  { id: 'mod1', nome: 'Clubes', descricao: 'Dados cadastrais do Clube Horizonte' },
  { id: 'mod2', nome: 'Unidades', descricao: '4 unidades ativas' },
  { id: 'mod3', nome: 'Membros', descricao: '16 membros fictícios' },
  { id: 'mod4', nome: 'Classes', descricao: 'Acompanhamento de progresso' },
  { id: 'mod5', nome: 'Especialidades', descricao: '8 especialidades cadastradas' },
  { id: 'mod6', nome: 'Atividades', descricao: '7 atividades no período' },
  { id: 'mod7', nome: 'Avisos', descricao: '5 avisos recentes' },
  { id: 'mod8', nome: 'Mensagens administrativas', descricao: 'Comunicação interna da diretoria' },
  { id: 'mod9', nome: 'Pontuação', descricao: 'Lançamentos e histórico de pontos' },
  { id: 'mod10', nome: 'Auditoria', descricao: 'Registro de ações administrativas' },
  { id: 'mod11', nome: 'Relatórios', descricao: 'Indicadores gerais do clube' },
  { id: 'mod12', nome: 'Importação de planilha', descricao: 'Importação de membros em lote' },
];

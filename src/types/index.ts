export type Perfil = 'admin_geral' | 'admin_diretoria' | 'desbravador';

export type StatusDoc = 'OK' | 'NOK' | 'NA' | null;

export type StatusClasse = 'OK' | 'Em Andamento' | null;

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  perfil: Perfil;
  unidade_id?: string;
  dbv_id?: number;
  created_at: string;
}

export interface Unidade {
  id: number;
  nome: string;
  codigo_clube: number;
  senha_unidade: number;
}

export interface Desbravador {
  id: number;
  idx: number;
  id_sgc: string;
  nome: string;
  data_nascimento: string;
  idade: number;
  genero: 'M' | 'F';
  unidade_id: number;
  unidade_nome: string;
  cargo: string;
  contato?: string;
  email?: string;
  camisa?: string;
  campori_dsa: boolean;
  nome_responsavel?: string;
  contato_responsavel?: string;
  foto_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Conselheiro {
  id: number;
  nome: string;
  classe: string;
  id_sgc: string;
  email?: string;
  data_nascimento?: string;
  unidade_id: number;
  login: string;
}

export interface Documento {
  id: number;
  dbv_id: number;
  rg: StatusDoc;
  cpf: StatusDoc;
  rg_resp: StatusDoc;
  cartao_sus: StatusDoc;
  cartao_plano: StatusDoc;
  ficha_saude: StatusDoc;
  carteira_vacinacao: StatusDoc;
  laudo_medico: StatusDoc;
  ficha_reg: StatusDoc;
  comp_residencia: StatusDoc;
  aut_saida: StatusDoc;
  aut_viagem: StatusDoc;
  ri_assinado: StatusDoc;
  foto: StatusDoc;
  ant_criminais: StatusDoc;
  updated_at: string;
}

export interface ProgressoClasse {
  id: number;
  dbv_id: number;
  amigo: StatusClasse;
  amigo_nat: StatusClasse;
  companheiro: StatusClasse;
  comp_exc: StatusClasse;
  pesquisador: StatusClasse;
  pesquisador_cb: StatusClasse;
  pioneiro: StatusClasse;
  pioneiro_nf: StatusClasse;
  excursionista: StatusClasse;
  exc_mata: StatusClasse;
  guia: StatusClasse;
  guia_exp: StatusClasse;
  agrupada: StatusClasse;
  lider: StatusClasse;
  lider_master: StatusClasse;
  lider_ma: StatusClasse;
  updated_at: string;
}

export interface Especialidade {
  id: number;
  dbv_id: number;
  nome: string;
  status: StatusDoc;
  updated_at: string;
}

export interface Evento {
  id: number;
  data: string;
  horario?: string;
  local?: string;
  atividade: string;
  responsavel?: string;
  apoio?: string;
  material?: string;
  observacoes?: string;
  semestre: 1 | 2;
}

export interface Pontuacao {
  id: number;
  dbv_id: number;
  data: string;
  presenca: boolean;
  pontualidade: boolean;
  material: boolean;
  uniforme: boolean;
  bom_biblia: number;
  pontos_extras: number;
  classe_biblica: number;
  especialidade: number;
  pgm_especial: number;
  atividade_unidade: number;
  observacao?: string;
  lancado_por?: string;
  created_at: string;
  updated_at: string;
  sincronizado: boolean;
}

export interface ConfigCampori {
  id: number;
  num_parcelas: number;
  data_vencimento_dia: number;
  parcelas: ParcelaCamporiConfig[];
  updated_at: string;
}

export interface ParcelaCamporiConfig {
  numero: number;
  valor: number;
  descricao?: string;
}

export interface PagamentoCampori {
  id: number;
  dbv_id: number;
  parcela_numero: number;
  valor_pago: number;
  data_pagamento?: string;
  pago: boolean;
  observacao?: string;
  updated_at: string;
  sincronizado: boolean;
}

export interface RankingDBV {
  dbv_id: number;
  nome: string;
  unidade: string;
  total_pontos: number;
  posicao: number;
}

export interface RankingUnidade {
  unidade_id: number;
  nome: string;
  total_pontos: number;
  posicao: number;
}

export interface OperacaoPendente {
  id: string;
  tabela: string;
  operacao: 'INSERT' | 'UPDATE' | 'DELETE';
  dados: Record<string, unknown>;
  created_at: string;
}

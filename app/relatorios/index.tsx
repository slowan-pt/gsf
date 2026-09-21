import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../src/stores/authStore';
import { useDBVStore } from '../../src/stores/dbvStore';
import { getDB } from '../../src/lib/database';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId } from '../../src/lib/contextoAtual';
import { usePermissoes } from '../../src/lib/permissoes';
import { BottomNav } from '../../src/components/BottomNav';
import { Avatar, avatarCor } from '../../src/components/common/Avatar';
import * as XLSX from 'xlsx';
import { carregarCatalogoClasses, classesDoCatalogo } from '../../src/lib/classesRequisitos';
import {
  gerarDadosRelatorioClasses,
  montarHTMLClasses,
  montarPlanilhaClasses,
} from '../../src/lib/relatorioClasses';
import type { Desbravador, Documento } from '../../src/types';
import { combinaBusca } from '../../src/lib/texto';
import { avisar, confirmar } from '../../src/stores/avisoStore';
import {
  carregarClassesModelo,
  carregarEspecialidadesModelo,
  classesFallback,
  type ClasseModelo,
  type EspecialidadeModelo,
} from '../../src/lib/modelosPrograma';
import {
  carregarModoExibicaoRelatorios,
  salvarModoExibicaoRelatorios,
  MODO_EXIBICAO_PADRAO,
  type ModoExibicaoMembro,
} from '../../src/lib/relatoriosConfig';
import { usePontuacaoStore, somaPontuacaoBase, ehCargoConselheiro, type ConfigPontuacao } from '../../src/stores/pontuacaoStore';
import { CATEGORIAS_CONFIGURAVEIS, CATEGORIAS_DIRETAS, valorCategoriaConfiguravel, valorCategoriaDireta } from '../../src/lib/categoriasPontuacao';
import { buscarPaginado } from '../../src/lib/supabasePaginado';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone } from '../../src/lib/tema';

type TipoFormativo = 'classe' | 'especialidade';
type SituacaoFormativa = 'entregue' | 'pronto' | 'pendente_aprovacao';

interface ItemFormativoRelatorio {
  id: string;
  dbv_id: number;
  membro_nome: string;
  unidade_nome: string;
  tipo: TipoFormativo;
  item_nome: string;
  situacao: SituacaoFormativa;
  origem?: string | null;
}

interface ItemAnoBiblicoRelatorio {
  dbv_id: number;
  membro_nome: string;
  unidade_nome: string;
  foto_url?: string;
  totalLidos: number;
  ultimaLeitura: string | null;
}

interface DocumentoModeloRelatorio {
  campo: string;
  nome: string;
  ordem?: number | null;
}

interface DocumentoStatusRelatorio {
  dbv_id: number;
  campo: string;
  status: 'OK' | 'NA' | 'NOK' | null;
}

interface MembroFaltaRelatorio {
  nome: string;
  unidade: string;
  presencas: number;
  faltas: number;
  total: number;
  pctPresenca: number;
  topMeses: string[];
}

const CORES: Record<string, string> = {
  'Amor Perfeito': '#e91e63',
  'Sempre Viva': '#4caf50',
  'Águia Dourada': '#ff9800',
  'Leões': '#2196f3',
  'Diretoria': '#9c27b0',
  'Sem Unidade': '#90a4ae',
};

const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CLASSES_COLS: Array<{ campo: string; nome: string }> = [
  { campo: 'amigo', nome: 'Amigo' },
  { campo: 'amigo_nat', nome: 'Amigo da Natureza' },
  { campo: 'companheiro', nome: 'Companheiro' },
  { campo: 'comp_exc', nome: 'Companheiro de Excursionismo' },
  { campo: 'pesquisador', nome: 'Pesquisador' },
  { campo: 'pesquisador_cb', nome: 'Pesquisador de Campo e Bosque' },
  { campo: 'pioneiro', nome: 'Pioneiro' },
  { campo: 'pioneiro_nf', nome: 'Pioneiro de Novas Fronteiras' },
  { campo: 'excursionista', nome: 'Excursionista' },
  { campo: 'exc_mata', nome: 'Excursionista na Mata' },
  { campo: 'guia', nome: 'Guia' },
  { campo: 'guia_exp', nome: 'Guia de Exploração' },
  { campo: 'agrupada', nome: 'Agrupada' },
  { campo: 'lider', nome: 'Líder' },
  { campo: 'lider_master', nome: 'Líder Master' },
  { campo: 'lider_ma', nome: 'Líder Master Avançado' },
];

const DOCS_LABELS: Record<string, string> = {
  rg: 'RG', cpf: 'CPF', rg_resp: 'RG Responsável', cartao_sus: 'Cartão SUS',
  cartao_plano: 'Cartão de Plano', ficha_saude: 'Ficha de Saúde',
  carteira_vacinacao: 'Carteira de Vacinação', laudo_medico: 'Laudo Médico',
  ficha_reg: 'Ficha de Reg. Atualizada', comp_residencia: 'Comp. Residência',
  aut_saida: 'Aut. Saída', aut_viagem: 'Aut. Viagem Autenticada',
  ri_assinado: 'RI Assinado', foto: 'Foto', ant_criminais: 'Ant. Criminais',
};

function normalizarGrupo(membro: Desbravador) {
  return membro.unidade_nome || 'Sem Unidade';
}

function formatarDataDigitada(t: string): string {
  const d = t.replace(/\D/g, '').slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function escapeHTML(v: unknown) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function montarHTMLRelatorio(titulo: string, membros: Desbravador[]) {
  const linhas = membros
    .sort((a, b) =>
      normalizarGrupo(a).localeCompare(normalizarGrupo(b), 'pt-BR') ||
      a.nome.localeCompare(b.nome, 'pt-BR')
    )
    .map((m) => `
      <tr>
        <td>${escapeHTML(m.idx ?? m.id)}</td>
        <td>${escapeHTML(m.nome)}</td>
        <td>${escapeHTML(normalizarGrupo(m))}</td>
        <td>${escapeHTML(m.cargo)}</td>
        <td>${escapeHTML(m.genero)}</td>
        <td>${escapeHTML(m.data_nascimento)}</td>
        <td>${escapeHTML(m.idade)}</td>
        <td>${escapeHTML(m.id_sgc)}</td>
        <td>${escapeHTML(m.email)}</td>
        <td>${escapeHTML(m.contato)}</td>
        <td>${escapeHTML(m.camisa)}</td>
        <td>${escapeHTML(m.calca)}</td>
        <td>${escapeHTML(m.nome_responsavel)}</td>
        <td>${escapeHTML(m.contato_responsavel)}</td>
      </tr>
    `).join('');

  return `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { margin: 18px; size: A4 landscape; }
        body { font-family: Arial, sans-serif; color: #1f2933; }
        h1 { margin: 0; color: #1a3a5c; font-size: 22px; }
        .sub { margin: 6px 0 16px; color: #667; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th { background: #1a3a5c; color: white; text-align: left; padding: 6px 5px; }
        td { border: 1px solid #d8dee6; padding: 5px; vertical-align: top; }
        tr:nth-child(even) td { background: #f5f8fb; }
      </style>
    </head>
    <body>
      <h1>${escapeHTML(titulo)}</h1>
      <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · ${membros.length} membro(s)</div>
      <table>
        <thead>
          <tr>
            <th>IDX</th><th>Nome</th><th>Unidade</th><th>Cargo</th><th>Gênero</th>
            <th>Nascimento</th><th>Idade</th><th>SGC</th><th>E-mail</th><th>Contato</th>
            <th>Camisa</th><th>Calça</th><th>Responsável</th><th>Contato Resp.</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </body>
    </html>
  `;
}

// Deriva da mesma lista central usada pra somar o ranking (categoriasPontuacao.ts)
// — uma categoria nova aparece aqui sozinha, sem precisar listar de novo.
const CATEGORIAS_PONTUACAO_LABELS: Array<{ campo: keyof CategoriasPontuacao; nome: string }> = [
  ...CATEGORIAS_CONFIGURAVEIS.map((c) => ({ campo: c.campo as keyof CategoriasPontuacao, nome: c.label })),
  ...CATEGORIAS_DIRETAS.map((c) => ({ campo: c.campo as keyof CategoriasPontuacao, nome: c.label })),
  { campo: 'extras', nome: 'Extras' },
  { campo: 'custom', nome: 'Personalizados' },
];

function montarHTMLPontuacao(titulo: string, periodoLabel: string, linhas: LinhaRelatorioPontuacao[], detalhe: DetalhePontuacao) {
  const colunasExtra = detalhe === 'total_extrato'
    ? CATEGORIAS_PONTUACAO_LABELS.map((c) => `<th>${escapeHTML(c.nome)}</th>`).join('')
    : '';
  const linhasHTML = linhas.map((l) => `
    <tr>
      <td>${escapeHTML(l.nome)}</td>
      <td>${escapeHTML(l.unidade_nome)}</td>
      <td><strong>${escapeHTML(l.total)}</strong></td>
      ${detalhe === 'total_extrato'
        ? CATEGORIAS_PONTUACAO_LABELS.map((c) => `<td>${escapeHTML(l.categorias?.[c.campo] ?? 0)}</td>`).join('')
        : ''}
    </tr>
  `).join('');

  return `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { margin: 18px; size: A4 ${detalhe === 'total_extrato' ? 'landscape' : 'portrait'}; }
        body { font-family: Arial, sans-serif; color: #1f2933; }
        h1 { margin: 0; color: #1a3a5c; font-size: 22px; }
        .sub { margin: 6px 0 16px; color: #667; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #1a3a5c; color: white; text-align: left; padding: 6px 5px; }
        td { border: 1px solid #d8dee6; padding: 5px; vertical-align: top; }
        tr:nth-child(even) td { background: #f5f8fb; }
      </style>
    </head>
    <body>
      <h1>${escapeHTML(titulo)}</h1>
      <div class="sub">${escapeHTML(periodoLabel)} · Gerado em ${new Date().toLocaleString('pt-BR')} · ${linhas.length} membro(s)</div>
      <table>
        <thead>
          <tr><th>Nome</th><th>Unidade</th><th>Total</th>${colunasExtra}</tr>
        </thead>
        <tbody>${linhasHTML}</tbody>
      </table>
    </body>
    </html>
  `;
}

function montarHTMLDocumentacao(
  titulo: string,
  membros: Desbravador[],
  docs: Documento[],
  modelos: DocumentoModeloRelatorio[],
  statusRegistros: DocumentoStatusRelatorio[],
) {
  const porDbv = new Map(docs.map((d) => [d.dbv_id, d]));
  const docsModelo = modelos.length > 0
    ? modelos
    : Object.entries(DOCS_LABELS).map(([campo, nome], ordem) => ({ campo, nome, ordem }));
  const statusMap = new Map(statusRegistros.map((s) => [`${s.dbv_id}:${s.campo}`, s.status]));
  const estado = (membroId: number, doc: Documento | undefined, campo: string) => {
    const override = statusMap.get(`${membroId}:${campo}`);
    if (override === 'OK' || override === 'NA') return override;
    const legado = doc ? (doc as any)[campo] : null;
    return legado === 'OK' || legado === 'NA' ? legado : null;
  };
  const celulaStatus = (status: 'OK' | 'NA' | null) => {
    if (status === 'OK') return '<span class="status ok" title="Entregue">&#10003;</span>';
    if (status === 'NA') return '<span class="status na" title="Não se aplica">N/A</span>';
    return '<span class="status pendente" title="Pendente">!</span>';
  };
  const linhas = membros
    .sort((a, b) =>
      normalizarGrupo(a).localeCompare(normalizarGrupo(b), 'pt-BR') ||
      a.nome.localeCompare(b.nome, 'pt-BR')
    )
    .map((m) => {
      const doc = porDbv.get(m.id);
      const statusItens = docsModelo.map((tipo) => estado(m.id, doc, tipo.campo));
      const resolvidos = statusItens.filter((s) => s === 'OK' || s === 'NA').length;
      return `
        <tr>
          <td>${escapeHTML(m.nome)}</td>
          <td>${escapeHTML(normalizarGrupo(m))}</td>
          <td class="resumo">${resolvidos}/${docsModelo.length}</td>
          ${statusItens.map(celulaStatus).map((value) => `<td class="centro">${value}</td>`).join('')}
        </tr>
      `;
    }).join('');

  return `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { margin: 18px; size: A4 landscape; }
        body { font-family: Arial, sans-serif; color: #1f2933; }
        h1 { margin: 0; color: #1a3a5c; font-size: 22px; }
        .sub { margin: 6px 0 16px; color: #667; font-size: 12px; }
        .legenda { margin: 0 0 12px; display: flex; gap: 18px; align-items: center; font-size: 11px; color: #4a5560; }
        table { width: 100%; border-collapse: collapse; font-size: 8px; }
        th { background: #1a3a5c; color: white; text-align: center; padding: 6px 3px; vertical-align: bottom; }
        th.nome { min-width: 116px; text-align: left; }
        th.unidade { min-width: 70px; text-align: left; }
        th.doc { width: 46px; line-height: 1.15; word-break: break-word; }
        td { border: 1px solid #d8dee6; padding: 5px 3px; vertical-align: middle; }
        td.centro { text-align: center; }
        td.resumo { text-align: center; font-weight: bold; color: #1a3a5c; }
        tr:nth-child(even) td { background: #f5f8fb; }
        .status { display: inline-flex; width: 19px; height: 19px; align-items: center; justify-content: center; border-radius: 50%; font-size: 11px; font-weight: bold; }
        .ok { background: #e8f5e9; color: #2e7d32; }
        .na { width: auto; border-radius: 10px; padding: 0 5px; background: #e8f0fe; color: #1a3a5c; font-size: 8px; }
        .pendente { background: #fff3e0; color: #ef6c00; }
      </style>
    </head>
    <body>
      <h1>${escapeHTML(titulo)}</h1>
      <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · ${membros.length} membro(s)</div>
      <div class="legenda">
        <span><span class="status ok">&#10003;</span> Entregue</span>
        <span><span class="status na">N/A</span> Não se aplica</span>
        <span><span class="status pendente">!</span> Pendente</span>
      </div>
      <table>
        <thead>
          <tr>
            <th class="nome">Membro</th>
            <th class="unidade">Unidade</th>
            <th>Resolvidos</th>
            ${docsModelo.map((tipo) => `<th class="doc">${escapeHTML(tipo.nome)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </body>
    </html>
  `;
}

type AbaRelatorio = 'documentos' | 'formacao' | 'diretorio' | 'ano_biblico' | 'conquistas' | 'pontuacao';

const ABAS_RELATORIO: { id: AbaRelatorio; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'documentos', label: 'Documentos', icon: 'document-text' },
  { id: 'formacao',   label: 'Formação',   icon: 'ribbon' },
  { id: 'diretorio',  label: 'Unidades',  icon: 'people' },
  { id: 'ano_biblico', label: 'Ano Bíblico', icon: 'book' },
  { id: 'conquistas', label: 'Conquistas', icon: 'trophy' },
  { id: 'pontuacao',  label: 'Pontuação',  icon: 'stats-chart' },
];

type FiltroPublicoPontuacao = 'todos' | 'diretoria' | 'conselheiros' | 'dbv' | 'unidades' | 'membros';
type PeriodoPontuacao = 'hoje' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'ano' | 'livre';
type DetalhePontuacao = 'total' | 'total_extrato';

interface CategoriasPontuacao {
  presenca: number; pontualidade: number; material: number; uniforme: number;
  bom_biblia: number; classe_biblica: number; especialidade: number;
  pgm_especial: number; atividade_unidade: number; extras: number; custom: number;
}

interface LinhaRelatorioPontuacao {
  dbv_id: number;
  nome: string;
  unidade_nome: string;
  foto_url?: string | null;
  total: number;
  categorias?: CategoriasPontuacao;
}

export default function RelatoriosScreen() {
  const cores = useCores();
  const corCabecalho = useCorCabecalho();
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const { desbravadores, carregar } = useDBVStore();
  const [abaRelatorio, setAbaRelatorio] = useState<AbaRelatorio>('documentos');
  const [abaDropdownAberto, setAbaDropdownAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [unidadesSelecionadasPDF, setUnidadesSelecionadasPDF] = useState<string[]>([]);
  const [itensFormativos, setItensFormativos] = useState<ItemFormativoRelatorio[]>([]);
  const [leiturasAnoBiblico, setLeiturasAnoBiblico] = useState<ItemAnoBiblicoRelatorio[]>([]);
  const [carregandoAnoBiblico, setCarregandoAnoBiblico] = useState(false);
  const [mostrarFiltrosAnoBiblico, setMostrarFiltrosAnoBiblico] = useState(false);
  const [periodoAnoBiblico, setPeriodoAnoBiblico] = useState<'ano' | 'mes' | 'trimestre' | 'semestre' | 'livre'>('ano');
  const [mesAnoBiblico, setMesAnoBiblico] = useState(new Date().getMonth() + 1);
  const [trimestreAnoBiblico, setTrimestreAnoBiblico] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [semestreAnoBiblico, setSemestreAnoBiblico] = useState(new Date().getMonth() < 6 ? 1 : 2);
  const [anoBiblicoDe, setAnoBiblicoDe] = useState('');
  const [anoBiblicoAte, setAnoBiblicoAte] = useState('');
  const [filtroTipoMembroAnoBiblico, setFiltroTipoMembroAnoBiblico] = useState<'todos' | 'diretoria' | 'desbravadores'>('todos');
  const [filtroUnidadesAnoBiblico, setFiltroUnidadesAnoBiblico] = useState<string[]>([]);
  const [membrosAnoBiblico, setMembrosAnoBiblico] = useState<number[]>([]);
  const [buscaMembroAnoBiblico, setBuscaMembroAnoBiblico] = useState('');
  const [mostrarFiltrosConquistas, setMostrarFiltrosConquistas] = useState(false);
  const [filtroTipoMembroConquistas, setFiltroTipoMembroConquistas] = useState<'todos' | 'diretoria' | 'desbravadores'>('todos');
  const [filtroUnidadesConquistas, setFiltroUnidadesConquistas] = useState<string[]>([]);
  const [membrosConquistas, setMembrosConquistas] = useState<number[]>([]);
  const [buscaMembroConquistas, setBuscaMembroConquistas] = useState('');
  const [filtroFormativo, setFiltroFormativo] = useState<'todos' | SituacaoFormativa>('pronto');
  const [carregandoFormativos, setCarregandoFormativos] = useState(false);
  const [tipoManual, setTipoManual] = useState<TipoFormativo>('especialidade');
  const [buscaItemManual, setBuscaItemManual] = useState('');
  const [buscaMembroManual, setBuscaMembroManual] = useState('');
  const [itemManual, setItemManual] = useState('');
  const [membrosManual, setMembrosManual] = useState<number[]>([]);
  const [classesModelo, setClassesModelo] = useState<ClasseModelo[]>([]);
  const [especialidadesModelo, setEspecialidadesModelo] = useState<EspecialidadeModelo[]>([]);
  const [salvandoManual, setSalvandoManual] = useState(false);
  const [mostrarPickerFaltas, setMostrarPickerFaltas] = useState(false);
  const [periodoFaltas, setPeriodoFaltas] = useState<'2m' | '6m' | '12m' | 'livre'>('6m');
  const [faltasDe, setFaltasDe] = useState('');
  const [faltasAte, setFaltasAte] = useState('');
  const [gerandoFaltas, setGerandoFaltas] = useState(false);
  const [filtroTipoMembro, setFiltroTipoMembro] = useState<'todos' | 'diretoria' | 'desbravadores'>('todos');
  const [filtroUnidades, setFiltroUnidades] = useState<string[]>([]);
  const [formatoExport, setFormatoExport] = useState<'pdf' | 'excel'>('pdf');
  // Relatório de Requisitos de Classes
  const [mostrarPickerClasses, setMostrarPickerClasses] = useState(false);
  const [escopoClasses, setEscopoClasses] = useState<'clube' | 'unidades' | 'membros'>('clube');
  const [unidadesClasses, setUnidadesClasses] = useState<string[]>([]);
  const [membrosClasses, setMembrosClasses] = useState<number[]>([]);
  const [classesSelecionadas, setClassesSelecionadas] = useState<string[]>([]);
  const [classesDisponiveis, setClassesDisponiveis] = useState<string[]>([]);
  const [detalharClasses, setDetalharClasses] = useState(false);
  const [formatoClasses, setFormatoClasses] = useState<'pdf' | 'excel'>('pdf');
  const [buscaMembroClasses, setBuscaMembroClasses] = useState('');
  const [gerandoClasses, setGerandoClasses] = useState(false);
  // Modo de exibição (nome/nome+foto/foto) — vale pra qualquer aba com lista de membros.
  const [modoExibicao, setModoExibicao] = useState<ModoExibicaoMembro>(MODO_EXIBICAO_PADRAO);
  // Relatório de Pontuação
  const configPontuacao = usePontuacaoStore((s) => s.config);
  const carregarConfigPontuacao = usePontuacaoStore((s) => s.carregarConfig);
  const [mostrarFiltrosPontuacao, setMostrarFiltrosPontuacao] = useState(false);
  const [pontuacaoFiltroTipo, setPontuacaoFiltroTipo] = useState<FiltroPublicoPontuacao>('todos');
  const [pontuacaoUnidades, setPontuacaoUnidades] = useState<string[]>([]);
  const [pontuacaoMembros, setPontuacaoMembros] = useState<number[]>([]);
  const [buscaMembroPontuacao, setBuscaMembroPontuacao] = useState('');
  const [pontuacaoPeriodo, setPontuacaoPeriodo] = useState<PeriodoPontuacao>('mes');
  const [pontuacaoDataDe, setPontuacaoDataDe] = useState('');
  const [pontuacaoDataAte, setPontuacaoDataAte] = useState('');
  const [pontuacaoDetalhe, setPontuacaoDetalhe] = useState<DetalhePontuacao>('total');
  const [formatoPontuacao, setFormatoPontuacao] = useState<'pdf' | 'excel'>('pdf');
  const [linhasPontuacao, setLinhasPontuacao] = useState<LinhaRelatorioPontuacao[]>([]);
  const [gerandoPontuacao, setGerandoPontuacao] = useState(false);
  const isAdmin = permissoes.pode('ver_relatorios');

  useFocusEffect(
    useCallback(() => {
      carregar();
      carregarVisaoFormativa();
      carregarLeiturasAnoBiblico();
      carregarModelosFormativos();
      carregarConfigPontuacao();
      carregarCatalogoClasses()
        .then((cat) => setClassesDisponiveis(classesDoCatalogo(cat)))
        .catch(() => setClassesDisponiveis([]));
    }, [])
  );

  useEffect(() => {
    carregarModoExibicaoRelatorios(usuario?.id).then(setModoExibicao);
  }, [usuario?.id]);

  function alterarModoExibicao(modo: ModoExibicaoMembro) {
    setModoExibicao(modo);
    if (usuario?.id) salvarModoExibicaoRelatorios(usuario.id, modo).catch(() => {});
  }

  async function gerarRelatorioClasses() {
    if (gerandoClasses) return;
    setGerandoClasses(true);
    try {
      const linhas = await gerarDadosRelatorioClasses(desbravadores, {
        clubeId: getClubeAtivoId(),
        escopo: escopoClasses,
        unidades: unidadesClasses,
        membroIds: membrosClasses,
        classes: classesSelecionadas,
        detalhado: detalharClasses,
      });
      if (linhas.length === 0) {
        avisar('Nenhum membro/classe encontrado para os filtros escolhidos.', 'info', 'Relatório');
        return;
      }
      const alvo =
        escopoClasses === 'clube'
          ? 'Clube completo'
          : escopoClasses === 'unidades'
            ? `Unidades: ${unidadesClasses.join(', ')}`
            : `${membrosClasses.length} membro(s)`;
      const titulo = `Relatório de Requisitos de Classes — ${alvo}`;

      if (formatoClasses === 'excel') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(montarPlanilhaClasses(linhas, detalharClasses));
        ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 11 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 26 }, { wch: 60 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Requisitos');
        XLSX.writeFile(wb, `${titulo}.xlsx`);
      } else {
        await abrirPDF(titulo, montarHTMLClasses(titulo, linhas, detalharClasses));
      }
      setMostrarPickerClasses(false);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível gerar o relatório.', 'erro', 'Erro');
    } finally {
      setGerandoClasses(false);
    }
  }

  async function carregarModelosFormativos() {
    try {
      const [classes, especialidades] = await Promise.all([
        carregarClassesModelo(),
        carregarEspecialidadesModelo({ limite: 900 }),
      ]);
      setClassesModelo(classes.length ? classes : classesFallback());
      setEspecialidadesModelo(especialidades);
    } catch {
      setClassesModelo(classesFallback());
      setEspecialidadesModelo([]);
    }
  }

  const unidadesDisponiveis = useMemo(() =>
    Array.from(new Set(desbravadores.map((d) => d.unidade_nome || 'Sem Unidade'))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  [desbravadores]);

  const grupos = useMemo(() => {
    const termo = busca.trim();
    const filtrados = desbravadores
      .filter((m) => {
        if (!termo) return true;
        return (
          combinaBusca(m.nome, termo) ||
          combinaBusca(m.unidade_nome, termo) ||
          combinaBusca(m.cargo, termo) ||
          combinaBusca(String(m.id_sgc ?? ''), termo)
        );
      })
      .sort((a, b) =>
        normalizarGrupo(a).localeCompare(normalizarGrupo(b), 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR')
      );

    const mapa = new Map<string, Desbravador[]>();
    for (const membro of filtrados) {
      const grupo = normalizarGrupo(membro);
      if (!mapa.has(grupo)) mapa.set(grupo, []);
      mapa.get(grupo)!.push(membro);
    }
    return Array.from(mapa.entries()).map(([nome, membros]) => ({ nome, membros }));
  }, [desbravadores, busca]);

  /** Quadro de conquistas: agrupa itensFormativos (já carregado pra aba
   * Formação) por membro, aplicando os mesmos filtros de tipo/unidade/membro
   * específico usados no resto da tela — sem precisar de outra consulta. */
  const conquistasPorMembro = useMemo(() => {
    const termo = buscaMembroConquistas.trim();
    const membrosFiltrados = desbravadores.filter((m) => {
      if (filtroTipoMembroConquistas === 'diretoria' && normalizarGrupo(m) !== 'Diretoria') return false;
      if (filtroTipoMembroConquistas === 'desbravadores' && normalizarGrupo(m) === 'Diretoria') return false;
      if (filtroUnidadesConquistas.length > 0 && !filtroUnidadesConquistas.includes(normalizarGrupo(m))) return false;
      if (membrosConquistas.length > 0 && !membrosConquistas.includes(m.id)) return false;
      if (termo && !combinaBusca(m.nome, termo)) return false;
      return true;
    });
    const idsPermitidos = new Set(membrosFiltrados.map((m) => m.id));
    const porId = new Map<number, ItemFormativoRelatorio[]>();
    for (const item of itensFormativos) {
      if (!idsPermitidos.has(item.dbv_id)) continue;
      if (!porId.has(item.dbv_id)) porId.set(item.dbv_id, []);
      porId.get(item.dbv_id)!.push(item);
    }
    return membrosFiltrados
      .filter((m) => membrosConquistas.length > 0 || (porId.get(m.id)?.length ?? 0) > 0)
      .sort((a, b) => normalizarGrupo(a).localeCompare(normalizarGrupo(b), 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((m) => {
        const itens = porId.get(m.id) ?? [];
        return {
          membro: m,
          concluidas: itens.filter((i) => i.situacao === 'entregue'),
          emAndamento: itens.filter((i) => i.situacao !== 'entregue'),
        };
      });
  }, [desbravadores, itensFormativos, filtroTipoMembroConquistas, filtroUnidadesConquistas, membrosConquistas, buscaMembroConquistas]);

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: cores.fundo }]}>
        <View style={styles.semAcesso}>
          <Ionicons name="lock-closed" size={46} color="#bbb" />
          <Text style={[styles.semAcessoText, { color: cores.textoSecundario }]}>Relatórios disponíveis apenas para a diretoria.</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  async function carregarVisaoFormativa() {
    if (Platform.OS !== 'web') return;
    setCarregandoFormativos(true);
    try {
      const clubeId = getClubeAtivoId();
      const [
        { data: membrosData },
        { data: invData },
        { data: espData },
        { data: classesData },
        { data: atividadesData },
        { data: respostasData },
      ] = await Promise.all([
        buscarPaginado((q) => q.eq('clube_id', clubeId), 'desbravadores', 'id,nome,unidade_nome').then((data) => ({ data })),
        supabase.from('investidura_itens').select('id,dbv_id,tipo,item_nome,marcado,entregue').eq('clube_id', clubeId),
        buscarPaginado((q) => q.eq('clube_id', clubeId).eq('status', 'OK'), 'especialidades', 'id,dbv_id,nome,status').then((data) => ({ data })),
        buscarPaginado((q) => q.eq('clube_id', clubeId), 'progresso_classes', '*').then((data) => ({ data })),
        supabase.from('atividades').select('id,titulo,item_formativo_tipo,item_formativo_nome,gera_investidura').eq('clube_id', clubeId).eq('gera_investidura', true),
        buscarPaginado((q) => q.eq('clube_id', clubeId), 'atividades_respostas', 'id,atividade_id,dbv_id,status').then((data) => ({ data })),
      ]);

      const membroMap = new Map<number, { nome: string; unidade_nome: string }>();
      for (const m of (membrosData ?? []) as any[]) {
        membroMap.set(Number(m.id), {
          nome: m.nome ?? `Membro ${m.id}`,
          unidade_nome: m.unidade_nome || 'Sem Unidade',
        });
      }

      const lista: ItemFormativoRelatorio[] = [];
      const add = (item: Omit<ItemFormativoRelatorio, 'membro_nome' | 'unidade_nome'>) => {
        const membro = membroMap.get(item.dbv_id);
        lista.push({
          ...item,
          membro_nome: membro?.nome ?? `Membro ${item.dbv_id}`,
          unidade_nome: membro?.unidade_nome ?? 'Sem Unidade',
        });
      };

      for (const e of (espData ?? []) as any[]) {
        add({
          id: `esp-ok-${e.id}`,
          dbv_id: Number(e.dbv_id),
          tipo: 'especialidade',
          item_nome: e.nome,
          situacao: 'entregue',
        });
      }

      for (const c of (classesData ?? []) as any[]) {
        for (const col of CLASSES_COLS) {
          if (String(c[col.campo] ?? '').toUpperCase() === 'OK') {
            add({
              id: `classe-ok-${c.dbv_id}-${col.campo}`,
              dbv_id: Number(c.dbv_id),
              tipo: 'classe',
              item_nome: col.nome,
              situacao: 'entregue',
            });
          }
        }
      }

      for (const inv of (invData ?? []) as any[]) {
        if (inv.entregue) continue;
        if (!inv.marcado) continue;
        add({
          id: `inv-${inv.id}`,
          dbv_id: Number(inv.dbv_id),
          tipo: inv.tipo === 'classe' ? 'classe' : 'especialidade',
          item_nome: inv.item_nome,
          situacao: 'pronto',
        });
      }

      const atividadeMap = new Map<number, any>();
      for (const a of (atividadesData ?? []) as any[]) {
        if (a.item_formativo_tipo && a.item_formativo_nome) atividadeMap.set(Number(a.id), a);
      }
      for (const r of (respostasData ?? []) as any[]) {
        if (r.status !== 'entregue') continue;
        const atv = atividadeMap.get(Number(r.atividade_id));
        if (!atv) continue;
        add({
          id: `pend-${r.id}`,
          dbv_id: Number(r.dbv_id),
          tipo: atv.item_formativo_tipo === 'classe' ? 'classe' : 'especialidade',
          item_nome: atv.item_formativo_nome,
          situacao: 'pendente_aprovacao',
          origem: atv.titulo,
        });
      }

      lista.sort((a, b) =>
        a.situacao.localeCompare(b.situacao) ||
        a.tipo.localeCompare(b.tipo) ||
        a.item_nome.localeCompare(b.item_nome, 'pt-BR') ||
        a.membro_nome.localeCompare(b.membro_nome, 'pt-BR')
      );
      setItensFormativos(lista);
    } catch (e) {
      console.warn('Falha ao carregar visão formativa', e);
      avisar('Não foi possível carregar a visão de especialidades e classes.', 'erro', 'Relatórios');
    } finally {
      setCarregandoFormativos(false);
    }
  }

  /** Início/fim (ISO) do período escolhido no filtro do relatório do Ano Bíblico. */
  function calcularPeriodoAnoBiblico(): { de: string; ate: string; label: string } | null {
    const anoAtual = new Date().getFullYear();
    const fimDoDia = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

    if (periodoAnoBiblico === 'ano') {
      return {
        de: new Date(anoAtual, 0, 1).toISOString(),
        ate: fimDoDia(new Date(anoAtual, 11, 31)).toISOString(),
        label: `Ano ${anoAtual}`,
      };
    }
    if (periodoAnoBiblico === 'mes') {
      return {
        de: new Date(anoAtual, mesAnoBiblico - 1, 1).toISOString(),
        ate: fimDoDia(new Date(anoAtual, mesAnoBiblico, 0)).toISOString(),
        label: `${MESES_NOME[mesAnoBiblico - 1]}/${anoAtual}`,
      };
    }
    if (periodoAnoBiblico === 'trimestre') {
      const mesIni = (trimestreAnoBiblico - 1) * 3;
      return {
        de: new Date(anoAtual, mesIni, 1).toISOString(),
        ate: fimDoDia(new Date(anoAtual, mesIni + 3, 0)).toISOString(),
        label: `${trimestreAnoBiblico}º trimestre/${anoAtual}`,
      };
    }
    if (periodoAnoBiblico === 'semestre') {
      const mesIni = semestreAnoBiblico === 1 ? 0 : 6;
      return {
        de: new Date(anoAtual, mesIni, 1).toISOString(),
        ate: fimDoDia(new Date(anoAtual, mesIni + 6, 0)).toISOString(),
        label: `${semestreAnoBiblico}º semestre/${anoAtual}`,
      };
    }
    // livre
    const parseDataBR = (s: string) => {
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return null;
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const deDate = parseDataBR(anoBiblicoDe);
    const ateDate = parseDataBR(anoBiblicoAte);
    if (!deDate || !ateDate) return null;
    return { de: deDate.toISOString(), ate: fimDoDia(ateDate).toISOString(), label: `${anoBiblicoDe} a ${anoBiblicoAte}` };
  }

  /** Devolve datas no formato yyyy-mm-dd (coluna `pontuacoes.data` é DATE, não timestamp). */
  function calcularPeriodoPontuacao(): { de: string; ate: string; label: string } | null {
    const hoje = new Date();
    const aaaammdd = (d: Date) => d.toISOString().slice(0, 10);

    if (pontuacaoPeriodo === 'hoje') {
      const s = aaaammdd(hoje);
      return { de: s, ate: s, label: 'Hoje' };
    }
    if (pontuacaoPeriodo === 'semana') {
      const diaSemana = hoje.getDay();
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - diaSemana);
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
      return { de: aaaammdd(ini), ate: aaaammdd(fim), label: 'Semana atual' };
    }
    if (pontuacaoPeriodo === 'mes') {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      return { de: aaaammdd(ini), ate: aaaammdd(fim), label: `${MESES_NOME[hoje.getMonth()]}/${hoje.getFullYear()}` };
    }
    if (pontuacaoPeriodo === 'trimestre') {
      const trimestre = Math.floor(hoje.getMonth() / 3);
      const ini = new Date(hoje.getFullYear(), trimestre * 3, 1);
      const fim = new Date(hoje.getFullYear(), trimestre * 3 + 3, 0);
      return { de: aaaammdd(ini), ate: aaaammdd(fim), label: `${trimestre + 1}º trimestre/${hoje.getFullYear()}` };
    }
    if (pontuacaoPeriodo === 'semestre') {
      const semestre = hoje.getMonth() < 6 ? 1 : 2;
      const ini = new Date(hoje.getFullYear(), semestre === 1 ? 0 : 6, 1);
      const fim = new Date(hoje.getFullYear(), semestre === 1 ? 6 : 12, 0);
      return { de: aaaammdd(ini), ate: aaaammdd(fim), label: `${semestre}º semestre/${hoje.getFullYear()}` };
    }
    if (pontuacaoPeriodo === 'ano') {
      return { de: `${hoje.getFullYear()}-01-01`, ate: `${hoje.getFullYear()}-12-31`, label: `Ano ${hoje.getFullYear()}` };
    }
    // livre
    const parseDataBR = (s: string) => {
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return null;
      return `${m[3]}-${m[2]}-${m[1]}`;
    };
    const deStr = parseDataBR(pontuacaoDataDe);
    const ateStr = parseDataBR(pontuacaoDataAte);
    if (!deStr || !ateStr) return null;
    return { de: deStr, ate: ateStr, label: `${pontuacaoDataDe} a ${pontuacaoDataAte}` };
  }

  async function carregarLeiturasAnoBiblico() {
    if (Platform.OS !== 'web') return;
    const periodo = calcularPeriodoAnoBiblico();
    if (!periodo) {
      if (periodoAnoBiblico === 'livre') {
        avisar('Informe as datas de início e fim (dd/mm/aaaa).', 'info', 'Período inválido');
      }
      return;
    }
    setCarregandoAnoBiblico(true);
    try {
      const clubeId = getClubeAtivoId();
      const membrosData = await buscarPaginado((q) => q.eq('clube_id', clubeId), 'desbravadores', 'id,nome,unidade_nome,foto_url');

      const membroMap = new Map<number, { nome: string; unidade_nome: string; foto_url?: string }>();
      for (const m of membrosData as any[]) {
        membroMap.set(Number(m.id), { nome: m.nome ?? `Membro ${m.id}`, unidade_nome: m.unidade_nome || 'Sem Unidade', foto_url: m.foto_url ?? undefined });
      }

      // Aplica tipo de membro (todos/desbravadores/diretoria), unidade(s) e
      // membro(s) específico(s) sobre a lista de membros ANTES de buscar o
      // progresso — assim a consulta já sai filtrada por dbv_id quando algum
      // desses filtros restringe a lista.
      let idsPermitidos: number[] | null = null;
      if (membrosAnoBiblico.length > 0) {
        idsPermitidos = membrosAnoBiblico;
      } else if (filtroTipoMembroAnoBiblico !== 'todos' || filtroUnidadesAnoBiblico.length > 0) {
        idsPermitidos = Array.from(membroMap.entries())
          .filter(([, m]) => {
            if (filtroTipoMembroAnoBiblico === 'diretoria' && m.unidade_nome !== 'Diretoria') return false;
            if (filtroTipoMembroAnoBiblico === 'desbravadores' && m.unidade_nome === 'Diretoria') return false;
            if (filtroUnidadesAnoBiblico.length > 0 && !filtroUnidadesAnoBiblico.includes(m.unidade_nome)) return false;
            return true;
          })
          .map(([id]) => id);
      }

      // Paginado: um ano de leituras do clube inteiro passa de mil linhas.
      const linhasAnoBiblico = await buscarPaginado(
        (q) => {
          let consulta = q.eq('clube_id', clubeId).eq('lido', true)
            .gte('lido_em', periodo.de).lte('lido_em', periodo.ate);
          if (idsPermitidos) consulta = consulta.in('dbv_id', idsPermitidos);
          return consulta;
        },
        'ano_biblico_progresso',
        'dbv_id,lido_em',
      );
      // buscarPaginado propaga o erro (antes o erro daqui era ignorado: a
      // consulta falhava por RLS/coluna, "data" vinha null e o relatório
      // mostrava "ninguém leu nada" como se fosse resultado válido).
      const porMembro = new Map<number, { total: number; ultima: string | null }>();
      for (const p of linhasAnoBiblico as any[]) {
        const dbvId = Number(p.dbv_id);
        const atual = porMembro.get(dbvId) ?? { total: 0, ultima: null };
        atual.total += 1;
        if (!atual.ultima || (p.lido_em && p.lido_em > atual.ultima)) atual.ultima = p.lido_em ?? atual.ultima;
        porMembro.set(dbvId, atual);
      }

      const lista: ItemAnoBiblicoRelatorio[] = Array.from(porMembro.entries()).map(([dbvId, v]) => {
        const membro = membroMap.get(dbvId);
        return {
          dbv_id: dbvId,
          membro_nome: membro?.nome ?? `Membro ${dbvId}`,
          unidade_nome: membro?.unidade_nome ?? 'Sem Unidade',
          foto_url: membro?.foto_url,
          totalLidos: v.total,
          ultimaLeitura: v.ultima,
        };
      });
      lista.sort((a, b) => b.totalLidos - a.totalLidos || a.membro_nome.localeCompare(b.membro_nome, 'pt-BR'));
      setLeiturasAnoBiblico(lista);
    } catch (e: any) {
      console.warn('Falha ao carregar leituras do Ano Bíblico', e);
      setLeiturasAnoBiblico([]);
      avisar(e?.message ?? 'Não foi possível carregar as leituras do Ano Bíblico.', 'erro', 'Erro no relatório');
    } finally {
      setCarregandoAnoBiblico(false);
    }
  }

  async function registrarEntregaFormativa(item: ItemFormativoRelatorio) {
    if (item.situacao !== 'pronto') return;
    const ok = await confirmar('Confirmar entrega', `Confirmar entrega de "${item.item_nome}" para ${item.membro_nome}?`, 'Confirmar');
    if (!ok) return;

    try {
      const clubeId = getClubeAtivoId();
      if (item.tipo === 'especialidade') {
        const { error } = await supabase
          .from('especialidades')
          .upsert(
            { clube_id: clubeId, dbv_id: item.dbv_id, nome: item.item_nome, status: 'OK', updated_at: new Date().toISOString() },
            { onConflict: 'dbv_id,nome' },
          );
        if (error) throw error;
      } else {
        const classe = CLASSES_COLS.find((c) => c.nome === item.item_nome);
        if (!classe) throw new Error('Classe não encontrada no modelo atual.');
        const { data: existente } = await supabase
          .from('progresso_classes')
          .select('id')
          .eq('clube_id', clubeId)
          .eq('dbv_id', item.dbv_id)
          .maybeSingle();
        const payload = { clube_id: clubeId, dbv_id: item.dbv_id, [classe.campo]: 'OK', updated_at: new Date().toISOString() };
        const { error } = existente?.id
          ? await supabase.from('progresso_classes').update(payload).eq('id', existente.id)
          : await supabase.from('progresso_classes').insert(payload);
        if (error) throw error;
      }

      await supabase
        .from('investidura_itens')
        .upsert({
          clube_id: clubeId,
          dbv_id: item.dbv_id,
          tipo: item.tipo,
          item_nome: item.item_nome,
          marcado: false,
          entregue: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'clube_id,dbv_id,tipo,item_nome' });

      await carregarVisaoFormativa();
      await carregar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível registrar a entrega.', 'erro', 'Erro');
    }
  }

  const opcoesItensManual = useMemo(() => {
    const termo = buscaItemManual.trim();
    const nomes = tipoManual === 'classe'
      ? classesModelo.map((c) => c.nome)
      : especialidadesModelo.map((e) => e.nome);
    return Array.from(new Set(nomes))
      .filter((nome) => !termo || combinaBusca(nome, termo))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .slice(0, 30);
  }, [tipoManual, classesModelo, especialidadesModelo, buscaItemManual]);

  const membrosManualVisiveis = useMemo(() => {
    const termo = buscaMembroManual.trim();
    return desbravadores
      .filter((m) => !termo || combinaBusca(m.nome, termo) || combinaBusca(m.unidade_nome, termo))
      .sort((a, b) =>
        normalizarGrupo(a).localeCompare(normalizarGrupo(b), 'pt-BR') ||
        a.nome.localeCompare(b.nome, 'pt-BR')
      )
      .slice(0, termo ? 80 : 20);
  }, [desbravadores, buscaMembroManual]);

  function alternarMembroManual(id: number) {
    setMembrosManual((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function adicionarManualAReceber() {
    const item = itemManual.trim();
    if (!item) {
      avisar('Escolha uma especialidade ou classe.', 'info', 'Informe o item');
      return;
    }
    if (membrosManual.length === 0) {
      avisar('Escolha pelo menos um membro para vincular.', 'info', 'Selecione membros');
      return;
    }

    setSalvandoManual(true);
    try {
      const clubeId = getClubeAtivoId();
      const agora = new Date().toISOString();
      const linhas = membrosManual.map((dbvId) => ({
        clube_id: clubeId,
        dbv_id: dbvId,
        tipo: tipoManual,
        item_nome: item,
        marcado: true,
        entregue: false,
        updated_at: agora,
      }));
      const { error } = await supabase
        .from('investidura_itens')
        .upsert(linhas, { onConflict: 'clube_id,dbv_id,tipo,item_nome' });
      if (error) throw error;

      setItemManual('');
      setBuscaItemManual('');
      setBuscaMembroManual('');
      setMembrosManual([]);
      await carregarVisaoFormativa();
      avisar(`${linhas.length} vínculo(s) criado(s) como item a receber.`, 'sucesso', 'Pronto');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível vincular o item aos membros.', 'erro', 'Erro');
    } finally {
      setSalvandoManual(false);
    }
  }

  function montarHTMLFaltas(titulo: string, membros: MembroFaltaRelatorio[], total: number, de: string, ate: string) {
    const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const fmt = (d: string) => { const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; };
    const linhas = membros.map((m) => {
      const barPres = Math.round(m.pctPresenca);
      const cor = barPres >= 75 ? '#2e7d32' : barPres >= 50 ? '#f57f17' : '#c62828';
      return `
        <tr>
          <td>${escapeHTML(m.nome)}</td>
          <td>${escapeHTML(m.unidade)}</td>
          <td class="num">${m.presencas}</td>
          <td class="num">${m.faltas}</td>
          <td class="num">${total}</td>
          <td class="num"><span style="color:${cor};font-weight:900">${barPres}%</span></td>
          <td class="num" style="color:#c62828">${100 - barPres}%</td>
          <td>${escapeHTML(m.topMeses.join(' · ') || '—')}</td>
        </tr>`;
    }).join('');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
      <style>
        @page{margin:18px;size:A4 landscape}
        body{font-family:Arial,sans-serif;color:#1f2933;font-size:11px}
        h1{margin:0;color:#1a3a5c;font-size:20px}
        .sub{margin:4px 0 14px;color:#667;font-size:11px}
        table{width:100%;border-collapse:collapse}
        th{background:#1a3a5c;color:#fff;text-align:left;padding:6px 5px;font-size:10px}
        th.num,td.num{text-align:center}
        td{border:1px solid #d8dee6;padding:5px;vertical-align:middle}
        tr:nth-child(even) td{background:#f5f8fb}
      </style></head><body>
      <h1>${escapeHTML(titulo)}</h1>
      <div class="sub">Período: ${fmt(de)} a ${fmt(ate)} · ${total} reunião(ões) · ${membros.length} membro(s) · Gerado em ${new Date().toLocaleString('pt-BR')}</div>
      <table><thead><tr>
        <th>Membro</th><th>Unidade</th>
        <th class="num">Presenças</th><th class="num">Faltas</th><th class="num">Total</th>
        <th class="num">% Presença</th><th class="num">% Falta</th>
        <th>Meses com mais faltas</th>
      </tr></thead><tbody>${linhas}</tbody></table>
      </body></html>`;
  }

  async function gerarRelatorioFaltas() {
    setGerandoFaltas(true);
    try {
      const clubeId = getClubeAtivoId();
      const ateDate = new Date();
      const deDate = new Date();
      if (periodoFaltas === '2m') deDate.setMonth(deDate.getMonth() - 2);
      else if (periodoFaltas === '6m') deDate.setMonth(deDate.getMonth() - 6);
      else if (periodoFaltas === '12m') deDate.setFullYear(deDate.getFullYear() - 1);
      else {
        if (!faltasDe || !faltasAte) { avisar('Informe início e fim.', 'info', 'Período inválido'); return; }
        const parseData = (s: string) => { const [d, m, a] = s.split('/'); return `${a}-${m}-${d}`; };
        const deIso = parseData(faltasDe); const ateIso = parseData(faltasAte);
        if (isNaN(new Date(deIso).getTime()) || isNaN(new Date(ateIso).getTime())) { avisar('Use o formato dd/mm/aaaa.', 'info', 'Data inválida'); return; }
        deDate.setTime(new Date(deIso + 'T00:00:00').getTime());
        ateDate.setTime(new Date(ateIso + 'T23:59:59').getTime());
      }
      const deStr = deDate.toISOString().slice(0, 10);
      const ateStr = ateDate.toISOString().slice(0, 10);

      // Paginado: um período longo passa de mil lançamentos e o PostgREST corta em silêncio.
      const rows = await buscarPaginado(
        (q) => q.eq('clube_id', clubeId).gte('data', deStr).lte('data', ateStr),
        'pontuacoes',
        'data,dbv_id,presenca',
        'data',
      );

      if (!rows?.length) { avisar('Sem registros no período.', 'info', 'Sem dados'); return; }

      const diasReuniao = new Set<string>();
      for (const p of rows as any[]) if (p.presenca) diasReuniao.add(p.data);
      const totalReunioes = diasReuniao.size;
      if (!totalReunioes) { avisar('Nenhuma reunião com presença no período.', 'info', 'Sem reuniões'); return; }

      const presencaMap = new Map<number, Map<string, boolean>>();
      for (const p of rows as any[]) {
        const id = Number(p.dbv_id);
        if (!presencaMap.has(id)) presencaMap.set(id, new Map());
        presencaMap.get(id)!.set(p.data, !!p.presenca);
      }

      const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      let membrosParaRelatorio = desbravadores;
      if (filtroTipoMembro === 'diretoria') membrosParaRelatorio = membrosParaRelatorio.filter((d) => (d.unidade_nome || 'Sem Unidade') === 'Diretoria');
      else if (filtroTipoMembro === 'desbravadores') membrosParaRelatorio = membrosParaRelatorio.filter((d) => (d.unidade_nome || 'Sem Unidade') !== 'Diretoria');
      if (filtroUnidades.length > 0) membrosParaRelatorio = membrosParaRelatorio.filter((d) => filtroUnidades.includes(d.unidade_nome || 'Sem Unidade'));

      const resultado: MembroFaltaRelatorio[] = membrosParaRelatorio.map((dbv) => {
        const reg = presencaMap.get(dbv.id) ?? new Map<string, boolean>();
        let presencas = 0;
        const faltasMes = new Map<string, number>();
        for (const dia of diasReuniao) {
          if (reg.get(dia)) { presencas++; }
          else {
            const [ano, m] = dia.split('-');
            const k = `${NOMES_MES[Number(m)-1]}/${ano.slice(2)}`;
            faltasMes.set(k, (faltasMes.get(k) ?? 0) + 1);
          }
        }
        const faltas = totalReunioes - presencas;
        const topMeses = Array.from(faltasMes.entries()).sort((a,b) => b[1]-a[1]).slice(0,3).map(([mes,n]) => `${mes} (${n})`);
        return { nome: dbv.nome, unidade: dbv.unidade_nome || 'Sem Unidade', presencas, faltas, total: totalReunioes, pctPresenca: Math.round((presencas/totalReunioes)*100), topMeses };
      });
      resultado.sort((a,b) => a.pctPresenca - b.pctPresenca || a.nome.localeCompare(b.nome,'pt-BR'));

      const periodoLabel = periodoFaltas === '2m' ? 'Últimos 2 meses' : periodoFaltas === '6m' ? 'Últimos 6 meses' : periodoFaltas === '12m' ? 'Últimos 12 meses' : `${faltasDe} a ${faltasAte}`;
      const titulo = `Relatório de Faltas — ${periodoLabel}`;

      if (formatoExport === 'excel') {
        const NOMES_MES2 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const wsData = [
          ['Membro','Unidade','Presenças','Faltas','Total Reuniões','% Presença','% Falta','Meses com mais faltas'],
          ...resultado.map((m) => [m.nome, m.unidade, m.presencas, m.faltas, m.total, `${m.pctPresenca}%`, `${100 - m.pctPresenca}%`, m.topMeses.join(' · ')]),
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 36 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Faltas');
        XLSX.writeFile(wb, `${titulo}.xlsx`);
      } else {
        await abrirPDF(titulo, montarHTMLFaltas(titulo, resultado, totalReunioes, deStr, ateStr));
      }
      setMostrarPickerFaltas(false);
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível gerar o relatório.', 'erro', 'Erro');
    } finally {
      setGerandoFaltas(false);
    }
  }

  function membrosFiltradosPontuacao(): Desbravador[] {
    if (pontuacaoFiltroTipo === 'diretoria') return desbravadores.filter((d) => normalizarGrupo(d) === 'Diretoria');
    if (pontuacaoFiltroTipo === 'conselheiros') return desbravadores.filter((d) => ehCargoConselheiro(d.cargo));
    if (pontuacaoFiltroTipo === 'dbv') return desbravadores.filter((d) => normalizarGrupo(d) !== 'Diretoria' && !ehCargoConselheiro(d.cargo));
    if (pontuacaoFiltroTipo === 'unidades') return desbravadores.filter((d) => pontuacaoUnidades.includes(normalizarGrupo(d)));
    if (pontuacaoFiltroTipo === 'membros') return desbravadores.filter((d) => pontuacaoMembros.includes(d.id));
    return desbravadores;
  }

  async function gerarRelatorioPontuacao() {
    if (gerandoPontuacao) return;
    const periodo = calcularPeriodoPontuacao();
    if (!periodo) {
      avisar('Informe início e fim (dd/mm/aaaa).', 'info', 'Período inválido');
      return;
    }
    const membrosAlvo = membrosFiltradosPontuacao();
    if (membrosAlvo.length === 0) {
      avisar('Nenhum membro encontrado para os filtros escolhidos.', 'info', 'Relatório');
      return;
    }
    setGerandoPontuacao(true);
    try {
      const clubeId = getClubeAtivoId();
      const idsAlvo = membrosAlvo.map((d) => d.id);
      const cfg: ConfigPontuacao = configPontuacao;

      // Paginado: vários membros num período longo passam de mil lançamentos.
      const [rows, customRows] = await Promise.all([
        buscarPaginado(
          (q) => q.eq('clube_id', clubeId).in('dbv_id', idsAlvo).gte('data', periodo.de).lte('data', periodo.ate),
          'pontuacoes',
          '*',
        ),
        buscarPaginado(
          (q) => q.eq('clube_id', clubeId).in('dbv_id', idsAlvo).gte('data', periodo.de).lte('data', periodo.ate),
          'pontuacoes_custom',
          'dbv_id,pontos',
        ),
      ]);

      const categoriasVazias = (): CategoriasPontuacao => ({
        presenca: 0, pontualidade: 0, material: 0, uniforme: 0, bom_biblia: 0,
        classe_biblica: 0, especialidade: 0, pgm_especial: 0, atividade_unidade: 0, extras: 0, custom: 0,
      });
      const totais = new Map<number, number>();
      const categoriasPorId = new Map<number, CategoriasPontuacao>();

      for (const p of (rows ?? []) as any[]) {
        const id = Number(p.dbv_id);
        totais.set(id, (totais.get(id) ?? 0) + somaPontuacaoBase(p, cfg));
        if (pontuacaoDetalhe === 'total_extrato') {
          const cat = categoriasPorId.get(id) ?? categoriasVazias();
          for (const c of CATEGORIAS_CONFIGURAVEIS) {
            (cat[c.campo as keyof CategoriasPontuacao] as number) += valorCategoriaConfiguravel(p, c, cfg);
          }
          for (const c of CATEGORIAS_DIRETAS) {
            (cat[c.campo as keyof CategoriasPontuacao] as number) += valorCategoriaDireta(p, c);
          }
          cat.extras += Number(p.pontos_extras) || 0;
          categoriasPorId.set(id, cat);
        }
      }
      for (const c of (customRows ?? []) as any[]) {
        const id = Number(c.dbv_id);
        const pontos = Number(c.pontos) || 0;
        totais.set(id, (totais.get(id) ?? 0) + pontos);
        if (pontuacaoDetalhe === 'total_extrato') {
          const cat = categoriasPorId.get(id) ?? categoriasVazias();
          cat.custom += pontos;
          categoriasPorId.set(id, cat);
        }
      }

      const linhas: LinhaRelatorioPontuacao[] = membrosAlvo.map((d) => ({
        dbv_id: d.id,
        nome: d.nome,
        unidade_nome: normalizarGrupo(d),
        foto_url: d.foto_url,
        total: totais.get(d.id) ?? 0,
        categorias: pontuacaoDetalhe === 'total_extrato' ? (categoriasPorId.get(d.id) ?? categoriasVazias()) : undefined,
      })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

      setLinhasPontuacao(linhas);

      const titulo = `Relatório de Pontuação — ${periodo.label}`;
      if (formatoPontuacao === 'excel') {
        const cabecalho = ['Nome', 'Unidade', 'Total', ...(pontuacaoDetalhe === 'total_extrato' ? CATEGORIAS_PONTUACAO_LABELS.map((c) => c.nome) : [])];
        const wsData = [
          cabecalho,
          ...linhas.map((l) => [
            l.nome, l.unidade_nome, l.total,
            ...(pontuacaoDetalhe === 'total_extrato' ? CATEGORIAS_PONTUACAO_LABELS.map((c) => l.categorias?.[c.campo] ?? 0) : []),
          ]),
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }, ...cabecalho.slice(3).map(() => ({ wch: 14 }))];
        XLSX.utils.book_append_sheet(wb, ws, 'Pontuação');
        XLSX.writeFile(wb, `${titulo}.xlsx`);
      } else {
        await abrirPDF(titulo, montarHTMLPontuacao(titulo, periodo.label, linhas, pontuacaoDetalhe));
      }
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível gerar o relatório.', 'erro', 'Erro');
    } finally {
      setGerandoPontuacao(false);
    }
  }

  async function gerarPDF(titulo: string, incluirDiretoria: boolean) {
    const membros = desbravadores.filter((m) => incluirDiretoria || normalizarGrupo(m) !== 'Diretoria');
    if (membros.length === 0) {
      avisar('Não há membros para gerar este relatório.', 'info', 'Relatório');
      return;
    }
    const html = montarHTMLRelatorio(titulo, membros);
    await abrirPDF(titulo, html);
  }

  function toggleUnidadePDF(nome: string) {
    setUnidadesSelecionadasPDF((prev) => prev.includes(nome) ? prev.filter((u) => u !== nome) : [...prev, nome]);
  }

  async function gerarPDFUnidades() {
    if (unidadesSelecionadasPDF.length === 0) {
      avisar('Selecione ao menos uma unidade.', 'info', 'Relatório');
      return;
    }
    const membros = desbravadores.filter((m) => unidadesSelecionadasPDF.includes(m.unidade_nome || 'Sem Unidade'));
    if (membros.length === 0) {
      avisar('Não há membros nas unidades selecionadas.', 'info', 'Relatório');
      return;
    }
    const titulo = unidadesSelecionadasPDF.length === 1
      ? `Membros - ${unidadesSelecionadasPDF[0]}`
      : `Membros - ${unidadesSelecionadasPDF.length} unidades`;
    await abrirPDF(titulo, montarHTMLRelatorio(titulo, membros));
  }

  async function gerarPDFDocumentacao() {
    if (desbravadores.length === 0) {
      avisar('Não há membros para gerar este relatório.', 'info', 'Relatório');
      return;
    }

    let docs: Documento[] = [];
    let modelos: DocumentoModeloRelatorio[] = [];
    let statusRegistros: DocumentoStatusRelatorio[] = [];
    if (Platform.OS === 'web') {
      const clubeId = getClubeAtivoId();
      const [{ data }, { data: tipos }, { data: statuses }] = await Promise.all([
        supabase.from('documentos').select('*').eq('clube_id', clubeId),
        supabase.from('documentos_modelo').select('campo,nome,ordem').eq('clube_id', clubeId).eq('ativo', true).order('ordem'),
        supabase.from('documento_status').select('dbv_id,campo,status').eq('clube_id', clubeId),
      ]);
      docs = (data ?? []) as Documento[];
      modelos = (tipos ?? []) as DocumentoModeloRelatorio[];
      statusRegistros = (statuses ?? []) as DocumentoStatusRelatorio[];
    } else {
      const db = await getDB();
      docs = await db.getAllAsync<Documento>('SELECT * FROM documentos');
    }

    const titulo = 'Documentação entregue ou pendente';
    await abrirPDF(titulo, montarHTMLDocumentacao(titulo, desbravadores, docs, modelos, statusRegistros));
  }

  async function abrirPDF(titulo: string, html: string) {
    if (Platform.OS === 'web') {
      const win = window.open('', '_blank');
      if (!win) {
        avisar('Não foi possível abrir a janela de impressão.', 'erro', 'Relatório');
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
      return;
    }

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: titulo,
        UTI: 'com.adobe.pdf',
      });
    } else {
      avisar(uri, 'sucesso', 'PDF gerado');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: cores.fundo }]}>
      <View style={[styles.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>📊 Relatórios</Text>
          <Text style={styles.subtitulo}>
            {abaRelatorio === 'documentos' ? 'PDFs e planilhas do clube'
              : abaRelatorio === 'formacao' ? 'Especialidades, classes e pendências'
              : abaRelatorio === 'ano_biblico' ? 'Capítulos lidos por cada desbravador/responsável'
              : abaRelatorio === 'conquistas' ? 'Classes e especialidades concluídas e em andamento'
              : 'Membros agrupados por unidade'}
          </Text>
        </View>
      </View>

      <View style={styles.abasTopo}>
        <TouchableOpacity style={[styles.abaSelectBtn, { backgroundColor: cores.cartao, borderColor: cores.borda }]} onPress={() => setAbaDropdownAberto(true)}>
          <Ionicons
            name={ABAS_RELATORIO.find((a) => a.id === abaRelatorio)?.icon ?? 'document-text'}
            size={17}
            color={corIcone(cores)}
          />
          <Text style={[styles.abaSelectText, cores.isEscuro && { color: '#fff' }]}>
            {ABAS_RELATORIO.find((a) => a.id === abaRelatorio)?.label}
          </Text>
          <Ionicons name="chevron-down" size={18} color={corIcone(cores)} />
        </TouchableOpacity>
      </View>

      {abaRelatorio !== 'documentos' && (
        <View style={[styles.filtroRow, { marginHorizontal: 16, marginTop: 10, marginBottom: 0 }]}>
          {([
            { id: 'nome', label: 'Nome' },
            { id: 'nome_foto', label: 'Nome e foto' },
            { id: 'foto', label: 'Só foto' },
          ] as const).map((op) => (
            <TouchableOpacity
              key={op.id}
              style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, modoExibicao === op.id && styles.filtroChipAtivo]}
              onPress={() => alterarModoExibicao(op.id)}
            >
              <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, modoExibicao === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal
        visible={abaDropdownAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setAbaDropdownAberto(false)}
      >
        <TouchableOpacity
          style={[styles.dropdownOverlay, { backgroundColor: cores.overlay }]}
          activeOpacity={1}
          onPress={() => setAbaDropdownAberto(false)}
        >
          <View style={[styles.dropdownMenu, { backgroundColor: cores.cartao }]}>
            {ABAS_RELATORIO.map((aba) => (
              <TouchableOpacity
                key={aba.id}
                style={[styles.dropdownItem, abaRelatorio === aba.id && [styles.dropdownItemAtivo, { backgroundColor: cores.fundo }]]}
                onPress={() => { setAbaRelatorio(aba.id); setAbaDropdownAberto(false); }}
              >
                <Ionicons name={aba.icon} size={17} color={abaRelatorio === aba.id ? '#1a3a5c' : '#607d8b'} />
                <Text style={[styles.dropdownItemText, { color: cores.textoSecundario }, abaRelatorio === aba.id && styles.dropdownItemTextAtivo]}>
                  {aba.label}
                </Text>
                {abaRelatorio === aba.id && <Ionicons name="checkmark" size={16} color={corIcone(cores)} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {abaRelatorio === 'diretorio' && (
        <View style={[styles.searchBox, { backgroundColor: cores.cartao }]}>
          <Ionicons name="search" size={20} color="#90a4ae" />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por nome, unidade, cargo ou SGC..."
            placeholderTextColor="#999"
            style={[styles.searchInput, { color: cores.texto }]}
          />
        </View>
      )}

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 32 }}>
        {abaRelatorio === 'documentos' && (
        <>
        <View style={[styles.prontosCard, { backgroundColor: cores.cartao }]}>
          <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Membros e documentação</Text>
          <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>Gere PDFs formatados com os dados atuais do clube.</Text>
          <TouchableOpacity style={styles.pdfBtn} onPress={() => gerarPDF('Membros do clube Geral', true)}>
            <Ionicons name="document-text" size={18} color="#fff" />
            <Text style={styles.pdfBtnText}>Membros do clube Geral</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pdfBtn, styles.pdfBtnSec]} onPress={() => gerarPDF('Membros do clube - sem diretoria', false)}>
            <Ionicons name="people" size={18} color={corIcone(cores)} />
            <Text style={[styles.pdfBtnTextSec, cores.isEscuro && { color: '#fff' }]}>Membros do clube - sem diretoria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pdfBtn, styles.pdfBtnSec, { marginBottom: 0 }]} onPress={gerarPDFDocumentacao}>
            <Ionicons name="folder-open" size={18} color={corIcone(cores)} />
            <Text style={[styles.pdfBtnTextSec, cores.isEscuro && { color: '#fff' }]}>Documentação entregue ou pendente</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.prontosCard, { backgroundColor: cores.cartao }]}>
          <TouchableOpacity
            style={styles.cardAcordeaoHeader}
            onPress={() => setMostrarPickerFaltas((v) => !v)}
          >
            <View style={[styles.cardAcordeaoIcon, { backgroundColor: '#fdeaea' }]}>
              <Ionicons name="calendar" size={18} color="#c62828" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Relatório de Faltas</Text>
              <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>Presença por período, com % de faltas por membro.</Text>
            </View>
            <Ionicons name={mostrarPickerFaltas ? 'chevron-up' : 'chevron-down'} size={20} color="#c62828" />
          </TouchableOpacity>

          {mostrarPickerFaltas && (
            <View style={styles.faltasBox}>
              <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Período</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: '2m', label: '2 meses' },
                  { id: '6m', label: '6 meses' },
                  { id: '12m', label: '12 meses' },
                  { id: 'livre', label: 'Período livre' },
                ] as const).map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, periodoFaltas === op.id && styles.filtroChipAtivo]} onPress={() => setPeriodoFaltas(op.id)}>
                    <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, periodoFaltas === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {periodoFaltas === 'livre' && (
                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>De</Text>
                    <TextInput style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={faltasDe} onChangeText={(t) => { const d = t.replace(/\D/g, '').slice(0, 8); setFaltasDe(d.length > 4 ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d); }} placeholder="dd/mm/aaaa" placeholderTextColor="#aaa" keyboardType="numeric" maxLength={10} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Até</Text>
                    <TextInput style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={faltasAte} onChangeText={(t) => { const d = t.replace(/\D/g, '').slice(0, 8); setFaltasAte(d.length > 4 ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d); }} placeholder="dd/mm/aaaa" placeholderTextColor="#aaa" keyboardType="numeric" maxLength={10} />
                  </View>
                </View>
              )}

              <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Membros</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: 'todos', label: 'Todos' },
                  { id: 'desbravadores', label: 'Desbravadores' },
                  { id: 'diretoria', label: 'Diretoria' },
                ] as const).map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, filtroTipoMembro === op.id && styles.filtroChipAtivo]} onPress={() => { setFiltroTipoMembro(op.id); setFiltroUnidades([]); }}>
                    <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, filtroTipoMembro === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {unidadesDisponiveis.filter((u) => u !== 'Diretoria').length > 0 && (
                <>
                  <Text style={[styles.faltasLabel, filtroTipoMembro === 'diretoria' && { opacity: 0.35 }]}>Unidade (vazio = todas)</Text>
                  <View style={[styles.filtroRow, filtroTipoMembro === 'diretoria' && { opacity: 0.35 }]}>
                    {unidadesDisponiveis.filter((u) => u !== 'Diretoria').map((u) => {
                      const ativo = filtroTipoMembro !== 'diretoria' && filtroUnidades.includes(u);
                      return (
                        <TouchableOpacity key={u}
                          style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                          onPress={() => { if (filtroTipoMembro !== 'diretoria') setFiltroUnidades((prev) => ativo ? prev.filter((x) => x !== u) : [...prev, u]); }}
                          disabled={filtroTipoMembro === 'diretoria'}
                        >
                          <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Formato</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: 'pdf', label: '🖨️ PDF / Imprimir' },
                  { id: 'excel', label: '📊 Excel (.xlsx)' },
                ] as const).map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, formatoExport === op.id && styles.filtroChipAtivo]} onPress={() => setFormatoExport(op.id)}>
                    <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, formatoExport === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.pdfBtn, { marginTop: 8, opacity: gerandoFaltas ? 0.6 : 1 }]} onPress={gerarRelatorioFaltas} disabled={gerandoFaltas}>
                <Ionicons name={formatoExport === 'excel' ? 'download' : 'document-text'} size={18} color="#fff" />
                <Text style={styles.pdfBtnText}>{gerandoFaltas ? 'Gerando...' : 'Gerar relatório'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.prontosCard, { backgroundColor: cores.cartao }]}>
          <TouchableOpacity
            style={styles.cardAcordeaoHeader}
            onPress={() => setMostrarPickerClasses((v) => !v)}
          >
            <View style={[styles.cardAcordeaoIcon, { backgroundColor: '#f3eeff' }]}>
              <Ionicons name="ribbon" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Requisitos de Classes</Text>
              <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>Progresso por classe, unidade ou membro específico.</Text>
            </View>
            <Ionicons name={mostrarPickerClasses ? 'chevron-up' : 'chevron-down'} size={20} color="#7c3aed" />
          </TouchableOpacity>

          {mostrarPickerClasses && (
            <View style={styles.faltasBox}>
              <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Abrangência</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: 'clube', label: 'Clube todo' },
                  { id: 'unidades', label: 'Por unidades' },
                  { id: 'membros', label: 'Membros específicos' },
                ] as const).map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, escopoClasses === op.id && styles.filtroChipAtivo]}
                    onPress={() => { setEscopoClasses(op.id); setUnidadesClasses([]); setMembrosClasses([]); }}
                  >
                    <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, escopoClasses === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {escopoClasses === 'unidades' && (
                <>
                  <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Selecione as unidades</Text>
                  <View style={styles.filtroRow}>
                    {unidadesDisponiveis.map((u) => {
                      const ativo = unidadesClasses.includes(u);
                      return (
                        <TouchableOpacity
                          key={u}
                          style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                          onPress={() => setUnidadesClasses((p) => (ativo ? p.filter((x) => x !== u) : [...p, u]))}
                        >
                          <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {escopoClasses === 'membros' && (
                <>
                  <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Selecione os membros ({membrosClasses.length})</Text>
                  <TextInput
                    style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
                    value={buscaMembroClasses}
                    onChangeText={setBuscaMembroClasses}
                    placeholder="Buscar membro..."
                    placeholderTextColor="#aaa"
                  />
                  <View style={[styles.filtroRow, { maxHeight: 190, overflow: 'hidden' }]}>
                    {desbravadores
                      .filter((d) => combinaBusca(d.nome, buscaMembroClasses))
                      .slice(0, 60)
                      .map((d) => {
                        const ativo = membrosClasses.includes(d.id);
                        return (
                          <TouchableOpacity
                            key={d.id}
                            style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                            onPress={() => setMembrosClasses((p) => (ativo ? p.filter((x) => x !== d.id) : [...p, d.id]))}
                          >
                            <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{d.nome}</Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </>
              )}

              {classesDisponiveis.length > 0 && (
                <>
                  <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Classes (vazio = todas)</Text>
                  <View style={styles.filtroRow}>
                    {classesDisponiveis.map((c) => {
                      const ativo = classesSelecionadas.includes(c);
                      return (
                        <TouchableOpacity
                          key={c}
                          style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                          onPress={() => setClassesSelecionadas((p) => (ativo ? p.filter((x) => x !== c) : [...p, c]))}
                        >
                          <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{c}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Detalhamento e formato</Text>
              <View style={styles.filtroRow}>
                <TouchableOpacity
                  style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, detalharClasses && styles.filtroChipAtivo]}
                  onPress={() => setDetalharClasses((v) => !v)}
                >
                  <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, detalharClasses && styles.filtroChipTextAtivo]}>
                    {detalharClasses ? '✓ ' : ''}Listar requisitos
                  </Text>
                </TouchableOpacity>
                {([
                  { id: 'pdf', label: '🖨️ PDF / Imprimir' },
                  { id: 'excel', label: '📊 Excel (.xlsx)' },
                ] as const).map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, formatoClasses === op.id && styles.filtroChipAtivo]}
                    onPress={() => setFormatoClasses(op.id)}
                  >
                    <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, formatoClasses === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.pdfBtn, { marginTop: 8, backgroundColor: '#7c3aed', opacity: gerandoClasses ? 0.6 : 1 }]}
                onPress={gerarRelatorioClasses}
                disabled={gerandoClasses}
              >
                <Ionicons name={formatoClasses === 'excel' ? 'download' : 'document-text'} size={18} color="#fff" />
                <Text style={styles.pdfBtnText}>{gerandoClasses ? 'Gerando...' : 'Gerar relatório'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        </>
        )}

        {abaRelatorio === 'formacao' && (
        <View style={[styles.prontosCard, { backgroundColor: cores.cartao }]}>
          <View style={styles.formativoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Especialidades e Classes</Text>
              <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>
                Visão geral do clube, pendências de aprovação e itens prontos para receber.
              </Text>
            </View>
            <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: cores.fundo }]} onPress={carregarVisaoFormativa}>
              <Ionicons name="refresh" size={18} color={corIcone(cores)} />
            </TouchableOpacity>
          </View>

          <View style={styles.filtroRow}>
            {([
              { id: 'pronto' as const, label: 'Prontos' },
              { id: 'pendente_aprovacao' as const, label: 'A aprovar' },
              { id: 'entregue' as const, label: 'Entregues' },
              { id: 'todos' as const, label: 'Todos' },
            ]).map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, filtroFormativo === f.id && styles.filtroChipAtivo]}
                onPress={() => setFiltroFormativo(f.id)}
              >
                <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, filtroFormativo === f.id && styles.filtroChipTextAtivo]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.manualBox, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
            <View style={styles.manualHeader}>
              <Ionicons name="add-circle" size={18} color={corIcone(cores)} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.manualTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Adicionar manualmente a receber</Text>
                <Text style={[styles.manualSub, { color: cores.textoSecundario }]}>
                  Para especialidades/classes já concluídas antes do sistema, sem atividade vinculada.
                </Text>
              </View>
            </View>

            <View style={styles.filtroRow}>
              {([
                { id: 'especialidade' as TipoFormativo, label: 'Especialidade' },
                { id: 'classe' as TipoFormativo, label: 'Classe' },
              ]).map((op) => (
                <TouchableOpacity
                  key={op.id}
                  style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, tipoManual === op.id && styles.filtroChipAtivo]}
                  onPress={() => {
                    setTipoManual(op.id);
                    setItemManual('');
                    setBuscaItemManual('');
                  }}
                >
                  <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, tipoManual === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              value={buscaItemManual}
              onChangeText={(txt) => {
                setBuscaItemManual(txt);
                if (itemManual && txt !== itemManual) setItemManual('');
              }}
              placeholder={`Buscar ${tipoManual === 'classe' ? 'classe' : 'especialidade'}...`}
              placeholderTextColor="#90a4ae"
              style={[styles.manualInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
            />
            {buscaItemManual.trim().length > 0 || itemManual ? (
              <View style={styles.chipWrap}>
                {opcoesItensManual.map((nome) => (
                  <TouchableOpacity
                    key={nome}
                    style={[styles.selectChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, itemManual === nome && styles.selectChipAtivo]}
                    onPress={() => {
                      setItemManual(nome);
                      setBuscaItemManual(nome);
                    }}
                  >
                    <Text style={[styles.selectChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, itemManual === nome && styles.selectChipTextAtivo]}>{nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <TextInput
              value={buscaMembroManual}
              onChangeText={setBuscaMembroManual}
              placeholder="Buscar membros por nome ou unidade..."
              placeholderTextColor="#90a4ae"
              style={[styles.manualInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
            />
            <View style={styles.manualResumoRow}>
              <Text style={[styles.manualResumo, { color: cores.textoSecundario }]}>{membrosManual.length} membro(s) selecionado(s)</Text>
              <TouchableOpacity onPress={() => setMembrosManual(desbravadores.map((m) => m.id))}>
                <Text style={[styles.manualLink, cores.isEscuro && { color: '#fff' }]}>Selecionar todos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMembrosManual([])}>
                <Text style={[styles.manualLink, cores.isEscuro && { color: '#fff' }]}>Limpar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.membrosManualLista}>
              {membrosManualVisiveis.map((m) => {
                const ativo = membrosManual.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.membroManualChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.membroManualChipAtivo]}
                    onPress={() => alternarMembroManual(m.id)}
                  >
                    <Ionicons name={ativo ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={ativo ? '#fff' : '#607d8b'} />
                    <Text style={[styles.membroManualText, { color: cores.textoSecundario }, ativo && styles.membroManualTextAtivo]} numberOfLines={1}>
                      {m.nome} · {normalizarGrupo(m)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.manualSalvarBtn, (!itemManual || membrosManual.length === 0 || salvandoManual) && styles.manualSalvarBtnDisabled]}
              disabled={!itemManual || membrosManual.length === 0 || salvandoManual}
              onPress={adicionarManualAReceber}
            >
              <Ionicons name="ribbon" size={17} color="#fff" />
              <Text style={styles.manualSalvarText}>{salvandoManual ? 'Salvando...' : 'Adicionar a receber'}</Text>
            </TouchableOpacity>
          </View>

          {carregandoFormativos ? (
            <Text style={[styles.vazioCard, { color: cores.textoSecundario }]}>Carregando visão geral...</Text>
          ) : (
            <>
              <View style={styles.formativoResumo}>
                <View style={[styles.formativoResumoItem, { backgroundColor: cores.fundo }]}>
                  <Text style={[styles.formativoResumoNum, cores.isEscuro && { color: '#fff' }]}>{itensFormativos.filter(i => i.situacao === 'pronto').length}</Text>
                  <Text style={[styles.formativoResumoLabel, { color: cores.textoSecundario }]}>prontos</Text>
                </View>
                <View style={[styles.formativoResumoItem, { backgroundColor: cores.fundo }]}>
                  <Text style={[styles.formativoResumoNum, cores.isEscuro && { color: '#fff' }]}>{itensFormativos.filter(i => i.situacao === 'pendente_aprovacao').length}</Text>
                  <Text style={[styles.formativoResumoLabel, { color: cores.textoSecundario }]}>a aprovar</Text>
                </View>
                <View style={[styles.formativoResumoItem, { backgroundColor: cores.fundo }]}>
                  <Text style={[styles.formativoResumoNum, cores.isEscuro && { color: '#fff' }]}>{itensFormativos.filter(i => i.situacao === 'entregue').length}</Text>
                  <Text style={[styles.formativoResumoLabel, { color: cores.textoSecundario }]}>entregues</Text>
                </View>
              </View>

              {itensFormativos
                .filter((i) => filtroFormativo === 'todos' || i.situacao === filtroFormativo)
                .slice(0, 80)
                .map((item) => (
                  <View key={item.id} style={[styles.formativoItem, { borderTopColor: cores.borda }]}>
                    <View style={[
                      styles.formativoIcon,
                      item.tipo === 'classe' ? { backgroundColor: '#e8f0fe' } : { backgroundColor: '#fff7e6' },
                    ]}>
                      <Ionicons
                        name={item.tipo === 'classe' ? 'school' : 'star'}
                        size={18}
                        color={item.tipo === 'classe' ? '#1a3a5c' : '#f9a825'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formativoNome, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{item.item_nome}</Text>
                      <Text style={[styles.formativoMeta, { color: cores.textoSecundario }]}>
                        {modoExibicao !== 'foto' ? `${item.membro_nome} · ` : ''}{item.unidade_nome}
                      </Text>
                      {item.origem ? <Text style={styles.formativoOrigem}>Atividade: {item.origem}</Text> : null}
                    </View>
                    <View style={styles.formativoRight}>
                      <Text style={[
                        styles.situacaoBadge,
                        item.situacao === 'pronto' && styles.situacaoPronto,
                        item.situacao === 'pendente_aprovacao' && styles.situacaoPendente,
                        item.situacao === 'entregue' && styles.situacaoEntregue,
                      ]}>
                        {item.situacao === 'pronto' ? 'Pronto' : item.situacao === 'pendente_aprovacao' ? 'A aprovar' : 'Entregue'}
                      </Text>
                      {item.situacao === 'pronto' ? (
                        <TouchableOpacity style={styles.aprovarBtn} onPress={() => registrarEntregaFormativa(item)}>
                          <Ionicons name="checkmark-circle" size={15} color="#fff" />
                          <Text style={styles.aprovarBtnText}>Recebeu</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}

              {itensFormativos.filter((i) => filtroFormativo === 'todos' || i.situacao === filtroFormativo).length === 0 && (
                <Text style={[styles.vazioCard, { color: cores.textoSecundario }]}>Nenhum item encontrado nesta situação.</Text>
              )}
            </>
          )}
        </View>
        )}

        {abaRelatorio === 'ano_biblico' && (
        <View style={[styles.prontosCard, { backgroundColor: cores.cartao }]}>
          <View style={styles.formativoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Ano Bíblico</Text>
              <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>
                Capítulos que cada desbravador/responsável abriu e rolou até o fim — {calcularPeriodoAnoBiblico()?.label ?? 'período inválido'}.
              </Text>
            </View>
            <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: cores.fundo }]} onPress={carregarLeiturasAnoBiblico}>
              <Ionicons name="refresh" size={18} color={corIcone(cores)} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cardAcordeaoHeader}
            onPress={() => setMostrarFiltrosAnoBiblico((v) => !v)}
          >
            <View style={[styles.cardAcordeaoIcon, { backgroundColor: '#ede7f6' }]}>
              <Ionicons name="filter" size={18} color="#5e35b1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Filtros</Text>
              <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>Período, unidade, diretoria ou membros específicos.</Text>
            </View>
            <Ionicons name={mostrarFiltrosAnoBiblico ? 'chevron-up' : 'chevron-down'} size={20} color="#5e35b1" />
          </TouchableOpacity>

          {mostrarFiltrosAnoBiblico && (
            <View style={styles.faltasBox}>
              <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Período</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: 'ano', label: 'Ano atual' },
                  { id: 'mes', label: 'Por mês' },
                  { id: 'trimestre', label: 'Por trimestre' },
                  { id: 'semestre', label: 'Por semestre' },
                  { id: 'livre', label: 'Data x até data y' },
                ] as const).map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, periodoAnoBiblico === op.id && styles.filtroChipAtivo]} onPress={() => setPeriodoAnoBiblico(op.id)}>
                    <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, periodoAnoBiblico === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {periodoAnoBiblico === 'mes' && (
                <View style={[styles.filtroRow, { marginTop: 8 }]}>
                  {MESES_NOME.map((nome, idx) => (
                    <TouchableOpacity key={nome} style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, mesAnoBiblico === idx + 1 && styles.filtroChipAtivo]} onPress={() => setMesAnoBiblico(idx + 1)}>
                      <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, mesAnoBiblico === idx + 1 && styles.filtroChipTextAtivo]}>{nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {periodoAnoBiblico === 'trimestre' && (
                <View style={[styles.filtroRow, { marginTop: 8 }]}>
                  {[1, 2, 3, 4].map((t) => (
                    <TouchableOpacity key={t} style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, trimestreAnoBiblico === t && styles.filtroChipAtivo]} onPress={() => setTrimestreAnoBiblico(t)}>
                      <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, trimestreAnoBiblico === t && styles.filtroChipTextAtivo]}>{t}º trimestre</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {periodoAnoBiblico === 'semestre' && (
                <View style={[styles.filtroRow, { marginTop: 8 }]}>
                  {[1, 2].map((s) => (
                    <TouchableOpacity key={s} style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, semestreAnoBiblico === s && styles.filtroChipAtivo]} onPress={() => setSemestreAnoBiblico(s)}>
                      <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, semestreAnoBiblico === s && styles.filtroChipTextAtivo]}>{s}º semestre</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {periodoAnoBiblico === 'livre' && (
                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>De</Text>
                    <TextInput style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={anoBiblicoDe} onChangeText={(t) => { const d = t.replace(/\D/g, '').slice(0, 8); setAnoBiblicoDe(d.length > 4 ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d); }} placeholder="dd/mm/aaaa" placeholderTextColor="#aaa" keyboardType="numeric" maxLength={10} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Até</Text>
                    <TextInput style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]} value={anoBiblicoAte} onChangeText={(t) => { const d = t.replace(/\D/g, '').slice(0, 8); setAnoBiblicoAte(d.length > 4 ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d); }} placeholder="dd/mm/aaaa" placeholderTextColor="#aaa" keyboardType="numeric" maxLength={10} />
                  </View>
                </View>
              )}

              <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Membros</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: 'todos', label: 'Todos' },
                  { id: 'desbravadores', label: 'Desbravadores' },
                  { id: 'diretoria', label: 'Diretoria' },
                ] as const).map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, filtroTipoMembroAnoBiblico === op.id && styles.filtroChipAtivo]} onPress={() => { setFiltroTipoMembroAnoBiblico(op.id); setFiltroUnidadesAnoBiblico([]); setMembrosAnoBiblico([]); }}>
                    <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, filtroTipoMembroAnoBiblico === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {unidadesDisponiveis.filter((u) => u !== 'Diretoria').length > 0 && (
                <>
                  <Text style={[styles.faltasLabel, filtroTipoMembroAnoBiblico === 'diretoria' && { opacity: 0.35 }]}>Unidade (vazio = todas)</Text>
                  <View style={[styles.filtroRow, filtroTipoMembroAnoBiblico === 'diretoria' && { opacity: 0.35 }]}>
                    {unidadesDisponiveis.filter((u) => u !== 'Diretoria').map((u) => {
                      const ativo = filtroTipoMembroAnoBiblico !== 'diretoria' && filtroUnidadesAnoBiblico.includes(u);
                      return (
                        <TouchableOpacity key={u}
                          style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                          onPress={() => { if (filtroTipoMembroAnoBiblico !== 'diretoria') { setMembrosAnoBiblico([]); setFiltroUnidadesAnoBiblico((prev) => ativo ? prev.filter((x) => x !== u) : [...prev, u]); } }}
                          disabled={filtroTipoMembroAnoBiblico === 'diretoria'}
                        >
                          <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Ou desbravador(es) específico(s) ({membrosAnoBiblico.length})</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
                value={buscaMembroAnoBiblico}
                onChangeText={setBuscaMembroAnoBiblico}
                placeholder="Buscar membro..."
                placeholderTextColor="#aaa"
              />
              <View style={[styles.filtroRow, { maxHeight: 190, overflow: 'hidden' }]}>
                {desbravadores
                  .filter((d) => combinaBusca(d.nome, buscaMembroAnoBiblico))
                  .slice(0, 60)
                  .map((d) => {
                    const ativo = membrosAnoBiblico.includes(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                        onPress={() => setMembrosAnoBiblico((p) => (ativo ? p.filter((x) => x !== d.id) : [...p, d.id]))}
                      >
                        <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{d.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              <TouchableOpacity style={[styles.pdfBtn, { marginTop: 8, opacity: carregandoAnoBiblico ? 0.6 : 1 }]} onPress={carregarLeiturasAnoBiblico} disabled={carregandoAnoBiblico}>
                <Ionicons name="filter" size={18} color="#fff" />
                <Text style={styles.pdfBtnText}>{carregandoAnoBiblico ? 'Aplicando...' : 'Aplicar filtros'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {carregandoAnoBiblico && <Text style={[styles.vazioCard, { color: cores.textoSecundario }]}>Carregando…</Text>}

          {!carregandoAnoBiblico && leiturasAnoBiblico.length === 0 && (
            <Text style={[styles.vazioCard, { color: cores.textoSecundario }]}>Ninguém marcou nenhum capítulo como lido nesse período.</Text>
          )}

          {!carregandoAnoBiblico && leiturasAnoBiblico.map((item) => (
            <View key={item.dbv_id} style={[styles.formativoItem, { borderTopColor: cores.borda }]}>
              {modoExibicao !== 'nome' && <Avatar nome={item.membro_nome} foto_url={item.foto_url} size={34} />}
              <View style={{ flex: 1 }}>
                {modoExibicao !== 'foto' && <Text style={[styles.formativoNome, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{item.membro_nome}</Text>}
                <Text style={[styles.formativoMeta, { color: cores.textoSecundario }]}>
                  {item.unidade_nome}{item.ultimaLeitura ? ` · última leitura em ${new Date(item.ultimaLeitura).toLocaleDateString('pt-BR')}` : ''}
                </Text>
              </View>
              <View style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
                <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }]}>{item.totalLidos} capítulo{item.totalLidos === 1 ? '' : 's'}</Text>
              </View>
            </View>
          ))}
        </View>
        )}

        {abaRelatorio === 'conquistas' && (
        <View style={[styles.prontosCard, { backgroundColor: cores.cartao }]}>
          <View style={styles.formativoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Quadro de conquistas</Text>
              <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>
                Classes e especialidades concluídas e em andamento, por membro/unidade.
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.cardAcordeaoHeader} onPress={() => setMostrarFiltrosConquistas((v) => !v)}>
            <View style={[styles.cardAcordeaoIcon, { backgroundColor: '#fff7e6' }]}>
              <Ionicons name="filter" size={18} color="#f9a825" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Filtros</Text>
              <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>Unidade, diretoria ou membros específicos.</Text>
            </View>
            <Ionicons name={mostrarFiltrosConquistas ? 'chevron-up' : 'chevron-down'} size={20} color="#f9a825" />
          </TouchableOpacity>

          {mostrarFiltrosConquistas && (
            <View style={styles.faltasBox}>
              <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Membros</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: 'todos', label: 'Todos' },
                  { id: 'desbravadores', label: 'Desbravadores' },
                  { id: 'diretoria', label: 'Diretoria' },
                ] as const).map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, filtroTipoMembroConquistas === op.id && styles.filtroChipAtivo]} onPress={() => { setFiltroTipoMembroConquistas(op.id); setFiltroUnidadesConquistas([]); setMembrosConquistas([]); }}>
                    <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, filtroTipoMembroConquistas === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {unidadesDisponiveis.filter((u) => u !== 'Diretoria').length > 0 && (
                <>
                  <Text style={[styles.faltasLabel, filtroTipoMembroConquistas === 'diretoria' && { opacity: 0.35 }]}>Unidade (vazio = todas)</Text>
                  <View style={[styles.filtroRow, filtroTipoMembroConquistas === 'diretoria' && { opacity: 0.35 }]}>
                    {unidadesDisponiveis.filter((u) => u !== 'Diretoria').map((u) => {
                      const ativo = filtroTipoMembroConquistas !== 'diretoria' && filtroUnidadesConquistas.includes(u);
                      return (
                        <TouchableOpacity key={u}
                          style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                          onPress={() => { if (filtroTipoMembroConquistas !== 'diretoria') { setMembrosConquistas([]); setFiltroUnidadesConquistas((prev) => ativo ? prev.filter((x) => x !== u) : [...prev, u]); } }}
                          disabled={filtroTipoMembroConquistas === 'diretoria'}
                        >
                          <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Ou membro(s) específico(s) ({membrosConquistas.length})</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
                value={buscaMembroConquistas}
                onChangeText={setBuscaMembroConquistas}
                placeholder="Buscar membro..."
                placeholderTextColor="#aaa"
              />
              <View style={[styles.filtroRow, { maxHeight: 190, overflow: 'hidden' }]}>
                {desbravadores
                  .filter((d) => combinaBusca(d.nome, buscaMembroConquistas))
                  .slice(0, 60)
                  .map((d) => {
                    const ativo = membrosConquistas.includes(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                        onPress={() => setMembrosConquistas((p) => (ativo ? p.filter((x) => x !== d.id) : [...p, d.id]))}
                      >
                        <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{d.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>
          )}

          {carregandoFormativos && <Text style={[styles.vazioCard, { color: cores.textoSecundario }]}>Carregando…</Text>}
          {!carregandoFormativos && conquistasPorMembro.length === 0 && (
            <Text style={[styles.vazioCard, { color: cores.textoSecundario }]}>Nenhum membro com conquistas para esse filtro.</Text>
          )}

          {!carregandoFormativos && conquistasPorMembro.map(({ membro, concluidas, emAndamento }) => (
            <View key={membro.id} style={[styles.conquistaMembroBox, { borderTopColor: cores.borda }]}>
              <View style={[styles.formativoItem, { borderTopColor: cores.borda }]}>
                {modoExibicao !== 'nome' && <Avatar nome={membro.nome} foto_url={membro.foto_url ?? undefined} cor={avatarCor(membro.nome)} size={34} />}
                <View style={{ flex: 1 }}>
                  {modoExibicao !== 'foto' && <Text style={[styles.formativoNome, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{membro.nome}</Text>}
                  <Text style={[styles.formativoMeta, { color: cores.textoSecundario }]}>{normalizarGrupo(membro)}</Text>
                </View>
                <View style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
                  <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }]}>{concluidas.length} concluída{concluidas.length === 1 ? '' : 's'}</Text>
                </View>
              </View>
              {concluidas.length > 0 && (
                <View style={{ marginLeft: 44, marginBottom: 6 }}>
                  {concluidas.map((item) => (
                    <View key={item.id} style={styles.conquistaLinha}>
                      <Ionicons name={item.tipo === 'classe' ? 'school' : 'star'} size={13} color="#2e7d32" />
                      <Text style={[styles.conquistaLinhaTexto, { color: cores.texto }]}>{item.item_nome}</Text>
                    </View>
                  ))}
                </View>
              )}
              {emAndamento.length > 0 && (
                <View style={{ marginLeft: 44, marginBottom: 8 }}>
                  <Text style={styles.conquistaSubtitulo}>Em andamento</Text>
                  {emAndamento.map((item) => (
                    <View key={item.id} style={styles.conquistaLinha}>
                      <Ionicons name={item.tipo === 'classe' ? 'school-outline' : 'star-outline'} size={13} color="#b45309" />
                      <Text style={[styles.conquistaLinhaTexto, { color: cores.texto }]}>
                        {item.item_nome} — {item.situacao === 'pronto' ? 'pronto pra receber' : 'aguardando aprovação'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
        )}

        {abaRelatorio === 'pontuacao' && (
        <>
        <View style={[styles.prontosCard, { backgroundColor: cores.cartao }]}>
          <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Relatório de Pontuação</Text>
          <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>Total de pontos por membro em um período — com filtro por público.</Text>

          <Text style={[styles.faltasLabel, { marginTop: 6 }]}>Público</Text>
          <View style={styles.filtroRow}>
            {([
              { id: 'todos', label: 'Todos' },
              { id: 'diretoria', label: 'Diretoria' },
              { id: 'conselheiros', label: 'Conselheiros' },
              { id: 'dbv', label: 'DBV' },
              { id: 'unidades', label: 'Unidade(s) específica(s)' },
              { id: 'membros', label: 'Pessoa(s) específica(s)' },
            ] as const).map((op) => (
              <TouchableOpacity
                key={op.id}
                style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, pontuacaoFiltroTipo === op.id && styles.filtroChipAtivo]}
                onPress={() => { setPontuacaoFiltroTipo(op.id); setPontuacaoUnidades([]); setPontuacaoMembros([]); }}
              >
                <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, pontuacaoFiltroTipo === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {pontuacaoFiltroTipo === 'unidades' && (
            <>
              <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Selecione as unidades</Text>
              <View style={styles.filtroRow}>
                {unidadesDisponiveis.map((u) => {
                  const ativo = pontuacaoUnidades.includes(u);
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                      onPress={() => setPontuacaoUnidades((p) => (ativo ? p.filter((x) => x !== u) : [...p, u]))}
                    >
                      <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {pontuacaoFiltroTipo === 'membros' && (
            <>
              <Text style={[styles.faltasLabel, { color: cores.textoSecundario }]}>Selecione as pessoas ({pontuacaoMembros.length})</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
                value={buscaMembroPontuacao}
                onChangeText={setBuscaMembroPontuacao}
                placeholder="Buscar membro..."
                placeholderTextColor="#aaa"
              />
              <View style={[styles.filtroRow, { maxHeight: 190, overflow: 'hidden' }]}>
                {desbravadores
                  .filter((d) => combinaBusca(d.nome, buscaMembroPontuacao))
                  .slice(0, 60)
                  .map((d) => {
                    const ativo = pontuacaoMembros.includes(d.id);
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                        onPress={() => setPontuacaoMembros((p) => (ativo ? p.filter((x) => x !== d.id) : [...p, d.id]))}
                      >
                        <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{d.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </>
          )}

          <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Período</Text>
          <View style={styles.filtroRow}>
            {([
              { id: 'hoje', label: 'Hoje' },
              { id: 'semana', label: 'Semana atual' },
              { id: 'mes', label: 'Mês atual' },
              { id: 'trimestre', label: 'Trimestre atual' },
              { id: 'semestre', label: 'Semestre atual' },
              { id: 'ano', label: 'Ano atual' },
              { id: 'livre', label: 'Personalizado' },
            ] as const).map((op) => (
              <TouchableOpacity
                key={op.id}
                style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, pontuacaoPeriodo === op.id && styles.filtroChipAtivo]}
                onPress={() => setPontuacaoPeriodo(op.id)}
              >
                <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, pontuacaoPeriodo === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {pontuacaoPeriodo === 'livre' && (
            <View style={styles.filtroRow}>
              <TextInput
                style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
                value={pontuacaoDataDe}
                onChangeText={(t) => setPontuacaoDataDe(formatarDataDigitada(t))}
                placeholder="De (dd/mm/aaaa)"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.dateInput, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
                value={pontuacaoDataAte}
                onChangeText={(t) => setPontuacaoDataAte(formatarDataDigitada(t))}
                placeholder="Até (dd/mm/aaaa)"
                placeholderTextColor="#aaa"
                keyboardType="number-pad"
              />
            </View>
          )}

          <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Nível de detalhe</Text>
          <View style={styles.filtroRow}>
            {([
              { id: 'total', label: 'Só pontuação' },
              { id: 'total_extrato', label: 'Pontuação + extrato' },
            ] as const).map((op) => (
              <TouchableOpacity
                key={op.id}
                style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, pontuacaoDetalhe === op.id && styles.filtroChipAtivo]}
                onPress={() => setPontuacaoDetalhe(op.id)}
              >
                <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, pontuacaoDetalhe === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Formato</Text>
          <View style={styles.filtroRow}>
            {([
              { id: 'pdf', label: '🖨️ PDF / Imprimir' },
              { id: 'excel', label: '📊 Excel (.xlsx)' },
            ] as const).map((op) => (
              <TouchableOpacity
                key={op.id}
                style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, formatoPontuacao === op.id && styles.filtroChipAtivo]}
                onPress={() => setFormatoPontuacao(op.id)}
              >
                <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, formatoPontuacao === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.pdfBtn, { marginTop: 8, opacity: gerandoPontuacao ? 0.6 : 1 }]}
            onPress={gerarRelatorioPontuacao}
            disabled={gerandoPontuacao}
          >
            <Ionicons name={formatoPontuacao === 'excel' ? 'download' : 'document-text'} size={18} color="#fff" />
            <Text style={styles.pdfBtnText}>{gerandoPontuacao ? 'Gerando...' : 'Gerar relatório'}</Text>
          </TouchableOpacity>
        </View>

        {linhasPontuacao.length > 0 && (
          <View style={[styles.prontosCard, { backgroundColor: cores.cartao }]}>
            <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Resultado ({linhasPontuacao.length})</Text>
            {linhasPontuacao.map((l) => (
              <View key={l.dbv_id} style={[styles.formativoItem, { borderTopColor: cores.borda }]}>
                {modoExibicao !== 'nome' && <Avatar nome={l.nome} foto_url={l.foto_url} cor={avatarCor(l.nome)} size={34} />}
                <View style={{ flex: 1 }}>
                  {modoExibicao !== 'foto' && <Text style={[styles.formativoNome, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{l.nome}</Text>}
                  <Text style={[styles.formativoMeta, { color: cores.textoSecundario }]}>
                    {l.unidade_nome}
                    {l.categorias ? ` · Pres. ${l.categorias.presenca} · Pontual. ${l.categorias.pontualidade} · Mat. ${l.categorias.material} · Unif. ${l.categorias.uniforme} · Bíblia ${l.categorias.bom_biblia} · Classe ${l.categorias.classe_biblica} · Espec. ${l.categorias.especialidade} · Pgm ${l.categorias.pgm_especial} · Ativ. ${l.categorias.atividade_unidade} · Extras ${l.categorias.extras} · Custom ${l.categorias.custom}` : ''}
                  </Text>
                </View>
                <View style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
                  <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }]}>{l.total} pts</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        </>
        )}

        {abaRelatorio === 'diretorio' && (
        <>
        <View style={[styles.prontosCard, { backgroundColor: cores.cartao }]}>
          <Text style={[styles.prontosTitulo, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Gerar PDF por unidade</Text>
          <Text style={[styles.prontosSub, { color: cores.textoSecundario }]}>Escolha 1 ou mais unidades e gere um PDF só com os nomes delas.</Text>
          <View style={styles.filtroRow}>
            {unidadesDisponiveis.map((u) => {
              const ativo = unidadesSelecionadasPDF.includes(u);
              return (
                <TouchableOpacity
                  key={u}
                  style={[styles.filtroChip, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && styles.filtroChipAtivo]}
                  onPress={() => toggleUnidadePDF(u)}
                >
                  <Text style={[styles.filtroChipText, cores.isEscuro && { color: '#fff' }, { color: cores.textoSecundario }, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.pdfBtn, unidadesSelecionadasPDF.length === 0 && { opacity: 0.5 }]}
            onPress={gerarPDFUnidades}
            disabled={unidadesSelecionadasPDF.length === 0}
          >
            <Ionicons name="document-text" size={18} color="#fff" />
            <Text style={styles.pdfBtnText}>
              {unidadesSelecionadasPDF.length === 0
                ? 'Gerar PDF das unidades'
                : `Gerar PDF (${unidadesSelecionadasPDF.length} unidade${unidadesSelecionadasPDF.length > 1 ? 's' : ''})`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resumo}>
          <View style={[styles.resumoItem, { backgroundColor: cores.cartao }]}>
            <Text style={[styles.resumoNum, cores.isEscuro && { color: '#fff' }]}>{desbravadores.length}</Text>
            <Text style={[styles.resumoLabel, { color: cores.textoSecundario }]}>membros</Text>
          </View>
          <View style={[styles.resumoItem, { backgroundColor: cores.cartao }]}>
            <Text style={[styles.resumoNum, cores.isEscuro && { color: '#fff' }]}>{grupos.length}</Text>
            <Text style={[styles.resumoLabel, { color: cores.textoSecundario }]}>grupos</Text>
          </View>
        </View>

        {grupos.map((grupo) => {
          const cor = CORES[grupo.nome] ?? '#1a3a5c';
          return (
            <View key={grupo.nome} style={[styles.grupoCard, { backgroundColor: cores.cartao }]}>
              <View style={[styles.grupoHeader, { borderLeftColor: cor, borderBottomColor: cores.borda }]}>
                <View style={[styles.dot, { backgroundColor: cor }]} />
                <Text style={[styles.grupoTitulo, { color: cores.texto }]}>{grupo.nome}</Text>
                <View style={[styles.countBadge, { backgroundColor: `${cor}22` }]}>
                  <Text style={[styles.countText, { color: cor }]}>{grupo.membros.length}</Text>
                </View>
              </View>

              {grupo.membros.map((membro) => (
                <View key={membro.id} style={[styles.membroRow, { borderBottomColor: cores.borda }]}>
                  {modoExibicao !== 'nome' && <Avatar nome={membro.nome} foto_url={membro.foto_url} cor={cor} size={40} />}
                  <View style={styles.membroInfo}>
                    {modoExibicao !== 'foto' && <Text style={[styles.nome, { color: cores.texto }]}>{membro.nome}</Text>}
                    <Text style={[styles.meta, { color: cores.textoSecundario }]}>
                      {membro.cargo || 'Sem cargo'}
                      {membro.id_sgc ? ` · SGC ${membro.id_sgc}` : ''}
                    </Text>
                    <Text style={[styles.meta, { color: cores.textoSecundario }]}>
                      {membro.email || 'sem e-mail'} {membro.contato ? `· ${membro.contato}` : ''}
                    </Text>
                  </View>
                  {membro.idade ? <Text style={[styles.idade, cores.isEscuro && { color: '#fff' }]}>{membro.idade}a</Text> : null}
                </View>
              ))}
            </View>
          );
        })}

        {grupos.length === 0 && (
          <Text style={[styles.vazio, { color: cores.textoSecundario }]}>Nenhum membro encontrado para este filtro.</Text>
        )}
        </>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  semAcesso: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  semAcessoText: { color: '#888', fontSize: 15, textAlign: 'center' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: { padding: 6, marginLeft: -6 },
  titulo: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitulo: { color: '#a8c8e8', fontSize: 13, marginTop: 4 },
  searchBox: { margin: 16, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, height: 54, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 2 },
  searchInput: { flex: 1, color: '#222', fontSize: 15 },
  lista: { flex: 1, paddingHorizontal: 16 },
  prontosCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, elevation: 2 },
  prontosTitulo: { color: '#1a3a5c', fontSize: 17, fontWeight: '900' },
  prontosSub: { color: '#777', fontSize: 12, marginTop: 3, marginBottom: 12 },
  pdfBtn: { backgroundColor: '#1a3a5c', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  pdfBtnSec: { backgroundColor: '#eef5fb', borderWidth: 1, borderColor: '#cfe0ef', marginBottom: 0 },
  abasTopo: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
  },
  abaSelectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#dbe4ec',
    paddingVertical: 12, paddingHorizontal: 14, elevation: 2,
  },
  abaSelectText: { flex: 1, color: '#1a3a5c', fontWeight: '800', fontSize: 14 },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(10,20,35,0.35)', paddingTop: 150, paddingHorizontal: 16 },
  dropdownMenu: {
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 6,
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  dropdownItemAtivo: { backgroundColor: '#eef5fb' },
  dropdownItemText: { flex: 1, color: '#607d8b', fontWeight: '700', fontSize: 14 },
  dropdownItemTextAtivo: { color: '#1a3a5c' },
  cardAcordeaoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardAcordeaoIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pdfBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  pdfBtnTextSec: { color: '#1a3a5c', fontWeight: '900', fontSize: 14 },
  formativoHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eef5fb', alignItems: 'center', justifyContent: 'center' },
  filtroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filtroChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#f3f7fb', borderWidth: 1, borderColor: '#d7e5f3' },
  filtroChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  filtroChipText: { color: '#1a3a5c', fontSize: 12, fontWeight: '800' },
  filtroChipTextAtivo: { color: '#fff' },
  manualBox: { backgroundColor: '#f8fbff', borderWidth: 1, borderColor: '#d7e5f3', borderRadius: 14, padding: 12, marginBottom: 14 },
  manualHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  manualTitulo: { color: '#1a3a5c', fontSize: 14, fontWeight: '900' },
  manualSub: { color: '#667', fontSize: 11, marginTop: 2 },
  manualInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6e0ea', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#222', fontSize: 13, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  selectChip: { backgroundColor: '#eef5fb', borderWidth: 1, borderColor: '#cfe0ef', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  selectChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  selectChipText: { color: '#1a3a5c', fontSize: 11, fontWeight: '800' },
  selectChipTextAtivo: { color: '#fff' },
  manualResumoRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  manualResumo: { flex: 1, minWidth: 150, color: '#607d8b', fontSize: 12, fontWeight: '800' },
  manualLink: { color: '#1a3a5c', fontSize: 12, fontWeight: '900' },
  membrosManualLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  membroManualChip: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6e0ea', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 7 },
  membroManualChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  membroManualText: { color: '#455a64', fontSize: 11, fontWeight: '800', maxWidth: 260 },
  membroManualTextAtivo: { color: '#fff' },
  manualSalvarBtn: { backgroundColor: '#2e7d32', borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  manualSalvarBtnDisabled: { backgroundColor: '#b0bec5' },
  manualSalvarText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  formativoResumo: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  formativoResumoItem: { flex: 1, backgroundColor: '#f7fbff', borderRadius: 12, padding: 10, alignItems: 'center' },
  formativoResumoNum: { color: '#1a3a5c', fontSize: 20, fontWeight: '900' },
  formativoResumoLabel: { color: '#777', fontSize: 10, marginTop: 2 },
  formativoItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e8edf3' },
  formativoIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  formativoNome: { color: '#1f2933', fontSize: 14, fontWeight: '900' },
  formativoMeta: { color: '#677', fontSize: 11, marginTop: 2 },
  conquistaMembroBox: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e8edf3', paddingTop: 4, marginTop: 4 },
  conquistaSubtitulo: { fontSize: 10, fontWeight: '800', color: '#b45309', textTransform: 'uppercase', marginTop: 4, marginBottom: 2 },
  conquistaLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  conquistaLinhaTexto: { fontSize: 12, color: '#3e4c59', flex: 1 },
  formativoOrigem: { color: '#8a6d1d', fontSize: 11, marginTop: 2 },
  formativoRight: { alignItems: 'flex-end', gap: 7 },
  situacaoBadge: { overflow: 'hidden', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  situacaoPronto: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  situacaoPendente: { backgroundColor: '#fff3e0', color: '#ef6c00' },
  situacaoEntregue: { backgroundColor: '#e8f0fe', color: '#1a3a5c' },
  aprovarBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2e7d32', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  aprovarBtnText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  vazioCard: { color: '#999', textAlign: 'center', paddingVertical: 16, fontSize: 13 },
  resumo: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  resumoItem: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 1 },
  resumoNum: { color: '#1a3a5c', fontSize: 28, fontWeight: '900' },
  resumoLabel: { color: '#777', fontSize: 12, marginTop: 2 },
  grupoCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 14, overflow: 'hidden', elevation: 2 },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderLeftWidth: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  grupoTitulo: { flex: 1, color: '#222', fontSize: 17, fontWeight: '800' },
  countBadge: { minWidth: 34, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  countText: { fontWeight: '900' },
  membroRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  membroInfo: { flex: 1 },
  nome: { color: '#222', fontSize: 14, fontWeight: '800' },
  meta: { color: '#777', fontSize: 11, marginTop: 2 },
  idade: { color: '#1a3a5c', fontWeight: '800', fontSize: 12 },
  vazio: { textAlign: 'center', color: '#999', marginTop: 40 },
  faltasBox: { backgroundColor: '#fff8f8', borderWidth: 1, borderColor: '#ffc7c7', borderRadius: 14, padding: 12, marginTop: 8, gap: 6 },
  faltasLabel: { color: '#607d8b', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateInput: { borderWidth: 1, borderColor: '#d6e0ea', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#222', fontSize: 13, backgroundColor: '#fff' },
});

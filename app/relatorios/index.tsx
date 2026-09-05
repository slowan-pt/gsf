import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
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
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import {
  carregarClassesModelo,
  carregarEspecialidadesModelo,
  classesFallback,
  type ClasseModelo,
  type EspecialidadeModelo,
} from '../../src/lib/modelosPrograma';

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

type AbaRelatorio = 'documentos' | 'formacao' | 'diretorio' | 'ano_biblico' | 'conquistas';

const ABAS_RELATORIO: { id: AbaRelatorio; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'documentos', label: 'Documentos', icon: 'document-text' },
  { id: 'formacao',   label: 'Formação',   icon: 'ribbon' },
  { id: 'diretorio',  label: 'Diretório',  icon: 'people' },
  { id: 'ano_biblico', label: 'Ano Bíblico', icon: 'book' },
  { id: 'conquistas', label: 'Conquistas', icon: 'trophy' },
];

export default function RelatoriosScreen() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const { desbravadores, carregar } = useDBVStore();
  const [abaRelatorio, setAbaRelatorio] = useState<AbaRelatorio>('documentos');
  const [abaDropdownAberto, setAbaDropdownAberto] = useState(false);
  const [busca, setBusca] = useState('');
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
  const isAdmin = permissoes.pode('ver_relatorios');

  useFocusEffect(
    useCallback(() => {
      carregar();
      carregarVisaoFormativa();
      carregarLeiturasAnoBiblico();
      carregarModelosFormativos();
      carregarCatalogoClasses()
        .then((cat) => setClassesDisponiveis(classesDoCatalogo(cat)))
        .catch(() => setClassesDisponiveis([]));
    }, [])
  );

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
        Alert.alert('Relatório', 'Nenhum membro/classe encontrado para os filtros escolhidos.');
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
      Alert.alert('Erro', e?.message ?? 'Não foi possível gerar o relatório.');
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
      <View style={styles.container}>
        <View style={styles.semAcesso}>
          <Ionicons name="lock-closed" size={46} color="#bbb" />
          <Text style={styles.semAcessoText}>Relatórios disponíveis apenas para a diretoria.</Text>
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
        supabase.from('desbravadores').select('id,nome,unidade_nome').eq('clube_id', clubeId),
        supabase.from('investidura_itens').select('id,dbv_id,tipo,item_nome,marcado,entregue').eq('clube_id', clubeId),
        supabase.from('especialidades').select('id,dbv_id,nome,status').eq('clube_id', clubeId).eq('status', 'OK'),
        supabase.from('progresso_classes').select('*').eq('clube_id', clubeId),
        supabase.from('atividades').select('id,titulo,item_formativo_tipo,item_formativo_nome,gera_investidura').eq('clube_id', clubeId).eq('gera_investidura', true),
        supabase.from('atividades_respostas').select('id,atividade_id,dbv_id,status').eq('clube_id', clubeId),
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
      Alert.alert('Relatórios', 'Não foi possível carregar a visão de especialidades e classes.');
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

  async function carregarLeiturasAnoBiblico() {
    if (Platform.OS !== 'web') return;
    const periodo = calcularPeriodoAnoBiblico();
    if (!periodo) {
      if (periodoAnoBiblico === 'livre') {
        Alert.alert('Período inválido', 'Informe as datas de início e fim (dd/mm/aaaa).');
      }
      return;
    }
    setCarregandoAnoBiblico(true);
    try {
      const clubeId = getClubeAtivoId();
      const { data: membrosData } = await supabase.from('desbravadores').select('id,nome,unidade_nome,foto_url').eq('clube_id', clubeId);

      const membroMap = new Map<number, { nome: string; unidade_nome: string; foto_url?: string }>();
      for (const m of (membrosData ?? []) as any[]) {
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

      let query = supabase
        .from('ano_biblico_progresso')
        .select('dbv_id,lido_em')
        .eq('clube_id', clubeId)
        .eq('lido', true)
        .gte('lido_em', periodo.de)
        .lte('lido_em', periodo.ate);
      if (idsPermitidos) query = query.in('dbv_id', idsPermitidos);
      const { data: progressoData } = await query;

      const porMembro = new Map<number, { total: number; ultima: string | null }>();
      for (const p of (progressoData ?? []) as any[]) {
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
    } catch (e) {
      console.warn('Falha ao carregar leituras do Ano Bíblico', e);
    } finally {
      setCarregandoAnoBiblico(false);
    }
  }

  async function registrarEntregaFormativa(item: ItemFormativoRelatorio) {
    if (item.situacao !== 'pronto') return;
    const ok = Platform.OS === 'web'
      ? window.confirm(`Confirmar entrega de "${item.item_nome}" para ${item.membro_nome}?`)
      : true;
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
      Alert.alert('Erro', e?.message ?? 'Não foi possível registrar a entrega.');
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
      Alert.alert('Informe o item', 'Escolha uma especialidade ou classe.');
      return;
    }
    if (membrosManual.length === 0) {
      Alert.alert('Selecione membros', 'Escolha pelo menos um membro para vincular.');
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
      Alert.alert('Pronto', `${linhas.length} vínculo(s) criado(s) como item a receber.`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível vincular o item aos membros.');
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
        if (!faltasDe || !faltasAte) { Alert.alert('Período inválido', 'Informe início e fim.'); return; }
        const parseData = (s: string) => { const [d, m, a] = s.split('/'); return `${a}-${m}-${d}`; };
        const deIso = parseData(faltasDe); const ateIso = parseData(faltasAte);
        if (isNaN(new Date(deIso).getTime()) || isNaN(new Date(ateIso).getTime())) { Alert.alert('Data inválida', 'Use o formato dd/mm/aaaa.'); return; }
        deDate.setTime(new Date(deIso + 'T00:00:00').getTime());
        ateDate.setTime(new Date(ateIso + 'T23:59:59').getTime());
      }
      const deStr = deDate.toISOString().slice(0, 10);
      const ateStr = ateDate.toISOString().slice(0, 10);

      const { data: rows } = await supabase
        .from('pontuacoes').select('data,dbv_id,presenca')
        .eq('clube_id', clubeId).gte('data', deStr).lte('data', ateStr)
        .order('data', { ascending: true });

      if (!rows?.length) { Alert.alert('Sem dados', 'Sem registros no período.'); return; }

      const diasReuniao = new Set<string>();
      for (const p of rows as any[]) if (p.presenca) diasReuniao.add(p.data);
      const totalReunioes = diasReuniao.size;
      if (!totalReunioes) { Alert.alert('Sem reuniões', 'Nenhuma reunião com presença no período.'); return; }

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
      Alert.alert('Erro', e?.message ?? 'Não foi possível gerar o relatório.');
    } finally {
      setGerandoFaltas(false);
    }
  }

  async function gerarPDF(titulo: string, incluirDiretoria: boolean) {
    const membros = desbravadores.filter((m) => incluirDiretoria || normalizarGrupo(m) !== 'Diretoria');
    if (membros.length === 0) {
      Alert.alert('Relatório', 'Não há membros para gerar este relatório.');
      return;
    }
    const html = montarHTMLRelatorio(titulo, membros);
    await abrirPDF(titulo, html);
  }

  async function gerarPDFDocumentacao() {
    if (desbravadores.length === 0) {
      Alert.alert('Relatório', 'Não há membros para gerar este relatório.');
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
        Alert.alert('Relatório', 'Não foi possível abrir a janela de impressão.');
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
      Alert.alert('PDF gerado', uri);
    }
  }

  return (
    <View style={styles.container}>
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
        <TouchableOpacity style={styles.abaSelectBtn} onPress={() => setAbaDropdownAberto(true)}>
          <Ionicons
            name={ABAS_RELATORIO.find((a) => a.id === abaRelatorio)?.icon ?? 'document-text'}
            size={17}
            color="#1a3a5c"
          />
          <Text style={styles.abaSelectText}>
            {ABAS_RELATORIO.find((a) => a.id === abaRelatorio)?.label}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#1a3a5c" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={abaDropdownAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setAbaDropdownAberto(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setAbaDropdownAberto(false)}
        >
          <View style={styles.dropdownMenu}>
            {ABAS_RELATORIO.map((aba) => (
              <TouchableOpacity
                key={aba.id}
                style={[styles.dropdownItem, abaRelatorio === aba.id && styles.dropdownItemAtivo]}
                onPress={() => { setAbaRelatorio(aba.id); setAbaDropdownAberto(false); }}
              >
                <Ionicons name={aba.icon} size={17} color={abaRelatorio === aba.id ? '#1a3a5c' : '#607d8b'} />
                <Text style={[styles.dropdownItemText, abaRelatorio === aba.id && styles.dropdownItemTextAtivo]}>
                  {aba.label}
                </Text>
                {abaRelatorio === aba.id && <Ionicons name="checkmark" size={16} color="#1a3a5c" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {abaRelatorio === 'diretorio' && (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#90a4ae" />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por nome, unidade, cargo ou SGC..."
            placeholderTextColor="#999"
            style={styles.searchInput}
          />
        </View>
      )}

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 32 }}>
        {abaRelatorio === 'documentos' && (
        <>
        <View style={styles.prontosCard}>
          <Text style={styles.prontosTitulo}>Membros e documentação</Text>
          <Text style={styles.prontosSub}>Gere PDFs formatados com os dados atuais do clube.</Text>
          <TouchableOpacity style={styles.pdfBtn} onPress={() => gerarPDF('Membros do clube Geral', true)}>
            <Ionicons name="document-text" size={18} color="#fff" />
            <Text style={styles.pdfBtnText}>Membros do clube Geral</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pdfBtn, styles.pdfBtnSec]} onPress={() => gerarPDF('Membros do clube - sem diretoria', false)}>
            <Ionicons name="people" size={18} color="#1a3a5c" />
            <Text style={styles.pdfBtnTextSec}>Membros do clube - sem diretoria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pdfBtn, styles.pdfBtnSec, { marginBottom: 0 }]} onPress={gerarPDFDocumentacao}>
            <Ionicons name="folder-open" size={18} color="#1a3a5c" />
            <Text style={styles.pdfBtnTextSec}>Documentação entregue ou pendente</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.prontosCard}>
          <TouchableOpacity
            style={styles.cardAcordeaoHeader}
            onPress={() => setMostrarPickerFaltas((v) => !v)}
          >
            <View style={[styles.cardAcordeaoIcon, { backgroundColor: '#fdeaea' }]}>
              <Ionicons name="calendar" size={18} color="#c62828" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.prontosTitulo}>Relatório de Faltas</Text>
              <Text style={styles.prontosSub}>Presença por período, com % de faltas por membro.</Text>
            </View>
            <Ionicons name={mostrarPickerFaltas ? 'chevron-up' : 'chevron-down'} size={20} color="#c62828" />
          </TouchableOpacity>

          {mostrarPickerFaltas && (
            <View style={styles.faltasBox}>
              <Text style={styles.faltasLabel}>Período</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: '2m', label: '2 meses' },
                  { id: '6m', label: '6 meses' },
                  { id: '12m', label: '12 meses' },
                  { id: 'livre', label: 'Período livre' },
                ] as const).map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, periodoFaltas === op.id && styles.filtroChipAtivo]} onPress={() => setPeriodoFaltas(op.id)}>
                    <Text style={[styles.filtroChipText, periodoFaltas === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {periodoFaltas === 'livre' && (
                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.faltasLabel}>De</Text>
                    <TextInput style={styles.dateInput} value={faltasDe} onChangeText={(t) => { const d = t.replace(/\D/g, '').slice(0, 8); setFaltasDe(d.length > 4 ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d); }} placeholder="dd/mm/aaaa" placeholderTextColor="#aaa" keyboardType="numeric" maxLength={10} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.faltasLabel}>Até</Text>
                    <TextInput style={styles.dateInput} value={faltasAte} onChangeText={(t) => { const d = t.replace(/\D/g, '').slice(0, 8); setFaltasAte(d.length > 4 ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d); }} placeholder="dd/mm/aaaa" placeholderTextColor="#aaa" keyboardType="numeric" maxLength={10} />
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
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, filtroTipoMembro === op.id && styles.filtroChipAtivo]} onPress={() => { setFiltroTipoMembro(op.id); setFiltroUnidades([]); }}>
                    <Text style={[styles.filtroChipText, filtroTipoMembro === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
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
                          style={[styles.filtroChip, ativo && styles.filtroChipAtivo]}
                          onPress={() => { if (filtroTipoMembro !== 'diretoria') setFiltroUnidades((prev) => ativo ? prev.filter((x) => x !== u) : [...prev, u]); }}
                          disabled={filtroTipoMembro === 'diretoria'}
                        >
                          <Text style={[styles.filtroChipText, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
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
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, formatoExport === op.id && styles.filtroChipAtivo]} onPress={() => setFormatoExport(op.id)}>
                    <Text style={[styles.filtroChipText, formatoExport === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
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

        <View style={styles.prontosCard}>
          <TouchableOpacity
            style={styles.cardAcordeaoHeader}
            onPress={() => setMostrarPickerClasses((v) => !v)}
          >
            <View style={[styles.cardAcordeaoIcon, { backgroundColor: '#f3eeff' }]}>
              <Ionicons name="ribbon" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.prontosTitulo}>Requisitos de Classes</Text>
              <Text style={styles.prontosSub}>Progresso por classe, unidade ou membro específico.</Text>
            </View>
            <Ionicons name={mostrarPickerClasses ? 'chevron-up' : 'chevron-down'} size={20} color="#7c3aed" />
          </TouchableOpacity>

          {mostrarPickerClasses && (
            <View style={styles.faltasBox}>
              <Text style={styles.faltasLabel}>Abrangência</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: 'clube', label: 'Clube todo' },
                  { id: 'unidades', label: 'Por unidades' },
                  { id: 'membros', label: 'Membros específicos' },
                ] as const).map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.filtroChip, escopoClasses === op.id && styles.filtroChipAtivo]}
                    onPress={() => { setEscopoClasses(op.id); setUnidadesClasses([]); setMembrosClasses([]); }}
                  >
                    <Text style={[styles.filtroChipText, escopoClasses === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {escopoClasses === 'unidades' && (
                <>
                  <Text style={styles.faltasLabel}>Selecione as unidades</Text>
                  <View style={styles.filtroRow}>
                    {unidadesDisponiveis.map((u) => {
                      const ativo = unidadesClasses.includes(u);
                      return (
                        <TouchableOpacity
                          key={u}
                          style={[styles.filtroChip, ativo && styles.filtroChipAtivo]}
                          onPress={() => setUnidadesClasses((p) => (ativo ? p.filter((x) => x !== u) : [...p, u]))}
                        >
                          <Text style={[styles.filtroChipText, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {escopoClasses === 'membros' && (
                <>
                  <Text style={styles.faltasLabel}>Selecione os membros ({membrosClasses.length})</Text>
                  <TextInput
                    style={styles.dateInput}
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
                            style={[styles.filtroChip, ativo && styles.filtroChipAtivo]}
                            onPress={() => setMembrosClasses((p) => (ativo ? p.filter((x) => x !== d.id) : [...p, d.id]))}
                          >
                            <Text style={[styles.filtroChipText, ativo && styles.filtroChipTextAtivo]}>{d.nome}</Text>
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
                          style={[styles.filtroChip, ativo && styles.filtroChipAtivo]}
                          onPress={() => setClassesSelecionadas((p) => (ativo ? p.filter((x) => x !== c) : [...p, c]))}
                        >
                          <Text style={[styles.filtroChipText, ativo && styles.filtroChipTextAtivo]}>{c}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Detalhamento e formato</Text>
              <View style={styles.filtroRow}>
                <TouchableOpacity
                  style={[styles.filtroChip, detalharClasses && styles.filtroChipAtivo]}
                  onPress={() => setDetalharClasses((v) => !v)}
                >
                  <Text style={[styles.filtroChipText, detalharClasses && styles.filtroChipTextAtivo]}>
                    {detalharClasses ? '✓ ' : ''}Listar requisitos
                  </Text>
                </TouchableOpacity>
                {([
                  { id: 'pdf', label: '🖨️ PDF / Imprimir' },
                  { id: 'excel', label: '📊 Excel (.xlsx)' },
                ] as const).map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.filtroChip, formatoClasses === op.id && styles.filtroChipAtivo]}
                    onPress={() => setFormatoClasses(op.id)}
                  >
                    <Text style={[styles.filtroChipText, formatoClasses === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
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
        <View style={styles.prontosCard}>
          <View style={styles.formativoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prontosTitulo}>Especialidades e Classes</Text>
              <Text style={styles.prontosSub}>
                Visão geral do clube, pendências de aprovação e itens prontos para receber.
              </Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={carregarVisaoFormativa}>
              <Ionicons name="refresh" size={18} color="#1a3a5c" />
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
                style={[styles.filtroChip, filtroFormativo === f.id && styles.filtroChipAtivo]}
                onPress={() => setFiltroFormativo(f.id)}
              >
                <Text style={[styles.filtroChipText, filtroFormativo === f.id && styles.filtroChipTextAtivo]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.manualBox}>
            <View style={styles.manualHeader}>
              <Ionicons name="add-circle" size={18} color="#1a3a5c" />
              <View style={{ flex: 1 }}>
                <Text style={styles.manualTitulo}>Adicionar manualmente a receber</Text>
                <Text style={styles.manualSub}>
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
                  style={[styles.filtroChip, tipoManual === op.id && styles.filtroChipAtivo]}
                  onPress={() => {
                    setTipoManual(op.id);
                    setItemManual('');
                    setBuscaItemManual('');
                  }}
                >
                  <Text style={[styles.filtroChipText, tipoManual === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
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
              style={styles.manualInput}
            />
            {buscaItemManual.trim().length > 0 || itemManual ? (
              <View style={styles.chipWrap}>
                {opcoesItensManual.map((nome) => (
                  <TouchableOpacity
                    key={nome}
                    style={[styles.selectChip, itemManual === nome && styles.selectChipAtivo]}
                    onPress={() => {
                      setItemManual(nome);
                      setBuscaItemManual(nome);
                    }}
                  >
                    <Text style={[styles.selectChipText, itemManual === nome && styles.selectChipTextAtivo]}>{nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <TextInput
              value={buscaMembroManual}
              onChangeText={setBuscaMembroManual}
              placeholder="Buscar membros por nome ou unidade..."
              placeholderTextColor="#90a4ae"
              style={styles.manualInput}
            />
            <View style={styles.manualResumoRow}>
              <Text style={styles.manualResumo}>{membrosManual.length} membro(s) selecionado(s)</Text>
              <TouchableOpacity onPress={() => setMembrosManual(desbravadores.map((m) => m.id))}>
                <Text style={styles.manualLink}>Selecionar todos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMembrosManual([])}>
                <Text style={styles.manualLink}>Limpar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.membrosManualLista}>
              {membrosManualVisiveis.map((m) => {
                const ativo = membrosManual.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.membroManualChip, ativo && styles.membroManualChipAtivo]}
                    onPress={() => alternarMembroManual(m.id)}
                  >
                    <Ionicons name={ativo ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={ativo ? '#fff' : '#607d8b'} />
                    <Text style={[styles.membroManualText, ativo && styles.membroManualTextAtivo]} numberOfLines={1}>
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
            <Text style={styles.vazioCard}>Carregando visão geral...</Text>
          ) : (
            <>
              <View style={styles.formativoResumo}>
                <View style={styles.formativoResumoItem}>
                  <Text style={styles.formativoResumoNum}>{itensFormativos.filter(i => i.situacao === 'pronto').length}</Text>
                  <Text style={styles.formativoResumoLabel}>prontos</Text>
                </View>
                <View style={styles.formativoResumoItem}>
                  <Text style={styles.formativoResumoNum}>{itensFormativos.filter(i => i.situacao === 'pendente_aprovacao').length}</Text>
                  <Text style={styles.formativoResumoLabel}>a aprovar</Text>
                </View>
                <View style={styles.formativoResumoItem}>
                  <Text style={styles.formativoResumoNum}>{itensFormativos.filter(i => i.situacao === 'entregue').length}</Text>
                  <Text style={styles.formativoResumoLabel}>entregues</Text>
                </View>
              </View>

              {itensFormativos
                .filter((i) => filtroFormativo === 'todos' || i.situacao === filtroFormativo)
                .slice(0, 80)
                .map((item) => (
                  <View key={item.id} style={styles.formativoItem}>
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
                      <Text style={styles.formativoNome}>{item.item_nome}</Text>
                      <Text style={styles.formativoMeta}>
                        {item.membro_nome} · {item.unidade_nome}
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
                <Text style={styles.vazioCard}>Nenhum item encontrado nesta situação.</Text>
              )}
            </>
          )}
        </View>
        )}

        {abaRelatorio === 'ano_biblico' && (
        <View style={styles.prontosCard}>
          <View style={styles.formativoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prontosTitulo}>Ano Bíblico</Text>
              <Text style={styles.prontosSub}>
                Capítulos que cada desbravador/responsável abriu e rolou até o fim — {calcularPeriodoAnoBiblico()?.label ?? 'período inválido'}.
              </Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={carregarLeiturasAnoBiblico}>
              <Ionicons name="refresh" size={18} color="#1a3a5c" />
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
              <Text style={styles.prontosTitulo}>Filtros</Text>
              <Text style={styles.prontosSub}>Período, unidade, diretoria ou membros específicos.</Text>
            </View>
            <Ionicons name={mostrarFiltrosAnoBiblico ? 'chevron-up' : 'chevron-down'} size={20} color="#5e35b1" />
          </TouchableOpacity>

          {mostrarFiltrosAnoBiblico && (
            <View style={styles.faltasBox}>
              <Text style={styles.faltasLabel}>Período</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: 'ano', label: 'Ano atual' },
                  { id: 'mes', label: 'Por mês' },
                  { id: 'trimestre', label: 'Por trimestre' },
                  { id: 'semestre', label: 'Por semestre' },
                  { id: 'livre', label: 'Data x até data y' },
                ] as const).map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, periodoAnoBiblico === op.id && styles.filtroChipAtivo]} onPress={() => setPeriodoAnoBiblico(op.id)}>
                    <Text style={[styles.filtroChipText, periodoAnoBiblico === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {periodoAnoBiblico === 'mes' && (
                <View style={[styles.filtroRow, { marginTop: 8 }]}>
                  {MESES_NOME.map((nome, idx) => (
                    <TouchableOpacity key={nome} style={[styles.filtroChip, mesAnoBiblico === idx + 1 && styles.filtroChipAtivo]} onPress={() => setMesAnoBiblico(idx + 1)}>
                      <Text style={[styles.filtroChipText, mesAnoBiblico === idx + 1 && styles.filtroChipTextAtivo]}>{nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {periodoAnoBiblico === 'trimestre' && (
                <View style={[styles.filtroRow, { marginTop: 8 }]}>
                  {[1, 2, 3, 4].map((t) => (
                    <TouchableOpacity key={t} style={[styles.filtroChip, trimestreAnoBiblico === t && styles.filtroChipAtivo]} onPress={() => setTrimestreAnoBiblico(t)}>
                      <Text style={[styles.filtroChipText, trimestreAnoBiblico === t && styles.filtroChipTextAtivo]}>{t}º trimestre</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {periodoAnoBiblico === 'semestre' && (
                <View style={[styles.filtroRow, { marginTop: 8 }]}>
                  {[1, 2].map((s) => (
                    <TouchableOpacity key={s} style={[styles.filtroChip, semestreAnoBiblico === s && styles.filtroChipAtivo]} onPress={() => setSemestreAnoBiblico(s)}>
                      <Text style={[styles.filtroChipText, semestreAnoBiblico === s && styles.filtroChipTextAtivo]}>{s}º semestre</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {periodoAnoBiblico === 'livre' && (
                <View style={styles.dateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.faltasLabel}>De</Text>
                    <TextInput style={styles.dateInput} value={anoBiblicoDe} onChangeText={(t) => { const d = t.replace(/\D/g, '').slice(0, 8); setAnoBiblicoDe(d.length > 4 ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d); }} placeholder="dd/mm/aaaa" placeholderTextColor="#aaa" keyboardType="numeric" maxLength={10} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.faltasLabel}>Até</Text>
                    <TextInput style={styles.dateInput} value={anoBiblicoAte} onChangeText={(t) => { const d = t.replace(/\D/g, '').slice(0, 8); setAnoBiblicoAte(d.length > 4 ? `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d); }} placeholder="dd/mm/aaaa" placeholderTextColor="#aaa" keyboardType="numeric" maxLength={10} />
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
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, filtroTipoMembroAnoBiblico === op.id && styles.filtroChipAtivo]} onPress={() => { setFiltroTipoMembroAnoBiblico(op.id); setFiltroUnidadesAnoBiblico([]); setMembrosAnoBiblico([]); }}>
                    <Text style={[styles.filtroChipText, filtroTipoMembroAnoBiblico === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
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
                          style={[styles.filtroChip, ativo && styles.filtroChipAtivo]}
                          onPress={() => { if (filtroTipoMembroAnoBiblico !== 'diretoria') { setMembrosAnoBiblico([]); setFiltroUnidadesAnoBiblico((prev) => ativo ? prev.filter((x) => x !== u) : [...prev, u]); } }}
                          disabled={filtroTipoMembroAnoBiblico === 'diretoria'}
                        >
                          <Text style={[styles.filtroChipText, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Ou desbravador(es) específico(s) ({membrosAnoBiblico.length})</Text>
              <TextInput
                style={styles.dateInput}
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
                        style={[styles.filtroChip, ativo && styles.filtroChipAtivo]}
                        onPress={() => setMembrosAnoBiblico((p) => (ativo ? p.filter((x) => x !== d.id) : [...p, d.id]))}
                      >
                        <Text style={[styles.filtroChipText, ativo && styles.filtroChipTextAtivo]}>{d.nome}</Text>
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

          {carregandoAnoBiblico && <Text style={styles.vazioCard}>Carregando…</Text>}

          {!carregandoAnoBiblico && leiturasAnoBiblico.length === 0 && (
            <Text style={styles.vazioCard}>Ninguém marcou nenhum capítulo como lido nesse período.</Text>
          )}

          {!carregandoAnoBiblico && leiturasAnoBiblico.map((item) => (
            <View key={item.dbv_id} style={styles.formativoItem}>
              <Avatar nome={item.membro_nome} foto_url={item.foto_url} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.formativoNome}>{item.membro_nome}</Text>
                <Text style={styles.formativoMeta}>
                  {item.unidade_nome}{item.ultimaLeitura ? ` · última leitura em ${new Date(item.ultimaLeitura).toLocaleDateString('pt-BR')}` : ''}
                </Text>
              </View>
              <View style={styles.filtroChip}>
                <Text style={styles.filtroChipText}>{item.totalLidos} capítulo{item.totalLidos === 1 ? '' : 's'}</Text>
              </View>
            </View>
          ))}
        </View>
        )}

        {abaRelatorio === 'conquistas' && (
        <View style={styles.prontosCard}>
          <View style={styles.formativoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prontosTitulo}>Quadro de conquistas</Text>
              <Text style={styles.prontosSub}>
                Classes e especialidades concluídas e em andamento, por membro/unidade.
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.cardAcordeaoHeader} onPress={() => setMostrarFiltrosConquistas((v) => !v)}>
            <View style={[styles.cardAcordeaoIcon, { backgroundColor: '#fff7e6' }]}>
              <Ionicons name="filter" size={18} color="#f9a825" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.prontosTitulo}>Filtros</Text>
              <Text style={styles.prontosSub}>Unidade, diretoria ou membros específicos.</Text>
            </View>
            <Ionicons name={mostrarFiltrosConquistas ? 'chevron-up' : 'chevron-down'} size={20} color="#f9a825" />
          </TouchableOpacity>

          {mostrarFiltrosConquistas && (
            <View style={styles.faltasBox}>
              <Text style={styles.faltasLabel}>Membros</Text>
              <View style={styles.filtroRow}>
                {([
                  { id: 'todos', label: 'Todos' },
                  { id: 'desbravadores', label: 'Desbravadores' },
                  { id: 'diretoria', label: 'Diretoria' },
                ] as const).map((op) => (
                  <TouchableOpacity key={op.id} style={[styles.filtroChip, filtroTipoMembroConquistas === op.id && styles.filtroChipAtivo]} onPress={() => { setFiltroTipoMembroConquistas(op.id); setFiltroUnidadesConquistas([]); setMembrosConquistas([]); }}>
                    <Text style={[styles.filtroChipText, filtroTipoMembroConquistas === op.id && styles.filtroChipTextAtivo]}>{op.label}</Text>
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
                          style={[styles.filtroChip, ativo && styles.filtroChipAtivo]}
                          onPress={() => { if (filtroTipoMembroConquistas !== 'diretoria') { setMembrosConquistas([]); setFiltroUnidadesConquistas((prev) => ativo ? prev.filter((x) => x !== u) : [...prev, u]); } }}
                          disabled={filtroTipoMembroConquistas === 'diretoria'}
                        >
                          <Text style={[styles.filtroChipText, ativo && styles.filtroChipTextAtivo]}>{u}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={[styles.faltasLabel, { marginTop: 10 }]}>Ou membro(s) específico(s) ({membrosConquistas.length})</Text>
              <TextInput
                style={styles.dateInput}
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
                        style={[styles.filtroChip, ativo && styles.filtroChipAtivo]}
                        onPress={() => setMembrosConquistas((p) => (ativo ? p.filter((x) => x !== d.id) : [...p, d.id]))}
                      >
                        <Text style={[styles.filtroChipText, ativo && styles.filtroChipTextAtivo]}>{d.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>
          )}

          {carregandoFormativos && <Text style={styles.vazioCard}>Carregando…</Text>}
          {!carregandoFormativos && conquistasPorMembro.length === 0 && (
            <Text style={styles.vazioCard}>Nenhum membro com conquistas para esse filtro.</Text>
          )}

          {!carregandoFormativos && conquistasPorMembro.map(({ membro, concluidas, emAndamento }) => (
            <View key={membro.id} style={styles.conquistaMembroBox}>
              <View style={styles.formativoItem}>
                <Avatar nome={membro.nome} foto_url={membro.foto_url ?? undefined} cor={avatarCor(membro.nome)} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.formativoNome}>{membro.nome}</Text>
                  <Text style={styles.formativoMeta}>{normalizarGrupo(membro)}</Text>
                </View>
                <View style={styles.filtroChip}>
                  <Text style={styles.filtroChipText}>{concluidas.length} concluída{concluidas.length === 1 ? '' : 's'}</Text>
                </View>
              </View>
              {concluidas.length > 0 && (
                <View style={{ marginLeft: 44, marginBottom: 6 }}>
                  {concluidas.map((item) => (
                    <View key={item.id} style={styles.conquistaLinha}>
                      <Ionicons name={item.tipo === 'classe' ? 'school' : 'star'} size={13} color="#2e7d32" />
                      <Text style={styles.conquistaLinhaTexto}>{item.item_nome}</Text>
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
                      <Text style={styles.conquistaLinhaTexto}>
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

        {abaRelatorio === 'diretorio' && (
        <>
        <View style={styles.resumo}>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoNum}>{desbravadores.length}</Text>
            <Text style={styles.resumoLabel}>membros</Text>
          </View>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoNum}>{grupos.length}</Text>
            <Text style={styles.resumoLabel}>grupos</Text>
          </View>
        </View>

        {grupos.map((grupo) => {
          const cor = CORES[grupo.nome] ?? '#1a3a5c';
          return (
            <View key={grupo.nome} style={styles.grupoCard}>
              <View style={[styles.grupoHeader, { borderLeftColor: cor }]}>
                <View style={[styles.dot, { backgroundColor: cor }]} />
                <Text style={styles.grupoTitulo}>{grupo.nome}</Text>
                <View style={[styles.countBadge, { backgroundColor: `${cor}22` }]}>
                  <Text style={[styles.countText, { color: cor }]}>{grupo.membros.length}</Text>
                </View>
              </View>

              {grupo.membros.map((membro) => (
                <View key={membro.id} style={styles.membroRow}>
                  <Avatar nome={membro.nome} foto_url={membro.foto_url} cor={cor} size={40} />
                  <View style={styles.membroInfo}>
                    <Text style={styles.nome}>{membro.nome}</Text>
                    <Text style={styles.meta}>
                      {membro.cargo || 'Sem cargo'}
                      {membro.id_sgc ? ` · SGC ${membro.id_sgc}` : ''}
                    </Text>
                    <Text style={styles.meta}>
                      {membro.email || 'sem e-mail'} {membro.contato ? `· ${membro.contato}` : ''}
                    </Text>
                  </View>
                  {membro.idade ? <Text style={styles.idade}>{membro.idade}a</Text> : null}
                </View>
              ))}
            </View>
          );
        })}

        {grupos.length === 0 && (
          <Text style={styles.vazio}>Nenhum membro encontrado para este filtro.</Text>
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

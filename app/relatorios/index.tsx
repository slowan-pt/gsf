import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Platform, View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
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
import type { Desbravador, Documento } from '../../src/types';

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

const CORES: Record<string, string> = {
  'Amor Perfeito': '#e91e63',
  'Sempre Viva': '#4caf50',
  'Águia Dourada': '#ff9800',
  'Leões': '#2196f3',
  'Diretoria': '#9c27b0',
  'Sem Unidade': '#90a4ae',
};

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

export default function RelatoriosScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const { desbravadores, carregar } = useDBVStore();
  const [busca, setBusca] = useState('');
  const [itensFormativos, setItensFormativos] = useState<ItemFormativoRelatorio[]>([]);
  const [filtroFormativo, setFiltroFormativo] = useState<'todos' | SituacaoFormativa>('pronto');
  const [carregandoFormativos, setCarregandoFormativos] = useState(false);
  const listaRef = useRef<ScrollView>(null);
  const formativosY = useRef(0);
  const isAdmin = permissoes.pode('ver_relatorios');

  useFocusEffect(
    useCallback(() => {
      carregar();
      carregarVisaoFormativa();
    }, [])
  );

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = desbravadores
      .filter((m) => {
        if (!termo) return true;
        return (
          m.nome.toLowerCase().includes(termo) ||
          String(m.unidade_nome ?? '').toLowerCase().includes(termo) ||
          String(m.cargo ?? '').toLowerCase().includes(termo) ||
          String(m.id_sgc ?? '').toLowerCase().includes(termo)
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>📊 Relatórios</Text>
          <Text style={styles.subtitulo}>Dados dos membros agrupados por unidade</Text>
        </View>
      </View>

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

      <ScrollView ref={listaRef} style={styles.lista} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.prontosCard}>
          <Text style={styles.prontosTitulo}>Relatórios prontos</Text>
          <Text style={styles.prontosSub}>Gere PDFs formatados com os dados atuais do clube.</Text>
          <TouchableOpacity
            style={[styles.pdfBtn, styles.formativosDestaque]}
            onPress={() => listaRef.current?.scrollTo({ y: Math.max(formativosY.current - 8, 0), animated: true })}
          >
            <Ionicons name="ribbon" size={18} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pdfBtnText}>Visão geral de Especialidades e Classes</Text>
              <Text style={styles.formativosDestaqueSub}>Aprovar recebimentos e acompanhar situações</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pdfBtn} onPress={() => gerarPDF('Membros do clube Geral', true)}>
            <Ionicons name="document-text" size={18} color="#fff" />
            <Text style={styles.pdfBtnText}>Membros do clube Geral</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pdfBtn, styles.pdfBtnSec]} onPress={() => gerarPDF('Membros do clube - sem diretoria', false)}>
            <Ionicons name="people" size={18} color="#1a3a5c" />
            <Text style={styles.pdfBtnTextSec}>Membros do clube - sem diretoria</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pdfBtn, styles.pdfBtnSec]} onPress={gerarPDFDocumentacao}>
            <Ionicons name="folder-open" size={18} color="#1a3a5c" />
            <Text style={styles.pdfBtnTextSec}>Documentação entregue ou pendente</Text>
          </TouchableOpacity>
        </View>

        <View
          style={styles.prontosCard}
          onLayout={(event) => { formativosY.current = event.nativeEvent.layout.y; }}
        >
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
                  <View style={[styles.avatar, { backgroundColor: cor }]}>
                    <Text style={styles.avatarText}>{membro.nome[0]}</Text>
                  </View>
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
  formativosDestaque: { backgroundColor: '#2e7d32', justifyContent: 'flex-start', paddingVertical: 14 },
  formativosDestaqueSub: { color: '#d9f2dd', fontSize: 11, fontWeight: '600', marginTop: 2 },
  pdfBtnSec: { backgroundColor: '#eef5fb', borderWidth: 1, borderColor: '#cfe0ef', marginBottom: 0 },
  pdfBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  pdfBtnTextSec: { color: '#1a3a5c', fontWeight: '900', fontSize: 14 },
  formativoHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eef5fb', alignItems: 'center', justifyContent: 'center' },
  filtroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filtroChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: '#f3f7fb', borderWidth: 1, borderColor: '#d7e5f3' },
  filtroChipAtivo: { backgroundColor: '#1a3a5c', borderColor: '#1a3a5c' },
  filtroChipText: { color: '#1a3a5c', fontSize: 12, fontWeight: '800' },
  filtroChipTextAtivo: { color: '#fff' },
  formativoResumo: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  formativoResumoItem: { flex: 1, backgroundColor: '#f7fbff', borderRadius: 12, padding: 10, alignItems: 'center' },
  formativoResumoNum: { color: '#1a3a5c', fontSize: 20, fontWeight: '900' },
  formativoResumoLabel: { color: '#777', fontSize: 10, marginTop: 2 },
  formativoItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e8edf3' },
  formativoIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  formativoNome: { color: '#1f2933', fontSize: 14, fontWeight: '900' },
  formativoMeta: { color: '#677', fontSize: 11, marginTop: 2 },
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
});

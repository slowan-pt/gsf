import { useCallback, useMemo, useState } from 'react';
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
import type { Desbravador, Documento } from '../../src/types';

const CORES: Record<string, string> = {
  'Amor Perfeito': '#e91e63',
  'Sempre Viva': '#4caf50',
  'Águia Dourada': '#ff9800',
  'Leões': '#2196f3',
  'Diretoria': '#9c27b0',
  'Sem Unidade': '#90a4ae',
};

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

function montarHTMLDocumentacao(titulo: string, membros: Desbravador[], docs: Documento[]) {
  const porDbv = new Map(docs.map((d) => [d.dbv_id, d]));
  const docKeys = Object.keys(DOCS_LABELS);
  const linhas = membros
    .sort((a, b) =>
      normalizarGrupo(a).localeCompare(normalizarGrupo(b), 'pt-BR') ||
      a.nome.localeCompare(b.nome, 'pt-BR')
    )
    .map((m) => {
      const doc = porDbv.get(m.id);
      const entregues = doc ? docKeys.filter((k) => (doc as any)[k] === 'OK' || (doc as any)[k] === 'NA') : [];
      const pendentes = docKeys.filter((k) => !doc || ((doc as any)[k] !== 'OK' && (doc as any)[k] !== 'NA'));
      return `
        <tr>
          <td>${escapeHTML(m.nome)}</td>
          <td>${escapeHTML(normalizarGrupo(m))}</td>
          <td>${escapeHTML(m.cargo)}</td>
          <td>${entregues.length}/${docKeys.length}</td>
          <td>${escapeHTML(pendentes.map((k) => DOCS_LABELS[k]).join(', ') || 'Nenhum')}</td>
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
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #1a3a5c; color: white; text-align: left; padding: 7px 6px; }
        td { border: 1px solid #d8dee6; padding: 6px; vertical-align: top; }
        tr:nth-child(even) td { background: #f5f8fb; }
      </style>
    </head>
    <body>
      <h1>${escapeHTML(titulo)}</h1>
      <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · ${membros.length} membro(s)</div>
      <table>
        <thead>
          <tr><th>Nome</th><th>Unidade</th><th>Cargo</th><th>Entregues</th><th>Documentos pendentes</th></tr>
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
  const isAdmin = permissoes.pode('ver_relatorios');

  useFocusEffect(
    useCallback(() => {
      carregar();
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
      <View style={styles.semAcesso}>
        <Ionicons name="lock-closed" size={46} color="#bbb" />
        <Text style={styles.semAcessoText}>Relatórios disponíveis apenas para a diretoria.</Text>
      </View>
    );
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
    if (Platform.OS === 'web') {
      const { data } = await supabase.from('documentos').select('*').eq('clube_id', getClubeAtivoId());
      docs = (data ?? []) as Documento[];
    } else {
      const db = await getDB();
      docs = await db.getAllAsync<Documento>('SELECT * FROM documentos');
    }

    const titulo = 'Documentação entregue ou pendente';
    await abrirPDF(titulo, montarHTMLDocumentacao(titulo, desbravadores, docs));
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

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.prontosCard}>
          <Text style={styles.prontosTitulo}>Relatórios prontos</Text>
          <Text style={styles.prontosSub}>Gere PDFs formatados com os dados atuais do clube.</Text>
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
  pdfBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  pdfBtnTextSec: { color: '#1a3a5c', fontWeight: '900', fontSize: 14 },
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

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Pressable, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useDBVStore } from '../../src/stores/dbvStore';
import { useAuthStore } from '../../src/stores/authStore';
import { getDB } from '../../src/lib/database';
import { puxarDeSupabase } from '../../src/lib/sync';
import { popularBancoDeDados } from '../../src/lib/seed_local';
import { supabase } from '../../src/lib/supabase';
import { getClubeAtivoId, getProgramaAtivoId } from '../../src/lib/contextoAtual';
import { useContextoStore } from '../../src/stores/contextoStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { CLASSES_DBV_FALLBACK, CLASSES_AVT_FALLBACK } from '../../src/lib/modelosPrograma';
import type { Desbravador } from '../../src/types';

/* ─── Tipos ─────────────────────────────────────────────────────── */
interface Unidade {
  id: number;
  nome: string;
  cor: string;
  codigo_clube?: number;
}

const CORES_PRESET = [
  '#e91e63','#f44336','#ff9800','#ffc107',
  '#4caf50','#009688','#2196f3','#3f51b5',
  '#9c27b0','#607d8b','#795548','#1a3a5c',
];

const SEM_UNIDADE: Unidade = { id: -1, nome: 'Sem Unidade', cor: '#90a4ae' };
const DIRETORIA: Unidade   = { id: 0, nome: 'Diretoria', cor: '#9c27b0' };

function normalizarTexto(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Unidade é texto livre por clube — nada no banco impede alguém de nomear
 * uma unidade de Desbravadores com nome de classe de Aventureiros (ou o
 * contrário), como aconteceu com uma unidade "Abelhinhas" num clube DBV.
 * Bloqueia aqui na criação/edição pra não repetir.
 */
function nomeDeClasseDoOutroPrograma(nome: string): string | null {
  const alvo = normalizarTexto(nome);
  if (alvo.length < 4) return null;
  const outroPrograma = getProgramaAtivoId() === 2 ? CLASSES_DBV_FALLBACK : CLASSES_AVT_FALLBACK;
  const achada = outroPrograma.find((c) => {
    const classeNome = normalizarTexto(c.nome);
    return alvo === classeNome || classeNome.startsWith(alvo) || alvo.startsWith(classeNome);
  });
  return achada?.nome ?? null;
}

const UNIDADES_PADRAO: Unidade[] = [
  { id: 1, nome: 'Amor Perfeito', cor: '#e91e63' },
  { id: 2, nome: 'Sempre Viva', cor: '#4caf50' },
  { id: 3, nome: 'Águia Dourada', cor: '#ff9800' },
  { id: 4, nome: 'Leões', cor: '#2196f3' },
];

function corDaUnidade(nome?: string | null, unidades?: Unidade[]) {
  if (!nome) return SEM_UNIDADE.cor;
  if (nome === 'Diretoria') return DIRETORIA.cor;
  return unidades?.find((u) => u.nome === nome)?.cor ?? SEM_UNIDADE.cor;
}

function cargoPorExtenso(cargo?: string | null, genero?: string | null) {
  const original = String(cargo ?? '').trim();
  const c = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fem = genero === 'F';
  if (!c) return '';
  if (['dbv', 'desbravador', 'desbravadora'].includes(c)) return fem ? 'Desbravadora' : 'Desbravador';
  if (['avt', 'aventureiro', 'aventureira'].includes(c)) return fem ? 'Aventureira' : 'Aventureiro';
  if (['dir', 'diretor', 'diretora', 'diretoria'].includes(c)) return fem ? 'Diretora' : 'Diretor';
  if (['das', 'diretor associado', 'diretora associada'].includes(c)) return fem ? 'Diretora Associada' : 'Diretor Associado';
  if (['con', 'cons', 'conselheiro', 'conselheira'].includes(c)) return fem ? 'Conselheira' : 'Conselheiro';
  if (['sec', 'secretario', 'secretaria', 'secretaria do clube'].includes(c)) return fem ? 'Secretária do Clube' : 'Secretário do Clube';
  if (['sun', 'secretario de unidade', 'secretaria de unidade', 'secretaria da unidade'].includes(c)) return fem ? 'Secretária da Unidade' : 'Secretário da Unidade';
  if (['tes', 'tesoureiro', 'tesoureira', 'tesouraria'].includes(c)) return fem ? 'Tesoureira' : 'Tesoureiro';
  if (['cap', 'capelao', 'capela', 'capelania'].includes(c)) return fem ? 'Capelã' : 'Capelão';
  if (['cpt', 'capitao', 'capita', 'capitao de unidade', 'capita de unidade'].includes(c)) return fem ? 'Capitã de Unidade' : 'Capitão de Unidade';
  if (['ins', 'instrutor', 'instrutora'].includes(c)) return fem ? 'Instrutora' : 'Instrutor';
  if (['icl', 'instrutor de classes', 'instrutora de classes'].includes(c)) return fem ? 'Instrutora de Classes' : 'Instrutor de Classes';
  if (['ies', 'instrutor de especialidades', 'instrutora de especialidades'].includes(c)) return fem ? 'Instrutora de Especialidades' : 'Instrutor de Especialidades';
  if (['mid', 'comunicacao'].includes(c)) return 'Comunicação';
  return original;
}

function tipoDestaqueCargo(cargo?: string | null) {
  const c = String(cargo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (c.includes('conselh') || c === 'con' || c === 'cons') return 'conselheiro';
  if (c.includes('capitao') || c.includes('capita') || c === 'cpt') return 'capitao';
  if ((c.includes('secretari') && c.includes('unidade')) || c === 'sun') return 'secretario_unidade';
  return null;
}

function ehFuncaoJuvenil(cargo?: string | null) {
  const tipo = tipoDestaqueCargo(cargo);
  return tipo === 'capitao' || tipo === 'secretario_unidade';
}

function estiloCargo(cargo?: string | null, corPadrao = '#1a3a5c') {
  const tipo = tipoDestaqueCargo(cargo);
  // Funcoes de unidade usam uma paleta fixa, independente da cor da unidade.
  if (tipo === 'conselheiro') return { backgroundColor: '#ede7f6', color: '#5e35b1' };
  if (tipo === 'capitao') return { backgroundColor: '#eceff1', color: '#37474f' };
  if (tipo === 'secretario_unidade') return { backgroundColor: '#e0f2f1', color: '#00695c' };
  return { backgroundColor: corPadrao + '22', color: corPadrao };
}

/* ─── Componente principal ──────────────────────────────────────── */
export default function UnidadesScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const contextoAtivo = useContextoStore((s) => s.contextoAtivo);
  const permissoes = usePermissoes();
  const { desbravadores, carregar, moverParaUnidade } = useDBVStore();

  const [unidades, setUnidades]   = useState<Unidade[]>([]);
  const [busca, setBusca]         = useState('');
  const [abertos, setAbertos]     = useState<Set<string>>(new Set());
  const [alvo, setAlvo]           = useState<Desbravador | null>(null);
  const [movendo, setMovendo]     = useState(false);

  // CRUD modal
  const [crudModal, setCrudModal]   = useState(false);
  const [editando, setEditando]     = useState<Unidade | null>(null);
  const [formNome, setFormNome]     = useState('');
  const [formCor, setFormCor]       = useState(CORES_PRESET[6]);
  const [salvandoCrud, setSalvandoCrud] = useState(false);

  const isAdmin = permissoes.pode('gerenciar_unidades');

  useFocusEffect(useCallback(() => {
    let ativo = true;
    async function init() {
      await carregarUnidades();
      if (ativo) await carregar();
    }
    init();
    return () => { ativo = false; };
  }, []));

async function carregarUnidades() {
    if (Platform.OS === 'web') {
      const { data } = await supabase
        .from('unidades')
        .select('id, nome, cor, codigo_clube')
        .eq('clube_id', getClubeAtivoId())
        .order('nome');
      const listaWeb = (data && data.length > 0 ? data : UNIDADES_PADRAO) as Unidade[];
      setUnidades(listaWeb);
      setAbertos(new Set());
      return;
    }

    const db = await getDB();
    const clubeAtivoId = getClubeAtivoId();
    const qtdLocal = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM desbravadores');
    if (!qtdLocal || qtdLocal.n === 0) {
      await popularBancoDeDados();
      puxarDeSupabase().catch(() => {});
    }
    for (const u of UNIDADES_PADRAO) {
      const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ? AND clube_id = ?', [u.nome, clubeAtivoId]);
      if (!existeNome) {
        const existeId = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE id = ?', [u.id]);
        if (existeId) {
          await db.runAsync('INSERT INTO unidades (nome, cor, clube_id) VALUES (?, ?, ?)', [u.nome, u.cor, clubeAtivoId]);
        } else {
          await db.runAsync('INSERT INTO unidades (id, nome, cor, clube_id) VALUES (?, ?, ?, ?)', [u.id, u.nome, u.cor, clubeAtivoId]);
        }
      }
    }
    const derivadas = await db.getAllAsync<{ unidade_id: number | null; unidade_nome: string | null }>(
      `SELECT DISTINCT unidade_id, unidade_nome FROM desbravadores
       WHERE unidade_nome IS NOT NULL AND unidade_nome != 'Diretoria'`
    );
    for (const u of derivadas) {
      if (!u.unidade_nome) continue;
      const padrao = UNIDADES_PADRAO.find((x) => x.nome === u.unidade_nome);
      if (u.unidade_id && u.unidade_id > 0) {
        const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ? AND clube_id = ?', [u.unidade_nome, clubeAtivoId]);
        if (!existeNome) {
          const existeId = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE id = ?', [u.unidade_id]);
          if (existeId) {
            await db.runAsync('INSERT INTO unidades (nome, cor, clube_id) VALUES (?, ?, ?)', [u.unidade_nome, padrao?.cor ?? '#1a3a5c', clubeAtivoId]);
          } else {
            await db.runAsync('INSERT INTO unidades (id, nome, cor, clube_id) VALUES (?, ?, ?, ?)', [u.unidade_id, u.unidade_nome, padrao?.cor ?? '#1a3a5c', clubeAtivoId]);
          }
        }
      } else {
        const existeNome = await db.getFirstAsync<{ id: number }>('SELECT id FROM unidades WHERE nome = ? AND clube_id = ?', [u.unidade_nome, clubeAtivoId]);
        if (!existeNome) {
          await db.runAsync('INSERT INTO unidades (nome, cor, clube_id) VALUES (?, ?, ?)', [u.unidade_nome, padrao?.cor ?? '#1a3a5c', clubeAtivoId]);
        }
      }
    }
    const lista = await db.getAllAsync<Unidade>(
      'SELECT id, nome, cor, codigo_clube FROM unidades WHERE clube_id = ? OR clube_id IS NULL ORDER BY nome',
      [clubeAtivoId]
    );
    let listaFinal = lista;
    if (listaFinal.length === 0) {
      const { data } = await supabase.from('unidades').select('id, nome, cor, codigo_clube').eq('clube_id', clubeAtivoId).order('nome');
      listaFinal = (data ?? UNIDADES_PADRAO) as Unidade[];
    }
    setUnidades(listaFinal);
    setAbertos(new Set());
  }

  /* ── Agrupamento ── */
  const grupos = useMemo(() => {
    const termo = busca.toLowerCase();
    const filtrados = desbravadores.filter((d) =>
      d.nome.toLowerCase().includes(termo) ||
      (d.unidade_nome ?? '').toLowerCase().includes(termo) ||
      (d.cargo ?? '').toLowerCase().includes(termo) ||
      (d.cargo_adicional ?? '').toLowerCase().includes(termo)
    );

    const map: Record<string, Desbravador[]> = {};
    for (const u of unidades) map[u.nome] = [];
    map['Diretoria']   = [];
    map['Sem Unidade'] = [];

    for (const d of filtrados) {
      const chave =
        d.unidade_nome === 'Diretoria' ? 'Diretoria'
        : unidades.find((u) => u.nome === d.unidade_nome) ? d.unidade_nome!
        : 'Sem Unidade';
      if (!map[chave]) map[chave] = [];
      map[chave].push(d);
    }
    return map;
  }, [desbravadores, busca, unidades]);

  function toggleGrupo(nome: string) {
    setAbertos((prev) => {
      const s = new Set(prev);
      s.has(nome) ? s.delete(nome) : s.add(nome);
      return s;
    });
  }

  async function confirmarMover(unidade_id: number | null, unidade_nome: string | null) {
    if (!alvo) return;
    setMovendo(true);
    try {
      await moverParaUnidade(alvo.id, unidade_id, unidade_nome);
      await carregarUnidades();
      await carregar();
      setAlvo(null);
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível trocar o membro de unidade.');
    } finally {
      setMovendo(false);
    }
  }

  /* ── CRUD de unidades ── */
  function abrirCriar() {
    setEditando(null);
    setFormNome('');
    setFormCor(CORES_PRESET[6]);
    setCrudModal(true);
  }

  function abrirEditar(u: Unidade) {
    setEditando(u);
    setFormNome(u.nome);
    setFormCor(u.cor);
    setCrudModal(true);
  }

  async function salvarUnidade() {
    if (!formNome.trim()) { Alert.alert('Atenção', 'Informe o nome da unidade.'); return; }
    const classeConflitante = nomeDeClasseDoOutroPrograma(formNome.trim());
    if (classeConflitante) {
      const outroPrograma = getProgramaAtivoId() === 2 ? 'Desbravadores' : 'Aventureiros';
      Alert.alert(
        'Nome de outro programa',
        `"${classeConflitante}" é uma classe de ${outroPrograma}, não uma unidade deste clube. Escolha outro nome.`
      );
      return;
    }
    setSalvandoCrud(true);
    try {
      if (Platform.OS === 'web') {
        if (editando) {
          const { error } = await supabase
            .from('unidades')
            .update({ nome: formNome.trim(), cor: formCor })
            .eq('clube_id', getClubeAtivoId())
            .eq('id', editando.id);
          if (error) throw error;
          const { error: erroMembros } = await supabase
            .from('desbravadores')
            .update({ unidade_nome: formNome.trim(), updated_at: new Date().toISOString() })
            .eq('clube_id', getClubeAtivoId())
            .or(`unidade_id.eq.${editando.id},unidade_nome.eq.${editando.nome}`);
          if (erroMembros) throw erroMembros;
        } else {
          const { error } = await supabase
            .from('unidades')
            .insert({ clube_id: getClubeAtivoId(), nome: formNome.trim(), cor: formCor });
          if (error) throw error;
        }
      } else if (editando) {
          const db = await getDB();
          await db.runAsync(
            'UPDATE unidades SET nome = ?, cor = ? WHERE id = ?',
            [formNome.trim(), formCor, editando.id]
          );
          await db.runAsync(
            'UPDATE desbravadores SET unidade_nome = ?, updated_at = datetime("now"), sincronizado = 0 WHERE unidade_id = ? OR unidade_nome = ?',
            [formNome.trim(), editando.id, editando.nome]
          );
      } else {
        const db = await getDB();
        await db.runAsync(
          'INSERT INTO unidades (nome, cor, clube_id) VALUES (?, ?, ?)',
          [formNome.trim(), formCor, getClubeAtivoId()]
        );
      }
      setCrudModal(false);
      await carregarUnidades();
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSalvandoCrud(false);
    }
  }

  async function excluirUnidade(u: Unidade) {
    const membrosNaUnidade = desbravadores.filter((d) => d.unidade_nome === u.nome).length;
    const aviso = membrosNaUnidade > 0
      ? `Esta unidade tem ${membrosNaUnidade} membro(s). Eles ficarão sem unidade.`
      : 'Deseja excluir esta unidade?';

    Alert.alert('Excluir unidade', aviso, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          if (Platform.OS === 'web') {
            const clubeId = getClubeAtivoId();
            await supabase
              .from('desbravadores')
              .update({ unidade_id: null, unidade_nome: null, updated_at: new Date().toISOString() })
              .eq('clube_id', clubeId)
              .eq('unidade_id', u.id);
            const { error } = await supabase
              .from('unidades')
              .delete()
              .eq('clube_id', clubeId)
              .eq('id', u.id);
            if (error) {
              Alert.alert('Erro', error.message);
              return;
            }
          } else {
            const db = await getDB();
            await db.runAsync('DELETE FROM unidades WHERE id = ?', [u.id]);
          }
          await carregarUnidades();
          await carregar();
        },
      },
    ]);
  }

  if (!isAdmin) {
    return (
      <View style={s.semAcesso}>
        <Ionicons name="lock-closed" size={48} color="#ccc" />
        <Text style={s.semAcessoText}>Acesso restrito a administradores</Text>
      </View>
    );
  }

  const todasLinhas: (Unidade | typeof SEM_UNIDADE | typeof DIRETORIA)[] = [
    ...unidades, DIRETORIA, SEM_UNIDADE,
  ];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>🏳️ Unidades</Text>
          <Text style={s.subtitulo}>{desbravadores.length} membros · {unidades.length} unidades</Text>
        </View>
        <TouchableOpacity style={s.criarBtn} onPress={abrirCriar}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={s.criarBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {/* Busca */}
      <View style={s.buscaContainer}>
        <Ionicons name="search" size={16} color="#aaa" style={{ marginLeft: 10 }} />
        <TextInput
          style={s.buscaInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por nome, unidade ou cargo..."
          placeholderTextColor="#aaa"
          clearButtonMode="while-editing"
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={16} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 32 }}>
        {todasLinhas.map((u) => {
          const membros = grupos[u.nome] ?? [];
          const aberto  = abertos.has(u.nome);
          const ehEspecial = u.id === -1 || u.id === 0; // SEM_UNIDADE ou DIRETORIA
          const cor     = u.cor;

          return (
            <View key={u.nome} style={s.grupoCard}>
              <TouchableOpacity
                style={[s.grupoHeader, { borderLeftColor: cor }]}
                onPress={() => toggleGrupo(u.nome)}
                activeOpacity={0.7}
              >
                <View style={[s.grupoDot, { backgroundColor: cor }]} />
                <Text style={s.grupoNome}>{u.nome}</Text>
                <View style={[s.grupoBadge, { backgroundColor: cor + '22' }]}>
                  <Text style={[s.grupoBadgeText, { color: cor }]}>{membros.length}</Text>
                </View>

                {/* Botões de edição (só unidades reais, não Diretoria/Sem Unidade fixas) */}
                {!ehEspecial && (
                  <View style={s.grupoAcoes}>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); abrirEditar(u as Unidade); }}
                      style={s.grupoAcaoBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Ionicons name="pencil" size={15} color="#1a3a5c" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); excluirUnidade(u as Unidade); }}
                      style={s.grupoAcaoBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Ionicons name="trash-outline" size={15} color="#c62828" />
                    </TouchableOpacity>
                  </View>
                )}

                <Ionicons
                  name={aberto ? 'chevron-up' : 'chevron-down'}
                  size={18} color="#999" style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>

              {aberto && (
                <>
                  {membros.length === 0 ? (
                    <Text style={s.vazio}>Nenhum membro nesta unidade.</Text>
                  ) : (
                    membros.map((d) => (
                      <View key={d.id} style={s.membroRow}>
                        {d.foto_url ? (
                          <View style={[s.avatar, { backgroundColor: cor }]}>
                            <Text style={s.avatarLetra}>{d.nome[0]}</Text>
                          </View>
                        ) : (
                          <View style={[s.avatar, { backgroundColor: cor }]}>
                            <Text style={s.avatarLetra}>{d.nome[0]}</Text>
                          </View>
                        )}
                        <View style={s.membroInfo}>
                          <Text style={s.membroNome} numberOfLines={1}>{d.nome}</Text>
                          <View style={s.cargosRow}>
                            {ehFuncaoJuvenil(d.cargo) ? (
                              <View style={[s.cargoBadge, { backgroundColor: cor + '22' }]}>
                                <Text style={[s.cargoText, { color: cor }]}>{d.genero === 'F' ? 'Desbravadora' : 'Desbravador'}</Text>
                              </View>
                            ) : null}
                            {d.cargo ? (
                              <View style={[s.cargoBadge, { backgroundColor: estiloCargo(d.cargo, cor).backgroundColor }]}>
                                <Text style={[s.cargoText, { color: estiloCargo(d.cargo, cor).color }]}>{cargoPorExtenso(d.cargo, d.genero)}</Text>
                              </View>
                            ) : null}
                            {d.cargo_adicional && cargoPorExtenso(d.cargo_adicional, d.genero) !== cargoPorExtenso(d.cargo, d.genero) ? (
                              <View style={[s.cargoBadge, { backgroundColor: estiloCargo(d.cargo_adicional, cor).backgroundColor }]}>
                                <Text style={[s.cargoText, { color: estiloCargo(d.cargo_adicional, cor).color }]}>{cargoPorExtenso(d.cargo_adicional, d.genero)}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={s.moverBtn}
                          onPress={() => setAlvo(d)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="swap-horizontal" size={20} color="#1a3a5c" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Modal de transferência ── */}
      <Modal visible={!!alvo} transparent animationType="slide" onRequestClose={() => setAlvo(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setAlvo(null)}>
          <Pressable style={s.modalBox} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitulo}>Mover membro</Text>
            <Text style={s.modalMembro} numberOfLines={1}>{alvo?.nome}</Text>
            <Text style={s.modalSub}>Selecione a unidade de destino:</Text>

            {[...unidades, DIRETORIA, SEM_UNIDADE].map((u) => {
              const atual =
                alvo?.unidade_nome === u.nome ||
                (u.id === -1 && !alvo?.unidade_nome);
              return (
                <TouchableOpacity
                  key={u.nome}
                  style={[s.unidadeOpcao, atual && s.unidadeOpcaoAtual]}
                  onPress={() => {
                    if (!atual && !movendo)
                      confirmarMover(
                        u.id <= 0 ? null : u.id,
                        u.id === -1 ? null : u.nome,
                      );
                  }}
                  disabled={atual || movendo}
                  activeOpacity={0.7}
                >
                  <View style={[s.opcaoDot, { backgroundColor: u.cor }]} />
                  <Text style={[s.opcaoNome, atual && { color: u.cor, fontWeight: '800' }]}>
                    {u.nome}
                  </Text>
                  {atual
                    ? <View style={[s.opcaoAtualBadge, { backgroundColor: u.cor + '22' }]}>
                        <Text style={[s.opcaoAtualText, { color: u.cor }]}>atual</Text>
                      </View>
                    : <Ionicons name="arrow-forward" size={16} color="#bbb" />
                  }
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={s.cancelarBtn} onPress={() => setAlvo(null)}>
              <Ionicons name="close-circle-outline" size={17} color="#999" />
              <Text style={s.cancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal CRUD de unidade ── */}
      <Modal visible={crudModal} transparent animationType="slide" onRequestClose={() => setCrudModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setCrudModal(false)}>
          <Pressable style={[s.modalBox, { paddingBottom: Platform.OS === 'ios' ? 44 : 24 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitulo}>
              {editando ? 'Editar unidade' : 'Nova unidade'}
            </Text>

            <Text style={s.fieldLabel}>Nome da unidade</Text>
            <TextInput
              style={s.fieldInput}
              value={formNome}
              onChangeText={setFormNome}
              placeholder="Ex: Águias Douradas"
              autoFocus
            />

            <Text style={s.fieldLabel}>Cor</Text>
            <View style={s.coresGrid}>
              {CORES_PRESET.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[s.corItem, { backgroundColor: c }, formCor === c && s.corItemSelecionada]}
                  onPress={() => setFormCor(c)}
                >
                  {formCor === c && <Ionicons name="checkmark" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview */}
            <View style={[s.previewRow, { borderLeftColor: formCor }]}>
              <View style={[s.grupoDot, { backgroundColor: formCor }]} />
              <Text style={s.grupoNome}>{formNome || 'Nome da unidade'}</Text>
              <View style={[s.grupoBadge, { backgroundColor: formCor + '33' }]}>
                <Text style={[s.grupoBadgeText, { color: formCor }]}>0</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.salvarBtn, { backgroundColor: formCor }]}
              onPress={salvarUnidade}
              disabled={salvandoCrud}
            >
              {salvandoCrud
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Ionicons name={editando ? 'save-outline' : 'add-circle-outline'} size={18} color="#fff" />
                    <Text style={s.salvarBtnText}>{editando ? 'Salvar alterações' : 'Criar unidade'}</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ─── Estilos ───────────────────────────────────────────────────── */
const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0f4f8' },
  semAcesso:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  semAcessoText:  { color: '#aaa', fontSize: 15 },

  header:         { backgroundColor: '#1a3a5c', padding: 20, paddingTop: 52, flexDirection: 'row', alignItems: 'center' },
  titulo:         { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitulo:      { color: '#a8c8e8', fontSize: 13, marginTop: 4 },
  criarBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  criarBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },

  buscaContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 12, marginBottom: 8, borderRadius: 12, elevation: 2 },
  buscaInput:     { flex: 1, padding: 12, fontSize: 14, color: '#222' },

  lista:          { flex: 1, paddingHorizontal: 12 },

  grupoCard:      { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', elevation: 2 },
  grupoHeader:    { flexDirection: 'row', alignItems: 'center', padding: 14, borderLeftWidth: 4, gap: 8 },
  grupoDot:       { width: 10, height: 10, borderRadius: 5 },
  grupoNome:      { flex: 1, fontSize: 15, fontWeight: '700', color: '#222' },
  grupoBadge:     { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  grupoBadgeText: { fontSize: 13, fontWeight: '800' },
  grupoAcoes:     { flexDirection: 'row', gap: 4 },
  grupoAcaoBtn:   { padding: 6, borderRadius: 8, backgroundColor: '#f0f4f8' },
  vazio:          { padding: 14, color: '#bbb', fontSize: 13, textAlign: 'center' },

  membroRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f5f5f5', gap: 10 },
  avatar:         { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarLetra:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  membroInfo:     { flex: 1 },
  membroNome:     { fontSize: 14, fontWeight: '600', color: '#222' },
  cargosRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  cargoBadge:     { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  cargoText:      { fontSize: 10, fontWeight: '700' },
  moverBtn:       { padding: 6, borderRadius: 8, backgroundColor: '#eef3f9' },

  // Modal genérico
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHandle:    { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitulo:    { fontSize: 18, fontWeight: '800', color: '#1a3a5c', marginBottom: 4 },
  modalMembro:    { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 2 },
  modalSub:       { fontSize: 13, color: '#888', marginBottom: 16 },

  unidadeOpcao:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8, backgroundColor: '#f7f9fc', gap: 10 },
  unidadeOpcaoAtual: { backgroundColor: '#f0f4f8' },
  opcaoDot:          { width: 12, height: 12, borderRadius: 6 },
  opcaoNome:         { flex: 1, fontSize: 15, color: '#333', fontWeight: '600' },
  opcaoAtualBadge:   { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  opcaoAtualText:    { fontSize: 11, fontWeight: '700' },
  cancelarBtn:       { marginTop: 4, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  cancelarText:      { fontSize: 15, color: '#999', fontWeight: '600' },

  // CRUD modal
  fieldLabel:    { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 6, marginTop: 12, textTransform: 'uppercase' },
  fieldInput:    { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, color: '#333' },
  coresGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  corItem:       { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  corItemSelecionada: { borderWidth: 3, borderColor: '#fff', elevation: 4 },
  previewRow:    { flexDirection: 'row', alignItems: 'center', padding: 12, borderLeftWidth: 4, backgroundColor: '#f8f9fa', borderRadius: 10, marginTop: 14, gap: 8 },
  salvarBtn:     { marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  salvarBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

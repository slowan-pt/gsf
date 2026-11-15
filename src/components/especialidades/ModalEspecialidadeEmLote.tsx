import { tomTexto } from '../../../src/lib/tema';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Modal } from '../ModalSeguro';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, avatarCor } from '../common/Avatar';
import { SeloEspecialidade } from '../SeloEspecialidade';
import {
  carregarCatalogoEspecialidades,
  carregarEspecialidadesDosMembros,
  marcarEspecialidadeManual,
  type EspecialidadeCatalogo,
  type MembroResumo,
} from '../../lib/especialidades';
import { planejarLote, quemJaTem as quemJaTemNucleo } from '../../lib/especialidadesLoteNucleo';
import { combinaBusca } from '../../lib/texto';
import { useCores } from '../../stores/temaStore';
import { corIcone } from '../../lib/tema';

interface Props {
  visible: boolean;
  onClose: () => void;
  membros: MembroResumo[];
  usuarioId?: string | null;
  usuarioNome?: string | null;
  onConcluido?: () => void;
}

interface ResultadoLote {
  membroId: number;
  nome: string;
  especialidade: string;
  ok: boolean;
  /** O membro já tinha a especialidade: nada foi gravado. */
  ignorada?: boolean;
  erro?: string;
}

/** Primeiro nome + sobrenome curtos para caber nos avisos. */
function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0] ?? nome;
}

/**
 * "Adicionar especialidade em lote", em duas etapas (cabe em tela de celular):
 * Passo 1 escolhe os MEMBROS; Passo 2 escolhe UMA ou VÁRIAS especialidades. Como os membros já são conhecidos no
 * passo 2, cada especialidade mostra quem entre eles já a tem, e o botão resume quantas marcações serão feitas e
 * quantas serão ignoradas. Quem já tem a especialidade nunca é regravado (nem aqui, nem na gravação).
 */
export function ModalEspecialidadeEmLote({ visible, onClose, membros, usuarioId, usuarioNome, onConcluido }: Props) {
  const cores = useCores();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [catalogo, setCatalogo] = useState<EspecialidadeCatalogo[]>([]);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  const [buscaEsp, setBuscaEsp] = useState('');
  const [especialidadesEscolhidas, setEspecialidadesEscolhidas] = useState<EspecialidadeCatalogo[]>([]);
  const [buscaMembro, setBuscaMembro] = useState('');
  const [membrosSelecionados, setMembrosSelecionados] = useState<number[]>([]);
  /** O que cada membro escolhido já tem (nomes normalizados), carregado ao sair do passo 1. */
  const [jaTem, setJaTem] = useState<Map<number, Set<string>>>(new Map());
  const [carregandoJaTem, setCarregandoJaTem] = useState(false);
  const [erroJaTem, setErroJaTem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoLote[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPasso(1);
    setBuscaEsp(''); setBuscaMembro(''); setEspecialidadesEscolhidas([]);
    setMembrosSelecionados([]); setResultado(null); setProgresso(null);
    setJaTem(new Map()); setErroJaTem(null);
    setCarregandoCatalogo(true);
    carregarCatalogoEspecialidades()
      .then(setCatalogo)
      .catch(() => setCatalogo([]))
      .finally(() => setCarregandoCatalogo(false));
  }, [visible]);

  const nomePorId = useMemo(() => new Map(membros.map((m) => [m.id, m.nome])), [membros]);
  const listaEsp = useMemo(
    () => catalogo.filter((c) => combinaBusca(c.nome, buscaEsp) || combinaBusca(c.categoria, buscaEsp)),
    [catalogo, buscaEsp],
  );
  const listaMembros = useMemo(
    () => membros.filter((m) => combinaBusca(m.nome, buscaMembro)).slice(0, 120),
    [membros, buscaMembro],
  );
  const idsEscolhidos = useMemo(() => new Set(especialidadesEscolhidas.map((e) => e.id)), [especialidadesEscolhidas]);
  const todosFiltradosMarcados = listaMembros.length > 0 && listaMembros.every((m) => membrosSelecionados.includes(m.id));

  /** Quem, entre os membros escolhidos, já tem a especialidade. */
  function quemJaTem(c: EspecialidadeCatalogo): number[] {
    return quemJaTemNucleo(membrosSelecionados, c.nome, jaTem);
  }

  /** Resumo do que será gravado e do que será ignorado (já tinham). */
  const resumo = useMemo(() => {
    const plano = planejarLote(membrosSelecionados, especialidadesEscolhidas.map((e) => e.nome), jaTem);
    return { novas: plano.gravar.length, ignoradas: plano.ignorar.map((p) => ({ membroId: p.membroId, especialidade: p.especialidade })) };
  }, [especialidadesEscolhidas, membrosSelecionados, jaTem]);

  function alternarEspecialidade(c: EspecialidadeCatalogo) {
    if (membrosSelecionados.length > 0 && quemJaTem(c).length === membrosSelecionados.length) return;
    setEspecialidadesEscolhidas((prev) => (prev.some((e) => e.id === c.id) ? prev.filter((e) => e.id !== c.id) : [...prev, c]));
  }

  function alternarTodosFiltrados() {
    const ids = listaMembros.map((m) => m.id);
    setMembrosSelecionados((prev) => (todosFiltradosMarcados ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))));
  }

  /** Passo 1 → 2: descobre o que cada membro escolhido já tem, com uma consulta só. */
  async function irParaEspecialidades() {
    if (membrosSelecionados.length === 0) return;
    setCarregandoJaTem(true);
    setErroJaTem(null);
    try {
      setJaTem(await carregarEspecialidadesDosMembros(membrosSelecionados));
    } catch (e: any) {
      // Sem a conferência não dá para avisar; a gravação ainda confere sozinha antes de cada marcação.
      setJaTem(new Map());
      setErroJaTem(e?.message ?? 'Não foi possível conferir o que os membros já têm.');
    } finally {
      setCarregandoJaTem(false);
      setPasso(2);
    }
  }

  async function confirmar() {
    if (especialidadesEscolhidas.length === 0 || membrosSelecionados.length === 0) return;
    setEnviando(true);
    setProgresso({ feito: 0, total: resumo.novas });
    const lista: ResultadoLote[] = [];
    let feito = 0;
    // Confere de novo agora (alguém pode ter marcado no meio tempo) e depois só grava o que falta.
    let atual = jaTem;
    let conferiu = true;
    try { atual = await carregarEspecialidadesDosMembros(membrosSelecionados); } catch { conferiu = false; /* cada gravação confere sozinha */ }
    const plano = planejarLote(membrosSelecionados, especialidadesEscolhidas.map((e) => e.nome), atual);
    for (const p of plano.ignorar) {
      lista.push({ membroId: p.membroId, nome: nomePorId.get(p.membroId) ?? `Membro ${p.membroId}`, especialidade: p.especialidade, ok: true, ignorada: true });
    }
    for (const p of plano.gravar) {
      const nome = nomePorId.get(p.membroId) ?? `Membro ${p.membroId}`;
      try {
        const r = await marcarEspecialidadeManual({ dbvId: p.membroId, nome: p.especialidade, usuarioId, usuarioNome, jaConferido: conferiu });
        lista.push({ membroId: p.membroId, nome, especialidade: p.especialidade, ok: true, ignorada: r === 'ja_tinha' });
      } catch (e: any) {
        lista.push({ membroId: p.membroId, nome, especialidade: p.especialidade, ok: false, erro: e?.message ?? String(e) });
      }
      feito += 1;
      setProgresso({ feito, total: plano.gravar.length });
    }
    setResultado(lista);
    setEnviando(false);
    onConcluido?.();
  }

  function fecharTudo() {
    onClose();
  }

  const estiloInput = [s.input, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52', color: '#f1eefc' }, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }];
  const textoSuave = [s.sub, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }];
  const corAviso = tomTexto('#b45309', cores);

  const feitas = resultado?.filter((r) => r.ok && !r.ignorada).length ?? 0;
  const ignoradasFinal = resultado?.filter((r) => r.ok && r.ignorada) ?? [];
  const comErro = resultado?.filter((r) => !r.ok) ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fecharTudo}>
      <KeyboardAvoidingView style={[s.overlay, { backgroundColor: cores.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }, !resultado && s.cardAlto]}>
          <Text style={[s.titulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Adicionar especialidade em lote</Text>

          {resultado ? (
            <ScrollView style={{ marginTop: 12 }}>
              <Text style={[s.resultadoResumo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>
                {feitas} marcação(ões) feita(s) com sucesso.
              </Text>
              {ignoradasFinal.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.resultadoSub, { color: corAviso }]}>
                    {ignoradasFinal.length} ignorada(s) porque o membro já tinha a especialidade (nada foi alterado):
                  </Text>
                  {ignoradasFinal.map((r, i) => (
                    <View key={`${r.membroId}-${r.especialidade}-ig-${i}`} style={s.linhaErro}>
                      <Ionicons name="information-circle" size={16} color={corAviso} />
                      <Text style={[s.linhaErroTexto, { color: cores.texto }]}>{r.nome} · {r.especialidade}</Text>
                    </View>
                  ))}
                </View>
              )}
              {comErro.map((r, i) => (
                <View key={`${r.membroId}-${r.especialidade}-${i}`} style={s.linhaErro}>
                  <Ionicons name="alert-circle" size={16} color={tomTexto('#c0392b', cores)} />
                  <Text style={[s.linhaErroTexto, cores.isEscuro && { color: '#ff9b9b' }]}>{r.nome} · {r.especialidade}: {r.erro}</Text>
                </View>
              ))}
              <TouchableOpacity style={s.botaoPrimario} onPress={fecharTudo}>
                <Text style={s.botaoPrimarioTexto}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <>
              {/* Indicador de etapas */}
              <View style={s.etapas}>
                {[1, 2].map((n) => (
                  <View key={n} style={[s.etapaBarra, { backgroundColor: passo >= n ? '#7c39e7' : cores.borda }]} />
                ))}
              </View>
              <Text style={[s.rotulo, cores.isEscuro && { color: '#d5dbe1' }, { color: cores.textoSecundario }]}>
                Passo {passo} de 2 · {passo === 1 ? 'Membros' : 'Especialidades'}
              </Text>

              {passo === 1 ? (
                <>
                  <Text style={textoSuave}>Escolha quem vai receber. No próximo passo você marca as especialidades e o app avisa quem já tem alguma delas.</Text>
                  <View style={s.linhaBusca}>
                    <TextInput
                      value={buscaMembro}
                      onChangeText={setBuscaMembro}
                      placeholder="Buscar membro..."
                      placeholderTextColor={cores.placeholder}
                      style={[...estiloInput, { flex: 1 }]}
                    />
                    <TouchableOpacity style={s.botaoTodos} onPress={alternarTodosFiltrados} accessibilityRole="button" accessibilityLabel="Marcar ou desmarcar todos da lista">
                      <Ionicons name={todosFiltradosMarcados ? 'checkbox' : 'square-outline'} size={20} color={tomTexto('#16a34a', cores)} />
                      <Text style={[s.botaoTodosTexto, { color: cores.texto }]}>Todos</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={s.lista} keyboardShouldPersistTaps="handled">
                    {listaMembros.length === 0 && (
                      <Text style={[s.vazio, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>Nenhum membro encontrado.</Text>
                    )}
                    {listaMembros.map((m) => {
                      const ativo = membrosSelecionados.includes(m.id);
                      return (
                        <TouchableOpacity
                          key={m.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: ativo }}
                          style={[s.opcaoMembro, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && [s.opcaoMembroAtivo, cores.isEscuro && { backgroundColor: '#1d1932' }]]}
                          onPress={() => setMembrosSelecionados((prev) => (ativo ? prev.filter((id) => id !== m.id) : [...prev, m.id]))}
                        >
                          <Avatar nome={m.nome} foto_url={m.foto_url ?? undefined} cor={avatarCor(m.nome)} size={28} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.opcaoMembroNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{m.nome}</Text>
                            <Text style={[s.opcaoMembroSub, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>{m.unidade_nome || 'Sem unidade'}</Text>
                          </View>
                          <Ionicons name={ativo ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={ativo ? tomTexto('#16a34a', cores) : cores.textoSecundario} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={[s.botaoPrimario, (membrosSelecionados.length === 0 || carregandoJaTem) && s.botaoDesabilitado, { marginTop: 12 }]}
                    onPress={irParaEspecialidades}
                    disabled={membrosSelecionados.length === 0 || carregandoJaTem}
                    accessibilityRole="button"
                  >
                    {carregandoJaTem
                      ? <Text style={s.botaoPrimarioTexto}>Conferindo o que já têm...</Text>
                      : <Text style={s.botaoPrimarioTexto}>
                          {membrosSelecionados.length === 0 ? 'Escolha ao menos um membro' : `Continuar (${membrosSelecionados.length} membro${membrosSelecionados.length === 1 ? '' : 's'})`}
                        </Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.fechar} onPress={fecharTudo}>
                    <Text style={[s.fecharTexto, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[s.resumoEsp, cores.isEscuro && { backgroundColor: '#3f3c4c', borderColor: '#322c52' }]}>
                    <Ionicons name="people" size={16} color={tomTexto('#7c39e7', cores)} />
                    <Text style={[s.resumoEspTexto, cores.isEscuro && { color: '#f1eefc' }, { color: cores.texto }]} numberOfLines={2}>
                      {membrosSelecionados.map((id) => nomeCurto(nomePorId.get(id) ?? `Membro ${id}`)).join(' · ')}
                    </Text>
                  </View>
                  {!!erroJaTem && (
                    <Text style={[s.sub, { color: corAviso, marginBottom: 6 }]}>
                      Não deu para conferir o que os membros já têm ({erroJaTem}). Quem já tiver a especialidade ainda será ignorado na hora de gravar.
                    </Text>
                  )}
                  <TextInput
                    value={buscaEsp}
                    onChangeText={setBuscaEsp}
                    placeholder="Buscar especialidade..."
                    placeholderTextColor={cores.placeholder}
                    style={estiloInput}
                  />
                  {carregandoCatalogo && <ActivityIndicator color={corIcone(cores)} style={{ marginVertical: 12 }} />}
                  <ScrollView style={s.lista} keyboardShouldPersistTaps="handled">
                    {!carregandoCatalogo && listaEsp.length === 0 && (
                      <Text style={[s.vazio, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>Nenhuma especialidade encontrada.</Text>
                    )}
                    {listaEsp.map((c, i) => {
                      const ativo = idsEscolhidos.has(c.id);
                      const quem = quemJaTem(c);
                      const todosTem = membrosSelecionados.length > 0 && quem.length === membrosSelecionados.length;
                      let aviso = '';
                      if (quem.length > 0) {
                        if (membrosSelecionados.length === 1) aviso = 'já tem';
                        else {
                          const nomes = quem.slice(0, 2).map((id) => nomeCurto(nomePorId.get(id) ?? `Membro ${id}`)).join(', ');
                          const extra = quem.length > 2 ? ` +${quem.length - 2}` : '';
                          aviso = todosTem
                            ? `todos já têm (${quem.length})`
                            : `${quem.length} de ${membrosSelecionados.length} já têm: ${nomes}${extra}`;
                        }
                      }
                      return (
                        <TouchableOpacity
                          key={c.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: ativo, disabled: todosTem }}
                          disabled={todosTem}
                          style={[s.opcaoEsp, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && s.opcaoAtiva, todosTem && s.opcaoBloqueada]}
                          onPress={() => alternarEspecialidade(c)}
                        >
                          <SeloEspecialidade url={c.insignia_url} indice={i} tamanho={36} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.opcaoEspNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{c.nome}</Text>
                            {!!c.categoria && <Text style={[s.opcaoEspCat, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>{c.categoria}</Text>}
                            {!!aviso && <Text style={[s.opcaoEspAviso, { color: corAviso }]}>{aviso}</Text>}
                          </View>
                          <Ionicons
                            name={todosTem ? 'checkmark-done' : ativo ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={todosTem ? corAviso : ativo ? tomTexto('#16a34a', cores) : cores.textoSecundario}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {especialidadesEscolhidas.length > 0 && (
                    <View style={[s.resumoGravacao, { borderColor: cores.borda, backgroundColor: cores.fundo }]}>
                      <Text style={[s.resumoGravacaoTexto, { color: cores.texto }]}>
                        {resumo.novas} {resumo.novas === 1 ? 'marcação será feita' : 'marcações serão feitas'}
                        {resumo.ignoradas.length > 0 ? ` · ${resumo.ignoradas.length} ignorada${resumo.ignoradas.length === 1 ? '' : 's'} (já tinha${resumo.ignoradas.length === 1 ? '' : 'm'})` : ''}
                      </Text>
                      {resumo.ignoradas.length > 0 && (
                        <Text style={[s.resumoGravacaoSub, { color: corAviso }]} numberOfLines={3}>
                          Ignoradas: {resumo.ignoradas.slice(0, 4).map((x) => `${nomeCurto(nomePorId.get(x.membroId) ?? `Membro ${x.membroId}`)} já tem ${x.especialidade}`).join('; ')}
                          {resumo.ignoradas.length > 4 ? `; +${resumo.ignoradas.length - 4}` : ''}
                        </Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[s.botaoPrimario, (especialidadesEscolhidas.length === 0 || resumo.novas === 0 || enviando) && s.botaoDesabilitado, { marginTop: 12 }]}
                    onPress={confirmar}
                    disabled={especialidadesEscolhidas.length === 0 || resumo.novas === 0 || enviando}
                    accessibilityRole="button"
                  >
                    {enviando
                      ? <Text style={s.botaoPrimarioTexto}>Marcando {progresso?.feito}/{progresso?.total}...</Text>
                      : <Text style={s.botaoPrimarioTexto}>
                          {especialidadesEscolhidas.length === 0
                            ? 'Escolha ao menos uma especialidade'
                            : resumo.novas === 0
                              ? 'Todos já têm essas especialidades'
                              : `Marcar ${resumo.novas} ${resumo.novas === 1 ? 'especialidade' : 'especialidades'}${resumo.ignoradas.length > 0 ? ` (ignorar ${resumo.ignoradas.length} que já têm)` : ''}`}
                        </Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.fechar} onPress={() => setPasso(1)} disabled={enviando} accessibilityRole="button">
                    <Text style={[s.fecharTexto, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>‹ Voltar aos membros</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '92%' },
  cardAlto: { height: '92%' },
  titulo: { fontSize: 17, fontWeight: '800', color: '#4b2bb0' },
  sub: { fontSize: 12, color: '#7b8794', marginTop: 2, lineHeight: 17 },
  rotulo: { fontSize: 12, fontWeight: '800', color: '#52606d', textTransform: 'uppercase', marginBottom: 6 },
  etapas: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 8 },
  etapaBarra: { flex: 1, height: 5, borderRadius: 3 },
  input: {
    borderWidth: 1, borderColor: '#e6e1f4', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#222', backgroundColor: '#f8fafc',
  },
  lista: { flex: 1, marginTop: 8 },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 16 },

  resumoEsp: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10,
    backgroundColor: '#f3eeff', borderWidth: 1, borderColor: '#ddd6fe', marginBottom: 10,
  },
  resumoEspTexto: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1f1b33' },
  linhaBusca: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botaoTodos: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 8 },
  botaoTodosTexto: { fontSize: 12, fontWeight: '800' },

  opcaoEsp: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#e6e1f4', backgroundColor: '#fafbfc', marginBottom: 6,
  },
  opcaoAtiva: { borderColor: '#16a34a' },
  opcaoEspNome: { fontSize: 13, fontWeight: '700', color: '#1f1b33' },
  opcaoEspCat: { fontSize: 11, color: '#8a94a0', marginTop: 2 },
  opcaoEspAviso: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  opcaoBloqueada: { opacity: 0.55 },
  resumoGravacao: { marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  resumoGravacaoTexto: { fontSize: 13, fontWeight: '800' },
  resumoGravacaoSub: { fontSize: 11, marginTop: 4, lineHeight: 16 },

  opcaoMembro: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#e6e1f4', backgroundColor: '#fafbfc', marginBottom: 6,
  },
  opcaoMembroAtivo: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  opcaoMembroNome: { fontSize: 13, fontWeight: '700', color: '#1f1b33' },
  opcaoMembroSub: { fontSize: 11, color: '#8a94a0', marginTop: 2 },

  botaoPrimario: { padding: 13, borderRadius: 22, alignItems: 'center', backgroundColor: '#7c39e7' },
  botaoDesabilitado: { opacity: 0.5 },
  botaoPrimarioTexto: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  fechar: { marginTop: 8, alignSelf: 'center', padding: 8 },
  fecharTexto: { color: '#7b8794', fontWeight: '700' },

  resultadoSub: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  resultadoResumo: { fontSize: 14, fontWeight: '700', color: '#4b2bb0', marginBottom: 10 },
  linhaErro: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  linhaErroTexto: { flex: 1, color: '#c0392b', fontSize: 12 },
});

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
  marcarEspecialidadeManual,
  type EspecialidadeCatalogo,
  type MembroResumo,
} from '../../lib/especialidades';
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
  erro?: string;
}

/**
 * "Adicionar especialidade em lote", em duas etapas (cabe em tela de celular):
 * Passo 1 escolhe UMA ou VÁRIAS especialidades; Passo 2 escolhe os membros que as concluíram.
 * Cada combinação especialidade × membro é gravada com a mesma gravação usada na ficha do membro.
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
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoLote[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPasso(1);
    setBuscaEsp(''); setBuscaMembro(''); setEspecialidadesEscolhidas([]);
    setMembrosSelecionados([]); setResultado(null); setProgresso(null);
    setCarregandoCatalogo(true);
    carregarCatalogoEspecialidades()
      .then(setCatalogo)
      .catch(() => setCatalogo([]))
      .finally(() => setCarregandoCatalogo(false));
  }, [visible]);

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
  const totalMarcacoes = especialidadesEscolhidas.length * membrosSelecionados.length;

  function alternarEspecialidade(c: EspecialidadeCatalogo) {
    setEspecialidadesEscolhidas((prev) => (prev.some((e) => e.id === c.id) ? prev.filter((e) => e.id !== c.id) : [...prev, c]));
  }

  function alternarTodosFiltrados() {
    const ids = listaMembros.map((m) => m.id);
    setMembrosSelecionados((prev) => (todosFiltradosMarcados ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))));
  }

  async function confirmar() {
    if (especialidadesEscolhidas.length === 0 || membrosSelecionados.length === 0) return;
    setEnviando(true);
    const total = especialidadesEscolhidas.length * membrosSelecionados.length;
    setProgresso({ feito: 0, total });
    const lista: ResultadoLote[] = [];
    let feito = 0;
    for (const membroId of membrosSelecionados) {
      const membro = membros.find((m) => m.id === membroId);
      for (const esp of especialidadesEscolhidas) {
        try {
          await marcarEspecialidadeManual({ dbvId: membroId, nome: esp.nome, usuarioId, usuarioNome });
          lista.push({ membroId, nome: membro?.nome ?? `Membro ${membroId}`, especialidade: esp.nome, ok: true });
        } catch (e: any) {
          lista.push({ membroId, nome: membro?.nome ?? `Membro ${membroId}`, especialidade: esp.nome, ok: false, erro: e?.message ?? String(e) });
        }
        feito += 1;
        setProgresso({ feito, total });
      }
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fecharTudo}>
      <KeyboardAvoidingView style={[s.overlay, { backgroundColor: cores.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.card, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }, !resultado && s.cardAlto]}>
          <Text style={[s.titulo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Adicionar especialidade em lote</Text>

          {resultado ? (
            <ScrollView style={{ marginTop: 12 }}>
              <Text style={[s.resultadoResumo, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>
                {resultado.filter((r) => r.ok).length} de {resultado.length} marcação(ões) feita(s) com sucesso.
              </Text>
              {resultado.filter((r) => !r.ok).map((r, i) => (
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
                Passo {passo} de 2 · {passo === 1 ? 'Especialidades' : 'Membros'}
              </Text>

              {passo === 1 ? (
                <>
                  <Text style={textoSuave}>Marque uma ou mais especialidades. No próximo passo você escolhe quem as concluiu.</Text>
                  <TextInput
                    value={buscaEsp}
                    onChangeText={setBuscaEsp}
                    placeholder="Buscar especialidade..."
                    placeholderTextColor={cores.placeholder}
                    style={[...estiloInput, { marginTop: 10 }]}
                  />
                  {carregandoCatalogo && <ActivityIndicator color={corIcone(cores)} style={{ marginVertical: 12 }} />}
                  <ScrollView style={s.lista} keyboardShouldPersistTaps="handled">
                    {!carregandoCatalogo && listaEsp.length === 0 && (
                      <Text style={[s.vazio, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>Nenhuma especialidade encontrada.</Text>
                    )}
                    {listaEsp.map((c, i) => {
                      const ativo = idsEscolhidos.has(c.id);
                      return (
                        <TouchableOpacity
                          key={c.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: ativo }}
                          style={[s.opcaoEsp, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, { backgroundColor: cores.cartao, borderColor: cores.borda }, ativo && s.opcaoAtiva]}
                          onPress={() => alternarEspecialidade(c)}
                        >
                          <SeloEspecialidade url={c.insignia_url} indice={i} tamanho={36} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.opcaoEspNome, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>{c.nome}</Text>
                            {!!c.categoria && <Text style={[s.opcaoEspCat, cores.isEscuro && { color: '#c3c8d1' }, { color: cores.textoSecundario }]}>{c.categoria}</Text>}
                          </View>
                          <Ionicons name={ativo ? 'checkbox' : 'square-outline'} size={22} color={ativo ? tomTexto('#16a34a', cores) : cores.textoSecundario} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={[s.botaoPrimario, especialidadesEscolhidas.length === 0 && s.botaoDesabilitado, { marginTop: 12 }]}
                    onPress={() => setPasso(2)}
                    disabled={especialidadesEscolhidas.length === 0}
                    accessibilityRole="button"
                  >
                    <Text style={s.botaoPrimarioTexto}>
                      {especialidadesEscolhidas.length === 0 ? 'Escolha ao menos uma especialidade' : `Continuar (${especialidadesEscolhidas.length} escolhida${especialidadesEscolhidas.length === 1 ? '' : 's'})`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.fechar} onPress={fecharTudo}>
                    <Text style={[s.fecharTexto, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[s.resumoEsp, cores.isEscuro && { backgroundColor: '#3f3c4c', borderColor: '#322c52' }]}>
                    <Ionicons name="ribbon" size={16} color={tomTexto('#7c39e7', cores)} />
                    <Text style={[s.resumoEspTexto, cores.isEscuro && { color: '#f1eefc' }, { color: cores.texto }]} numberOfLines={2}>
                      {especialidadesEscolhidas.map((e) => e.nome).join(' · ')}
                    </Text>
                  </View>
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
                    style={[s.botaoPrimario, (membrosSelecionados.length === 0 || enviando) && s.botaoDesabilitado, { marginTop: 12 }]}
                    onPress={confirmar}
                    disabled={membrosSelecionados.length === 0 || enviando}
                    accessibilityRole="button"
                  >
                    {enviando
                      ? <Text style={s.botaoPrimarioTexto}>Marcando {progresso?.feito}/{progresso?.total}...</Text>
                      : <Text style={s.botaoPrimarioTexto}>
                          {membrosSelecionados.length === 0 ? 'Escolha ao menos um membro' : `Marcar ${totalMarcacoes} ${totalMarcacoes === 1 ? 'especialidade' : 'especialidades'} (${membrosSelecionados.length} membro${membrosSelecionados.length === 1 ? '' : 's'})`}
                        </Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.fechar} onPress={() => setPasso(1)} disabled={enviando} accessibilityRole="button">
                    <Text style={[s.fecharTexto, cores.isEscuro && { color: '#c0c6d0' }, { color: cores.textoSecundario }]}>‹ Voltar às especialidades</Text>
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

  resultadoResumo: { fontSize: 14, fontWeight: '700', color: '#4b2bb0', marginBottom: 10 },
  linhaErro: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  linhaErroTexto: { flex: 1, color: '#c0392b', fontSize: 12 },
});

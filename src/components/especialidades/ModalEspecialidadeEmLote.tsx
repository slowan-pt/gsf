import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, avatarCor } from '../common/Avatar';
import {
  carregarCatalogoEspecialidades,
  marcarEspecialidadeManual,
  type EspecialidadeCatalogo,
  type MembroResumo,
} from '../../lib/especialidades';
import { combinaBusca } from '../../lib/texto';

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
  ok: boolean;
  erro?: string;
}

/**
 * "Adicionar especialidade em lote": escolhe UMA especialidade e VÁRIOS
 * membros de uma vez — marca a mesma especialidade como concluída pra todos
 * os selecionados, um a um (mesma gravação usada na ficha do membro).
 */
export function ModalEspecialidadeEmLote({ visible, onClose, membros, usuarioId, usuarioNome, onConcluido }: Props) {
  const [catalogo, setCatalogo] = useState<EspecialidadeCatalogo[]>([]);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  const [buscaEsp, setBuscaEsp] = useState('');
  const [especialidadeEscolhida, setEspecialidadeEscolhida] = useState<EspecialidadeCatalogo | null>(null);
  const [buscaMembro, setBuscaMembro] = useState('');
  const [membrosSelecionados, setMembrosSelecionados] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoLote[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBuscaEsp(''); setBuscaMembro(''); setEspecialidadeEscolhida(null);
    setMembrosSelecionados([]); setResultado(null); setProgresso(null);
    setCarregandoCatalogo(true);
    carregarCatalogoEspecialidades()
      .then(setCatalogo)
      .catch(() => setCatalogo([]))
      .finally(() => setCarregandoCatalogo(false));
  }, [visible]);

  const listaEsp = catalogo.filter((c) =>
    combinaBusca(c.nome, buscaEsp) || combinaBusca(c.categoria, buscaEsp)
  );

  const listaMembros = membros
    .filter((m) => combinaBusca(m.nome, buscaMembro))
    .slice(0, 80);

  async function confirmar() {
    if (!especialidadeEscolhida || membrosSelecionados.length === 0) return;
    setEnviando(true);
    setProgresso({ feito: 0, total: membrosSelecionados.length });
    const lista: ResultadoLote[] = [];
    for (let i = 0; i < membrosSelecionados.length; i++) {
      const membroId = membrosSelecionados[i];
      const membro = membros.find((m) => m.id === membroId);
      try {
        await marcarEspecialidadeManual({
          dbvId: membroId, nome: especialidadeEscolhida.nome, usuarioId, usuarioNome,
        });
        lista.push({ membroId, nome: membro?.nome ?? `Membro ${membroId}`, ok: true });
      } catch (e: any) {
        lista.push({ membroId, nome: membro?.nome ?? `Membro ${membroId}`, ok: false, erro: e?.message ?? String(e) });
      }
      setProgresso({ feito: i + 1, total: membrosSelecionados.length });
    }
    setResultado(lista);
    setEnviando(false);
    onConcluido?.();
  }

  function fecharTudo() {
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fecharTudo}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.card}>
          <Text style={s.titulo}>Adicionar especialidade em lote</Text>
          <Text style={s.sub}>Escolha uma especialidade e os membros que já a concluíram.</Text>

          {resultado ? (
            <ScrollView style={{ marginTop: 12 }}>
              <Text style={s.resultadoResumo}>
                {resultado.filter((r) => r.ok).length} de {resultado.length} membro(s) marcado(s) com sucesso.
              </Text>
              {resultado.filter((r) => !r.ok).map((r) => (
                <View key={r.membroId} style={s.linhaErro}>
                  <Ionicons name="alert-circle" size={16} color="#c0392b" />
                  <Text style={s.linhaErroTexto}>{r.nome}: {r.erro}</Text>
                </View>
              ))}
              <TouchableOpacity style={s.botaoPrimario} onPress={fecharTudo}>
                <Text style={s.botaoPrimarioTexto}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <>
              <Text style={s.rotulo}>1. Especialidade</Text>
              {especialidadeEscolhida ? (
                <View style={s.chipEscolhida}>
                  <Ionicons name="ribbon" size={16} color="#7c3aed" />
                  <Text style={s.chipEscolhidaTexto}>{especialidadeEscolhida.nome}</Text>
                  <TouchableOpacity onPress={() => setEspecialidadeEscolhida(null)}>
                    <Ionicons name="close-circle" size={18} color="#9aa5b1" />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    value={buscaEsp}
                    onChangeText={setBuscaEsp}
                    placeholder="Buscar especialidade..."
                    placeholderTextColor="#aaa"
                    style={s.input}
                  />
                  {carregandoCatalogo && <ActivityIndicator color="#1a3a5c" style={{ marginVertical: 12 }} />}
                  <ScrollView style={{ maxHeight: 160, marginTop: 6 }} keyboardShouldPersistTaps="handled">
                    {!carregandoCatalogo && listaEsp.length === 0 && (
                      <Text style={s.vazio}>Nenhuma especialidade encontrada.</Text>
                    )}
                    {listaEsp.map((c) => (
                      <TouchableOpacity key={c.id} style={s.opcaoEsp} onPress={() => setEspecialidadeEscolhida(c)}>
                        <Ionicons name="ribbon-outline" size={16} color="#7c3aed" />
                        <View style={{ flex: 1 }}>
                          <Text style={s.opcaoEspNome}>{c.nome}</Text>
                          {!!c.categoria && <Text style={s.opcaoEspCat}>{c.categoria}</Text>}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={[s.rotulo, { marginTop: 14 }]}>2. Membros ({membrosSelecionados.length})</Text>
              <TextInput
                value={buscaMembro}
                onChangeText={setBuscaMembro}
                placeholder="Buscar membro..."
                placeholderTextColor="#aaa"
                style={s.input}
              />
              <ScrollView style={{ maxHeight: 220, marginTop: 6 }} keyboardShouldPersistTaps="handled">
                {listaMembros.map((m) => {
                  const ativo = membrosSelecionados.includes(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.opcaoMembro, ativo && s.opcaoMembroAtivo]}
                      onPress={() => setMembrosSelecionados((prev) =>
                        ativo ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                      )}
                    >
                      <Avatar nome={m.nome} foto_url={m.foto_url ?? undefined} cor={avatarCor(m.nome)} size={28} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.opcaoMembroNome}>{m.nome}</Text>
                        <Text style={s.opcaoMembroSub}>{m.unidade_nome || 'Sem unidade'}</Text>
                      </View>
                      <Ionicons name={ativo ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ativo ? '#16a34a' : '#9aa5b1'} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[s.botaoPrimario, (!especialidadeEscolhida || membrosSelecionados.length === 0 || enviando) && s.botaoDesabilitado, { marginTop: 14 }]}
                onPress={confirmar}
                disabled={!especialidadeEscolhida || membrosSelecionados.length === 0 || enviando}
              >
                {enviando
                  ? <Text style={s.botaoPrimarioTexto}>Marcando {progresso?.feito}/{progresso?.total}...</Text>
                  : <Text style={s.botaoPrimarioTexto}>Marcar para {membrosSelecionados.length} membro(s)</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.fechar} onPress={fecharTudo} disabled={enviando}>
                <Text style={s.fecharTexto}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '88%' },
  titulo: { fontSize: 17, fontWeight: '800', color: '#1a3a5c' },
  sub: { fontSize: 12, color: '#7b8794', marginTop: 4, lineHeight: 17 },
  rotulo: { fontSize: 12, fontWeight: '800', color: '#52606d', textTransform: 'uppercase', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e4eaf1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#222', backgroundColor: '#f8fafc',
  },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 16 },

  chipEscolhida: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10,
    backgroundColor: '#f3eeff', borderWidth: 1, borderColor: '#ddd6fe',
  },
  chipEscolhidaTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1f2933' },

  opcaoEsp: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#e4eaf1', backgroundColor: '#fafbfc', marginBottom: 6,
  },
  opcaoEspNome: { fontSize: 13, fontWeight: '700', color: '#1f2933' },
  opcaoEspCat: { fontSize: 11, color: '#8a94a0', marginTop: 2 },

  opcaoMembro: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#e4eaf1', backgroundColor: '#fafbfc', marginBottom: 6,
  },
  opcaoMembroAtivo: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  opcaoMembroNome: { fontSize: 13, fontWeight: '700', color: '#1f2933' },
  opcaoMembroSub: { fontSize: 11, color: '#8a94a0', marginTop: 2 },

  botaoPrimario: { padding: 13, borderRadius: 10, alignItems: 'center', backgroundColor: '#1a3a5c' },
  botaoDesabilitado: { opacity: 0.5 },
  botaoPrimarioTexto: { color: '#fff', fontWeight: '700' },
  fechar: { marginTop: 10, alignSelf: 'center', padding: 8 },
  fecharTexto: { color: '#7b8794', fontWeight: '700' },

  resultadoResumo: { fontSize: 14, fontWeight: '700', color: '#1a3a5c', marginBottom: 10 },
  linhaErro: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  linhaErroTexto: { flex: 1, color: '#c0392b', fontSize: 12 },
});

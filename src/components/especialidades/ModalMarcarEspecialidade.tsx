import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import {
  carregarCatalogoEspecialidades,
  marcarEspecialidadeManual,
  normalizarNomeParaComparar,
  type EspecialidadeCatalogo,
} from '../../lib/especialidades';
import { combinaBusca } from '../../lib/texto';

let cacheCatalogoGlobal: EspecialidadeCatalogo[] | null = null;

interface Props {
  visible: boolean;
  onClose: () => void;
  dbvId: number;
  usuarioId?: string | null;
  usuarioNome?: string | null;
  titulo?: string;
  subtitulo?: string;
  /** Restringe a lista a uma categoria específica (ex.: usada no fluxo de "escolha de área" das classes). */
  filtroCategoria?: string;
  onMarcado?: (nome: string) => void;
}

/**
 * Modal reutilizável de "marcar especialidade concluída" pra um membro
 * específico — mesmo fluxo usado na ficha do membro, agora também acessível
 * pela relação de especialidades por membro e pela tela de classes
 * individuais (quando um requisito pede uma especialidade).
 */
export function ModalMarcarEspecialidade({
  visible, onClose, dbvId, usuarioId, usuarioNome, titulo = 'Marcar especialidade',
  subtitulo = 'Marca como concluída mesmo sem atividade no sistema. Fica registrado que foi você quem marcou.',
  filtroCategoria, onMarcado,
}: Props) {
  const [catalogo, setCatalogo] = useState<EspecialidadeCatalogo[]>(cacheCatalogoGlobal ?? []);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(!cacheCatalogoGlobal);
  const [jaTem, setJaTem] = useState<Set<string>>(new Set());
  const [carregandoJaTem, setCarregandoJaTem] = useState(false);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBusca('');
    if (!cacheCatalogoGlobal) {
      setCarregandoCatalogo(true);
      carregarCatalogoEspecialidades()
        .then((lista) => { cacheCatalogoGlobal = lista; setCatalogo(lista); })
        .catch(() => setCatalogo([]))
        .finally(() => setCarregandoCatalogo(false));
    }
    if (dbvId) {
      setCarregandoJaTem(true);
      (async () => {
        try {
          const { data } = await supabase.from('especialidades').select('nome').eq('dbv_id', dbvId).eq('status', 'OK');
          setJaTem(new Set((data ?? []).map((e: any) => normalizarNomeParaComparar(e.nome))));
        } catch {
          setJaTem(new Set());
        } finally {
          setCarregandoJaTem(false);
        }
      })();
    }
  }, [visible, dbvId]);

  async function marcar(nome: string) {
    setSalvando(nome);
    try {
      await marcarEspecialidadeManual({ dbvId, nome, usuarioId, usuarioNome });
      setJaTem((prev) => new Set(prev).add(normalizarNomeParaComparar(nome)));
      onMarcado?.(nome);
      onClose();
    } catch (e: any) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(e?.message ?? 'Não foi possível marcar a especialidade.');
      }
    } finally {
      setSalvando(null);
    }
  }

  const catFiltro = filtroCategoria ? normalizarNomeParaComparar(filtroCategoria) : null;
  const lista = catalogo.filter((c) => {
    if (catFiltro && normalizarNomeParaComparar(c.categoria ?? '') !== catFiltro) return false;
    return combinaBusca(c.nome, busca) || combinaBusca(c.categoria, busca);
  });
  const carregando = carregandoCatalogo || carregandoJaTem;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.card}>
          <Text style={s.titulo}>{titulo}</Text>
          <Text style={s.sub}>{subtitulo}</Text>
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar especialidade..."
            placeholderTextColor="#aaa"
            style={s.input}
          />
          {carregando && <ActivityIndicator color="#1a3a5c" style={{ marginVertical: 16 }} />}
          <ScrollView style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
            {!carregando && lista.length === 0 && (
              <Text style={s.vazio}>Nenhuma especialidade encontrada{filtroCategoria ? ` em "${filtroCategoria}"` : ' no catálogo'}.</Text>
            )}
            {lista.map((c) => {
              const possui = jaTem.has(normalizarNomeParaComparar(c.nome));
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.opcao, possui && s.opcaoDesativada]}
                  disabled={possui || salvando !== null}
                  onPress={() => marcar(c.nome)}
                >
                  <Ionicons name={possui ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={possui ? '#2e7d32' : '#9aa5b1'} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.opcaoNome}>{c.nome}</Text>
                    {!!c.categoria && <Text style={s.opcaoCat}>{c.categoria}</Text>}
                  </View>
                  {salvando === c.nome && <ActivityIndicator size="small" color="#1a3a5c" />}
                  {possui && <Text style={s.opcaoJaTem}>já tem</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={s.fechar} onPress={onClose}>
            <Text style={s.fecharTexto}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: '80%' },
  titulo: { fontSize: 17, fontWeight: '800', color: '#1a3a5c' },
  sub: { fontSize: 12, color: '#7b8794', marginTop: 4, lineHeight: 17 },
  input: {
    borderWidth: 1, borderColor: '#e4eaf1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#222', backgroundColor: '#f8fafc', marginTop: 12,
  },
  vazio: { color: '#8a94a0', textAlign: 'center', marginTop: 24 },
  opcao: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#e4eaf1', backgroundColor: '#fafbfc', marginBottom: 8,
  },
  opcaoDesativada: { opacity: 0.55 },
  opcaoNome: { fontSize: 13, fontWeight: '700', color: '#1f2933' },
  opcaoCat: { fontSize: 11, color: '#8a94a0', marginTop: 2 },
  opcaoJaTem: { fontSize: 10, color: '#2e7d32', fontWeight: '700' },
  fechar: { marginTop: 12, alignSelf: 'center', padding: 8 },
  fecharTexto: { color: '#7b8794', fontWeight: '700' },
});

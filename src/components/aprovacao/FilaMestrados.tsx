import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avisar, confirmar } from '../../stores/avisoStore';
import { useCores } from '../../stores/temaStore';
import { estiloCartao, textoSobre, tomTexto } from '../../lib/tema';
import { aprovarMestrado, devolverMestrado, type ItemFilaMestrado } from '../../lib/mestrados';

const VERMELHO = '#c62828';
const EVENTOS: Record<string, string> = {
  encaminhado: 'Encaminhado automaticamente', reencaminhado: 'Reencaminhado automaticamente', aprovado: 'Aprovado',
  devolvido: 'Devolvido', sinalizado: 'Requisitos deixaram de ser cumpridos', requisitos_restabelecidos: 'Requisitos restabelecidos',
};

function dataBr(iso?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function Selo({ url, nome, tamanho = 62 }: { url: string | null; nome: string; tamanho?: number }) {
  const cores = useCores();
  const [erro, setErro] = useState(false);
  if (url && !erro) {
    return <Image source={{ uri: url }} onError={() => setErro(true)} resizeMode="contain" style={{ width: tamanho * 1.4, height: tamanho }} />;
  }
  return (
    <View style={{ width: tamanho * 1.4, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cores.secundaria, alignItems: 'center', justifyContent: 'center', padding: 6 }}>
      <Text style={{ color: '#432958', fontSize: 9, fontWeight: '900', textAlign: 'center' }} numberOfLines={3}>MESTRE EM {nome.toUpperCase()}</Text>
    </View>
  );
}

/** Devolver com justificativa e, se quiser, apontando as especialidades com pendência. */
function DevolverModal({ item, onClose, onFeito }: { item: ItemFilaMestrado | null; onClose: () => void; onFeito: () => void }) {
  const cores = useCores();
  const [motivo, setMotivo] = useState('');
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  function alternar(id: string) {
    setMarcadas((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function enviar() {
    if (!item) return;
    if (!motivo.trim()) { avisar('Explique o motivo da devolução.', 'info', 'Devolver'); return; }
    setEnviando(true);
    try {
      await devolverMestrado(item.id, motivo.trim(), Array.from(marcadas));
      avisar('Solicitação devolvida. Ela volta sozinha à diretoria quando a pendência for resolvida.', 'sucesso', 'Devolvida');
      setMotivo(''); setMarcadas(new Set());
      onFeito();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível devolver.', 'erro', 'Devolver');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[s.fundo, { backgroundColor: cores.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.caixa, { backgroundColor: cores.cartao }]}>
          <Text style={[s.titulo, { color: cores.texto }]}>Devolver — {item?.mestrado.nome}</Text>
          <Text style={[s.sub, { color: cores.textoSecundario }]}>{item?.dbvNome}</Text>
          {(item?.especialidadesUsadas.length ?? 0) > 0 ? (
            <>
              <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Especialidades com pendência (opcional)</Text>
              <ScrollView style={{ maxHeight: 170 }}>
                {item!.especialidadesUsadas.map((e) => {
                  const ativo = marcadas.has(e.id);
                  return (
                    <TouchableOpacity key={e.id} onPress={() => alternar(e.id)} accessibilityRole="checkbox" accessibilityState={{ checked: ativo }} style={[s.linhaEsp, { borderColor: cores.borda }]}>
                      <View style={[s.caixaMarca, { borderColor: cores.borda }, ativo && { backgroundColor: VERMELHO, borderColor: VERMELHO }]}>{ativo ? <Ionicons name="close" size={14} color="#fff" /> : null}</View>
                      <Text style={{ color: cores.texto, flex: 1, fontSize: 13 }}>{e.nome}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
          <Text style={[s.rotulo, { color: cores.textoSecundario }]}>Motivo</Text>
          <TextInput
            value={motivo} onChangeText={setMotivo} multiline placeholder="Explique o que precisa ser resolvido"
            placeholderTextColor={cores.placeholder}
            style={[s.input, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={[s.botao, { flex: 1, backgroundColor: cores.fundo }]} onPress={onClose} disabled={enviando} accessibilityRole="button">
              <Text style={{ color: cores.texto, fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.botao, { flex: 1, backgroundColor: VERMELHO }, enviando && { opacity: 0.6 }]} onPress={enviar} disabled={enviando} accessibilityRole="button">
              {enviando ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Devolver</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Solicitações de mestrado da tela Aprovações. Chegam sozinhas (o banco encaminha quando o membro
 * cumpre os requisitos); aqui a diretoria aprova ou devolve com justificativa.
 */
export function FilaMestrados({ itens, podeAprovar, onMudou }: { itens: ItemFilaMestrado[]; podeAprovar: boolean; onMudou: () => void }) {
  const cores = useCores();
  const [devolvendo, setDevolvendo] = useState<ItemFilaMestrado | null>(null);
  const [aprovando, setAprovando] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Record<string, 'esp' | 'hist' | undefined>>({});
  const pendentes = itens.filter((i) => i.etapa === 'diretoria');
  const devolvidos = itens.filter((i) => i.etapa === 'devolvido');
  if (itens.length === 0) return null;

  async function aprovar(item: ItemFilaMestrado) {
    const ok = await confirmar('Aprovar mestrado', `Aprovar o mestrado em ${item.mestrado.nome} de ${item.dbvNome}? Ele fica pronto para a próxima investidura.`, 'Aprovar');
    if (!ok) return;
    setAprovando(item.id);
    try {
      await aprovarMestrado(item.id);
      onMudou();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível aprovar.', 'erro', 'Aprovar');
      onMudou();
    } finally {
      setAprovando(null);
    }
  }

  function cartao(item: ItemFilaMestrado, devolvido: boolean) {
    const painel = aberto[item.id];
    const alternarPainel = (p: 'esp' | 'hist') => setAberto((a) => ({ ...a, [item.id]: a[item.id] === p ? undefined : p }));
    return (
      <View key={item.id} style={[s.card, estiloCartao(cores, 20)]}>
        <View style={s.topo}>
          <Selo url={item.mestrado.imagemUrl} nome={item.mestrado.nome} />
          <View style={{ flex: 1 }}>
            <Text style={[s.nome, { color: cores.texto }]}>Mestre em {item.mestrado.nome}</Text>
            <Text style={[s.sub, { color: cores.textoSecundario }]}>{item.dbvNome}{item.unidadeNome ? ` · ${item.unidadeNome}` : ''}</Text>
            <Text style={[s.sub, { color: cores.textoSecundario }]}>
              {item.requisitos.total} de {item.requisitos.necessarias} especialidades exigidas · encaminhado em {dataBr(item.encaminhadoEm)} · regra v{item.versaoRegra}
            </Text>
          </View>
        </View>
        {item.reenviada ? (
          <View style={[s.selo, { backgroundColor: '#f59e0b22' }]}>
            <Ionicons name="refresh" size={13} color={tomTexto('#b45309', cores)} />
            <Text style={[s.seloTexto, { color: tomTexto('#b45309', cores) }]}>Reencaminhado após a pendência ser resolvida</Text>
          </View>
        ) : null}
        {item.alertaRequisitos ? (
          <View style={[s.selo, { backgroundColor: `${VERMELHO}18` }]}>
            <Ionicons name="warning" size={13} color={tomTexto(VERMELHO, cores)} />
            <Text style={[s.seloTexto, { color: tomTexto(VERMELHO, cores) }]}>Uma especialidade deixou de contar: aprovação bloqueada até os requisitos voltarem.</Text>
          </View>
        ) : null}
        {devolvido && item.motivo ? <Text style={[s.sub, { color: cores.texto }]}>Devolvido: {item.motivo}</Text> : null}

        <View style={s.linkes}>
          <TouchableOpacity onPress={() => alternarPainel('esp')} accessibilityRole="button"><Text style={[s.link, { color: cores.acento }]}>{painel === 'esp' ? 'Ocultar' : 'Ver'} especialidades ({item.especialidadesUsadas.length})</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => alternarPainel('hist')} accessibilityRole="button"><Text style={[s.link, { color: cores.acento }]}>{painel === 'hist' ? 'Ocultar' : 'Ver'} histórico</Text></TouchableOpacity>
        </View>
        {painel === 'esp' ? (
          <View style={{ gap: 3 }}>{item.especialidadesUsadas.map((e) => <Text key={e.id} style={{ color: cores.texto, fontSize: 12 }}>• {e.nome}</Text>)}</View>
        ) : null}
        {painel === 'hist' ? (
          <View style={{ gap: 3 }}>
            {item.historico.map((h, i) => (
              <Text key={i} style={{ color: cores.texto, fontSize: 12 }}>
                {dataBr(h.em)} — {EVENTOS[h.evento] ?? h.evento}{h.detalhes?.motivo ? `: ${h.detalhes.motivo}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        {podeAprovar && !devolvido ? (
          <View style={s.acoes}>
            <TouchableOpacity style={[s.btnSec, { backgroundColor: `${VERMELHO}18` }]} onPress={() => setDevolvendo(item)} accessibilityRole="button">
              <Ionicons name="return-down-back" size={15} color={tomTexto(VERMELHO, cores)} />
              <Text style={[s.btnSecTexto, { color: tomTexto(VERMELHO, cores) }]}>Devolver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnPrim, { backgroundColor: cores.primaria }, (aprovando === item.id || item.alertaRequisitos) && { opacity: 0.5 }]}
              onPress={() => aprovar(item)}
              disabled={aprovando === item.id || item.alertaRequisitos}
              accessibilityRole="button"
            >
              {aprovando === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark-done" size={15} color={textoSobre(cores.primaria)} />}
              <Text style={[s.btnPrimTexto, { color: textoSobre(cores.primaria) }]}>Aprovar</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {pendentes.length > 0 ? <Text style={[s.cabecalho, { color: cores.textoSecundario }]}>Mestrados para aprovar ({pendentes.length})</Text> : null}
      {pendentes.map((i) => cartao(i, false))}
      {devolvidos.length > 0 ? (
        <>
          <Text style={[s.cabecalho, { color: cores.textoSecundario, marginTop: 8 }]}>Mestrados devolvidos ({devolvidos.length})</Text>
          <Text style={[s.sub, { color: cores.textoSecundario, marginBottom: 8 }]}>Voltam sozinhos para aprovação quando a pendência for resolvida.</Text>
          {devolvidos.map((i) => cartao(i, true))}
        </>
      ) : null}
      <DevolverModal item={devolvendo} onClose={() => setDevolvendo(null)} onFeito={() => { setDevolvendo(null); onMudou(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  cabecalho: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, marginTop: 2 },
  card: { padding: 14, marginBottom: 10, gap: 8 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nome: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 12, marginTop: 1 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  seloTexto: { fontSize: 11, fontWeight: '800', flexShrink: 1 },
  linkes: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  link: { fontSize: 12, fontWeight: '800' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  btnSec: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 38, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' },
  btnSecTexto: { fontSize: 12, fontWeight: '800' },
  btnPrim: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center' },
  btnPrimTexto: { fontSize: 12, fontWeight: '900' },
  fundo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  caixa: { width: '100%', maxWidth: 460, borderRadius: 20, padding: 18, gap: 6 },
  titulo: { fontSize: 17, fontWeight: '900' },
  rotulo: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  linhaEsp: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, borderBottomWidth: 1 },
  caixaMarca: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 74, fontSize: 14, textAlignVertical: 'top' },
  botao: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});

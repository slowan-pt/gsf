import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { avisar, confirmar } from '../../stores/avisoStore';
import { useCores } from '../../stores/temaStore';
import { corIcone, estiloCartao, textoSobre, tomTexto } from '../../lib/tema';
import { IconeItem } from './IconeItem';
import {
  aprovarClasse, carregarRequisitosDoItem, chaveFichaClasse, recusarClasse,
  type ItemFluxo, type RequisitoDoItem, type RequisitoRecusado,
} from '../../lib/fluxoClasses';

const VERMELHO = '#c62828';

function rotuloRequisito(r: { codigo: string; subitem?: string | null }) {
  return `${r.codigo}${r.subitem ? `.${r.subitem}` : ''}`;
}

/** Quem recusou, por extenso. */
function quemRecusou(item: ItemFluxo) {
  return item.recusadoPor === 'regional' ? 'pelo regional' : 'pela diretoria';
}

/** Mostra o motivo e os requisitos apontados na recusa. */
export function PendenciaModal({ item, onClose }: { item: ItemFluxo | null; onClose: () => void }) {
  const cores = useCores();
  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.fundo, { backgroundColor: cores.overlay }]}>
        <View style={[s.caixa, { backgroundColor: cores.cartao }]}>
          <Text style={[s.titulo, { color: cores.texto }]}>Pendência — {item?.itemNome}</Text>
          {item ? (
            <Text style={[s.sub, { color: cores.textoSecundario }]}>Recusada {quemRecusou(item)} · {item.dbvNome}</Text>
          ) : null}
          <ScrollView style={{ maxHeight: 360 }}>
            <Text style={[s.rotuloCampo, { color: cores.textoSecundario }]}>Motivo</Text>
            <Text style={[s.motivo, { color: cores.texto }]}>{item?.motivo || 'Sem motivo informado.'}</Text>
            <Text style={[s.rotuloCampo, { color: cores.textoSecundario }]}>Itens recusados</Text>
            {(item?.requisitosRecusados ?? []).map((r: RequisitoRecusado) => (
              <View key={r.id} style={[s.reqLinha, { borderColor: cores.borda }]}>
                <Ionicons name="close-circle" size={18} color={tomTexto(VERMELHO, cores)} />
                <Text style={[s.reqTexto, { color: cores.texto }]}><Text style={{ fontWeight: '900' }}>{rotuloRequisito(r)} </Text>{r.texto}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[s.botao, { backgroundColor: cores.primaria }]} onPress={onClose} accessibilityRole="button">
            <Text style={{ color: textoSobre(cores.primaria), fontWeight: '900' }}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** Escolhe quais requisitos recusar e o motivo. */
function RecusaModal({ item, clubeId, onClose, onFeito }: {
  item: ItemFluxo | null; clubeId: number; onClose: () => void; onFeito: () => void;
}) {
  const cores = useCores();
  const [requisitos, setRequisitos] = useState<RequisitoDoItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!item) return;
    setMarcados(new Set()); setMotivo(''); setRequisitos([]); setCarregando(true);
    carregarRequisitosDoItem(clubeId, item.dbvId, item.itemNome)
      .then(setRequisitos)
      .catch((e: any) => avisar(e?.message ?? 'Não foi possível carregar os requisitos.', 'erro'))
      .finally(() => setCarregando(false));
  }, [item, clubeId]);

  function alternar(id: number) {
    setMarcados((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function enviar() {
    if (!item) return;
    if (marcados.size === 0) { avisar('Marque ao menos um requisito para recusar.', 'info', 'Recusar'); return; }
    if (!motivo.trim()) { avisar('Explique o motivo da recusa.', 'info', 'Recusar'); return; }
    setEnviando(true);
    try {
      await recusarClasse({ clubeId, dbvId: item.dbvId, itemNome: item.itemNome, requisitoIds: Array.from(marcados), motivo: motivo.trim() });
      avisar('Classe devolvida para correção.', 'sucesso', 'Recusada');
      onFeito();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível recusar.', 'erro', 'Recusar');
    } finally {
      setEnviando(false);
    }
  }

  const secoes = Array.from(new Set(requisitos.map((r) => r.secao)));
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[s.fundo, { backgroundColor: cores.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.caixa, { backgroundColor: cores.cartao, maxHeight: '90%' }]}>
          <Text style={[s.titulo, { color: cores.texto }]}>Recusar — {item?.itemNome}</Text>
          <Text style={[s.sub, { color: cores.textoSecundario }]}>{item?.dbvNome} · marque o que precisa ser corrigido</Text>
          {carregando ? <ActivityIndicator color={corIcone(cores)} style={{ marginVertical: 16 }} /> : null}
          <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
            {secoes.map((sec) => (
              <View key={sec || 'geral'}>
                {sec ? <Text style={[s.secao, { color: cores.textoSecundario }]}>{sec}</Text> : null}
                {requisitos.filter((r) => r.secao === sec).map((r) => {
                  const ativo = marcados.has(r.id);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => alternar(r.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: ativo }}
                      style={[s.reqLinha, { borderColor: cores.borda }]}
                    >
                      <View style={[s.caixaCheck, { borderColor: cores.borda }, ativo && { backgroundColor: VERMELHO, borderColor: VERMELHO }]}>
                        {ativo ? <Ionicons name="close" size={14} color="#fff" /> : null}
                      </View>
                      <Text style={[s.reqTexto, { color: cores.texto }]} numberOfLines={3}>
                        <Text style={{ fontWeight: '900' }}>{rotuloRequisito(r)} </Text>{r.texto}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <Text style={[s.rotuloCampo, { color: cores.textoSecundario }]}>Motivo (o membro vai ler isto)</Text>
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            multiline
            placeholder="Explique o que precisa ser refeito"
            placeholderTextColor={cores.placeholder}
            style={[s.input, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }]}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={[s.botao, { flex: 1, backgroundColor: cores.fundo }]} onPress={onClose} accessibilityRole="button">
              <Text style={{ color: cores.texto, fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.botao, { flex: 1, backgroundColor: VERMELHO }, (enviando || marcados.size === 0) && { opacity: 0.55 }]}
              onPress={enviar}
              disabled={enviando}
              accessibilityRole="button"
            >
              {enviando ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Recusar ({marcados.size})</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Caixa de marcar das listas em lote. */
function CaixaMarcar({ ativo, aoAlternar, rotulo }: { ativo: boolean; aoAlternar: () => void; rotulo: string }) {
  const cores = useCores();
  return (
    <TouchableOpacity
      onPress={aoAlternar}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ativo }}
      accessibilityLabel={rotulo}
      hitSlop={8}
      style={[s.caixaCheck, { borderColor: cores.borda }, ativo && { backgroundColor: cores.primaria, borderColor: cores.primaria }]}
    >
      {ativo ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
    </TouchableOpacity>
  );
}

/**
 * Fila de classes da tela Aprovações: o que o usuário pode aprovar/recusar agora
 * (diretoria ou regional) e as tarjas de classes que voltaram para correção.
 */
export function FilaClasses({ clubeId, paraMim, emCorrecao, comDiretoria = [], comRegional = [], podeDiretoria, podeRegional, onMudou }: {
  clubeId: number;
  paraMim: ItemFluxo[];
  emCorrecao: ItemFluxo[];
  /** Classes que ainda estão com a diretoria (só leitura, para o regional). */
  comDiretoria?: ItemFluxo[];
  /** Classes já aprovadas pela diretoria que estão com o regional (só leitura, para a diretoria). */
  comRegional?: ItemFluxo[];
  podeDiretoria: boolean;
  podeRegional: boolean;
  onMudou: () => void;
}) {
  const cores = useCores();
  const [recusando, setRecusando] = useState<ItemFluxo | null>(null);
  const [vendo, setVendo] = useState<ItemFluxo | null>(null);
  const [aprovando, setAprovando] = useState<number | null>(null);
  const ambos = podeDiretoria && podeRegional;
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [aprovandoLote, setAprovandoLote] = useState(false);
  const emLote = paraMim.length > 1;
  const itensMarcados = paraMim.filter((i) => selecionados.has(i.id));
  const todosMarcados = paraMim.length > 0 && itensMarcados.length === paraMim.length;

  // Some da seleção o que saiu da fila (aprovado/recusado em outro lugar).
  useEffect(() => {
    setSelecionados((prev) => {
      const ids = new Set(paraMim.map((i) => i.id));
      const novo = new Set(Array.from(prev).filter((id) => ids.has(id)));
      return novo.size === prev.size ? prev : novo;
    });
  }, [paraMim]);

  function alternarMarca(id: number) {
    setSelecionados((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function alternarTodos() {
    setSelecionados(todosMarcados ? new Set() : new Set(paraMim.map((i) => i.id)));
  }

  async function aprovarLote() {
    const lista = itensMarcados;
    if (lista.length === 0) return;
    const ok = await confirmar(
      'Aprovar em lote',
      `Aprovar ${lista.length} ${lista.length === 1 ? 'classe' : 'classes'}? As da diretoria seguem para o regional; as do regional passam a aguardar a investidura.`,
      'Aprovar',
    );
    if (!ok) return;
    setAprovandoLote(true);
    let feitas = 0;
    const falhas: string[] = [];
    for (const item of lista) {
      try {
        await aprovarClasse(clubeId, item.dbvId, item.itemNome);
        feitas += 1;
      } catch {
        falhas.push(`${item.itemNome} de ${item.dbvNome}`);
      }
    }
    setAprovandoLote(false);
    setSelecionados(new Set());
    if (falhas.length === 0) avisar(`${feitas} ${feitas === 1 ? 'classe aprovada' : 'classes aprovadas'}.`, 'sucesso', 'Aprovadas');
    else avisar(`${feitas} aprovada(s). Não foi possível aprovar: ${falhas.join(', ')}.`, 'erro', 'Aprovar em lote');
    onMudou();
  }

  function barraLote() {
    if (!emLote) return null;
    const n = itensMarcados.length;
    return (
      <View style={[s.barraLote, estiloCartao(cores, 16)]}>
        <TouchableOpacity style={s.barraSel} onPress={alternarTodos} accessibilityRole="checkbox" accessibilityState={{ checked: todosMarcados }}>
          <CaixaMarcar ativo={todosMarcados} aoAlternar={alternarTodos} rotulo="Selecionar todas" />
          <Text style={[s.sub, { color: cores.texto, fontWeight: '800' }]}>{n === 0 ? 'Selecionar todas' : `${n} de ${paraMim.length} selecionadas`}</Text>
        </TouchableOpacity>
        {n > 0 ? (
          <View style={s.barraAcoes}>
            <Text style={[s.sub, { color: cores.textoSecundario, flex: 1, minWidth: 140 }]}>Recusar é individual: indique os requisitos e o motivo no cartão.</Text>
            <TouchableOpacity style={[s.btnPrim, { backgroundColor: cores.primaria }, aprovandoLote && { opacity: 0.6 }]} onPress={aprovarLote} disabled={aprovandoLote} accessibilityRole="button">
              {aprovandoLote ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark-done" size={15} color="#fff" />}
              <Text style={s.btnPrimTexto}>Aprovar ({n})</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  async function aprovar(item: ItemFluxo) {
    const destino = item.etapa === 'diretoria' ? 'segue para a análise do regional' : 'passa a aguardar a investidura';
    const ok = await confirmar('Aprovar classe', `Aprovar "${item.itemNome}" de ${item.dbvNome}? Ela ${destino}.`, 'Aprovar');
    if (!ok) return;
    setAprovando(item.id);
    try {
      await aprovarClasse(clubeId, item.dbvId, item.itemNome);
      onMudou();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível aprovar.', 'erro', 'Aprovar');
    } finally {
      setAprovando(null);
    }
  }

  function cartao(item: ItemFluxo) {
    return (
      <View key={item.id} style={[s.card, estiloCartao(cores, 20)]}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => router.push(`/membro/${item.dbvId}?aba=classes` as any)} accessibilityRole="button">
          {emLote ? <CaixaMarcar ativo={selecionados.has(item.id)} aoAlternar={() => alternarMarca(item.id)} rotulo={`Selecionar ${item.itemNome} de ${item.dbvNome}`} /> : null}
          <IconeItem tipo="classe" nome={item.itemNome} insignias={new Map()} tamanho={38} />
          <View style={{ flex: 1 }}>
            <Text style={[s.nome, { color: cores.texto }]}>{item.itemNome}</Text>
            <Text style={[s.sub, { color: cores.textoSecundario }]}>{item.dbvNome} · {item.unidadeNome}</Text>
          </View>
        </TouchableOpacity>
        {item.concluidaEm ? (
          <Text style={[s.sub, { color: cores.textoSecundario }]}>Concluída em {item.concluidaEm.slice(8, 10)}/{item.concluidaEm.slice(5, 7)}/{item.concluidaEm.slice(0, 4)}</Text>
        ) : null}
        {ambos ? (
          <Text style={[s.etapa, { color: cores.acento }]}>{item.etapa === 'regional' ? 'Etapa: regional' : 'Etapa: diretoria'}</Text>
        ) : null}
        {item.reenviada ? (
          <View style={[s.selo, { backgroundColor: '#f59e0b22' }]}>
            <Ionicons name="refresh" size={13} color={tomTexto('#b45309', cores)} />
            <Text style={[s.seloTexto, { color: tomTexto('#b45309', cores) }]}>Corrigida após recusa {quemRecusou(item)}</Text>
          </View>
        ) : null}
        <View style={s.acoes}>
          {item.requisitosRecusados.length > 0 ? (
            <TouchableOpacity style={[s.btnSec, { backgroundColor: cores.acentoSuave }]} onPress={() => setVendo(item)} accessibilityRole="button">
              <Text style={[s.btnSecTexto, { color: cores.acento }]}>Ver pendência</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[s.btnSec, { backgroundColor: `${VERMELHO}18` }]} onPress={() => setRecusando(item)} accessibilityRole="button">
            <Ionicons name="close" size={15} color={tomTexto(VERMELHO, cores)} />
            <Text style={[s.btnSecTexto, { color: tomTexto(VERMELHO, cores) }]}>Recusar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btnPrim, { backgroundColor: cores.primaria }, aprovando === item.id && { opacity: 0.6 }]}
            onPress={() => aprovar(item)}
            disabled={aprovando === item.id}
            accessibilityRole="button"
          >
            {aprovando === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark-done" size={15} color="#fff" />}
            <Text style={s.btnPrimTexto}>Aprovar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      {paraMim.length > 0 ? (
        <Text style={[s.cabecalho, { color: cores.textoSecundario }]}>Classes para aprovar ({paraMim.length})</Text>
      ) : null}
      {barraLote()}
      {paraMim.map(cartao)}
      {itensMarcados.length > 0 && paraMim.length > 3 ? barraLote() : null}

      {comRegional.length > 0 ? (
        <>
          <Text style={[s.cabecalho, { color: cores.textoSecundario, marginTop: paraMim.length > 0 ? 8 : 0 }]}>Com o regional ({comRegional.length})</Text>
          <Text style={[s.sub, { color: cores.textoSecundario, marginBottom: 8 }]}>Já aprovadas por você. Essa etapa agora é do regional.</Text>
          {comRegional.map((item) => (
            <View key={item.id} style={[s.tarja, { backgroundColor: cores.acentoSuave, borderColor: cores.borda }]}>
              <Ionicons name="hourglass-outline" size={18} color={cores.acento} />
              <View style={{ flex: 1 }}>
                <Text style={[s.nome, { color: cores.texto }]}>{item.itemNome}</Text>
                <Text style={[s.sub, { color: cores.textoSecundario }]}>{item.dbvNome} · {item.unidadeNome}</Text>
              </View>
              <Text style={[s.selo, { color: cores.acento, backgroundColor: 'transparent' }]}>Aguardando regional</Text>
            </View>
          ))}
        </>
      ) : null}

      {comDiretoria.length > 0 ? (
        <>
          <Text style={[s.cabecalho, { color: cores.textoSecundario, marginTop: paraMim.length > 0 ? 8 : 0 }]}>Ainda com a diretoria ({comDiretoria.length})</Text>
          <Text style={[s.sub, { color: cores.textoSecundario, marginBottom: 8 }]}>Chegam para a sua aprovação quando a diretoria aprovar.</Text>
          {comDiretoria.map((item) => (
            <View key={item.id} style={[s.tarja, { backgroundColor: cores.acentoSuave, borderColor: cores.borda }]}>
              <Ionicons name="hourglass-outline" size={18} color={cores.acento} />
              <View style={{ flex: 1 }}>
                <Text style={[s.nome, { color: cores.texto }]}>{item.itemNome}</Text>
                <Text style={[s.sub, { color: cores.textoSecundario }]}>{item.dbvNome} · {item.unidadeNome}</Text>
              </View>
            </View>
          ))}
        </>
      ) : null}

      {emCorrecao.length > 0 ? (
        <>
          <Text style={[s.cabecalho, { color: cores.textoSecundario, marginTop: 8 }]}>Aguardando correção do membro ({emCorrecao.length})</Text>
          {emCorrecao.map((item) => (
            <View key={item.id} style={[s.tarja, { backgroundColor: `${VERMELHO}14`, borderColor: `${VERMELHO}55` }]}>
              <Ionicons name="lock-closed" size={18} color={tomTexto(VERMELHO, cores)} />
              <View style={{ flex: 1 }}>
                <Text style={[s.nome, { color: cores.texto }]}>{item.itemNome}</Text>
                <Text style={[s.sub, { color: cores.textoSecundario }]}>{item.dbvNome} · recusada {quemRecusou(item)}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity style={[s.btnSec, { backgroundColor: `${VERMELHO}18` }]} onPress={() => setVendo(item)} accessibilityRole="button">
                  <Text style={[s.btnSecTexto, { color: tomTexto(VERMELHO, cores) }]}>Ver pendência</Text>
                </TouchableOpacity>
                {podeDiretoria ? (
                  <TouchableOpacity
                    style={[s.btnPrim, { backgroundColor: cores.primaria }]}
                    onPress={() => router.push(`/classes/${item.dbvId}?chave=${encodeURIComponent(chaveFichaClasse(item))}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`Corrigir ${item.itemNome} de ${item.dbvNome}`}
                  >
                    <Ionicons name="create-outline" size={15} color="#fff" />
                    <Text style={s.btnPrimTexto}>Corrigir</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      <RecusaModal item={recusando} clubeId={clubeId} onClose={() => setRecusando(null)} onFeito={() => { setRecusando(null); onMudou(); }} />
      <PendenciaModal item={vendo} onClose={() => setVendo(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  cabecalho: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, marginTop: 2 },
  card: { padding: 14, marginBottom: 10, gap: 6 },
  nome: { fontSize: 15, fontWeight: '900' },
  sub: { fontSize: 12 },
  etapa: { fontSize: 11, fontWeight: '800' },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  seloTexto: { fontSize: 11, fontWeight: '800' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, justifyContent: 'flex-end' },
  btnSec: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 38, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' },
  btnSecTexto: { fontSize: 12, fontWeight: '800' },
  btnPrim: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center' },
  btnPrimTexto: { color: '#fff', fontSize: 12, fontWeight: '900' },
  barraLote: { padding: 12, marginBottom: 10, gap: 10 },
  barraSel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barraAcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  tarja: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  fundo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  caixa: { width: '100%', maxWidth: 460, borderRadius: 20, padding: 18, gap: 6 },
  titulo: { fontSize: 17, fontWeight: '900' },
  secao: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 8, marginBottom: 2 },
  rotuloCampo: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  motivo: { fontSize: 14, lineHeight: 20 },
  reqLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 8, borderBottomWidth: 1 },
  reqTexto: { flex: 1, fontSize: 13, lineHeight: 18 },
  caixaCheck: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 74, fontSize: 14, textAlignVertical: 'top' },
  botao: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});

import { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ehEscolhaDeAreaEspecialidade,
  type EspecialidadeElegivel,
  type RequisitoCatalogo,
} from '../../lib/classesRequisitos';

const ICONE_ORIGEM: Record<string, { icone: string; cor: string; rotulo: string }> = {
  manual: { icone: 'checkmark-circle', cor: '#16a34a', rotulo: 'Marcado pela secretaria' },
  atividade: { icone: 'clipboard', cor: '#2563eb', rotulo: 'Concluído por atividade' },
  especialidade: { icone: 'ribbon', cor: '#7c3aed', rotulo: 'Concluído pela especialidade' },
};

export interface ContextoRequisito {
  concluidos: Set<number>;
  origens: Map<number, string>;
  /** requisito_id -> nome da especialidade vinculada (para requisitos de "escolha uma área"). */
  especialidadeVinculada: Map<number, string>;
  podeMarcar: boolean;
  salvandoId: number | null;
  onAlternar: (req: RequisitoCatalogo) => void;
  carregarEspecialidadesElegiveis: (req: RequisitoCatalogo, area: string) => Promise<EspecialidadeElegivel[]>;
  onEscolherEspecialidade: (req: RequisitoCatalogo, especialidadeNome: string | null) => Promise<void>;
}

interface Props {
  requisito: RequisitoCatalogo;
  filhos: RequisitoCatalogo[];
  bloqueado: boolean;
  ctx: ContextoRequisito;
  nivel?: 'raiz' | 'filho';
  ehAreaEspecialidade?: boolean;
}

export function RequisitoLinha({ requisito, filhos, bloqueado, ctx, nivel = 'raiz', ehAreaEspecialidade = false }: Props) {
  const [aberto, setAberto] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [opcoes, setOpcoes] = useState<EspecialidadeElegivel[] | null>(null);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);

  const feito = ctx.concluidos.has(requisito.id);
  const origem = ctx.origens.get(requisito.id);
  const info = origem ? ICONE_ORIGEM[origem] : null;
  const ehFilho = nivel === 'filho';
  const especialidadeEscolhida = ctx.especialidadeVinculada.get(requisito.id);

  const rotuloCodigo = requisito.subitem ? `${requisito.subitem})` : `${requisito.codigo}`;

  async function abrirSeletorEspecialidade() {
    if (!ctx.podeMarcar || bloqueado) return;
    setModalAberto(true);
    setCarregandoOpcoes(true);
    try {
      const lista = await ctx.carregarEspecialidadesElegiveis(requisito, requisito.texto);
      setOpcoes(lista);
    } catch {
      setOpcoes([]);
    } finally {
      setCarregandoOpcoes(false);
    }
  }

  async function escolher(nome: string | null) {
    setEscolhendo(true);
    try {
      await ctx.onEscolherEspecialidade(requisito, nome);
      setModalAberto(false);
    } finally {
      setEscolhendo(false);
    }
  }

  function onPressLinha() {
    if (ehAreaEspecialidade) {
      abrirSeletorEspecialidade();
      return;
    }
    ctx.onAlternar(requisito);
  }

  return (
    <View style={[s.card, ehFilho && s.cardFilho, feito && s.cardFeito, bloqueado && s.cardBloqueado]}>
      <View style={s.linha}>
        <TouchableOpacity
          style={[
            ehFilho ? s.checkPequeno : s.check,
            feito && s.checkFeito,
            (!ctx.podeMarcar || bloqueado) && s.checkBloqueado,
          ]}
          onPress={onPressLinha}
          disabled={!ctx.podeMarcar || ctx.salvandoId === requisito.id || (bloqueado && !feito)}
        >
          {ctx.salvandoId === requisito.id
            ? <ActivityIndicator size="small" color={feito ? '#fff' : '#1a3a5c'} />
            : feito
              ? <Ionicons name="checkmark" size={ehFilho ? 12 : 15} color="#fff" />
              : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={filhos.length > 0 || ehAreaEspecialidade ? 0.7 : 1}
          onPress={() => {
            if (ehAreaEspecialidade) { abrirSeletorEspecialidade(); return; }
            if (filhos.length > 0) setAberto((v) => !v);
          }}
        >
          <Text style={[ehFilho ? s.textoFilho : s.texto, feito && s.textoFeito]}>
            <Text style={s.codigo}>{rotuloCodigo} </Text>
            {requisito.texto}
          </Text>

          <View style={s.meta}>
            {!!info && (
              <View style={[s.tag, { backgroundColor: `${info.cor}1a` }]}>
                <Ionicons name={info.icone as any} size={11} color={info.cor} />
                <Text style={[s.tagText, { color: info.cor }]}>{info.rotulo}</Text>
              </View>
            )}
            {!!requisito.especialidade_nome && (
              <View style={[s.tag, { backgroundColor: '#ede9fe' }]}>
                <Ionicons name="ribbon-outline" size={11} color="#7c3aed" />
                <Text style={[s.tagText, { color: '#7c3aed' }]}>{requisito.especialidade_nome}</Text>
              </View>
            )}
            {ehAreaEspecialidade && especialidadeEscolhida && (
              <View style={[s.tag, { backgroundColor: '#ede9fe' }]}>
                <Ionicons name="ribbon" size={11} color="#7c3aed" />
                <Text style={[s.tagText, { color: '#7c3aed' }]}>{especialidadeEscolhida}</Text>
              </View>
            )}
            {ehAreaEspecialidade && !especialidadeEscolhida && (
              <Text style={s.avisoEscolha}>toque para escolher a especialidade</Text>
            )}
            {bloqueado && !feito && (
              <Text style={s.avisoGrupo}>já atingiu o mínimo desta seção</Text>
            )}
            {filhos.length > 0 && (
              <Text style={s.contador}>
                {aberto ? '▾' : '▸'} {filhos.length} {filhos.length === 1 ? 'item' : 'itens'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {aberto && filhos.map((f) => (
        <RequisitoLinha
          key={f.id}
          requisito={f}
          filhos={[]}
          bloqueado={false}
          ctx={ctx}
          nivel="filho"
          ehAreaEspecialidade={ehEscolhaDeAreaEspecialidade(requisito, filhos)}
        />
      ))}

      <Modal visible={modalAberto} transparent animationType="fade" onRequestClose={() => setModalAberto(false)}>
        <View style={s.modalFundo}>
          <View style={s.modalCaixa}>
            <Text style={s.modalTitulo}>Escolher especialidade</Text>
            <Text style={s.modalSub}>{requisito.texto}</Text>

            {carregandoOpcoes ? (
              <ActivityIndicator size="large" color="#1a3a5c" style={{ marginVertical: 24 }} />
            ) : !opcoes || opcoes.length === 0 ? (
              <Text style={s.modalVazio}>
                Nenhuma especialidade concluída nesta área ainda. Complete uma especialidade correspondente antes de marcar este requisito.
              </Text>
            ) : (
              <View style={{ gap: 8, marginTop: 8 }}>
                {opcoes.map((op) => {
                  const desabilitada = op.vinculadaOutroRequisito && !op.vinculadaAqui;
                  return (
                    <TouchableOpacity
                      key={op.nome}
                      style={[s.opcao, op.vinculadaAqui && s.opcaoAtiva, desabilitada && s.opcaoDesabilitada]}
                      disabled={desabilitada || escolhendo}
                      onPress={() => escolher(op.vinculadaAqui ? null : op.nome)}
                    >
                      <Ionicons
                        name={op.vinculadaAqui ? 'checkmark-circle' : 'ribbon-outline'}
                        size={18}
                        color={op.vinculadaAqui ? '#16a34a' : desabilitada ? '#aab4bf' : '#7c3aed'}
                      />
                      <Text style={[s.opcaoTexto, desabilitada && s.opcaoTextoDesabilitado]}>{op.nome}</Text>
                      {desabilitada && <Text style={s.opcaoAviso}>já usada em outro requisito</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={s.modalFechar} onPress={() => setModalAberto(false)} disabled={escolhendo}>
              <Text style={s.modalFecharTexto}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
  cardFilho: { backgroundColor: '#f8fafc', marginLeft: 20, marginTop: 8, marginBottom: 0, elevation: 0 },
  cardFeito: { backgroundColor: '#f0fdf4' },
  cardBloqueado: { opacity: 0.55 },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#c3ccd6',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkPequeno: {
    width: 19, height: 19, borderRadius: 5, borderWidth: 2, borderColor: '#c3ccd6',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkFeito: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkBloqueado: { opacity: 0.45 },
  texto: { fontSize: 13, color: '#1f2933', lineHeight: 19 },
  textoFilho: { fontSize: 12, color: '#3e4c59', lineHeight: 17 },
  textoFeito: { color: '#5c7a68' },
  codigo: { fontWeight: '800', color: '#1a3a5c' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '700' },
  avisoGrupo: { fontSize: 10, color: '#b45309', fontStyle: 'italic' },
  avisoEscolha: { fontSize: 10, color: '#7c3aed', fontWeight: '700' },
  contador: { fontSize: 11, color: '#7b8794', fontWeight: '600' },

  modalFundo: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 20 },
  modalCaixa: { backgroundColor: '#fff', borderRadius: 16, padding: 18, maxHeight: '80%' },
  modalTitulo: { fontSize: 16, fontWeight: '800', color: '#1a3a5c' },
  modalSub: { fontSize: 12, color: '#7b8794', marginTop: 4 },
  modalVazio: { fontSize: 13, color: '#7b8794', marginTop: 16, lineHeight: 19 },
  opcao: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#e4eaf1', backgroundColor: '#fafbfc',
  },
  opcaoAtiva: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  opcaoDesabilitada: { opacity: 0.5 },
  opcaoTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1f2933' },
  opcaoTextoDesabilitado: { color: '#7b8794' },
  opcaoAviso: { fontSize: 9, color: '#b45309', fontStyle: 'italic' },
  modalFechar: { marginTop: 16, alignSelf: 'center', padding: 8 },
  modalFecharTexto: { color: '#7b8794', fontWeight: '700' },
});

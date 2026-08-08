import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PainelResposta } from './PainelResposta';
import {
  temPreenchimento,
  type ArquivoRequisito,
  type AtividadeDeRequisito,
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
  respostas: Record<number, string>;
  arquivos: Record<number, ArquivoRequisito[]>;
  atividades: Map<number, AtividadeDeRequisito>;
  podeMarcar: boolean;
  podePreencher: boolean;
  podeEnviar: boolean;
  salvandoId: number | null;
  modoLote: boolean;
  selecionados: Set<number>;
  onAlternar: (req: RequisitoCatalogo) => void;
  onSelecionar: (req: RequisitoCatalogo) => void;
  onEnviar: (req: RequisitoCatalogo) => void;
  onCancelar: (atividade: AtividadeDeRequisito) => void;
  onEnviarParaAvaliacao: (req: RequisitoCatalogo, atividade: AtividadeDeRequisito) => Promise<void>;
  onSalvarTexto: (req: RequisitoCatalogo, texto: string) => Promise<void>;
  onEnviarArquivo: (req: RequisitoCatalogo, a: { uri: string; nome: string; mime: string }) => Promise<void>;
  onRemoverArquivo: (id: number) => Promise<void>;
}

interface Props {
  requisito: RequisitoCatalogo;
  filhos: RequisitoCatalogo[];
  bloqueado: boolean;
  ctx: ContextoRequisito;
  nivel?: 'raiz' | 'filho';
}

export function RequisitoLinha({ requisito, filhos, bloqueado, ctx, nivel = 'raiz' }: Props) {
  const [aberto, setAberto] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);

  const feito = ctx.concluidos.has(requisito.id);
  const origem = ctx.origens.get(requisito.id);
  const info = origem ? ICONE_ORIGEM[origem] : null;
  const atividade = ctx.atividades.get(requisito.id);
  const preenchivel = temPreenchimento(requisito);

  // Ao chegar uma atividade enviada (ou reabrir a tela com uma pendente), já
  // mostra o campo de resposta em vez de exigir um segundo toque para achá-lo.
  useEffect(() => {
    if (atividade && preenchivel) setPainelAberto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atividade?.id]);
  const selecionado = ctx.selecionados.has(requisito.id);
  const qtdArquivos = (ctx.arquivos[requisito.id] ?? []).length;
  const temTexto = !!(ctx.respostas[requisito.id] ?? '').trim();
  const ehFilho = nivel === 'filho';

  const rotuloCodigo = requisito.subitem
    ? `${requisito.subitem})`
    : `${requisito.codigo}`;

  return (
    <View style={[s.card, ehFilho && s.cardFilho, feito && s.cardFeito, bloqueado && s.cardBloqueado]}>
      <View style={s.linha}>
        {ctx.modoLote ? (
          <TouchableOpacity
            style={[s.check, selecionado && s.checkSelecionado]}
            onPress={() => ctx.onSelecionar(requisito)}
          >
            {selecionado ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              ehFilho ? s.checkPequeno : s.check,
              feito && s.checkFeito,
              (!ctx.podeMarcar || bloqueado) && s.checkBloqueado,
            ]}
            onPress={() => ctx.onAlternar(requisito)}
            disabled={!ctx.podeMarcar || ctx.salvandoId === requisito.id || (bloqueado && !feito)}
          >
            {ctx.salvandoId === requisito.id
              ? <ActivityIndicator size="small" color={feito ? '#fff' : '#1a3a5c'} />
              : feito
                ? <Ionicons name="checkmark" size={ehFilho ? 12 : 15} color="#fff" />
                : null}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.7}
          onPress={() => (filhos.length > 0 ? setAberto((v) => !v) : preenchivel && setPainelAberto((v) => !v))}
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
            {(temTexto || qtdArquivos > 0) && (
              <View style={[s.tag, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="create-outline" size={11} color="#0369a1" />
                <Text style={[s.tagText, { color: '#0369a1' }]}>
                  {[temTexto ? 'texto' : null, qtdArquivos ? `${qtdArquivos} anexo(s)` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
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

        <View style={s.acoes}>
          {preenchivel && !ctx.modoLote && (
            <TouchableOpacity style={s.btnIcone} onPress={() => setPainelAberto((v) => !v)}>
              <Ionicons
                name={painelAberto ? 'chevron-up-circle' : atividade ? 'paper-plane' : 'create-outline'}
                size={20}
                color={atividade ? '#16a34a' : '#0369a1'}
              />
            </TouchableOpacity>
          )}
          {!atividade && !preenchivel && ctx.podeEnviar && !ctx.modoLote && (
            <TouchableOpacity style={s.btnIcone} onPress={() => ctx.onEnviar(requisito)}>
              <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
          )}
          {!atividade && preenchivel && ctx.podeEnviar && !ctx.modoLote && (
            <TouchableOpacity style={s.btnIcone} onPress={() => ctx.onEnviar(requisito)}>
              <Ionicons name="paper-plane-outline" size={19} color="#2563eb" />
            </TouchableOpacity>
          )}
          {!!atividade && ctx.podeEnviar && !ctx.modoLote && (
            <TouchableOpacity style={s.btnIcone} onPress={() => ctx.onCancelar(atividade)}>
              <Ionicons name="trash-outline" size={18} color="#c62828" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!!atividade && !ctx.modoLote && (
        <Text style={s.enviadoInfo}>
          Enviado como atividade{atividade.data ? ` · prazo ${atividade.data.split('-').reverse().join('/')}` : ' · sem prazo'}
          {' · toque na lixeira para cancelar o envio'}
        </Text>
      )}

      {painelAberto && preenchivel && (
        <PainelResposta
          requisito={requisito}
          texto={ctx.respostas[requisito.id] ?? ''}
          arquivos={ctx.arquivos[requisito.id] ?? []}
          editavel={ctx.podePreencher}
          atividadeEnviada={!!atividade}
          onSalvarTexto={(t) => ctx.onSalvarTexto(requisito, t)}
          onEnviarArquivo={(a) => ctx.onEnviarArquivo(requisito, a)}
          onRemoverArquivo={ctx.onRemoverArquivo}
          onEnviarParaAvaliacao={atividade ? () => ctx.onEnviarParaAvaliacao(requisito, atividade) : undefined}
        />
      )}

      {aberto && filhos.map((f) => (
        <RequisitoLinha key={f.id} requisito={f} filhos={[]} bloqueado={false} ctx={ctx} nivel="filho" />
      ))}
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
  checkSelecionado: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkBloqueado: { opacity: 0.45 },
  texto: { fontSize: 13, color: '#1f2933', lineHeight: 19 },
  textoFilho: { fontSize: 12, color: '#3e4c59', lineHeight: 17 },
  textoFeito: { color: '#5c7a68' },
  codigo: { fontWeight: '800', color: '#1a3a5c' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '700' },
  avisoGrupo: { fontSize: 10, color: '#b45309', fontStyle: 'italic' },
  contador: { fontSize: 11, color: '#7b8794', fontWeight: '600' },
  acoes: { flexDirection: 'row', gap: 2 },
  btnIcone: { padding: 2 },
  enviadoInfo: { fontSize: 10, color: '#16a34a', marginTop: 6, marginLeft: 34, fontWeight: '600' },
});

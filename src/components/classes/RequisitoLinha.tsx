import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RequisitoCatalogo } from '../../lib/classesRequisitos';

const ICONE_ORIGEM: Record<string, { icone: string; cor: string; rotulo: string }> = {
  manual: { icone: 'checkmark-circle', cor: '#16a34a', rotulo: 'Marcado pela secretaria' },
  atividade: { icone: 'clipboard', cor: '#2563eb', rotulo: 'Concluído por atividade' },
  especialidade: { icone: 'ribbon', cor: '#7c3aed', rotulo: 'Concluído pela especialidade' },
};

export interface ContextoRequisito {
  concluidos: Set<number>;
  origens: Map<number, string>;
  podeMarcar: boolean;
  salvandoId: number | null;
  onAlternar: (req: RequisitoCatalogo) => void;
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

  const feito = ctx.concluidos.has(requisito.id);
  const origem = ctx.origens.get(requisito.id);
  const info = origem ? ICONE_ORIGEM[origem] : null;
  const ehFilho = nivel === 'filho';

  const rotuloCodigo = requisito.subitem ? `${requisito.subitem})` : `${requisito.codigo}`;

  return (
    <View style={[s.card, ehFilho && s.cardFilho, feito && s.cardFeito, bloqueado && s.cardBloqueado]}>
      <View style={s.linha}>
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

        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={filhos.length > 0 ? 0.7 : 1}
          onPress={() => filhos.length > 0 && setAberto((v) => !v)}
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
});

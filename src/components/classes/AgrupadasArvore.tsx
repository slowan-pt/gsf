import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  gruposAgrupadas,
  resumoGeralAgrupadas,
  imagemDaClasse,
  IMAGEM_AGRUPADAS,
  NOME_AVANCADA,
  type ResumoClasseSeparado,
} from '../../lib/classesRequisitos';

interface Props {
  resumos: ResumoClasseSeparado[];
  /** Modo seletor (ficha do membro): tocar num item chama onSelecionar. */
  chaveSelecionada?: string;
  onSelecionar?: (chave: string) => void;
  /** Modo marcação (hub de classes): mostra checkbox por item. */
  podeMarcar?: boolean;
  estaMarcando?: (r: ResumoClasseSeparado) => boolean;
  onAlternar?: (r: ResumoClasseSeparado, concluir: boolean) => void;
  /** Tocar no rótulo do item abre a ficha do membro direto naquela classe (hub). */
  onAbrirClasse?: (r: ResumoClasseSeparado) => void;
}

/**
 * "Classes agrupadas" → 6 linhas (Amigo…Guia), cada uma com a classe normal e
 * a avançada lado a lado (quebra para baixo só se a largura não couber). O
 * ícone de cada lado mescla o brasão da classe com o selo de Agrupadas —
 * só aqui, pois nas outras abas o ícone é só o da classe.
 */
export function AgrupadasArvore({ resumos, chaveSelecionada, onSelecionar, podeMarcar, estaMarcando, onAlternar, onAbrirClasse }: Props) {
  const [topoAberto, setTopoAberto] = useState(true);

  const geral = resumoGeralAgrupadas(resumos);
  const grupos = gruposAgrupadas(resumos);

  function Coluna({ r, rotulo, classeBase, avancada }: {
    r: ResumoClasseSeparado | null; rotulo: string; classeBase: string; avancada: boolean;
  }) {
    const imgClasse = imagemDaClasse(classeBase, avancada);
    const icone = (
      <View style={s.iconesMesclados}>
        {imgClasse ? (
          <Image source={imgClasse} style={s.logoColuna} resizeMode="contain" />
        ) : (
          <View style={[s.pontoColuna, { backgroundColor: r?.cor ?? '#64748b' }]} />
        )}
        <Image source={IMAGEM_AGRUPADAS} style={s.badgeAgrupadas} resizeMode="contain" />
      </View>
    );

    if (!r) {
      return (
        <View style={s.coluna}>
          {icone}
          <Text style={s.colunaLabel} numberOfLines={1}>{rotulo}</Text>
          <Text style={s.semDados}>Sem requisitos ainda</Text>
        </View>
      );
    }
    const completa = r.total > 0 && r.concluidos >= r.total;
    const selecionada = chaveSelecionada === r.chave;
    const marcandoEsta = estaMarcando?.(r) ?? false;

    const conteudo = (
      <>
        <View style={s.colunaTopo}>
          {podeMarcar && (
            <TouchableOpacity
              style={[s.check, completa && { backgroundColor: r.cor, borderColor: r.cor }]}
              disabled={marcandoEsta}
              onPress={() => onAlternar?.(r, !completa)}
            >
              {marcandoEsta
                ? <ActivityIndicator size="small" color={completa ? '#fff' : r.cor} />
                : completa
                  ? <Ionicons name="checkmark" size={11} color="#fff" />
                  : null}
            </TouchableOpacity>
          )}
          {icone}
        </View>
        <Text style={[s.colunaLabel, selecionada && s.colunaLabelAtiva]} numberOfLines={1}>{rotulo}</Text>
        <Text style={s.colunaContagem}>{r.concluidos}/{r.total}</Text>
      </>
    );

    if (onSelecionar) {
      return (
        <TouchableOpacity style={[s.coluna, selecionada && s.colunaAtiva]} onPress={() => onSelecionar(r.chave)}>
          {conteudo}
        </TouchableOpacity>
      );
    }
    if (onAbrirClasse) {
      return (
        <TouchableOpacity style={s.coluna} onPress={() => onAbrirClasse(r)}>
          {conteudo}
        </TouchableOpacity>
      );
    }
    return <View style={s.coluna}>{conteudo}</View>;
  }

  return (
    <View style={s.caixa}>
      <TouchableOpacity style={s.topo} onPress={() => setTopoAberto((v) => !v)}>
        <Image source={IMAGEM_AGRUPADAS} style={s.logoTopo} resizeMode="contain" />
        <Text style={s.topoTitulo}>Classes agrupadas</Text>
        <Text style={s.topoContagem}>{geral.concluidos}/{geral.total}</Text>
        <Ionicons name={topoAberto ? 'chevron-up' : 'chevron-down'} size={16} color="#0f766e" />
      </TouchableOpacity>

      {topoAberto && grupos.map((g) => (
        <View key={g.chaveGrupo} style={s.linha}>
          <Coluna r={g.base} rotulo={g.rotulo} classeBase={g.rotulo} avancada={false} />
          <Coluna
            r={g.avancada}
            rotulo={NOME_AVANCADA[g.rotulo] ?? `${g.rotulo} avançada`}
            classeBase={g.rotulo}
            avancada={true}
          />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { backgroundColor: '#f0fdfa', borderRadius: 12, borderWidth: 1, borderColor: '#99f6e4', overflow: 'hidden', marginTop: 8 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  logoTopo: { width: 24, height: 24 },
  topoTitulo: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0f766e' },
  topoContagem: { fontSize: 11, color: '#0f766e', fontWeight: '700' },
  linha: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 14,
    borderTopWidth: 1, borderTopColor: '#ccfbf1', paddingVertical: 10, paddingHorizontal: 12,
  },
  coluna: { flexGrow: 1, flexBasis: 130, alignItems: 'center', gap: 4 },
  colunaAtiva: {},
  colunaTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  check: {
    width: 17, height: 17, borderRadius: 5, borderWidth: 2, borderColor: '#99f6e4',
    alignItems: 'center', justifyContent: 'center',
  },
  iconesMesclados: { width: 26, height: 26, position: 'relative' },
  logoColuna: { width: 26, height: 26 },
  badgeAgrupadas: {
    position: 'absolute', bottom: -4, right: -6, width: 16, height: 16,
    borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#99f6e4',
  },
  pontoColuna: { width: 12, height: 12, borderRadius: 6 },
  colunaLabel: { fontSize: 12, color: '#134e4a', textAlign: 'center', fontWeight: '600' },
  colunaLabelAtiva: { fontWeight: '800', color: '#0f766e' },
  colunaContagem: { fontSize: 10, color: '#5eaba1' },
  semDados: { fontSize: 10, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },
});

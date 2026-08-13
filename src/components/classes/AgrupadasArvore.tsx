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
 * a avançada lado a lado. Usada tanto na ficha do membro (seleciona qual
 * classe ver) quanto no hub de classes (marca direto pelo checkbox).
 */
export function AgrupadasArvore({ resumos, chaveSelecionada, onSelecionar, podeMarcar, estaMarcando, onAlternar, onAbrirClasse }: Props) {
  const [topoAberto, setTopoAberto] = useState(true);

  const geral = resumoGeralAgrupadas(resumos);
  const grupos = gruposAgrupadas(resumos);

  function Coluna({ r, rotulo }: { r: ResumoClasseSeparado | null; rotulo: string }) {
    if (!r) {
      return (
        <View style={s.coluna}>
          <Text style={s.colunaLabel} numberOfLines={2}>{rotulo}</Text>
          <Text style={s.semDados}>Sem requisitos ainda</Text>
        </View>
      );
    }
    const completa = r.total > 0 && r.concluidos >= r.total;
    const selecionada = chaveSelecionada === r.chave;
    const marcandoEsta = estaMarcando?.(r) ?? false;
    const img = imagemDaClasse(r.classe, r.avancada);

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
          {img ? (
            <Image source={img} style={s.logoColuna} resizeMode="contain" />
          ) : (
            <View style={[s.pontoColuna, { backgroundColor: r.cor }]} />
          )}
        </View>
        <Text style={[s.colunaLabel, selecionada && s.colunaLabelAtiva]} numberOfLines={2}>{rotulo}</Text>
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
          <Coluna r={g.base} rotulo={g.rotulo} />
          <View style={s.separador} />
          <Coluna r={g.avancada} rotulo={NOME_AVANCADA[g.rotulo] ?? `${g.rotulo} avançada`} />
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
    flexDirection: 'row', alignItems: 'stretch',
    borderTopWidth: 1, borderTopColor: '#ccfbf1', paddingVertical: 8, paddingHorizontal: 10,
  },
  separador: { width: 1, backgroundColor: '#ccfbf1', marginHorizontal: 8 },
  coluna: { flex: 1, alignItems: 'center', gap: 3 },
  colunaAtiva: {},
  colunaTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  check: {
    width: 17, height: 17, borderRadius: 5, borderWidth: 2, borderColor: '#99f6e4',
    alignItems: 'center', justifyContent: 'center',
  },
  logoColuna: { width: 22, height: 22 },
  pontoColuna: { width: 10, height: 10, borderRadius: 5 },
  colunaLabel: { fontSize: 11, color: '#134e4a', textAlign: 'center', fontWeight: '600' },
  colunaLabelAtiva: { fontWeight: '800', color: '#0f766e' },
  colunaContagem: { fontSize: 10, color: '#5eaba1' },
  semDados: { fontSize: 10, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },
});

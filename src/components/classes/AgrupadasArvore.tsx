import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  gruposAgrupadas,
  resumoGeralAgrupadas,
  IMAGEM_AGRUPADAS,
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
 * Árvore "Classes agrupadas" → 6 grupos (Amigo…Guia) → base/avançada.
 * Usada tanto na ficha do membro (seleciona qual classe ver) quanto no hub
 * de classes (marca direto pelo checkbox), conforme as props recebidas.
 */
export function AgrupadasArvore({ resumos, chaveSelecionada, onSelecionar, podeMarcar, estaMarcando, onAlternar, onAbrirClasse }: Props) {
  const [topoAberto, setTopoAberto] = useState(true);
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);

  const geral = resumoGeralAgrupadas(resumos);
  const grupos = gruposAgrupadas(resumos);

  function Item({ r, rotulo }: { r: ResumoClasseSeparado; rotulo: string }) {
    const completa = r.total > 0 && r.concluidos >= r.total;
    const selecionada = chaveSelecionada === r.chave;
    const marcandoEsta = estaMarcando?.(r) ?? false;
    const conteudo = (
      <>
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
        {onAbrirClasse ? (
          <TouchableOpacity style={s.itemLabelToque} onPress={() => onAbrirClasse(r)}>
            <Text style={[s.itemLabel, selecionada && s.itemLabelAtivo]} numberOfLines={1}>{rotulo}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[s.itemLabel, selecionada && s.itemLabelAtivo]} numberOfLines={1}>{rotulo}</Text>
        )}
        <Text style={s.itemContagem}>{r.concluidos}/{r.total}</Text>
      </>
    );
    if (onSelecionar) {
      return (
        <TouchableOpacity style={[s.item, selecionada && s.itemAtivo]} onPress={() => onSelecionar(r.chave)}>
          {conteudo}
        </TouchableOpacity>
      );
    }
    return <View style={s.item}>{conteudo}</View>;
  }

  return (
    <View style={s.caixa}>
      <TouchableOpacity style={s.topo} onPress={() => setTopoAberto((v) => !v)}>
        <Image source={IMAGEM_AGRUPADAS} style={s.logoTopo} resizeMode="contain" />
        <Text style={s.topoTitulo}>Classes agrupadas</Text>
        <Text style={s.topoContagem}>{geral.concluidos}/{geral.total}</Text>
        <Ionicons name={topoAberto ? 'chevron-up' : 'chevron-down'} size={16} color="#0f766e" />
      </TouchableOpacity>

      {topoAberto && grupos.map((g) => {
        const aberto = grupoAberto === g.chaveGrupo;
        return (
          <View key={g.chaveGrupo} style={s.grupo}>
            <TouchableOpacity style={s.grupoHeader} onPress={() => setGrupoAberto(aberto ? null : g.chaveGrupo)}>
              <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={15} color="#0f766e" />
              <Text style={s.grupoNome}>{g.rotulo}</Text>
              <Text style={s.grupoContagem}>{g.concluidos}/{g.total}</Text>
            </TouchableOpacity>
            {aberto && (
              <View style={s.grupoItens}>
                {g.base ? (
                  <Item r={g.base} rotulo={g.rotulo} />
                ) : (
                  <Text style={s.semDados}>Ainda sem requisitos cadastrados.</Text>
                )}
                {g.avancada && <Item r={g.avancada} rotulo={`${g.rotulo} avançada`} />}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { backgroundColor: '#f0fdfa', borderRadius: 12, borderWidth: 1, borderColor: '#99f6e4', overflow: 'hidden', marginTop: 8 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  logoTopo: { width: 24, height: 24 },
  topoTitulo: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0f766e' },
  topoContagem: { fontSize: 11, color: '#0f766e', fontWeight: '700' },
  grupo: { borderTopWidth: 1, borderTopColor: '#ccfbf1' },
  grupoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 10 },
  grupoNome: { flex: 1, fontSize: 12, fontWeight: '700', color: '#134e4a' },
  grupoContagem: { fontSize: 11, color: '#5eaba1' },
  grupoItens: { paddingHorizontal: 10, paddingBottom: 8, gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  itemAtivo: {},
  check: {
    width: 17, height: 17, borderRadius: 5, borderWidth: 2, borderColor: '#99f6e4',
    alignItems: 'center', justifyContent: 'center',
  },
  itemLabelToque: { flex: 1 },
  itemLabel: { flex: 1, fontSize: 12, color: '#134e4a' },
  itemLabelAtivo: { fontWeight: '800', color: '#0f766e' },
  itemContagem: { fontSize: 11, color: '#5eaba1' },
  semDados: { fontSize: 11, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 4 },
});

import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCores } from '../stores/temaStore';
import { estiloCartao, tomTexto } from '../lib/tema';

/**
 * Padrão dos relatórios (como nos apps de gestão): cada relatório é um cartão com faixa e ícone na cor dele,
 * título, uma linha explicando o que ele traz, os filtros e, no fim, a barra de exportação própria.
 */
interface CartaoProps {
  titulo: string;
  descricao?: string;
  icone: keyof typeof Ionicons.glyphMap;
  /** Cor de identificação do relatório (faixa, ícone e botão). */
  cor: string;
  children?: ReactNode;
  /** Ação pequena no canto (ex.: atualizar). */
  acao?: ReactNode;
}

export function CartaoRelatorio({ titulo, descricao, icone, cor, children, acao }: CartaoProps) {
  const cores = useCores();
  const corTexto = tomTexto(cor, cores);
  return (
    <View style={[s.cartao, estiloCartao(cores), { backgroundColor: cores.cartao, borderColor: cores.borda, borderLeftColor: cor }]}>
      <View style={s.topo}>
        <View style={[s.icone, { backgroundColor: cor + '24' }]}>
          <Ionicons name={icone} size={20} color={corTexto} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.titulo, { color: cores.texto }]}>{titulo}</Text>
          {descricao ? <Text style={[s.descricao, { color: cores.textoSecundario }]}>{descricao}</Text> : null}
        </View>
        {acao}
      </View>
      {children ? <View style={s.corpo}>{children}</View> : null}
    </View>
  );
}

export type FormatoExportacao = 'pdf' | 'excel';

interface BarraProps {
  formato: FormatoExportacao;
  aoMudarFormato: (f: FormatoExportacao) => void;
  aoExportar: () => void;
  cor: string;
  ocupado?: boolean;
  desabilitado?: boolean;
  /** Relatório que só existe em PDF: mostra só o PDF, marcado. */
  somentePdf?: boolean;
}

/** Formato (PDF já marcado) e botão Exportar: o arquivo só é gerado ao tocar em Exportar. */
export function BarraExportar({ formato, aoMudarFormato, aoExportar, cor, ocupado, desabilitado, somentePdf }: BarraProps) {
  const cores = useCores();
  const opcoes: { id: FormatoExportacao; rotulo: string }[] = somentePdf
    ? [{ id: 'pdf', rotulo: 'PDF' }]
    : [{ id: 'pdf', rotulo: 'PDF' }, { id: 'excel', rotulo: 'Excel' }];
  const bloqueado = ocupado || desabilitado;
  return (
    <View style={[s.barra, { borderTopColor: cores.borda }]}>
      <View style={s.formatos}>
        {opcoes.map((o) => {
          const ativo = formato === o.id;
          return (
            <TouchableOpacity
              key={o.id}
              style={[s.formato, { borderColor: ativo ? cor : cores.borda, backgroundColor: ativo ? cor + '1f' : 'transparent' }]}
              onPress={() => aoMudarFormato(o.id)}
              disabled={somentePdf}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
            >
              <Ionicons name={ativo ? 'radio-button-on' : 'radio-button-off'} size={16} color={ativo ? tomTexto(cor, cores) : cores.textoSecundario} />
              <Text style={[s.formatoTexto, { color: cores.texto }]}>{o.rotulo}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[s.exportar, { backgroundColor: cor }, bloqueado && { opacity: 0.5 }]}
        onPress={aoExportar}
        disabled={bloqueado}
        accessibilityRole="button"
        accessibilityLabel="Exportar relatório"
      >
        {ocupado ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download-outline" size={17} color="#fff" />}
        <Text style={s.exportarTexto}>{ocupado ? 'Gerando...' : 'Exportar'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  cartao: { borderRadius: 18, borderWidth: 1, borderLeftWidth: 6, padding: 14, marginBottom: 14 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 16, fontWeight: '900' },
  descricao: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  corpo: { marginTop: 12, gap: 8 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  formatos: { flexDirection: 'row', gap: 8 },
  formato: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  formatoTexto: { fontSize: 13, fontWeight: '800' },
  exportar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 18, marginLeft: 'auto' },
  exportarTexto: { color: '#fff', fontWeight: '900', fontSize: 14 },
});

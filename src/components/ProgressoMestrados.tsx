import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCores } from '../stores/temaStore';
import { estiloCartao } from '../lib/tema';
import { carregarProgressoMestrados } from '../lib/mestrados';
import { mestradosParaMostrar, situacaoDoMestrado, type ProgressoMestrado, type TomSituacao } from '../lib/mestradoProgressoNucleo';

const COR_TOM: Record<TomSituacao, string> = {
  andamento: '#6b7280', diretoria: '#b26a00', pronto: '#1b7f3b', investido: '#4b2bb0', devolvido: '#c62828', alerta: '#c62828',
};

/**
 * Andamento dos mestrados do membro (x de y, obrigatórias, situação). Só mostra os que ele já começou ou já tem;
 * a contagem vem do mesmo cálculo que encaminha o mestrado sozinho para a diretoria.
 */
export default function ProgressoMestrados({ membroId }: { membroId: number }) {
  const cores = useCores();
  const [lista, setLista] = useState<ProgressoMestrado[]>([]);
  const [aberto, setAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    carregarProgressoMestrados(membroId).then((l) => { if (vivo) setLista(mestradosParaMostrar(l)); });
    return () => { vivo = false; };
  }, [membroId]);

  if (lista.length === 0) return null;
  const prontos = lista.filter((p) => p.etapa === 'aprovado').length;

  return (
    <View style={[estiloCartao(cores, 16), styles.caixa]}>
      <TouchableOpacity style={styles.topo} onPress={() => setAberto((v) => !v)} accessibilityRole="button">
        <Ionicons name="ribbon-outline" size={20} color={cores.acento} />
        <Text style={[styles.titulo, { color: cores.texto }]}>Mestrados · andamento</Text>
        {prontos > 0 && (
          <View style={[styles.selo, { backgroundColor: COR_TOM.pronto }]}><Text style={styles.seloTexto}>{prontos} pronto{prontos > 1 ? 's' : ''}</Text></View>
        )}
        <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSecundario} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {aberto && lista.map((p) => {
        const s = situacaoDoMestrado(p);
        const cor = COR_TOM[s.tom];
        const mostrando = detalhe === p.id;
        return (
          <View key={p.id} style={[styles.linha, { borderTopColor: cores.borda }]}>
            <View style={styles.linhaTopo}>
              <Text style={[styles.nome, { color: cores.texto }]} numberOfLines={2}>{p.nome}</Text>
              <Text style={[styles.rotulo, { color: cor }]} numberOfLines={2}>{s.rotulo}</Text>
            </View>
            <View style={[styles.barra, { backgroundColor: cores.borda }]}>
              <View style={{ width: `${Math.round(s.fracao * 100)}%`, height: '100%', backgroundColor: cor, borderRadius: 4 }} />
            </View>
            <Text style={[styles.progresso, { color: cores.textoSecundario }]}>{s.progresso}</Text>
            {s.detalhe ? <Text style={[styles.detalhe, { color: cores.textoSecundario }]}>{s.detalhe}</Text> : null}
            {p.especialidades.length > 0 && (
              <TouchableOpacity onPress={() => setDetalhe(mostrando ? null : p.id)} accessibilityRole="button">
                <Text style={[styles.ver, { color: cores.acento }]}>{mostrando ? 'Ocultar especialidades' : 'Ver especialidades contadas'}</Text>
              </TouchableOpacity>
            )}
            {mostrando && <Text style={[styles.detalhe, { color: cores.texto }]}>{p.especialidades.join(' · ')}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { padding: 12, marginBottom: 14 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 15, fontWeight: '800' },
  selo: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  seloTexto: { color: '#fff', fontSize: 11, fontWeight: '800' },
  linha: { borderTopWidth: 1, marginTop: 10, paddingTop: 10, gap: 4 },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  nome: { flex: 1, fontSize: 14, fontWeight: '700' },
  rotulo: { flexShrink: 1, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  barra: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progresso: { fontSize: 12, fontWeight: '600' },
  detalhe: { fontSize: 12 },
  ver: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});

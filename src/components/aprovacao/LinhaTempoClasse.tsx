import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LinhaTempoClasse } from '../../lib/fluxoClasses';

function dataBR(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/**
 * Selos que vão se somando conforme a classe avança, cada um com a data:
 * aguardando a diretoria -> aguardando o regional -> aprovado pelo regional.
 */
export function LinhaTempoClasse({ tl }: { tl: LinhaTempoClasse | null | undefined }) {
  if (!tl || tl.etapa === 'correcao') return null;
  const selos: { chave: string; texto: string; data: string; cor: string; icone: any }[] = [];
  if (tl.concluidaEm) selos.push({ chave: 'dir', texto: 'Aguardando aprovação da diretoria', data: dataBR(tl.concluidaEm), cor: '#e8420f', icone: 'hourglass-outline' });
  if (tl.aprovadaDiretoriaEm && tl.etapa !== 'diretoria') selos.push({ chave: 'reg', texto: 'Aguardando aprovação do regional', data: dataBR(tl.aprovadaDiretoriaEm), cor: '#e8420f', icone: 'hourglass-outline' });
  if (tl.aprovadaRegionalEm) selos.push({ chave: 'ok', texto: 'Aprovado pelo regional', data: dataBR(tl.aprovadaRegionalEm), cor: '#1f9d4d', icone: 'checkmark-circle' });
  if (selos.length === 0) return null;
  return (
    <View style={s.pilha}>
      {selos.map((x) => (
        <View key={x.chave} style={[s.selo, { backgroundColor: x.cor }]}>
          <Ionicons name={x.icone} size={14} color="#fff" />
          <Text style={s.texto} numberOfLines={1}>{x.texto}</Text>
          {x.data ? <Text style={s.data}>{x.data}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  pilha: { gap: 6, marginTop: 8, alignSelf: 'stretch' },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  texto: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '800' },
  data: { color: '#fff', fontSize: 11, fontWeight: '900', opacity: 0.95 },
});

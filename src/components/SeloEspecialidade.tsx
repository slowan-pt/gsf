import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCores } from '../stores/temaStore';

// .badge do protótipo: secundária, ciano e verde em ciclo, com aro claro e sombra sólida.
const TONS = [
  { fundo: '', borda: '#fce786', sombra: '#c09522' },
  { fundo: '#36dce6', borda: '#9af2f8', sombra: '#23a4ad' },
  { fundo: '#c4f590', borda: '#e6ffbc', sombra: '#91b460' },
];

/** Selo redondo de especialidade com a insígnia real (ou ícone, se não houver imagem). */
export function SeloEspecialidade({ url, indice = 0, tamanho = 46 }: { url: string | null; indice?: number; tamanho?: number }) {
  const cores = useCores();
  const [erro, setErro] = useState(false);
  const t = TONS[((indice % 3) + 3) % 3];
  return (
    <View style={[s.selo, {
      width: tamanho, height: tamanho, borderRadius: tamanho / 2,
      backgroundColor: t.fundo || cores.secundaria, borderColor: t.borda, boxShadow: `0px 4px 0px ${t.sombra}`,
    }]}>
      {url && !erro ? (
        <Image source={{ uri: url }} onError={() => setErro(true)} resizeMode="contain" style={{ width: tamanho * 0.72, height: tamanho * 0.72, borderRadius: tamanho * 0.36 }} />
      ) : (
        <Ionicons name="ribbon" size={tamanho * 0.48} color="#432958" />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  selo: { borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

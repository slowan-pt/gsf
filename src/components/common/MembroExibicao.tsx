import { View, Text } from 'react-native';
import { Avatar } from './Avatar';
import type { ModoExibicaoMembro } from '../../lib/relatoriosConfig';

/** Célula reutilizada em todos os relatórios que listam membros — respeita o
 * modo de exibição (nome / nome e foto / só foto) escolhido pelo usuário. */
export function MembroExibicao({
  nome,
  foto_url,
  cor,
  tamanho = 34,
  modo,
  corTexto = '#1a3a5c',
}: {
  nome: string;
  foto_url?: string | null;
  cor?: string;
  tamanho?: number;
  modo: ModoExibicaoMembro;
  corTexto?: string;
}) {
  if (modo === 'nome') {
    return <Text style={{ fontSize: 14, fontWeight: '700', color: corTexto }} numberOfLines={1}>{nome}</Text>;
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Avatar nome={nome} foto_url={foto_url} cor={cor} size={tamanho} />
      {modo === 'nome_foto' && (
        <Text style={{ fontSize: 14, fontWeight: '700', color: corTexto }} numberOfLines={1}>{nome}</Text>
      )}
    </View>
  );
}

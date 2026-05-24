import { Image, View, Text } from 'react-native';

const AVATAR_CORES = [
  '#e74c3c', '#e67e22', '#f39c12', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#16a085', '#d35400',
];

export function avatarCor(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_CORES[Math.abs(h) % AVATAR_CORES.length];
}

export function Avatar({
  nome,
  foto_url,
  cor,
  size = 40,
}: {
  nome: string;
  foto_url?: string;
  cor?: string;
  size?: number;
}) {
  const bgCor = cor ?? avatarCor(nome);
  if (foto_url) {
    return (
      <Image
        source={{ uri: foto_url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgCor }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarCor(nome),
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.45, fontWeight: '700' }}>
        {nome[0]}
      </Text>
    </View>
  );
}

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

export interface BadgeFoto {
  nome: string;
  foto_url?: string | null;
}

/**
 * Selo pequeno no canto do avatar indicando "tem responsável vinculado" —
 * mostra até 2 fotos (ou iniciais) em miniatura, sobrepostas. Usado nos
 * avatares de membros menores de 16 anos, e o inverso (foto do filho) no
 * avatar do responsável.
 */
export function AvatarBadge({ fotos, size }: { fotos: BadgeFoto[]; size: number }) {
  if (fotos.length === 0) return null;
  const miniSize = Math.max(14, Math.round(size * 0.42));
  return (
    <View
      style={{
        position: 'absolute', bottom: -2, right: -2,
        flexDirection: 'row', backgroundColor: '#fff', borderRadius: 999, padding: 1.5,
      }}
    >
      {fotos.slice(0, 2).map((f, i) => (
        <View
          key={i}
          style={{
            width: miniSize, height: miniSize, borderRadius: miniSize / 2,
            marginLeft: i > 0 ? -miniSize * 0.4 : 0,
            borderWidth: 1, borderColor: '#fff',
            backgroundColor: avatarCor(f.nome), overflow: 'hidden',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {f.foto_url ? (
            <Image source={{ uri: f.foto_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ color: '#fff', fontSize: miniSize * 0.5, fontWeight: '700' }}>
              {f.nome[0]}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

export function Avatar({
  nome,
  foto_url,
  cor,
  size = 40,
  badgeFotos,
}: {
  nome: string;
  foto_url?: string | null;
  cor?: string;
  size?: number;
  /** Até 2 fotos (responsável ou filho) mostradas em selo no canto do avatar. */
  badgeFotos?: BadgeFoto[];
}) {
  const bgCor = cor ?? avatarCor(nome);
  return (
    <View style={{ width: size, height: size }}>
      {foto_url ? (
        <Image
          source={{ uri: foto_url }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgCor }}
        />
      ) : (
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
      )}
      {badgeFotos && <AvatarBadge fotos={badgeFotos} size={size} />}
    </View>
  );
}

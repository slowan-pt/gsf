import { Redirect } from 'expo-router';

/** A tela de Permissões agora é uma aba de Modelos (somente Admin TI). */
export default function PermissoesAdmin() {
  return <Redirect href={'/admin/modelos?aba=permissoes' as any} />;
}

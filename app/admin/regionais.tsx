import { Redirect } from 'expo-router';

/** A página de Regionais virou "Perfis externos" (pastor, regional e associação). */
export default function RegionaisRedireciona() {
  return <Redirect href="/admin/perfis-externos" />;
}

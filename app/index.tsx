import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const usuario = useAuthStore((s) => s.usuario);
  return <Redirect href={usuario ? '/(tabs)' : '/(tabs)/ranking'} />;
}

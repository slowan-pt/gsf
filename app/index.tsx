import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { useContextoStore } from '../src/stores/contextoStore';

export default function Index() {
  const usuario = useAuthStore((s) => s.usuario);
  const mfaPendente = useAuthStore((s) => s.mfaPendente);
  const consentimentoPendente = useAuthStore((s) => s.consentimentoPendente);
  const selecaoContextoPendente = useContextoStore((s) => s.selecaoPendente);
  return <Redirect href={usuario ? (selecaoContextoPendente ? '/auth/contexto' : '/(tabs)') : mfaPendente ? '/auth/mfa' : consentimentoPendente ? '/auth/consent' : '/auth/login'} />;
}

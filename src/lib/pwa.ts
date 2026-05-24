import { Platform } from 'react-native';

export function registrarPWA() {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => {
        console.warn('Service worker nao registrado:', error);
      });
  });
}


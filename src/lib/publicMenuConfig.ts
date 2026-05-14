import AsyncStorage from '@react-native-async-storage/async-storage';

export const PUBLIC_MENU_KEY = 'public_menu_ids_v1';
export const DEFAULT_PUBLIC_MENUS = ['ranking'];

export async function getPublicMenuIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PUBLIC_MENU_KEY);
    if (!raw) return DEFAULT_PUBLIC_MENUS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : DEFAULT_PUBLIC_MENUS;
  } catch {
    return DEFAULT_PUBLIC_MENUS;
  }
}

export async function setPublicMenuIds(ids: string[]) {
  await AsyncStorage.setItem(PUBLIC_MENU_KEY, JSON.stringify(ids));
}

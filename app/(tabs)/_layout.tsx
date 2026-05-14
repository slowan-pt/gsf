import { useCallback, useState } from 'react';
import { Tabs } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { getPublicMenuIds } from '../../src/lib/publicMenuConfig';

export default function TabsLayout() {
  const usuario = useAuthStore((s) => s.usuario);
  const isAdmin = usuario?.perfil === 'admin_geral' || usuario?.perfil === 'admin_diretoria';
  const [publicMenus, setPublicMenus] = useState<string[]>(['ranking']);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 18);
  const isPublic = (id: string) => !!usuario || publicMenus.includes(id);

  useFocusEffect(useCallback(() => {
    getPublicMenuIds().then(setPublicMenus);
  }, []));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a3a5c',
        tabBarInactiveTintColor: '#999',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: bottomInset,
          height: 58 + bottomInset,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: usuario || publicMenus.length > 1 ? undefined : null,
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          href: isPublic('ranking') ? undefined : null,
          title: 'Ranking',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="membros"
        options={{
          href: isPublic('membros') ? undefined : null,
          title: 'Membros',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pontuacao"
        options={{
          href: isAdmin ? undefined : null,
          title: 'Pontuação',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="campori" options={{ href: null }} />
      <Tabs.Screen
        name="extras"
        options={{
          href: isAdmin ? undefined : null,
          title: 'Extras',
          tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="unidades"
        options={{
          href: isAdmin ? undefined : null,
          title: 'Unidades',
          tabBarIcon: ({ color, size }) => <Ionicons name="flag" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          href: isPublic('agenda') ? undefined : null,
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

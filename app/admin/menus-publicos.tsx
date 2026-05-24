import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { usePermissoes } from '../../src/lib/permissoes';
import { DEFAULT_PUBLIC_MENUS, getPublicMenuIds, setPublicMenuIds } from '../../src/lib/publicMenuConfig';

const MENUS = [
  { id: 'ranking', label: 'Ranking', icon: 'trophy' },
  { id: 'membros', label: 'Membros', icon: 'people' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'atividades', label: 'Atividades', icon: 'clipboard' },
];

export default function MenusPublicosScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const permissoes = usePermissoes();
  const isAdmin = permissoes.pode('gerenciar_acessos');
  const [selecionados, setSelecionados] = useState<string[]>(DEFAULT_PUBLIC_MENUS);

  useEffect(() => {
    getPublicMenuIds().then(setSelecionados);
  }, []);

  if (!usuario) return <Redirect href="/auth/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)" />;

  function toggle(id: string) {
    setSelecionados((prev) => prev.includes(id)
      ? prev.filter((x) => x !== id)
      : [...prev, id]);
  }

  async function salvar() {
    await setPublicMenuIds(selecionados);
    Alert.alert('Salvo', 'Menus públicos atualizados neste aparelho.');
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Administração</Text>
          <Text style={styles.sub}>Menus para usuários sem login</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.info}>
          Se nenhum menu ficar marcado, o visitante será enviado direto para o login.
        </Text>
        {MENUS.map((m) => {
          const ativo = selecionados.includes(m.id);
          return (
            <TouchableOpacity key={m.id} style={styles.item} onPress={() => toggle(m.id)} activeOpacity={0.75}>
              <View style={[styles.iconBox, ativo && styles.iconBoxOn]}>
                <Ionicons name={m.icon as any} size={22} color={ativo ? '#fff' : '#1a3a5c'} />
              </View>
              <Text style={styles.itemText}>{m.label}</Text>
              <View style={[styles.check, ativo && styles.checkOn]}>
                {ativo && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.save} onPress={salvar}>
          <Ionicons name="save-outline" size={18} color="#fff" />
          <Text style={styles.saveText}>Salvar configuração</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a3a5c', paddingTop: 52, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { padding: 6 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#a8c8e8', marginTop: 3 },
  content: { padding: 18, gap: 12 },
  info: { color: '#607080', fontSize: 13, lineHeight: 19, marginBottom: 4 },
  item: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#eef3f8', alignItems: 'center', justifyContent: 'center' },
  iconBoxOn: { backgroundColor: '#1a3a5c' },
  itemText: { flex: 1, fontSize: 16, fontWeight: '800', color: '#223' },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#b6c1cd', alignItems: 'center', justifyContent: 'center' },
  checkOn: { borderColor: '#2e7d32', backgroundColor: '#2e7d32' },
  save: { marginTop: 10, backgroundColor: '#1a3a5c', borderRadius: 14, padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

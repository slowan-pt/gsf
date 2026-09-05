import React, { useState } from 'react';
import { Alert, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';

function asString(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function arquivoTipo(url: string, nome: string) {
  const base = `${nome} ${url}`.toLowerCase();
  if (/\.(png|jpe?g|gif|webp)(\?|$)/.test(base)) return 'image';
  if (/\.pdf(\?|$)/.test(base)) return 'pdf';
  if (/\.(docx?|rtf)(\?|$)/.test(base)) return 'word';
  return 'outro';
}

export default function AnexoViewer() {
  const corCabecalho = useAparenciaStore((s) => s.corCabecalho);
  const params = useLocalSearchParams();
  const rawUrl = asString(params.url) ?? '';
  const nome = asString(params.nome) ?? 'Anexo';
  const returnTo = asString(params.returnTo) ?? '/atividades';
  const url = rawUrl ? decodeURIComponent(rawUrl) : '';
  const tipo = arquivoTipo(url, nome);
  const indisponivel = !url || url.startsWith('blob:') || url.startsWith('file:');
  const [baixando, setBaixando] = useState(false);

  function voltar() {
    router.replace(returnTo as any);
  }

  function abrirExterno() {
    if (!url || indisponivel) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch(() => {});
  }

  async function baixar() {
    if (!url || indisponivel) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      setBaixando(true);
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('Falha ao baixar o arquivo.');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = nome || 'anexo';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
        return;
      } catch {
        Alert.alert('Download não concluído', 'Não foi possível baixar o arquivo. Tente abrir externo e baixar pelo navegador.');
      } finally {
        setBaixando(false);
      }
    }
    abrirExterno();
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18 }]}>
        <TouchableOpacity onPress={voltar} style={s.headerBtn} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerTextWrap}>
          <Text style={s.title} numberOfLines={1}>Anexo</Text>
          <Text style={s.subtitle} numberOfLines={1}>{nome}</Text>
        </View>
        <View style={s.headerBtn} />
      </View>

      <View style={s.actions}>
        <TouchableOpacity onPress={voltar} style={s.secondaryBtn}>
          <Ionicons name="chevron-back" size={18} color="#1a3a5c" />
          <Text style={s.secondaryText}>Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={baixar} style={[s.secondaryBtn, (indisponivel || baixando) && s.disabledBtn]} disabled={indisponivel || baixando}>
          <Ionicons name="download-outline" size={18} color={indisponivel ? '#999' : '#1a3a5c'} />
          <Text style={[s.secondaryText, indisponivel && s.disabledText]}>{baixando ? 'Baixando...' : 'Baixar'}</Text>
        </TouchableOpacity>
      </View>

      {indisponivel ? (
        <View style={s.empty}>
          <Ionicons name="alert-circle-outline" size={44} color="#c62828" />
          <Text style={s.emptyTitle}>Arquivo indisponível</Text>
          <Text style={s.emptyText}>
            Este anexo foi salvo como arquivo temporário do navegador. Reanexe o arquivo na atividade para ele ficar disponível aqui dentro do aplicativo.
          </Text>
        </View>
      ) : tipo === 'image' ? (
        <ScrollView contentContainerStyle={s.imageWrap} maximumZoomScale={3}>
          <Image source={{ uri: url }} style={s.image} resizeMode="contain" />
        </ScrollView>
      ) : tipo === 'pdf' && Platform.OS === 'web' ? (
        <View style={s.viewer}>
          {React.createElement('iframe' as any, {
            src: url,
            title: nome,
            style: { width: '100%', height: '100%', border: 'none', background: '#fff' },
          })}
        </View>
      ) : (
        <View style={s.empty}>
          <Ionicons name={tipo === 'word' ? 'document-text-outline' : 'attach-outline'} size={44} color="#1a3a5c" />
          <Text style={s.emptyTitle}>Visualização não disponível</Text>
          <Text style={s.emptyText}>Este tipo de arquivo pode ser baixado para abrir no aplicativo adequado do aparelho.</Text>
          <TouchableOpacity onPress={baixar} style={s.primaryBtn}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={s.primaryText}>Baixar arquivo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f8' },
  header: {
    backgroundColor: '#1a3a5c',
    paddingTop: 42,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerTextWrap: { flex: 1 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#c9d7e6', fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#dbe3eb' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: '#eef5fb' },
  secondaryText: { color: '#1a3a5c', fontWeight: '800' },
  disabledBtn: { opacity: 0.55 },
  disabledText: { color: '#999' },
  viewer: { flex: 1, margin: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' },
  imageWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  image: { width: '100%', height: 560 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 12, fontSize: 20, color: '#1a3a5c', fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 8, color: '#667', fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 520 },
  primaryBtn: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a3a5c', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  primaryText: { color: '#fff', fontWeight: '900' },
});

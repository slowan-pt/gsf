import { EstadoVazio } from '../../src/components/ui';
import React, { useState } from 'react';
import { Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { avisar } from '../../src/stores/avisoStore';
import { useCores, useCorCabecalho } from '../../src/stores/temaStore';
import { corIcone, tomTexto } from '../../src/lib/tema';

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
  const corCabecalho = useCorCabecalho();
  const cores = useCores();
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
        avisar('Não foi possível baixar o arquivo. Tente abrir externo e baixar pelo navegador.', 'info', 'Download não concluído');
      } finally {
        setBaixando(false);
      }
    }
    abrirExterno();
  }

  return (
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
      <View style={[s.header, { backgroundColor: corCabecalho, paddingTop: 48, paddingBottom: 18, paddingRight: 76 }]}>
        <View style={s.headerTextWrap}>
          <Text style={s.title} numberOfLines={1}>Anexo</Text>
        </View>
        <View style={s.headerBtn} />
      </View>

      <View style={[s.actions, cores.isEscuro && { backgroundColor: '#1d1932', borderBottomColor: '#322c52' }, { backgroundColor: cores.cartao, borderBottomColor: cores.borda }]}>
        <TouchableOpacity onPress={voltar} style={[s.secondaryBtn, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }]}>
          <Ionicons name="chevron-back" size={18} color={corIcone(cores)} />
          <Text style={[s.secondaryText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={baixar} style={[s.secondaryBtn, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }, (indisponivel || baixando) && s.disabledBtn]} disabled={indisponivel || baixando}>
          <Ionicons name="download-outline" size={18} color={indisponivel ? tomTexto('#999', cores) : tomTexto('#4b2bb0', cores)} />
          <Text style={[s.secondaryText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }, indisponivel && [s.disabledText, cores.isEscuro && { color: '#c8c8d4' }]]}>{baixando ? 'Baixando...' : 'Baixar'}</Text>
        </TouchableOpacity>
      </View>

      {indisponivel ? (
        <View style={s.empty}>
          <Ionicons name="alert-circle-outline" size={44} color={tomTexto('#c62828', cores)} />
          <Text style={[s.emptyTitle, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Arquivo indisponível</Text>
          <Text style={[s.emptyText, cores.isEscuro && { color: '#cfd0dc' }, { color: cores.textoSecundario }]}>
            Este anexo foi salvo como arquivo temporário do navegador. Reanexe o arquivo na atividade para ele ficar disponível aqui dentro do aplicativo.
          </Text>
        </View>
      ) : tipo === 'image' ? (
        <ScrollView contentContainerStyle={s.imageWrap} maximumZoomScale={3}>
          <Image source={{ uri: url }} style={s.image} resizeMode="contain" />
        </ScrollView>
      ) : tipo === 'pdf' && Platform.OS === 'web' ? (
        <View style={[s.viewer, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
          {React.createElement('iframe' as any, {
            src: url,
            title: nome,
            style: { width: '100%', height: '100%', border: 'none', background: '#fff' },
          })}
        </View>
      ) : (
        <View style={s.empty}>
          <Ionicons name={tipo === 'word' ? 'document-text-outline' : 'attach-outline'} size={44} color={corIcone(cores)} />
          <Text style={[s.emptyTitle, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Visualização não disponível</Text>
          <EstadoVazio titulo="Este tipo de arquivo pode ser baixado para abrir no aplicativo adequado do aparelho." />
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
  container: { flex: 1, backgroundColor: '#efeaf9' },
  header: {
    backgroundColor: '#4b2bb0',
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
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 22, backgroundColor: '#efeaf9' },
  secondaryText: { color: '#4b2bb0', fontWeight: '800' },
  disabledBtn: { opacity: 0.55 },
  disabledText: { color: '#999' },
  viewer: { flex: 1, margin: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' },
  imageWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  image: { width: '100%', height: 560 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 12, fontSize: 20, color: '#4b2bb0', fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 8, color: '#667', fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 520 },
  primaryBtn: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4b2bb0', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22 },
  primaryText: { color: '#fff', fontWeight: '900' },
});

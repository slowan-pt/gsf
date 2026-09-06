import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import { BottomNav } from '../../src/components/BottomNav';
import {
  FONTE_PADRAO_ATIVIDADES,
  FONTES_ATIVIDADES,
  PALETA_PADRAO_ATIVIDADES,
  PALETAS_ATIVIDADES,
  type VisualAtividadesConfig,
  carregarVisualAtividades,
  corCabecalhoDaPaleta,
  fonteAtividadesPorId,
  paletaAtividadesConfigurada,
  paletaAtividadesPorId,
  salvarVisualAtividades,
} from '../../src/lib/paletaAtividades';
import { avisar } from '../../src/stores/avisoStore';

function SeletorCor({ value, onChange }: { value: string; onChange: (valor: string) => void }) {
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'color',
      value,
      onChange: (evento: any) => onChange(evento.target.value),
      style: { width: 48, height: 42, padding: 2, border: '1px solid #d6e0e8', borderRadius: 10, backgroundColor: '#fff' },
      'aria-label': 'Selecionar cor',
    });
  }
  return (
    <TextInput
      style={s.corHexInput}
      value={value}
      onChangeText={onChange}
      maxLength={7}
      autoCapitalize="none"
      placeholder="#RRGGBB"
    />
  );
}

export default function AparenciaClubeScreen() {
  const usuario = useAuthStore((state) => state.usuario);
  const [config, setConfig] = useState<VisualAtividadesConfig>({
    paletaId: PALETA_PADRAO_ATIVIDADES,
    coresPersonalizadas: null,
    fonteId: FONTE_PADRAO_ATIVIDADES,
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  // Índice do bloco com a grade de cores rápidas aberta (uma cor de cada
  // paleta pronta, no lugar daquele bloco) — alternativa ao campo de
  // hexadecimal/seletor nativo, que continuam existindo do lado.
  const [paletaRapidaAberta, setPaletaRapidaAberta] = useState<number | null>(null);
  // Aberto para todos os membros — cada um edita só a própria aparência.
  const paleta = useMemo(
    () => paletaAtividadesConfigurada(config.paletaId, config.coresPersonalizadas),
    [config],
  );
  const fonte = fonteAtividadesPorId(config.fonteId);
  const cabecalho = corCabecalhoDaPaleta(paleta);

  useFocusEffect(useCallback(() => {
    carregar();
  }, [usuario?.id]));

  async function carregar() {
    setCarregando(true);
    try {
      setConfig(await carregarVisualAtividades(usuario?.id));
    } finally {
      setCarregando(false);
    }
  }

  function escolherTema(paletaId: string) {
    setConfig((atual) => ({ ...atual, paletaId, coresPersonalizadas: null }));
  }

  function alterarCor(indice: number, novaCor: string) {
    const originais = paletaAtividadesPorId(config.paletaId).cores.map((item) => item.backgroundColor);
    const cores = [...(config.coresPersonalizadas ?? originais)];
    cores[indice] = novaCor;
    setConfig((atual) => ({ ...atual, coresPersonalizadas: cores }));
  }

  async function salvar() {
    if (!usuario?.id) return;
    setSalvando(true);
    try {
      await salvarVisualAtividades(usuario.id, config);
      useAparenciaStore.getState().definirCorCabecalho(cabecalho);
      avisar('Cores, fonte e cabeçalho foram atualizados só para você.', 'sucesso', 'Aparência salva');
      router.replace('/');
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível salvar a aparência.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  if (!usuario) return <Redirect href="/auth/login" />;

  return (
    <View style={s.container}>
      <View style={[s.header, { backgroundColor: cabecalho }]}>
        <TouchableOpacity onPress={() => router.replace('/')} style={s.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, fonte.fontFamily ? { fontFamily: fonte.fontFamily } : null]}>Aparência</Text>
          <Text style={s.sub}>Só afeta a sua visualização</Text>
        </View>
      </View>
      {carregando ? (
        <ActivityIndicator size="large" color="#1a3a5c" style={{ marginTop: 45 }} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.intro}>A escolha altera o cabeçalho e os blocos de atividades. O contraste dos textos é ajustado automaticamente.</Text>
          <Text style={s.section}>Paleta base</Text>
          <View style={s.paletasGrid}>
            {PALETAS_ATIVIDADES.map((opcao) => (
              <TouchableOpacity key={opcao.id} style={[s.paletaCard, config.paletaId === opcao.id && s.paletaCardAtiva]} onPress={() => escolherTema(opcao.id)}>
                <Text style={s.paletaNome}>{opcao.nome}</Text>
                <View style={s.paletaCores}>
                  {opcao.cores.map((cor, indice) => <View key={indice} style={[s.paletaCor, { backgroundColor: cor.backgroundColor }]} />)}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.sectionRow}>
            <Text style={s.section}>Cores editáveis</Text>
            <TouchableOpacity style={s.restaurar} onPress={() => setConfig((atual) => ({ ...atual, paletaId: PALETA_PADRAO_ATIVIDADES, coresPersonalizadas: null }))}>
              <Ionicons name="refresh" size={14} color="#1a3a5c" />
              <Text style={s.restaurarText}>Restaurar cores</Text>
            </TouchableOpacity>
          </View>
          {paleta.cores.map((cor, indice) => {
            const paletaAberta = paletaRapidaAberta === indice;
            // Uma cor de cada tema pronto, na mesma posição — dá pra trocar o
            // bloco com um toque em vez de digitar hexadecimal ou abrir o
            // seletor nativo do sistema.
            const coresRapidas = PALETAS_ATIVIDADES
              .map((p) => p.cores[indice]?.backgroundColor)
              .filter((c): c is string => !!c);
            return (
              <View key={indice}>
                <View style={s.corLinha}>
                  <View style={[s.corPreview, { backgroundColor: cor.backgroundColor, borderColor: cor.borderColor }]}>
                    <Text style={{ color: cor.accentColor, fontWeight: '900' }}>{indice + 1}</Text>
                  </View>
                  <Text style={s.corLabel}>Bloco {indice + 1}</Text>
                  <Text style={s.corCodigo}>{cor.backgroundColor.toUpperCase()}</Text>
                  <TouchableOpacity
                    style={[s.paletaRapidaBtn, paletaAberta && s.paletaRapidaBtnAtivo]}
                    onPress={() => setPaletaRapidaAberta(paletaAberta ? null : indice)}
                  >
                    <Ionicons name="color-palette-outline" size={18} color={paletaAberta ? '#fff' : '#1a3a5c'} />
                  </TouchableOpacity>
                  <SeletorCor value={cor.backgroundColor} onChange={(valor) => alterarCor(indice, valor)} />
                </View>
                {paletaAberta && (
                  <View style={s.paletaRapidaGrid}>
                    {coresRapidas.map((corRapida, i) => (
                      <TouchableOpacity
                        key={`${corRapida}-${i}`}
                        style={[
                          s.paletaRapidaSwatch,
                          { backgroundColor: corRapida },
                          corRapida.toLowerCase() === cor.backgroundColor.toLowerCase() && s.paletaRapidaSwatchAtiva,
                        ]}
                        onPress={() => { alterarCor(indice, corRapida); setPaletaRapidaAberta(null); }}
                      >
                        {corRapida.toLowerCase() === cor.backgroundColor.toLowerCase() && (
                          <Ionicons name="checkmark" size={16} color="#1a3a5c" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <View style={s.sectionRow}>
            <Text style={s.section}>Fonte dos blocos</Text>
            <TouchableOpacity style={s.restaurar} onPress={() => setConfig((atual) => ({ ...atual, fonteId: FONTE_PADRAO_ATIVIDADES }))}>
              <Ionicons name="refresh" size={14} color="#1a3a5c" />
              <Text style={s.restaurarText}>Restaurar fontes</Text>
            </TouchableOpacity>
          </View>
          <View style={s.fontesGrid}>
            {FONTES_ATIVIDADES.map((opcao) => (
              <TouchableOpacity key={opcao.id} style={[s.fonteCard, config.fonteId === opcao.id && s.fonteCardAtiva]} onPress={() => setConfig((atual) => ({ ...atual, fonteId: opcao.id }))}>
                <Text style={[s.fonteAmostra, opcao.fontFamily ? { fontFamily: opcao.fontFamily } : null]}>Aa</Text>
                <Text style={s.fonteNome}>{opcao.nome}</Text>
                <Text style={s.fonteDescricao}>{opcao.descricao}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.salvar} onPress={salvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={19} color="#fff" />}
            <Text style={s.salvarText}>Salvar aparência</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { padding: 5 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.76)', marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 36 },
  intro: { backgroundColor: '#fff', borderRadius: 13, padding: 13, color: '#557', lineHeight: 19, marginBottom: 16 },
  section: { fontSize: 15, fontWeight: '900', color: '#1a3a5c', marginTop: 10, marginBottom: 10 },
  paletasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paletaCard: { width: '48%', backgroundColor: '#fff', borderRadius: 11, borderWidth: 1, borderColor: '#d9e2eb', padding: 9, gap: 7 },
  paletaCardAtiva: { borderColor: '#1a3a5c', borderWidth: 2 },
  paletaNome: { color: '#1a3a5c', fontWeight: '800', fontSize: 12 },
  paletaCores: { flexDirection: 'row', gap: 4 },
  paletaCor: { flex: 1, height: 16, borderRadius: 4 },
  sectionRow: { flexDirection: 'row', marginTop: 13, alignItems: 'center', justifyContent: 'space-between' },
  restaurar: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: '#e8f0fe', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 10 },
  restaurarText: { color: '#1a3a5c', fontWeight: '800', fontSize: 11 },
  corLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 11, padding: 8, marginBottom: 7 },
  corPreview: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  corLabel: { flex: 1, fontWeight: '800', color: '#1a3a5c' },
  corCodigo: { color: '#78909c', fontSize: 11 },
  corHexInput: { width: 96, height: 42, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6e0e8', borderRadius: 10, paddingHorizontal: 8 },
  paletaRapidaBtn: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#eef3f8', alignItems: 'center', justifyContent: 'center' },
  paletaRapidaBtnAtivo: { backgroundColor: '#1a3a5c' },
  paletaRapidaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#fff', borderRadius: 11, padding: 10, marginTop: -3, marginBottom: 7 },
  paletaRapidaSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  paletaRapidaSwatchAtiva: { borderWidth: 2, borderColor: '#1a3a5c' },
  fontesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fonteCard: { width: '48%', backgroundColor: '#fff', borderRadius: 11, borderWidth: 1, borderColor: '#d9e2eb', padding: 10 },
  fonteCardAtiva: { borderColor: '#1a3a5c', borderWidth: 2, backgroundColor: '#eaf2fb' },
  fonteAmostra: { color: '#1a3a5c', fontSize: 23, fontWeight: '900' },
  fonteNome: { color: '#1a3a5c', fontSize: 13, fontWeight: '900', marginTop: 3 },
  fonteDescricao: { color: '#78909c', fontSize: 11, marginTop: 2 },
  salvar: { marginTop: 20, backgroundColor: '#1a3a5c', borderRadius: 13, height: 52, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  salvarText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});

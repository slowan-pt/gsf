import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useAparenciaStore } from '../../src/stores/aparenciaStore';
import { useCores, useTemaStore } from '../../src/stores/temaStore';
import { BottomNav } from '../../src/components/BottomNav';
import {
  FONTE_PADRAO_ATIVIDADES,
  FONTES_ATIVIDADES,
  PALETA_PADRAO_ATIVIDADES,
  PALETAS_ATIVIDADES,
  type VisualAtividadesConfig,
  carregarVisualAtividades,
  coresMarcaDaPaleta,
  fonteAtividadesPorId,
  paletaAtividadesConfigurada,
  paletaAtividadesPorId,
  salvarVisualAtividades,
} from '../../src/lib/paletaAtividades';
import { avisar } from '../../src/stores/avisoStore';
import { corCabecalhoPorTema, corIcone, estiloCartao, tomTexto } from '../../src/lib/tema';

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
      style={[s.corHexInput]}
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
  const modoEscuro = useTemaStore((s) => s.escuro);
  const definirModoEscuro = useTemaStore((s) => s.definirModoEscuro);
  const cores = useCores();
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
  const cabecalho = coresMarcaDaPaleta(paleta).primaria;
  const cabecalhoTratado = corCabecalhoPorTema(cabecalho, cores.isEscuro);

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
      useAparenciaStore.getState().definirPaleta(paleta);
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
    <View style={[s.container, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.fundo }]}>
      <View style={[s.header, { backgroundColor: cabecalhoTratado, paddingRight: 76 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, fonte.fontFamily ? { fontFamily: fonte.fontFamily } : null]}>Aparência</Text>
          <Text style={s.sub}>Só afeta a sua visualização</Text>
        </View>
      </View>
      {carregando ? (
        <ActivityIndicator size="large" color={corIcone(cores)} style={{ marginTop: 45 }} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={[s.modoEscuroCard, cores.isEscuro && { backgroundColor: '#1d1932' }, estiloCartao(cores), { borderColor: cores.borda }]}>
            <View style={[s.modoEscuroIcon, { backgroundColor: cores.acentoSuave }]}>
              <Ionicons name={modoEscuro ? 'moon' : 'sunny'} size={20} color={cores.acento} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.modoEscuroTitulo, cores.isEscuro && { color: '#f1eefc' }, cores.isEscuro && { color: '#fff' }, { color: cores.texto }]}>Modo escuro</Text>
              <Text style={[s.modoEscuroSub, { color: cores.textoSecundario }]}>Deixa o app inteiro com fundo escuro. Vale só para você, em qualquer aparelho.</Text>
            </View>
            <Switch
              value={modoEscuro}
              onValueChange={(v) => definirModoEscuro(usuario?.id, v)}
              trackColor={{ false: cores.borda, true: cores.acento }}
              accessibilityLabel="Modo escuro"
              thumbColor="#fff"
            />
          </View>

          <Text style={[s.intro, cores.isEscuro && { backgroundColor: '#1d1932', color: '#d0d0e2' }, estiloCartao(cores), { color: cores.textoSecundario }]}>A escolha altera o cabeçalho e os blocos de atividades. O contraste dos textos é ajustado automaticamente.</Text>
          <Text style={[s.section, cores.isEscuro && { color: '#cdbcff' }, { color: cores.texto }]}>Paleta base</Text>
          <View style={s.paletasGrid}>
            {PALETAS_ATIVIDADES.map((opcao) => (
              <TouchableOpacity key={opcao.id} style={[s.paletaCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, estiloCartao(cores), { borderColor: cores.borda, borderWidth: 1, borderRadius: 18 }, config.paletaId === opcao.id && { borderColor: cores.acento, borderWidth: 2 }]} accessibilityRole="button" accessibilityState={{ selected: config.paletaId === opcao.id }} onPress={() => escolherTema(opcao.id)}>
                <Text style={[s.paletaNome, cores.isEscuro && { color: '#cdbcff' }, { color: cores.texto }]}>{opcao.nome}</Text>
                <View style={[s.paletaCabecalho, { backgroundColor: coresMarcaDaPaleta(opcao).primaria }]}>
                  <View style={[s.paletaPonto, { backgroundColor: coresMarcaDaPaleta(opcao).secundaria }]} />
                </View>
                <View style={s.paletaCores}>
                  {opcao.cores.map((cor, indice) => <View key={indice} style={[s.paletaCor, { backgroundColor: cor.backgroundColor, borderColor: cor.borderColor }]} />)}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.sectionRow}>
            <Text style={[s.section, cores.isEscuro && { color: '#cdbcff' }, { color: cores.texto }]}>Cores editáveis</Text>
            <TouchableOpacity style={[s.restaurar, cores.isEscuro && { backgroundColor: '#3e3a4b' }, { backgroundColor: cores.fundo }]} onPress={() => setConfig((atual) => ({ ...atual, paletaId: PALETA_PADRAO_ATIVIDADES, coresPersonalizadas: null }))}>
              <Ionicons name="refresh" size={14} color={corIcone(cores)} />
              <Text style={[s.restaurarText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Restaurar cores</Text>
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
                <View style={[s.corLinha, cores.isEscuro && { backgroundColor: '#1d1932' }, estiloCartao(cores), { borderRadius: 18 }]}>
                  <View style={[s.corPreview, { backgroundColor: cor.backgroundColor, borderColor: cor.borderColor }]}>
                    <Text style={{ color: cor.accentColor, fontWeight: '900' }}>{indice + 1}</Text>
                  </View>
                  <Text style={[s.corLabel, cores.isEscuro && { color: '#cdbcff' }, { color: cores.texto }]}>Bloco {indice + 1}</Text>
                  <Text style={[s.corCodigo, cores.isEscuro && { color: '#bcc7cf' }, { color: cores.textoSecundario }]}>{cor.backgroundColor.toUpperCase()}</Text>
                  <TouchableOpacity
                    style={[s.paletaRapidaBtn, cores.isEscuro && { backgroundColor: '#3e3b4b' }, { backgroundColor: cores.fundo }, paletaAberta && s.paletaRapidaBtnAtivo]}
                    onPress={() => setPaletaRapidaAberta(paletaAberta ? null : indice)}
                  >
                    <Ionicons name="color-palette-outline" size={18} color={paletaAberta ? '#fff' : tomTexto('#4b2bb0', cores)} />
                  </TouchableOpacity>
                  <SeletorCor value={cor.backgroundColor} onChange={(valor) => alterarCor(indice, valor)} />
                </View>
                {paletaAberta && (
                  <View style={[s.paletaRapidaGrid, cores.isEscuro && { backgroundColor: '#1d1932' }, { backgroundColor: cores.cartao }]}>
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
                          <Ionicons name="checkmark" size={16} color={corIcone(cores)} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <View style={s.sectionRow}>
            <Text style={[s.section, cores.isEscuro && { color: '#cdbcff' }, { color: cores.texto }]}>Fonte dos blocos</Text>
            <TouchableOpacity style={[s.restaurar, cores.isEscuro && { backgroundColor: '#3e3a4b' }, { backgroundColor: cores.fundo }]} onPress={() => setConfig((atual) => ({ ...atual, fonteId: FONTE_PADRAO_ATIVIDADES }))}>
              <Ionicons name="refresh" size={14} color={corIcone(cores)} />
              <Text style={[s.restaurarText, cores.isEscuro && { color: '#cdbcff' }, cores.isEscuro && { color: '#fff' }]}>Restaurar fontes</Text>
            </TouchableOpacity>
          </View>
          <View style={s.fontesGrid}>
            {FONTES_ATIVIDADES.map((opcao) => (
              <TouchableOpacity key={opcao.id} style={[s.fonteCard, cores.isEscuro && { backgroundColor: '#1d1932', borderColor: '#322c52' }, estiloCartao(cores), { borderColor: cores.borda, borderWidth: 1, borderRadius: 18 }, config.fonteId === opcao.id && { borderColor: cores.acento, borderWidth: 2 }]} accessibilityRole="button" accessibilityState={{ selected: config.fonteId === opcao.id }} onPress={() => setConfig((atual) => ({ ...atual, fonteId: opcao.id }))}>
                <Text style={[s.fonteAmostra, cores.isEscuro && { color: '#cdbcff' }, { color: cores.acento }, opcao.fontFamily ? { fontFamily: opcao.fontFamily } : null]}>Aa</Text>
                <Text style={[s.fonteNome, cores.isEscuro && { color: '#cdbcff' }, { color: cores.texto }]}>{opcao.nome}</Text>
                <Text style={[s.fonteDescricao, cores.isEscuro && { color: '#bcc7cf' }, { color: cores.textoSecundario }]}>{opcao.descricao}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[s.salvar, { backgroundColor: cores.primaria, boxShadow: `0px 4px 0px ${cores.profundo}` }]} onPress={salvar} disabled={salvando} accessibilityRole="button">
            {salvando ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={19} color="#fff" />}
            <Text style={[s.salvarText]}>Salvar aparência</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f3fb' },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { padding: 5 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.76)', marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 36 },
  modoEscuroCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, padding: 14, marginBottom: 16 },
  modoEscuroIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modoEscuroTitulo: { fontWeight: '900', fontSize: 14, color: '#1f1b33' },
  modoEscuroSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  intro: { backgroundColor: '#fff', borderRadius: 18, padding: 13, color: '#557', lineHeight: 19, marginBottom: 16 },
  section: { fontSize: 15, fontWeight: '900', color: '#4b2bb0', marginTop: 10, marginBottom: 10 },
  paletasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paletaCard: { width: '48%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#d9e2eb', padding: 9, gap: 7 },
  paletaCardAtiva: { borderColor: '#7c39e7', borderWidth: 2 },
  paletaNome: { color: '#4b2bb0', fontWeight: '800', fontSize: 12 },
  paletaCores: { flexDirection: 'row', gap: 4 },
  paletaCor: { flex: 1, height: 26, borderRadius: 6, borderWidth: 1.5 },
  paletaCabecalho: { height: 20, borderRadius: 8, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 6 },
  paletaPonto: { width: 12, height: 12, borderRadius: 6 },
  sectionRow: { flexDirection: 'row', marginTop: 13, alignItems: 'center', justifyContent: 'space-between' },
  restaurar: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: '#ece5fb', borderRadius: 16, paddingVertical: 7, paddingHorizontal: 10 },
  restaurarText: { color: '#4b2bb0', fontWeight: '800', fontSize: 11 },
  corLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 11, padding: 8, marginBottom: 7 },
  corPreview: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  corLabel: { flex: 1, fontWeight: '800', color: '#4b2bb0' },
  corCodigo: { color: '#78909c', fontSize: 11 },
  corHexInput: { width: 96, height: 42, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d6e0e8', borderRadius: 10, paddingHorizontal: 8 },
  paletaRapidaBtn: { width: 36, height: 36, borderRadius: 22, backgroundColor: '#efeaf9', alignItems: 'center', justifyContent: 'center' },
  paletaRapidaBtnAtivo: { backgroundColor: '#7c39e7' },
  paletaRapidaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#fff', borderRadius: 11, padding: 10, marginTop: -3, marginBottom: 7 },
  paletaRapidaSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  paletaRapidaSwatchAtiva: { borderWidth: 2, borderColor: '#7c39e7' },
  fontesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fonteCard: { width: '48%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#d9e2eb', padding: 10 },
  fonteCardAtiva: { borderColor: '#7c39e7', borderWidth: 2, backgroundColor: '#eaf2fb' },
  fonteAmostra: { color: '#4b2bb0', fontSize: 23, fontWeight: '900' },
  fonteNome: { color: '#4b2bb0', fontSize: 13, fontWeight: '900', marginTop: 3 },
  fonteDescricao: { color: '#78909c', fontSize: 11, marginTop: 2 },
  salvar: { marginTop: 20, backgroundColor: '#7c39e7', borderRadius: 22, height: 52, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  salvarText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});

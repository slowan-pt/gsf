import { createElement, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from './ModalSeguro';
import { useCores } from '../stores/temaStore';
import { corIcone } from '../lib/tema';
import { completarMoeda, dataBrParaIso, dataIsoParaBr, mascararData, mascararMoeda } from '../lib/patrimonioNucleo';

/** Na web, tira o contorno do navegador do campo de texto (a caixa externa já tem borda). */
const SEM_CONTORNO = (Platform.OS === 'web' ? { outlineStyle: 'none' } : null) as unknown as TextStyle;

/** Campos de formulário do Patrimônio: valor em reais com máscara e data que se digita ou se escolhe no calendário. */

interface CampoBase {
  valor: string;
  onChange: (v: string) => void;
  editavel: boolean;
  /** Estilo da caixa do campo (borda, fundo, cor do texto), o mesmo dos outros campos do formulário. */
  estilo: StyleProp<ViewStyle>;
  rotulo: string;
}

/** "R$" fixo à esquerda; digita os reais, "." ou "," começa os centavos; ao sair do campo completa os centavos. */
export function CampoMoeda({ valor, onChange, editavel, estilo, rotulo }: CampoBase) {
  const cores = useCores();
  return (
    <View style={[estilo as StyleProp<ViewStyle>, s.caixa]}>
      <Text style={[s.prefixo, { color: cores.textoSecundario }]}>R$</Text>
      <TextInput
        style={[s.entrada, { color: cores.texto }, SEM_CONTORNO]}
        value={valor}
        onChangeText={(t) => onChange(mascararMoeda(t, valor))}
        onBlur={() => onChange(completarMoeda(valor))}
        keyboardType="decimal-pad"
        placeholder="0,00"
        placeholderTextColor={cores.placeholder}
        editable={editavel}
        accessibilityLabel={rotulo}
      />
    </View>
  );
}

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Data em dd/mm/aaaa: dá para digitar só os números (a barra entra sozinha) ou abrir o calendário no ícone. */
export function CampoDataDigitavel({ valor, onChange, editavel, estilo, rotulo, maxima }: CampoBase & { maxima?: Date }) {
  const cores = useCores();
  const [aberto, setAberto] = useState(false);
  const refWeb = useRef<any>(null);
  const iso = dataBrParaIso(valor);
  const selecionada = iso ? new Date(`${iso}T12:00:00`) : new Date();

  const escolher = (d?: Date) => {
    if (!d) return;
    onChange(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
  };

  const abrirWeb = (e: any) => {
    const el = (refWeb.current ?? e?.target) as HTMLInputElement | null;
    try { el?.showPicker?.(); } catch { el?.focus?.(); }
  };

  return (
    <View style={[estilo as StyleProp<ViewStyle>, s.caixa]}>
      <TextInput
        style={[s.entrada, { color: cores.texto }, SEM_CONTORNO]}
        value={valor}
        onChangeText={(t) => onChange(mascararData(t))}
        keyboardType="number-pad"
        placeholder="dd/mm/aaaa"
        placeholderTextColor={cores.placeholder}
        maxLength={10}
        editable={editavel}
        accessibilityLabel={rotulo}
      />
      {editavel ? (
        Platform.OS === 'web' ? (
          <View style={s.botaoCalendario} accessibilityLabel={`Abrir calendário: ${rotulo}`} accessibilityRole="button">
            <Ionicons name="calendar-outline" size={20} color={corIcone(cores)} />
            {createElement('input', {
              ref: refWeb,
              type: 'date',
              value: iso ?? '',
              max: maxima ? `${maxima.getFullYear()}-${String(maxima.getMonth() + 1).padStart(2, '0')}-${String(maxima.getDate()).padStart(2, '0')}` : hojeIso(),
              onClick: abrirWeb,
              onChange: (ev: any) => { const v = ev?.target?.value; if (v) onChange(dataIsoParaBr(v)); },
              'aria-label': `Calendário: ${rotulo}`,
              style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0 },
            })}
          </View>
        ) : (
          <TouchableOpacity style={s.botaoCalendario} onPress={() => setAberto(true)} accessibilityRole="button" accessibilityLabel={`Abrir calendário: ${rotulo}`}>
            <Ionicons name="calendar-outline" size={20} color={corIcone(cores)} />
          </TouchableOpacity>
        )
      ) : null}

      {aberto && Platform.OS === 'android' ? (
        <DateTimePicker
          value={selecionada}
          mode="date"
          display="calendar"
          maximumDate={maxima ?? new Date()}
          onChange={(event, d) => {
            setAberto(false);
            if ((event as any)?.type !== 'dismissed') escolher(d);
          }}
        />
      ) : null}

      {aberto && Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" onRequestClose={() => setAberto(false)}>
          <Pressable style={[s.overlay, { backgroundColor: cores.overlay }]} onPress={() => setAberto(false)}>
            <Pressable style={[s.folha, { backgroundColor: cores.cartao }]} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker
                value={selecionada}
                mode="date"
                display="inline"
                locale="pt-BR"
                maximumDate={maxima ?? new Date()}
                onChange={(_, d) => escolher(d)}
                style={{ alignSelf: 'center' }}
              />
              <TouchableOpacity style={s.confirmar} onPress={() => setAberto(false)} activeOpacity={0.85}>
                <Text style={s.confirmarTexto}>Confirmar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingHorizontal: 0, minHeight: 44, overflow: 'hidden' },
  prefixo: { paddingLeft: 12, fontSize: 14, fontWeight: '700' },
  entrada: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14 },
  botaoCalendario: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  folha: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  confirmar: { backgroundColor: '#7c39e7', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  confirmarTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

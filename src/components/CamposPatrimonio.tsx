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

/**
 * Campo de texto com lista suspensa (combo): toque no campo ou na seta para ver as opções (as que combinam com o que foi
 * digitado) e escolha uma, ou simplesmente escreva outra. A lista abre logo abaixo, empurrando o resto do formulário.
 */
export function CampoComLista({ valor, onChange, opcoes, editavel, estilo, rotulo, placeholder, maxLength = 60 }: CampoBase & { opcoes: string[]; placeholder?: string; maxLength?: number }) {
  const cores = useCores();
  const [aberta, setAberta] = useState(false);
  const busca = valor.trim().toLowerCase();
  const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtradas = opcoes.filter((o) => !busca || semAcento(o).includes(semAcento(busca))).slice(0, 12);
  const escolher = (o: string) => { onChange(o); setAberta(false); };

  return (
    <View style={{ gap: 4 }}>
      <View style={[estilo as StyleProp<ViewStyle>, s.caixa]}>
        <TextInput
          style={[s.entrada, { color: cores.texto }, SEM_CONTORNO]}
          value={valor}
          onChangeText={(t) => { onChange(t); setAberta(true); }}
          onFocus={() => setAberta(true)}
          onBlur={() => setTimeout(() => setAberta(false), 150)}
          placeholder={placeholder}
          placeholderTextColor={cores.placeholder}
          maxLength={maxLength}
          editable={editavel}
          accessibilityLabel={rotulo}
        />
        {editavel ? (
          <TouchableOpacity style={s.botaoCalendario} onPress={() => setAberta((v) => !v)} accessibilityRole="button" accessibilityLabel={`${aberta ? 'Fechar' : 'Abrir'} a lista: ${rotulo}`}>
            <Ionicons name={aberta ? 'chevron-up' : 'chevron-down'} size={18} color={cores.textoSecundario} />
          </TouchableOpacity>
        ) : null}
      </View>
      {editavel && aberta && filtradas.length > 0 ? (
        <View style={[s.lista, { backgroundColor: cores.cartao, borderColor: cores.borda }]}>
          {filtradas.map((o) => (
            <TouchableOpacity key={o} style={s.itemLista} onPress={() => escolher(o)} accessibilityRole="button" accessibilityLabel={`Escolher ${o}`}>
              <Text style={{ color: cores.texto, fontSize: 14, fontWeight: o.toLowerCase() === busca ? '800' : '500' }}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
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
  lista: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', maxHeight: 260 },
  itemLista: { paddingHorizontal: 14, paddingVertical: 11 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  folha: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  confirmar: { backgroundColor: '#7c39e7', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  confirmarTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

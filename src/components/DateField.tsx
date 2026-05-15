import { createElement, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  defaultDate?: Date;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function dateToISO(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function isoToLocalDate(value: string, fallback: Date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function isoToBR(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function maskDate(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function brToISO(text: string) {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(year, month - 1, day, 12);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return dateToISO(date);
}

export function DateField({
  value,
  onChange,
  placeholder = 'Selecionar data',
  minimumDate,
  maximumDate,
  defaultDate = new Date(),
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [showNativePicker, setShowNativePicker] = useState(false);
  const [manualValue, setManualValue] = useState('');

  const selected = isoToLocalDate(value, defaultDate);
  const label = value ? isoToBR(value) : placeholder;

  function abrir() {
    const initial = value ? isoToBR(value) : isoToBR(dateToISO(defaultDate));
    setManualValue(initial);
    setShowNativePicker(true);
    setOpen(true);
  }

  function confirmarManual() {
    const iso = brToISO(manualValue);
    if (!iso) {
      Alert.alert('Data inválida', 'Informe a data no formato DD/MM/AAAA.');
      return;
    }

    const date = isoToLocalDate(iso, defaultDate);
    if (minimumDate && date < minimumDate) {
      Alert.alert('Data inválida', 'A data informada está antes do período permitido.');
      return;
    }
    if (maximumDate && date > maximumDate) {
      Alert.alert('Data inválida', 'A data informada está depois do período permitido.');
      return;
    }

    onChange(iso);
    setOpen(false);
  }

  function confirmarCalendario(date?: Date) {
    if (!date) return;
    const iso = dateToISO(date);
    setManualValue(isoToBR(iso));
    onChange(iso);
    if (Platform.OS === 'android') setOpen(false);
  }

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={abrir} activeOpacity={0.75}>
        <Ionicons name="calendar-outline" size={18} color="#1a3a5c" />
        <Text style={[styles.text, !value && styles.placeholder]}>{label}</Text>
        <Ionicons name="chevron-down" size={16} color="#8a98a8" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title}>Selecionar data</Text>

            {Platform.OS === 'web' ? (
              <View style={styles.webDateWrap}>
                {createElement('input', {
                  type: 'date',
                  value: value || dateToISO(defaultDate),
                  min: minimumDate ? dateToISO(minimumDate) : undefined,
                  max: maximumDate ? dateToISO(maximumDate) : undefined,
                  onChange: (event: any) => {
                    const iso = event?.target?.value;
                    if (iso) {
                      setManualValue(isoToBR(iso));
                      onChange(iso);
                    }
                  },
                  style: {
                    width: '100%',
                    height: 52,
                    border: '1px solid #d8dee6',
                    borderRadius: 12,
                    padding: '0 14px',
                    color: '#1a3a5c',
                    fontSize: 17,
                    fontWeight: 700,
                    backgroundColor: '#fff',
                  },
                })}
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.secondary}
                  onPress={() => setShowNativePicker((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar" size={17} color="#1a3a5c" />
                  <Text style={styles.secondaryText}>
                    {showNativePicker ? 'Ocultar calendário' : 'Abrir calendário'}
                  </Text>
                </TouchableOpacity>

                {showNativePicker && (
                  <DateTimePicker
                    value={selected}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                    locale="pt-BR"
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    onChange={(event, date) => {
                      if ((event as any)?.type === 'dismissed') {
                        setShowNativePicker(false);
                        return;
                      }
                      confirmarCalendario(date);
                    }}
                    style={{ alignSelf: 'center' }}
                  />
                )}
              </>
            )}

            <Text style={styles.manualLabel}>Ou digite a data</Text>
            <TextInput
              value={manualValue}
              onChangeText={(text) => setManualValue(maskDate(text))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              style={styles.input}
            />

            <TouchableOpacity style={styles.done} onPress={confirmarManual} activeOpacity={0.85}>
              <Text style={styles.doneText}>Confirmar data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancel} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  text: { flex: 1, fontSize: 15, color: '#333', fontWeight: '600' },
  placeholder: { color: '#999', fontWeight: '400' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  handle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { color: '#1a3a5c', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  webDateWrap: { marginBottom: 12 },
  manualLabel: { color: '#777', fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#d8dee6',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    fontSize: 17,
    color: '#1a3a5c',
    fontWeight: '700',
    backgroundColor: '#fff',
  },
  secondary: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#eef4f9',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { color: '#1a3a5c', fontWeight: '800' },
  done: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  doneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancel: { padding: 14, alignItems: 'center' },
  cancelText: { color: '#999', fontWeight: '700' },
});

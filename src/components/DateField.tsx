import { createElement, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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

export function DateField({
  value,
  onChange,
  placeholder = 'Selecionar data',
  minimumDate,
  maximumDate,
  defaultDate = new Date(),
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  const selected = isoToLocalDate(value, defaultDate);
  const label = value ? isoToBR(value) : placeholder;

  function confirmar(date?: Date) {
    if (!date) return;
    onChange(dateToISO(date));
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webField}>
        <Ionicons name="calendar-outline" size={18} color="#1a3a5c" />
        {createElement('input', {
          type: 'date',
          value: value || '',
          min: minimumDate ? dateToISO(minimumDate) : undefined,
          max: maximumDate ? dateToISO(maximumDate) : undefined,
          onChange: (event: any) => {
            const iso = event?.target?.value;
            if (iso) onChange(iso);
          },
          placeholder,
          style: {
            flex: 1,
            minWidth: 0,
            border: 0,
            outline: 'none',
            color: value ? '#333' : '#999',
            fontSize: 15,
            fontWeight: value ? 600 : 400,
            backgroundColor: 'transparent',
            fontFamily: 'inherit',
          },
        })}
        <Ionicons name="chevron-down" size={16} color="#8a98a8" />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <Ionicons name="calendar-outline" size={18} color="#1a3a5c" />
        <Text style={[styles.text, !value && styles.placeholder]}>{label}</Text>
        <Ionicons name="chevron-down" size={16} color="#8a98a8" />
      </TouchableOpacity>

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={selected}
          mode="date"
          display="calendar"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, date) => {
            setOpen(false);
            if ((event as any)?.type !== 'dismissed') confirmar(date);
          }}
        />
      )}

      {open && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.handle} />
              <DateTimePicker
                value={selected}
                mode="date"
                display="inline"
                locale="pt-BR"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(_, date) => confirmar(date)}
                style={{ alignSelf: 'center' }}
              />
              <TouchableOpacity style={styles.done} onPress={() => setOpen(false)} activeOpacity={0.85}>
                <Text style={styles.doneText}>Confirmar</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const baseField = {
  minHeight: 48,
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 10,
  paddingHorizontal: 12,
  backgroundColor: '#fafafa',
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 9,
};

const styles = StyleSheet.create({
  field: baseField,
  webField: baseField,
  text: { flex: 1, fontSize: 15, color: '#333', fontWeight: '600' },
  placeholder: { color: '#999', fontWeight: '400' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  handle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  done: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  doneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

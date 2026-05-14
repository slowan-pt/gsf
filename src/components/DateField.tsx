import { useState } from 'react';
import {
  Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  defaultDate?: Date;
}

function parseValue(value: string, fallback: Date) {
  try {
    if (value && value.length >= 10) return parseISO(value.slice(0, 10));
  } catch {}
  return fallback;
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
  const selected = parseValue(value, defaultDate);
  const label = value
    ? format(selected, 'dd/MM/yyyy', { locale: ptBR })
    : placeholder;

  function confirmar(date?: Date) {
    if (date) onChange(format(date, 'yyyy-MM-dd'));
  }

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <Ionicons name="calendar-outline" size={18} color="#1a3a5c" />
        <Text style={[styles.text, !value && styles.placeholder]}>{label}</Text>
        <Ionicons name="chevron-down" size={16} color="#8a98a8" />
      </TouchableOpacity>

      {open && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide">
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
                  onChange={(_, d) => confirmar(d)}
                  style={{ alignSelf: 'center' }}
                />
                <TouchableOpacity style={styles.done} onPress={() => setOpen(false)}>
                  <Text style={styles.doneText}>Confirmar</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker
            value={selected}
            mode="date"
            display="calendar"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_, d) => {
              setOpen(false);
              confirmar(d);
            }}
          />
        )
      )}
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
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  done: { backgroundColor: '#1a3a5c', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  doneText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

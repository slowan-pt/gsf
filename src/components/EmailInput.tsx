import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';

const DOMINIOS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'icloud.com'];

interface EmailInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType' | 'autoCapitalize'> {
  value: string;
  onChangeText: (v: string) => void;
}

/** Campo de e-mail com sugestões de domínio (@gmail.com, @hotmail.com...) para
 * tocar em vez de digitar tudo. */
export function EmailInput({ value, onChangeText, onFocus, onBlur, style, ...rest }: EmailInputProps) {
  const [focado, setFocado] = useState(false);

  const arroba = value.indexOf('@');
  const usuario = arroba === -1 ? value : value.slice(0, arroba);
  const digitadoAposArroba = arroba === -1 ? '' : value.slice(arroba + 1);
  const sugestoes = arroba === -1
    ? (usuario ? DOMINIOS : [])
    : DOMINIOS.filter((d) => d.startsWith(digitadoAposArroba) && d !== digitadoAposArroba);

  function escolherDominio(dominio: string) {
    onChangeText(`${usuario}@${dominio}`);
  }

  return (
    <View>
      <TextInput
        style={style}
        value={value}
        onChangeText={onChangeText}
        keyboardType="email-address"
        autoCapitalize="none"
        onFocus={(e) => { setFocado(true); onFocus?.(e); }}
        onBlur={(e) => { setTimeout(() => setFocado(false), 150); onBlur?.(e); }}
        {...rest}
      />
      {focado && sugestoes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.sugestoesLinha} keyboardShouldPersistTaps="always">
          {sugestoes.map((d) => (
            <TouchableOpacity key={d} style={s.chip} onPress={() => escolherDominio(d)}>
              <Text style={s.chipText}>@{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sugestoesLinha: { marginTop: 6 },
  chip: {
    backgroundColor: '#eef3f8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    marginRight: 8,
  },
  chipText: { color: '#1a3a5c', fontWeight: '700', fontSize: 13 },
});

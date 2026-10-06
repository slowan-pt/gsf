import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ItemFluxo } from '../../lib/fluxoClasses';
import { PendenciaModal } from './FilaClasses';

/**
 * Tarja vermelha na Início do membro: classes que a diretoria/regional devolveu para
 * correção. Fica até o fluxo ser refeito (a classe sai de "correção" quando é concluída
 * de novo). Os requisitos recusados voltam desmarcados na ficha de classes.
 */
export function TarjaPendencia({ itens, aoCorrigir }: { itens: ItemFluxo[]; aoCorrigir: (item: ItemFluxo) => void }) {
  const [vendo, setVendo] = useState<ItemFluxo | null>(null);
  if (itens.length === 0) return null;
  return (
    <View style={s.tarja} accessibilityRole="alert" accessibilityLabel={`Você tem correções a fazer em ${itens.length} classe`}>
      <View style={s.topo}>
        <Ionicons name="alert-circle" size={22} color="#fff" />
        <Text style={s.titulo}>{itens.length === 1 ? 'Você tem correções a fazer' : `Você tem correções a fazer (${itens.length})`}</Text>
      </View>
      {itens.map((item) => (
        <View key={item.id} style={s.linha}>
          <View style={{ flex: 1 }}>
            <Text style={s.nome}>{item.itemNome}</Text>
            <Text style={s.sub}>
              Recusada {item.recusadoPor === 'regional' ? 'pelo regional' : 'pela diretoria'} · {item.requisitosRecusados.length} {item.requisitosRecusados.length === 1 ? 'item' : 'itens'}
            </Text>
          </View>
          <TouchableOpacity style={s.btn} onPress={() => setVendo(item)} accessibilityRole="button">
            <Text style={s.btnTexto}>Ver pendência</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnCheio]} onPress={() => aoCorrigir(item)} accessibilityRole="button">
            <Text style={[s.btnTexto, { color: '#b71c1c' }]}>Corrigir</Text>
          </TouchableOpacity>
        </View>
      ))}
      <PendenciaModal item={vendo} onClose={() => setVendo(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  tarja: { backgroundColor: '#c62828', borderRadius: 18, padding: 14, marginBottom: 14, gap: 10, boxShadow: '0px 4px 0px #8e1b1b' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { color: '#fff', fontSize: 15, fontWeight: '900', flex: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, padding: 10, flexWrap: 'wrap' },
  nome: { color: '#fff', fontSize: 14, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.88)', fontSize: 11, marginTop: 1 },
  btn: { minHeight: 34, paddingHorizontal: 11, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  btnCheio: { backgroundColor: '#fff', borderColor: '#fff' },
  btnTexto: { color: '#fff', fontSize: 12, fontWeight: '900' },
});

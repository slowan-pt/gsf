import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCores } from '../stores/temaStore';
import { BarraExportar, CartaoRelatorio } from './CartaoRelatorio';
import { Chip, Dropdown } from './ui';

export interface ItemFormativoRelatorio {
  id: string;
  dbv_id: number;
  membro_nome: string;
  unidade_nome: string;
  tipo: 'classe' | 'especialidade';
  item_nome: string;
  situacao: 'entregue' | 'pronto' | 'pendente_aprovacao';
  origem?: string | null;
}

type Formato = 'pdf' | 'excel';
type Publico = 'todos' | 'unidades' | 'membro';
const COR = '#7c39e7';

function opcoes(nomes: string[]) {
  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((nome) => ({ valor: nome, rotulo: nome }));
}

function SelecaoMultipla({ titulo, nomes, selecionados, aoSelecionar }: {
  titulo: string; nomes: string[]; selecionados: string[]; aoSelecionar: (nomes: string[]) => void;
}) {
  return (
    <>
      <Dropdown titulo={titulo} placeholder={titulo} valor="" opcoes={opcoes(nomes.filter((n) => !selecionados.includes(n)))}
        onChange={(nome) => { if (nome) aoSelecionar([...selecionados, nome]); }} />
      <View style={s.linha}>
        {selecionados.map((nome) => (
          <Chip key={nome} rotulo={`${nome} ×`} ativo onPress={() => aoSelecionar(selecionados.filter((n) => n !== nome))} />
        ))}
      </View>
    </>
  );
}

export function RelatorioFormacao({ itens, carregando, exportar }: {
  itens: ItemFormativoRelatorio[];
  carregando: boolean;
  exportar: (titulo: string, itens: ItemFormativoRelatorio[], formato: Formato) => Promise<void>;
}) {
  const cores = useCores();
  const [tipo, setTipo] = useState<ItemFormativoRelatorio['tipo']>('classe');
  const [situacao, setSituacao] = useState<'entregue' | 'pronto'>('entregue');
  const [publico, setPublico] = useState<Publico>('todos');
  const [unidades, setUnidades] = useState<string[]>([]);
  const [membro, setMembro] = useState('');
  const [especificos, setEspecificos] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [formato, setFormato] = useState<Formato>('pdf');
  const [ocupado, setOcupado] = useState(false);
  const classes = tipo === 'classe';
  const titulo = `${classes ? 'Classes' : 'Especialidades'} — ${situacao === 'entregue' ? 'Recebidos' : 'A receber'}`;
  const base = itens.filter((i) => i.tipo === tipo && i.situacao !== 'pendente_aprovacao');
  const membros = [...new Map(base.map((i) => [i.dbv_id, i])).values()]
    .sort((a, b) => a.membro_nome.localeCompare(b.membro_nome, 'pt-BR'))
    .map((i) => ({ valor: String(i.dbv_id), rotulo: `${i.membro_nome} · ${i.unidade_nome}` }));
  const filtrados = base.filter((i) => i.situacao === situacao
    && (publico !== 'unidades' || unidades.includes(i.unidade_nome))
    && (publico !== 'membro' || String(i.dbv_id) === membro)
    && (!especificos || selecionados.includes(i.item_nome)));

  return (
    <CartaoRelatorio titulo="Classes e especialidades" icone="ribbon" cor={COR}>
      <View style={s.linha}>
        <Chip rotulo="Classes" ativo={classes} onPress={() => { setTipo('classe'); setSelecionados([]); }} />
        <Chip rotulo="Especialidades" ativo={!classes} onPress={() => { setTipo('especialidade'); setSelecionados([]); }} />
      </View>
      <View style={s.linha}>
        <Chip rotulo="Recebidos" ativo={situacao === 'entregue'} onPress={() => setSituacao('entregue')} />
        <Chip rotulo="A receber" ativo={situacao === 'pronto'} onPress={() => setSituacao('pronto')} />
      </View>
      <View style={s.linha}>
        {([['todos', 'Todos'], ['unidades', 'Unidades'], ['membro', 'Membro específico']] as const).map(([id, nome]) => (
          <Chip key={id} rotulo={nome} ativo={publico === id} onPress={() => setPublico(id)} />
        ))}
      </View>
      {publico === 'unidades' && <SelecaoMultipla titulo="Adicionar unidade" nomes={base.map((i) => i.unidade_nome)}
        selecionados={unidades} aoSelecionar={setUnidades} />}
      {publico === 'membro' && <Dropdown titulo="Membro específico" valor={membro} opcoes={membros} onChange={setMembro} />}
      <View style={s.linha}>
        <Chip rotulo={classes ? 'Todas as classes' : 'Todas as especialidades'} ativo={!especificos} onPress={() => setEspecificos(false)} />
        <Chip rotulo={classes ? 'Classes específicas' : 'Especialidades específicas'} ativo={especificos} onPress={() => setEspecificos(true)} />
      </View>
      {especificos && <SelecaoMultipla titulo={classes ? 'Adicionar classe' : 'Adicionar especialidade'}
        nomes={base.map((i) => i.item_nome)} selecionados={selecionados} aoSelecionar={setSelecionados} />}
      <Text accessibilityLiveRegion="polite" style={{ color: cores.textoSecundario }}>
        {carregando ? 'Carregando registros…' : `${filtrados.length} registro(s) com os filtros selecionados`}
      </Text>
      {!carregando && filtrados.slice(0, 20).map((item) => (
        <View key={item.id} style={[s.item, { borderColor: cores.borda }]}>
          <Text style={{ color: cores.texto, fontWeight: '700' }}>{item.item_nome}</Text>
          <Text style={{ color: cores.textoSecundario }}>{item.membro_nome} · {item.unidade_nome}</Text>
        </View>
      ))}
      {!carregando && filtrados.length > 20 && (
        <Text style={{ color: cores.textoSecundario }}>Prévia de 20 registros. A exportação inclui todos os resultados.</Text>
      )}
      <BarraExportar formato={formato} aoMudarFormato={setFormato} cor={COR} ocupado={ocupado}
        desabilitado={carregando || filtrados.length === 0}
        aoExportar={async () => {
          setOcupado(true);
          try { await exportar(titulo, filtrados, formato); } finally { setOcupado(false); }
        }} />
    </CartaoRelatorio>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  item: { borderTopWidth: 1, paddingVertical: 7, gap: 2 },
});

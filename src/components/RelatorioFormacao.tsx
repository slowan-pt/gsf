import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCores } from '../stores/temaStore';
import { combinaBusca } from '../lib/texto';
import { BarraExportar, CartaoRelatorio } from './CartaoRelatorio';
import { CampoBusca, Chip, Dropdown } from './ui';

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
  const [tipo, setTipo] = useState<ItemFormativoRelatorio['tipo'] | null>(null);
  const [situacao, setSituacao] = useState<'entregue' | 'pronto' | null>(null);
  const [publico, setPublico] = useState<Publico | null>(null);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [buscaMembro, setBuscaMembro] = useState('');
  const [membrosSelecionados, setMembrosSelecionados] = useState<number[]>([]);
  const [escopo, setEscopo] = useState<'todos' | 'especificos' | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [formato, setFormato] = useState<Formato>('pdf');
  const [ocupado, setOcupado] = useState(false);
  const classes = tipo === 'classe';
  const titulo = `${classes ? 'Classes' : 'Especialidades'} — ${situacao === 'entregue' ? 'Recebidos' : 'A receber'}`;
  const base = itens.filter((i) => i.tipo === tipo && i.situacao !== 'pendente_aprovacao');
  const membros = [...new Map(itens.filter((i) => i.situacao !== 'pendente_aprovacao').map((i) => [i.dbv_id, i])).values()]
    .sort((a, b) => a.membro_nome.localeCompare(b.membro_nome, 'pt-BR'));
  const sugestoes = membros.filter((m) => !membrosSelecionados.includes(m.dbv_id) && combinaBusca(m.membro_nome, buscaMembro));
  const filtrados = base.filter((i) => i.situacao === situacao
    && (publico !== 'unidades' || unidades.includes(i.unidade_nome))
    && (publico !== 'membro' || membrosSelecionados.includes(i.dbv_id))
    && (escopo !== 'especificos' || selecionados.includes(i.item_nome)));
  const publicoCompleto = publico === 'todos'
    || (publico === 'unidades' && unidades.length > 0)
    || (publico === 'membro' && membrosSelecionados.length > 0);
  const filtrosCompletos = publicoCompleto
    && (escopo === 'todos' || (escopo === 'especificos' && selecionados.length > 0));

  function escolherTipo(proximo: ItemFormativoRelatorio['tipo']) {
    if (proximo === tipo) return;
    setTipo(proximo);
    setSituacao(null);
    setPublico(null);
    setEscopo(null);
    setSelecionados([]);
  }

  function escolherSituacao(proxima: 'entregue' | 'pronto') {
    if (proxima === situacao) return;
    setSituacao(proxima);
    setPublico(null);
    setEscopo(null);
  }

  return (
    <CartaoRelatorio titulo="Classes e especialidades" icone="ribbon" cor={COR}>
      <View style={s.linha}>
        <Chip rotulo="Classes" ativo={classes} onPress={() => escolherTipo('classe')} />
        <Chip rotulo="Especialidades" ativo={tipo === 'especialidade'} onPress={() => escolherTipo('especialidade')} />
      </View>
      {tipo && <View style={s.linha}>
        <Chip rotulo="Recebidos" ativo={situacao === 'entregue'} onPress={() => escolherSituacao('entregue')} />
        <Chip rotulo="A receber" ativo={situacao === 'pronto'} onPress={() => escolherSituacao('pronto')} />
      </View>}
      {situacao && <View style={s.linha}>
        {([['todos', 'Todos'], ['unidades', 'Unidades'], ['membro', 'Membro específico']] as const).map(([id, nome]) => (
          <Chip key={id} rotulo={nome} ativo={publico === id} onPress={() => {
            if (publico !== id) setEscopo(null);
            setPublico(id);
          }} />
        ))}
      </View>}
      {publico === 'unidades' && <SelecaoMultipla titulo="Adicionar unidade" nomes={base.map((i) => i.unidade_nome)}
        selecionados={unidades} aoSelecionar={setUnidades} />}
      {publico === 'membro' && (
        <View style={s.buscaMembros}>
          <CampoBusca valor={buscaMembro} onChange={setBuscaMembro} placeholder="Digite o nome do membro" />
          {!!membrosSelecionados.length && (
            <View style={s.linha}>
              {membros.filter((m) => membrosSelecionados.includes(m.dbv_id)).map((m) => (
                <Chip key={m.dbv_id} rotulo={`${m.membro_nome} ×`} ativo
                  onPress={() => setMembrosSelecionados((ids) => ids.filter((id) => id !== m.dbv_id))} />
              ))}
            </View>
          )}
          {!!buscaMembro.trim() && (
            <View style={s.linha}>
              {sugestoes.slice(0, 12).map((m) => (
                <Chip key={m.dbv_id} rotulo={`${m.membro_nome} · ${m.unidade_nome}`} icone="add"
                  onPress={() => {
                    setMembrosSelecionados((ids) => ids.includes(m.dbv_id) ? ids : [...ids, m.dbv_id]);
                    setBuscaMembro('');
                  }} />
              ))}
              {sugestoes.length === 0 && <Text style={{ color: cores.textoSecundario }}>Nenhum membro disponível para essa busca.</Text>}
              {sugestoes.length > 12 && <Text style={{ color: cores.textoSecundario }}>Digite mais letras para refinar a busca.</Text>}
            </View>
          )}
        </View>
      )}
      {publicoCompleto && <View style={s.linha}>
        <Chip rotulo={classes ? 'Todas as classes' : 'Todas as especialidades'} ativo={escopo === 'todos'} onPress={() => setEscopo('todos')} />
        {classes && <Chip rotulo="Classes específicas" ativo={escopo === 'especificos'} onPress={() => setEscopo('especificos')} />}
      </View>}
      {publicoCompleto && classes && escopo === 'especificos' && <SelecaoMultipla titulo="Adicionar classe"
        nomes={base.map((i) => i.item_nome)} selecionados={selecionados} aoSelecionar={setSelecionados} />}
      {filtrosCompletos && <>
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
      </>}
    </CartaoRelatorio>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  buscaMembros: { gap: 8, marginBottom: 10 },
  item: { borderTopWidth: 1, paddingVertical: 7, gap: 2 },
});

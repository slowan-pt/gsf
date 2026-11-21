import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buscarPaginado } from '../lib/supabasePaginado';
import { carregarAguardandoInvestidura, carregarInvestidos, type ItemAguardando, type ItemInvestido } from '../lib/investidura';
import { exportarAptosAReceber, exportarInvestidos, formatarDataBR, type FormatoRelatorio } from '../lib/relatorioInvestidura';
import { useCores } from '../stores/temaStore';
import { BarraExportar, CartaoRelatorio } from './CartaoRelatorio';
import { DateField } from './DateField';
import { Chip } from './ui';

const COR = '#2e7d32';
const TAMANHO_PREVIA = 20;
const rotulos = { classe: 'Classe', especialidade: 'Especialidade', mestrado: 'Mestrado' };

function dataEvento(valor: string | null) {
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(valor ?? '');
  if (iso) return iso[1];
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor?.trim() ?? '');
  return br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : '';
}

export function RelatorioInvestidurasDatas({ clubeId, revisao }: { clubeId: number; revisao: unknown }) {
  const cores = useCores();
  const [datas, setDatas] = useState<string[]>([]);
  const [proxima, setProxima] = useState<string | null>(null);
  const [data, setData] = useState('');
  const [aconteceu, setAconteceu] = useState(true);
  const [formato, setFormato] = useState<FormatoRelatorio>('pdf');
  const [ocupado, setOcupado] = useState(false);
  const [erroDatas, setErroDatas] = useState(false);
  const [limite, setLimite] = useState(TAMANHO_PREVIA);
  const [lista, setLista] = useState<{ chave: string; itens: ItemAguardando[]; erro?: boolean } | null>(null);
  const chave = `${clubeId}:${data}:${aconteceu}`;
  const pronta = lista?.chave === chave;
  const itens = pronta ? lista.itens : [];

  useEffect(() => {
    let ativo = true;
    setErroDatas(false);
    void Promise.all([
      buscarPaginado<{ entregue_em: string }>((q) => q.eq('clube_id', clubeId)
        .eq('entregue', true).not('entregue_em', 'is', null), 'investidura_itens', 'entregue_em', 'id'),
      buscarPaginado<{ data: string | null }>((q) => q.eq('clube_id', clubeId)
        .ilike('atividade', '%investidura%'), 'eventos', 'data', 'id'),
    ]).then(([recebidos, agenda]) => {
      if (!ativo) return;
      const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
      setDatas([...new Set(recebidos.map((i) => dataEvento(i.entregue_em)).filter(Boolean))].sort().reverse().slice(0, 6));
      setProxima(agenda.map((i) => dataEvento(i.data)).filter((d) => d >= hoje).sort()[0] ?? null);
    }).catch(() => { if (ativo) setErroDatas(true); });
    return () => { ativo = false; };
  }, [clubeId, revisao]);

  useEffect(() => {
    if (!data) return;
    let ativo = true;
    setLista(null);
    setLimite(TAMANHO_PREVIA);
    const consulta = aconteceu ? carregarInvestidos(clubeId, data) : carregarAguardandoInvestidura(clubeId);
    void consulta.then((linhas) => {
      if (ativo) setLista({ chave, itens: linhas });
    }).catch(() => { if (ativo) setLista({ chave, itens: [], erro: true }); });
    return () => { ativo = false; };
  }, [chave, clubeId, data, aconteceu, revisao]);

  function selecionar(dia: string, realizada: boolean) {
    setAconteceu(realizada);
    setData(dia);
  }

  return (
    <CartaoRelatorio titulo="Investidos em uma data" descricao="Escolha uma investidura recente ou consulte os itens que aguardam a próxima." icone="calendar" cor={COR}>
      <View style={s.datas}>
        {datas.map((dia) => (
          <Chip key={dia} rotulo={formatarDataBR(dia)} ativo={aconteceu && data === dia} onPress={() => selecionar(dia, true)} />
        ))}
        {proxima && <Chip rotulo={`Próxima · ${formatarDataBR(proxima)}`} ativo={!aconteceu && data === proxima}
          onPress={() => selecionar(proxima, false)} />}
      </View>
      {erroDatas && <Text style={{ color: cores.textoSecundario }}>Não foi possível carregar as datas da investidura.</Text>}
      <DateField value={data} onChange={(dia) => selecionar(dia, true)} placeholder="Escolher outra data" />
      {!!data && (
        <>
          <Text accessibilityLiveRegion="polite" style={{ color: cores.texto, fontWeight: '700' }}>
            {!pronta ? 'Carregando…' : lista.erro ? 'Não foi possível carregar os itens.'
              : aconteceu ? `Itens entregues · ${itens.length}` : `Aguardando a próxima investidura · ${itens.length}`}
          </Text>
          {itens.slice(0, limite).map((i) => (
            <Text key={i.id} style={{ color: cores.textoSecundario }}>{rotulos[i.tipo]} · {i.nome} — {i.membroNome}</Text>
          ))}
          {itens.length > limite && <Chip rotulo="Mostrar mais itens" onPress={() => setLimite((l) => l + TAMANHO_PREVIA)} />}
          <BarraExportar formato={formato} aoMudarFormato={setFormato} cor={COR} ocupado={ocupado}
            desabilitado={itens.length === 0} aoExportar={async () => {
              setOcupado(true);
              try {
                if (aconteceu) await exportarInvestidos(itens as ItemInvestido[], data, formato);
                else await exportarAptosAReceber(itens, formato, data);
              } finally { setOcupado(false); }
            }} />
        </>
      )}
    </CartaoRelatorio>
  );
}

const s = StyleSheet.create({ datas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });

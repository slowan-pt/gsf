import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Modal } from './ModalSeguro';
import { avisar } from '../stores/avisoStore';
import { useCores } from '../stores/temaStore';
import type { ItemAguardando } from '../lib/investidura';
import { exportarAutorizacaoInvestidura } from '../lib/autorizacaoInvestidura';
import { frasePrevisao, listaDeTexto, montarRelacao, type DadosAutorizacao } from '../lib/autorizacaoInvestiduraNucleo';
import { DateField } from './DateField';

interface Props {
  visivel: boolean;
  itens: ItemAguardando[];
  /** Valores iniciais (clube, regional, diretor, o que foi usado da última vez). */
  padroes: DadosAutorizacao | null;
  onFechar: () => void;
}

const mascararHora = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
};

/** Formulário da "Autorização para Condecoração" (modelo Word da Associação) com os investidos de "Aptos a receber". */
export function AutorizacaoInvestiduraModal({ visivel, itens, padroes, onFechar }: Props) {
  const cores = useCores();
  const [f, setF] = useState<Record<string, string>>({});
  const [incluirQuantidades, setIncluirQuantidades] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!visivel || !padroes) return;
    setErro('');
    setF({
      clube: padroes.clube, associacao: padroes.associacao, regiao: padroes.regiao, cerimonia: padroes.cerimonia,
      dataCerimonia: padroes.dataCerimonia, horaCerimonia: padroes.horaCerimonia, localCerimonia: padroes.localCerimonia,
      instrutores: padroes.instrutores.join('\n'), autoridades: padroes.autoridades.join('\n'), cidade: padroes.cidade,
      dataDocumento: padroes.dataDocumento, diretorNome: padroes.diretorNome, regionalNome: padroes.regionalNome,
      coordenadorGeralNome: padroes.coordenadorGeralNome, departamentalNome: padroes.departamentalNome, registro: padroes.registro,
    });
  }, [visivel, padroes]);

  const relacao = useMemo(() => montarRelacao(itens), [itens]);
  const semNascimento = relacao.linhas.filter((l) => !l.dataNascimento).length;
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function gerar() {
    if (!padroes) return;
    const dataCer = /^\d{4}-\d{2}-\d{2}$/.test(f.dataCerimonia ?? '') ? f.dataCerimonia : '';
    if (!dataCer) { setErro('Escolha a data da cerimônia no calendário.'); return; }
    const dataDoc = /^\d{4}-\d{2}-\d{2}$/.test(f.dataDocumento ?? '') ? f.dataDocumento : '';
    if (!dataDoc) { setErro('Escolha a data do documento no calendário.'); return; }
    if (!/^\d{2}:\d{2}$/.test(f.horaCerimonia ?? '')) { setErro('Informe o horário da cerimônia (hh:mm).'); return; }
    if (!(f.clube ?? '').trim() || !(f.associacao ?? '').trim()) { setErro('Informe o nome do clube e da Associação.'); return; }
    setErro('');
    setGerando(true);
    try {
      const dados: DadosAutorizacao = {
        clube: f.clube, associacao: f.associacao, regiao: f.regiao ?? '', instrutores: listaDeTexto(f.instrutores ?? ''),
        cerimonia: f.cerimonia, dataCerimonia: dataCer, horaCerimonia: f.horaCerimonia, localCerimonia: f.localCerimonia ?? '',
        autoridades: listaDeTexto(f.autoridades ?? ''), cidade: f.cidade ?? '', dataDocumento: dataDoc, diretorNome: f.diretorNome ?? '',
        regionalNome: f.regionalNome ?? '', coordenadorGeralNome: f.coordenadorGeralNome ?? '', departamentalNome: f.departamentalNome ?? '',
        registro: f.registro ?? '',
      };
      await exportarAutorizacaoInvestidura(dados, itens, { incluirQuantidades });
      avisar('Documento gerado no modelo da Associação. Confira os dados antes de assinar.', 'sucesso', 'Autorização');
      onFechar();
    } catch (e: any) {
      avisar(e?.message ?? 'Não foi possível gerar o documento.', 'erro', 'Autorização');
    } finally {
      setGerando(false);
    }
  }

  const campo = [s.campo, { backgroundColor: cores.input, color: cores.texto, borderColor: cores.borda }];
  const rotulo = (t: string) => <Text style={[s.rotulo, { color: cores.textoSecundario }]}>{t}</Text>;
  const texto = (k: string, rot: string, extra: object = {}) => (
    <View style={{ gap: 2 }}>
      {rotulo(rot)}
      <TextInput style={[...campo, extra]} value={f[k] ?? ''} onChangeText={(v) => set(k, v)} accessibilityLabel={rot} placeholderTextColor={cores.placeholder} />
    </View>
  );

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={[s.overlay, { backgroundColor: cores.overlay }]}>
        <View style={[s.caixa, { backgroundColor: cores.cartao }]}>
          <Text style={[s.titulo, { color: cores.texto }]}>Autorização de investidura (Word)</Text>
          <Text style={[s.dica, { color: cores.textoSecundario }]}>{frasePrevisao(relacao).replace(', conforme a relação em anexo', '')}</Text>
          {semNascimento > 0 ? <Text style={[s.dica, { color: '#b26a00' }]}>{semNascimento} membro(s) sem data de nascimento cadastrada: a coluna ficará em branco para eles.</Text> : null}
          {!padroes ? <ActivityIndicator color={cores.acento} style={{ marginVertical: 24 }} /> : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
              <Text style={[s.secao, { color: cores.texto }]}>Cerimônia</Text>
              {texto('cerimonia', 'Tipo de cerimônia')}
              <View style={s.linha}>
                <View style={{ flex: 1, gap: 2 }}>{rotulo('Data *')}<DateField value={f.dataCerimonia ?? ''} onChange={(v) => set('dataCerimonia', v)} placeholder="Escolher no calendário" /></View>
                <View style={{ width: 110 }}>{rotulo('Horário *')}<TextInput style={campo} value={f.horaCerimonia ?? ''} onChangeText={(v) => set('horaCerimonia', mascararHora(v))} keyboardType="number-pad" placeholder="hh:mm" placeholderTextColor={cores.placeholder} maxLength={5} accessibilityLabel="Horário da cerimônia" /></View>
              </View>
              {texto('localCerimonia', 'Local (ex.: IASD Central de Fonseca)')}
              <View style={{ gap: 2 }}>
                {rotulo('Autoridades eclesiásticas e líderes presentes (um por linha)')}
                <TextInput style={[...campo, { minHeight: 80, textAlignVertical: 'top' }]} value={f.autoridades ?? ''} onChangeText={(v) => set('autoridades', v)} multiline accessibilityLabel="Autoridades presentes" />
              </View>

              <Text style={[s.secao, { color: cores.texto }]}>Clube</Text>
              {texto('clube', 'Nome do clube')}
              <View style={{ gap: 2 }}>
                {rotulo('Instrutores responsáveis (um por linha)')}
                <TextInput style={[...campo, { minHeight: 60, textAlignVertical: 'top' }]} value={f.instrutores ?? ''} onChangeText={(v) => set('instrutores', v)} multiline accessibilityLabel="Instrutores responsáveis" />
              </View>
              {texto('diretorNome', 'Diretor do clube (assina)')}
              <View style={s.linha}>
                <View style={{ flex: 1 }}>{texto('cidade', 'Cidade')}</View>
                <View style={{ width: 190, gap: 2 }}>{rotulo('Data do documento')}<DateField value={f.dataDocumento ?? ''} onChange={(v) => set('dataDocumento', v)} placeholder="Escolher data" /></View>
              </View>

              <Text style={[s.secao, { color: cores.texto }]}>Associação e regional</Text>
              {texto('regionalNome', 'Coordenador regional')}
              {texto('regiao', 'Região (ex.: Oceânica)')}
              {texto('associacao', 'Associação')}
              {texto('coordenadorGeralNome', 'Coordenador geral')}
              {texto('departamentalNome', 'Departamental (autoriza)')}
              {texto('registro', 'Nº do registro (deixe vazio para a Associação preencher)')}

              <View style={s.linhaSwitch}>
                <Text style={{ flex: 1, color: cores.texto, fontSize: 13 }}>Incluir página extra com a quantidade de cada item (para as insígnias)</Text>
                <Switch value={incluirQuantidades} onValueChange={setIncluirQuantidades} />
              </View>
            </ScrollView>
          )}
          {erro ? <Text style={s.erro}>{erro}</Text> : null}
          <View style={s.rodape}>
            <TouchableOpacity style={[s.botaoSec, { borderColor: cores.borda }]} onPress={onFechar} accessibilityRole="button"><Text style={{ color: cores.texto, fontWeight: '700' }}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[s.botaoPri, (gerando || !padroes) && { opacity: 0.6 }]} onPress={gerar} disabled={gerando || !padroes} accessibilityRole="button">
              {gerando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.botaoPriTxt}>Gerar Word</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 14 },
  caixa: { borderRadius: 18, padding: 16, maxHeight: '94%', gap: 6 },
  titulo: { fontSize: 17, fontWeight: '900' },
  dica: { fontSize: 12 },
  secao: { fontSize: 14, fontWeight: '900', marginTop: 8 },
  rotulo: { fontSize: 12, fontWeight: '700' },
  campo: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  linha: { flexDirection: 'row', gap: 10 },
  linhaSwitch: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  erro: { color: '#c62828', fontSize: 13, fontWeight: '700' },
  rodape: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  botaoSec: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  botaoPri: { backgroundColor: '#1e5aa8', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, minWidth: 110, alignItems: 'center' },
  botaoPriTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

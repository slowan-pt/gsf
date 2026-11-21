import { StyleSheet, Text, View } from 'react-native';
import { useCores } from '../stores/temaStore';
import { CAMPOS_IMPORTACAO_MEMBRO, valorVazio, type CampoMembroImportacao, type DadosMembroImportacao, type DestinoImportacaoMembro, type MembroImportacao } from '../lib/importacaoMembrosNucleo';
import { Chip, Dropdown } from './ui';

export function RevisaoImportacaoMembro({ linha, dados, candidatos, destino, substituir, aoDecidir, aoAlternar }: {
  linha: number;
  dados: DadosMembroImportacao;
  candidatos: MembroImportacao[];
  destino?: DestinoImportacaoMembro;
  substituir: CampoMembroImportacao[];
  aoDecidir: (destino: DestinoImportacaoMembro) => void;
  aoAlternar: (campo: CampoMembroImportacao) => void;
}) {
  const cores = useCores();
  const exato = !!dados.id_sgc;
  const atual = candidatos.find((m) => m.id === destino) ?? (exato ? candidatos[0] : undefined);
  return (
    <View style={[s.cartao, { borderColor: cores.borda }]}>
      <Text style={[s.titulo, { color: cores.texto }]}>Linha {linha} · {dados.nome || dados.id_sgc}</Text>
      <Text style={{ color: cores.textoSecundario }}>
        {exato ? 'Já existe um cadastro com esse ID (SGC). Revise os dados antes de atualizar.'
          : 'Encontramos nomes semelhantes. Escolha o cadastro da mesma pessoa ou confirme que é uma pessoa diferente.'}
      </Text>
      <View style={s.linha}>
        {exato ? (
          <Chip rotulo="Usar cadastro existente" ativo={destino === candidatos[0]?.id} onPress={() => aoDecidir(candidatos[0].id)} />
        ) : (
          <Chip rotulo="Pessoa diferente · Novo cadastro" ativo={destino === 'novo'} onPress={() => aoDecidir('novo')} />
        )}
        <Chip rotulo="Ignorar linha" ativo={destino === 'ignorar'} onPress={() => aoDecidir('ignorar')} />
      </View>
      {!exato && (
        <Dropdown titulo="Associar à mesma pessoa" placeholder="Escolher cadastro da mesma pessoa"
          valor={typeof destino === 'number' ? String(destino) : ''}
          opcoes={candidatos.map((m) => ({ valor: String(m.id), rotulo: `${m.nome} · SGC ${m.id_sgc ?? 'sem número'} · ficha #${m.id}` }))}
          onChange={(id) => aoDecidir(Number(id))} />
      )}
      {atual && destino !== 'ignorar' && (
        <View style={s.tabela}>
          <Text style={[s.titulo, { color: cores.texto }]}>{atual.nome} · SGC {atual.id_sgc ?? 'sem número'}</Text>
          <View style={s.linhaTabela}>
            {['Campo', 'Cadastro atual', 'Planilha', 'Manter'].map((titulo) => (
              <Text key={titulo} style={[s.celula, s.titulo, { color: cores.texto }]}>{titulo}</Text>
            ))}
          </View>
          {CAMPOS_IMPORTACAO_MEMBRO.filter(([campo]) => !valorVazio(dados[campo])).map(([campo, rotulo]) => {
            const vazio = valorVazio(atual[campo]);
            const diferente = !vazio && atual[campo] !== dados[campo];
            const usarPlanilha = substituir.includes(campo);
            return (
              <View key={campo} style={[s.linhaTabela, { borderTopWidth: 1, borderColor: cores.borda }]}>
                <Text style={[s.celula, { color: cores.texto }]}>{rotulo}</Text>
                <Text style={[s.celula, { color: cores.texto }]}>{atual[campo] ?? '—'}</Text>
                <Text style={[s.celula, { color: cores.texto }]}>{dados[campo]}</Text>
                <View style={s.celula}>
                  {diferente && destino === atual.id ? (
                    <Chip rotulo={usarPlanilha ? 'Planilha' : 'Atual'} ativo={usarPlanilha} onPress={() => aoAlternar(campo)} />
                  ) : <Text style={{ color: cores.textoSecundario }}>{vazio ? 'Planilha' : 'Atual'}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  titulo: { fontWeight: '800' },
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tabela: { gap: 3 },
  linhaTabela: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  celula: { flex: 1, minWidth: 0, fontSize: 12 },
});

import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, avatarCor } from '../../src/components/common/Avatar';
import { DemoShell, acaoBloqueadaDemo, styles, type AbaDemo } from '../../src/demo/DemoShell';
import {
  AGENDA_DEMO, ATIVIDADES_DEMO, AVISOS_DEMO, CLASSES_DEMO, CLUBE_DEMO, DIRETORA_DEMO,
  ESPECIALIDADES_DEMO, MEMBROS_DEMO, MODULOS_ADMIN_DEMO, RANKING_GERAL_DEMO,
  RANKING_UNIDADES_DEMO, RELATORIO_RESUMO_DEMO, UNIDADES_DEMO,
} from '../../src/demo/fixtures';

const ABAS: AbaDemo[] = [
  { id: 'inicio',     label: 'Início',      icon: 'home-outline',             iconAtivo: 'home' },
  { id: 'ranking',    label: 'Ranking',     icon: 'trophy-outline',           iconAtivo: 'trophy' },
  { id: 'membros',    label: 'Membros',     icon: 'people-outline',           iconAtivo: 'people' },
  { id: 'classes',    label: 'Classes',     icon: 'ribbon-outline',           iconAtivo: 'ribbon' },
  { id: 'relatorios', label: 'Relatórios',  icon: 'bar-chart-outline',        iconAtivo: 'bar-chart' },
];

function BotaoBloqueado({ texto }: { texto: string }) {
  return (
    <TouchableOpacity style={styles.acaoBloqueada} onPress={acaoBloqueadaDemo}>
      <Ionicons name="lock-closed-outline" size={12} color="#90a4ae" />
      <Text style={styles.acaoBloqueadaTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

const MEDALHAS = ['🥇', '🥈', '🥉'];
const CORES_PODIO = ['#FFD700', '#C0C0C0', '#CD7F32'];

function Podio({ itens }: { itens: { nome: string; pontos: number }[] }) {
  const alturas = [95, 70, 55];
  const ordem = [1, 0, 2]; // 2º, 1º, 3º — mesma disposição visual do app real
  return (
    <View style={styles.podio}>
      {ordem.map((i) => {
        const item = itens[i];
        if (!item) return <View key={i} style={{ flex: 1 }} />;
        return (
          <View key={i} style={[styles.podioItem, i !== 0 && { marginTop: i === 1 ? 20 : 40 }]}>
            <Avatar nome={item.nome} cor={avatarCor(item.nome)} size={i === 0 ? 52 : i === 1 ? 44 : 40} />
            <Text style={styles.podioMedalha}>{MEDALHAS[i]}</Text>
            <Text style={[styles.podioNome, i === 0 && { fontWeight: '800' }]}>{item.nome.split(' ')[0]}</Text>
            <Text style={[styles.podioPts, i === 0 && { color: '#B8860B' }]}>{item.pontos.toLocaleString('pt-BR')}</Text>
            <View style={[styles.podioPillar, { height: alturas[i], backgroundColor: CORES_PODIO[i] }]}>
              <Text style={styles.podioPillarNum}>{i + 1}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function DemoDiretoria() {
  const [aba, setAba] = useState('inicio');

  return (
    <DemoShell
      nomeUsuario={DIRETORA_DEMO.nome}
      subtitulo={`${CLUBE_DEMO.nome} · ${CLUBE_DEMO.tipo}`}
      persona="diretoria"
      abas={ABAS}
      abaAtiva={aba}
      onTrocarAba={setAba}
    >
      {aba === 'inicio' && (
        <>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitulo}>Membros ativos</Text>
              <Text style={styles.cardTitulo}>{RELATORIO_RESUMO_DEMO.totalMembros}</Text>
            </View>
            <Text style={styles.cardSub}>Presença média: {RELATORIO_RESUMO_DEMO.presencaMediaPercentual}%</Text>
            <Text style={styles.cardSub}>{UNIDADES_DEMO.length} unidades ativas</Text>
            <Text style={styles.cardSub}>1º lugar: {RANKING_GERAL_DEMO[0].nome} ({RANKING_GERAL_DEMO[0].pontos} pts)</Text>
          </View>

          <Text style={styles.secaoTitulo}>Agenda</Text>
          {AGENDA_DEMO.slice(0, 3).map((ev) => (
            <View key={ev.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitulo}>{ev.titulo}</Text>
                <View style={styles.chip}><Text style={styles.chipTexto}>{ev.data}</Text></View>
              </View>
              <Text style={styles.cardSub}>{ev.local}</Text>
            </View>
          ))}
          <BotaoBloqueado texto="Novo evento" />

          <Text style={styles.secaoTitulo}>Avisos</Text>
          {AVISOS_DEMO.slice(0, 3).map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardTitulo}>{a.titulo}</Text>
              <Text style={styles.cardSub}>{a.corpo}</Text>
              <Text style={[styles.cardSub, { marginTop: 4 }]}>{a.data}</Text>
            </View>
          ))}
          <BotaoBloqueado texto="Enviar novo aviso" />

          <Text style={styles.secaoTitulo}>Atividades</Text>
          {ATIVIDADES_DEMO.slice(0, 3).map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitulo}>{t.titulo}</Text>
                <View style={styles.chip}><Text style={styles.chipTexto}>{t.status}</Text></View>
              </View>
              <Text style={styles.cardSub}>{t.categoria}</Text>
            </View>
          ))}
          <BotaoBloqueado texto="Nova atividade" />
        </>
      )}

      {aba === 'ranking' && (
        <>
          <Text style={styles.secaoTitulo}>Ranking geral</Text>
          <Podio itens={RANKING_GERAL_DEMO} />
          {RANKING_GERAL_DEMO.map((r) => (
            <View key={r.posicao} style={styles.itemLista}>
              <Text style={styles.itemPos}>{r.posicao <= 3 ? MEDALHAS[r.posicao - 1] : `#${r.posicao}`}</Text>
              <Avatar nome={r.nome} cor={avatarCor(r.nome)} size={36} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemNome}>{r.nome}</Text>
              </View>
              <Text style={styles.itemPts}>{r.pontos.toLocaleString('pt-BR')}</Text>
            </View>
          ))}

          <Text style={styles.secaoTitulo}>Ranking por unidade</Text>
          {RANKING_UNIDADES_DEMO.map((r) => (
            <View key={r.posicao} style={styles.itemLista}>
              <Text style={styles.itemPos}>{r.posicao <= 3 ? MEDALHAS[r.posicao - 1] : `#${r.posicao}`}</Text>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a3a5c', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flag" size={18} color="#fff" />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemNome}>{r.nome}</Text>
              </View>
              <Text style={styles.itemPts}>{r.pontos.toLocaleString('pt-BR')}</Text>
            </View>
          ))}
        </>
      )}

      {aba === 'membros' && (
        <>
          <Text style={styles.secaoTitulo}>Membros</Text>
          {MEMBROS_DEMO.map((m) => (
            <View key={m.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Avatar nome={m.nome} cor={avatarCor(m.nome)} size={36} />
                  <View>
                    <Text style={styles.cardTitulo}>{m.nome} (fictício)</Text>
                    <Text style={styles.cardSub}>{m.funcao} · {m.situacao}</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>{m.pontos} pts</Text>
              </View>
              <Text style={styles.cardSub}>{m.unidade} · Classe {m.classe} · {m.progressoResumo}</Text>
            </View>
          ))}
          <BotaoBloqueado texto="Cadastrar / importar membros" />

          <Text style={styles.secaoTitulo}>Unidades</Text>
          {UNIDADES_DEMO.map((u) => (
            <View key={u.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: u.cor }} />
                  <Text style={styles.cardTitulo}>{u.nome}</Text>
                </View>
                <Text style={styles.cardSub}>{u.posicao}º · {u.pontos} pts</Text>
              </View>
              <Text style={styles.cardSub}>Conselheiro: {u.conselheiro} · {u.membros} membros</Text>
              <View style={styles.progressoFundo}>
                <View style={[styles.progressoPreenchido, { width: `${u.progressoMedio}%` }]} />
              </View>
            </View>
          ))}
        </>
      )}

      {aba === 'classes' && (
        <>
          <Text style={styles.secaoTitulo}>Classes e requisitos</Text>
          {CLASSES_DEMO.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitulo}>{c.nome}</Text>
                <Text style={styles.cardSub}>{c.requisitosConcluidos}/{c.requisitosTotal}</Text>
              </View>
              <Text style={styles.cardSub}>{c.categoria} · {c.requisitosEmAndamento} em andamento · {c.requisitosPendentes} pendentes</Text>
              <View style={styles.progressoFundo}>
                <View style={[styles.progressoPreenchido, { width: `${c.progresso}%` }]} />
              </View>
            </View>
          ))}
          <BotaoBloqueado texto="Editar plano de classes" />

          <Text style={styles.secaoTitulo}>Especialidades</Text>
          {ESPECIALIDADES_DEMO.map((e) => (
            <View key={e.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitulo}>{e.nome}</Text>
                <View style={styles.chip}><Text style={styles.chipTexto}>{e.status}</Text></View>
              </View>
              <Text style={styles.cardSub}>{e.area}</Text>
            </View>
          ))}
        </>
      )}

      {aba === 'relatorios' && (
        <>
          <Text style={styles.secaoTitulo}>Relatório resumido</Text>
          <View style={styles.card}>
            <Text style={styles.cardSub}>Presença média: {RELATORIO_RESUMO_DEMO.presencaMediaPercentual}%</Text>
            <Text style={styles.cardSub}>Atividades concluídas: {RELATORIO_RESUMO_DEMO.atividadesConcluidas}</Text>
            <Text style={styles.cardSub}>Classes em andamento: {RELATORIO_RESUMO_DEMO.classesEmAndamento}</Text>
            <Text style={styles.cardSub}>Especialidades concluídas no mês: {RELATORIO_RESUMO_DEMO.especialidadesConcluidasNoMes}</Text>
            <Text style={styles.cardSub}>Pontos distribuídos no mês: {RELATORIO_RESUMO_DEMO.pontosDistribuidosNoMes}</Text>
            {RELATORIO_RESUMO_DEMO.pontosPorUnidade.map((p) => (
              <Text key={p.unidade} style={styles.cardSub}>{p.unidade}: {p.pontos} pts</Text>
            ))}
          </View>
          <BotaoBloqueado texto="Exportar relatório completo" />

          <Text style={styles.secaoTitulo}>Recursos administrativos</Text>
          {MODULOS_ADMIN_DEMO.map((m) => (
            <View key={m.id} style={styles.card}>
              <Text style={styles.cardTitulo}>{m.nome}</Text>
              <Text style={styles.cardSub}>{m.descricao}</Text>
              {m.nome === 'Importação de planilha' ? <BotaoBloqueado texto="Selecionar planilha" /> : null}
            </View>
          ))}
        </>
      )}
    </DemoShell>
  );
}

import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, avatarCor } from '../../src/components/common/Avatar';
import { DemoShell, acaoBloqueadaDemo, styles, type AbaDemo } from '../../src/demo/DemoShell';
import {
  AGENDA_DEMO, ANO_BIBLICO_DEMO, ATIVIDADES_DEMO, AVISOS_DEMO, CLASSES_DEMO,
  ESPECIALIDADES_DEMO, MEMBRO_LOGADO_DEMO, RANKING_GERAL_DEMO,
} from '../../src/demo/fixtures';

const ABAS: AbaDemo[] = [
  { id: 'inicio',  label: 'Início',   icon: 'home-outline',      iconAtivo: 'home' },
  { id: 'ranking', label: 'Ranking',  icon: 'trophy-outline',    iconAtivo: 'trophy' },
  { id: 'classes', label: 'Classes',  icon: 'ribbon-outline',    iconAtivo: 'ribbon' },
  { id: 'biblico', label: 'Ano Bíb.', icon: 'book-outline',      iconAtivo: 'book' },
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
  const ordem = [1, 0, 2];
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

const minhaPosicao = RANKING_GERAL_DEMO.find((r) => r.nome === MEMBRO_LOGADO_DEMO.nome)?.posicao ?? 0;

export default function DemoMembro() {
  const [aba, setAba] = useState('inicio');

  return (
    <DemoShell
      nomeUsuario={MEMBRO_LOGADO_DEMO.nome}
      subtitulo={`${MEMBRO_LOGADO_DEMO.unidade} · Classe ${MEMBRO_LOGADO_DEMO.classe}`}
      persona="membro"
      abas={ABAS}
      abaAtiva={aba}
      onTrocarAba={setAba}
    >
      {aba === 'inicio' && (
        <>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitulo}>Meus pontos</Text>
              <Text style={styles.cardTitulo}>{MEMBRO_LOGADO_DEMO.pontos} pts</Text>
            </View>
            <Text style={styles.cardSub}>{minhaPosicao}º lugar no ranking geral</Text>
            <Text style={styles.cardSub}>{MEMBRO_LOGADO_DEMO.progressoResumo}</Text>
          </View>
          <BotaoBloqueado texto="Editar perfil" />

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

          <Text style={styles.secaoTitulo}>Avisos</Text>
          {AVISOS_DEMO.slice(0, 3).map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardTitulo}>{a.titulo}</Text>
              <Text style={styles.cardSub}>{a.corpo}</Text>
              <Text style={[styles.cardSub, { marginTop: 4 }]}>{a.data}</Text>
            </View>
          ))}

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
        </>
      )}

      {aba === 'ranking' && (
        <>
          <Text style={styles.secaoTitulo}>Ranking</Text>
          <Podio itens={RANKING_GERAL_DEMO} />
          {RANKING_GERAL_DEMO.map((r) => (
            <View key={r.posicao} style={styles.itemLista}>
              <Text style={styles.itemPos}>{r.posicao <= 3 ? MEDALHAS[r.posicao - 1] : `#${r.posicao}`}</Text>
              <Avatar nome={r.nome} cor={avatarCor(r.nome)} size={36} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemNome}>{r.nome}{r.nome === MEMBRO_LOGADO_DEMO.nome ? ' (você)' : ''}</Text>
              </View>
              <Text style={styles.itemPts}>{r.pontos.toLocaleString('pt-BR')}</Text>
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
              <View style={styles.progressoFundo}>
                <View style={[styles.progressoPreenchido, { width: `${c.progresso}%` }]} />
              </View>
            </View>
          ))}
          <BotaoBloqueado texto="Marcar requisito como concluído" />

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

      {aba === 'biblico' && (
        <>
          <Text style={styles.secaoTitulo}>Ano Bíblico</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>{ANO_BIBLICO_DEMO.diaAtual}</Text>
            <Text style={styles.cardSub}>Leitura de hoje: {ANO_BIBLICO_DEMO.referencia}</Text>
            <Text style={styles.cardSub}>Sequência: {ANO_BIBLICO_DEMO.sequenciaDias} dias seguidos</Text>
            <View style={styles.progressoFundo}>
              <View style={[styles.progressoPreenchido, { width: `${ANO_BIBLICO_DEMO.percentualConcluido}%` }]} />
            </View>
            {ANO_BIBLICO_DEMO.registrosRecentes.map((r) => (
              <Text key={r.dia} style={[styles.cardSub, { marginTop: 4 }]}>{r.dia}: {r.referencia}</Text>
            ))}
          </View>
          <BotaoBloqueado texto="Marcar leitura como concluída" />
        </>
      )}
    </DemoShell>
  );
}

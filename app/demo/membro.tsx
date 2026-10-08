import { useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, avatarCor } from '../../src/components/common/Avatar';
import { HeroInicio, ResumoCompacto } from '../../src/components/HomeHero';
import {
  AtalhosDemo, BotaoBloqueado, DemoShell, MEDALHAS, Podio, SecaoDemo, useEstilosDemo, type AbaDemo,
} from '../../src/demo/DemoShell';
import {
  AGENDA_DEMO, ANO_BIBLICO_DEMO, ATIVIDADES_DEMO, AVISOS_DEMO, CLASSES_DEMO,
  ESPECIALIDADES_DEMO, MEMBRO_LOGADO_DEMO, RANKING_GERAL_DEMO,
} from '../../src/demo/fixtures';
import { imagemDoItemClasse } from '../../src/lib/classesRequisitos';

const ABAS: AbaDemo[] = [
  { id: 'inicio',  label: 'Início',   icon: 'home-outline',      iconAtivo: 'home' },
  { id: 'ranking', label: 'Ranking',  icon: 'trophy-outline',    iconAtivo: 'trophy' },
  { id: 'classes', label: 'Classes',  icon: 'ribbon-outline',    iconAtivo: 'ribbon' },
  { id: 'biblico', label: 'Ano Bíb.', icon: 'book-outline',      iconAtivo: 'book' },
];

const minhaPosicao = RANKING_GERAL_DEMO.find((r) => r.nome === MEMBRO_LOGADO_DEMO.nome)?.posicao ?? 0;

export default function DemoMembro() {
  const [aba, setAba] = useState('inicio');
  const styles = useEstilosDemo();
  const classeAtual = CLASSES_DEMO.find((c) => c.nome === MEMBRO_LOGADO_DEMO.classe)
    ?? CLASSES_DEMO.find((c) => c.progresso > 0 && c.progresso < 100)
    ?? CLASSES_DEMO[0];
  const concluidas = ESPECIALIDADES_DEMO.filter((e) => e.status === 'concluída').length;

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
          <HeroInicio
            nome={MEMBRO_LOGADO_DEMO.nome}
            data=""
            classeAtual={{ label: classeAtual.nome, pct: classeAtual.progresso, emblema: imagemDoItemClasse(classeAtual.nome) }}
            aoAbrirClasse={() => setAba('classes')}
            pontos={MEMBRO_LOGADO_DEMO.pontos}
            posicao={minhaPosicao}
            aoAbrirExtrato={() => setAba('ranking')}
          />
          <View style={{ height: 14 }} />
          <ResumoCompacto
            itens={[
              { valor: MEMBRO_LOGADO_DEMO.pontos, rotulo: 'Pontos' },
              { valor: `${minhaPosicao}º`, rotulo: 'Ranking' },
              { valor: concluidas, rotulo: 'Especialidades' },
            ]}
          />

          <SecaoDemo titulo="Acesso rápido" />
          <AtalhosDemo
            itens={[
              { rotulo: 'Classes', icone: 'ribbon', aoAbrir: () => setAba('classes') },
              { rotulo: 'Especialidades', icone: 'medal', aoAbrir: () => setAba('classes') },
              { rotulo: 'Ranking', icone: 'trophy', aoAbrir: () => setAba('ranking') },
              { rotulo: 'Ano Bíblico', icone: 'book', aoAbrir: () => setAba('biblico') },
              { rotulo: 'Perfil', icone: 'person-circle' },
              { rotulo: 'Aparência', icone: 'color-palette' },
            ]}
          />
          <BotaoBloqueado texto="Editar perfil" />

          <SecaoDemo titulo="Agenda" />
          {AGENDA_DEMO.slice(0, 3).map((ev) => (
            <View key={ev.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitulo}>{ev.titulo}</Text>
                <View style={styles.chip}><Text style={styles.chipTexto}>{ev.data}</Text></View>
              </View>
              <Text style={styles.cardSub}>{ev.local}</Text>
            </View>
          ))}

          <SecaoDemo titulo="Avisos" />
          {AVISOS_DEMO.slice(0, 3).map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardTitulo}>{a.titulo}</Text>
              <Text style={styles.cardSub}>{a.corpo}</Text>
              <Text style={[styles.cardSub, { marginTop: 4 }]}>{a.data}</Text>
            </View>
          ))}

          <SecaoDemo titulo="Atividades" />
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
          <SecaoDemo titulo="Ranking" />
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
          <SecaoDemo titulo="Classes e requisitos" />
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

          <SecaoDemo titulo="Especialidades" />
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
          <SecaoDemo titulo="Ano Bíblico" />
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

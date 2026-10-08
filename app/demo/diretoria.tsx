import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, avatarCor } from '../../src/components/common/Avatar';
import { HeroInicio, PessoasCarrossel, ResumoCompacto } from '../../src/components/HomeHero';
import {
  AtalhosDemo, BotaoBloqueado, DemoShell, MEDALHAS, Podio, SecaoDemo, useEstilosDemo, type AbaDemo,
} from '../../src/demo/DemoShell';
import {
  AGENDA_DEMO, ATIVIDADES_DEMO, AVISOS_DEMO, CLASSES_DEMO, CLUBE_DEMO, DIRETORA_DEMO,
  ESPECIALIDADES_DEMO, MEMBROS_DEMO, MODULOS_ADMIN_DEMO, RANKING_GERAL_DEMO,
  RANKING_UNIDADES_DEMO, RELATORIO_RESUMO_DEMO, UNIDADES_DEMO,
} from '../../src/demo/fixtures';
import { imagemDoItemClasse } from '../../src/lib/classesRequisitos';
import { useCores } from '../../src/stores/temaStore';

const ABAS: AbaDemo[] = [
  { id: 'inicio',     label: 'Início',      icon: 'home-outline',             iconAtivo: 'home' },
  { id: 'ranking',    label: 'Ranking',     icon: 'trophy-outline',           iconAtivo: 'trophy' },
  { id: 'membros',    label: 'Membros',     icon: 'people-outline',           iconAtivo: 'people' },
  { id: 'classes',    label: 'Classes',     icon: 'ribbon-outline',           iconAtivo: 'ribbon' },
  { id: 'relatorios', label: 'Relatórios',  icon: 'bar-chart-outline',        iconAtivo: 'bar-chart' },
];

const ANIVERSARIANTES = MEMBROS_DEMO.slice(2, 7).map((m, i) => ({
  id: i + 1,
  nome: m.nome,
  detalhe: i === 0 ? 'Hoje · 13 anos' : `Em ${i + 1} dias · ${11 + (i % 4)} anos`,
}));

export default function DemoDiretoria() {
  const [aba, setAba] = useState('inicio');
  const styles = useEstilosDemo();
  const cores = useCores();
  const lider = RANKING_GERAL_DEMO[0];
  const classeEmAndamento = CLASSES_DEMO.find((c) => c.progresso > 0 && c.progresso < 100) ?? CLASSES_DEMO[0];

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
          <HeroInicio
            nome={DIRETORA_DEMO.nome}
            data=""
            classeAtual={{ label: classeEmAndamento.nome, pct: classeEmAndamento.progresso, emblema: imagemDoItemClasse(classeEmAndamento.nome) }}
            aoAbrirClasse={() => setAba('classes')}
            pontos={lider.pontos}
            rotuloPontos={`Líder do ranking · ${lider.nome.split(' ')[0]}`}
            aoAbrirExtrato={() => setAba('ranking')}
          />
          <View style={{ height: 14 }} />
          <ResumoCompacto
            itens={[
              { valor: RELATORIO_RESUMO_DEMO.totalMembros, rotulo: 'Membros' },
              { valor: UNIDADES_DEMO.length, rotulo: 'Unidades' },
              { valor: `${RELATORIO_RESUMO_DEMO.presencaMediaPercentual}%`, rotulo: 'Presença' },
            ]}
          />

          <PessoasCarrossel titulo="Aniversariantes" pessoas={ANIVERSARIANTES} aoAbrir={() => setAba('membros')} />

          <SecaoDemo titulo="Acesso rápido" />
          <AtalhosDemo
            itens={[
              { rotulo: 'Classes', icone: 'ribbon', aoAbrir: () => setAba('classes') },
              { rotulo: 'Especialidades', icone: 'medal', aoAbrir: () => setAba('classes') },
              { rotulo: 'Membros', icone: 'people', aoAbrir: () => setAba('membros') },
              { rotulo: 'Ranking', icone: 'trophy', aoAbrir: () => setAba('ranking') },
              { rotulo: 'Relatórios', icone: 'bar-chart', aoAbrir: () => setAba('relatorios') },
              { rotulo: 'Aparência', icone: 'color-palette' },
            ]}
          />

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
          <BotaoBloqueado texto="Novo evento" />

          <SecaoDemo titulo="Avisos" />
          {AVISOS_DEMO.slice(0, 3).map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardTitulo}>{a.titulo}</Text>
              <Text style={styles.cardSub}>{a.corpo}</Text>
              <Text style={[styles.cardSub, { marginTop: 4 }]}>{a.data}</Text>
            </View>
          ))}
          <BotaoBloqueado texto="Enviar novo aviso" />

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
          <BotaoBloqueado texto="Nova atividade" />
        </>
      )}

      {aba === 'ranking' && (
        <>
          <SecaoDemo titulo="Ranking geral" />
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

          <SecaoDemo titulo="Ranking por unidade" />
          {RANKING_UNIDADES_DEMO.map((r) => (
            <View key={r.posicao} style={styles.itemLista}>
              <Text style={styles.itemPos}>{r.posicao <= 3 ? MEDALHAS[r.posicao - 1] : `#${r.posicao}`}</Text>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: cores.primaria, alignItems: 'center', justifyContent: 'center' }}>
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
          <SecaoDemo titulo="Membros" />
          {MEMBROS_DEMO.map((m) => (
            <View key={m.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
                  <Avatar nome={m.nome} cor={avatarCor(m.nome)} size={40} />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.cardTitulo}>{m.nome} (fictício)</Text>
                    <Text style={styles.cardSub}>{m.funcao} · {m.situacao}</Text>
                  </View>
                </View>
                <Text style={styles.itemPts}>{m.pontos} pts</Text>
              </View>
              <Text style={styles.cardSub}>{m.unidade} · Classe {m.classe} · {m.progressoResumo}</Text>
            </View>
          ))}
          <BotaoBloqueado texto="Cadastrar / importar membros" />

          <SecaoDemo titulo="Unidades" />
          {UNIDADES_DEMO.map((u) => (
            <View key={u.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                  <View style={{ width: 14, height: 14, borderRadius: 5, backgroundColor: u.cor }} />
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
          <SecaoDemo titulo="Classes e requisitos" />
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

      {aba === 'relatorios' && (
        <>
          <SecaoDemo titulo="Relatório resumido" />
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

          <SecaoDemo titulo="Recursos administrativos" />
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

import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DemoShell, acaoBloqueadaDemo, styles } from '../../src/demo/DemoShell';
import {
  AGENDA_DEMO, ATIVIDADES_DEMO, AVISOS_DEMO, CLASSES_DEMO, CLUBE_DEMO, DIRETORA_DEMO,
  ESPECIALIDADES_DEMO, MEMBROS_DEMO, MODULOS_ADMIN_DEMO, RANKING_GERAL_DEMO,
  RANKING_UNIDADES_DEMO, RELATORIO_RESUMO_DEMO, UNIDADES_DEMO,
} from '../../src/demo/fixtures';

function BotaoBloqueado({ texto }: { texto: string }) {
  return (
    <TouchableOpacity style={styles.acaoBloqueada} onPress={acaoBloqueadaDemo}>
      <Ionicons name="lock-closed-outline" size={12} color="#90a4ae" />
      <Text style={styles.acaoBloqueadaTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

function Avatar({ iniciais }: { iniciais: string }) {
  return (
    <View style={styles.avatarIniciais}>
      <Text style={styles.avatarIniciaisTexto}>{iniciais}</Text>
    </View>
  );
}

export default function DemoDiretoria() {
  return (
    <DemoShell titulo="Visão da diretoria" subtitulo={`Olá, ${DIRETORA_DEMO.nome} · ${CLUBE_DEMO.nome}`} persona="diretoria">
      {/* Painel inicial */}
      <Text style={styles.secaoTitulo}>Painel inicial</Text>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitulo}>Membros ativos</Text>
          <Text style={styles.cardTitulo}>{RELATORIO_RESUMO_DEMO.totalMembros}</Text>
        </View>
        <Text style={styles.cardSub}>Presença média: {RELATORIO_RESUMO_DEMO.presencaMediaPercentual}%</Text>
        <Text style={styles.cardSub}>{UNIDADES_DEMO.length} unidades ativas · {CLUBE_DEMO.tipo}</Text>
        <Text style={styles.cardSub}>1º lugar no ranking geral: {RANKING_GERAL_DEMO[0].nome} ({RANKING_GERAL_DEMO[0].pontos} pts)</Text>
      </View>

      {/* Agenda */}
      <Text style={styles.secaoTitulo}>Agenda</Text>
      {AGENDA_DEMO.map((ev) => (
        <View key={ev.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitulo}>{ev.titulo}</Text>
            <View style={styles.chip}><Text style={styles.chipTexto}>{ev.data}</Text></View>
          </View>
          <Text style={styles.cardSub}>{ev.local}</Text>
        </View>
      ))}
      <BotaoBloqueado texto="Novo evento" />

      {/* Avisos */}
      <Text style={styles.secaoTitulo}>Avisos</Text>
      {AVISOS_DEMO.map((a) => (
        <View key={a.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitulo}>{a.titulo}</Text>
            <View style={styles.chip}><Text style={styles.chipTexto}>{a.categoria}</Text></View>
          </View>
          <Text style={styles.cardSub}>{a.corpo}</Text>
          <Text style={[styles.cardSub, { marginTop: 4 }]}>{a.data}</Text>
        </View>
      ))}
      <BotaoBloqueado texto="Enviar novo aviso" />

      {/* Atividades */}
      <Text style={styles.secaoTitulo}>Atividades</Text>
      {ATIVIDADES_DEMO.map((t) => (
        <View key={t.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitulo}>{t.titulo}</Text>
            <View style={styles.chip}><Text style={styles.chipTexto}>{t.status}</Text></View>
          </View>
          <Text style={styles.cardSub}>{t.categoria}</Text>
          <Text style={styles.cardSub}>{t.descricao}</Text>
        </View>
      ))}
      <BotaoBloqueado texto="Nova atividade" />

      {/* Membros */}
      <Text style={styles.secaoTitulo}>Membros</Text>
      {MEMBROS_DEMO.map((m) => (
        <View key={m.id} style={styles.card}>
          <View style={styles.cardRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Avatar iniciais={m.iniciais} />
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

      {/* Unidades */}
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

      {/* Classes e requisitos */}
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

      {/* Especialidades */}
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

      {/* Ranking */}
      <Text style={styles.secaoTitulo}>Ranking geral</Text>
      <View style={styles.card}>
        {RANKING_GERAL_DEMO.map((r) => (
          <View key={r.posicao} style={[styles.cardRow, { marginBottom: 6 }]}>
            <Text style={styles.cardSub}>{r.posicao}º · {r.nome}</Text>
            <Text style={styles.cardTitulo}>{r.pontos} pts</Text>
          </View>
        ))}
      </View>
      <Text style={styles.secaoTitulo}>Ranking por unidade</Text>
      <View style={styles.card}>
        {RANKING_UNIDADES_DEMO.map((r) => (
          <View key={r.posicao} style={[styles.cardRow, { marginBottom: 6 }]}>
            <Text style={styles.cardSub}>{r.posicao}º · {r.nome}</Text>
            <Text style={styles.cardTitulo}>{r.pontos} pts</Text>
          </View>
        ))}
      </View>

      {/* Relatórios */}
      <Text style={styles.secaoTitulo}>Relatórios</Text>
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

      {/* Recursos administrativos */}
      <Text style={styles.secaoTitulo}>Recursos administrativos</Text>
      {MODULOS_ADMIN_DEMO.map((m) => (
        <View key={m.id} style={styles.card}>
          <Text style={styles.cardTitulo}>{m.nome}</Text>
          <Text style={styles.cardSub}>{m.descricao}</Text>
          {m.nome === 'Importação de planilha' ? (
            <BotaoBloqueado texto="Selecionar planilha" />
          ) : null}
        </View>
      ))}
    </DemoShell>
  );
}

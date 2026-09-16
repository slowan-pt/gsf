import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DemoShell, acaoBloqueadaDemo, styles } from '../../src/demo/DemoShell';
import {
  AGENDA_DEMO, ANO_BIBLICO_DEMO, ATIVIDADES_DEMO, AVISOS_DEMO, CLASSES_DEMO,
  ESPECIALIDADES_DEMO, MEMBRO_LOGADO_DEMO, RANKING_GERAL_DEMO,
} from '../../src/demo/fixtures';

function BotaoBloqueado({ texto }: { texto: string }) {
  return (
    <TouchableOpacity style={styles.acaoBloqueada} onPress={acaoBloqueadaDemo}>
      <Ionicons name="lock-closed-outline" size={12} color="#90a4ae" />
      <Text style={styles.acaoBloqueadaTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

const minhaPosicao = RANKING_GERAL_DEMO.find((r) => r.nome === MEMBRO_LOGADO_DEMO.nome)?.posicao ?? 0;

export default function DemoMembro() {
  return (
    <DemoShell titulo="Visão do membro" subtitulo={`Olá, ${MEMBRO_LOGADO_DEMO.nome} (fictício)`} persona="membro">
      {/* Painel inicial */}
      <Text style={styles.secaoTitulo}>Painel inicial</Text>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitulo}>Meus pontos</Text>
          <Text style={styles.cardTitulo}>{MEMBRO_LOGADO_DEMO.pontos} pts</Text>
        </View>
        <Text style={styles.cardSub}>{MEMBRO_LOGADO_DEMO.unidade} · Classe {MEMBRO_LOGADO_DEMO.classe}</Text>
        <Text style={styles.cardSub}>{minhaPosicao}º lugar no ranking geral</Text>
        <Text style={styles.cardSub}>Próxima atividade: {AGENDA_DEMO.find((a) => a.quando === 'futuro')?.titulo}</Text>
        <Text style={styles.cardSub}>Aviso recente: {AVISOS_DEMO[0].titulo}</Text>
      </View>

      {/* Perfil */}
      <Text style={styles.secaoTitulo}>Meu perfil</Text>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.avatarIniciais}>
            <Text style={styles.avatarIniciaisTexto}>{MEMBRO_LOGADO_DEMO.iniciais}</Text>
          </View>
          <View>
            <Text style={styles.cardTitulo}>{MEMBRO_LOGADO_DEMO.nome} (fictício)</Text>
            <Text style={styles.cardSub}>{MEMBRO_LOGADO_DEMO.unidade} · {MEMBRO_LOGADO_DEMO.classe}</Text>
          </View>
        </View>
        <Text style={[styles.cardSub, { marginTop: 8 }]}>{MEMBRO_LOGADO_DEMO.progressoResumo}</Text>
      </View>
      <BotaoBloqueado texto="Editar perfil" />

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

      {/* Avisos */}
      <Text style={styles.secaoTitulo}>Avisos</Text>
      {AVISOS_DEMO.map((a) => (
        <View key={a.id} style={styles.card}>
          <Text style={styles.cardTitulo}>{a.titulo}</Text>
          <Text style={styles.cardSub}>{a.corpo}</Text>
          <Text style={[styles.cardSub, { marginTop: 4 }]}>{a.data}</Text>
        </View>
      ))}

      {/* Atividades */}
      <Text style={styles.secaoTitulo}>Atividades</Text>
      {ATIVIDADES_DEMO.map((t) => (
        <View key={t.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitulo}>{t.titulo}</Text>
            <View style={styles.chip}><Text style={styles.chipTexto}>{t.status}</Text></View>
          </View>
          <Text style={styles.cardSub}>{t.categoria}</Text>
        </View>
      ))}

      {/* Ranking */}
      <Text style={styles.secaoTitulo}>Ranking</Text>
      <View style={styles.card}>
        {RANKING_GERAL_DEMO.map((r) => (
          <View key={r.posicao} style={[styles.cardRow, { marginBottom: 6 }]}>
            <Text style={styles.cardSub}>{r.posicao}º · {r.nome}</Text>
            <Text style={styles.cardTitulo}>{r.pontos} pts</Text>
          </View>
        ))}
      </View>

      {/* Classes e requisitos */}
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

      {/* Ano Bíblico */}
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
    </DemoShell>
  );
}

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { obterDiaDeHoje, obterDiasLidos } from './anoBiblico';
import { carregarConfigLerHoje, type ConfigLerHoje } from './lerHojeConfig';

/**
 * Lembrete diário de estudo, agendado no próprio aparelho (não depende de servidor nem de internet).
 * Em vez de um gatilho "todo dia" fixo, agenda os próximos dias um a um para poder pular o dia em que o
 * membro já leu. Reagenda ao abrir o app, ao voltar do segundo plano e quando a leitura de hoje é concluída;
 * a janela de DIAS_A_FRENTE cobre quem fica alguns dias sem abrir o app.
 */
const DIAS_A_FRENTE = 14;
const ORIGEM = 'lembrete_ler_hoje';

async function cancelarAgendados() {
  const todos = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    todos
      .filter((n) => (n.content.data as Record<string, unknown> | undefined)?.origem === ORIGEM)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Próximas datas do lembrete (hora/minuto locais), a partir de agora; pula hoje se já leu. */
export function proximasDatasLembrete(config: Pick<ConfigLerHoje, 'lembrete_hora' | 'lembrete_minuto'>, jaLeuHoje: boolean, agora = new Date()): Date[] {
  const datas: Date[] = [];
  for (let i = 0; i < DIAS_A_FRENTE; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i, config.lembrete_hora, config.lembrete_minuto, 0, 0);
    if (d.getTime() <= agora.getTime() + 30_000) continue;
    if (i === 0 && jaLeuHoje) continue;
    datas.push(d);
  }
  return datas;
}

/**
 * Reagenda o lembrete conforme a configuração do clube.
 * @param jaLeuHoje quando já se sabe; se omitido, consulta o Ano Bíblico.
 */
export async function reagendarLembreteLerHoje(clubeId: number, dbvId: number | string | null, jaLeuHoje?: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const config = await carregarConfigLerHoje(clubeId);
    await cancelarAgendados();
    // Sem membro vinculado não há leitura para lembrar.
    if (!config.lembrete_ativo || !dbvId) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    let leu = jaLeuHoje;
    if (leu === undefined) {
      try {
        const dia = await obterDiaDeHoje();
        leu = dia ? (await obterDiasLidos(Number(dbvId), new Date().getFullYear())).has(dia.id) : true;
      } catch {
        leu = false;
      }
    }

    for (const date of proximasDatasLembrete(config, leu)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: config.lembrete_titulo,
          body: config.lembrete_texto,
          sound: 'default',
          data: { tela: 'lerHoje', origem: ORIGEM },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'default' },
      });
    }
  } catch (erro: any) {
    console.warn('[lembrete] não foi possível agendar o lembrete de estudo:', erro?.message ?? erro);
  }
}

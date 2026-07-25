import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { PremiereReminders } from '@reprise/shared';
import type { Premiere } from '@reprise/shared';
import { LocalStore } from './local-store';

const SETTING_ENABLED = 'remindersEnabled';
const SETTING_SCHEDULED = 'remindersScheduled';

export interface ReminderState {
  readonly enabled: boolean;
  readonly scheduled: number;
}

/**
 * Avisos de estreia, agendados **localmente**.
 *
 * <para>
 * Local, e não push. As datas de estreia já estão no aparelho depois do sync, então mandar isso
 * por servidor exigiria infraestrutura de push, chaves e um serviço acordado 24h — para entregar
 * uma informação que o telefone já tem. O sistema operacional dispara sozinho, inclusive com o
 * app fechado e sem rede.
 * </para>
 *
 * <para>
 * O que decide o quê e quando mora no <c>PremiereReminders</c>, puro e testado. Aqui fica só a
 * conversa com o sistema — permissão, agendamento e o registro do que já foi agendado.
 * </para>
 */
export class Reminders {
  static configure(): void {
    // Como o aviso se comporta com o app aberto. Sem isto ele chega e não aparece.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }

  static async isEnabled(): Promise<boolean> {
    const store = await LocalStore.open();
    return (await store.getSetting(SETTING_ENABLED)) === 'true';
  }

  /**
   * Liga os avisos. Pede a permissão só neste momento — nunca na abertura do app: um pedido
   * disparado a frio, antes de a pessoa saber o que ganha com ele, é o pedido que se nega.
   *
   * Devolve `false` quando o sistema recusa, e nesse caso o ajuste NÃO fica ligado: dizer que
   * está ligado sem poder notificar seria mentir na tela.
   */
  static async enable(): Promise<boolean> {
    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted || (await Notifications.requestPermissionsAsync()).granted;

    if (!granted) return false;

    if (Platform.OS === 'android') {
      // O Android exige canal; sem ele o aviso é entregue mudo e sem prioridade definida.
      await Notifications.setNotificationChannelAsync('estreias', {
        name: 'Estreias',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: 'Avisa quando um episódio das séries que você acompanha vai ao ar.',
      });
    }

    const store = await LocalStore.open();
    await store.setSetting(SETTING_ENABLED, 'true');
    return true;
  }

  static async disable(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const store = await LocalStore.open();
    await store.setSetting(SETTING_ENABLED, 'false');
    await store.setSetting(SETTING_SCHEDULED, '[]');
  }

  /**
   * Agenda o que falta. Idempotente: chamar de novo com a mesma lista não duplica nada, porque
   * as chaves já agendadas ficam guardadas — e sem isso cada abertura do app empilharia um aviso
   * a mais para a mesma estreia.
   */
  static async sync(premieres: readonly Premiere[]): Promise<ReminderState> {
    const store = await LocalStore.open();

    if ((await store.getSetting(SETTING_ENABLED)) !== 'true') {
      return { enabled: false, scheduled: 0 };
    }

    const already = Reminders.parseKeys(await store.getSetting(SETTING_SCHEDULED));

    const plans = PremiereReminders.plan(
      premieres.map((p) => ({
        episodeId: p.episodeId,
        seriesName: p.seriesName,
        seasonNumber: p.seasonNumber,
        episodeNumber: p.episodeNumber,
        episodeName: p.episodeName,
        airDate: p.airDate,
        isSeasonPremiere: p.isSeasonPremiere,
      })),
      new Date(),
      already,
    );

    const agendadas = [...already];
    for (const plan of plans) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: plan.key,
          content: { title: plan.title, body: plan.body, data: { episodeId: plan.episodeId } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: plan.fireAt,
            channelId: 'estreias',
          },
        });
        agendadas.push(plan.key);
      } catch {
        // Um agendamento recusado não pode derrubar os outros: o telefone pode ter atingido o
        // limite de alarmes, e perder um aviso é melhor do que perder todos.
      }
    }

    await store.setSetting(SETTING_SCHEDULED, JSON.stringify(agendadas));
    return { enabled: true, scheduled: agendadas.length };
  }

  private static parseKeys(raw: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
}

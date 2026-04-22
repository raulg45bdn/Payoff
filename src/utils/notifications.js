import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests notification permissions.
 * @param {boolean} showAlertOnDenied - show iOS Settings alert if denied (use true from toggle)
 * @returns {boolean} true if granted
 */
export async function requestNotificationPermissions(showAlertOnDenied = false) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    const granted = status === 'granted';

    if (!granted && showAlertOnDenied) {
      Alert.alert(
        'Notifications blocked',
        'To enable, go to iPhone Settings > PayOff > Notifications and turn on Allow Notifications.'
      );
    }

    return granted;
  } catch {
    return false;
  }
}

/**
 * Cancels all scheduled notifications.
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.error('cancelAllNotifications error:', e);
  }
}

/**
 * Schedules a single promo-deadline notification for one card.
 */
export async function scheduleOneNotification(card, daysAhead, isPrivate = false) {
  if (card.balance === 0) return;

  // Parse as LOCAL date to avoid UTC-midnight timezone issues
  const [y, m, d] = card.promoExpiration.split('-').map(Number);
  const expiryDate = new Date(y, m - 1, d);
  const notifyDate = new Date(expiryDate);
  notifyDate.setDate(notifyDate.getDate() - daysAhead);
  notifyDate.setHours(9, 0, 0, 0);

  if (notifyDate <= new Date()) return;

  const body = isPrivate
    ? 'A promo deadline is approaching. Open PayOff for details.'
    : `${card.name} expires in ${daysAhead} days. Balance: $${card.balance.toLocaleString()}`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Promo deadline approaching',
      body,
      data: { cardId: card.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notifyDate,
    },
  });
}

/**
 * Schedules a monthly payment reminder for one card (fires before the card's dueDate each month).
 */
export async function scheduleOneMonthlyCardNotification(card) {
  if (!card.monthlyReminderEnabled || !card.dueDate) return;

  const now = new Date();
  let dueDate = new Date(now.getFullYear(), now.getMonth(), card.dueDate, 9, 0, 0, 0);
  if (dueDate <= now) {
    dueDate = new Date(now.getFullYear(), now.getMonth() + 1, card.dueDate, 9, 0, 0, 0);
  }

  const daysBefore = card.monthlyReminderDaysBefore ?? 3;
  const notifyDate = new Date(dueDate);
  notifyDate.setDate(notifyDate.getDate() - daysBefore);
  if (notifyDate <= now) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Payment due soon',
      body: `${card.name} payment is due in ${daysBefore} day${daysBefore !== 1 ? 's' : ''} — minimum $${card.monthlyPayment.toLocaleString()}/mo`,
      data: { cardId: card.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notifyDate,
    },
  });
}

/**
 * Schedules a single due-date reminder for one bill.
 * Fires notificationDaysBefore days before the next due date at 9 AM.
 */
export async function scheduleOneBillNotification(bill) {
  if (!bill.notificationEnabled || !bill.dueDate) return;

  const now = new Date();
  const dueDay = bill.dueDate;

  // This month's due date at 9 AM
  let dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay, 9, 0, 0, 0);
  // If already past, use next month
  if (dueDate <= now) {
    dueDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay, 9, 0, 0, 0);
  }

  const daysBefore = bill.notificationDaysBefore ?? 3;
  const notifyDate = new Date(dueDate);
  notifyDate.setDate(notifyDate.getDate() - daysBefore);

  if (notifyDate <= now) return;

  const amount = bill.variableAmountThisMonth ?? bill.amount;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Bill due soon',
      body: `${bill.name} is due in ${daysBefore} day${daysBefore !== 1 ? 's' : ''} — $${amount.toLocaleString()}`,
      data: { billId: bill.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notifyDate,
    },
  });
}

/**
 * Cancels all then re-schedules notifications for cards and bills.
 * iOS hard limit: 64 total. Cards get priority (up to 60), bills fill the rest (up to 4).
 * @param {object[]} cards
 * @param {object}   settings
 * @param {object[]} bills
 */
export async function scheduleAllNotifications(cards, settings, bills = []) {
  if (!settings?.notificationsEnabled) return;

  await cancelAllNotifications();

  const daysAhead = settings.notificationDaysAhead ?? 60;
  const isPrivate = settings.privateNotifications ?? false;

  // Cards: sorted by soonest expiration, capped at 60
  // Per-card notificationEnabled defaults to true; per-card days overrides global
  const prioritizedCards = [...cards]
    .filter(c => c.balance > 0 && c.promoExpiration && c.notificationEnabled !== false)
    .sort((a, b) => new Date(a.promoExpiration) - new Date(b.promoExpiration))
    .slice(0, 60);

  for (const card of prioritizedCards) {
    try {
      if (card.notificationMode === 'date' && card.notificationCustomDate) {
        const notifyDate = new Date(card.notificationCustomDate);
        if (notifyDate > new Date()) {
          const body = isPrivate
            ? 'A promo deadline is approaching. Open PayOff for details.'
            : card.notificationCustomMessage || `${card.name} promo reminder. Balance: $${card.balance.toLocaleString()}`;
          await Notifications.scheduleNotificationAsync({
            content: { title: 'Promo deadline reminder', body, data: { cardId: card.id } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: notifyDate },
          });
        }
      } else {
        const cardDays = card.notificationDaysBefore ?? daysAhead;
        await scheduleOneNotification(card, cardDays, isPrivate);
      }
    } catch (e) {
      console.error('scheduleOneNotification error:', card.name, e);
    }
  }

  // Monthly card payment reminders (capped at 20 slots)
  const monthlyCards = [...cards]
    .filter(c => c.monthlyReminderEnabled && c.dueDate && c.balance > 0)
    .slice(0, 20);

  for (const card of monthlyCards) {
    try {
      await scheduleOneMonthlyCardNotification(card);
    } catch (e) {
      console.error('scheduleOneMonthlyCardNotification error:', card.name, e);
    }
  }

  // Bills: monthly due-date reminders
  const billSlots = 64 - prioritizedCards.length - monthlyCards.length;
  const billsToSchedule = bills
    .filter(b => b.notificationEnabled && b.dueDate)
    .slice(0, Math.floor(billSlots / 2));

  for (const bill of billsToSchedule) {
    try {
      await scheduleOneBillNotification(bill);
    } catch (e) {
      console.error('scheduleOneBillNotification error:', bill.name, e);
    }
  }

  // Bills: custom date reminders
  const billCustomSlots = 64 - prioritizedCards.length - monthlyCards.length - billsToSchedule.length;
  const billsCustom = bills
    .filter(b => b.customReminderEnabled && b.customReminderDate && new Date(b.customReminderDate) > new Date())
    .slice(0, billCustomSlots);

  for (const bill of billsCustom) {
    try {
      const body = bill.customReminderMessage || `Reminder: ${bill.name}`;
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Bill reminder', body, data: { billId: bill.id } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(bill.customReminderDate),
        },
      });
    } catch (e) {
      console.error('scheduleOneBillCustom error:', bill.name, e);
    }
  }
}

/**
 * Returns the current iOS notification permission status.
 */
export async function getNotificationPermissionStatus() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'undetermined';
  }
}

/**
 * Sends an immediate test notification (fires in 5 seconds).
 */
export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Promo deadline approaching',
      body: 'Test: Your promo deadline is coming up soon. Check PayOff for details.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  });
}

// Backward-compatible alias used by AppContext
export const scheduleCardNotifications = scheduleAllNotifications;

import * as Calendar from 'expo-calendar';
import { Alert } from 'react-native';
import { clampDueDate } from './calculations';

const PAYOFF_CALENDAR_NAME = 'PayOff';
const PAYOFF_CALENDAR_COLOR = '#007AFF';

// ─── Permission ────────────────────────────────────────────────────────────────

export async function requestCalendarPermission(showAlertOnDenied = false) {
  try {
    const { status: existing } = await Calendar.getCalendarPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Calendar.requestCalendarPermissionsAsync();
    const granted = status === 'granted';

    if (!granted && showAlertOnDenied) {
      Alert.alert(
        'Calendar access blocked',
        'To enable, go to iPhone Settings > PayOff > Calendars and turn on access.'
      );
    }
    return granted;
  } catch {
    return false;
  }
}

// ─── PayOff calendar ───────────────────────────────────────────────────────────
// Finds the dedicated "PayOff" calendar, or creates it if it doesn't exist.

async function getOrCreatePayOffCalendar() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find(
    c => c.title === PAYOFF_CALENDAR_NAME && c.allowsModifications
  );
  if (existing) return existing.id;

  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  return Calendar.createCalendarAsync({
    title: PAYOFF_CALENDAR_NAME,
    color: PAYOFF_CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: defaultCalendar.source?.id,
    source: defaultCalendar.source,
    name: PAYOFF_CALENDAR_NAME,
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

// ─── Single-card sync ──────────────────────────────────────────────────────────
// Creates or updates two events for a card: promo expiration + monthly due date.
// Returns { promo: eventId | null, dueDate: eventId | null }

export async function syncCardToCalendar(card, settings, storedIds = {}) {
  if (!card?.id) return storedIds;

  const calendarId = await getOrCreatePayOffCalendar();
  const result = { promo: storedIds.promo ?? null, dueDate: storedIds.dueDate ?? null };

  // ── Promo expiration event ────────────────────────────────────────────────
  if (card.promoExpiration && card.balance > 0) {
    const expiryDate = new Date(card.promoExpiration);
    const daysAhead = settings?.notificationDaysAhead ?? 60;
    const alertDate = new Date(expiryDate);
    alertDate.setDate(alertDate.getDate() - daysAhead);
    const now = new Date();

    const promoDetails = {
      title: `⚠️ ${card.name} promo expires`,
      startDate: expiryDate,
      endDate: expiryDate,
      allDay: true,
      calendarId,
      notes: `Balance: $${card.balance.toLocaleString()} | Monthly payment: $${card.monthlyPayment}/mo\n\nManage in PayOff app.`,
      alarms: alertDate > now ? [{ absoluteDate: alertDate }] : [],
    };

    try {
      if (storedIds.promo) {
        await Calendar.updateEventAsync(storedIds.promo, promoDetails);
      } else {
        result.promo = await Calendar.createEventAsync(calendarId, promoDetails);
      }
    } catch {
      // Stored event ID no longer valid — create fresh
      try {
        result.promo = await Calendar.createEventAsync(calendarId, promoDetails);
      } catch (e) {
        console.error('calendarSync: promo event error:', card.name, e);
      }
    }
  } else if (storedIds.promo) {
    // Card paid off — remove the event
    try { await Calendar.deleteEventAsync(storedIds.promo); } catch {}
    result.promo = null;
  }

  // ── Monthly due date event ────────────────────────────────────────────────
  if (card.dueDate && card.balance > 0) {
    const now = new Date();
    const dueDay = clampDueDate(card.dueDate, now);
    let dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (dueDate < now) {
      dueDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    }
    const dueDateEnd = new Date(dueDate.getTime() + 86400000); // +1 day for all-day

    const dueDetails = {
      title: `${card.name} payment due`,
      startDate: dueDate,
      endDate: dueDateEnd,
      allDay: true,
      calendarId,
      notes: `Minimum payment: $${card.monthlyPayment}/mo\n\nManage in PayOff app.`,
      recurrenceRule: {
        frequency: Calendar.Frequency.MONTHLY,
        interval: 1,
      },
      alarms: [{ relativeOffset: -1440 }], // 1 day before at same time
    };

    try {
      if (storedIds.dueDate) {
        await Calendar.updateEventAsync(storedIds.dueDate, dueDetails);
      } else {
        result.dueDate = await Calendar.createEventAsync(calendarId, dueDetails);
      }
    } catch {
      try {
        result.dueDate = await Calendar.createEventAsync(calendarId, dueDetails);
      } catch (e) {
        console.error('calendarSync: due date event error:', card.name, e);
      }
    }
  } else if (storedIds.dueDate) {
    try { await Calendar.deleteEventAsync(storedIds.dueDate); } catch {}
    result.dueDate = null;
  }

  return result;
}

// ─── Delete events for one card ────────────────────────────────────────────────

export async function deleteCardCalendarEvents(ids = {}) {
  for (const eventId of Object.values(ids)) {
    if (eventId) {
      try { await Calendar.deleteEventAsync(eventId); } catch {}
    }
  }
}

// ─── Sync all cards ────────────────────────────────────────────────────────────
// Returns a fresh calendarEventIds map: { [cardId]: { promo, dueDate } }

export async function syncAllCardsToCalendar(cards, settings, storedEventIds = {}) {
  const result = {};
  for (const card of cards) {
    if ((card.balance ?? 0) <= 0) {
      // Clean up events for paid-off cards
      if (storedEventIds[card.id]) {
        await deleteCardCalendarEvents(storedEventIds[card.id]);
      }
      continue;
    }
    try {
      result[card.id] = await syncCardToCalendar(
        card,
        settings,
        storedEventIds[card.id] ?? {}
      );
    } catch (e) {
      console.error('syncAllCardsToCalendar error:', card.name, e);
    }
  }
  return result;
}

// ─── Delete all PayOff calendar events ────────────────────────────────────────

export async function deleteAllCalendarEvents(storedEventIds = {}) {
  for (const ids of Object.values(storedEventIds)) {
    await deleteCardCalendarEvents(ids);
  }
}

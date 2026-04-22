import { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SEED_CARDS, SEED_FIXED_BILLS, SEED_SETTINGS, defaultEmptySettings } from '../utils/seedData';
import { computeDerivedFields } from '../utils/calculations';
import {
  scheduleCardNotifications,
  cancelAllNotifications,
  getNotificationPermissionStatus,
} from '../utils/notifications';
import {
  syncCardToCalendar,
  deleteCardCalendarEvents,
  deleteAllCalendarEvents,
} from '../utils/calendarSync';

const CARDS_KEY = '@payoff/cards';
const BILLS_KEY = '@payoff/bills';
const SETTINGS_KEY = '@payoff/settings';
const INITIALIZED_KEY = '@payoff/initialized';
const SCHEMA_VERSION_KEY = '@payoff/schemaVersion';

const SEC_INCOME_KEY = '@payoff/secure/income';
const SEC_CHECKING_KEY = '@payoff/secure/checking';
const SEC_SAVINGS_KEY = '@payoff/secure/savings';

async function secureRead(key, fallback) {
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val === null) return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  } catch {
    return fallback;
  }
}

async function secureWrite(key, value) {
  try {
    await SecureStore.setItemAsync(key, String(value));
  } catch (e) {
    console.warn('SecureStore write failed:', key, e);
  }
}

async function writeSecureFinancials(settings) {
  await Promise.all([
    secureWrite(SEC_INCOME_KEY, settings.monthlyIncome ?? 0),
    secureWrite(SEC_CHECKING_KEY, settings.checkingBalance ?? 0),
    secureWrite(SEC_SAVINGS_KEY, settings.savingsBalance ?? 0),
  ]);
}

const CURRENT_SCHEMA_VERSION = 7;

// ─── YYYY-MM key for monthly reset comparison ──────────────────────────────────
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function makeId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// ─── safeWrite ─────────────────────────────────────────────────────────────────
async function safeWrite(key, value) {
  const tmpKey = `${key}_tmp`;
  const json = JSON.stringify(value);
  if (typeof json !== 'string') throw new Error(`safeWrite: failed to serialize "${key}"`);
  try {
    await AsyncStorage.setItem(tmpKey, json);
    const verify = await AsyncStorage.getItem(tmpKey);
    if (verify === null) throw new Error(`safeWrite: verification read returned null for "${key}"`);
    if (verify !== json) throw new Error(`safeWrite: verification mismatch for "${key}"`);
    await AsyncStorage.setItem(key, verify);
    await AsyncStorage.removeItem(tmpKey);
  } catch (e) {
    try { await AsyncStorage.removeItem(tmpKey); } catch {}
    throw e;
  }
}

// ─── Schema migration ──────────────────────────────────────────────────────────
const CARD_FIELD_DEFAULTS = {
  transferFee: 0,
  notes: '',
  isTransferred: false,
  lastPaymentDate: null,
  lastPaymentAmount: 0,
  payStatus: 'Pending',
  paymentHistory: [],
  notificationEnabled: false,
  notificationDaysBefore: 60,
  notificationMode: 'days',
  notificationCustomDate: null,
  notificationCustomMessage: '',
  monthlyReminderEnabled: false,
  monthlyReminderDaysBefore: 3,
};

function migrateCards(cards) {
  return cards.map(card => ({ ...CARD_FIELD_DEFAULTS, ...card }));
}

const BILL_FIELD_DEFAULTS = {
  id: null,
  name: '',
  amount: 0,
  isVariable: false,
  variableAmountThisMonth: null,
  dueDate: 1,
  payStatus: 'Pending',
  category: 'Other',
  lastPaymentDate: null,
  lastPaymentAmount: 0,
  paymentHistory: [],
  notificationEnabled: false,
  notificationDaysBefore: 3,
  customReminderEnabled: false,
  customReminderDate: null,
  customReminderMessage: '',
};

function migrateBills(bills) {
  if (!Array.isArray(bills)) return SEED_FIXED_BILLS;
  return bills.map(b => ({
    ...BILL_FIELD_DEFAULTS,
    ...b,
    id: b.id ?? makeId(), // ensure id is always a real value, not null/undefined
  }));
}

function migrateSettings(s, fromVersion) {
  if (fromVersion < 6) {
    s = {
      checkingBalance: 3500,
      savingsBalance: 600,
      extraPaymentPool: 0,
      cardOverrides: {},
      notificationsEnabled: false,
      notificationDaysAhead: 60,
      userName: '',
      lastUpdatedMonth: currentMonthKey(),
      ...s,
    };
  }
  if (fromVersion < 7) {
    // Strip old student loan fields; add new Phase 6 fields
    const { studentLoansPaused, studentLoanAmount, fixedBills, ...rest } = s;
    s = {
      notificationMode: 'individual',
      digestTime: '09:00',
      dashboardBillsViewMode: 'list',
      biometricEnabled: false,
      autoLockTimeout: 5,
      requireBiometricExport: false,
      ...rest,
    };
  }
  return s;
}

// ─── Settings defaults (applied on every load so new fields are always present)
const SETTINGS_DEFAULTS = {
  checkingBalance: 3500,
  savingsBalance: 600,
  extraPaymentPool: 0,
  cardOverrides: {},
  lastUpdatedMonth: currentMonthKey(),
  notificationsEnabled: false,
  notificationDaysAhead: 60,
  notificationMode: 'individual',
  digestTime: '09:00',
  privateNotifications: false,
  calendarSyncEnabled: false,
  calendarEventIds: {},
  dashboardBillsViewMode: 'list',
  billsSectionCollapsed: false,
  biometricEnabled: false,
  autoLockTimeout: 5,
  requireBiometricExport: false,
  userName: '',
};

// ─── Context ───────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [cards, setCards] = useState([]);
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState(SEED_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // ── Modal dismiss registry (CLOSE_ALL_MODALS mechanism) ───────────────────
  const modalDismissCallbacks = useRef([]);

  function registerModalDismiss(cb) {
    modalDismissCallbacks.current.push(cb);
    return () => {
      modalDismissCallbacks.current = modalDismissCallbacks.current.filter(f => f !== cb);
    };
  }

  function closeAllModals() {
    modalDismissCallbacks.current.forEach(cb => {
      try { cb(); } catch {}
    });
  }

  // ─── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const initialized = await AsyncStorage.getItem(INITIALIZED_KEY);

        if (!initialized) {
          const seededCards = SEED_CARDS.map(computeDerivedFields);
          await safeWrite(CARDS_KEY, seededCards);
          await safeWrite(BILLS_KEY, SEED_FIXED_BILLS);
          await safeWrite(SETTINGS_KEY, SEED_SETTINGS);
          await writeSecureFinancials(SEED_SETTINGS);
          await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
          await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
          setCards(seededCards);
          setBills(SEED_FIXED_BILLS);
          setSettings(SEED_SETTINGS);
        } else {
          const storedVersionRaw = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
          const storedVersion = storedVersionRaw ? parseInt(storedVersionRaw, 10) : 1;

          const [rawCards, rawBills, rawSettings] = await Promise.all([
            AsyncStorage.getItem(CARDS_KEY),
            AsyncStorage.getItem(BILLS_KEY),
            AsyncStorage.getItem(SETTINGS_KEY),
          ]);

          let parsedCards;
          try {
            parsedCards = rawCards ? JSON.parse(rawCards) : SEED_CARDS.map(computeDerivedFields);
            if (!Array.isArray(parsedCards)) throw new Error('cards is not an array');
          } catch (e) {
            console.error('AppContext: cards parse failed, falling back to seed', e);
            parsedCards = SEED_CARDS.map(computeDerivedFields);
          }

          let parsedSettings;
          try {
            parsedSettings = rawSettings ? JSON.parse(rawSettings) : SEED_SETTINGS;
            if (typeof parsedSettings !== 'object' || Array.isArray(parsedSettings)) throw new Error('settings is not an object');
          } catch (e) {
            console.error('AppContext: settings parse failed, falling back to seed', e);
            parsedSettings = SEED_SETTINGS;
          }

          // Bills: if no separate key yet, migrate from settings.fixedBills
          let parsedBills;
          try {
            if (rawBills) {
              parsedBills = JSON.parse(rawBills);
              if (!Array.isArray(parsedBills)) throw new Error('bills is not an array');
            } else if (Array.isArray(parsedSettings.fixedBills)) {
              parsedBills = parsedSettings.fixedBills;
            } else {
              parsedBills = SEED_FIXED_BILLS;
            }
          } catch (e) {
            console.error('AppContext: bills parse failed, falling back to seed', e);
            parsedBills = SEED_FIXED_BILLS;
          }

          if (storedVersion < CURRENT_SCHEMA_VERSION) {
            parsedCards = migrateCards(parsedCards);
            parsedBills = migrateBills(parsedBills);
            parsedSettings = migrateSettings(parsedSettings, storedVersion);
            await safeWrite(CARDS_KEY, parsedCards);
            await safeWrite(BILLS_KEY, parsedBills);
            await safeWrite(SETTINGS_KEY, parsedSettings);
            await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
          }

          const loadedSettings = { ...SETTINGS_DEFAULTS, ...parsedSettings };

          const nowMonth = currentMonthKey();
          if (loadedSettings.lastUpdatedMonth !== nowMonth) {
            loadedSettings.extraPaymentPool = 0;
            loadedSettings.cardOverrides = {};
            loadedSettings.lastUpdatedMonth = nowMonth;
            // Reset monthly bill pay status and variable amounts
            parsedBills = parsedBills.map(b => ({ ...b, payStatus: 'Pending', variableAmountThisMonth: null }));
            // Reset monthly card pay status
            parsedCards = parsedCards.map(c => ({ ...c, payStatus: 'Pending' }));
            await safeWrite(BILLS_KEY, parsedBills);
            await safeWrite(CARDS_KEY, parsedCards);
            await safeWrite(SETTINGS_KEY, loadedSettings);
          }

          if (loadedSettings.notificationsEnabled) {
            const status = await getNotificationPermissionStatus();
            if (status !== 'granted') {
              loadedSettings.notificationsEnabled = false;
              await safeWrite(SETTINGS_KEY, loadedSettings);
            }
          }

          // Overlay SecureStore values — they are the source of truth for financials
          const [secIncome, secChecking, secSavings] = await Promise.all([
            secureRead(SEC_INCOME_KEY, loadedSettings.monthlyIncome),
            secureRead(SEC_CHECKING_KEY, loadedSettings.checkingBalance),
            secureRead(SEC_SAVINGS_KEY, loadedSettings.savingsBalance),
          ]);
          loadedSettings.monthlyIncome = secIncome;
          loadedSettings.checkingBalance = secChecking;
          loadedSettings.savingsBalance = secSavings;

          setCards(parsedCards.map(computeDerivedFields));
          setBills(parsedBills);
          setSettings(loadedSettings);
        }
      } catch (e) {
        console.error('AppContext load error:', e);
        setCards(SEED_CARDS.map(computeDerivedFields));
        setBills(SEED_FIXED_BILLS);
        setSettings(SEED_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // ─── updateCard ────────────────────────────────────────────────────────────
  function updateCard(updatedCard) {
    if (!updatedCard?.id) {
      console.warn('updateCard: no id on card, skipping');
      return;
    }
    setCards(prev => {
      const idx = prev.findIndex(c => c.id === updatedCard.id);
      if (idx === -1) {
        console.warn('updateCard: card not found:', updatedCard.id);
        return prev;
      }
      const withDerived = computeDerivedFields(updatedCard);
      const updated = [...prev];
      updated[idx] = withDerived;
      safeWrite(CARDS_KEY, updated).catch(e =>
        console.error('safeWrite updateCard error:', e)
      );
      scheduleCardNotifications(updated, settings, bills).catch(() => {});
      if (settings.calendarSyncEnabled) {
        syncCardToCalendar(withDerived, settings, settings.calendarEventIds?.[updatedCard.id] ?? {})
          .then(newIds => updateSettings({
            calendarEventIds: { ...settings.calendarEventIds, [updatedCard.id]: newIds },
          }))
          .catch(() => {});
      }
      return updated;
    });
  }

  // ─── updateSettings ────────────────────────────────────────────────────────
  function updateSettings(fields, { skipNotifications = false } = {}) {
    setSettings(prev => {
      const updated = { ...prev, ...fields, lastUpdated: new Date().toISOString() };
      safeWrite(SETTINGS_KEY, updated).catch(e =>
        console.error('safeWrite updateSettings error:', e)
      );
      // Mirror sensitive financials to SecureStore whenever they change
      if ('monthlyIncome' in fields || 'checkingBalance' in fields || 'savingsBalance' in fields) {
        writeSecureFinancials(updated).catch(() => {});
      }
      if (!skipNotifications) {
        scheduleCardNotifications(cards, updated, bills).catch(() => {});
      }
      return updated;
    });
  }

  // ─── addCard ───────────────────────────────────────────────────────────────
  function addCard(card) {
    const withDerived = computeDerivedFields(card);
    setCards(prev => {
      const updated = [...prev, withDerived];
      safeWrite(CARDS_KEY, updated).catch(e =>
        console.error('safeWrite addCard error:', e)
      );
      scheduleCardNotifications(updated, settings, bills).catch(() => {});
      return updated;
    });
  }

  // ─── removeCard ────────────────────────────────────────────────────────────
  function removeCard(cardId) {
    setCards(prev => {
      const updated = prev.filter(c => c.id !== cardId);
      safeWrite(CARDS_KEY, updated).catch(e =>
        console.error('safeWrite removeCard error:', e)
      );
      scheduleCardNotifications(updated, settings, bills).catch(() => {});

      const settingsUpdates = {};
      // Clean up stale extra-payment override so Strategy totals stay accurate
      if (settings.cardOverrides?.[cardId] !== undefined) {
        const newOverrides = { ...settings.cardOverrides };
        delete newOverrides[cardId];
        settingsUpdates.cardOverrides = newOverrides;
      }
      if (settings.calendarSyncEnabled && settings.calendarEventIds?.[cardId]) {
        deleteCardCalendarEvents(settings.calendarEventIds[cardId]).catch(() => {});
        const newIds = { ...settings.calendarEventIds };
        delete newIds[cardId];
        settingsUpdates.calendarEventIds = newIds;
      }
      if (Object.keys(settingsUpdates).length > 0) {
        // skipNotifications: scheduleCardNotifications already called above with the correct (post-deletion) cards
        updateSettings(settingsUpdates, { skipNotifications: true });
      }
      return updated;
    });
  }

  // ─── addBill ───────────────────────────────────────────────────────────────
  function addBill(bill) {
    const newBill = {
      ...BILL_FIELD_DEFAULTS,
      id: makeId(),
      ...bill,
    };
    setBills(prev => {
      const updated = [...prev, newBill];
      safeWrite(BILLS_KEY, updated).catch(e =>
        console.error('safeWrite addBill error:', e)
      );
      scheduleCardNotifications(cards, settings, updated).catch(() => {});
      return updated;
    });
  }

  // ─── updateBill ────────────────────────────────────────────────────────────
  function updateBill(updatedBill) {
    if (!updatedBill?.id) return;
    setBills(prev => {
      const idx = prev.findIndex(b => b.id === updatedBill.id);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...prev[idx], ...updatedBill };
      safeWrite(BILLS_KEY, updated).catch(e =>
        console.error('safeWrite updateBill error:', e)
      );
      scheduleCardNotifications(cards, settings, updated).catch(() => {});
      return updated;
    });
  }

  // ─── removeBill ────────────────────────────────────────────────────────────
  function removeBill(billId) {
    setBills(prev => {
      const updated = prev.filter(b => b.id !== billId);
      safeWrite(BILLS_KEY, updated).catch(e =>
        console.error('safeWrite removeBill error:', e)
      );
      scheduleCardNotifications(cards, settings, updated).catch(() => {});
      return updated;
    });
  }

  // ─── resetCards (wipe cards only, keep settings + bills) ──────────────────
  async function resetCards() {
    closeAllModals();
    try {
      await safeWrite(CARDS_KEY, []);
      await cancelAllNotifications();
      const settingsUpdates = { cardOverrides: {}, extraPaymentPool: 0 };
      if (settings.calendarSyncEnabled) {
        await deleteAllCalendarEvents(settings.calendarEventIds ?? {});
        settingsUpdates.calendarEventIds = {};
      }
      updateSettings(settingsUpdates);
      setCards([]);
    } catch (e) {
      console.error('resetCards error:', e);
    }
  }

  // ─── factoryReset (wipe everything, reload seed data) ─────────────────────
  async function factoryReset() {
    closeAllModals();
    try {
      if (settings.calendarSyncEnabled) {
        await deleteAllCalendarEvents(settings.calendarEventIds ?? {});
      }
      await AsyncStorage.clear();
      await cancelAllNotifications();
      const seededCards = SEED_CARDS.map(computeDerivedFields);
      await safeWrite(CARDS_KEY, seededCards);
      await safeWrite(BILLS_KEY, SEED_FIXED_BILLS);
      await safeWrite(SETTINGS_KEY, SEED_SETTINGS);
      await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
      await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
      setCards(seededCards);
      setBills(SEED_FIXED_BILLS);
      setSettings(SEED_SETTINGS);
    } catch (e) {
      console.error('factoryReset error:', e);
    }
  }

  // ─── startFresh (wipe everything, no seed data) ────────────────────────────
  async function startFresh() {
    closeAllModals();
    try {
      if (settings.calendarSyncEnabled) {
        await deleteAllCalendarEvents(settings.calendarEventIds ?? {});
      }
      await AsyncStorage.clear();
      await cancelAllNotifications();
      await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
      await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
      await safeWrite(SETTINGS_KEY, defaultEmptySettings);
      await safeWrite(CARDS_KEY, []);
      await safeWrite(BILLS_KEY, []);
      setCards([]);
      setBills([]);
      setSettings(defaultEmptySettings);
    } catch (e) {
      console.error('startFresh error:', e);
    }
  }

  // ─── importData — restore from a validated backup object ──────────────────
  async function importData({ cards: importedCards, fixedBills: importedBills, settings: importedSettings }) {
    closeAllModals();
    try {
      const mergedSettings = { ...SETTINGS_DEFAULTS, ...importedSettings };
      const processedCards = (importedCards ?? []).map(computeDerivedFields);
      const processedBills = migrateBills(importedBills ?? []);
      await AsyncStorage.clear();
      await cancelAllNotifications();
      await safeWrite(CARDS_KEY, processedCards);
      await safeWrite(BILLS_KEY, processedBills);
      await safeWrite(SETTINGS_KEY, mergedSettings);
      await writeSecureFinancials(mergedSettings);
      await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
      await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
      setCards(processedCards);
      setBills(processedBills);
      setSettings(mergedSettings);
    } catch (e) {
      console.error('importData error:', e);
      throw e;
    }
  }

  // ─── resetData (legacy alias for factoryReset) ─────────────────────────────
  const resetData = factoryReset;

  return (
    <AppContext.Provider value={{
      cards,
      bills,
      settings,
      isLoading,
      updateCard,
      addCard,
      removeCard,
      addBill,
      updateBill,
      removeBill,
      updateSettings,
      resetCards,
      factoryReset,
      startFresh,
      resetData,
      importData,
      registerModalDismiss,
      closeAllModals,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

import { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Switch, Alert, StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../context/AppContext';
import { validateImportData } from '../utils/importValidation';
import {
  requestNotificationPermissions,
  scheduleAllNotifications,
  cancelAllNotifications,
  sendTestNotification,
} from '../utils/notifications';
import {
  requestCalendarPermission,
  syncAllCardsToCalendar,
  deleteAllCalendarEvents,
} from '../utils/calendarSync';
import { Colors, Typography } from '../theme';

const VERSION = Constants.expoConfig?.version ?? '1.0.0';
const BUILD = Constants.expoConfig?.ios?.buildNumber ?? '1';

// ─── Row style helpers ────────────────────────────────────────────────────────

function rowRadius(isFirst, isLast) {
  return {
    borderTopLeftRadius: isFirst ? 16 : 0,
    borderTopRightRadius: isFirst ? 16 : 0,
    borderBottomLeftRadius: isLast ? 16 : 0,
    borderBottomRightRadius: isLast ? 16 : 0,
  };
}

function SettingsRow({ label, labelColor, value, control, isFirst, isLast, onPress, hideChevron }) {
  const inner = (
    <View style={[styles.row, rowRadius(isFirst, isLast), !isLast && styles.rowBorder]}>
      <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
      <View style={styles.rowRight}>
        {value !== undefined && (
          <Text style={styles.rowValue}>{value}</Text>
        )}
        {control}
        {onPress && !hideChevron && (
          <Text style={styles.chevron}>›</Text>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────

export default function SettingsScreen({ navigation }) {
  const { cards, bills, settings, updateSettings, resetCards, factoryReset, startFresh, importData } = useApp();

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  function showToast(msg) {
    setToastMsg(msg);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setToastMsg(null));
  }

  // ── Profile ────────────────────────────────────────────────────────────────
  function handleEditName() {
    Alert.prompt(
      'Your name',
      'Enter your first and last name',
      (text) => {
        if (text !== null) updateSettings({ userName: text.trim() });
      },
      'plain-text',
      settings.userName ?? '',
      'default'
    );
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  async function handleNotificationsToggle(enabled) {
    if (enabled) {
      const granted = await requestNotificationPermissions(true);
      if (!granted) return; // alert already shown by requestNotificationPermissions
      updateSettings({ notificationsEnabled: true });
      await scheduleAllNotifications(cards, { ...settings, notificationsEnabled: true });
    } else {
      updateSettings({ notificationsEnabled: false });
      await cancelAllNotifications();
    }
  }

  function handleDaysAhead() {
    Alert.prompt(
      'Days before deadline',
      'Enter days in advance to be notified (7–180)',
      async (text) => {
        if (text === null) return;
        const days = parseInt(text, 10);
        if (isNaN(days) || days < 7 || days > 180) {
          Alert.alert('Invalid value', 'Please enter a number between 7 and 180.');
          return;
        }
        updateSettings({ notificationDaysAhead: days });
        if (settings.notificationsEnabled) {
          await scheduleAllNotifications(cards, { ...settings, notificationDaysAhead: days });
        }
      },
      'plain-text',
      String(settings.notificationDaysAhead ?? 60),
      'number-pad'
    );
  }

  async function handleTestNotification() {
    await sendTestNotification();
    showToast('Test alert sent — check in 5 seconds.');
  }

  // ── Apple Calendar ─────────────────────────────────────────────────────────
  async function handleCalendarToggle(enabled) {
    if (Constants.executionEnvironment === 'storeClient') {
      Alert.alert(
        'Requires Development Build',
        'Apple Calendar sync needs a custom build of PayOff. Your push notifications already cover this — promo deadlines and due dates will still alert you on time.'
      );
      return;
    }
    if (enabled) {
      const granted = await requestCalendarPermission(true);
      if (!granted) return;
      showToast('Syncing to Apple Calendar…');
      const newEventIds = await syncAllCardsToCalendar(
        cards,
        settings,
        settings.calendarEventIds ?? {}
      );
      updateSettings({ calendarSyncEnabled: true, calendarEventIds: newEventIds });
      showToast('Calendar events created.');
    } else {
      await deleteAllCalendarEvents(settings.calendarEventIds ?? {});
      updateSettings({ calendarSyncEnabled: false, calendarEventIds: {} });
      showToast('Calendar events removed.');
    }
  }

  // ── Data Management ────────────────────────────────────────────────────────
  function handleExport() {
    Alert.alert(
      'Export data',
      'This file contains your balances, income, and financial details. Only save it to a secure location or share it with yourself.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              const exportData = {
                exportDate: new Date().toISOString(),
                version: VERSION,
                schemaVersion: 7,
                cards,
                fixedBills: bills,
                settings,
              };
              const dateStr = new Date().toISOString().slice(0, 10);
              const fileUri = FileSystem.documentDirectory + `payoff_backup_${dateStr}.json`;
              await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));
              await Sharing.shareAsync(fileUri, {
                mimeType: 'application/json',
                dialogTitle: 'Export PayOff data',
              });
            } catch (e) {
              Alert.alert('Export failed', 'Unable to generate the backup file.');
              console.error('Export error:', e);
            }
          },
        },
      ]
    );
  }

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const raw = await FileSystem.readAsStringAsync(fileUri);
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        Alert.alert('Invalid file', 'The selected file is not valid JSON.');
        return;
      }

      const { valid, error } = validateImportData(parsed);
      if (!valid) {
        Alert.alert('Cannot restore backup', error);
        return;
      }

      const cardCount = parsed.cards?.length ?? 0;
      const billCount = parsed.fixedBills?.length ?? 0;
      Alert.alert(
        'Restore this backup?',
        `This will replace all your current data with the backup from ${parsed.exportDate ? new Date(parsed.exportDate).toLocaleDateString() : 'unknown date'}.\n\n${cardCount} card${cardCount !== 1 ? 's' : ''}, ${billCount} bill${billCount !== 1 ? 's' : ''}.\n\nThis cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await importData(parsed);
                showToast('Backup restored.');
              } catch {
                Alert.alert('Restore failed', 'Something went wrong. Your data was not changed.');
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Import failed', 'Could not read the selected file.');
      console.error('Import error:', e);
    }
  }

  function handleResetCards() {
    Alert.alert(
      'Reset Cards',
      'This will delete all your cards and payment history. Your income, bills, and settings will be kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Cards',
          style: 'destructive',
          onPress: async () => {
            await resetCards();
            navigation.navigate('Dashboard');
            setTimeout(() => showToast('All cards cleared.'), 400);
          },
        },
      ]
    );
  }

  function handleFactoryReset() {
    Alert.alert(
      'Factory Reset',
      'This will delete ALL your data including cards, balances, income, and settings, and reload the original demo data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            await factoryReset();
            navigation.navigate('Dashboard');
            setTimeout(() => showToast('App reset to original data.'), 400);
          },
        },
      ]
    );
  }

  function handleStartFresh() {
    Alert.alert(
      'Start Fresh',
      'This will delete ALL your data and start the app completely empty. No demo data will be loaded. You will enter your own cards and settings from scratch. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Fresh',
          style: 'destructive',
          onPress: async () => {
            await startFresh();
            // WelcomeScreen renders automatically when cards+bills are empty — no navigate needed
          },
        },
      ]
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── PROFILE ── */}
        <SectionHeader title="PROFILE" />
        <View style={styles.section}>
          <SettingsRow
            label="Your name"
            value={settings.userName ? settings.userName : 'Not set'}
            isFirst
            isLast
            onPress={handleEditName}
          />
        </View>

        {/* ── NOTIFICATIONS ── */}
        <SectionHeader title="NOTIFICATIONS" />
        <View style={styles.section}>
          <SettingsRow
            label="Deadline alerts"
            isFirst
            control={
              <Switch
                value={!!settings.notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: Colors.bgElevated, true: Colors.safeGreen }}
                thumbColor={Colors.textPrimary}
              />
            }
            hideChevron
          />
          {settings.notificationsEnabled && (
            <>
              <SettingsRow
                label="Warn me ... days before"
                value={`${settings.notificationDaysAhead ?? 60} days`}
                onPress={handleDaysAhead}
              />
              <SettingsRow
                label="Send test alert"
                onPress={handleTestNotification}
              />
              <SettingsRow
                label="Hide card details in alerts"
                control={
                  <Switch
                    value={!!settings.privateNotifications}
                    onValueChange={async (enabled) => {
                      updateSettings({ privateNotifications: enabled });
                      if (settings.notificationsEnabled) {
                        await scheduleAllNotifications(cards, { ...settings, privateNotifications: enabled });
                      }
                    }}
                    trackColor={{ false: Colors.bgElevated, true: Colors.safeGreen }}
                    thumbColor={Colors.textPrimary}
                  />
                }
                hideChevron
              />
            </>
          )}
          <SettingsRow
            label="Sync to Apple Calendar"
            isLast
            control={
              <Switch
                value={!!settings.calendarSyncEnabled}
                onValueChange={handleCalendarToggle}
                trackColor={{ false: Colors.bgElevated, true: Colors.safeGreen }}
                thumbColor={Colors.textPrimary}
              />
            }
            hideChevron
          />
        </View>

        {/* ── DATA MANAGEMENT ── */}
        <SectionHeader title="DATA MANAGEMENT" />
        <View style={styles.section}>
          <SettingsRow
            label="Export data"
            isFirst
            onPress={handleExport}
          />
          <SettingsRow
            label="Import from backup"
            onPress={handleImport}
          />
          <SettingsRow
            label="Reset cards"
            labelColor={Colors.warningAmber}
            onPress={handleResetCards}
          />
          <SettingsRow
            label="Factory reset"
            labelColor={Colors.urgentRed}
            onPress={handleFactoryReset}
          />
          <SettingsRow
            label="Start fresh (blank)"
            labelColor={Colors.urgentRed}
            isLast
            onPress={handleStartFresh}
          />
        </View>

        {/* ── ABOUT ── */}
        <SectionHeader title="ABOUT" />
        <View style={styles.section}>
          <SettingsRow
            label="Version"
            value={VERSION}
            isFirst
          />
          <SettingsRow
            label="Build"
            value={BUILD}
          />
          <SettingsRow
            label="Built with"
            value="Claude + Expo + React Native"
          />
          <SettingsRow
            label="If you uninstall PayOff..."
            labelColor={Colors.textSecondary}
            isLast
            onPress={() => Alert.alert(
              'Data lives on this device',
              'PayOff stores everything locally — no cloud backup. If you delete the app, all your cards, balances, and settings will be permanently deleted.\n\nExport a backup first if you plan to reinstall.'
            )}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Toast ── */}
      {toastMsg && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  navBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  navTitle: {
    ...Typography.screenTitle,
    color: Colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // Section header (iOS style)
  sectionHeader: {
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 8,
    paddingLeft: 20,
  },

  // Section card wrapper
  section: {
    marginHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
  },

  // Individual row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.bgCard,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    maxWidth: '55%',
  },
  rowValue: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textSecondary,
    marginLeft: 2,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(48,209,88,0.92)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});

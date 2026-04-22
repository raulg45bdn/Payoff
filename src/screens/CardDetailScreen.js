import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import {
  getUrgencyGradient,
  getUrgencyLabel,
  isOnTrack,
  getProjectedPayoffMonth,
  getEstimatedInterest,
  formatCurrency,
  formatMonth,
} from '../utils/calculations';
import EditModal from '../components/EditModal';
import EditCardModal from '../components/EditCardModal';
import ProgressBar from '../components/ProgressBar';
import { Colors, Typography } from '../theme';

export default function CardDetailScreen({ route, navigation }) {
  const { cardId } = route.params;
  const { cards, updateCard, removeCard } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editCardVisible, setEditCardVisible] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);

  function saveCard(updated) {
    updateCard(updated);
    // AppContext.updateCard already calls scheduleAllNotifications with full cards+settings+bills context
  }

  function handleNotificationToggle(enabled) {
    saveCard({ ...card, notificationEnabled: enabled });
  }

  function handleModeChange(mode) {
    saveCard({ ...card, notificationMode: mode });
  }

  function handleDaysBefore() {
    Alert.prompt(
      'Days before expiration',
      'Enter how many days in advance to be reminded (1–180)',
      (text) => {
        if (text === null) return;
        const days = parseInt(text, 10);
        if (isNaN(days) || days < 1 || days > 180) {
          Alert.alert('Invalid value', 'Please enter a number between 1 and 180.');
          return;
        }
        saveCard({ ...card, notificationDaysBefore: days });
      },
      'plain-text',
      String(card.notificationDaysBefore ?? 60),
      'number-pad'
    );
  }

  function handleDateChange(_, selectedDate) {
    if (!selectedDate) return;
    saveCard({ ...card, notificationCustomDate: selectedDate.toISOString() });
  }

  function handleCustomMessage() {
    Alert.prompt(
      'Custom reminder message',
      'Enter a message for this notification (optional)',
      (text) => {
        if (text === null) return;
        saveCard({ ...card, notificationCustomMessage: text.trim() });
      },
      'plain-text',
      card.notificationCustomMessage ?? '',
    );
  }

  function handleMonthlyReminderToggle(enabled) {
    saveCard({ ...card, monthlyReminderEnabled: enabled });
  }

  function handleDelete() {
    Alert.alert(
      `Delete ${card?.name}?`,
      'This will remove the card and all its history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeCard(card.id);
            navigation.goBack();
          },
        },
      ]
    );
  }

  function handleMonthlyDaysBefore() {
    Alert.prompt(
      'Days before payment due',
      'Enter how many days before the due date to remind you (1–30)',
      (text) => {
        if (text === null) return;
        const days = parseInt(text, 10);
        if (isNaN(days) || days < 1 || days > 30) {
          Alert.alert('Invalid value', 'Please enter a number between 1 and 30.');
          return;
        }
        saveCard({ ...card, monthlyReminderDaysBefore: days });
      },
      'plain-text',
      String(card.monthlyReminderDaysBefore ?? 3),
      'number-pad'
    );
  }

  const card = cards.find(c => c.id === cardId);

  // Edge case: card not found
  if (!card) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'< Dashboard'}</Text>
        </TouchableOpacity>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Card not found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Use cached derived fields if available, otherwise compute on the fly
  const monthsRemaining = card.monthsRemaining ?? 0;
  const urgency = card.urgency ?? 'ontrack';
  const gradient = getUrgencyGradient(urgency);
  const urgencyLabel = getUrgencyLabel(urgency);
  const onTrack = isOnTrack(card.balance, monthsRemaining, card.monthlyPayment);
  const projectedPayoff = getProjectedPayoffMonth(card.balance, card.monthlyPayment, card.apr);
  const estimatedInterest = getEstimatedInterest(card.balance, card.apr, monthsRemaining);

  const progress = card.originalBalance > 0
    ? Math.max(0, Math.min(1, (card.originalBalance - card.balance) / card.originalBalance))
    : 1;

  const aprDisplay = card.apr === 0
    ? '0%'
    : `${(card.apr * 100).toFixed(2)}%`;

  const expiryDisplay = formatMonth(card.promoExpiration);

  const lastPaymentDisplay = card.lastPaymentDate && card.lastPaymentAmount
    ? `${formatCurrency(card.lastPaymentAmount)} on ${new Date(card.lastPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'None yet';

  const onTrackDisplay = card.balance === 0
    ? 'Paid off'
    : onTrack
    ? `Yes — ${projectedPayoff}`
    : `No — needs ${formatCurrency(Math.max(0, Math.ceil(card.balance / Math.max(1, monthsRemaining)) - card.monthlyPayment))}/mo more`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>{'< Dashboard'}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Card Hero (spec 3.3) ── */}
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {/* Card name + badge row */}
          <View style={styles.heroTopRow}>
            <Text style={styles.heroCardName}>{card.name.toUpperCase()}</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{urgencyLabel}</Text>
            </View>
          </View>

          {/* Balance */}
          <Text style={styles.heroBalance}>{formatCurrency(card.balance)}</Text>

          {/* Progress bar */}
          <ProgressBar progress={progress} height={4} style={styles.heroProgress} />

          {/* 3-column stat row */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>APR</Text>
              <Text style={styles.heroStatValue}>{aprDisplay}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Expires</Text>
              <Text style={styles.heroStatValue}>{expiryDisplay}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Mo. Left</Text>
              <Text style={styles.heroStatValue}>{monthsRemaining}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Detail Section 1: Payoff Info (spec 3.4) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PAYOFF INFO</Text>
          <Row
            label="Required payment"
            value={`${formatCurrency(card.monthlyPayment)}/mo`}
            valueColor={onTrack ? Colors.safeGreen : Colors.urgentRed}
          />
          <Row
            label="Last payment"
            value={lastPaymentDisplay}
            valueColor={Colors.textSecondary}
          />
          <Row
            label="On track to clear"
            value={onTrackDisplay}
            valueColor={card.balance === 0 ? Colors.safeGreen : onTrack ? Colors.safeGreen : Colors.urgentRed}
          />
          <Row
            label="Est. total interest"
            value={formatCurrency(estimatedInterest)}
            valueColor={Colors.textPrimary}
            last
          />
        </View>

        {/* ── Detail Section 2: Card Info (spec 3.5) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CARD INFO</Text>
          <Row
            label="Current balance"
            value={formatCurrency(card.balance)}
            valueColor={Colors.textPrimary}
          />
          <Row
            label="Due date"
            value={`Day ${card.dueDate} of each month`}
            valueColor={Colors.textSecondary}
          />
          <Row
            label="Pay status"
            value={card.payStatus}
            valueColor={card.payStatus === 'Paid' ? Colors.safeGreen : Colors.warningAmber}
          />
          <Row
            label="Notes"
            value={card.notes || '—'}
            valueColor={Colors.textSecondary}
            last
          />
        </View>

        {/* ── Promo Deadline Reminder ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PROMO DEADLINE REMINDER</Text>
          <View style={rowStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={rowStyles.label}>Remind me before expiration</Text>
              <Text style={[rowStyles.label, { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }]}>
                Fires X days before the promo end date
              </Text>
            </View>
            <Switch
              value={card.notificationEnabled !== false}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: Colors.bgElevated, true: Colors.safeGreen }}
              thumbColor={Colors.textPrimary}
            />
          </View>
          {card.notificationEnabled !== false && (
            <TouchableOpacity style={[rowStyles.row, rowStyles.lastRow]} onPress={handleDaysBefore}>
              <Text style={rowStyles.label}>Days before expiration</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[rowStyles.value, { textAlign: 'right' }]}>
                  {card.notificationDaysBefore ?? 60} days
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Custom Date Reminder ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CUSTOM DATE REMINDER</Text>
          <View style={rowStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={rowStyles.label}>Remind me on a specific date</Text>
              <Text style={[rowStyles.label, { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }]}>
                Set an exact date, time, and message
              </Text>
            </View>
            <Switch
              value={card.notificationMode === 'date'}
              onValueChange={v => handleModeChange(v ? 'date' : 'days')}
              trackColor={{ false: Colors.bgElevated, true: Colors.safeGreen }}
              thumbColor={Colors.textPrimary}
            />
          </View>
          {card.notificationMode === 'date' && (
            <>
              <TouchableOpacity style={rowStyles.row} onPress={() => setShowDatePicker(v => !v)}>
                <Text style={rowStyles.label}>Date & time</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[rowStyles.value, { textAlign: 'right', color: Colors.accentBlue }]}>
                    {card.notificationCustomDate
                      ? new Date(card.notificationCustomDate).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })
                      : 'Tap to set'}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={card.notificationCustomDate ? new Date(card.notificationCustomDate) : new Date()}
                  mode="datetime"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                  themeVariant="dark"
                />
              )}
              <TouchableOpacity style={[rowStyles.row, rowStyles.lastRow]} onPress={handleCustomMessage}>
                <Text style={rowStyles.label}>Message</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[rowStyles.value, { textAlign: 'right', maxWidth: 180 }]} numberOfLines={1}>
                    {card.notificationCustomMessage || 'Optional'}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Monthly Payment Reminder ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MONTHLY PAYMENT REMINDER</Text>
          <View style={rowStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={rowStyles.label}>Remind me before due date</Text>
              <Text style={[rowStyles.label, { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }]}>
                Due day {card.dueDate} of each month
              </Text>
            </View>
            <Switch
              value={!!card.monthlyReminderEnabled}
              onValueChange={handleMonthlyReminderToggle}
              trackColor={{ false: Colors.bgElevated, true: Colors.safeGreen }}
              thumbColor={Colors.textPrimary}
            />
          </View>
          {card.monthlyReminderEnabled && (
            <TouchableOpacity style={[rowStyles.row, rowStyles.lastRow]} onPress={handleMonthlyDaysBefore}>
              <Text style={rowStyles.label}>Days before due date</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[rowStyles.value, { textAlign: 'right' }]}>
                  {card.monthlyReminderDaysBefore ?? 3} days
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Update Balance Button (spec 3.6) ── */}
        <TouchableOpacity style={styles.updateBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.updateBtnText}>Update Balance</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editBtn} onPress={() => setEditCardVisible(true)} activeOpacity={0.85}>
          <Text style={styles.editBtnText}>Edit Card Details</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
          <Text style={styles.deleteBtnText}>Delete Card</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      <EditModal
        visible={modalVisible}
        card={card}
        onClose={() => setModalVisible(false)}
      />
      <EditCardModal
        visible={editCardVisible}
        card={card}
        onClose={() => setEditCardVisible(false)}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, valueColor, last }) {
  return (
    <View style={[rowStyles.row, last && rowStyles.lastRow]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, valueColor && { color: valueColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  label: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
  },
  value: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 17,
    color: Colors.accentBlue,
  },
  content: {
    paddingBottom: 20,
  },

  // Hero (spec 3.3)
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroCardName: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
    flex: 1,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroBalance: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  heroProgress: {
    marginBottom: 16,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 3,
  },
  heroStatValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // Detail sections (spec 3.4 / 3.5)
  section: {
    marginHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    paddingTop: 12,
    paddingBottom: 4,
  },

  chevron: {
    fontSize: 20,
    color: Colors.textSecondary,
  },


  // Update Balance button (spec 3.6)
  updateBtn: {
    marginHorizontal: 16,
    height: 52,
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  updateBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editBtn: {
    marginHorizontal: 16,
    height: 52,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  editBtnText: { fontSize: 17, fontWeight: '400', color: Colors.textPrimary },
  deleteBtn: {
    marginHorizontal: 16,
    height: 52,
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 17, fontWeight: '500', color: Colors.urgentRed },

  // Not-found fallback
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  notFoundText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
});

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
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../context/AppContext';
import { getCategoryColor, getCategoryIcon, effectiveAmount } from '../utils/billUtils';
import { formatCurrency } from '../utils/calculations';
import UpdateBillModal from '../components/UpdateBillModal';
import EditBillModal from '../components/EditBillModal';
import { Colors, Typography } from '../theme';

export default function BillDetailScreen({ route, navigation }) {
  const { billId } = route.params;
  const { bills, updateBill, removeBill } = useApp();
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  function saveBill(updated) {
    updateBill(updated);
    // AppContext.updateBill already calls scheduleAllNotifications with full cards+settings+bills context
  }

  function handleCustomReminderToggle(enabled) {
    saveBill({ ...bill, customReminderEnabled: enabled });
  }

  function handleDateChange(_, selectedDate) {
    if (!selectedDate) return;
    saveBill({ ...bill, customReminderDate: selectedDate.toISOString() });
  }

  function handleDueDateDaysBefore() {
    Alert.prompt(
      'Days before due date',
      'Enter how many days before the due date to remind you (1–30)',
      (text) => {
        if (text === null) return;
        const days = parseInt(text, 10);
        if (isNaN(days) || days < 1 || days > 30) {
          Alert.alert('Invalid value', 'Please enter a number between 1 and 30.');
          return;
        }
        saveBill({ ...bill, notificationDaysBefore: days });
      },
      'plain-text',
      String(bill.notificationDaysBefore ?? 3),
      'number-pad'
    );
  }

  function handleCustomMessage() {
    Alert.prompt(
      'Custom reminder message',
      'Enter a message for this notification (optional)',
      (text) => {
        if (text === null) return;
        saveBill({ ...bill, customReminderMessage: text.trim() });
      },
      'plain-text',
      bill.customReminderMessage ?? '',
    );
  }

  const bill = bills.find(b => b.id === billId);

  if (!bill) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Bill not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryColor = getCategoryColor(bill.category);
  const categoryIcon = getCategoryIcon(bill.category);
  const amount = effectiveAmount(bill);
  const isPaid = bill.payStatus === 'Paid';

  const lastPaymentDisplay = bill.lastPaymentDate && bill.lastPaymentAmount
    ? `${formatCurrency(bill.lastPaymentAmount)} on ${new Date(bill.lastPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'None yet';

  function handleMarkPaid() {
    if (isPaid) {
      updateBill({ ...bill, payStatus: 'Pending' });
    } else {
      setUpdateModalVisible(true);
    }
  }

  function handleDelete() {
    Alert.alert(
      `Delete ${bill.name}?`,
      'This will remove the bill and all its history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeBill(bill.id);
            navigation.goBack();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>{'< Back'}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={[styles.hero, { backgroundColor: categoryColor + '22', borderColor: categoryColor + '55' }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '33' }]}>
              <Text style={styles.categoryIcon}>{categoryIcon}</Text>
              <Text style={[styles.categoryLabel, { color: categoryColor }]}>{bill.category}</Text>
            </View>
            {isPaid && (
              <View style={styles.paidBadge}>
                <Text style={styles.paidBadgeText}>✓ PAID</Text>
              </View>
            )}
            {bill.isVariable && (
              <View style={styles.variableBadge}>
                <Text style={styles.variableBadgeText}>VARIABLE</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroName}>{bill.name}</Text>
          <Text style={[styles.heroAmount, { color: isPaid ? Colors.safeGreen : Colors.textPrimary }]}>
            {formatCurrency(amount)}
          </Text>
          {bill.isVariable && bill.variableAmountThisMonth != null && (
            <Text style={styles.heroBase}>Base: {formatCurrency(bill.amount)}/mo</Text>
          )}
        </View>

        {/* ── Payment Info ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PAYMENT INFO</Text>
          <Row label="Amount due" value={formatCurrency(amount)} />
          <Row
            label="Due date"
            value={`Day ${bill.dueDate} of each month`}
            valueColor={Colors.textSecondary}
          />
          <Row
            label="Pay status"
            value={bill.payStatus}
            valueColor={isPaid ? Colors.safeGreen : Colors.warningAmber}
          />
          <Row
            label="Last payment"
            value={lastPaymentDisplay}
            valueColor={Colors.textSecondary}
            last
          />
        </View>

        {/* ── Bill Info ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>BILL INFO</Text>
          <Row label="Category" value={`${categoryIcon}  ${bill.category}`} />
          <Row
            label="Type"
            value={bill.isVariable ? 'Variable (amount changes monthly)' : 'Fixed amount'}
            valueColor={Colors.textSecondary}
            last
          />
        </View>

        {/* ── Due Date Reminder ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>DUE DATE REMINDER</Text>
          <View style={rowStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={rowStyles.label}>Remind me before due date</Text>
              <Text style={[rowStyles.label, { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }]}>
                Due day {bill.dueDate} of each month
              </Text>
            </View>
            <Switch
              value={!!bill.notificationEnabled}
              onValueChange={v => saveBill({ ...bill, notificationEnabled: v })}
              trackColor={{ false: Colors.bgElevated, true: Colors.safeGreen }}
              thumbColor={Colors.textPrimary}
            />
          </View>
          {bill.notificationEnabled && (
            <TouchableOpacity style={[rowStyles.row, rowStyles.lastRow]} onPress={handleDueDateDaysBefore}>
              <Text style={rowStyles.label}>Days before due date</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={rowStyles.value}>{bill.notificationDaysBefore ?? 3} days</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Payment History ── */}
        {bill.paymentHistory?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>PAYMENT HISTORY</Text>
            {[...bill.paymentHistory].reverse().slice(0, 12).map((entry, i, arr) => (
              <Row
                key={entry.id ?? i}
                label={new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                value={formatCurrency(entry.amount)}
                valueColor={Colors.safeGreen}
                last={i === arr.length - 1}
              />
            ))}
          </View>
        )}

        {/* ── Custom Date Reminder ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CUSTOM DATE REMINDER</Text>
          <View style={rowStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={rowStyles.label}>Remind me on a specific date</Text>
              <Text style={[rowStyles.label, { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }]}>
                One-time alert with a custom message
              </Text>
            </View>
            <Switch
              value={!!bill.customReminderEnabled}
              onValueChange={handleCustomReminderToggle}
              trackColor={{ false: Colors.bgElevated, true: Colors.safeGreen }}
              thumbColor={Colors.textPrimary}
            />
          </View>
          {bill.customReminderEnabled && (
            <>
              <TouchableOpacity style={rowStyles.row} onPress={() => setShowDatePicker(v => !v)}>
                <Text style={rowStyles.label}>Date & time</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[rowStyles.value, { color: Colors.accentBlue }]}>
                    {bill.customReminderDate
                      ? new Date(bill.customReminderDate).toLocaleString('en-US', {
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
                  value={bill.customReminderDate ? new Date(bill.customReminderDate) : new Date()}
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
                  <Text style={[rowStyles.value, { maxWidth: 180 }]} numberOfLines={1}>
                    {bill.customReminderMessage || 'Optional'}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Buttons ── */}
        <TouchableOpacity
          style={[styles.primaryBtn, isPaid && styles.primaryBtnPaid]}
          onPress={handleMarkPaid}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {isPaid ? 'Mark as Unpaid' : 'Mark as Paid'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => setEditModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>Edit Bill</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.85}
        >
          <Text style={styles.deleteBtnText}>Delete Bill</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      <UpdateBillModal
        visible={updateModalVisible}
        bill={bill}
        onClose={() => setUpdateModalVisible(false)}
      />
      <EditBillModal
        visible={editModalVisible}
        bill={bill}
        onClose={() => setEditModalVisible(false)}
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
  lastRow: { borderBottomWidth: 0 },
  label: { ...Typography.body, color: Colors.textSecondary, flex: 1 },
  value: { ...Typography.body, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgPrimary },
  backBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  backText: { fontSize: 17, color: Colors.accentBlue },
  content: { paddingBottom: 20 },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { ...Typography.body, color: Colors.textSecondary },

  // Hero
  hero: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  categoryIcon: { fontSize: 14 },
  categoryLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  paidBadge: {
    backgroundColor: 'rgba(48,209,88,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paidBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.safeGreen, letterSpacing: 0.3 },
  variableBadge: {
    backgroundColor: 'rgba(255,159,10,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  variableBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.warningAmber, letterSpacing: 0.3 },
  heroName: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  heroAmount: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  heroBase: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

  // Sections
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

  chevron: { fontSize: 20, color: Colors.textSecondary },

  // Buttons
  primaryBtn: {
    marginHorizontal: 16,
    height: 52,
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  primaryBtnPaid: { backgroundColor: Colors.bgCard },
  primaryBtnText: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  secondaryBtn: {
    marginHorizontal: 16,
    height: 52,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryBtnText: { fontSize: 17, fontWeight: '400', color: Colors.textPrimary },
  deleteBtn: {
    marginHorizontal: 16,
    height: 52,
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 17, fontWeight: '500', color: Colors.urgentRed },
});

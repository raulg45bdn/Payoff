import { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import {
  getMonthEndCash,
  getMonthlySurplus,
  getTotalMonthlyPayment,
  formatCurrency,
} from '../utils/calculations';
import ExtraPaymentPlanner from '../components/ExtraPaymentPlanner';
import { Colors, Typography } from '../theme';

export default function StrategyScreen({ navigation }) {
  const { cards, bills, settings, updateSettings } = useApp();

  // ── Local slider / override state (applied on Recalculate) ──────────────────
  const [extraPool, setExtraPool] = useState(settings.extraPaymentPool ?? 0);
  const [overrides, setOverrides] = useState(settings.cardOverrides ?? {});

  // Keep local state in sync if settings change from outside (e.g. reset)
  useEffect(() => {
    setExtraPool(settings.extraPaymentPool ?? 0);
    setOverrides(settings.cardOverrides ?? {});
  }, [settings.extraPaymentPool, settings.cardOverrides]);

  // ── Cash position inline edit ───────────────────────────────────────────────
  const [editingField, setEditingField] = useState(null); // 'checking' | 'savings' | 'income' | null
  const [editText, setEditText] = useState('');

  function handleBalanceTap(field) {
    let current;
    if (field === 'checking') current = settings.checkingBalance ?? 0;
    else if (field === 'savings') current = settings.savingsBalance ?? 0;
    else current = settings.monthlyIncome ?? 0;
    setEditText(String(current));
    setEditingField(field);
  }

  function handleBalanceBlur(field) {
    const parsed = parseFloat(editText);
    if (!isNaN(parsed) && parsed >= 0) {
      const key = field === 'checking' ? 'checkingBalance'
        : field === 'savings' ? 'savingsBalance'
        : 'monthlyIncome';
      updateSettings({ [key]: parsed });
    }
    setEditingField(null);
  }

  // ── Warning banner dismiss ──────────────────────────────────────────────────
  const [warningDismissed, setWarningDismissed] = useState(false);

  // ── Toast ───────────────────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  function showToast(msg) {
    setToastMsg(msg);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setToastMsg(null));
  }

  // ── Derived cash flow numbers ───────────────────────────────────────────────
  const settingsWithPool = useMemo(
    () => ({ ...settings, extraPaymentPool: extraPool }),
    [settings, extraPool]
  );

  const fixedBillsTotal = useMemo(
    () => bills.reduce((sum, b) => sum + (b.variableAmountThisMonth ?? b.amount), 0),
    [bills]
  );

  const totalCardPayments = useMemo(() => getTotalMonthlyPayment(cards), [cards]);
  const surplus = useMemo(() => getMonthlySurplus(cards, settingsWithPool, bills), [cards, settingsWithPool, bills]);
  const monthEndCash = useMemo(() => getMonthEndCash(settingsWithPool, cards, bills), [settingsWithPool, cards, bills]);
  const totalLiquid = (settings.checkingBalance ?? 0) + (settings.savingsBalance ?? 0);

  // Warning banner condition
  const showWarning = !warningDismissed && monthEndCash < 200;
  const warningIsRed = monthEndCash < 0;

  // ── Subtitle ────────────────────────────────────────────────────────────────
  const subtitle = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // ── Recalculate ─────────────────────────────────────────────────────────────
  function handleRecalculate() {
    updateSettings({ extraPaymentPool: extraPool, cardOverrides: overrides });
    showToast('Plan applied. Dashboard updated.');
    setTimeout(() => navigation.navigate('Dashboard'), 600);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function monthEndCashColor() {
    if (monthEndCash < 0) return Colors.urgentRed;
    if (monthEndCash < 200) return Colors.warningAmber;
    return Colors.safeGreen;
  }

  function surplusColor() {
    return surplus >= 0 ? Colors.safeGreen : Colors.urgentRed;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Nav bar ── */}
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>Strategy</Text>
        <Text style={styles.navSubtitle}>{subtitle}</Text>
      </View>

      {/* ── 30-Day Warning Banner ── */}
      {showWarning && (
        <View style={[
          styles.warningBanner,
          warningIsRed
            ? { backgroundColor: 'rgba(255,69,58,0.15)', borderColor: Colors.urgentRed }
            : { backgroundColor: 'rgba(255,159,10,0.15)', borderColor: Colors.warningAmber },
        ]}>
          <Text style={styles.warningIcon}>⚠</Text>
          <Text style={[styles.warningText, { color: warningIsRed ? Colors.urgentRed : Colors.warningAmber }]}>
            {warningIsRed
              ? 'Running short this month. Reduce extra payments or check your expenses.'
              : 'Tight month ahead. You have less than $200 after all payments.'}
          </Text>
          <TouchableOpacity onPress={() => setWarningDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.warningDismiss, { color: warningIsRed ? Colors.urgentRed : Colors.warningAmber }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ────────────────────────────────────────────────────────────────
            CASH POSITION
        ──────────────────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Cash position</Text>
        <View style={styles.card}>
          {/* Checking */}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Checking</Text>
            {editingField === 'checking' ? (
              <TextInput
                style={styles.balanceInput}
                value={editText}
                onChangeText={setEditText}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                onBlur={() => handleBalanceBlur('checking')}
                onSubmitEditing={() => handleBalanceBlur('checking')}
                returnKeyType="done"
              />
            ) : (
              <TouchableOpacity onPress={() => handleBalanceTap('checking')}>
                <Text style={styles.balanceValue}>
                  {formatCurrency(settings.checkingBalance ?? 0)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Savings */}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Savings</Text>
            {editingField === 'savings' ? (
              <TextInput
                style={styles.balanceInput}
                value={editText}
                onChangeText={setEditText}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                onBlur={() => handleBalanceBlur('savings')}
                onSubmitEditing={() => handleBalanceBlur('savings')}
                returnKeyType="done"
              />
            ) : (
              <TouchableOpacity onPress={() => handleBalanceTap('savings')}>
                <Text style={styles.balanceValue}>
                  {formatCurrency(settings.savingsBalance ?? 0)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Total liquid */}
          <View style={[styles.balanceRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.balanceLabel, { color: Colors.textSecondary }]}>Total liquid</Text>
            <Text style={[styles.balanceValue, { color: Colors.safeGreen }]}>
              {formatCurrency(totalLiquid)}
            </Text>
          </View>
        </View>

        {/* ────────────────────────────────────────────────────────────────
            MONTHLY CASH FLOW
        ──────────────────────────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>This month</Text>
        <View style={styles.card}>
          {/* Income */}
          <View style={styles.flowRow}>
            <Text style={styles.flowLabel}>Monthly take-home</Text>
            {editingField === 'income' ? (
              <TextInput
                style={styles.balanceInput}
                value={editText}
                onChangeText={setEditText}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                onBlur={() => handleBalanceBlur('income')}
                onSubmitEditing={() => handleBalanceBlur('income')}
                returnKeyType="done"
              />
            ) : (
              <TouchableOpacity onPress={() => handleBalanceTap('income')}>
                <Text style={[styles.flowValue, { color: Colors.textPrimary, fontWeight: '600' }]}>
                  +{formatCurrency(settings.monthlyIncome ?? 0)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Fixed bills */}
          <View style={styles.flowRow}>
            <Text style={styles.flowLabel}>Fixed obligations</Text>
            <Text style={[styles.flowValue, { color: Colors.urgentRed }]}>
              -{formatCurrency(fixedBillsTotal)}
            </Text>
          </View>

          {/* Card payments */}
          <View style={styles.flowRow}>
            <Text style={styles.flowLabel}>Minimum card payments</Text>
            <Text style={[styles.flowValue, { color: Colors.urgentRed }]}>
              -{formatCurrency(totalCardPayments)}
            </Text>
          </View>

          {/* Extra payments */}
          {extraPool > 0 && (
            <View style={styles.flowRow}>
              <Text style={styles.flowLabel}>Extra this month</Text>
              <Text style={[styles.flowValue, { color: Colors.warningAmber }]}>
                -{formatCurrency(extraPool)}
              </Text>
            </View>
          )}

          {/* Divider */}
          <View style={styles.flowDivider} />

          {/* Surplus */}
          <View style={styles.flowRow}>
            <Text style={[styles.flowLabel, { fontWeight: '600', color: Colors.textPrimary }]}>Left over</Text>
            <Text style={[styles.flowValue, { fontWeight: '600', color: surplusColor() }]}>
              {surplus >= 0 ? '+' : ''}{formatCurrency(surplus)}
            </Text>
          </View>

          {/* Month-end cash */}
          <View style={[styles.flowRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.flowLabel, { fontWeight: '600', color: Colors.textPrimary }]}>Est. month-end cash</Text>
            <Text style={[styles.flowValue, { fontWeight: '700', fontSize: 16, color: monthEndCashColor() }]}>
              {formatCurrency(monthEndCash)}
            </Text>
          </View>
        </View>

        {/* ────────────────────────────────────────────────────────────────
            EXTRA PAYMENT PLANNER
        ──────────────────────────────────────────────────────────────── */}
        <View style={styles.plannerDivider} />
        <ExtraPaymentPlanner
          cards={cards}
          extraPool={extraPool}
          overrides={overrides}
          onExtraPoolChange={setExtraPool}
          onOverrideSet={(cardId, amount) => setOverrides(prev => ({ ...prev, [cardId]: amount }))}
          onOverrideClear={cardId => setOverrides(prev => {
            const next = { ...prev };
            delete next[cardId];
            return next;
          })}
        />

        {/* ── Recalculate button ── */}
        <TouchableOpacity
          style={styles.recalcBtn}
          onPress={handleRecalculate}
          activeOpacity={0.85}
        >
          <Text style={styles.recalcBtnText}>Apply This Month's Plan</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
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
  navSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // Warning banner
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  warningIcon: {
    fontSize: 16,
    color: Colors.warningAmber,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  warningDismiss: {
    fontSize: 16,
    fontWeight: '600',
    paddingLeft: 4,
  },

  // Section header
  sectionHeader: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },

  // Generic card shell
  card: {
    marginHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
  },

  // Cash position rows
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  balanceLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  balanceInput: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.accentBlue,
    minWidth: 90,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderBottomColor: Colors.accentBlue,
    paddingVertical: 2,
  },

  // Cash flow rows
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 8,
  },
  flowLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  flowValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  flowDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 4,
  },

  // Planner divider
  plannerDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
    marginBottom: 20,
  },

  // Recalculate button
  recalcBtn: {
    marginHorizontal: 16,
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  recalcBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
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

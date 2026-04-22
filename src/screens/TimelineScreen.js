import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import {
  sortCardsByUrgency,
  getUrgencyColor,
  getDebtFreeDate,
  getGanttData,
  getMonthlyDebtSimulation,
  formatCurrency,
} from '../utils/calculations';
import { getCategoryIcon, getCategoryColor, effectiveAmount } from '../utils/billUtils';
import GanttChart from '../components/GanttChart';
import MonthlySnapshot from '../components/MonthlySnapshot';
import { Colors, Typography } from '../theme';

export default function TimelineScreen({ navigation }) {
  const { cards, bills } = useApp();

  const sortedBills = useMemo(
    () => [...bills].sort((a, b) => a.dueDate - b.dueDate),
    [bills]
  );

  // ── Debt-free month for subtitle and chart end ──────────────────────────
  const debtFreeLabel = useMemo(() => getDebtFreeDate(cards), [cards]);

  // ── Chart date range ────────────────────────────────────────────────────
  const { startDate, endDate, monthKeys } = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);

    // End = latest promoExpiration among active cards, min 1 month ahead
    let maxExpiry = new Date(start);
    maxExpiry.setMonth(maxExpiry.getMonth() + 1);
    cards.forEach(c => {
      if (c.balance > 0) {
        const exp = new Date(c.promoExpiration);
        if (exp > maxExpiry) maxExpiry = exp;
      }
    });
    const end = new Date(maxExpiry.getFullYear(), maxExpiry.getMonth(), 1);

    // Build ordered monthKeys array
    const keys = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      keys.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { startDate: start, endDate: end, monthKeys: keys };
  }, [cards]);

  // ── Gantt data (memoized) ───────────────────────────────────────────────
  const ganttData = useMemo(
    () => getGanttData(sortCardsByUrgency(cards), startDate, endDate),
    [cards, startDate, endDate]
  );

  // ── Monthly debt simulation (memoized) ──────────────────────────────────
  const simulation = useMemo(
    () => getMonthlyDebtSimulation(cards),
    [cards]
  );

  // ── Starting debt for MonthlySnapshot progress bar ──────────────────────
  const startingDebt = useMemo(
    () => cards.reduce((sum, c) => sum + c.originalBalance, 0),
    [cards]
  );

  // ── Upcoming deadlines list (active cards sorted by soonest expiry) ──────
  const activeCards = useMemo(
    () => sortCardsByUrgency(cards).filter(c => c.balance > 0),
    [cards]
  );

  // ── Nav subtitle ────────────────────────────────────────────────────────
  const today = new Date();
  const startLabel = today.toLocaleString('default', { month: 'short', year: 'numeric' });
  const subtitle = `${startLabel} → ${debtFreeLabel}`;

  function handleCardPress(cardId) {
    navigation.navigate('CardDetail', { cardId });
  }

  const allPaid = cards.every(c => c.balance === 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Nav Bar */}
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>Timeline</Text>
        <Text style={styles.navSubtitle}>{subtitle}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Monthly Snapshot Strip ── */}
        <Text style={styles.sectionHeader}>Monthly balance</Text>
        <MonthlySnapshot simulation={simulation} startingDebt={startingDebt} />

        <View style={{ height: 20 }} />

        {/* ── Gantt Chart ── */}
        <Text style={styles.sectionHeader}>Payoff timeline</Text>
        <GanttChart
          ganttData={ganttData}
          months={monthKeys}
          onCardPress={handleCardPress}
        />

        {/* ── Upcoming Deadlines ── */}
        <View style={styles.deadlinesHeader}>
          <Text style={styles.sectionHeader}>Upcoming deadlines</Text>
          {activeCards.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activeCards.length}</Text>
            </View>
          )}
        </View>

        {allPaid ? (
          // All clear state (spec 6.3)
          <View style={styles.allClear}>
            <Text style={styles.allClearIcon}>✅</Text>
            <Text style={styles.allClearTitle}>All promos cleared!</Text>
            <Text style={styles.allClearSub}>No upcoming deadlines</Text>
          </View>
        ) : (
          activeCards.map(card => {
            const urgency = card.urgency ?? 'ontrack';
            const urgencyColor = getUrgencyColor(urgency);
            const monthsLeft = card.monthsRemaining ?? 0;
            const [_ey, _em, _ed] = (card.promoExpiration ?? '').split('-').map(Number);
            const expiryDate = new Date(_ey, _em - 1, _ed).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });

            return (
              <TouchableOpacity
                key={card.id}
                style={styles.deadlineRow}
                onPress={() => handleCardPress(card.id)}
                activeOpacity={0.75}
              >
                {/* Urgency dot */}
                <View style={[styles.deadlineDot, { backgroundColor: urgencyColor }]} />

                {/* Name + expiry */}
                <View style={styles.deadlineInfo}>
                  <Text style={styles.deadlineName}>{card.name}</Text>
                  <Text style={styles.deadlineExpiry}>Expires {expiryDate}</Text>
                </View>

                {/* Months + balance */}
                <View style={styles.deadlineRight}>
                  <Text style={[styles.deadlineMonths, { color: urgencyColor }]}>
                    {monthsLeft} month{monthsLeft !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.deadlineBalance}>
                    {formatCurrency(card.balance)} left
                  </Text>
                </View>

                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          })
        )}

        {/* ── Monthly Bills ── */}
        {sortedBills.length > 0 && (
          <>
            <View style={styles.deadlinesHeader}>
              <Text style={styles.sectionHeader}>Monthly bills</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{sortedBills.length}</Text>
              </View>
            </View>

            {sortedBills.map(bill => {
              const isPaid = bill.payStatus === 'Paid';
              const color = getCategoryColor(bill.category);
              const icon = getCategoryIcon(bill.category);
              const amount = effectiveAmount(bill);

              return (
                <TouchableOpacity
                  key={bill.id}
                  style={styles.deadlineRow}
                  onPress={() => navigation.navigate('BillDetail', { billId: bill.id })}
                  activeOpacity={0.75}
                >
                  <View style={[styles.deadlineDot, { backgroundColor: color }]} />
                  <Text style={styles.billIcon}>{icon}</Text>
                  <View style={styles.deadlineInfo}>
                    <Text style={[styles.deadlineName, isPaid && { color: Colors.textSecondary }]}>
                      {bill.name}
                    </Text>
                    <Text style={styles.deadlineExpiry}>
                      {isPaid ? 'Paid this month' : `Due day ${bill.dueDate}`}
                    </Text>
                  </View>
                  <View style={styles.deadlineRight}>
                    <Text style={[styles.deadlineMonths, { color: isPaid ? Colors.safeGreen : Colors.textPrimary }]}>
                      {isPaid ? '✓ Paid' : `$${amount.toLocaleString()}`}
                    </Text>
                    {bill.isVariable && !isPaid && (
                      <Text style={styles.deadlineBalance}>Variable</Text>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
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
  sectionHeader: {
    ...Typography.sectionHeader,
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  // Upcoming deadlines header row
  deadlinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  countBadge: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Deadline row (spec 6.2)
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  deadlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  deadlineInfo: {
    flex: 1,
  },
  deadlineName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  deadlineExpiry: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  deadlineRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  deadlineMonths: {
    fontSize: 15,
    fontWeight: '600',
  },
  deadlineBalance: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chevron: {
    fontSize: 18,
    color: Colors.textSecondary,
  },

  billIcon: {
    fontSize: 16,
  },

  // All clear (spec 6.3)
  allClear: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  allClearIcon: {
    fontSize: 48,
  },
  allClearTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.safeGreen,
  },
  allClearSub: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { getCategoryColor } from '../utils/billUtils';
import { formatCurrency } from '../utils/calculations';
import { Colors, Typography } from '../theme';

function monthKey(isoDate) {
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const { cards, bills } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(null); // null = show all

  const allEvents = useMemo(() => {
    const events = [];
    for (const card of cards) {
      for (const entry of card.paymentHistory ?? []) {
        events.push({
          id: entry.id ?? `${card.id}-${entry.date}`,
          date: entry.date,
          amount: entry.amount,
          name: card.name,
          type: 'card',
          accentColor: Colors.accentBlue,
        });
      }
    }
    for (const bill of bills) {
      for (const entry of bill.paymentHistory ?? []) {
        events.push({
          id: entry.id ?? `${bill.id}-${entry.date}`,
          date: entry.date,
          amount: entry.amount,
          name: bill.name,
          type: 'bill',
          accentColor: getCategoryColor(bill.category),
        });
      }
    }
    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [cards, bills]);

  // Last 6 calendar months
  const monthlyTotals = useMemo(() => {
    const totals = {};
    for (const e of allEvents) {
      const key = monthKey(e.date);
      totals[key] = (totals[key] ?? 0) + e.amount;
    }
    const result = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push({
        key,
        label: d.toLocaleString('default', { month: 'short' }),
        total: totals[key] ?? 0,
      });
    }
    return result;
  }, [allEvents]);

  const maxTotal = Math.max(...monthlyTotals.map(m => m.total), 1);

  const visibleEvents = selectedMonth
    ? allEvents.filter(e => monthKey(e.date) === selectedMonth)
    : allEvents;

  const totalPaid = allEvents.reduce((sum, e) => sum + e.amount, 0);
  const paymentCount = allEvents.length;

  const selectedLabel = selectedMonth
    ? monthlyTotals.find(m => m.key === selectedMonth)?.label ?? selectedMonth
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>History</Text>
        {selectedLabel ? (
          <TouchableOpacity style={styles.filterBadge} onPress={() => setSelectedMonth(null)}>
            <Text style={styles.filterBadgeText}>{selectedLabel}  ✕</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.navSubtitle}>All payments</Text>
        )}
      </View>

      <FlatList
        data={visibleEvents}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Summary row — always shows totals across all time */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{formatCurrency(totalPaid)}</Text>
                <Text style={styles.summaryLabel}>Total paid</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{paymentCount}</Text>
                <Text style={styles.summaryLabel}>Payments</Text>
              </View>
            </View>

            {/* Bar chart — tap a bar to filter */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>
                Last 6 months{selectedLabel ? ` · tap a bar to change filter` : ' · tap a bar to filter'}
              </Text>
              <View style={styles.bars}>
                {monthlyTotals.map(m => {
                  const heightPct = m.total / maxTotal;
                  const isSelected = selectedMonth === m.key;
                  const hasData = m.total > 0;

                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={styles.barCol}
                      onPress={() => setSelectedMonth(isSelected ? null : m.key)}
                      activeOpacity={0.7}
                      disabled={!hasData}
                    >
                      <Text style={styles.barAmount}>
                        {hasData
                          ? (m.total >= 1000 ? `$${(m.total / 1000).toFixed(1)}k` : `$${Math.round(m.total)}`)
                          : ''}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[
                          styles.barFill,
                          { height: `${Math.max(heightPct * 100, hasData ? 4 : 0)}%` },
                          isSelected && styles.barFillSelected,
                          !hasData && styles.barFillEmpty,
                        ]} />
                      </View>
                      <Text style={[styles.barLabel, isSelected && { color: Colors.accentBlue, fontWeight: '600' }]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {visibleEvents.length > 0 && (
              <Text style={styles.sectionHeader}>
                {selectedLabel ? `${selectedLabel} payments` : 'Recent payments'}
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.eventRow}>
            <View style={[styles.eventDot, { backgroundColor: item.accentColor }]} />
            <View style={styles.eventInfo}>
              <Text style={styles.eventName}>{item.name}</Text>
              <Text style={styles.eventDate}>
                {new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </Text>
            </View>
            <Text style={styles.eventAmount}>{formatCurrency(item.amount)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {selectedMonth ? 'No payments in this month.' : 'No payments recorded yet.'}
            </Text>
            <Text style={styles.emptyHint}>
              {selectedMonth
                ? 'Tap the bar again or the filter badge to clear.'
                : 'Payments appear here when you mark cards or bills as paid.'}
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgPrimary },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  navTitle: { ...Typography.screenTitle, color: Colors.textPrimary },
  navSubtitle: { ...Typography.caption, color: Colors.textSecondary },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  filterBadgeText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  listContent: { paddingBottom: 20 },

  summaryRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.bgCard,
    borderRadius: 16, padding: 16, alignItems: 'center',
  },
  summaryValue: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },

  chartCard: {
    marginHorizontal: 16, backgroundColor: Colors.bgCard,
    borderRadius: 16, padding: 16, marginBottom: 20,
  },
  chartTitle: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barAmount: { fontSize: 9, color: Colors.textSecondary, marginBottom: 2 },
  barTrack: {
    width: '70%', height: 90,
    justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: Colors.accentBlue, borderRadius: 4 },
  barFillSelected: { backgroundColor: Colors.safeGreen },
  barFillEmpty: { backgroundColor: Colors.bgElevated },
  barLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },

  sectionHeader: {
    fontSize: 13, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginHorizontal: 16, marginBottom: 8,
  },

  eventRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventInfo: { flex: 1 },
  eventName: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  eventDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  eventAmount: { fontSize: 15, fontWeight: '600', color: Colors.safeGreen },

  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32, gap: 8 },
  emptyText: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  sortCardsByUrgency,
  getOverallProgress,
} from '../utils/calculations';
import { getCategoryIcon, getCategoryColor, effectiveAmount } from '../utils/billUtils';
import AlertBanner from '../components/AlertBanner';
import HeroCard from '../components/HeroCard';
import ProgressBar from '../components/ProgressBar';
import DebtCard from '../components/DebtCard';
import AddCardModal from '../components/AddCardModal';
import AddBillModal from '../components/AddBillModal';
import { Colors, Typography } from '../theme';

const VIEW_MODES = ['list', 'grid', 'compact'];
const VIEW_ICONS  = { list: '☰', grid: '⊞', compact: '≡' };

export default function DashboardScreen({ navigation }) {
  const { cards, bills, settings, updateSettings } = useApp();
  const [addCardVisible, setAddCardVisible] = useState(false);
  const [addBillVisible, setAddBillVisible] = useState(false);
  const sortedCards = sortCardsByUrgency(cards);
  const overallProgress = getOverallProgress(cards);
  const viewMode = settings.dashboardBillsViewMode ?? 'list';

  const now = new Date();
  const monthYear = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  const initials = (() => {
    const name = (settings.userName ?? '').trim();
    if (!name) return 'AL';
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  const sortedBills = [...bills].sort((a, b) => {
    if (a.payStatus === 'Paid' && b.payStatus !== 'Paid') return 1;
    if (b.payStatus === 'Paid' && a.payStatus !== 'Paid') return -1;
    return a.dueDate - b.dueDate;
  });

  const paidCount = bills.filter(b => b.payStatus === 'Paid').length;
  const billsCollapsed = settings.billsSectionCollapsed ?? false;

  function cycleViewMode() {
    const next = VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length];
    updateSettings({ dashboardBillsViewMode: next });
  }

  function toggleCollapse() {
    updateSettings({ billsSectionCollapsed: !billsCollapsed });
  }

  function navToBill(billId) {
    navigation.navigate('BillDetail', { billId });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgPrimary} />

      {/* Nav Bar */}
      <View style={styles.navBar}>
        <View>
          <Text style={styles.navTitle}>PayOff</Text>
          <Text style={styles.navSubtitle}>{monthYear}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      <FlatList
        data={sortedCards}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: card }) => (
          <DebtCard
            card={card}
            onPress={() => navigation.navigate('CardDetail', { cardId: card.id })}
          />
        )}
        ListHeaderComponent={
          <>
            <AlertBanner cards={cards} />
            <HeroCard cards={cards} />

            {/* Overall Progress */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Overall Progress</Text>
                <Text style={styles.progressPct}>{Math.round(overallProgress * 100)}% paid</Text>
              </View>
              <ProgressBar progress={overallProgress} height={6} />
            </View>

            {/* Bills Section */}
            <View style={styles.billsSection}>
              <View style={styles.billsSectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Monthly bills</Text>
                  {bills.length > 0 && <Text style={styles.billsSummary}>{paidCount}/{bills.length} paid</Text>}
                </View>
                <View style={styles.billsHeaderRight}>
                  {!billsCollapsed && bills.length > 0 && (
                    <TouchableOpacity style={styles.viewModeBtn} onPress={cycleViewMode}>
                      <Text style={styles.viewModeIcon}>{VIEW_ICONS[viewMode]}</Text>
                      <Text style={styles.viewModeLabel}>{viewMode}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.addBtn} onPress={() => setAddBillVisible(true)}>
                    <Text style={styles.addBtnText}>+</Text>
                  </TouchableOpacity>
                  {bills.length > 0 && (
                    <TouchableOpacity style={styles.collapseBtn} onPress={toggleCollapse}>
                      <Text style={styles.collapseIcon}>{billsCollapsed ? '▶' : '▼'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {bills.length === 0 ? (
                <TouchableOpacity style={styles.emptyState} onPress={() => setAddBillVisible(true)}>
                  <Text style={styles.emptyStateText}>No bills yet — tap + to add one</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {!billsCollapsed && viewMode === 'list' && (
                    <View style={styles.billsList}>
                      {sortedBills.map(bill => (
                        <BillRowList key={bill.id} bill={bill} onPress={() => navToBill(bill.id)} />
                      ))}
                    </View>
                  )}
                  {!billsCollapsed && viewMode === 'grid' && (
                    <View style={styles.billsGrid}>
                      {sortedBills.map(bill => (
                        <BillCardGrid key={bill.id} bill={bill} onPress={() => navToBill(bill.id)} />
                      ))}
                    </View>
                  )}
                  {!billsCollapsed && viewMode === 'compact' && (
                    <View style={styles.billsCompact}>
                      {sortedBills.map(bill => (
                        <BillRowCompact key={bill.id} bill={bill} onPress={() => navToBill(bill.id)} />
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Cards Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your cards</Text>
              <TouchableOpacity onPress={() => setAddCardVisible(true)}>
                <Text style={styles.addCardBtn}>+ Add Card</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <TouchableOpacity style={styles.emptyCardsState} onPress={() => setAddCardVisible(true)}>
            <Text style={styles.emptyCardsText}>No cards yet</Text>
            <Text style={styles.emptyCardsHint}>Tap to add your first 0% promo card</Text>
          </TouchableOpacity>
        }
        ListFooterComponent={<View style={{ height: 24 }} />}
      />

      <AddCardModal visible={addCardVisible} onClose={() => setAddCardVisible(false)} />
      <AddBillModal visible={addBillVisible} onClose={() => setAddBillVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Bill row components ───────────────────────────────────────────────────────

function BillRowList({ bill, onPress }) {
  const isPaid = bill.payStatus === 'Paid';
  const color = getCategoryColor(bill.category);
  const icon = getCategoryIcon(bill.category);
  const amount = effectiveAmount(bill);

  return (
    <TouchableOpacity style={styles.billRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.billDot, { backgroundColor: color }]} />
      <Text style={styles.billIcon}>{icon}</Text>
      <View style={styles.billNameCol}>
        <Text style={[styles.billName, isPaid && styles.billNamePaid]}>{bill.name}</Text>
        <Text style={styles.billDue}>
          {isPaid ? 'Paid this month' : `Due day ${bill.dueDate}`}
          {bill.isVariable && !isPaid && ' · Variable'}
        </Text>
      </View>
      <Text style={[styles.billAmount, isPaid && { color: Colors.safeGreen }]}>
        {isPaid ? '✓ ' : ''}${amount.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
}

function BillCardGrid({ bill, onPress }) {
  const isPaid = bill.payStatus === 'Paid';
  const color = getCategoryColor(bill.category);
  const icon = getCategoryIcon(bill.category);
  const amount = effectiveAmount(bill);

  return (
    <TouchableOpacity
      style={[styles.gridCard, { borderColor: color + '44' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.gridIcon}>{icon}</Text>
      <Text style={[styles.gridName, isPaid && { color: Colors.textSecondary }]} numberOfLines={1}>
        {bill.name}
      </Text>
      <Text style={[styles.gridAmount, { color: isPaid ? Colors.safeGreen : Colors.textPrimary }]}>
        {isPaid ? '✓' : `$${amount.toLocaleString()}`}
      </Text>
      {bill.isVariable && !isPaid && (
        <Text style={styles.gridVariableBadge}>VAR</Text>
      )}
    </TouchableOpacity>
  );
}

function BillRowCompact({ bill, onPress }) {
  const isPaid = bill.payStatus === 'Paid';
  const color = getCategoryColor(bill.category);
  const amount = effectiveAmount(bill);

  return (
    <TouchableOpacity style={styles.compactRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.compactDot, { backgroundColor: color }]} />
      <Text style={[styles.compactName, isPaid && { color: Colors.textSecondary }]} numberOfLines={1}>
        {bill.name}
      </Text>
      <Text style={[styles.compactAmount, isPaid && { color: Colors.safeGreen }]}>
        {isPaid ? '✓' : `$${amount.toLocaleString()}`}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgPrimary },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  navTitle: { ...Typography.screenTitle, color: Colors.textPrimary },
  navSubtitle: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accentBlue,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...Typography.body, color: Colors.textPrimary, fontWeight: '700' },
  scrollContent: { paddingBottom: 20 },

  progressSection: { marginHorizontal: 16, marginBottom: 20 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { ...Typography.caption, color: Colors.textSecondary },
  progressPct: { ...Typography.caption, color: Colors.safeGreen, fontWeight: '600' },

  // Bills section wrapper
  billsSection: { marginHorizontal: 16, marginBottom: 20 },
  billsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  billsSummary: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  billsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bgCard,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  viewModeIcon: { fontSize: 14, color: Colors.accentBlue },
  viewModeLabel: { fontSize: 12, color: Colors.textSecondary, textTransform: 'capitalize' },
  collapseBtn: {
    backgroundColor: Colors.bgCard,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  collapseIcon: { fontSize: 11, color: Colors.textSecondary },

  // List view
  billsList: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  billDot: { width: 3, height: 36, borderRadius: 2 },
  billIcon: { fontSize: 18 },
  billNameCol: { flex: 1 },
  billName: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  billNamePaid: { color: Colors.textSecondary },
  billDue: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  billAmount: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },

  // Grid view
  billsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCard: {
    width: '47%',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  gridIcon: { fontSize: 22, marginBottom: 2 },
  gridName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  gridAmount: { fontSize: 16, fontWeight: '700' },
  gridVariableBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.warningAmber,
    letterSpacing: 0.3,
  },

  // Compact view
  billsCompact: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  compactDot: { width: 6, height: 6, borderRadius: 3 },
  compactName: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  compactAmount: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { ...Typography.sectionHeader, color: Colors.textPrimary },
  addCardBtn: { fontSize: 15, color: Colors.accentBlue, fontWeight: '600' },

  // Add button in bills header
  addBtn: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 20, color: Colors.textPrimary, lineHeight: 26 },

  // Empty states
  emptyState: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyStateText: { fontSize: 14, color: Colors.textSecondary },
  emptyCardsState: {
    marginHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 6,
  },
  emptyCardsText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  emptyCardsHint: { fontSize: 13, color: Colors.textSecondary },
});

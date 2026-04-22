import { View, Text, StyleSheet } from 'react-native';
import {
  getTotalDebt,
  getTotalMonthlyPayment,
  getTotalInterest,
  getDebtFreeDate,
  formatCurrency,
} from '../utils/calculations';
import { Colors, Typography } from '../theme';

export default function HeroCard({ cards }) {
  const totalBalance = getTotalDebt(cards);
  const monthlyPayment = getTotalMonthlyPayment(cards);
  const totalInterest = getTotalInterest(cards);
  const debtFreeDate = getDebtFreeDate(cards);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>TOTAL REMAINING</Text>
      <Text style={styles.heroAmount}>{formatCurrency(totalBalance)}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Monthly Payment</Text>
          <Text style={styles.statValue}>{formatCurrency(monthlyPayment)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Est. Interest</Text>
          <Text style={styles.statValue}>{formatCurrency(totalInterest)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Debt-Free</Text>
          <Text style={styles.statValue}>{debtFreeDate}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: Colors.accentBlue,
    paddingVertical: 24,
    paddingHorizontal: 24,
    shadowColor: Colors.accentBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  label: {
    ...Typography.micro,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroAmount: {
    ...Typography.heroAmount,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    ...Typography.tiny,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 3,
    textAlign: 'center',
  },
  statValue: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});

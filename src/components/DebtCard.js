import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  getUrgencyColor,
  getUrgencyLabel,
  formatCurrency,
} from '../utils/calculations';
import UrgencyDot from './UrgencyDot';
import ProgressBar from './ProgressBar';
import { Colors, Typography } from '../theme';

export default function DebtCard({ card, onPress }) {
  // Use cached derived fields from AppContext (set by computeDerivedFields on every update)
  const urgency = card.urgency ?? 'ontrack';
  const monthsLeft = card.monthsRemaining ?? 0;
  const onTrack = card.onTrack ?? true;

  const urgencyColor = getUrgencyColor(urgency);
  const urgencyLabel = getUrgencyLabel(urgency);

  const progress = card.originalBalance > 0
    ? Math.max(0, Math.min(1, (card.originalBalance - card.balance) / card.originalBalance))
    : 1;

  const [_ey, _em, _ed] = (card.promoExpiration ?? '').split('-').map(Number);
  const expiryDate = new Date(_ey, _em - 1, _ed).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Top row: dot + name + badge */}
      <View style={styles.topRow}>
        <UrgencyDot urgency={urgency} />
        <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>
        <View style={[styles.badge, { backgroundColor: urgencyColor + '33' }]}>
          <Text style={[styles.badgeText, { color: urgencyColor }]}>{urgencyLabel}</Text>
        </View>
      </View>

      {/* Balance */}
      <Text style={styles.balance}>{formatCurrency(card.balance)}</Text>

      {/* Progress bar */}
      <ProgressBar progress={progress} height={4} style={styles.progressBar} />

      {/* Bottom row: expiry | months left | on-track */}
      <View style={styles.bottomRow}>
        <Text style={styles.caption}>Expires {expiryDate}</Text>
        <Text style={[styles.caption, { color: urgencyColor }]}>
          {card.balance === 0 ? 'Paid off' : `${monthsLeft}mo left`}
        </Text>
        <Text style={[styles.caption, { color: onTrack ? Colors.safeGreen : Colors.urgentRed }]}>
          {card.balance === 0 ? '' : onTrack ? 'On track' : 'Behind'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardName: {
    ...Typography.cardName,
    color: Colors.textPrimary,
    flex: 1,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    ...Typography.micro,
    letterSpacing: 0.5,
  },
  balance: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  progressBar: {
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  caption: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
});

import { useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../theme';
import { formatCompact } from '../utils/calculations';

const CARD_WIDTH = 72;
const CARD_HEIGHT = 80;
const CARD_GAP = 8;

/**
 * Horizontal strip showing simulated total debt remaining each month.
 * @param {object[]} simulation  - from getMonthlyDebtSimulation()
 * @param {number}   startingDebt - original total debt for proportional bar
 */
export default function MonthlySnapshot({ simulation, startingDebt }) {
  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  if (!simulation || simulation.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_WIDTH + CARD_GAP}
      decelerationRate="fast"
      contentContainerStyle={styles.strip}
    >
      {simulation.map(({ monthKey, totalDebt, monthLabel }) => {
        const isCurrentMonth = monthKey === todayKey;

        // Progress bar width: proportion of debt remaining vs original
        const progressRatio = startingDebt > 0
          ? Math.max(0, Math.min(1, totalDebt / startingDebt))
          : 0;

        // Bar color: green when nearly done, amber in mid, red if still high
        const barColor = progressRatio < 0.25
          ? Colors.safeGreen
          : progressRatio < 0.6
          ? Colors.warningAmber
          : Colors.urgentRed;

        return (
          <View
            key={monthKey}
            style={[
              styles.card,
              isCurrentMonth && styles.cardCurrent,
            ]}
          >
            {/* Month label */}
            <Text style={styles.monthLabel}>{monthLabel}</Text>

            {/* Total debt */}
            <Text style={styles.debtAmount}>{formatCompact(totalDebt)}</Text>

            {/* Progress bar at bottom */}
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${progressRatio * 100}%`, backgroundColor: barColor },
                ]}
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: 16,
    gap: CARD_GAP,
    paddingBottom: 4,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 6,
  },
  cardCurrent: {
    borderWidth: 1,
    borderColor: Colors.accentBlue,
  },
  monthLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  debtAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  barTrack: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
});

import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { getUrgencyColor } from '../utils/calculations';
import { Colors } from '../theme';

// ─── Dimensions (spec 4.2) ───────────────────────────────────────────────────
const LABEL_WIDTH = 72;
const MONTH_WIDTH = 44;
const ROW_HEIGHT = 32;
const BAR_HEIGHT = 18;
const BAR_V_MARGIN = 7;
const HEADER_HEIGHT = 28;

// ─── Cell background + border per state (spec 4.4) ──────────────────────────
function getCellStyle(state, isDeadline, urgencyColor) {
  const base = {
    width: MONTH_WIDTH,
    height: ROW_HEIGHT,
    justifyContent: 'center',
    borderTopWidth: isDeadline ? 3 : 0,
    borderTopColor: isDeadline ? urgencyColor : 'transparent',
  };

  if (state === 'empty') {
    return { ...base, backgroundColor: 'transparent' };
  }
  if (state === 'completed' || state === 'paid') {
    return {
      ...base,
      backgroundColor: 'rgba(48,209,88,0.20)',
      borderWidth: 1,
      borderColor: 'rgba(48,209,88,0.40)',
      borderTopWidth: isDeadline ? 3 : 1,
      borderTopColor: isDeadline ? urgencyColor : 'rgba(48,209,88,0.40)',
    };
  }
  if (state === 'active-urgent') {
    return {
      ...base,
      backgroundColor: 'rgba(255,69,58,0.30)',
      borderWidth: 1,
      borderColor: 'rgba(255,69,58,0.55)',
      borderTopWidth: isDeadline ? 3 : 1,
      borderTopColor: isDeadline ? urgencyColor : 'rgba(255,69,58,0.55)',
    };
  }
  if (state === 'active-watch') {
    return {
      ...base,
      backgroundColor: 'rgba(255,159,10,0.30)',
      borderWidth: 1,
      borderColor: 'rgba(255,159,10,0.55)',
      borderTopWidth: isDeadline ? 3 : 1,
      borderTopColor: isDeadline ? urgencyColor : 'rgba(255,159,10,0.55)',
    };
  }
  // active-ontrack
  return {
    ...base,
    backgroundColor: 'rgba(0,122,255,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.55)',
    borderTopWidth: isDeadline ? 3 : 1,
    borderTopColor: isDeadline ? urgencyColor : 'rgba(0,122,255,0.55)',
  };
}

// ─── GanttChart ──────────────────────────────────────────────────────────────

/**
 * @param {object[]} ganttData  - from getGanttData()
 * @param {string[]} months     - ordered monthKey array e.g. ["2026-04", ...]
 * @param {function} onCardPress - (cardId) => void
 */
export default function GanttChart({ ganttData, months, onCardPress }) {
  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  return (
    <View style={styles.outerContainer}>
      {/* ── Flex row: fixed labels | scrollable bars ── */}
      <View style={styles.chartRow}>

        {/* ── Fixed left label column (spec 4.6) ── */}
        <View style={{ width: LABEL_WIDTH }}>
          {/* Spacer matching month header height */}
          <View style={{ height: HEADER_HEIGHT }} />

          {ganttData.map(({ card }) => {
            const urgency = card.urgency ?? 'ontrack';
            const urgencyColor = getUrgencyColor(urgency);
            return (
              <TouchableOpacity
                key={card.id}
                style={styles.labelRow}
                onPress={() => onCardPress(card.id)}
                activeOpacity={0.7}
              >
                {/* 6px urgency dot */}
                <View style={[styles.labelDot, { backgroundColor: urgencyColor }]} />
                <Text style={styles.labelText} numberOfLines={1}>
                  {card.name.length > 9 ? card.name.slice(0, 8) + '…' : card.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Horizontally scrollable bar area ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          bounces
        >
          <View>
            {/* Month header row (spec 4.3) */}
            <View style={styles.monthHeaderRow}>
              {months.map(monthKey => {
                const [yr, mo] = monthKey.split('-');
                const d = new Date(parseInt(yr), parseInt(mo) - 1, 1);
                const abbrev = d.toLocaleString('default', { month: 'short' });
                const isToday = monthKey === todayKey;
                return (
                  <View key={monthKey} style={styles.monthHeaderCell}>
                    <Text style={[
                      styles.monthHeaderText,
                      isToday && styles.monthHeaderToday,
                    ]}>
                      {abbrev}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Card bar rows */}
            {ganttData.map(({ card, months: cardMonths, expiryKey }) => {
              const urgency = card.urgency ?? 'ontrack';
              const urgencyColor = getUrgencyColor(urgency);

              return (
                <TouchableOpacity
                  key={card.id}
                  style={styles.barRow}
                  onPress={() => onCardPress(card.id)}
                  activeOpacity={0.7}
                >
                  {cardMonths.map(({ monthKey, state }) => {
                    const isDeadline = monthKey === expiryKey && card.balance > 0;
                    const isToday = monthKey === todayKey;
                    const cellStyle = getCellStyle(state, isDeadline, urgencyColor);

                    return (
                      <View key={monthKey} style={cellStyle}>
                        {/* Today vertical marker */}
                        {isToday && state !== 'empty' && (
                          <View style={styles.todayMarker} />
                        )}
                      </View>
                    );
                  })}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ── Color legend (spec 4.8) ── */}
      <View style={styles.legend}>
        {[
          { label: 'Paid off',  color: Colors.safeGreen },
          { label: 'On track',  color: Colors.accentBlue },
          { label: 'Watch',     color: Colors.warningAmber },
          { label: 'Urgent',    color: Colors.urgentRed },
        ].map(({ label, color }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  chartRow: {
    flexDirection: 'row',
  },

  // Left label column
  labelRow: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  labelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  labelText: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },

  // Month header
  monthHeaderRow: {
    flexDirection: 'row',
    height: HEADER_HEIGHT,
    alignItems: 'center',
  },
  monthHeaderCell: {
    width: MONTH_WIDTH,
    height: HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthHeaderText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  monthHeaderToday: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // Bar rows
  barRow: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },

  // Today marker
  todayMarker: {
    position: 'absolute',
    left: MONTH_WIDTH / 2 - 0.5,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: Colors.accentBlue,
    opacity: 0.6,
  },

  // Legend (spec 4.8)
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
});

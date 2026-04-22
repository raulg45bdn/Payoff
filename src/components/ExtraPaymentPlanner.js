import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {
  autoAllocateExtra,
  getImpactOfExtra,
  getTotalAllocated,
  formatCurrency,
  getUrgencyColor,
  getProjectedPayoffMonth,
} from '../utils/calculations';
import { Colors } from '../theme';

/**
 * Extra Payment Planner section.
 * Props:
 *   cards          – all cards from AppContext
 *   extraPool      – current slider value (number)
 *   overrides      – { [cardId]: number }
 *   onExtraPoolChange(value)
 *   onOverrideSet(cardId, amount)
 *   onOverrideClear(cardId)
 */
export default function ExtraPaymentPlanner({
  cards,
  extraPool,
  overrides,
  onExtraPoolChange,
  onOverrideSet,
  onOverrideClear,
}) {
  const [modalCard, setModalCard] = useState(null);
  const [overrideText, setOverrideText] = useState('');
  const [displayPool, setDisplayPool] = useState(extraPool);

  // Keep local display in sync when parent resets extraPool (e.g. monthly reset)
  useEffect(() => { setDisplayPool(extraPool); }, [extraPool]);

  // Active cards sorted most-urgent first
  const activeCards = useMemo(
    () => [...cards]
      .filter(c => c.balance > 0)
      .sort((a, b) => (a.monthsRemaining ?? 999) - (b.monthsRemaining ?? 999)),
    [cards]
  );

  // Auto-allocation from algorithm
  const autoAllocation = useMemo(
    () => autoAllocateExtra(activeCards, extraPool),
    [activeCards, extraPool]
  );

  // Effective allocation: overrides win over auto
  const effectiveAllocation = useMemo(() => {
    const result = { ...autoAllocation };
    for (const [id, amt] of Object.entries(overrides)) {
      result[id] = amt;
    }
    return result;
  }, [autoAllocation, overrides]);

  const totalAllocated = useMemo(
    () => getTotalAllocated(effectiveAllocation),
    [effectiveAllocation]
  );
  const unallocated = extraPool - totalAllocated;
  const isOverAllocated = unallocated < -0.005;

  // Per-card payoff impacts
  const impacts = useMemo(() => {
    const map = {};
    for (const card of activeCards) {
      map[card.id] = getImpactOfExtra(card, effectiveAllocation[card.id] ?? 0);
    }
    return map;
  }, [activeCards, effectiveAllocation]);

  const impactedCount = useMemo(
    () => activeCards.filter(c => (effectiveAllocation[c.id] ?? 0) > 0).length,
    [activeCards, effectiveAllocation]
  );

  const totalInterestSaved = useMemo(
    () => activeCards.reduce((sum, c) => sum + (impacts[c.id]?.interestSaved ?? 0), 0),
    [activeCards, impacts]
  );

  const bestImprovement = useMemo(() => {
    let best = null;
    let bestDays = 0;
    for (const card of activeCards) {
      const days = impacts[card.id]?.daysEarlier ?? 0;
      if (days > bestDays) { bestDays = days; best = card; }
    }
    return best ? { card: best, days: bestDays } : null;
  }, [activeCards, impacts]);

  // Modal live preview
  const modalOverrideAmount = parseFloat(overrideText) || 0;
  const modalImpact = modalCard ? getImpactOfExtra(modalCard, modalOverrideAmount) : null;

  function openModal(card) {
    const current = effectiveAllocation[card.id] ?? 0;
    setOverrideText(current > 0 ? String(Math.round(current)) : '');
    setModalCard(card);
  }

  function handleApply() {
    const amount = parseFloat(overrideText);
    if (!isNaN(amount) && amount >= 0) {
      onOverrideSet(modalCard.id, amount);
    }
    setModalCard(null);
  }

  function handleClearOverride() {
    onOverrideClear(modalCard.id);
    setModalCard(null);
  }

  return (
    <View>
      {/* ── Section header ── */}
      <Text style={styles.sectionHeader}>Extra payment planner</Text>

      <View style={styles.container}>
        {/* ── Global slider ── */}
        <Text style={styles.sliderLabel}>Extra payment this month</Text>
        <Text style={styles.sliderValue}>${displayPool}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1000}
          step={25}
          value={extraPool}
          onValueChange={setDisplayPool}
          onSlidingComplete={onExtraPoolChange}
          minimumTrackTintColor={Colors.accentBlue}
          maximumTrackTintColor={Colors.bgElevated}
          thumbTintColor={Colors.accentBlue}
        />

        {/* ── Unallocated pool tracker ── */}
        <View style={styles.unallocRow}>
          <Text style={styles.unallocLabel}>Available to allocate</Text>
          <Text style={[
            styles.unallocValue,
            isOverAllocated
              ? { color: Colors.urgentRed }
              : Math.abs(unallocated) < 0.01
              ? { color: Colors.textSecondary }
              : { color: Colors.safeGreen },
          ]}>
            {isOverAllocated
              ? `-$${Math.abs(Math.round(unallocated))}`
              : `$${Math.round(unallocated)}`}
          </Text>
        </View>
        {isOverAllocated && (
          <Text style={styles.overAllocWarning}>
            Over by ${Math.abs(Math.round(unallocated))} — reduce an override
          </Text>
        )}

        <View style={styles.divider} />

        {/* ── Card allocation list ── */}
        {activeCards.map(card => {
          const isOverridden = card.id in overrides;
          const displayAmt = effectiveAllocation[card.id] ?? 0;
          const urgencyColor = getUrgencyColor(card.urgency ?? 'ontrack');
          const progress = card.originalBalance > 0
            ? Math.max(0, Math.min(1, (card.originalBalance - card.balance) / card.originalBalance))
            : 0;
          const impact = impacts[card.id];
          const basePayoff = getProjectedPayoffMonth(card.balance, card.monthlyPayment, card.apr);
          const [_ey, _em] = (card.promoExpiration ?? '').split('-').map(Number);
          const expiryDate = new Date(_ey, _em - 1, 1).toLocaleDateString('en-US', {
            month: 'short', year: 'numeric',
          });

          return (
            <TouchableOpacity
              key={card.id}
              style={styles.cardRow}
              onPress={() => openModal(card)}
              activeOpacity={0.75}
            >
              {/* Left: dot + name + expiry + mini bar */}
              <View style={styles.cardLeft}>
                <View style={styles.cardNameRow}>
                  <View style={[styles.cardDot, { backgroundColor: urgencyColor }]} />
                  <Text style={styles.cardName} numberOfLines={1}>{card.name}</Text>
                </View>
                <Text style={styles.cardExpiry}>Expires {expiryDate}</Text>
                <View style={styles.miniTrack}>
                  <View style={[styles.miniFill, { width: `${progress * 100}%`, backgroundColor: urgencyColor }]} />
                </View>
              </View>

              {/* Center: allocation badge */}
              <View style={styles.cardCenter}>
                <View style={[
                  styles.badge,
                  { backgroundColor: isOverridden ? 'rgba(255,159,10,0.18)' : 'rgba(0,122,255,0.18)' },
                ]}>
                  <Text style={[styles.badgeText, { color: isOverridden ? Colors.warningAmber : Colors.accentBlue }]}>
                    {displayAmt > 0 ? `$${Math.round(displayAmt)}` : '$0'}
                    {isOverridden ? ' ↩' : ''}
                  </Text>
                </View>
                {isOverridden && (
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => onOverrideClear(card.id)}
                  >
                    <Text style={styles.resetLink}>Reset to auto</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Right: payoff impact */}
              <View style={styles.cardRight}>
                {displayAmt > 0 && impact && impact.newPayoffDate !== basePayoff ? (
                  <Text style={styles.impactImproved} numberOfLines={2}>
                    {basePayoff}{'\n'}→ {impact.newPayoffDate}
                  </Text>
                ) : (
                  <Text style={styles.impactBase} numberOfLines={1}>{basePayoff}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Impact summary panel ── */}
        {extraPool > 0 && (
          <View style={styles.impactPanel}>
            <View style={styles.impactRow}>
              <Text style={styles.impactLabel}>Total extra this month</Text>
              <Text style={[styles.impactVal, { color: Colors.accentBlue, fontSize: 18, fontWeight: '700' }]}>
                ${extraPool}
              </Text>
            </View>
            <View style={styles.impactRow}>
              <Text style={styles.impactLabel}>Cards impacted</Text>
              <Text style={styles.impactVal}>{impactedCount} card{impactedCount !== 1 ? 's' : ''}</Text>
            </View>
            {totalInterestSaved > 0.005 && (
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel}>Interest saved</Text>
                <Text style={[styles.impactVal, { color: Colors.safeGreen }]}>
                  {formatCurrency(totalInterestSaved)} saved
                </Text>
              </View>
            )}
            {bestImprovement && bestImprovement.days >= 30 && (
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel}>Best improvement</Text>
                <Text style={[styles.impactVal, { color: Colors.safeGreen, flexShrink: 1 }]} numberOfLines={2}>
                  {bestImprovement.card.name}: {Math.round(bestImprovement.days / 7)} weeks earlier
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Override Modal ── */}
      <Modal
        visible={modalCard !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setModalCard(null)}
      >
        <TouchableWithoutFeedback onPress={() => setModalCard(null)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          {modalCard && (
            <View style={styles.sheetContent}>
              <Text style={styles.modalTitle}>Extra payment for {modalCard.name}</Text>

              <View style={styles.modalInfoCard}>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Balance</Text>
                  <Text style={styles.modalInfoValue}>{formatCurrency(modalCard.balance)}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Monthly payment</Text>
                  <Text style={styles.modalInfoValue}>{formatCurrency(modalCard.monthlyPayment)}</Text>
                </View>
                <View style={[styles.modalInfoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.modalInfoLabel}>Auto-recommended</Text>
                  <Text style={[styles.modalInfoValue, { color: Colors.accentBlue }]}>
                    {formatCurrency(autoAllocation[modalCard.id] ?? 0)}
                  </Text>
                </View>
              </View>

              <Text style={styles.modalInputLabel}>Custom extra amount ($)</Text>
              <TextInput
                style={styles.modalInput}
                value={overrideText}
                onChangeText={setOverrideText}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                autoFocus
                selectTextOnFocus
              />

              {modalOverrideAmount > 0 && modalImpact && (
                <View style={styles.modalPreview}>
                  <Text style={styles.modalPreviewLine}>
                    New payoff: {modalImpact.newPayoffDate}
                  </Text>
                  {modalImpact.interestSaved > 0.005 && (
                    <Text style={[styles.modalPreviewLine, { color: Colors.safeGreen }]}>
                      Interest saved: {formatCurrency(modalImpact.interestSaved)}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.modalButtons}>
                {overrides[modalCard.id] !== undefined && (
                  <TouchableOpacity style={styles.btnClear} onPress={handleClearOverride}>
                    <Text style={styles.btnClearText}>Clear Override</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.btnCancel} onPress={() => setModalCard(null)}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnApply} onPress={handleApply}>
                  <Text style={styles.btnApplyText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 4,
  },
  container: {
    marginHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },

  // Slider
  sliderLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  sliderValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.accentBlue,
    textAlign: 'center',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 4,
  },

  // Unallocated
  unallocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  unallocLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  unallocValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  overAllocWarning: {
    fontSize: 12,
    color: Colors.urgentRed,
    marginTop: 4,
    textAlign: 'right',
  },

  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },

  // Card rows
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  cardLeft: {
    flex: 1,
    minWidth: 0,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  cardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  cardExpiry: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
    marginLeft: 11,
  },
  miniTrack: {
    height: 3,
    backgroundColor: Colors.bgElevated,
    borderRadius: 2,
    marginLeft: 11,
    overflow: 'hidden',
  },
  miniFill: {
    height: 3,
    borderRadius: 2,
  },

  // Allocation badge
  cardCenter: {
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetLink: {
    fontSize: 11,
    color: Colors.accentBlue,
  },

  // Payoff impact
  cardRight: {
    alignItems: 'flex-end',
    minWidth: 68,
  },
  impactImproved: {
    fontSize: 11,
    color: Colors.safeGreen,
    textAlign: 'right',
    lineHeight: 15,
  },
  impactBase: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'right',
  },

  // Impact summary panel
  impactPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    flexShrink: 1,
    marginRight: 8,
  },
  impactVal: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Override modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.bgSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInfoCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalInfoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modalInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalInputLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  modalPreview: {
    backgroundColor: 'rgba(48,209,88,0.08)',
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginBottom: 16,
  },
  modalPreviewLine: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnClear: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(255,69,58,0.15)',
    alignItems: 'center',
  },
  btnClearText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.urgentRed,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  btnApply: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.accentBlue,
    alignItems: 'center',
  },
  btnApplyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});

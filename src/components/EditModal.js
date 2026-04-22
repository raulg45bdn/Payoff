import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme';
import { useApp } from '../context/AppContext';

export default function EditModal({ visible, card, onClose }) {
  const { updateCard } = useApp();

  const [paidAmount, setPaidAmount] = useState('');
  const [newCharges, setNewCharges] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [payStatus, setPayStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [balanceError, setBalanceError] = useState('');

  useEffect(() => {
    if (card && visible) {
      setPaidAmount('');
      setNewCharges('');
      setNewBalance(card.balance != null ? String(card.balance) : '');
      setPayStatus(card.payStatus || 'Pending');
      setNotes(card.notes || '');
      setBalanceError('');
    }
  }, [card, visible]);

  function recalcBalance(paid, charges) {
    const p = parseFloat(paid) || 0;
    const c = parseFloat(charges) || 0;
    if (card.balance != null) {
      const calculated = Math.max(0, card.balance - p + c);
      setNewBalance(String(Math.round(calculated * 100) / 100));
      setBalanceError('');
    }
  }

  function handlePaidAmountChange(v) {
    setPaidAmount(v);
    recalcBalance(v, newCharges);
  }

  function handleNewChargesChange(v) {
    setNewCharges(v);
    recalcBalance(paidAmount, v);
  }

  function handlePayStatusToggle(status) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPayStatus(status);
  }

  function handleSave() {
    const parsedBalance = parseFloat(newBalance);
    if (newBalance.trim() === '' || isNaN(parsedBalance) || parsedBalance < 0) {
      setBalanceError('Please enter a valid new balance (0 or more).');
      return;
    }
    setBalanceError('');

    const paid = parseFloat(paidAmount) || 0;
    const now = new Date().toISOString();
    const historyEntry = paid > 0
      ? {
          id: Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
          date: now,
          amount: paid,
          balanceBefore: card.balance,
          balanceAfter: parsedBalance,
        }
      : null;

    const updatedCard = {
      ...card,
      balance: parsedBalance,
      lastPaymentAmount: paid > 0 ? paid : card.lastPaymentAmount,
      lastPaymentDate: paid > 0 ? now : card.lastPaymentDate,
      payStatus,
      notes: notes.slice(0, 200),
      paymentHistory: historyEntry
        ? [...(card.paymentHistory ?? []), historyEntry]
        : (card.paymentHistory ?? []),
    };

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateCard(updatedCard);
    onClose();
  }

  if (!card) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Tapping overlay dismisses without saving (spec 4.1) */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kavWrapper}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.sheet}>
            {/* Drag handle (spec 4.1) */}
            <View style={styles.handle} />

            {/* Header: Cancel | Title | Save (spec 4.2) */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Update Balance</Text>
              <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Current Balance — read only display */}
              <Text style={styles.fieldLabel}>Current Balance</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>
                  ${card.balance != null ? card.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </Text>
              </View>

              {/* Amount Paid — auto-calculates new balance */}
              <Text style={styles.fieldLabel}>Amount Paid</Text>
              <TextInput
                style={styles.input}
                value={paidAmount}
                onChangeText={handlePaidAmountChange}
                keyboardType="decimal-pad"
                placeholder="e.g. 565.00"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
              />

              {/* New Charges — adds to balance */}
              <Text style={styles.fieldLabel}>New Charges</Text>
              <TextInput
                style={styles.input}
                value={newCharges}
                onChangeText={handleNewChargesChange}
                keyboardType="decimal-pad"
                placeholder="e.g. 120.00"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
              />

              {/* New Balance — auto-filled but editable */}
              <Text style={styles.fieldLabel}>New Balance</Text>
              <TextInput
                style={[styles.input, balanceError ? styles.inputError : null]}
                value={newBalance}
                onChangeText={v => { setNewBalance(v); setBalanceError(''); }}
                keyboardType="decimal-pad"
                placeholder="e.g. 4500.00"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
              />
              {balanceError ? <Text style={styles.errorText}>{balanceError}</Text> : null}

              {/* Pay Status Toggle (spec 4.3) */}
              <Text style={styles.fieldLabel}>Pay Status</Text>
              <View style={styles.toggleRow}>
                {['Pending', 'Paid'].map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.toggleBtn,
                      payStatus === status && styles.toggleBtnActive,
                    ]}
                    onPress={() => handlePayStatusToggle(status)}
                  >
                    <Text style={[
                      styles.toggleText,
                      payStatus === status && styles.toggleTextActive,
                    ]}>
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes (spec 4.3) */}
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={v => setNotes(v.slice(0, 200))}
                placeholder="Optional notes..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
              <Text style={styles.charCount}>{notes.length}/200</Text>

              <View style={{ height: 16 }} />
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: Colors.bgSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgElevated,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  // Header (spec 4.2)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  headerBtn: {
    minWidth: 60,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.accentBlue,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.accentBlue,
    textAlign: 'right',
  },

  // Form fields (spec 4.3)
  formContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 16,
  },
  readOnlyField: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 14,
    opacity: 0.6,
  },
  readOnlyText: {
    color: Colors.textPrimary,
    fontSize: 15,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  inputError: {
    borderWidth: 1,
    borderColor: Colors.urgentRed,
  },
  errorText: {
    fontSize: 13,
    color: Colors.urgentRed,
    marginTop: 4,
  },
  notesInput: {
    minHeight: 80,
  },
  charCount: {
    fontSize: 11,
    color: Colors.bgElevated,
    textAlign: 'right',
    marginTop: 4,
  },

  // Pay Status toggle (spec 4.3)
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.accentBlue,
  },
  toggleText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});

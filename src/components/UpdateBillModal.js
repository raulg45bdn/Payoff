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
  Keyboard,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/calculations';

export default function UpdateBillModal({ visible, bill, onClose }) {
  const { updateBill } = useApp();
  const [amountText, setAmountText] = useState('');
  const [payStatus, setPayStatus] = useState('Paid');
  const [amountError, setAmountError] = useState('');

  useEffect(() => {
    if (bill && visible) {
      setAmountText(String(bill.variableAmountThisMonth ?? bill.amount));
      setPayStatus('Paid');
      setAmountError('');
    }
  }, [bill, visible]);

  function handleSave() {
    const parsed = parseFloat(amountText);
    if (amountText.trim() === '' || isNaN(parsed) || parsed < 0) {
      setAmountError('Enter a valid amount (0 or more).');
      return;
    }
    setAmountError('');

    const now = new Date().toISOString();
    const historyEntry = {
      id: Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
      date: now,
      amount: parsed,
    };

    const updatedBill = {
      ...bill,
      payStatus,
      lastPaymentDate: now,
      lastPaymentAmount: parsed,
      paymentHistory: [...(bill.paymentHistory ?? []), historyEntry],
      ...(bill.isVariable ? { variableAmountThisMonth: parsed } : {}),
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateBill(updatedBill);
    onClose();
  }

  if (!bill) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kavWrapper}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Mark as Paid</Text>
              <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContent}>
              {/* Amount */}
              <Text style={styles.fieldLabel}>
                {bill.isVariable ? 'Actual amount this month' : `Amount paid (base: ${formatCurrency(bill.amount)})`}
              </Text>
              <TextInput
                style={[styles.input, amountError ? styles.inputError : null]}
                value={amountText}
                onChangeText={v => { setAmountText(v); setAmountError(''); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
                autoFocus
                selectTextOnFocus
              />
              {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}

              {/* Pay status */}
              <Text style={styles.fieldLabel}>Pay Status</Text>
              <View style={styles.toggleRow}>
                {['Pending', 'Paid'].map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.toggleBtn, payStatus === s && styles.toggleBtnActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPayStatus(s);
                    }}
                  >
                    <Text style={[styles.toggleText, payStatus === s && styles.toggleTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ height: 24 }} />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  kavWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: Colors.bgSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.bgElevated,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
  },
  headerBtn: { minWidth: 60 },
  title: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', flex: 1 },
  cancelText: { fontSize: 16, color: Colors.accentBlue },
  saveText: { fontSize: 16, fontWeight: '700', color: Colors.accentBlue, textAlign: 'right' },
  formContent: { paddingHorizontal: 20, paddingTop: 16 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: Colors.bgCard, borderRadius: 10,
    padding: 14, color: Colors.textPrimary, fontSize: 15,
  },
  inputError: { borderWidth: 1, borderColor: Colors.urgentRed },
  errorText: { fontSize: 13, color: Colors.urgentRed, marginTop: 4 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1, backgroundColor: Colors.bgCard,
    borderRadius: 10, paddingVertical: 13, alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: Colors.accentBlue },
  toggleText: { fontSize: 15, color: Colors.textSecondary },
  toggleTextActive: { color: Colors.textPrimary, fontWeight: '600' },
});

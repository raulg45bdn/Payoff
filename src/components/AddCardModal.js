import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme';
import { useApp } from '../context/AppContext';

function makeId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function oneYearFromNow() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

export default function AddCardModal({ visible, onClose }) {
  const { addCard } = useApp();

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [postPromoAprPct, setPostPromoAprPct] = useState('26.99');
  const [dueDate, setDueDate] = useState('1');
  const [expiryDate, setExpiryDate] = useState(oneYearFromNow);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nameError, setNameError] = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [paymentError, setPaymentError] = useState('');

  function reset() {
    setName('');
    setBalance('');
    setMonthlyPayment('');
    setPostPromoAprPct('26.99');
    setDueDate('1');
    setExpiryDate(oneYearFromNow());
    setShowDatePicker(false);
    setNameError('');
    setBalanceError('');
    setPaymentError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toPromoDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  function handleSave() {
    let valid = true;
    if (!name.trim()) { setNameError('Name is required.'); valid = false; } else setNameError('');
    const parsedBalance = parseFloat(balance);
    if (isNaN(parsedBalance) || parsedBalance < 0) { setBalanceError('Enter a valid balance.'); valid = false; } else setBalanceError('');
    const parsedPayment = parseFloat(monthlyPayment);
    if (isNaN(parsedPayment) || parsedPayment <= 0) { setPaymentError('Enter a valid monthly payment.'); valid = false; } else setPaymentError('');
    if (!valid) return;

    const parsedApr = Math.max(0, parseFloat(postPromoAprPct) || 26.99) / 100;
    const parsedDue = Math.max(1, Math.min(31, parseInt(dueDate, 10) || 1));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addCard({
      id: makeId(),
      name: name.trim(),
      balance: parsedBalance,
      originalBalance: parsedBalance,
      apr: 0,
      promoExpiration: toPromoDateString(expiryDate),
      postPromoApr: parsedApr,
      monthlyPayment: parsedPayment,
      dueDate: parsedDue,
      payStatus: 'Pending',
      lastPaymentDate: null,
      lastPaymentAmount: 0,
      paymentHistory: [],
      notes: '',
      isTransferred: false,
      transferFee: 0,
      notificationEnabled: false,
      notificationDaysBefore: 60,
      notificationMode: 'days',
      notificationCustomDate: null,
      notificationCustomMessage: '',
      monthlyReminderEnabled: false,
      monthlyReminderDaysBefore: 3,
    });
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kavWrapper}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Add Card</Text>
              <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                <Text style={styles.saveText}>Add</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Card Name</Text>
              <TextInput
                style={[styles.input, nameError && styles.inputError]}
                value={name}
                onChangeText={v => { setName(v); setNameError(''); }}
                placeholder="e.g. Chase Freedom"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="next"
                maxLength={50}
              />
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

              <Text style={styles.fieldLabel}>Current Balance</Text>
              <TextInput
                style={[styles.input, balanceError && styles.inputError]}
                value={balance}
                onChangeText={v => { setBalance(v); setBalanceError(''); }}
                keyboardType="decimal-pad"
                placeholder="e.g. 4500.00"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="next"
              />
              {balanceError ? <Text style={styles.errorText}>{balanceError}</Text> : null}

              <Text style={styles.fieldLabel}>Monthly Payment</Text>
              <TextInput
                style={[styles.input, paymentError && styles.inputError]}
                value={monthlyPayment}
                onChangeText={v => { setMonthlyPayment(v); setPaymentError(''); }}
                keyboardType="decimal-pad"
                placeholder="e.g. 375.00"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
              />
              {paymentError ? <Text style={styles.errorText}>{paymentError}</Text> : null}

              <Text style={styles.fieldLabel}>0% Promo Expires</Text>
              <TouchableOpacity
                style={styles.dateRow}
                onPress={() => { Keyboard.dismiss(); setShowDatePicker(v => !v); }}
                activeOpacity={0.7}
              >
                <Text style={styles.dateText}>
                  {expiryDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <Text style={styles.dateChevron}>{showDatePicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={expiryDate}
                  mode="date"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={(_, d) => { if (d) setExpiryDate(d); }}
                  style={styles.datePicker}
                  themeVariant="dark"
                />
              )}

              <Text style={styles.fieldLabel}>Post-Promo APR (%)</Text>
              <TextInput
                style={styles.input}
                value={postPromoAprPct}
                onChangeText={setPostPromoAprPct}
                keyboardType="decimal-pad"
                placeholder="26.99"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
              />

              <Text style={styles.fieldLabel}>Payment Due Day (1–31)</Text>
              <TextInput
                style={styles.input}
                value={dueDate}
                onChangeText={setDueDate}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
                maxLength={2}
              />

              <View style={{ height: 16 }} />
            </ScrollView>
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
    maxHeight: '90%',
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
  formContent: { paddingHorizontal: 20, paddingTop: 8 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: Colors.bgCard, borderRadius: 10,
    padding: 14, color: Colors.textPrimary, fontSize: 15,
  },
  inputError: { borderWidth: 1, borderColor: Colors.urgentRed },
  errorText: { fontSize: 13, color: Colors.urgentRed, marginTop: 4 },
  dateRow: {
    backgroundColor: Colors.bgCard, borderRadius: 10,
    padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateText: { fontSize: 15, color: Colors.textPrimary },
  dateChevron: { fontSize: 12, color: Colors.textSecondary },
  datePicker: { height: 160 },
});

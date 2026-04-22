import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme';
import { useApp } from '../context/AppContext';

export default function EditCardModal({ visible, card, onClose }) {
  const { updateCard } = useApp();

  const [name, setName] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [postPromoAprPct, setPostPromoAprPct] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [nameError, setNameError] = useState('');
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (card && visible) {
      setName(card.name ?? '');
      setMonthlyPayment(String(card.monthlyPayment ?? ''));
      setPostPromoAprPct(String(((card.postPromoApr ?? 0) * 100).toFixed(2)));
      setDueDate(String(card.dueDate ?? 1));
      const parts = (card.promoExpiration ?? '').split('-').map(Number);
      setExpiryDate(parts.length === 3 ? new Date(parts[0], parts[1] - 1, 1) : new Date());
      setShowDatePicker(false);
      setNameError('');
      setPaymentError('');
    }
  }, [card, visible]);

  function toPromoDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  function handleSave() {
    let valid = true;
    if (!name.trim()) { setNameError('Name is required.'); valid = false; } else setNameError('');
    const parsedPayment = parseFloat(monthlyPayment);
    if (isNaN(parsedPayment) || parsedPayment <= 0) { setPaymentError('Enter a valid monthly payment.'); valid = false; } else setPaymentError('');
    if (!valid) return;

    const parsedApr = Math.max(0, parseFloat(postPromoAprPct) || 0) / 100;
    const parsedDue = Math.max(1, Math.min(31, parseInt(dueDate, 10) || 1));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateCard({
      ...card,
      name: name.trim(),
      monthlyPayment: parsedPayment,
      postPromoApr: parsedApr,
      dueDate: parsedDue,
      promoExpiration: toPromoDateString(expiryDate),
    });
    onClose();
  }

  if (!card) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
            <View style={styles.handle} />

            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Edit Card</Text>
              <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                <Text style={styles.saveText}>Save</Text>
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

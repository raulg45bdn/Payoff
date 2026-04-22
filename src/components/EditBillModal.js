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
  Switch,
  Keyboard,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme';
import { useApp } from '../context/AppContext';
import { BILL_CATEGORIES, getCategoryIcon, getCategoryColor } from '../utils/billUtils';

export default function EditBillModal({ visible, bill, onClose }) {
  const { updateBill } = useApp();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [dueDate, setDueDate] = useState('1');
  const [isVariable, setIsVariable] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationDaysBefore, setNotificationDaysBefore] = useState('3');
  const [amountError, setAmountError] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (bill && visible) {
      setName(bill.name ?? '');
      setAmount(String(bill.amount ?? ''));
      setCategory(bill.category ?? 'Other');
      setDueDate(String(bill.dueDate ?? 1));
      setIsVariable(bill.isVariable ?? false);
      setNotificationEnabled(bill.notificationEnabled ?? false);
      setNotificationDaysBefore(String(bill.notificationDaysBefore ?? 3));
      setAmountError('');
      setNameError('');
    }
  }, [bill, visible]);

  function handleSave() {
    let valid = true;
    if (!name.trim()) {
      setNameError('Name is required.');
      valid = false;
    } else {
      setNameError('');
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setAmountError('Enter a valid amount.');
      valid = false;
    } else {
      setAmountError('');
    }
    if (!valid) return;

    const parsedDue = Math.max(1, Math.min(31, parseInt(dueDate, 10) || 1));
    const parsedDays = Math.max(1, Math.min(30, parseInt(notificationDaysBefore, 10) || 3));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateBill({
      ...bill,
      name: name.trim(),
      amount: parsedAmount,
      category,
      dueDate: parsedDue,
      isVariable,
      notificationEnabled,
      notificationDaysBefore: parsedDays,
    });
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
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Edit Bill</Text>
              <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Name */}
              <Text style={styles.fieldLabel}>Bill Name</Text>
              <TextInput
                style={[styles.input, nameError ? styles.inputError : null]}
                value={name}
                onChangeText={v => { setName(v); setNameError(''); }}
                placeholder="e.g. Electric"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="next"
                maxLength={50}
              />
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

              {/* Amount */}
              <Text style={styles.fieldLabel}>{isVariable ? 'Typical Amount' : 'Monthly Amount'}</Text>
              <TextInput
                style={[styles.input, amountError ? styles.inputError : null]}
                value={amount}
                onChangeText={v => { setAmount(v); setAmountError(''); }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="done"
              />
              {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}

              {/* Due date */}
              <Text style={styles.fieldLabel}>Due Day (1–31)</Text>
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

              {/* Category */}
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {BILL_CATEGORIES.map(cat => {
                  const selected = category === cat;
                  const color = getCategoryColor(cat);
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, selected && { backgroundColor: color + '33', borderColor: color }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCategory(cat);
                      }}
                    >
                      <Text style={styles.categoryChipIcon}>{getCategoryIcon(cat)}</Text>
                      <Text style={[styles.categoryChipText, selected && { color }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
                <View style={{ width: 8 }} />
              </ScrollView>

              {/* Variable toggle */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Variable amount</Text>
                  <Text style={styles.switchHint}>Amount changes month to month</Text>
                </View>
                <Switch
                  value={isVariable}
                  onValueChange={v => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsVariable(v);
                  }}
                  trackColor={{ false: Colors.bgElevated, true: Colors.accentBlue }}
                  thumbColor={Colors.textPrimary}
                />
              </View>

              {/* Notification toggle */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Due date reminder</Text>
                  <Text style={styles.switchHint}>Get notified before this bill is due</Text>
                </View>
                <Switch
                  value={notificationEnabled}
                  onValueChange={v => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setNotificationEnabled(v);
                  }}
                  trackColor={{ false: Colors.bgElevated, true: Colors.accentBlue }}
                  thumbColor={Colors.textPrimary}
                />
              </View>

              {notificationEnabled && (
                <>
                  <Text style={styles.fieldLabel}>Days before due date</Text>
                  <TextInput
                    style={styles.input}
                    value={notificationDaysBefore}
                    onChangeText={setNotificationDaysBefore}
                    keyboardType="number-pad"
                    placeholder="3"
                    placeholderTextColor={Colors.textSecondary}
                    returnKeyType="done"
                    maxLength={2}
                  />
                </>
              )}

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

  categoryScroll: { marginTop: 4 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryChipIcon: { fontSize: 14 },
  categoryChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 15, color: Colors.textPrimary, marginBottom: 2 },
  switchHint: { fontSize: 12, color: Colors.textSecondary },
});

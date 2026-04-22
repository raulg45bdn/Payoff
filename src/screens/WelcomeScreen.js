import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { Colors, Typography } from '../theme';

export default function WelcomeScreen() {
  const { factoryReset, startFresh } = useApp();

  function handleStartFresh() {
    Alert.alert(
      'Start fresh?',
      'This will clear all demo data. You can add your own cards and bills from the dashboard.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Fresh', style: 'destructive', onPress: startFresh },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.content}>

        {/* Logo / icon area */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>💳</Text>
        </View>

        {/* Headline */}
        <Text style={styles.title}>Welcome to PayOff</Text>
        <Text style={styles.subtitle}>
          Track every 0% APR promo card, see exactly when each expires, and build a monthly
          payoff plan — all in one place, all on your device.
        </Text>

        {/* Feature bullets */}
        <View style={styles.bullets}>
          {[
            ['⏱', 'Countdown timers for every promo deadline'],
            ['📊', 'Smart payoff strategy with extra payment planner'],
            ['🔔', 'Notifications before deadlines hit'],
            ['🏠', 'Monthly bills tracker alongside your cards'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.bulletRow}>
              <Text style={styles.bulletIcon}>{icon}</Text>
              <Text style={styles.bulletText}>{text}</Text>
            </View>
          ))}
        </View>

      </View>

      {/* CTAs */}
      <View style={styles.ctas}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={factoryReset}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Load demo data</Text>
          <Text style={styles.primaryBtnSub}>See the app with sample cards & bills</Text>
        </TouchableOpacity>

        <Text style={styles.orText}>— or —</Text>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleStartFresh}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>Start fresh with my own data</Text>
          <Text style={styles.secondaryBtnSub}>Skip demo — go straight to blank dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 24,
  },
  iconWrap: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
  },
  title: {
    ...Typography.screenTitle,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 32,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  bullets: {
    gap: 14,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bulletIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  bulletText: {
    fontSize: 15,
    color: Colors.textPrimary,
    flex: 1,
  },
  ctas: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
    alignItems: 'center',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: Colors.accentBlue,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  primaryBtnSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
  },
  orText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  secondaryBtnSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
});

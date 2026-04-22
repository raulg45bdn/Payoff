import { useEffect, useRef, useState } from 'react';
import { AppState, ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { AppProvider, useApp } from './src/context/AppContext';
import { requestNotificationPermissions } from './src/utils/notifications';
import { navigationRef } from './src/utils/navigationRef';
import { checkBiometricAvailability, authenticateWithBiometrics } from './src/utils/biometrics';
import { Colors } from './src/theme';

import DashboardScreen from './src/screens/DashboardScreen';
import TimelineScreen from './src/screens/TimelineScreen';
import StrategyScreen from './src/screens/StrategyScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import CardDetailScreen from './src/screens/CardDetailScreen';
import BillDetailScreen from './src/screens/BillDetailScreen';

const Tab = createBottomTabNavigator();
const DashStack = createStackNavigator();
const TimelineStack = createStackNavigator();

function TabIcon({ label, focused }) {
  const icons = {
    Dashboard: focused ? '◉' : '○',
    Timeline:  focused ? '▦' : '▧',
    Strategy:  focused ? '⬡' : '⬢',
    History:   focused ? '◈' : '◇',
    Settings:  '⚙',
  };
  return (
    <Text style={{ fontSize: 18, color: focused ? Colors.accentBlue : Colors.textSecondary }}>
      {icons[label]}
    </Text>
  );
}

function DashboardStack() {
  return (
    <DashStack.Navigator screenOptions={{ headerShown: false }}>
      <DashStack.Screen name="DashboardMain" component={DashboardScreen} />
      <DashStack.Screen name="CardDetail" component={CardDetailScreen} />
      <DashStack.Screen name="BillDetail" component={BillDetailScreen} />
    </DashStack.Navigator>
  );
}

function TimelineStackScreen() {
  return (
    <TimelineStack.Navigator screenOptions={{ headerShown: false }}>
      <TimelineStack.Screen name="TimelineMain" component={TimelineScreen} />
      <TimelineStack.Screen name="CardDetail" component={CardDetailScreen} />
      <TimelineStack.Screen name="BillDetail" component={BillDetailScreen} />
    </TimelineStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgSecondary,
          borderTopColor: Colors.separator,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 24,
          paddingTop: 10,
        },
        tabBarActiveTintColor: Colors.accentBlue,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10, marginTop: 2 },
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Timeline" component={TimelineStackScreen} />
      <Tab.Screen name="Strategy" component={StrategyScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Reads isLoading from context — shows spinner until AsyncStorage hydration is done.
// Also owns the AppState listener for Face ID auto-lock (Step 17).
function RootNavigator({ navigationReadyRef, notificationQueueRef }) {
  const { isLoading, cards, bills, settings, onboarded } = useApp();
  const wasInBackground = useRef(false);
  const [isLocked, setIsLocked] = useState(false);

  async function tryUnlock() {
    const success = await authenticateWithBiometrics();
    if (success) setIsLocked(false);
  }

  useEffect(() => {
    const sub = AppState.addEventListener('change', async nextState => {
      if (nextState === 'active' && wasInBackground.current && settings.biometricEnabled) {
        const { available } = await checkBiometricAvailability();
        if (available) {
          const success = await authenticateWithBiometrics();
          if (!success) setIsLocked(true);
        }
      }
      wasInBackground.current = nextState === 'background';
    });
    return () => sub.remove();
  }, [settings.biometricEnabled]);

  if (isLocked) {
    return (
      <View style={lockStyles.container}>
        <Text style={lockStyles.title}>PayOff is locked</Text>
        <TouchableOpacity style={lockStyles.btn} onPress={tryUnlock}>
          <Text style={lockStyles.btnText}>Unlock with Face ID</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={Colors.accentBlue} />
      </View>
    );
  }

  // Show welcome only on first ever launch — not after startFresh (onboarded=true)
  if (!onboarded && cards.length === 0 && bills.length === 0) {
    return <WelcomeScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        navigationReadyRef.current = true;
        // Drain any notification taps that arrived before nav was ready (cold launch).
        const queued = notificationQueueRef.current.shift();
        if (queued) {
          if (queued.type === 'card') {
            navigationRef.current?.navigate('Dashboard', { screen: 'CardDetail', params: { cardId: queued.cardId } });
          } else {
            navigationRef.current?.navigate('Dashboard', { screen: 'BillDetail', params: { billId: queued.billId } });
          }
        }
      }}
      theme={{
        dark: true,
        colors: {
          primary: Colors.accentBlue,
          background: Colors.bgPrimary,
          card: Colors.bgSecondary,
          text: Colors.textPrimary,
          border: Colors.separator,
          notification: Colors.urgentRed,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium:  { fontFamily: 'System', fontWeight: '500' },
          bold:    { fontFamily: 'System', fontWeight: '700' },
          heavy:   { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  // Step 11: queue for notification taps that arrive before nav is ready (cold launch race).
  const notificationQueueRef = useRef([]);
  const navigationReadyRef = useRef(false);

  useEffect(() => {
    requestNotificationPermissions().catch(() => {});

    // Step 11: handle notification tap → deep link to CardDetail or BillDetail.
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const { cardId, billId } = response.notification.request.content.data ?? {};
      if (!cardId && !billId) return;

      if (navigationReadyRef.current) {
        if (cardId) {
          navigationRef.current?.navigate('Dashboard', { screen: 'CardDetail', params: { cardId } });
        } else {
          navigationRef.current?.navigate('Dashboard', { screen: 'BillDetail', params: { billId } });
        }
      } else {
        notificationQueueRef.current.push(cardId ? { type: 'card', cardId } : { type: 'bill', billId });
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootNavigator
          navigationReadyRef={navigationReadyRef}
          notificationQueueRef={notificationQueueRef}
        />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const lockStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  title: { fontSize: 20, fontWeight: '600', color: Colors.textPrimary },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
  },
  btnText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
});

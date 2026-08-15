import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarClearance } from '../lib/tabBarLayout';
import { TabBarScrollProvider, useTabBarScrollControls } from '../lib/TabBarScrollContext';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';
import { LanguageProvider } from '../lib/LanguageContext';
import { HapticsProvider } from '../lib/HapticsContext';
import { ProximityProvider } from '../lib/ProximityContext';
import { SoundsProvider } from '../lib/SoundsContext';

import LiquidTabBar from '../components/LiquidTabBar';
import ReportModePickerModal from '../components/ReportModePickerModal';
import { ReportModeProvider } from '../lib/ReportModeContext';
import { NotificationProvider } from '../lib/NotificationContext';
import { NetworkProvider, useNetwork } from '../lib/NetworkContext';
import { flushQueue } from '../lib/reportQueue';
import { registerPushToken } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { LockdownProvider } from '../lib/LockdownContext';
import LockdownAlert from '../components/LockdownAlert';
import OfflineBanner from '../components/OfflineBanner';
import AIChatScreen from '../screens/AIChatScreen';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ReportScreen from '../screens/ReportScreen';
import UpdateScreen from '../screens/UpdateScreen';

// --- Error Boundary Props & State Interfaces ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// --- Error Boundary Class Component ---
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={errorStyles.container}>
          <View style={errorStyles.header}>
            <Text style={errorStyles.title}>🚨 APK Crash Caught!</Text>
            <Text style={errorStyles.subtitle}>
              An unhandled exception occurred in the release build:
            </Text>
          </View>

          <View style={errorStyles.errorBox}>
            <Text style={errorStyles.errorLabel}>Error:</Text>
            <Text style={errorStyles.errorText}>
              {this.state.error?.toString() || 'Unknown Error'}
            </Text>
          </View>

          <Text style={errorStyles.stackLabel}>Component Stack Trace:</Text>
          <ScrollView style={errorStyles.stackBox}>
            <Text style={errorStyles.stackText}>
              {this.state.errorInfo?.componentStack || 'No stack available'}
            </Text>
          </ScrollView>

          <TouchableOpacity style={errorStyles.resetBtn} onPress={this.handleReset}>
            <Text style={errorStyles.resetBtnText}>Dismiss & Try Again</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

// --- Navigation Definitions ---
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs({ navigation }: any) {
  return (
    <TabBarScrollProvider>
      <MainTabNavigator navigation={navigation} />
    </TabBarScrollProvider>
  );
}

function MainTabNavigator({ navigation }: any) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [aiTabFocused, setAiTabFocused] = useState(false);
  const { hiddenLockCount } = useTabBarScrollControls();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const hideTabBarPadding = aiTabFocused || hiddenLockCount > 0;

  const loadAvatar = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.user_metadata?.avatar_url) {
      setAvatarUrl(user.user_metadata.avatar_url);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadAvatar();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.user_metadata?.avatar_url) {
        setAvatarUrl(session.user.user_metadata.avatar_url);
      }
    });

    return () => subscription.unsubscribe();
  }, [isFocused]);

  return (
      <Tab.Navigator
        initialRouteName="Home"
        tabBar={(props) => (
          <>
            <LiquidTabBar {...props} />
            <ReportModePickerModal navigation={props.navigation} />
          </>
        )}
        sceneContainerStyle={{
          paddingBottom: hideTabBarPadding ? 0 : getTabBarClearance(insets),
          backgroundColor: colors.background,
        }}
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.header },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={styles.headerAvatarBtn}
            >
              {avatarUrl ? (
                <Image
                  key={avatarUrl}
                  source={{ uri: avatarUrl }}
                  style={styles.headerAvatar}
                />
              ) : (
                <Ionicons name="person-circle-outline" size={32} color="#ffffff" />
              )}
            </TouchableOpacity>
          ),
        })}
      >
        <Tab.Screen name="Home" component={DashboardScreen} />
        <Tab.Screen name="Campus Feed" component={HomeScreen} />
        <Tab.Screen
          name="Report Incident"
          component={ReportScreen}
          options={{ headerShown: false }}
        />
        <Tab.Screen name="Campus Map" component={MapScreen} />
        <Tab.Screen
          name="AI Assistant"
          component={AIChatScreen}
          options={{ headerShown: false }}
          listeners={{
            focus: () => setAiTabFocused(true),
            blur: () => setAiTabFocused(false),
          }}
        />
      </Tab.Navigator>
  );
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const { colors } = useTheme();

  const checkOnboarding = (s: Session | null) => {
    if (!s) { setNeedsOnboarding(false); return; }
    const complete = s.user?.user_metadata?.onboarding_complete;
    setNeedsOnboarding(!complete);
  };

  const { wasOffline } = useNetwork();

  useEffect(() => {
    if (wasOffline && session) flushQueue();
  }, [wasOffline, session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkOnboarding(session);
      setLoading(false);
      if (session?.user?.id) registerPushToken(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      checkOnboarding(session);
      setLoading(false);
      if (session?.user?.id) registerPushToken(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={colors.statusBar as 'light' | 'dark' | 'auto'} />
      <OfflineBanner />
      <LockdownAlert />
      {!session ? (
        <AuthScreen onLoginSuccess={() => {}} />
      ) : needsOnboarding ? (
        <OnboardingScreen onComplete={() => setNeedsOnboarding(false)} />
      ) : (
        <NotificationProvider userId={session.user.id}>
          <ProximityProvider userId={session.user.id}>
          <Stack.Navigator>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                title: 'Profile Center',
                headerStyle: { backgroundColor: colors.header },
                headerTintColor: '#ffffff',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="Updates"
              component={UpdateScreen}
              options={{ headerShown: false, presentation: 'modal' }}
            />
          </Stack.Navigator>
          </ProximityProvider>
        </NotificationProvider>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <LanguageProvider>
      <ThemeProvider>
        <HapticsProvider>
        <SoundsProvider>
        <NetworkProvider>
        <ReportModeProvider>
          <LockdownProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
          </LockdownProvider>
        </ReportModeProvider>
        </NetworkProvider>
        </SoundsProvider>
        </HapticsProvider>
      </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  headerAvatarBtn: {
    marginRight: 16,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  errorBox: {
    backgroundColor: '#450a0a',
    borderColor: '#991b1b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fca5a5',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fef2f2',
  },
  stackLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  stackBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  stackText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  resetBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  resetBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
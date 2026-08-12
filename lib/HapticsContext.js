import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoHaptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY = '@campus_watch_haptics_enabled';

const HapticsContext = createContext(null);

async function fire(fn) {
  if (Platform.OS === 'web') return;
  try {
    await fn();
  } catch {
    // Haptics unavailable on this device/simulator.
  }
}

export function HapticsProvider({ children }) {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored !== null) setEnabledState(stored === '1');
    });
  }, []);

  const setEnabled = useCallback(async (value) => {
    setEnabledState(value);
    await AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    if (value) {
      await fire(() => ExpoHaptics.selectionAsync());
    }
  }, []);

  const runIfEnabled = useCallback(
    (fn) => {
      if (!enabled) return;
      return fire(fn);
    },
    [enabled]
  );

  const tap = useCallback(() => runIfEnabled(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)), [runIfEnabled]);

  const tabPress = useCallback(() => runIfEnabled(() => ExpoHaptics.selectionAsync()), [runIfEnabled]);

  const tabLongPress = useCallback(
    () => runIfEnabled(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium)),
    [runIfEnabled]
  );

  const tabDragSnap = useCallback(() => runIfEnabled(() => ExpoHaptics.selectionAsync()), [runIfEnabled]);

  const barPress = useCallback(
    () => runIfEnabled(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Soft)),
    [runIfEnabled]
  );

  const medium = useCallback(
    () => runIfEnabled(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium)),
    [runIfEnabled]
  );

  const success = useCallback(
    () => runIfEnabled(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)),
    [runIfEnabled]
  );

  const warning = useCallback(
    () => runIfEnabled(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning)),
    [runIfEnabled]
  );

  const error = useCallback(
    () => runIfEnabled(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error)),
    [runIfEnabled]
  );

  const aiSend = useCallback(
    () => runIfEnabled(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)),
    [runIfEnabled]
  );

  const aiReply = useCallback(
    () => runIfEnabled(() => ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success)),
    [runIfEnabled]
  );

  const value = useMemo(
    () => ({
      enabled,
      setEnabled,
      tap,
      tabPress,
      tabLongPress,
      tabDragSnap,
      barPress,
      medium,
      success,
      warning,
      error,
      aiSend,
      aiReply,
    }),
    [enabled, setEnabled, tap, tabPress, tabLongPress, tabDragSnap, barPress, medium, success, warning, error, aiSend, aiReply]
  );

  return <HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>;
}

export function useHaptics() {
  const ctx = useContext(HapticsContext);
  if (!ctx) {
    throw new Error('useHaptics must be used within HapticsProvider');
  }
  return ctx;
}

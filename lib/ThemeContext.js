import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';
import { getThemeColors } from './theme';
import { getTimeGradients, getTimePeriod } from './timeGradient';

const STORAGE_KEY = '@campus_watch_dark_mode';
const DYNAMIC_GRADIENT_KEY = '@campus_watch_dynamic_gradients';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [dynamicGradients, setDynamicGradientsState] = useState(true);
  const [timePeriod, setTimePeriod] = useState(getTimePeriod());

  const persistDarkMode = useCallback(async (value) => {
    await AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.auth.updateUser({ data: { dark_mode: value } });
      }
    } catch {
      // Preference is still saved locally.
    }
  }, []);

  const loadPreference = useCallback(async (session) => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const storedDynamic = await AsyncStorage.getItem(DYNAMIC_GRADIENT_KEY);
      if (storedDynamic !== null) {
        setDynamicGradientsState(storedDynamic === '1');
      }
      const metadataValue = session?.user?.user_metadata?.dark_mode;

      if (typeof metadataValue === 'boolean') {
        setIsDark(metadataValue);
        await AsyncStorage.setItem(STORAGE_KEY, metadataValue ? '1' : '0');
        return;
      }

      if (stored !== null) {
        setIsDark(stored === '1');
      }
    } catch {
      setIsDark(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadPreference(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.user_metadata?.dark_mode !== undefined) {
        const next = Boolean(session.user.user_metadata.dark_mode);
        setIsDark(next);
        AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      }
    });

    return () => subscription.unsubscribe();
  }, [loadPreference]);

  const setDarkMode = useCallback(
    (value) => {
      setIsDark(value);
      persistDarkMode(value);
    },
    [persistDarkMode]
  );

  const toggleDarkMode = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      persistDarkMode(next);
      return next;
    });
  }, [persistDarkMode]);

  const setDynamicGradients = useCallback(async (value) => {
    setDynamicGradientsState(value);
    await AsyncStorage.setItem(DYNAMIC_GRADIENT_KEY, value ? '1' : '0');
  }, []);

  useEffect(() => {
    if (!dynamicGradients) return undefined;
    const tick = () => setTimePeriod(getTimePeriod());
    const interval = setInterval(tick, 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [dynamicGradients]);

  const colors = useMemo(() => {
    const base = getThemeColors(isDark);

    if (!dynamicGradients) {
      return {
        ...base,
        accentGradient: [base.primary, base.primaryLight],
        timePeriod: null,
        timePeriodLabel: 'Classic',
        dynamicGradients: false,
      };
    }

    const time = getTimeGradients(isDark, timePeriod);
    return {
      ...base,
      backgroundGradient: time.backgroundGradient,
      accentGradient: time.accentGradient,
      header: time.headerTint,
      timePeriod: time.timePeriod,
      timePeriodLabel: time.timePeriodLabel,
      dynamicGradients: true,
    };
  }, [isDark, timePeriod, dynamicGradients]);

  const value = useMemo(
    () => ({
      isDark,
      colors,
      timePeriod,
      dynamicGradients,
      setDarkMode,
      toggleDarkMode,
      setDynamicGradients,
    }),
    [isDark, colors, timePeriod, dynamicGradients, setDarkMode, toggleDarkMode, setDynamicGradients]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

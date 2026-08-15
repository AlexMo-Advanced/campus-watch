import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { supabase } from './supabase';
import { getThemeColors } from './theme';
import { getTimeGradients, getTimePeriod } from './timeGradient';

const STORAGE_KEY = '@campus_watch_theme_mode'; // 'light' | 'dark' | 'system'
const DYNAMIC_GRADIENT_KEY = '@campus_watch_dynamic_gradients';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState('system');
  const [dynamicGradients, setDynamicGradientsState] = useState(true);
  const [timePeriod, setTimePeriod] = useState(getTimePeriod());

  // Derived isDark — respects system when mode is 'system'
  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';

  const persistThemeMode = useCallback(async (mode) => {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.auth.updateUser({ data: { theme_mode: mode } });
    } catch { /* saved locally */ }
  }, []);

  const loadPreference = useCallback(async (session) => {
    try {
      const storedDynamic = await AsyncStorage.getItem(DYNAMIC_GRADIENT_KEY);
      if (storedDynamic !== null) setDynamicGradientsState(storedDynamic === '1');

      // Supabase metadata takes priority
      const metaMode = session?.user?.user_metadata?.theme_mode;
      if (metaMode === 'light' || metaMode === 'dark' || metaMode === 'system') {
        setThemeModeState(metaMode);
        return;
      }
      // Migrate old boolean dark_mode key
      const metaDark = session?.user?.user_metadata?.dark_mode;
      if (typeof metaDark === 'boolean') {
        setThemeModeState(metaDark ? 'dark' : 'light');
        return;
      }
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeModeState(stored);
      }
    } catch {
      setThemeModeState('system');
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => loadPreference(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const meta = session?.user?.user_metadata;
      if (meta?.theme_mode) setThemeModeState(meta.theme_mode);
    });
    return () => subscription.unsubscribe();
  }, [loadPreference]);

  const setThemeMode = useCallback((mode) => {
    setThemeModeState(mode);
    persistThemeMode(mode);
  }, [persistThemeMode]);

  // Compat shim for any existing setDarkMode(bool) calls
  const setDarkMode = useCallback((value) => {
    setThemeMode(value ? 'dark' : 'light');
  }, [setThemeMode]);

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
      themeMode,
      colors,
      timePeriod,
      dynamicGradients,
      setThemeMode,
      setDarkMode,
      setDynamicGradients,
    }),
    [isDark, themeMode, colors, timePeriod, dynamicGradients, setThemeMode, setDarkMode, setDynamicGradients]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

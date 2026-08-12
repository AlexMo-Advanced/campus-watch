import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getStoredReportMode,
  REPORT_MODE_INSTANT,
  setStoredReportMode,
} from './reportPreferences';

const ReportModeContext = createContext(null);

export function ReportModeProvider({ children }) {
  const [preference, setPreferenceState] = useState(REPORT_MODE_INSTANT);
  const [ready, setReady] = useState(false);
  const [pendingLaunchMode, setPendingLaunchMode] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    getStoredReportMode().then((mode) => {
      setPreferenceState(mode);
      setReady(true);
    });
  }, []);

  const setPreference = useCallback(async (mode) => {
    setPreferenceState(mode);
    await setStoredReportMode(mode);
  }, []);

  const launchReport = useCallback((mode) => {
    setPendingLaunchMode(mode);
    setPickerVisible(false);
  }, []);

  const consumeLaunchMode = useCallback(() => {
    if (!pendingLaunchMode) return null;
    const mode = pendingLaunchMode;
    setPendingLaunchMode(null);
    return mode;
  }, [pendingLaunchMode]);

  const openPicker = useCallback(() => setPickerVisible(true), []);
  const closePicker = useCallback(() => setPickerVisible(false), []);

  const value = useMemo(
    () => ({
      preference,
      ready,
      setPreference,
      pendingLaunchMode,
      launchReport,
      consumeLaunchMode,
      pickerVisible,
      openPicker,
      closePicker,
    }),
    [
      preference,
      ready,
      setPreference,
      pendingLaunchMode,
      launchReport,
      consumeLaunchMode,
      pickerVisible,
      openPicker,
      closePicker,
    ]
  );

  return <ReportModeContext.Provider value={value}>{children}</ReportModeContext.Provider>;
}

export function useReportMode() {
  const ctx = useContext(ReportModeContext);
  if (!ctx) {
    throw new Error('useReportMode must be used within ReportModeProvider');
  }
  return ctx;
}

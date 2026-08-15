import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const LOCKDOWN_ENABLED_KEY = '@campus_watch_lockdown_alerts_enabled';
const BOOT_GRACE_MS = 1000;
const REPORT_FINISH_DELAY_MS = 500;

const LockdownContext = createContext(null);

export function LockdownProvider({ children }) {
  const [lockdownAlert, setLockdownAlert] = useState(null);
  const [lockdownEnabled, setLockdownEnabledState] = useState(true);
  const reportingActiveRef = useRef(false);
  const pendingRef = useRef(null);
  const lockdownEnabledRef = useRef(true);
  const bootedAtRef = useRef(Date.now());
  const shownIdsRef = useRef(new Set());
  const timerRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(LOCKDOWN_ENABLED_KEY).then((v) => {
      if (v === '0') {
        setLockdownEnabledState(false);
        lockdownEnabledRef.current = false;
      }
    });
  }, []);

  useEffect(() => {
    lockdownEnabledRef.current = lockdownEnabled;
  }, [lockdownEnabled]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const setLockdownEnabled = useCallback(async (value) => {
    setLockdownEnabledState(value);
    lockdownEnabledRef.current = value;
    await AsyncStorage.setItem(LOCKDOWN_ENABLED_KEY, value ? '1' : '0');
    if (!value) {
      pendingRef.current = null;
      setLockdownAlert(null);
    }
  }, []);

  const presentAlert = useCallback((report) => {
    if (!report?.id || !lockdownEnabledRef.current) return;
    if (shownIdsRef.current.has(report.id)) return;
    if (reportingActiveRef.current) {
      pendingRef.current = report;
      return;
    }
    shownIdsRef.current.add(report.id);
    setLockdownAlert(report);
  }, []);

  const scheduleAlert = useCallback((report) => {
    if (!report?.id || !lockdownEnabledRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    const elapsed = Date.now() - bootedAtRef.current;
    const delay = Math.max(0, BOOT_GRACE_MS - elapsed);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      presentAlert(report);
    }, delay);
  }, [presentAlert]);

  const triggerLockdown = useCallback((report) => {
    if (!lockdownEnabledRef.current || !report?.id) return;
    if (reportingActiveRef.current) {
      pendingRef.current = report;
      return;
    }
    scheduleAlert(report);
  }, [scheduleAlert]);

  const dismissLockdown = useCallback(() => {
    setLockdownAlert(null);
    pendingRef.current = null;
  }, []);

  const setReportingActive = useCallback((active) => {
    reportingActiveRef.current = active;
    if (active) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setLockdownAlert(null);
      return;
    }
    if (pendingRef.current) {
      const deferred = pendingRef.current;
      pendingRef.current = null;
      setTimeout(() => presentAlert(deferred), REPORT_FINISH_DELAY_MS);
    }
  }, [presentAlert]);

  const value = useMemo(
    () => ({
      lockdownAlert,
      lockdownEnabled,
      setLockdownEnabled,
      triggerLockdown,
      dismissLockdown,
      setReportingActive,
    }),
    [lockdownAlert, lockdownEnabled, setLockdownEnabled, triggerLockdown, dismissLockdown, setReportingActive]
  );

  return <LockdownContext.Provider value={value}>{children}</LockdownContext.Provider>;
}

export function useLockdown() {
  const ctx = useContext(LockdownContext);
  if (!ctx) throw new Error('useLockdown must be used within LockdownProvider');
  return ctx;
}

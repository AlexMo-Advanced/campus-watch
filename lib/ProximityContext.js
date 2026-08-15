import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { PROXIMITY_OPT_IN_KEY, TOKEN_SEEN_TTL_MS } from './proximity/constants';
import { clearTokenCache, getRecentTokens } from './proximity/tokenCache';
import {
  collectNearbyTokensForReport,
  generateEphemeralToken,
  sendProximityHeartbeat,
} from './proximity/proximityApi';
import { BLE_NATIVE_ENABLED } from './proximity/bleNativeEnabled';

const ProximityContext = createContext(null);

const NOOP_SERVICE = {
  start: async () => {},
  stop: async () => {},
  stopScanning: async () => {},
};

function getBleService() {
  if (!BLE_NATIVE_ENABLED) return NOOP_SERVICE;
  try {
    const mod = require('./proximity/bleService.impl.native.js');
    return mod.getBleProximityService();
  } catch {
    return NOOP_SERVICE;
  }
}

function checkBleHardware() {
  if (!BLE_NATIVE_ENABLED) return false;
  try {
    const mod = require('./proximity/bleService.impl.native.js');
    return mod.isBleHardwareAvailable();
  } catch {
    return false;
  }
}

export function ProximityProvider({ children, userId }) {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  const [bleAvailable, setBleAvailable] = useState(false);
  const serviceRef = useRef(NOOP_SERVICE);
  const enabledRef = useRef(false);

  useEffect(() => {
    if (!BLE_NATIVE_ENABLED) {
      serviceRef.current = NOOP_SERVICE;
      setBleAvailable(false);
      return;
    }
    serviceRef.current = getBleService();
    setBleAvailable(checkBleHardware());
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(PROXIMITY_OPT_IN_KEY).then((stored) => {
      setEnabledState(stored === '1');
      setReady(true);
    });
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const stopService = useCallback(async () => {
    try {
      await serviceRef.current.stop();
    } catch {
      // fail closed
    }
    clearTokenCache();
  }, []);

  const startService = useCallback(async () => {
    if (!userId || !enabledRef.current) return;
    try {
      await serviceRef.current.start();
    } catch {
      const token = generateEphemeralToken();
      await sendProximityHeartbeat(token);
    }
  }, [userId]);

  useEffect(() => {
    if (!ready || !userId) return undefined;

    if (enabled) {
      startService();
    } else {
      stopService();
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (!enabledRef.current) return;
      if (state === 'active') {
        startService();
      } else {
        serviceRef.current.stopScanning?.().catch(() => {});
      }
    });

    return () => {
      sub.remove();
      stopService();
    };
  }, [enabled, ready, userId, startService, stopService]);

  const setEnabled = useCallback(async (value) => {
    setEnabledState(value);
    await AsyncStorage.setItem(PROXIMITY_OPT_IN_KEY, value ? '1' : '0');
    if (!value) {
      await stopService();
    }
  }, [stopService]);

  const getNearbyTokens = useCallback(() => {
    if (!enabled) return [];
    return collectNearbyTokensForReport();
  }, [enabled]);

  const value = useMemo(
    () => ({
      enabled,
      ready,
      bleAvailable,
      setEnabled,
      getNearbyTokens,
      getRecentTokenCount: () => getRecentTokens(TOKEN_SEEN_TTL_MS).length,
    }),
    [enabled, ready, bleAvailable, setEnabled, getNearbyTokens]
  );

  return <ProximityContext.Provider value={value}>{children}</ProximityContext.Provider>;
}

export function useProximity() {
  const ctx = useContext(ProximityContext);
  if (!ctx) {
    throw new Error('useProximity must be used within ProximityProvider');
  }
  return ctx;
}

export function useProximityOptional() {
  return useContext(ProximityContext);
}

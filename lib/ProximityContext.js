import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { PROXIMITY_OPT_IN_KEY, TOKEN_SEEN_TTL_MS, HEARTBEAT_INTERVAL_MS } from './proximity/constants';
import { clearTokenCache, getRecentTokens } from './proximity/tokenCache';
import {
  collectNearbyTokensForReport,
  generateEphemeralToken,
  sendProximityHeartbeat,
} from './proximity/proximityApi';
import * as proximityService from './proximity/proximityService';

const ProximityContext = createContext(null);

export function ProximityProvider({ children, userId }) {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  const [bleAvailable, setBleAvailable] = useState(false);
  const [blePermissionsGranted, setBlePermissionsGranted] = useState(true);
  const enabledRef = useRef(false);
  const heartbeatTimerRef = useRef(null);
  const currentTokenRef = useRef(null);

  useEffect(() => {
    proximityService.initialize();
    setBleAvailable(proximityService.isHardwareAvailable());
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
      await proximityService.stop();
    } catch {
      // fail closed
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    clearTokenCache();
  }, []);

  const startService = useCallback(async () => {
    if (!userId || !enabledRef.current) return;
    
    if (!heartbeatTimerRef.current) {
      if (!currentTokenRef.current) {
        currentTokenRef.current = generateEphemeralToken();
      }
      sendProximityHeartbeat(currentTokenRef.current).catch(() => {});
      heartbeatTimerRef.current = setInterval(() => {
        sendProximityHeartbeat(currentTokenRef.current).catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);
    }

    try {
      await proximityService.start(currentTokenRef.current);
      setBlePermissionsGranted(proximityService.getBlePermissionsGranted());
    } catch {
      // fail closed
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
        proximityService.stopScanning().catch(() => {});
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
      blePermissionsGranted,
      setEnabled,
      getNearbyTokens,
      getRecentTokenCount: () => getRecentTokens(TOKEN_SEEN_TTL_MS).length,
    }),
    [enabled, ready, bleAvailable, blePermissionsGranted, setEnabled, getNearbyTokens]
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

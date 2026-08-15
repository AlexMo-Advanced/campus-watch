import * as Location from 'expo-location';
import { supabase } from '../supabase';
import { TOKEN_SEEN_TTL_MS } from './constants';
import { getRecentTokens } from './tokenCache';

export function generateEphemeralToken() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function sendProximityHeartbeat(token) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session || !token) return false;

    let latitude;
    let longitude;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
    } catch {
      // location optional for heartbeat
    }

    const { error } = await supabase.functions.invoke('ble-heartbeat', {
      body: {
        token,
        ...(typeof latitude === 'number' && typeof longitude === 'number'
          ? { latitude, longitude }
          : {}),
      },
    });

    return !error;
  } catch {
    return false;
  }
}

export async function dispatchProximityAlerts(reportId, nearbyTokens) {
  try {
    const { error } = await supabase.functions.invoke('report-proximity-notify', {
      body: {
        report_id: reportId,
        nearby_tokens: nearbyTokens ?? [],
      },
    });
    return !error;
  } catch {
    return false;
  }
}

export function collectNearbyTokensForReport() {
  return getRecentTokens(TOKEN_SEEN_TTL_MS);
}

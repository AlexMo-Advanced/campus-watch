import AsyncStorage from '@react-native-async-storage/async-storage';
import { dispatchProximityAlerts } from './proximity/proximityApi';
import { supabase } from './supabase';

/** After a report row is inserted, dispatch privacy-first proximity alerts server-side. */
export async function notifyReportProximity(reportId, nearbyTokens = []) {
  if (!reportId) return false;
  return dispatchProximityAlerts(reportId, nearbyTokens);
}

/** Standard report screen inline submit helper — returns inserted report id. */
export async function insertReportPayload(payload, nearbyTokens = []) {
  const { data, error } = await supabase.from('reports').insert([payload]).select('id').single();
  if (error) throw error;
  await notifyReportProximity(data.id, nearbyTokens).catch(() => {});
  return data.id;
}

export async function isProximityOptInEnabled() {
  try {
    const stored = await AsyncStorage.getItem('@campus_watch_proximity_alerts_enabled');
    return stored === '1';
  } catch {
    return false;
  }
}

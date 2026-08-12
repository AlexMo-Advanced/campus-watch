import AsyncStorage from '@react-native-async-storage/async-storage';

export const REPORT_MODE_INSTANT = 'instant';
export const REPORT_MODE_STANDARD = 'standard';

const STORAGE_KEY = '@campus_watch_report_mode';

export async function getStoredReportMode() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === REPORT_MODE_INSTANT || stored === REPORT_MODE_STANDARD) {
      return stored;
    }
  } catch {
    // fall through
  }
  return REPORT_MODE_INSTANT;
}

export async function setStoredReportMode(mode) {
  await AsyncStorage.setItem(STORAGE_KEY, mode);
}

import AsyncStorage from '@react-native-async-storage/async-storage';

export const FEED_VIEW_LIST = 'list';
export const FEED_VIEW_IMMERSIVE = 'immersive';

const STORAGE_KEY = '@campus_watch_feed_view_mode';

export async function getStoredFeedViewMode() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === FEED_VIEW_LIST || stored === FEED_VIEW_IMMERSIVE) {
      return stored;
    }
  } catch {
    // fall through
  }
  return FEED_VIEW_LIST;
}

export async function setStoredFeedViewMode(mode) {
  await AsyncStorage.setItem(STORAGE_KEY, mode);
}

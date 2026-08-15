import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOTIFICATION_TYPES = {
  COMMENT_REPLY: 'comment_reply',
  REPORT_COMMENT: 'report_comment',
  COMMENT_LIKE: 'comment_like',
  REPORT_LIKE: 'report_like',
  ALERT_DELETED: 'alert_deleted',
  ALERT_RESOLVED: 'alert_resolved',
  NEARBY_SITUATION: 'nearby_situation',
  NEARBY_CRITICAL: 'nearby_critical',
  NEARBY_HIGH: 'nearby_high',
};

const STORAGE_KEY = '@campus_watch_notifications';
const NEARBY_SEEN_KEY = '@campus_watch_nearby_seen';

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function loadNotifications() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveNotifications(list) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
}

export async function addNotification(entry) {
  const list = await loadNotifications();
  const dedupeKey = entry.dedupeKey;
  if (dedupeKey && list.some((n) => n.dedupeKey === dedupeKey)) {
    return list;
  }

  const notification = {
    id: makeId(),
    read: false,
    created_at: new Date().toISOString(),
    ...entry,
  };

  const next = [notification, ...list].slice(0, 100);
  await saveNotifications(next);
  return next;
}

export async function markNotificationRead(id) {
  const list = await loadNotifications();
  const next = list.map((n) => (n.id === id ? { ...n, read: true } : n));
  await saveNotifications(next);
  return next;
}

export async function markAllNotificationsRead() {
  const list = await loadNotifications();
  const next = list.map((n) => ({ ...n, read: true }));
  await saveNotifications(next);
  return next;
}

export async function getNearbySeenIds() {
  try {
    const raw = await AsyncStorage.getItem(NEARBY_SEEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function markNearbySeen(reportId) {
  const seen = await getNearbySeenIds();
  if (seen.includes(reportId)) return seen;
  const next = [...seen, reportId].slice(-200);
  await AsyncStorage.setItem(NEARBY_SEEN_KEY, JSON.stringify(next));
  return next;
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

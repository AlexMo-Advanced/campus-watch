import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NOTIFICATION_TYPE_SOUND } from './soundAssets';
import { supabase } from './supabase';

const NOTIFICATIONS_SOUND_KEY = '@campus_watch_notification_sounds_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function resolveNotificationSound(notificationType) {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATIONS_SOUND_KEY);
    if (stored === '0') return false;
  } catch {
    // default enabled
  }
  if (!notificationType) return NOTIFICATION_TYPE_SOUND.default;
  return NOTIFICATION_TYPE_SOUND[notificationType] || NOTIFICATION_TYPE_SOUND.default;
}

export async function registerPushToken(userId) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('campus-alerts', {
        name: 'Campus Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
        sound: 'alert.wav',
      });
      await Notifications.setNotificationChannelAsync('campus-comments', {
        name: 'Comments & Replies',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'comment.wav',
      });
      await Notifications.setNotificationChannelAsync('campus-likes', {
        name: 'Likes',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'like_notification.wav',
      });
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    if (userId && token) {
      await supabase
        .from('push_tokens')
        .upsert({ user_id: userId, token, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    }

    return token;
  } catch (e) {
    console.warn('Push token registration failed:', e.message);
    return null;
  }
}

function channelForType(notificationType) {
  switch (notificationType) {
    case 'comment_reply':
    case 'report_comment':
      return 'campus-comments';
    case 'comment_like':
    case 'report_like':
      return 'campus-likes';
    default:
      return 'campus-alerts';
  }
}

export async function firePushNotification(title, body, data = {}, notificationType) {
  try {
    const sound = await resolveNotificationSound(notificationType);
    const content = {
      title,
      body,
      data,
      ...(sound ? { sound } : {}),
    };

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
      ...(Platform.OS === 'android' ? { channelId: channelForType(notificationType) } : {}),
    });
  } catch (e) {
    console.warn('Local push failed:', e.message);
  }
}

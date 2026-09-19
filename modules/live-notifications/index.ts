import { requireNativeModule } from 'expo-modules-core';

const LiveNotificationsModule = requireNativeModule('LiveNotifications');

export function startLiveNotification(title: string, content: string, data: any) {
  return LiveNotificationsModule.startLiveNotification(title, content, data);
}

export function updateLiveNotification(content: string, data: any) {
  return LiveNotificationsModule.updateLiveNotification(content, data);
}

export function endLiveNotification() {
  return LiveNotificationsModule.endLiveNotification();
}

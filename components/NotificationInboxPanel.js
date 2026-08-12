import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NOTIFICATION_TYPES } from '../lib/notifications';
import { useNotifications } from '../lib/NotificationContext';
import { useTheme } from '../lib/ThemeContext';

function iconForType(type) {
  switch (type) {
    case NOTIFICATION_TYPES.COMMENT_REPLY: return 'chatbubble-ellipses';
    case NOTIFICATION_TYPES.REPORT_COMMENT: return 'chatbubbles';
    case NOTIFICATION_TYPES.COMMENT_LIKE: return 'heart';
    case NOTIFICATION_TYPES.REPORT_LIKE: return 'heart-circle';
    case NOTIFICATION_TYPES.ALERT_DELETED: return 'trash';
    case NOTIFICATION_TYPES.ALERT_RESOLVED: return 'checkmark-circle';
    case NOTIFICATION_TYPES.NEARBY_SITUATION: return 'location';
    default: return 'notifications';
  }
}

function colorForType(type, colors) {
  switch (type) {
    case NOTIFICATION_TYPES.NEARBY_SITUATION: return '#ef4444';
    case NOTIFICATION_TYPES.COMMENT_LIKE:
    case NOTIFICATION_TYPES.REPORT_LIKE: return '#ef4444';
    case NOTIFICATION_TYPES.ALERT_RESOLVED: return colors.primary;
    case NOTIFICATION_TYPES.ALERT_DELETED: return '#64748b';
    default: return '#2563eb';
  }
}

export default function NotificationInboxPanel() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.inboxTrigger, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <View style={[styles.inboxIconWrap, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}>
          <Ionicons name="mail" size={20} color={colors.primary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.inboxTriggerText}>
          <Text style={[styles.inboxTitle, { color: colors.text }]}>Notification Inbox</Text>
          <Text style={[styles.inboxSub, { color: colors.textSecondary }]}>
            {unreadCount ? `${unreadCount} unread update${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Inbox</Text>
            {unreadCount > 0 ? (
              <TouchableOpacity onPress={markAllRead}>
                <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 72 }} />
            )}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
            {notifications.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  Comments, replies, alert updates, and nearby situations will appear here.
                </Text>
              </View>
            ) : (
              notifications.map((item, i) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(i * 40).duration(300)}>
                  <TouchableOpacity
                    style={[
                      styles.notifCard,
                      {
                        backgroundColor: item.read ? colors.surface : (isDark ? '#1e3a5f' : '#eff6ff'),
                        borderColor: item.read ? colors.border : colors.primary,
                      },
                    ]}
                    onPress={() => markRead(item.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.notifIcon, { backgroundColor: `${colorForType(item.type, colors)}22` }]}>
                      <Ionicons name={iconForType(item.type)} size={18} color={colorForType(item.type, colors)} />
                    </View>
                    <View style={styles.notifBody}>
                      <Text style={[styles.notifTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.notifText, { color: colors.textSecondary }]}>{item.body}</Text>
                      <Text style={[styles.notifTime, { color: colors.textMuted }]}>
                        {new Date(item.created_at).toLocaleString()}
                      </Text>
                    </View>
                    {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inboxTrigger: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  inboxIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  inboxTriggerText: { flex: 1 },
  inboxTitle: { fontSize: 15, fontWeight: '800' },
  inboxSub: { fontSize: 12, marginTop: 2 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  markAll: { fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginTop: 12 },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  notifText: { fontSize: 13, lineHeight: 18 },
  notifTime: { fontSize: 11, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});

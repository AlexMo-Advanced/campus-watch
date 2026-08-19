import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLockdown } from './LockdownContext';
import {
    addNotification,
    getNearbySeenIds,
    haversineMeters,
    loadNotifications,
    markAllNotificationsRead,
    markNearbySeen,
    markNotificationRead,
    NOTIFICATION_TYPES,
} from './notifications';
import { firePushNotification } from './pushNotifications';
import { supabase } from './supabase';

const NotificationContext = createContext(null);
const NEARBY_RADIUS_M = 1500;

export function NotificationProvider({ children, userId }) {
  const { triggerLockdown } = useLockdown();
  const [notifications, setNotifications] = useState([]);
  const [ready, setReady] = useState(false);
  const userIdRef = useRef(userId);
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (
      lastNotificationResponse &&
      lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const data = lastNotificationResponse.notification.request.content.data;
      if (data?.lockdown && data?.reportId) {
        supabase
          .from('reports')
          .select('id, title, location, user_id, description, image_url, category, severity')
          .eq('id', data.reportId)
          .single()
          .then(({ data: report }) => {
            if (report) {
              triggerLockdown(report, 'background_push');
            }
          })
          .catch(() => {});
      }
    }
  }, [lastNotificationResponse, triggerLockdown]);

  const refresh = useCallback(async () => {
    const list = await loadNotifications();
    setNotifications(list);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const push = useCallback(async (entry) => {
    const next = await addNotification(entry);
    setNotifications(next);
    return next;
  }, []);

  const notifySelfAction = useCallback(async (type, report) => {
    if (!report) return;
    const isResolve = type === NOTIFICATION_TYPES.ALERT_RESOLVED;
    await push({
      type,
      title: isResolve ? 'Alert resolved' : 'Alert deleted',
      body: isResolve
        ? `You marked "${report.title}" as resolved.`
        : `You deleted "${report.title}" from the feed.`,
      dedupeKey: `${type}_${report.id}_${Date.now()}`,
      metadata: { reportId: report.id },
    });
  }, [push]);

  const checkNearbyReports = useCallback(async (reports) => {
    const uid = userIdRef.current;
    if (!uid || !reports?.length) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: uLat, longitude: uLng } = loc.coords;
      const seen = await getNearbySeenIds();

      const active = reports.filter((r) => r.status !== 'resolved' && r.latitude && r.longitude && r.user_id !== uid);

      for (const report of active) {
        if (seen.includes(report.id)) continue;
        const dist = haversineMeters(uLat, uLng, report.latitude, report.longitude);
        if (dist > NEARBY_RADIUS_M) continue;

        await markNearbySeen(report.id);
        const nearbyTitle = 'Situation near you';
        const nearbyBody = `"${report.title}" is about ${Math.round(dist / 100) / 10} km away (${report.category || 'Incident'}).`;
        await push({
          type: NOTIFICATION_TYPES.NEARBY_SITUATION,
          title: nearbyTitle,
          body: nearbyBody,
          dedupeKey: `nearby_${report.id}`,
          metadata: { reportId: report.id, distanceM: Math.round(dist) },
        });
        await firePushNotification(
          nearbyTitle,
          nearbyBody,
          { reportId: report.id },
          NOTIFICATION_TYPES.NEARBY_SITUATION
        );
      }
    } catch {
      // location unavailable
    }
  }, [push]);

  useEffect(() => {
    if (!userId) return undefined;

    const priorityChannel = supabase
      .channel('notification-report-priority')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'report_notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new;
          const uid = userIdRef.current;
          if (!uid || row.user_id !== uid) return;

          const { data: report } = await supabase
            .from('reports')
            .select('id, title, location, user_id, description, image_url, category, severity')
            .eq('id', row.report_id)
            .single();

          if (!report || report.user_id === uid) return;

          const isBleCrisis =
            row.priority === 'crisis' &&
            row.nearby === true &&
            (report.severity ?? '').toLowerCase() === 'crisis';

          if (isBleCrisis) {
            triggerLockdown(report, 'ble');
          }

          const priority = row.priority || 'normal';
          const isCrisis = priority === 'crisis';
          const isCritical = priority === 'critical';
          const isHigh = priority === 'high';
          const type = isCrisis || isCritical
            ? NOTIFICATION_TYPES.NEARBY_CRITICAL
            : isHigh
              ? NOTIFICATION_TYPES.NEARBY_HIGH
              : NOTIFICATION_TYPES.NEARBY_SITUATION;

          const title = isCrisis
            ? '🚨 Crisis Alert — Lockdown'
            : isCritical
              ? 'Incident nearby — immediate attention'
              : isHigh
                ? 'High-priority alert near you'
                : 'New campus alert';

          const body = isCrisis
            ? `"${report.title}" — Crisis level reported very close to you${report.location ? ` at ${report.location}` : ''}. Stay safe.`
            : isCritical
              ? `"${report.title}" was reported very close to you${report.location ? ` at ${report.location}` : ''}.`
              : isHigh
                ? `"${report.title}" is nearby${report.location ? ` at ${report.location}` : ''}.`
                : `"${report.title}" was reported${report.location ? ` at ${report.location}` : ''}.`;

          await push({
            type,
            title,
            body,
            dedupeKey: `priority_${row.report_id}_${priority}`,
            metadata: { reportId: report.id, priority, nearby: row.nearby === true },
          });

          if (!isBleCrisis) {
            await firePushNotification(
              title,
              body,
              {
                reportId: report.id,
                priority,
                nearby: row.nearby === true,
                lockdown: isBleCrisis,
              },
              type
            );
          }
        }
      )
      .subscribe();

    const commentChannel = supabase
      .channel('notification-comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        async (payload) => {
          const comment = payload.new;
          const uid = userIdRef.current;
          if (!uid || comment.user_id === uid) return;

          const { data: report } = await supabase
            .from('reports')
            .select('id, title, user_id')
            .eq('id', comment.report_id)
            .single();

          if (comment.parent_id) {
            const { data: parent } = await supabase
              .from('comments')
              .select('user_id')
              .eq('id', comment.parent_id)
              .single();

            if (parent?.user_id === uid) {
              const title = 'New reply to your comment';
              const body = `Someone replied on "${report?.title || 'an incident'}".`;
              await push({
                type: NOTIFICATION_TYPES.COMMENT_REPLY,
                title,
                body,
                dedupeKey: `reply_${comment.id}`,
                metadata: { reportId: comment.report_id, commentId: comment.id },
              });
              await firePushNotification(title, body, { reportId: comment.report_id }, NOTIFICATION_TYPES.COMMENT_REPLY);
            }
            return;
          }

          if (report?.user_id === uid) {
            const title = 'New comment on your report';
            const body = `Someone commented on "${report.title}".`;
            await push({
              type: NOTIFICATION_TYPES.REPORT_COMMENT,
              title,
              body,
              dedupeKey: `report_comment_${comment.id}`,
              metadata: { reportId: report.id, commentId: comment.id },
            });
            await firePushNotification(title, body, { reportId: report.id }, NOTIFICATION_TYPES.REPORT_COMMENT);
          }
        }
      )
      .subscribe();

    const commentLikeChannel = supabase
      .channel('notification-comment-likes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comment_likes' },
        async (payload) => {
          const like = payload.new;
          const uid = userIdRef.current;
          if (!uid || like.user_id === uid) return;

          const { data: comment } = await supabase
            .from('comments')
            .select('id, user_id, report_id, text')
            .eq('id', like.comment_id)
            .single();

          if (comment?.user_id !== uid) return;

          const { data: report } = await supabase
            .from('reports')
            .select('title')
            .eq('id', comment.report_id)
            .single();

          await push({
            type: NOTIFICATION_TYPES.COMMENT_LIKE,
            title: 'Someone liked your comment',
            body: `Your comment on "${report?.title || 'an incident'}" received a like.`,
            dedupeKey: `comment_like_${like.id}`,
            metadata: { reportId: comment.report_id, commentId: comment.id },
          });
          await firePushNotification(
            'Someone liked your comment',
            `Your comment on "${report?.title || 'an incident'}" received a like.`,
            { reportId: comment.report_id },
            NOTIFICATION_TYPES.COMMENT_LIKE
          );
        }
      )
      .subscribe();

    const reportLikeChannel = supabase
      .channel('notification-report-likes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'report_likes' },
        async (payload) => {
          const like = payload.new;
          const uid = userIdRef.current;
          if (!uid || like.user_id === uid) return;

          const { data: report } = await supabase
            .from('reports')
            .select('id, title, user_id')
            .eq('id', like.report_id)
            .single();

          if (report?.user_id !== uid) return;

          await push({
            type: NOTIFICATION_TYPES.REPORT_LIKE,
            title: 'Someone liked your report',
            body: `"${report.title}" received a like.`,
            dedupeKey: `report_like_${like.id}`,
            metadata: { reportId: report.id },
          });
          await firePushNotification(
            'Someone liked your report',
            `"${report.title}" received a like.`,
            { reportId: report.id },
            NOTIFICATION_TYPES.REPORT_LIKE
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(priorityChannel);
      supabase.removeChannel(commentChannel);
      supabase.removeChannel(commentLikeChannel);
      supabase.removeChannel(reportLikeChannel);
    };
  }, [userId, push, triggerLockdown]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      ready,
      refresh,
      push,
      notifySelfAction,
      checkNearbyReports,
      markRead: async (id) => setNotifications(await markNotificationRead(id)),
      markAllRead: async () => setNotifications(await markAllNotificationsRead()),
    }),
    [notifications, unreadCount, ready, refresh, push, notifySelfAction, checkNearbyReports]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}

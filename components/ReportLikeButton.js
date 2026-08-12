import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchReportLikeMeta, toggleReportLike } from '../lib/likes';
import { supabase } from '../lib/supabase';
import { useFeedback } from '../lib/useFeedback';

export default function ReportLikeButton({ reportId, colors, compact = false }) {
  const { tap, success, error: hapticError, like } = useFeedback();
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  const refresh = useCallback(async () => {
    if (!reportId) return;
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
    const meta = await fetchReportLikeMeta(reportId, user?.id);
    setLikeCount(meta.likeCount);
    setLikedByMe(meta.likedByMe);
  }, [reportId]);

  useEffect(() => {
    refresh();
    if (!reportId) return undefined;

    const channel = supabase
      .channel(`report_likes_${reportId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_likes', filter: `report_id=eq.${reportId}` },
        () => refresh()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [reportId, refresh]);

  const handlePress = async () => {
    if (!userId) {
      Alert.alert('Sign In Required', 'Please sign in to like incident reports.');
      return;
    }
    tap();
    setLoading(true);
    try {
      const next = await toggleReportLike(reportId, userId, likedByMe);
      setLikedByMe(next);
      setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
      if (next) like();
    } catch (err) {
      hapticError();
      Alert.alert('Like Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.btn, compact && styles.btnCompact, { backgroundColor: colors.primaryBg, borderColor: colors.primaryBorder }]}
      onPress={handlePress}
      onPressIn={tap}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <>
          <Ionicons
            name={likedByMe ? 'heart' : 'heart-outline'}
            size={compact ? 16 : 18}
            color={likedByMe ? '#ef4444' : colors.primary}
          />
          <Text style={[styles.label, compact && styles.labelCompact, { color: likedByMe ? '#ef4444' : colors.primary }]}>
            {likeCount > 0 ? `${likeCount}` : 'Like'}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  btnCompact: { paddingHorizontal: 10, paddingVertical: 6 },
  label: { fontSize: 14, fontWeight: '800' },
  labelCompact: { fontSize: 12 },
});

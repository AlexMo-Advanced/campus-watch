import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useFeedback } from '../lib/useFeedback';
import { getCommentAuthorName } from '../lib/commentTree';

const SPRING = { damping: 20, stiffness: 320, mass: 0.85 };

export default function CommentContextMenu({
  visible,
  comment,
  colors,
  isDark,
  onClose,
  onLike,
  onReply,
  onShare,
}) {
  const { tabLongPress, tap, medium } = useFeedback();
  const backdrop = useSharedValue(0);
  const cardScale = useSharedValue(0.88);
  const cardY = useSharedValue(24);

  useEffect(() => {
    if (visible) {
      tabLongPress();
      backdrop.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      cardScale.value = withSpring(1, SPRING);
      cardY.value = withSpring(0, SPRING);
    } else {
      backdrop.value = withTiming(0, { duration: 160 });
      cardScale.value = withTiming(0.92, { duration: 160 });
      cardY.value = withTiming(16, { duration: 160 });
    }
  }, [visible, backdrop, cardScale, cardY, tabLongPress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }, { translateY: cardY.value }],
    opacity: backdrop.value,
  }));

  if (!comment) return null;

  const authorName = getCommentAuthorName(comment);
  const avatarUrl = comment.profiles?.avatar_url;

  const runAction = (fn) => {
    medium();
    fn?.();
    onClose?.();
  };

  const actions = [
    {
      key: 'like',
      label: comment.likedByMe ? 'Unlike' : 'Like',
      icon: comment.likedByMe ? 'heart' : 'heart-outline',
      color: comment.likedByMe ? '#ef4444' : colors.primary,
      onPress: () => runAction(onLike),
    },
    {
      key: 'reply',
      label: 'Reply',
      icon: 'arrow-undo-outline',
      color: colors.primary,
      onPress: () => runAction(onReply),
    },
    {
      key: 'share',
      label: 'Share',
      icon: 'share-outline',
      color: colors.primary,
      onPress: () => runAction(onShare),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.root} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFillObject, backdropStyle]}>
          <BlurView intensity={isDark ? 55 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(2,6,23,0.55)' : 'rgba(15,23,42,0.25)' }]} />
        </Animated.View>

        <Animated.View style={[styles.cardWrap, cardStyle]} pointerEvents="box-none">
          <View style={[styles.commentCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.commentRow}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.placeholder, borderColor: colors.border }]}>
                  <Ionicons name="person" size={16} color={colors.icon} />
                </View>
              )}
              <View style={styles.commentBody}>
                <Text style={[styles.author, { color: colors.textMain }]}>{authorName}</Text>
                <Text style={[styles.body, { color: colors.textBody }]}>{comment.text}</Text>
                {comment.likeCount > 0 && (
                  <Text style={[styles.likeMeta, { color: colors.textMuted }]}>
                    {comment.likeCount} {comment.likeCount === 1 ? 'like' : 'likes'}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={[styles.actionsRow, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.actionBtn}
                onPress={action.onPress}
                onPressIn={tap}
                activeOpacity={0.75}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: colors.primaryBg }]}>
                  <Ionicons name={action.icon} size={20} color={action.color} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.textMain }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 360,
    gap: 14,
  },
  commentCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  commentBody: { flex: 1 },
  author: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  body: { fontSize: 15, lineHeight: 22 },
  likeMeta: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  actionBtn: { alignItems: 'center', gap: 6, minWidth: 72 },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: { fontSize: 12, fontWeight: '700' },
});

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { buildCommentTree, getCommentAuthorName } from '../lib/commentTree';
import {
  fetchCommentsWithLikes,
  toggleCommentLike,
} from '../lib/likes';
import { shareCommentText } from '../lib/shareReport';
import { useFeedback } from '../lib/useFeedback';
import CommentContextMenu from './CommentContextMenu';

function CommentNode({
  node,
  depth,
  colors,
  onReply,
  onLongPress,
  onToggleLike,
  likingId,
}) {
  const authorName = getCommentAuthorName(node);
  const avatarUrl = node.profiles?.avatar_url;
  const indent = Math.min(depth * 18, 72);
  const isLiking = likingId === node.id;

  return (
    <View style={{ marginLeft: indent }}>
      <Pressable
        onLongPress={() => onLongPress(node)}
        delayLongPress={350}
        style={[styles.commentCardRow, depth > 0 && styles.commentReplyRow]}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.commentAvatar} />
        ) : (
          <View style={[styles.commentAvatarPlaceholder, { backgroundColor: colors.placeholder, borderColor: colors.border }]}>
            <Ionicons name="person" size={16} color={colors.icon} />
          </View>
        )}
        <View style={[styles.commentContent, { backgroundColor: colors.headerBg, borderColor: colors.cardBorder }]}>
          <View style={styles.commentHeaderRow}>
            <Text style={[styles.commentAuthorName, { color: colors.textMain }]}>{authorName}</Text>
            <Text style={[styles.commentTimeText, { color: colors.textMuted }]}>
              {new Date(node.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={[styles.commentBodyText, { color: colors.textBody }]}>{node.text}</Text>

          <View style={styles.commentActionsRow}>
            <TouchableOpacity
              style={styles.commentActionBtn}
              onPress={() => onToggleLike(node)}
              disabled={isLiking}
            >
              {isLiking ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons
                    name={node.likedByMe ? 'heart' : 'heart-outline'}
                    size={14}
                    color={node.likedByMe ? '#ef4444' : colors.icon}
                  />
                  {node.likeCount > 0 && (
                    <Text style={[styles.likeCountText, { color: node.likedByMe ? '#ef4444' : colors.textMuted }]}>
                      {node.likeCount}
                    </Text>
                  )}
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.commentActionBtn} onPress={() => onReply(node)}>
              <Ionicons name="arrow-undo-outline" size={14} color={colors.icon} />
              <Text style={[styles.replyActionText, { color: colors.primary }]}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>

      {(node.children || []).map((child) => (
        <CommentNode
          key={child.id}
          node={child}
          depth={depth + 1}
          colors={colors}
          onReply={onReply}
          onLongPress={onLongPress}
          onToggleLike={onToggleLike}
          likingId={likingId}
        />
      ))}
    </View>
  );
}

export default function CommentSection({
  reportId,
  report,
  colors,
  isDark,
  channelPrefix = 'comments',
}) {
  const { tap, tabLongPress, success, error: hapticError, like } = useFeedback();
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [menuComment, setMenuComment] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [likingId, setLikingId] = useState(null);
  const inputRef = useRef(null);

  const loadComments = useCallback(async () => {
    if (!reportId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const data = await fetchCommentsWithLikes(reportId, user?.id);
      setComments(data);
    } catch (err) {
      console.error('Error fetching comments:', err.message);
    }
  }, [reportId]);

  useEffect(() => {
    if (!reportId) {
      setComments([]);
      return undefined;
    }
    loadComments();
    const channel = supabase
      .channel(`${channelPrefix}_${reportId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `report_id=eq.${reportId}` },
        () => loadComments()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_likes' },
        () => loadComments()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [reportId, channelPrefix, loadComments]);

  const handleAddComment = async () => {
    if (!newCommentText.trim() || !reportId) return;
    tap();
    setSubmittingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('comments').insert([
        {
          report_id: reportId,
          text: newCommentText.trim(),
          author_email: user ? user.email : 'Anonymous Student',
          user_id: user ? user.id : null,
          parent_id: replyingTo ? replyingTo.id : null,
        },
      ]);
      if (error) throw error;
      setNewCommentText('');
      setReplyingTo(null);
      success();
      loadComments();
    } catch (err) {
      hapticError();
      Alert.alert('Comment Error', err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = (comment) => {
    tap();
    setReplyingTo({ id: comment.id, name: getCommentAuthorName(comment) });
    inputRef.current?.focus?.();
  };

  const handleLongPress = (comment) => {
    tabLongPress();
    setMenuComment(comment);
    setMenuVisible(true);
  };

  const handleToggleLike = async (comment) => {
    if (!currentUser) {
      Alert.alert('Sign In Required', 'Please sign in to like comments.');
      return;
    }
    tap();
    setLikingId(comment.id);
    try {
      await toggleCommentLike(comment.id, currentUser.id, comment.likedByMe);
      if (!comment.likedByMe) like();
      await loadComments();
    } catch (err) {
      hapticError();
      Alert.alert('Like Error', err.message);
    } finally {
      setLikingId(null);
    }
  };

  const tree = buildCommentTree(comments);

  return (
    <>
      <Text style={[styles.sectionHeaderLabel, { color: colors.textMain }]}>
        Discussion & Updates ({comments.length})
      </Text>

      {comments.length === 0 ? (
        <Text style={[styles.noCommentsText, { color: colors.textMuted }]}>
          No comments yet. Start the conversation below!
        </Text>
      ) : (
        tree.map((node) => (
          <View key={node.id} style={styles.commentThreadContainer}>
            <CommentNode
              node={node}
              depth={0}
              colors={colors}
              onReply={handleReply}
              onLongPress={handleLongPress}
              onToggleLike={handleToggleLike}
              likingId={likingId}
            />
          </View>
        ))
      )}

      {replyingTo && (
        <View style={[styles.replyingBanner, { backgroundColor: colors.primaryBg, borderColor: colors.primaryBorder }]}>
          <Text style={[styles.replyingBannerText, { color: colors.primary }]}>
            Replying to {replyingTo.name}
          </Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close-circle" size={18} color={colors.icon} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.commentInputRow}>
        <TextInput
          ref={inputRef}
          style={[styles.commentInput, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, color: colors.textMain }]}
          placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Write a comment...'}
          placeholderTextColor={colors.textMuted}
          value={newCommentText}
          onChangeText={setNewCommentText}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          onPress={handleAddComment}
          onPressIn={tap}
          disabled={submittingComment || !newCommentText.trim()}
        >
          {submittingComment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <CommentContextMenu
        visible={menuVisible}
        comment={menuComment}
        colors={colors}
        isDark={isDark}
        onClose={() => {
          setMenuVisible(false);
          setMenuComment(null);
        }}
        onLike={() => menuComment && handleToggleLike(menuComment)}
        onReply={() => menuComment && handleReply(menuComment)}
        onShare={() => menuComment && shareCommentText(menuComment, report)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeaderLabel: { fontSize: 16, fontWeight: '800', marginBottom: 12, marginTop: 4 },
  noCommentsText: { fontSize: 13, fontStyle: 'italic', marginBottom: 12 },
  commentThreadContainer: { marginBottom: 8 },
  commentCardRow: { flexDirection: 'row', marginBottom: 10 },
  commentReplyRow: { marginTop: 2 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12, backgroundColor: '#e2e8f0' },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  commentContent: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1 },
  commentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthorName: { fontSize: 13, fontWeight: '700' },
  commentTimeText: { fontSize: 11 },
  commentBodyText: { fontSize: 14, lineHeight: 20 },
  commentActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeCountText: { fontSize: 12, fontWeight: '700' },
  replyActionText: { fontSize: 12, fontWeight: '700' },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  replyingBannerText: { fontSize: 13, fontWeight: '600' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  commentInput: { flex: 1, padding: 12, borderRadius: 8, fontSize: 14, marginRight: 8, borderWidth: 1 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
});

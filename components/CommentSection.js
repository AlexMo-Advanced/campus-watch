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
  ScrollView,
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
import { LinearGradient } from 'expo-linear-gradient';

function CommentNode({
  node,
  depth,
  colors,
  isDark,
  onReply,
  onLongPress,
  onToggleLike,
  likingId,
  isCreator, // Can be passed if we know who the creator of the report is
}) {
  const authorName = getCommentAuthorName(node);
  const avatarUrl = node.profiles?.avatar_url;
  const isLiking = likingId === node.id;
  
  // HTML layout indent matches standard indent sizes, nested depth > 0 is indented with arc
  const isNested = depth > 0;
  
  // Example badge logic (for visual accuracy to HTML, hardcoding creator check to false for now unless we add logic)
  const isCreatorComment = false;

  return (
    <View style={styles.commentNodeWrapper}>
      {isNested && (
        <View style={[styles.connectorArc, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
      )}
      <Pressable
        onLongPress={() => onLongPress(node)}
        delayLongPress={350}
        style={[styles.commentRow, isNested && { paddingLeft: 40, marginTop: 4 }]}
      >
        <View style={styles.commentMainContent}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.commentAvatar} />
            ) : (
              <View style={[styles.commentAvatarPlaceholder, { backgroundColor: isDark ? '#353439' : '#e2e8f0' }]}>
                <Ionicons name="person" size={16} color={colors.icon} />
              </View>
            )}
            {/* Verified badge or Creator ring can be added here if needed */}
          </View>

          {/* Body */}
          <View style={styles.commentBody}>
            <View style={styles.commentHeader}>
              <Text style={[styles.commentAuthorName, { color: colors.textMain }]} numberOfLines={1}>
                {authorName}
              </Text>
              {isCreatorComment && (
                <View style={styles.creatorBadge}>
                  <Text style={styles.creatorBadgeText}>Creator</Text>
                </View>
              )}
              <Text style={[styles.commentTimeText, { color: colors.textMuted }]}>
                {/* Normally we'd use time ago, but standard format for now */}
                {new Date(node.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            
            <Text style={[styles.commentText, { color: colors.textMain }]}>
              {node.text}
            </Text>

            <View style={styles.replyActionRow}>
              <TouchableOpacity onPress={() => onReply(node)}>
                <Text style={[styles.replyActionText, { color: colors.textMuted }]}>Reply</Text>
              </TouchableOpacity>
              {/* Fake Translate action to match HTML */}
              <TouchableOpacity style={styles.translateAction}>
                <Ionicons name="language-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.replyActionText, { color: colors.textMuted, marginLeft: 2 }]}>Translate</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Like Metric aligned right */}
          <View style={styles.likeMetricCol}>
            <TouchableOpacity
              style={styles.likeBtn}
              onPress={() => onToggleLike(node)}
              disabled={isLiking}
            >
              {isLiking ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name={node.likedByMe ? 'heart' : 'heart-outline'}
                  size={18}
                  color={node.likedByMe ? '#ff4e7b' : colors.textMuted}
                />
              )}
            </TouchableOpacity>
            {node.likeCount > 0 && (
              <Text style={[styles.likeCountText, { color: node.likedByMe ? '#ff4e7b' : colors.textMuted }]}>
                {node.likeCount}
              </Text>
            )}
          </View>
        </View>
      </Pressable>

      {(node.children || []).map((child) => (
        <CommentNode
          key={child.id}
          node={child}
          depth={depth + 1}
          colors={colors}
          isDark={isDark}
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
  onClose,
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

  const EMOJI_REACTIONS = ['❤️', '🔥', '👏', '😭', '😮', '🙌'];

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

  const handleAddComment = async (text = newCommentText) => {
    if (!text.trim() || !reportId) return;
    tap();
    setSubmittingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('comments').insert([
        {
          report_id: reportId,
          text: text.trim(),
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

  const handleEmojiReaction = (emoji) => {
    handleAddComment(emoji);
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

  // TikTok style colors
  const primaryBrand = '#ff4e7b'; // Neon pinkish
  const headerBg = isDark ? '#1b1b1f' : '#ffffff';
  const inputBg = isDark ? 'rgba(53,52,57,0.7)' : 'rgba(0,0,0,0.05)';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <View style={styles.container}>
      {/* Drawer Header */}
      <View style={[styles.headerContainer, { borderBottomColor: borderCol }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerCount, { color: colors.textMain }]}>{comments.length}</Text>
            <Text style={[styles.headerSubtext, { color: colors.textMuted }]}>Comments</Text>
          </View>
          {onClose && (
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: inputBg }]} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
          <TouchableOpacity style={[styles.filterPill, styles.filterPillActive]}>
            <Ionicons name="flame" size={14} color="#131317" />
            <Text style={[styles.filterPillText, { color: '#131317', fontWeight: 'bold' }]}>Top</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterPill, { backgroundColor: inputBg }]}>
            <Text style={[styles.filterPillText, { color: colors.textMuted }]}>Newest</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterPill, { backgroundColor: inputBg }]}>
            <Ionicons name="heart" size={12} color={primaryBrand} />
            <Text style={[styles.filterPillText, { color: colors.textMuted }]}>Creator Favorited</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Feed Stream */}
      <ScrollView style={styles.feedScroll} contentContainerStyle={styles.feedContent}>
        {comments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.noCommentsText, { color: colors.textMuted }]}>
              No comments yet. Start the conversation!
            </Text>
          </View>
        ) : (
          tree.map((node) => (
            <View key={node.id} style={styles.threadContainer}>
              <CommentNode
                node={node}
                depth={0}
                colors={colors}
                isDark={isDark}
                onReply={handleReply}
                onLongPress={handleLongPress}
                onToggleLike={handleToggleLike}
                likingId={likingId}
              />
            </View>
          ))
        )}
      </ScrollView>

      {/* Fixed Sticky Input Bar */}
      <View style={[styles.stickyInputArea, { backgroundColor: headerBg }]}>
        
        {/* Replying Banner */}
        {replyingTo && (
          <View style={[styles.replyingBanner, { backgroundColor: inputBg }]}>
            <Text style={[styles.replyingBannerText, { color: colors.textMain }]}>
              Replying to <Text style={{ fontWeight: 'bold' }}>{replyingTo.name}</Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Emoji Strip */}
        <View style={styles.emojiStripRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiScroll}>
            {EMOJI_REACTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => handleEmojiReaction(emoji)} style={styles.emojiBtn}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.gifBtn, { backgroundColor: inputBg }]}>
            <Text style={[styles.gifBtnText, { color: colors.textMuted }]}>GIF</Text>
          </TouchableOpacity>
        </View>

        {/* Input Pill Row */}
        <View style={styles.inputRow}>
          <View style={[styles.currentUserAvatar, { backgroundColor: isDark ? '#353439' : '#e2e8f0' }]}>
            <Ionicons name="person" size={14} color={colors.icon} />
          </View>
          
          <View style={[styles.inputPill, { backgroundColor: inputBg }]}>
            <TextInput
              ref={inputRef}
              style={[styles.inputField, { color: colors.textMain }]}
              placeholder={replyingTo ? `Add a reply...` : 'Add a comment...'}
              placeholderTextColor={colors.textMuted}
              value={newCommentText}
              onChangeText={setNewCommentText}
            />
            <TouchableOpacity style={styles.inputAddonBtn}>
              <Text style={[styles.mentionSymbol, { color: colors.textMuted }]}>@</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inputAddonBtn}>
              <Ionicons name="happy-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.electricSendBtn, { backgroundColor: primaryBrand, shadowColor: primaryBrand }]}
            onPress={() => handleAddComment(newCommentText)}
            onPressIn={tap}
            disabled={submittingComment || !newCommentText.trim()}
          >
            {submittingComment ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCount: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtext: {
    fontSize: 14,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterPillActive: {
    backgroundColor: '#e4e1e7', // Light text color simulating active background in HTML
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedScroll: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  noCommentsText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  threadContainer: {
    marginBottom: 4, // Tighter packing like TikTok
  },
  commentNodeWrapper: {
    position: 'relative',
  },
  connectorArc: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 12,
    width: 16,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderBottomLeftRadius: 12,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  commentMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrapper: {
    marginTop: 2,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentBody: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  commentAuthorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  creatorBadge: {
    backgroundColor: '#00eefc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  creatorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00686f',
  },
  commentTimeText: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  replyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  replyActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  translateAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeMetricCol: {
    alignItems: 'center',
    paddingTop: 4,
    width: 40,
  },
  likeBtn: {
    padding: 2,
  },
  likeCountText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  stickyInputArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyingBannerText: {
    fontSize: 12,
  },
  emojiStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  emojiScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiBtn: {
    padding: 2,
  },
  emojiText: {
    fontSize: 22,
  },
  gifBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  gifBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currentUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 6,
  },
  inputAddonBtn: {
    paddingHorizontal: 4,
  },
  mentionSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  electricSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
});

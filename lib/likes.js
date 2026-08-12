import { supabase } from './supabase';

function attachLikeMeta(comments, likes, userId) {
  const likesByComment = new Map();
  (likes || []).forEach((like) => {
    if (!likesByComment.has(like.comment_id)) {
      likesByComment.set(like.comment_id, []);
    }
    likesByComment.get(like.comment_id).push(like.user_id);
  });

  return comments.map((comment) => {
    const likers = likesByComment.get(comment.id) || [];
    return {
      ...comment,
      likeCount: likers.length,
      likedByMe: userId ? likers.includes(userId) : false,
    };
  });
}

export async function fetchCommentsWithLikes(reportId, userId) {
  const { data: comments, error } = await supabase
    .from('comments')
    .select(`*, profiles:user_id (id, display_name, avatar_url)`)
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!comments?.length) return [];

  const ids = comments.map((c) => c.id);
  const { data: likes, error: likesError } = await supabase
    .from('comment_likes')
    .select('comment_id, user_id')
    .in('comment_id', ids);

  if (likesError) {
    return comments.map((c) => ({ ...c, likeCount: 0, likedByMe: false }));
  }

  return attachLikeMeta(comments, likes, userId);
}

export async function toggleCommentLike(commentId, userId, currentlyLiked) {
  if (!userId) throw new Error('Sign in to like comments.');

  if (currentlyLiked) {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from('comment_likes').insert([
    { comment_id: commentId, user_id: userId },
  ]);
  if (error) throw error;
  return true;
}

export async function fetchReportLikeMeta(reportId, userId) {
  const { data, error } = await supabase
    .from('report_likes')
    .select('user_id')
    .eq('report_id', reportId);

  if (error) {
    return { likeCount: 0, likedByMe: false };
  }

  const likers = (data || []).map((row) => row.user_id);
  return {
    likeCount: likers.length,
    likedByMe: userId ? likers.includes(userId) : false,
  };
}

export async function toggleReportLike(reportId, userId, currentlyLiked) {
  if (!userId) throw new Error('Sign in to like reports.');

  if (currentlyLiked) {
    const { error } = await supabase
      .from('report_likes')
      .delete()
      .eq('report_id', reportId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from('report_likes').insert([
    { report_id: reportId, user_id: userId },
  ]);
  if (error) throw error;
  return true;
}

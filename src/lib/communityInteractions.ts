import { supabase } from '@/lib/supabase';

// 社区互动必须绑定登录用户，统一在这里给出明确错误。
export function requireAuthenticatedCommunityUserId(userId?: string | null) {
  if (!userId) {
    throw new Error('请先登录后再进行社区互动');
  }

  return userId;
}

export async function loadPostInteractionSets(
  postIds: string[],
  userId?: string | null,
) {
  if (!userId || postIds.length === 0) {
    return {
      likedPostIds: new Set<string>(),
      bookmarkedPostIds: new Set<string>(),
    };
  }

  const [likesResult, bookmarksResult] = await Promise.all([
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds),
    supabase
      .from('post_bookmarks')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds),
  ]);

  if (likesResult.error) {
    throw likesResult.error;
  }

  if (bookmarksResult.error) {
    throw bookmarksResult.error;
  }

  return {
    likedPostIds: new Set((likesResult.data ?? []).map((item) => item.post_id)),
    bookmarkedPostIds: new Set(
      (bookmarksResult.data ?? []).map((item) => item.post_id),
    ),
  };
}

export async function loadCommentLikedSet(
  commentIds: string[],
  userId?: string | null,
) {
  if (!userId || commentIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .in('comment_id', commentIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((item) => item.comment_id));
}

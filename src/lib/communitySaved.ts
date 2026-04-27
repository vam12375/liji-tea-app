import { loadPostInteractionSets } from "@/lib/communityInteractions";
import { mapPost, POST_SELECT, type PostRow } from "@/lib/communityModels";
import { supabase } from "@/lib/supabase";
import type { Post } from "@/stores/communityStore";

// 社区收藏页需要按收藏时间而不是发帖时间排序，因此单独走收藏关系表查询。
export async function fetchSavedCommunityPosts(userId: string): Promise<Post[]> {
  const { data: bookmarkRows, error: bookmarkError } = await supabase
    .from("post_bookmarks")
    .select("post_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (bookmarkError) {
    throw bookmarkError;
  }

  const postIds = (bookmarkRows ?? []).map((row) => row.post_id);
  if (postIds.length === 0) {
    return [];
  }

  const { data: postRows, error: postError } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", postIds);

  if (postError) {
    throw postError;
  }

  const { likedPostIds, bookmarkedPostIds } = await loadPostInteractionSets(
    postIds,
    userId,
  );
  const bookmarkOrder = new Map(
    postIds.map((postId, index) => [postId, index] as const),
  );

  return ((postRows ?? []) as PostRow[])
    .map((post) => mapPost(post, { likedPostIds, bookmarkedPostIds }))
    .sort(
      (left, right) =>
        (bookmarkOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (bookmarkOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
}

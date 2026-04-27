import {
  mergeCommunityPostsForPagination,
  mergeCommunityPostsForRefresh,
} from '@/lib/communityFeed';
import {
  loadCommentLikedSet,
  loadPostInteractionSets,
  requireAuthenticatedCommunityUserId,
} from '@/lib/communityInteractions';
import {
  buildCommentThreads,
  COMMENT_SELECT,
  POST_PAGE_SIZE,
  POST_SELECT,
  mapPost,
  upsertCommunityPost,
  type CommentRow,
  type PostRow,
} from '@/lib/communityModels';
import { logWarn } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type {
  CommunityState,
  CommunityStoreGet,
  CommunityStoreSet,
} from '@/stores/communityStore.types';
import { useMemberPointsStore } from '@/stores/memberPointsStore';
import { useUserStore } from '@/stores/userStore';
// 兼容旧版 posts.author 冗余列：优先使用当前昵称，缺失时回退到稳定占位名。
function buildLegacyPostAuthorName(userId: string) {
  const displayName = useUserStore.getState().name.trim();
  return displayName || `茶友${userId.slice(-4)}`;
}

function getSupabaseErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return '';
}

// 某些环境可能尚未执行 author 兼容迁移，此时回退到不带 author 的插入以兼容纯 author_id 结构。
function isMissingLegacyAuthorColumnError(error: unknown) {
  const message = getSupabaseErrorMessage(error).toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes('author') &&
    message.includes('posts') &&
    (message.includes('schema cache') || message.includes('column'))
  );
}

// 发帖成功后补一层幂等积分发放：若数据库触发器已执行，则这里会返回 already_completed。
async function ensureFirstPostReward(userId: string, postId: string) {
  const { data, error } = await supabase.rpc('grant_points_for_task', {
    p_user_id: userId,
    p_task_code: 'first_post',
    p_source_type: 'post',
    p_source_id: postId,
    p_remark: '首次发帖奖励',
  });

  if (error) {
    logWarn('communityStore', '首次发帖积分补偿失败', {
      error: error.message,
      userId,
      postId,
    });
    return;
  }

  if (
    data &&
    typeof data === 'object' &&
    'success' in data &&
    data.success === false &&
    'reason' in data &&
    data.reason !== 'already_completed'
  ) {
    logWarn('communityStore', '首次发帖积分未发放', {
      userId,
      postId,
      reason: String(data.reason),
    });
  }
}

// 帖子域动作：主 feed、我的帖子、分页、详情与发帖 / 删帖。
export function createCommunityPostsActions(
  set: CommunityStoreSet,
  get: CommunityStoreGet,
): Pick<
  CommunityState,
  | 'fetchPosts'
  | 'fetchMyPosts'
  | 'loadMorePosts'
  | 'fetchPostDetail'
  | 'createPost'
  | 'deletePost'
> {
  return {
    fetchPosts: async (loadMore = false) => {
      try {
        set({ loading: true });
        const userId = useUserStore.getState().session?.user?.id;
        const currentPage = loadMore ? get().postsPage : 0;
        const from = currentPage * POST_PAGE_SIZE;
        const to = from + POST_PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('posts')
          .select(POST_SELECT)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          throw error;
        }

        const postIds = (data ?? []).map((post) => post.id);
        const { likedPostIds, bookmarkedPostIds } = await loadPostInteractionSets(
          postIds,
          userId,
        );
        const newPosts = ((data ?? []) as PostRow[]).map((post) =>
          mapPost(post, { likedPostIds, bookmarkedPostIds }),
        );
        const hasMorePosts = newPosts.length >= POST_PAGE_SIZE;

        if (loadMore) {
          set((state) => ({
            posts: mergeCommunityPostsForPagination(state.posts, newPosts),
            likedPostIds: new Set([...state.likedPostIds, ...likedPostIds]),
            bookmarkedPostIds: new Set([
              ...state.bookmarkedPostIds,
              ...bookmarkedPostIds,
            ]),
            hasMorePosts,
            postsPage: currentPage + 1,
            loading: false,
          }));
        } else {
          set((state) => ({
            posts: mergeCommunityPostsForRefresh(state.posts, newPosts),
            likedPostIds,
            bookmarkedPostIds,
            hasMorePosts,
            postsPage: 1,
            loading: false,
          }));
        }
      } catch (error) {
        logWarn('communityStore', 'fetchPosts 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          posts: loadMore ? get().posts : [],
          likedPostIds: loadMore ? get().likedPostIds : new Set<string>(),
          bookmarkedPostIds: loadMore
            ? get().bookmarkedPostIds
            : new Set<string>(),
          loading: false,
        });
      }
    },

    fetchMyPosts: async () => {
      try {
        set({ loading: true });
        const userId = useUserStore.getState().session?.user?.id;

        if (!userId) {
          set({
            posts: [],
            likedPostIds: new Set<string>(),
            bookmarkedPostIds: new Set<string>(),
            hasMorePosts: false,
            postsPage: 0,
            loading: false,
          });
          return;
        }

        const { data, error } = await supabase
          .from('posts')
          .select(POST_SELECT)
          .eq('author_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        const postIds = (data ?? []).map((post) => post.id);
        const { likedPostIds, bookmarkedPostIds } = await loadPostInteractionSets(
          postIds,
          userId,
        );
        const posts = ((data ?? []) as PostRow[]).map((post) =>
          mapPost(post, { likedPostIds, bookmarkedPostIds }),
        );

        set({
          posts,
          likedPostIds,
          bookmarkedPostIds,
          hasMorePosts: false,
          postsPage: 0,
          loading: false,
        });
      } catch (error) {
        logWarn('communityStore', 'fetchMyPosts 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        set({
          posts: [],
          likedPostIds: new Set<string>(),
          bookmarkedPostIds: new Set<string>(),
          hasMorePosts: false,
          postsPage: 0,
          loading: false,
        });
      }
    },

    loadMorePosts: async () => {
      const { loading, hasMorePosts } = get();
      if (loading || !hasMorePosts) {
        return;
      }

      await get().fetchPosts(true);
    },

    fetchPostDetail: async (postId) => {
      try {
        set({ detailLoading: true });
        const userId = useUserStore.getState().session?.user?.id;

        const [postResult, commentResult] = await Promise.all([
          supabase.from('posts').select(POST_SELECT).eq('id', postId).single(),
          supabase
            .from('post_comments')
            .select(COMMENT_SELECT)
            .eq('post_id', postId)
            .order('created_at', { ascending: true }),
        ]);

        if (postResult.error) {
          throw postResult.error;
        }

        if (commentResult.error) {
          throw commentResult.error;
        }

        const postRow = postResult.data as PostRow;
        const commentRows = (commentResult.data ?? []) as CommentRow[];
        const commentIds = commentRows.map((comment) => comment.id);
        const [postInteractions, likedCommentIds] = await Promise.all([
          loadPostInteractionSets([postId], userId),
          loadCommentLikedSet(commentIds, userId),
        ]);

        // 详情页统一使用线程化评论结构，便于后续直接展示回复关系。
        const commentList = buildCommentThreads(commentRows, likedCommentIds);
        const detailedPost = mapPost(postRow, {
          likedPostIds: postInteractions.likedPostIds,
          bookmarkedPostIds: postInteractions.bookmarkedPostIds,
          commentList,
        });

        set((state) => {
          const likedPostIds = new Set(state.likedPostIds);
          const bookmarkedPostIds = new Set(state.bookmarkedPostIds);

          if (postInteractions.likedPostIds.has(postId)) {
            likedPostIds.add(postId);
          } else {
            likedPostIds.delete(postId);
          }

          if (postInteractions.bookmarkedPostIds.has(postId)) {
            bookmarkedPostIds.add(postId);
          } else {
            bookmarkedPostIds.delete(postId);
          }

          return {
            posts: upsertCommunityPost(state.posts, detailedPost),
            activePost: detailedPost,
            likedPostIds,
            likedCommentIds,
            bookmarkedPostIds,
            detailLoading: false,
          };
        });

        return detailedPost;
      } catch (error) {
        logWarn('communityStore', 'fetchPostDetail 失败', {
          error: error instanceof Error ? error.message : String(error),
        });
        set({ activePost: null, detailLoading: false });
        return null;
      }
    },

    createPost: async (input) => {
      const userId = requireAuthenticatedCommunityUserId(
        useUserStore.getState().session?.user?.id,
      );
      const authorName = buildLegacyPostAuthorName(userId);
      const insertPayload = {
        author_id: userId,
        author: authorName,
        type: input.type,
        location: input.location ?? null,
        image_url: input.image ?? null,
        caption: input.caption ?? null,
        tea_name: input.teaName ?? null,
        brewing_data: input.brewingData ?? null,
        brewing_images: input.brewingImages ?? [],
        quote: input.quote ?? null,
        title: input.title ?? null,
        description: input.description ?? null,
      };

      try {
        set({ submitting: true });
        let { data, error } = await supabase
          .from('posts')
          .insert(insertPayload)
          .select(POST_SELECT)
          .single();

        if (error && isMissingLegacyAuthorColumnError(error)) {
          logWarn('communityStore', 'posts.author 兼容列不存在，回退为仅写 author_id', {
            error: error.message,
          });
          ({ data, error } = await supabase
            .from('posts')
            .insert({
              ...insertPayload,
              author: undefined,
            })
            .select(POST_SELECT)
            .single());
        }

        if (error) {
          throw error;
        }

        const post = mapPost(data as PostRow, {
          likedPostIds: new Set<string>(),
          bookmarkedPostIds: new Set<string>(),
        });

        set((state) => ({
          posts: [post, ...state.posts],
          submitting: false,
        }));

        // 发帖成功后主动补偿一次首次发帖积分，并刷新任务中心与个人积分展示。
        await ensureFirstPostReward(userId, post.id);
        await Promise.allSettled([
          useMemberPointsStore.getState().fetchMemberPointsData(),
          useUserStore.getState().fetchProfile(),
        ]);

        return post;
      } catch (error) {
        set({ submitting: false });
        throw error;
      }
    },

    deletePost: async (postId) => {
      const userId = requireAuthenticatedCommunityUserId(
        useUserStore.getState().session?.user?.id,
      );
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('author_id', userId);

      if (error) {
        throw error;
      }

      set((state) => ({
        posts: state.posts.filter((post) => post.id !== postId),
        activePost: state.activePost?.id === postId ? null : state.activePost,
      }));
    },
  };
}

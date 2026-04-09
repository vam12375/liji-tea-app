import { create } from 'zustand';

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
  COMMENT_SELECT,
  POST_PAGE_SIZE,
  POST_SELECT,
  STORY_SELECT,
  mapComment,
  mapPost,
  mapStory,
  upsertCommunityPost,
  type Comment,
  type CommentRow,
  type BrewingData,
  type Post,
  type PostRow,
  type Story,
  type StoryRow,
} from '@/lib/communityModels';
import { logWarn } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import type { CommunityPostType } from '@/types/database';
export type { Comment, Post, Story } from '@/lib/communityModels';

export interface CreatePostInput {
  type: CommunityPostType;
  location?: string;
  image?: string;
  caption?: string;
  teaName?: string;
  brewingData?: BrewingData;
  brewingImages?: string[];
  quote?: string;
  title?: string;
  description?: string;
}

interface CommunityState {
  stories: Story[];
  posts: Post[];
  activePost: Post | null;
  loading: boolean;
  storiesLoading: boolean;
  detailLoading: boolean;
  submitting: boolean;
  likedPostIds: Set<string>;
  likedCommentIds: Set<string>;
  bookmarkedPostIds: Set<string>;
  hasMorePosts: boolean;
  postsPage: number;
  fetchStories: () => Promise<void>;
  fetchPosts: (loadMore?: boolean) => Promise<void>;
  fetchMyPosts: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  fetchPostDetail: (postId: string) => Promise<Post | null>;
  createPost: (input: CreatePostInput) => Promise<Post>;
  togglePostLike: (postId: string) => Promise<void>;
  togglePostBookmark: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<Comment | null>;
  toggleCommentLike: (postId: string, commentId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  markStoryViewed: (storyId: string) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>()((set, get) => ({
  stories: [],
  posts: [],
  activePost: null,
  loading: false,
  storiesLoading: false,
  detailLoading: false,
  submitting: false,
  likedPostIds: new Set<string>(),
  likedCommentIds: new Set<string>(),
  bookmarkedPostIds: new Set<string>(),
  hasMorePosts: true,
  postsPage: 0,

  fetchStories: async () => {
    try {
      set({ storiesLoading: true });
      const userId = useUserStore.getState().session?.user?.id;
      const { data, error } = await supabase
        .from('stories')
        .select(STORY_SELECT)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        throw error;
      }

      const storyIds = (data ?? []).map((story) => story.id);
      let viewedIds = new Set<string>();

      if (userId && storyIds.length > 0) {
        const { data: viewRows, error: viewsError } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('user_id', userId)
          .in('story_id', storyIds);

        if (viewsError) {
          throw viewsError;
        }

        viewedIds = new Set((viewRows ?? []).map((row) => row.story_id));
      }

      set({
        stories: ((data ?? []) as StoryRow[]).map((story) => mapStory(story, viewedIds)),
        storiesLoading: false,
      });
    } catch (error) {
      logWarn('communityStore', 'fetchStories 失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      set({ stories: [], storiesLoading: false });
    }
  },

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
      const { likedPostIds, bookmarkedPostIds } = await loadPostInteractionSets(postIds, userId);
      const newPosts = ((data ?? []) as PostRow[]).map((post) =>
        mapPost(post, { likedPostIds, bookmarkedPostIds }),
      );
      const hasMorePosts = newPosts.length >= POST_PAGE_SIZE;

      if (loadMore) {
        set((state) => ({
          posts: mergeCommunityPostsForPagination(state.posts, newPosts),
          likedPostIds: new Set([...state.likedPostIds, ...likedPostIds]),
          bookmarkedPostIds: new Set([...state.bookmarkedPostIds, ...bookmarkedPostIds]),
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
        bookmarkedPostIds: loadMore ? get().bookmarkedPostIds : new Set<string>(),
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
      const { likedPostIds, bookmarkedPostIds } = await loadPostInteractionSets(postIds, userId);
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

      const commentList = commentRows.map((comment) => mapComment(comment, likedCommentIds));
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

    try {
      set({ submitting: true });
      const { data, error } = await supabase
        .from('posts')
        .insert({
          author_id: userId,
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
        })
        .select(POST_SELECT)
        .single();

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

      return post;
    } catch (error) {
      set({ submitting: false });
      throw error;
    }
  },

  togglePostLike: async (postId) => {
    const userId = requireAuthenticatedCommunityUserId(
      useUserStore.getState().session?.user?.id,
    );
    const state = get();
    const isLiked = state.likedPostIds.has(postId);

    if (isLiked) {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase.from('post_likes').insert({
        post_id: postId,
        user_id: userId,
      });

      if (error) {
        throw error;
      }
    }

    set((current) => {
      const likedPostIds = new Set(current.likedPostIds);
      if (isLiked) {
        likedPostIds.delete(postId);
      } else {
        likedPostIds.add(postId);
      }

      const updatePost = (post: Post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !isLiked,
              likes: Math.max(0, post.likes + (isLiked ? -1 : 1)),
            }
          : post;

      return {
        likedPostIds,
        posts: current.posts.map(updatePost),
        activePost:
          current.activePost?.id === postId ? updatePost(current.activePost) : current.activePost,
      };
    });
  },

  togglePostBookmark: async (postId) => {
    const userId = requireAuthenticatedCommunityUserId(
      useUserStore.getState().session?.user?.id,
    );
    const state = get();
    const isBookmarked = state.bookmarkedPostIds.has(postId);

    if (isBookmarked) {
      const { error } = await supabase
        .from('post_bookmarks')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase.from('post_bookmarks').insert({
        post_id: postId,
        user_id: userId,
      });

      if (error) {
        throw error;
      }
    }

    set((current) => {
      const bookmarkedPostIds = new Set(current.bookmarkedPostIds);
      if (isBookmarked) {
        bookmarkedPostIds.delete(postId);
      } else {
        bookmarkedPostIds.add(postId);
      }

      const updatePost = (post: Post) =>
        post.id === postId
          ? {
              ...post,
              isBookmarked: !isBookmarked,
            }
          : post;

      return {
        bookmarkedPostIds,
        posts: current.posts.map(updatePost),
        activePost:
          current.activePost?.id === postId ? updatePost(current.activePost) : current.activePost,
      };
    });
  },

  addComment: async (postId, content) => {
    const userId = requireAuthenticatedCommunityUserId(
      useUserStore.getState().session?.user?.id,
    );

    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: userId,
        content,
      })
      .select(COMMENT_SELECT)
      .single();

    if (error) {
      throw error;
    }

    const comment = mapComment(data as CommentRow, get().likedCommentIds);

    set((state) => {
      const posts = state.posts.map((post) =>
        post.id === postId ? { ...post, comments: post.comments + 1 } : post,
      );

      const activePost =
        state.activePost?.id === postId
          ? {
              ...state.activePost,
              comments: state.activePost.comments + 1,
              commentList: [...(state.activePost.commentList ?? []), comment],
            }
          : state.activePost;

      return { posts, activePost };
    });

    return comment;
  },

  toggleCommentLike: async (postId, commentId) => {
    const userId = requireAuthenticatedCommunityUserId(
      useUserStore.getState().session?.user?.id,
    );
    const isLiked = get().likedCommentIds.has(commentId);

    if (isLiked) {
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase.from('comment_likes').insert({
        comment_id: commentId,
        user_id: userId,
      });

      if (error) {
        throw error;
      }
    }

    set((state) => {
      const likedCommentIds = new Set(state.likedCommentIds);
      if (isLiked) {
        likedCommentIds.delete(commentId);
      } else {
        likedCommentIds.add(commentId);
      }

      const updateComment = (comment: Comment) =>
        comment.id === commentId
          ? {
              ...comment,
              isLiked: !isLiked,
              likes: Math.max(0, comment.likes + (isLiked ? -1 : 1)),
            }
          : comment;

      const activePost =
        state.activePost?.id === postId
          ? {
              ...state.activePost,
              commentList: state.activePost.commentList?.map(updateComment),
            }
          : state.activePost;

      return { likedCommentIds, activePost };
    });
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

  markStoryViewed: async (storyId) => {
    set((state) => ({
      stories: state.stories.map((story) =>
        story.id === storyId ? { ...story, isViewed: true } : story,
      ),
    }));

    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      return;
    }

    const { error } = await supabase.from('story_views').upsert(
      {
        story_id: storyId,
        user_id: userId,
      },
      { onConflict: 'story_id,user_id' },
    );

    if (error) {
            logWarn('communityStore', 'markStoryViewed 失败', {
              error: error instanceof Error ? error.message : String(error),
            });
    }
  },
}));

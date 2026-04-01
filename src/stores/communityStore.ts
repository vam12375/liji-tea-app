import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import type { CommunityPostType } from '@/types/database';

const POST_SELECT = `
  id,
  author_id,
  type,
  location,
  image_url,
  caption,
  tea_name,
  brewing_data,
  brewing_images,
  quote,
  title,
  description,
  like_count,
  comment_count,
  created_at,
  updated_at,
  author:profiles!posts_author_id_fkey (
    id,
    name,
    avatar_url
  )
`;

const STORY_SELECT = `
  id,
  author_id,
  image_url,
  caption,
  expires_at,
  created_at,
  updated_at,
  author:profiles!stories_author_id_fkey (
    id,
    name,
    avatar_url
  )
`;

const COMMENT_SELECT = `
  id,
  post_id,
  author_id,
  parent_id,
  content,
  like_count,
  created_at,
  updated_at,
  author:profiles!post_comments_author_id_fkey (
    id,
    name,
    avatar_url
  )
`;

/** 前端 Story 类型 */
export interface Story {
  id: string;
  authorId: string;
  name: string;
  avatar: string;
  image?: string;
  caption?: string;
  createdAt: string;
  isViewed: boolean;
}

/** 评论类型 */
export interface Comment {
  id: string;
  authorId: string;
  author: string;
  avatar: string;
  content: string;
  time: string;
  createdAt: string;
  likes: number;
  isLiked: boolean;
}

/** 前端 Post 类型 */
export interface Post {
  id: string;
  authorId: string;
  type: CommunityPostType;
  author: string;
  avatar: string;
  time: string;
  createdAt: string;
  location?: string;
  image?: string;
  caption?: string;
  likes: number;
  comments: number;
  teaName?: string;
  brewingData?: { temp?: string; time?: string; amount?: string };
  brewingImages?: string[];
  quote?: string;
  title?: string;
  description?: string;
  answerCount?: number;
  commentList?: Comment[];
  isLiked: boolean;
  isBookmarked: boolean;
}

export interface CreatePostInput {
  type: CommunityPostType;
  location?: string;
  image?: string;
  caption?: string;
  teaName?: string;
  brewingData?: { temp?: string; time?: string; amount?: string };
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
  fetchStories: () => Promise<void>;
  fetchPosts: () => Promise<void>;
  fetchPostDetail: (postId: string) => Promise<Post | null>;
  createPost: (input: CreatePostInput) => Promise<Post>;
  togglePostLike: (postId: string) => Promise<void>;
  togglePostBookmark: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string) => Promise<Comment | null>;
  toggleCommentLike: (postId: string, commentId: string) => Promise<void>;
  markStoryViewed: (storyId: string) => Promise<void>;
}

function getRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildFallbackName(authorId: string) {
  return `茶友${authorId.slice(-4)}`;
}

function buildAvatar(name: string, avatarUrl?: string | null) {
  if (avatarUrl) return avatarUrl;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8B5E3C&color=fff&size=100&font-size=0.4`;
}

function formatRelativeTime(iso?: string | null) {
  if (!iso) return '';
  const createdAt = new Date(iso).getTime();
  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffHours < 48) return '昨天';

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}天前`;

  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
}

function mapStory(row: any, viewedIds: Set<string>): Story {
  const author = getRelation(row.author);
  const name = author?.name?.trim() || buildFallbackName(row.author_id);

  return {
    id: row.id,
    authorId: row.author_id,
    name,
    avatar: buildAvatar(name, author?.avatar_url),
    image: row.image_url ?? undefined,
    caption: row.caption ?? undefined,
    createdAt: row.created_at,
    isViewed: viewedIds.has(row.id),
  };
}

function mapComment(row: any, likedCommentIds: Set<string>): Comment {
  const author = getRelation(row.author);
  const name = author?.name?.trim() || buildFallbackName(row.author_id);

  return {
    id: row.id,
    authorId: row.author_id,
    author: name,
    avatar: buildAvatar(name, author?.avatar_url),
    content: row.content,
    time: formatRelativeTime(row.created_at),
    createdAt: row.created_at,
    likes: row.like_count ?? 0,
    isLiked: likedCommentIds.has(row.id),
  };
}

function mapPost(row: any, options?: { likedPostIds?: Set<string>; bookmarkedPostIds?: Set<string>; commentList?: Comment[] }): Post {
  const author = getRelation(row.author);
  const name = author?.name?.trim() || buildFallbackName(row.author_id);
  const likedPostIds = options?.likedPostIds ?? new Set<string>();
  const bookmarkedPostIds = options?.bookmarkedPostIds ?? new Set<string>();
  const comments = row.comment_count ?? 0;

  return {
    id: row.id,
    authorId: row.author_id,
    type: row.type,
    author: name,
    avatar: buildAvatar(name, author?.avatar_url),
    time: formatRelativeTime(row.created_at),
    createdAt: row.created_at,
    location: row.location ?? undefined,
    image: row.image_url ?? undefined,
    caption: row.caption ?? undefined,
    likes: row.like_count ?? 0,
    comments,
    teaName: row.tea_name ?? undefined,
    brewingData: row.brewing_data ?? undefined,
    brewingImages: row.brewing_images?.length ? row.brewing_images : undefined,
    quote: row.quote ?? undefined,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    answerCount: row.type === 'question' ? comments : undefined,
    commentList: options?.commentList,
    isLiked: likedPostIds.has(row.id),
    isBookmarked: bookmarkedPostIds.has(row.id),
  };
}

function upsertPost(posts: Post[], nextPost: Post) {
  const index = posts.findIndex((post) => post.id === nextPost.id);
  if (index === -1) return [nextPost, ...posts];
  const next = [...posts];
  next[index] = nextPost;
  return next;
}

function requireUserId() {
  const userId = useUserStore.getState().session?.user?.id;
  if (!userId) {
    throw new Error('请先登录后再进行社区互动');
  }
  return userId;
}

async function loadPostInteractionSets(postIds: string[], userId?: string | null) {
  if (!userId || postIds.length === 0) {
    return {
      likedPostIds: new Set<string>(),
      bookmarkedPostIds: new Set<string>(),
    };
  }

  const [likesResult, bookmarksResult] = await Promise.all([
    supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
    supabase.from('post_bookmarks').select('post_id').eq('user_id', userId).in('post_id', postIds),
  ]);

  if (likesResult.error) throw likesResult.error;
  if (bookmarksResult.error) throw bookmarksResult.error;

  return {
    likedPostIds: new Set((likesResult.data ?? []).map((item) => item.post_id)),
    bookmarkedPostIds: new Set((bookmarksResult.data ?? []).map((item) => item.post_id)),
  };
}

async function loadCommentLikedSet(commentIds: string[], userId?: string | null) {
  if (!userId || commentIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .in('comment_id', commentIds);

  if (error) throw error;
  return new Set((data ?? []).map((item) => item.comment_id));
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

  fetchStories: async () => {
    try {
      set({ storiesLoading: true });
      const userId = useUserStore.getState().session?.user?.id;
      const { data, error } = await supabase
        .from('stories')
        .select(STORY_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const storyIds = (data ?? []).map((story) => story.id);
      let viewedIds = new Set<string>();

      if (userId && storyIds.length > 0) {
        const { data: viewRows, error: viewsError } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('user_id', userId)
          .in('story_id', storyIds);

        if (viewsError) throw viewsError;
        viewedIds = new Set((viewRows ?? []).map((row) => row.story_id));
      }

      set({
        stories: (data ?? []).map((story) => mapStory(story, viewedIds)),
        storiesLoading: false,
      });
    } catch (error) {
      console.warn('[communityStore] fetchStories 失败:', error);
      set({ stories: [], storiesLoading: false });
    }
  },

  fetchPosts: async () => {
    try {
      set({ loading: true });
      const userId = useUserStore.getState().session?.user?.id;
      const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const postIds = (data ?? []).map((post) => post.id);
      const { likedPostIds, bookmarkedPostIds } = await loadPostInteractionSets(postIds, userId);

      set({
        posts: (data ?? []).map((post) => mapPost(post, { likedPostIds, bookmarkedPostIds })),
        likedPostIds,
        bookmarkedPostIds,
        loading: false,
      });
    } catch (error) {
      console.warn('[communityStore] fetchPosts 失败:', error);
      set({
        posts: [],
        likedPostIds: new Set<string>(),
        bookmarkedPostIds: new Set<string>(),
        loading: false,
      });
    }
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

      if (postResult.error) throw postResult.error;
      if (commentResult.error) throw commentResult.error;

      const postRow = postResult.data;
      const commentRows = commentResult.data ?? [];
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

        if (postInteractions.likedPostIds.has(postId)) likedPostIds.add(postId);
        else likedPostIds.delete(postId);

        if (postInteractions.bookmarkedPostIds.has(postId)) bookmarkedPostIds.add(postId);
        else bookmarkedPostIds.delete(postId);

        return {
          posts: upsertPost(state.posts, detailedPost),
          activePost: detailedPost,
          likedPostIds,
          likedCommentIds,
          bookmarkedPostIds,
          detailLoading: false,
        };
      });


      return detailedPost;
    } catch (error) {
      console.warn('[communityStore] fetchPostDetail 失败:', error);
      set({ activePost: null, detailLoading: false });
      return null;
    }
  },

  createPost: async (input) => {
    const userId = requireUserId();

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

      if (error) throw error;

      const newPost = mapPost(data, {
        likedPostIds: new Set<string>(),
        bookmarkedPostIds: new Set<string>(),
        commentList: [],
      });

      set((state) => ({
        posts: [newPost, ...state.posts],
        activePost: newPost,
        submitting: false,
      }));

      return newPost;
    } catch (error: any) {
      set({ submitting: false });
      console.warn('[communityStore] createPost 失败:', error);
      throw new Error(error?.message ?? '发布失败，请稍后重试');
    }
  },

  togglePostLike: async (postId) => {
    const userId = requireUserId();
    const isLiked = get().likedPostIds.has(postId);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: userId });

        if (error) throw error;
      }

      set((state) => {
        const likedPostIds = new Set(state.likedPostIds);
        if (isLiked) likedPostIds.delete(postId);
        else likedPostIds.add(postId);

        const updatePostLikes = (post: Post) => ({
          ...post,
          likes: Math.max(0, post.likes + (isLiked ? -1 : 1)),
          isLiked: !isLiked,
        });

        return {
          likedPostIds,
          posts: state.posts.map((post) => (post.id === postId ? updatePostLikes(post) : post)),
          activePost: state.activePost?.id === postId ? updatePostLikes(state.activePost) : state.activePost,
        };
      });
    } catch (error: any) {
      console.warn('[communityStore] togglePostLike 失败:', error);
      throw new Error(error?.message ?? '点赞失败，请稍后重试');
    }
  },

  togglePostBookmark: async (postId) => {
    const userId = requireUserId();
    const isBookmarked = get().bookmarkedPostIds.has(postId);

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from('post_bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_bookmarks')
          .insert({ post_id: postId, user_id: userId });

        if (error) throw error;
      }

      set((state) => {
        const bookmarkedPostIds = new Set(state.bookmarkedPostIds);
        if (isBookmarked) bookmarkedPostIds.delete(postId);
        else bookmarkedPostIds.add(postId);

        const updatePostBookmark = (post: Post) => ({
          ...post,
          isBookmarked: !isBookmarked,
        });

        return {
          bookmarkedPostIds,
          posts: state.posts.map((post) => (post.id === postId ? updatePostBookmark(post) : post)),
          activePost: state.activePost?.id === postId ? updatePostBookmark(state.activePost) : state.activePost,
        };
      });
    } catch (error: any) {
      console.warn('[communityStore] togglePostBookmark 失败:', error);
      throw new Error(error?.message ?? '收藏失败，请稍后重试');
    }
  },

  addComment: async (postId, content) => {
    const userId = requireUserId();

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: userId,
          content,
        })
        .select(COMMENT_SELECT)
        .single();

      if (error) throw error;

      const newComment = mapComment(data, get().likedCommentIds);

      set((state) => {
        const appendComment = (post: Post) => ({
          ...post,
          comments: post.comments + 1,
          answerCount: post.type === 'question' ? (post.answerCount ?? post.comments) + 1 : post.answerCount,
          commentList: [...(post.commentList ?? []), newComment],
        });

        return {
          posts: state.posts.map((post) => (post.id === postId ? appendComment(post) : post)),
          activePost: state.activePost?.id === postId ? appendComment(state.activePost) : state.activePost,
        };
      });

      return newComment;
    } catch (error: any) {
      console.warn('[communityStore] addComment 失败:', error);
      throw new Error(error?.message ?? '评论发布失败，请稍后重试');
    }
  },

  toggleCommentLike: async (postId, commentId) => {
    const userId = requireUserId();
    const isLiked = get().likedCommentIds.has(commentId);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: userId });

        if (error) throw error;
      }

      set((state) => {
        const likedCommentIds = new Set(state.likedCommentIds);
        if (isLiked) likedCommentIds.delete(commentId);
        else likedCommentIds.add(commentId);

        const updateComment = (comment: Comment) =>
          comment.id === commentId
            ? {
                ...comment,
                likes: Math.max(0, comment.likes + (isLiked ? -1 : 1)),
                isLiked: !isLiked,
              }
            : comment;

        const updatePostComments = (post: Post) => ({
          ...post,
          commentList: post.commentList?.map(updateComment),
        });

        return {
          likedCommentIds,
          posts: state.posts.map((post) => (post.id === postId ? updatePostComments(post) : post)),
          activePost: state.activePost?.id === postId ? updatePostComments(state.activePost) : state.activePost,
        };
      });
    } catch (error: any) {
      console.warn('[communityStore] toggleCommentLike 失败:', error);
      throw new Error(error?.message ?? '评论点赞失败，请稍后重试');
    }
  },

  markStoryViewed: async (storyId) => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId || get().stories.find((story) => story.id === storyId)?.isViewed) {
      return;
    }

    try {
      const { error } = await supabase
        .from('story_views')
        .upsert({ story_id: storyId, user_id: userId }, { onConflict: 'story_id,user_id', ignoreDuplicates: true });

      if (error) throw error;

      set((state) => ({
        stories: state.stories.map((story) =>
          story.id === storyId ? { ...story, isViewed: true } : story
        ),
      }));
    } catch (error) {
      console.warn('[communityStore] markStoryViewed 失败:', error);
    }
  },
}));

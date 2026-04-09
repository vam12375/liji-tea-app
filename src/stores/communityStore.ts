import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import type { CommunityPostType, Post as DBPost } from '@/types/database';

const STORY_SELECT = `
  id,
  author_id,
  image_url,
  caption,
  created_at,
  author:profiles!stories_author_id_fkey(name, avatar_url)
`;

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
  created_at,
  like_count,
  comment_count,
  author:profiles!posts_author_id_fkey(name, avatar_url)
`;

const COMMENT_SELECT = `
  id,
  post_id,
  author_id,
  content,
  created_at,
  like_count,
  author:profiles!post_comments_author_id_fkey(name, avatar_url)
`;

const POST_PAGE_SIZE = 20;

type BrewingData = NonNullable<DBPost['brewing_data']>;

type AuthorRelation = {
  name?: string | null;
  avatar_url?: string | null;
};

type StoryRow = {
  id: string;
  author_id: string;
  image_url?: string | null;
  caption?: string | null;
  created_at: string;
  author?: AuthorRelation | AuthorRelation[] | null;
};

type PostRow = {
  id: string;
  author_id: string;
  type: CommunityPostType;
  location?: string | null;
  image_url?: string | null;
  caption?: string | null;
  tea_name?: string | null;
  brewing_data?: BrewingData | null;
  brewing_images?: string[] | null;
  quote?: string | null;
  title?: string | null;
  description?: string | null;
  created_at: string;
  like_count?: number | null;
  comment_count?: number | null;
  author?: AuthorRelation | AuthorRelation[] | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  like_count?: number | null;
  author?: AuthorRelation | AuthorRelation[] | null;
};

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
  brewingData?: BrewingData;
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

function getRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildFallbackName(authorId: string) {
  return `茶友${authorId.slice(-4)}`;
}

function buildAvatar(name: string, avatarUrl?: string | null) {
  if (avatarUrl) {
    return avatarUrl;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8B5E3C&color=fff&size=100&font-size=0.4`;
}

function formatRelativeTime(iso?: string | null) {
  if (!iso) {
    return '';
  }

  const createdAt = new Date(iso).getTime();
  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 1) {
    return '刚刚';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }

  if (diffHours < 48) {
    return '昨天';
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}天前`;
  }

  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
}

function mapStory(row: StoryRow, viewedIds: Set<string>): Story {
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

function mapComment(row: CommentRow, likedCommentIds: Set<string>): Comment {
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

function mapPost(
  row: PostRow,
  options?: {
    likedPostIds?: Set<string>;
    bookmarkedPostIds?: Set<string>;
    commentList?: Comment[];
  },
): Post {
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
    brewingImages: Array.isArray(row.brewing_images) && row.brewing_images.length > 0 ? row.brewing_images : undefined,
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
  if (index === -1) {
    return [nextPost, ...posts];
  }

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

  if (likesResult.error) {
    throw likesResult.error;
  }

  if (bookmarksResult.error) {
    throw bookmarksResult.error;
  }

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

  if (error) {
    throw error;
  }

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
      console.warn('[communityStore] fetchStories 失败:', error);
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
          posts: [...state.posts, ...newPosts],
          likedPostIds: new Set([...state.likedPostIds, ...likedPostIds]),
          bookmarkedPostIds: new Set([...state.bookmarkedPostIds, ...bookmarkedPostIds]),
          hasMorePosts,
          postsPage: currentPage + 1,
          loading: false,
        }));
      } else {
        set({
          posts: newPosts,
          likedPostIds,
          bookmarkedPostIds,
          hasMorePosts,
          postsPage: 1,
          loading: false,
        });
      }
    } catch (error) {
      console.warn('[communityStore] fetchPosts 失败:', error);
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
      console.warn('[communityStore] fetchMyPosts 失败:', error);
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
    const userId = requireUserId();
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
    const userId = requireUserId();
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
    const userId = requireUserId();

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
    const userId = requireUserId();
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
    const userId = requireUserId();
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
      console.warn('[communityStore] markStoryViewed 失败:', error);
    }
  },
}));

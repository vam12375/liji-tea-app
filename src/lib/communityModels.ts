import { Image as ReactNativeImage } from 'react-native';

import type { CommunityPostType, Post as DBPost } from '@/types/database';

export const STORY_SELECT = `
  id,
  author_id,
  image_url,
  caption,
  created_at,
  author:profiles!stories_author_id_fkey(name, avatar_url)
`;

export const POST_SELECT = `
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

export const COMMENT_SELECT = `
  id,
  post_id,
  author_id,
  parent_id,
  content,
  created_at,
  like_count,
  author:profiles!post_comments_author_id_fkey(name, avatar_url)
`;

export const POST_PAGE_SIZE = 20;

export type BrewingData = NonNullable<DBPost['brewing_data']>;
type AuthorRelation = {
  name?: string | null;
  avatar_url?: string | null;
};

// 无用户头像时统一回退到本地资源，避免列表依赖第三方头像服务。
const COMMUNITY_AVATAR_PLACEHOLDER_URI = ReactNativeImage.resolveAssetSource(
  require('../../assets/images/icon.png'),
).uri;

export type StoryRow = {
  id: string;
  author_id: string;
  image_url?: string | null;
  caption?: string | null;
  created_at: string;
  author?: AuthorRelation | AuthorRelation[] | null;
};

export type PostRow = {
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

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id?: string | null;
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
  parentId?: string;
  content: string;
  time: string;
  createdAt: string;
  likes: number;
  isLiked: boolean;
  replies?: Comment[];
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

  void name;
  return COMMUNITY_AVATAR_PLACEHOLDER_URI;
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

export function mapStory(row: StoryRow, viewedIds: Set<string>): Story {
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

export function mapComment(
  row: CommentRow,
  likedCommentIds: Set<string>,
): Comment {
  const author = getRelation(row.author);
  const name = author?.name?.trim() || buildFallbackName(row.author_id);

  return {
    id: row.id,
    authorId: row.author_id,
    author: name,
    avatar: buildAvatar(name, author?.avatar_url),
    parentId: row.parent_id ?? undefined,
    content: row.content,
    time: formatRelativeTime(row.created_at),
    createdAt: row.created_at,
    likes: row.like_count ?? 0,
    isLiked: likedCommentIds.has(row.id),
  };
}

// 评论详情页需要树形结构，这里统一把平铺评论组装成“根评论 + 回复”的线程模型。
export function buildCommentThreads(
  rows: CommentRow[],
  likedCommentIds: Set<string>,
): Comment[] {
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  rows.forEach((row) => {
    commentMap.set(row.id, {
      ...mapComment(row, likedCommentIds),
      replies: [],
    });
  });

  rows.forEach((row) => {
    const current = commentMap.get(row.id);
    if (!current) {
      return;
    }

    const parentId = row.parent_id ?? undefined;
    if (!parentId) {
      rootComments.push(current);
      return;
    }

    const parent = commentMap.get(parentId);
    if (!parent) {
      rootComments.push(current);
      return;
    }

    parent.replies = [...(parent.replies ?? []), current];
  });

  return rootComments;
}

export function mapPost(
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
    brewingImages:
      Array.isArray(row.brewing_images) && row.brewing_images.length > 0
        ? row.brewing_images
        : undefined,
    quote: row.quote ?? undefined,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    answerCount: row.type === 'question' ? comments : undefined,
    commentList: options?.commentList,
    isLiked: likedPostIds.has(row.id),
    isBookmarked: bookmarkedPostIds.has(row.id),
  };
}

// 帖子详情回写时优先更新已有项，避免列表和详情状态分叉。
export function upsertCommunityPost(posts: Post[], nextPost: Post) {
  const index = posts.findIndex((post) => post.id === nextPost.id);
  if (index === -1) {
    return [nextPost, ...posts];
  }

  const nextPosts = [...posts];
  nextPosts[index] = nextPost;
  return nextPosts;
}

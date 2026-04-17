import type {
  BrewingData,
  Comment,
  Post,
  Story,
} from '@/lib/communityModels';
import type { CommunityPostType } from '@/types/database';

// 供页面构造 createPost 入参：不直接绑死 DB 字段，避免 UI 层重复 mapper 逻辑。
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

export interface CommunityState {
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

// slice 工厂签名：与 userStore 的 set / get 风格保持一致，便于后续继续拆分。
export type CommunityStoreSet = (
  partial:
    | Partial<CommunityState>
    | ((state: CommunityState) => Partial<CommunityState>),
) => void;
export type CommunityStoreGet = () => CommunityState;

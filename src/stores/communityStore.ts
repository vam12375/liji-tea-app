import { create } from 'zustand';

import { createCommunityInteractionsActions } from '@/stores/communityStore.interactions';
import { createCommunityPostsActions } from '@/stores/communityStore.posts';
import { createCommunityStoriesActions } from '@/stores/communityStore.stories';
import type { CommunityState } from '@/stores/communityStore.types';

// 对外继续提供原有类型，消费者无感知。
export type { Comment, Post, Story } from '@/lib/communityModels';
export type { CreatePostInput } from '@/stores/communityStore.types';

const initialCommunityState = {
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
} satisfies Pick<
  CommunityState,
  | 'stories'
  | 'posts'
  | 'activePost'
  | 'loading'
  | 'storiesLoading'
  | 'detailLoading'
  | 'submitting'
  | 'likedPostIds'
  | 'likedCommentIds'
  | 'bookmarkedPostIds'
  | 'hasMorePosts'
  | 'postsPage'
>;

// communityStore 入口只组合各业务域的 action slice，保持与 userStore 拆分约定一致。
export const useCommunityStore = create<CommunityState>()((set, get) => ({
  ...initialCommunityState,
  ...createCommunityStoriesActions(set, get),
  ...createCommunityPostsActions(set, get),
  ...createCommunityInteractionsActions(set, get),
}));

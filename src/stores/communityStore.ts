import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

/** 前端 Story 类型（兼容现有组件） */
export interface Story {
  id: string;
  name: string;
  avatar: string;
  isViewed: boolean;
}

/** 前端 Post 类型（兼容现有组件） */
export interface Post {
  id: string;
  type: 'photo' | 'brewing' | 'question';
  author: string;
  avatar: string;
  time: string;
  location?: string;
  image?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  teaName?: string;
  brewingData?: { temp: string; time: string; amount: string };
  brewingImages?: string[];
  quote?: string;
  title?: string;
  description?: string;
  answerCount?: number;
}

/** 将数据库行映射为前端 Story 类型 */
function mapStory(row: any): Story {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar_url ?? '',
    isViewed: row.is_viewed ?? false,
  };
}

/** 将数据库行映射为前端 Post 类型 */
function mapPost(row: any): Post {
  // 计算相对时间
  const created = new Date(row.created_at);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - created.getTime()) / 3600000);
  let time = '';
  if (diffH < 1) time = '刚刚';
  else if (diffH < 24) time = `${diffH}小时前`;
  else if (diffH < 48) time = '昨天';
  else time = `${Math.floor(diffH / 24)}天前`;

  return {
    id: row.id,
    type: row.type,
    author: row.author,
    avatar: row.avatar_url ?? '',
    time,
    location: row.location ?? undefined,
    image: row.image_url ?? undefined,
    caption: row.caption ?? undefined,
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    teaName: row.tea_name ?? undefined,
    brewingData: row.brewing_data ?? undefined,
    brewingImages: row.brewing_images ?? undefined,
    quote: row.quote ?? undefined,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    answerCount: row.answer_count ?? undefined,
  };
}

interface CommunityState {
  stories: Story[];
  posts: Post[];
  loading: boolean;

  fetchStories: () => Promise<void>;
  fetchPosts: () => Promise<void>;
}

export const useCommunityStore = create<CommunityState>()((set) => ({
  stories: [],
  posts: [],
  loading: false,

  fetchStories: async () => {
    const { data } = await supabase
      .from('stories')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) set({ stories: data.map(mapStory) });
  },

  fetchPosts: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    set({ posts: (data ?? []).map(mapPost), loading: false });
  },
}));

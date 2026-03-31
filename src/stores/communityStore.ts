import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

/** 前端 Story 类型（兼容现有组件） */
export interface Story {
  id: string;
  name: string;
  avatar: string;
  isViewed: boolean;
}

/** 评论类型 */
export interface Comment {
  id: string;
  author: string;
  avatar: string;
  content: string;
  time: string;
  likes: number;
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
  /** 评论列表（详情页使用） */
  commentList?: Comment[];
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

// ==================== 模拟数据 ====================

/** Supabase 存储桶中已有的产品图片 */
const IMG = {
  dahongpao: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/dahongpao.jpg',
  longjing: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/longjing.jpg',
  puer: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/puer.jpg',
  yinzhen: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/yinzhen.jpg',
  jinjunmei: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/jinjunmei.jpg',
  molihua: 'https://nwozmsackhgffxulirjp.supabase.co/storage/v1/object/public/product-images/molihua.jpg',
} as const;

/** 基于首字母生成头像 URL（ui-avatars 服务） */
const avatar = (name: string, bg: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=100&font-size=0.4`;

const MOCK_STORIES: Story[] = [
  { id: 'ms-1', name: '茶小白', avatar: avatar('茶小白', '8B5E3C'), isViewed: false },
  { id: 'ms-2', name: '老陈说茶', avatar: avatar('老陈', '2D5016'), isViewed: false },
  { id: 'ms-3', name: '山间茶人', avatar: avatar('山间', '4A6741'), isViewed: true },
  { id: 'ms-4', name: '武夷岩茶坊', avatar: avatar('武夷', '6B4226'), isViewed: false },
  { id: 'ms-5', name: '壶中天地', avatar: avatar('壶中', '5D4037'), isViewed: true },
  { id: 'ms-6', name: '饮茶小记', avatar: avatar('饮茶', '33691E'), isViewed: false },
];

const MOCK_POSTS: Post[] = [
  {
    id: 'mp-1',
    type: 'photo',
    author: '山间茶人',
    avatar: avatar('山间', '4A6741'),
    time: '2小时前',
    location: '武夷山',
    image: IMG.dahongpao,
    caption: '清晨的茶园，露珠还挂在嫩芽上。今年的春茶长势喜人，再过几天就可以开采了。期待第一杯明前茶的鲜爽',
    likes: 128,
    comments: 23,
    commentList: [
      { id: 'c1-1', author: '茶小白', avatar: avatar('茶小白', '8B5E3C'), content: '太美了！请问武夷山现在去采茶还来得及吗？', time: '1小时前', likes: 5 },
      { id: 'c1-2', author: '老陈说茶', avatar: avatar('老陈', '2D5016'), content: '这嫩芽一看就是好品种，正岩的茶树就是不一样', time: '1小时前', likes: 12 },
      { id: 'c1-3', author: '饮茶小记', avatar: avatar('饮茶', '33691E'), content: '期待你的新茶！去年的大红袍到现在还在回味', time: '45分钟前', likes: 3 },
      { id: 'c1-4', author: '壶中天地', avatar: avatar('壶中', '5D4037'), content: '清晨的茶园最有灵气了，露珠配嫩芽，太有诗意', time: '30分钟前', likes: 8 },
    ],
  },
  {
    id: 'mp-2',
    type: 'brewing',
    author: '老陈说茶',
    avatar: avatar('老陈', '2D5016'),
    time: '5小时前',
    teaName: '正岩肉桂',
    brewingData: { temp: '100°C', time: '8秒', amount: '8g/110ml' },
    brewingImages: [IMG.dahongpao, IMG.jinjunmei, IMG.puer],
    quote: '第三泡开始，桂皮香与花果香层层递进，这就是肉桂的魅力',
    likes: 89,
    comments: 15,
    commentList: [
      { id: 'c2-1', author: '山间茶人', avatar: avatar('山间', '4A6741'), content: '8秒出汤确实是肉桂的最佳时间，再长一点就会涩', time: '4小时前', likes: 15 },
      { id: 'c2-2', author: '武夷岩茶坊', avatar: avatar('武夷', '6B4226'), content: '这是我们坊里的牛栏坑肉桂吧？看茶汤颜色就知道了', time: '3小时前', likes: 22 },
      { id: 'c2-3', author: '茶小白', avatar: avatar('茶小白', '8B5E3C'), content: '新手想问，肉桂和水仙味道差别大吗？', time: '2小时前', likes: 3 },
    ],
  },
  {
    id: 'mp-3',
    type: 'photo',
    author: '壶中天地',
    avatar: avatar('壶中', '5D4037'),
    time: '昨天',
    image: IMG.puer,
    caption: '入手了一把朱泥小品壶，容量130ml，专门用来泡凤凰单丛。朱泥壶发茶性好，口感更加细腻。有没有壶友分享一下养壶心得？',
    likes: 256,
    comments: 47,
    commentList: [
      { id: 'c3-1', author: '老陈说茶', avatar: avatar('老陈', '2D5016'), content: '朱泥壶养壶秘诀：每次用完热水冲洗，自然晾干，千万不要用布擦里面', time: '23小时前', likes: 35 },
      { id: 'c3-2', author: '饮茶小记', avatar: avatar('饮茶', '33691E'), content: '130ml刚好泡单丛，我也有一把类似的，养了两年包浆特别漂亮', time: '20小时前', likes: 18 },
      { id: 'c3-3', author: '山间茶人', avatar: avatar('山间', '4A6741'), content: '好壶！朱泥的导热性好，出汤要快，不然容易闷熟', time: '18小时前', likes: 9 },
      { id: 'c3-4', author: '武夷岩茶坊', avatar: avatar('武夷', '6B4226'), content: '建议一把壶只泡一种茶，朱泥吸味能力很强', time: '15小时前', likes: 27 },
      { id: 'c3-5', author: '茶小白', avatar: avatar('茶小白', '8B5E3C'), content: '请问这把壶大概什么价位？想入门紫砂', time: '12小时前', likes: 4 },
    ],
  },
  {
    id: 'mp-4',
    type: 'question',
    author: '茶小白',
    avatar: avatar('茶小白', '8B5E3C'),
    time: '昨天',
    title: '新手如何分辨真假金骏眉？',
    description: '最近想尝试金骏眉，但听说市面上很多都是假的。请教各位老茶友，从外形、香气、汤色上怎么分辨真假金骏眉？预算500左右能买到正宗的吗？',
    answerCount: 12,
    commentList: [
      { id: 'c4-1', author: '老陈说茶', avatar: avatar('老陈', '2D5016'), content: '正宗金骏眉干茶黑中带金黄，不是全金色的！全金色的反而是低端货染色的。闻起来应该有蜜薯香和花果香，不应该有焦糊味', time: '22小时前', likes: 56 },
      { id: 'c4-2', author: '武夷岩茶坊', avatar: avatar('武夷', '6B4226'), content: '500块想买正宗桐木关金骏眉很难，建议800以上。真正的金骏眉一斤需要几万个芽头，成本就摆在那里。500左右可以买到不错的正山小种', time: '20小时前', likes: 43 },
      { id: 'c4-3', author: '山间茶人', avatar: avatar('山间', '4A6741'), content: '看汤色也很重要！真金骏眉泡出来是金黄透亮的，假的通常偏红偏暗。而且真金骏眉非常耐泡，十泡以上还有味道', time: '18小时前', likes: 31 },
      { id: 'c4-4', author: '饮茶小记', avatar: avatar('饮茶', '33691E'), content: '补充一点：真金骏眉叶底是完整的单芽，大小均匀。如果叶底有叶片掺杂，那就是用其他茶冒充的', time: '15小时前', likes: 25 },
    ],
  },
  {
    id: 'mp-5',
    type: 'brewing',
    author: '饮茶小记',
    avatar: avatar('饮茶', '33691E'),
    time: '3天前',
    teaName: '2019年老白茶',
    brewingData: { temp: '100°C', time: '15秒', amount: '5g/150ml' },
    brewingImages: [IMG.yinzhen, IMG.molihua],
    quote: '五年陈的寿眉，煮着喝枣香四溢，暖胃又暖心',
    likes: 67,
    comments: 8,
    commentList: [
      { id: 'c5-1', author: '老陈说茶', avatar: avatar('老陈', '2D5016'), content: '五年的寿眉正好进入最佳品饮期，枣香和药香都出来了。煮着喝确实是最好的方式', time: '2天前', likes: 14 },
      { id: 'c5-2', author: '壶中天地', avatar: avatar('壶中', '5D4037'), content: '冬天煮老白茶太幸福了！我一般先泡五六泡再煮，更有层次感', time: '2天前', likes: 8 },
    ],
  },
  {
    id: 'mp-6',
    type: 'photo',
    author: '武夷岩茶坊',
    avatar: avatar('武夷', '6B4226'),
    time: '4天前',
    location: '福建南平',
    image: IMG.jinjunmei,
    caption: '炭焙岩茶进行中，传统龙眼木炭慢火烘焙，让茶叶的香气更加醇厚饱满。这批水仙预计下周可以品饮了',
    likes: 312,
    comments: 56,
    commentList: [
      { id: 'c6-1', author: '老陈说茶', avatar: avatar('老陈', '2D5016'), content: '龙眼木炭焙的就是好！碳香和茶香融为一体，机器焙的完全没法比', time: '3天前', likes: 45 },
      { id: 'c6-2', author: '山间茶人', avatar: avatar('山间', '4A6741'), content: '传统工艺越来越难得了。焙茶师傅需要整夜守着火候，太辛苦了', time: '3天前', likes: 33 },
      { id: 'c6-3', author: '饮茶小记', avatar: avatar('饮茶', '33691E'), content: '可以预定吗？去年的水仙特别好，今年也想试试', time: '3天前', likes: 12 },
      { id: 'c6-4', author: '茶小白', avatar: avatar('茶小白', '8B5E3C'), content: '原来岩茶还需要炭焙啊，学到了！请问炭焙大概需要多长时间？', time: '2天前', likes: 6 },
      { id: 'c6-5', author: '壶中天地', avatar: avatar('壶中', '5D4037'), content: '炭焙水仙配朱泥壶，绝配！等出炉了一定要尝尝', time: '2天前', likes: 19 },
    ],
  },
];

// ==================== Store ====================

interface CommunityState {
  stories: Story[];
  posts: Post[];
  loading: boolean;
  /** 当前用户点赞过的帖子 ID 集合 */
  likedPostIds: Set<string>;
  /** 当前用户点赞过的评论 ID 集合 */
  likedCommentIds: Set<string>;

  fetchStories: () => Promise<void>;
  fetchPosts: () => Promise<void>;
  /** 切换帖子点赞 */
  togglePostLike: (postId: string) => void;
  /** 添加评论 */
  addComment: (postId: string, author: string, avatar: string, content: string) => void;
  /** 切换评论点赞 */
  toggleCommentLike: (postId: string, commentId: string) => void;
}

export const useCommunityStore = create<CommunityState>()((set, get) => ({
  // 初始值直接使用模拟数据，确保页面立即有内容
  stories: MOCK_STORIES,
  posts: MOCK_POSTS,
  loading: false,
  likedPostIds: new Set<string>(),
  likedCommentIds: new Set<string>(),

  fetchStories: async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const stories = (data ?? []).map(mapStory);
      // 仅当 Supabase 有含头像的有效故事时才替换模拟数据
      if (stories.length > 0 && stories[0].avatar) {
        set({ stories });
      }
    } catch (err) {
      console.warn('[communityStore] fetchStories 失败，保持模拟数据:', err);
    }
  },

  fetchPosts: async () => {
    try {
      set({ loading: true });
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const posts = (data ?? []).map(mapPost);
      if (posts.length > 0 && posts[0].avatar) {
        set({ posts, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err) {
      console.warn('[communityStore] fetchPosts 失败，保持模拟数据:', err);
      set({ loading: false });
    }
  },

  togglePostLike: (postId) => {
    const { likedPostIds } = get();
    const isLiked = likedPostIds.has(postId);
    const next = new Set(likedPostIds);
    if (isLiked) {
      next.delete(postId);
    } else {
      next.add(postId);
    }
    set({
      likedPostIds: next,
      posts: get().posts.map((p) =>
        p.id === postId ? { ...p, likes: (p.likes ?? 0) + (isLiked ? -1 : 1) } : p
      ),
    });
  },

  addComment: (postId, author, avatar, content) => {
    const newComment: Comment = {
      id: `c-${Date.now()}`,
      author,
      avatar,
      content,
      time: '刚刚',
      likes: 0,
    };
    set({
      posts: get().posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: (p.comments ?? 0) + 1,
              commentList: [...(p.commentList ?? []), newComment],
            }
          : p
      ),
    });
  },

  toggleCommentLike: (postId, commentId) => {
    const { likedCommentIds } = get();
    const isLiked = likedCommentIds.has(commentId);
    const next = new Set(likedCommentIds);
    if (isLiked) {
      next.delete(commentId);
    } else {
      next.add(commentId);
    }
    set({
      likedCommentIds: next,
      posts: get().posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              commentList: p.commentList?.map((c) =>
                c.id === commentId ? { ...c, likes: c.likes + (isLiked ? -1 : 1) } : c
              ),
            }
          : p
      ),
    });
  },
}));

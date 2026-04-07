import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import type { Article as DBArticle, SeasonalPick as DBSeasonalPick } from '@/types/database';

/** 文章内容块类型 */
export interface ContentBlock {
  type: 'paragraph' | 'image' | 'heading';
  text?: string;
  image?: string;
  caption?: string;
}

/** 前端文章类型（兼容现有组件） */
export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  image: string;
  readTime: string;
  date: string;
  /** 文章正文内容（详情页使用） */
  content?: ContentBlock[];
}

export interface SeasonalPick {
  id: string;
  name: string;
  desc: string;
  image: string;
}

function mapArticle(row: DBArticle): Article {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    category: row.category,
    image: row.image_url ?? '',
    readTime: row.read_time ?? '',
    date: row.date ?? '',
    content: Array.isArray(row.content)
      ? row.content.map((block) => ({
          type: block.type,
          text: block.text ?? undefined,
          image: block.image ?? undefined,
          caption: block.caption ?? undefined,
        }))
      : undefined,
  };
}

function mapSeasonalPick(row: DBSeasonalPick): SeasonalPick {
  return {
    id: row.id,
    name: row.name,
    desc: row.description ?? '',
    image: row.image_url ?? '',
  };
}

function requireUserId() {
  const userId = useUserStore.getState().session?.user?.id;
  if (!userId) {
    throw new Error('请先登录后再进行文章互动');
  }
  return userId;
}

async function loadArticleInteractionSets(articleIds: string[], userId?: string | null) {
  if (!userId || articleIds.length === 0) {
    return {
      likedArticleIds: new Set<string>(),
      bookmarkedArticleIds: new Set<string>(),
    };
  }

  const [likesResult, bookmarksResult] = await Promise.all([
    supabase.from('article_likes').select('article_id').eq('user_id', userId).in('article_id', articleIds),
    supabase.from('article_bookmarks').select('article_id').eq('user_id', userId).in('article_id', articleIds),
  ]);

  if (likesResult.error) throw likesResult.error;
  if (bookmarksResult.error) throw bookmarksResult.error;

  return {
    likedArticleIds: new Set((likesResult.data ?? []).map((item) => item.article_id)),
    bookmarkedArticleIds: new Set((bookmarksResult.data ?? []).map((item) => item.article_id)),
  };
}

interface ArticleState {
  articles: Article[];
  seasonalPicks: SeasonalPick[];
  loading: boolean;
  likedArticleIds: Set<string>;
  bookmarkedArticleIds: Set<string>;
  fetchArticles: () => Promise<void>;
  fetchSeasonalPicks: () => Promise<void>;
  toggleArticleLike: (articleId: string) => Promise<void>;
  toggleArticleBookmark: (articleId: string) => Promise<void>;
}

export const useArticleStore = create<ArticleState>()((set, get) => ({
  articles: [],
  seasonalPicks: [],
  loading: false,
  likedArticleIds: new Set<string>(),
  bookmarkedArticleIds: new Set<string>(),

  fetchArticles: async () => {
    try {
      set({ loading: true });
      const userId = useUserStore.getState().session?.user?.id;
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const articleIds = (data ?? []).map((article) => article.id);
      const { likedArticleIds, bookmarkedArticleIds } = await loadArticleInteractionSets(articleIds, userId);

      set({
        articles: (data ?? []).map(mapArticle),
        likedArticleIds,
        bookmarkedArticleIds,
        loading: false,
      });
    } catch (error) {
      console.warn('[articleStore] fetchArticles 失败:', error);
      set({
        articles: [],
        likedArticleIds: new Set<string>(),
        bookmarkedArticleIds: new Set<string>(),
        loading: false,
      });
    }
  },

  fetchSeasonalPicks: async () => {
    try {
      const { data, error } = await supabase
        .from('seasonal_picks')
        .select('*')
        .order('sort_order', { ascending: true })
        .limit(20);

      if (error) throw error;
      set({ seasonalPicks: (data ?? []).map(mapSeasonalPick) });
    } catch (error) {
      console.warn('[articleStore] fetchSeasonalPicks 失败:', error);
      set({ seasonalPicks: [] });
    }
  },

  toggleArticleLike: async (articleId) => {
    const userId = requireUserId();
    const isLiked = get().likedArticleIds.has(articleId);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('article_likes')
          .delete()
          .eq('article_id', articleId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('article_likes')
          .insert({ article_id: articleId, user_id: userId });

        if (error) throw error;
      }

      set((state) => {
        const likedArticleIds = new Set(state.likedArticleIds);
        if (isLiked) likedArticleIds.delete(articleId);
        else likedArticleIds.add(articleId);

        return { likedArticleIds };
      });
    } catch (error: any) {
      console.warn('[articleStore] toggleArticleLike 失败:', error);
      throw new Error(error?.message ?? '点赞失败，请稍后重试');
    }
  },

  toggleArticleBookmark: async (articleId) => {
    const userId = requireUserId();
    const isBookmarked = get().bookmarkedArticleIds.has(articleId);

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from('article_bookmarks')
          .delete()
          .eq('article_id', articleId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('article_bookmarks')
          .insert({ article_id: articleId, user_id: userId });

        if (error) throw error;
      }

      set((state) => {
        const bookmarkedArticleIds = new Set(state.bookmarkedArticleIds);
        if (isBookmarked) bookmarkedArticleIds.delete(articleId);
        else bookmarkedArticleIds.add(articleId);

        return { bookmarkedArticleIds };
      });
    } catch (error: any) {
      console.warn('[articleStore] toggleArticleBookmark 失败:', error);
      throw new Error(error?.message ?? '收藏失败，请稍后重试');
    }
  },
}));

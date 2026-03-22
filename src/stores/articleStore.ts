import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Article as DBArticle, SeasonalPick as DBSeasonalPick } from '@/types/database';

/** 前端文章类型（兼容现有组件） */
export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  image: string;
  readTime: string;
  date: string;
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

interface ArticleState {
  articles: Article[];
  seasonalPicks: SeasonalPick[];
  loading: boolean;

  fetchArticles: () => Promise<void>;
  fetchSeasonalPicks: () => Promise<void>;
}

export const useArticleStore = create<ArticleState>()((set) => ({
  articles: [],
  seasonalPicks: [],
  loading: false,

  fetchArticles: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    set({ articles: (data ?? []).map(mapArticle), loading: false });
  },

  fetchSeasonalPicks: async () => {
    const { data } = await supabase
      .from('seasonal_picks')
      .select('*')
      .order('created_at');

    if (data) set({ seasonalPicks: data.map(mapSeasonalPick) });
  },
}));

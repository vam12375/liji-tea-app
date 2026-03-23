import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

/** 前端礼品贺卡类型（兼容现有组件） */
export interface GiftCard {
  id: string;
  title: string;
  subtitle: string;
  image: string;
}

/** 前端礼品套装类型（兼容现有组件） */
export interface GiftSet {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
}

function mapGiftCard(row: any): GiftCard {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    image: row.image_url ?? '',
  };
}

function mapGiftSet(row: any): GiftSet {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    price: Number(row.price),
    image: row.image_url ?? '',
  };
}

interface GiftState {
  giftCards: GiftCard[];
  giftSets: GiftSet[];
  loading: boolean;

  fetchGiftCards: () => Promise<void>;
  fetchGiftSets: () => Promise<void>;
}

export const useGiftStore = create<GiftState>()((set) => ({
  giftCards: [],
  giftSets: [],
  loading: false,

  fetchGiftCards: async () => {
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .order('created_at');

      if (error) throw error;
      if (data) set({ giftCards: data.map(mapGiftCard) });
    } catch (err) {
      console.warn('[giftStore] fetchGiftCards 失败:', err);
    }
  },

  fetchGiftSets: async () => {
    try {
      set({ loading: true });
      const { data, error } = await supabase
        .from('gift_sets')
        .select('*')
        .order('created_at');

      if (error) throw error;
      set({ giftSets: (data ?? []).map(mapGiftSet), loading: false });
    } catch (err) {
      console.warn('[giftStore] fetchGiftSets 失败:', err);
      set({ loading: false });
    }
  },
}));

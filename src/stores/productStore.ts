import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Product as DBProduct } from '@/types/database';

/** 前端使用的 Product 类型（兼容现有组件） */
export interface Product {
  id: string;
  name: string;
  origin: string;
  price: number;
  unit: string;
  image: string;
  description?: string;
  isNew?: boolean;
  category: string;
  tagline?: string;
  tastingProfile?: { label: string; description: string; value: number }[];
  brewingGuide?: {
    temperature: string;
    time: string;
    amount: string;
    equipment: string;
  };
  originStory?: string;
  process?: string[];
  stock?: number;
}

/** 将数据库行映射为前端 Product 类型 */
function mapProduct(row: DBProduct): Product {
  return {
    id: row.id,
    name: row.name,
    origin: row.origin ?? '',
    price: Number(row.price),
    unit: row.unit,
    image: row.image_url ?? '',
    description: row.description ?? undefined,
    isNew: row.is_new,
    category: row.category,
    tagline: row.tagline ?? undefined,
    tastingProfile: row.tasting_profile ?? undefined,
    brewingGuide: row.brewing_guide ?? undefined,
    originStory: row.origin_story ?? undefined,
    process: row.process ?? undefined,
    stock: row.stock,
  };
}

interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;

  fetchProducts: () => Promise<void>;
  fetchProductById: (id: string) => Promise<Product | null>;
  searchProducts: (query: string) => Promise<Product[]>;
  /** 实时回调：更新单个产品（库存等） */
  updateProduct: (updated: DBProduct) => void;
}

export const useProductStore = create<ProductState>()((set, get) => ({
  products: [],
  loading: false,
  error: null,

  fetchProducts: async () => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ products: (data ?? []).map(mapProduct), loading: false });
    } catch (err: any) {
      console.warn('[productStore] fetchProducts 失败:', err);
      set({ loading: false, error: err?.message ?? '加载失败' });
    }
  },

  fetchProductById: async (id) => {
    try {
      const cached = get().products.find((p) => p.id === id);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? mapProduct(data) : null;
    } catch (err) {
      console.warn('[productStore] fetchProductById 失败:', err);
      return null;
    }
  },

  searchProducts: async (query) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,origin.ilike.%${query}%`);

      if (error) throw error;
      return (data ?? []).map(mapProduct);
    } catch (err) {
      console.warn('[productStore] searchProducts 失败:', err);
      return [];
    }
  },

  updateProduct: (updated) => {
    set((state) => ({
      products: state.products.map((p) =>
        p.id === updated.id ? mapProduct(updated) : p
      ),
    }));
  },
}));

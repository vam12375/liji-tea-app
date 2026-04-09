import { create } from 'zustand';

import { logWarn } from '@/lib/logger';
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
    id:row.id,
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

function upsertProduct(products: Product[], nextProduct: Product) {
  const index = products.findIndex((product) => product.id === nextProduct.id);

  if (index === -1) {
    return [nextProduct, ...products];
  }

  const nextProducts = [...products];
  nextProducts[index] = nextProduct;
  return nextProducts;
}

// Store 内统一把未知错误转成用户可展示文案，避免每个 action 重复兜底。
function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** 每页加载的产品数量 */
const PAGE_SIZE =20;

interface ProductState {
  products: Product[];
  loading: boolean;
  error: string | null;
  /** 是否还有更多产品可加载 */
  hasMore: boolean;
  /**当前分页页码 */
  page: number;

  fetchProducts: (loadMore?: boolean) => Promise<void>;
  /** 加载更多产品（翻页） */
  loadMoreProducts: () => Promise<void>;
  fetchProductById: (id: string) =>Promise<Product | null>;
  searchProducts: (query: string) => Promise<Product[]>;
  /** 实时回调：更新单个产品（库存等） */
  updateProduct: (updated: DBProduct) => void;
}

export const useProductStore = create<ProductState>()((set, get) => ({
  products: [],
  loading: false,
  error: null,
  hasMore: true,
  page: 0,

fetchProducts: async (loadMore = false) => {
    try {
      const currentPage = loadMore ? get().page : 0;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      set({ loading: true, error: null });
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .range(from, to);

      if (error) {
        throw error;
      }

      const newProducts = (data ?? []).map(mapProduct);
const hasMore = newProducts.length >= PAGE_SIZE;

      if (loadMore) {
        set((state) => ({
          products: [...state.products, ...newProducts],
          loading: false,
          hasMore,
          page: currentPage + 1,
        }));
      } else {
        set({ products: newProducts, loading: false, hasMore, page: 1 });
      }
    } catch (error) {
      logWarn('productStore', 'fetchProducts 失败', {
        error: getErrorMessage(error, '加载失败'),
      });
      set({ loading: false, error: getErrorMessage(error, '加载失败') });
    }
  },

  loadMoreProducts: async () => {
    const { loading, hasMore } = get();
    if (loading || !hasMore) {
      return;
    }
    await get().fetchProducts(true);
  },

fetchProductById: async (id) => {
    try {
      const cached = get().products.find((p) => p.id === id);
      if (cached) {
        return cached;
      }

      const { data,error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }
      if (!data) {
        return null;
      }

      const product = mapProduct(data);
      set((state) => ({
        products: upsertProduct(state.products, product),
      }));
return product;
    } catch (error) {
      logWarn('productStore', 'fetchProductById 失败', {
        productId: id,
        error: getErrorMessage(error, '加载商品失败'),
      });
      return null;
    }
  },

  searchProducts: async (query) => {
    try {
      const safe = query.replace(/[%_\\]/g, '\\$&');
      const { data, error }= await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${safe}%,origin.ilike.%${safe}%`)
        .limit(50);

      if (error) {
        throw error;
      }
      return (data ?? []).map(mapProduct);
    } catch (error) {
logWarn('productStore', 'searchProducts 失败', {
        query,
        error: getErrorMessage(error, '搜索失败'),
      });
      return [];
    }
  },

updateProduct: (updated) => {
    const nextProduct = mapProduct(updated);

    set((state) => ({
      products: upsertProduct(state.products, nextProduct),
    }));
  },
}));

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Product } from "@/data/products";

import { track } from "@/lib/analytics";

/** 购物车单项 */
export interface CartItem {
  product: Product;
  quantity: number;
}

/** 购物车状态接口 */
interface CartState {
  items: CartItem[];
  /** 添加商品，可指定数量（默认 1） */
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  /** 商品总数 */
  totalItems: () => number;
  /** 小计金额 */
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      // 添加商品（已存在则数量增加，支持指定数量）
      addItem: (product, quantity = 1) =>
        set((state) => {
          // 加购漏斗埋点：商品 id + 本次追加数量，首页/商城/详情三处调用都会上报。
          track("add_to_cart", { productId: product.id, quantity });
          const existing = state.items.find(
            (item) => item.product.id === product.id
          );
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          }
          return { items: [...state.items, { product, quantity }] };
        }),

      // 移除商品
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.product.id !== productId),
        })),

      // 更新数量（<=0 时自动移除）
      updateQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter(
                (item) => item.product.id !== productId
              ),
            };
          }
          return {
            items: state.items.map((item) =>
              item.product.id === productId ? { ...item, quantity } : item
            ),
          };
        }),

      // 清空购物车
      clearCart: () => set({ items: [] }),

      // 计算商品总数
      totalItems: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      // 计算小计金额
      subtotal: () =>
        get().items.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        ),
    }),
    {
      name: "liji-cart",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * 产品相关类型和常量
 * 数据现在从 Supabase 通过 productStore 获取
 */

// 重新导出 productStore 中的 Product 类型
export type { Product } from '@/stores/productStore';

/** 口感数据 */
export interface TastingProfile {
  label: string;
  description: string;
  value: number;
}

/** 冲泡指南 */
export interface BrewingGuide {
  temperature: string;
  time: string;
  amount: string;
  equipment: string;
}

/** 茶类分类 */
export const TEA_CATEGORIES = [
  '全部',
  '岩茶',
  '绿茶',
  '白茶',
  '红茶',
  '乌龙',
  '普洱',
  '花茶',
] as const;

export type TeaCategory = (typeof TEA_CATEGORIES)[number];

/** 文章相关类型和常量 — 数据从 Supabase 通过 articleStore 获取 */
export type { Article } from '@/stores/articleStore';

export const CULTURE_CATEGORIES = ['全部', '茶史', '冲泡', '茶器', '茶人', '节气茶', '产地'] as const;
export type CultureCategory = (typeof CULTURE_CATEGORIES)[number];

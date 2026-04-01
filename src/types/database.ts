import type { OrderPaymentStatus, PaymentChannel } from "@/types/payment";

/** Supabase 数据库类型定义 */

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio?: string | null;
  member_tier: string;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address: string;
  is_default: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  origin: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  description: string | null;
  is_new: boolean;
  category: string;
  tagline: string | null;
  tasting_profile:
    | { label: string; description: string; value: number }[]
    | null;
  brewing_guide: {
    temperature: string;
    time: string;
    amount: string;
    equipment: string;
  } | null;
  origin_story: string | null;
  process: string[] | null;
  stock: number;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_no?: string | null;
  user_id: string;
  address_id: string | null;
  status: "pending" | "paid" | "shipping" | "delivered" | "cancelled";
  total: number;
  delivery_type: string;
  payment_method: PaymentChannel | null;
  payment_channel?: PaymentChannel | null;
  payment_status?: OrderPaymentStatus | null;
  out_trade_no?: string | null;
  paid_amount?: number | null;
  paid_at?: string | null;
  trade_no?: string | null;
  payment_error_code?: string | null;
  payment_error_message?: string | null;
  logistics_company?: string | null;
  logistics_tracking_no?: string | null;
  logistics_status?: string | null;
  logistics_receiver_name?: string | null;
  logistics_receiver_phone?: string | null;
  logistics_address?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  notes: string | null;
  gift_wrap: boolean;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  address?: Address;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: Product;
}

export interface Favorite {
  user_id: string;
  product_id: string;
  created_at: string;
}

export type CommunityPostType = "photo" | "brewing" | "question";

export interface ArticleContentBlock {
  type: "paragraph" | "image" | "heading";
  text?: string | null;
  image?: string | null;
  caption?: string | null;
}

export interface Article {
  id: string;
  title: string;
  slug?: string | null;
  subtitle: string | null;
  category: string;
  image_url: string | null;
  read_time: string | null;
  date: string | null;
  content: ArticleContentBlock[] | null;
  is_featured: boolean;
  is_published: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SeasonalPick {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface Story {
  id: string;
  author_id: string;
  image_url: string | null;
  caption: string | null;
  expires_at: string;
  created_at: string;
  updated_at?: string;
}

export interface Post {
  id: string;
  author_id: string;
  type: CommunityPostType;
  location: string | null;
  image_url: string | null;
  caption: string | null;
  tea_name: string | null;
  brewing_data: { temp?: string; time?: string; amount?: string } | null;
  brewing_images: string[] | null;
  quote: string | null;
  title: string | null;
  description: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at?: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  created_at: string;
  updated_at?: string;
}

export interface PostLike {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface CommentLike {
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface PostBookmark {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface ArticleLike {
  article_id: string;
  user_id: string;
  created_at: string;
}

export interface ArticleBookmark {
  article_id: string;
  user_id: string;
  created_at: string;
}

export interface StoryView {
  story_id: string;
  user_id: string;
  created_at: string;
}

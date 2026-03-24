import type { OrderPaymentStatus, PaymentChannel } from "@/types/payment";

/** Supabase 数据库类型定义 */

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
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
  tasting_profile: { label: string; description: string; value: number }[] | null;
  brewing_guide: { temperature: string; time: string; amount: string; equipment: string } | null;
  origin_story: string | null;
  process: string[] | null;
  stock: number;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  address_id: string | null;
  status: 'pending' | 'paid' | 'shipping' | 'delivered' | 'cancelled';
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
  notes: string | null;
  gift_wrap: boolean;
  created_at: string;
  updated_at: string;
  // 关联查询时可能包含
  order_items?: OrderItem[];
  address?: Address;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  // 关联查询时可能包含
  product?: Product;
}

export interface Favorite {
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface Article {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  image_url: string | null;
  read_time: string | null;
  date: string | null;
  is_featured: boolean;
  created_at: string;
}

export interface SeasonalPick {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

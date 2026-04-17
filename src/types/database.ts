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
  coupon_id?: string | null;
  user_coupon_id?: string | null;
  coupon_code?: string | null;
  coupon_title?: string | null;
  coupon_discount?: number;
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
  after_sale_status?: AfterSaleRequestStatus | null;
  refund_status?: RefundStatus | null;
  refund_amount?: number | null;
  refunded_at?: string | null;
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

/** 商品评价记录。 */
export interface ProductReview {
  id: string;
  product_id: string;
  order_id: string;
  order_item_id: string;
  user_id: string;
  rating: number;
  content: string | null;
  tags: string[];
  images: string[];
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

export type AfterSaleRequestType = "refund";
export type AfterSaleScopeType = "order";
export type AfterSaleRequestStatus =
  | "submitted"
  | "auto_approved"
  | "pending_review"
  | "approved"
  | "rejected"
  | "refunding"
  | "refunded"
  | "cancelled";
export type RefundStatus = "refunding" | "refunded";

/** 售后申请主体。 */
export interface AfterSaleRequest {
  id: string;
  order_id: string;
  user_id: string;
  request_type: AfterSaleRequestType;
  scope_type: AfterSaleScopeType;
  status: AfterSaleRequestStatus;
  reason_code: string;
  reason_text: string | null;
  requested_amount: number;
  approved_amount: number | null;
  currency: string;
  audit_note: string | null;
  refund_note: string | null;
  snapshot: Record<string, unknown>;
  submitted_at: string;
  reviewed_at: string | null;
  refunded_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  order?: Order;
  evidences?: AfterSaleEvidence[];
}

/** 售后凭证图片。 */
export interface AfterSaleEvidence {
  id: string;
  request_id: string;
  file_url: string;
  sort_order: number;
  created_at: string;
}

/** 推送设备记录。 */
export interface PushDevice {
  id: string;
  user_id: string;
  platform: "android" | "ios";
  expo_push_token: string;
  device_name: string | null;
  app_version: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 推送偏好。 */
export interface PushPreference {
  user_id: string;
  push_enabled: boolean;
  order_enabled: boolean;
  after_sale_enabled: boolean;
  community_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
}

/** 消息通知分类。 */
export type NotificationType = "order" | "system" | "community" | "review";

/** 应用内消息通知结构。 */
export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_type: string | null;
  related_id: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

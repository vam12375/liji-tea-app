import type { Href } from "expo-router";

import type { CommunityPostType } from "@/types/database";
import type { PaymentChannel } from "@/types/payment";

/** 订单页初始化标签参数。 */
export type OrdersInitialTab = "pending" | "paid" | "shipping" | "delivered";

/**
 * 统一路由构造器：集中维护页面路径与动态参数，避免业务层散落字符串。
 */
export const routes = {
  tabs: "/(tabs)" as const,
  cart: "/cart" as const,
  login: "/login" as const,
  checkout: (productId?: string, quantity?: number): Href =>
    productId
      ? { pathname: "/checkout", params: { productId, quantity: String(quantity ?? 1) } }
      : "/checkout",
  addresses: "/addresses" as const,
  orders: "/orders" as const,
  ordersTab: (initialTab: OrdersInitialTab): Href => ({
    pathname: "/orders",
    params: { initialTab },
  }),
  payment: (params: {
    orderId: string;
    total: string;
    paymentMethod: PaymentChannel;
    fromCart?: "0" | "1";
  }): Href => ({
    pathname: "/payment",
    params,
  }),
  tracking: (orderId: string): Href => ({
    pathname: "/tracking",
    params: { orderId },
  }),
  search: "/search" as const,
  shop: (category?: string): Href =>
    category
      ? { pathname: "/(tabs)/shop", params: { category } }
      : "/(tabs)/shop",
  community: "/(tabs)/community" as const,
  communityCreate: (type?: CommunityPostType): Href =>
    type
      ? { pathname: "/community/create", params: { type } }
      : "/community/create",
  product: (id: string): Href => ({
    pathname: "/product/[id]",
    params: { id },
  }),
  post: (id: string): Href => ({
    pathname: "/post/[id]",
    params: { id },
  }),
  article: (id: string): Href => ({
    pathname: "/article/[id]",
    params: { id },
  }),
  favorites: "/favorites" as const,
  myPosts: "/my-posts" as const,
  coupons: "/coupons" as Href,
  settings: "/settings" as const,
  notifications: "/notifications" as const,
  myReviews: "/my-reviews" as Href,
  points: "/points" as Href,
  tasks: "/tasks" as Href,
  productReviews: (productId: string): Href => ({
    pathname: "/my-reviews",
    params: { productId, initialTab: "已评价" },
  }),
  brewingLog: "/brewing-log" as const,
} as const;

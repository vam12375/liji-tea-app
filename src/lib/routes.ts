import type { Href } from "expo-router";

import type { CommunityPostType } from "@/types/database";
import type { PaymentChannel } from "@/types/payment";

export type OrdersInitialTab = "pending" | "paid" | "shipping" | "delivered";

export const routes = {
  tabs: "/(tabs)" as const,
  cart: "/cart" as const,
  login: "/login" as const,
  checkout: (productId?: string): Href =>
    productId
      ? { pathname: "/checkout", params: { productId } }
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
  settings: "/settings" as const,
} as const;

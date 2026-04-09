import type { Order } from "@/types/database";

/** 订单页顶部标签定义，统一维护文案与筛选状态。 */
export const ORDER_TABS = [
  { key: "全部", status: null },
  { key: "待付款", status: "pending" as const },
  { key: "待发货", status: "paid" as const },
  { key: "待收货", status: "shipping" as const },
  { key: "已完成", status: "delivered" as const },
] as const;

/** 路由参数中的初始状态值映射到页面标签文案。 */
export const ORDER_STATUS_TO_TAB: Record<string, (typeof ORDER_TABS)[number]["key"]> = {
  pending: "待付款",
  paid: "待发货",
  shipping: "待收货",
  delivered: "已完成",
};

/** 订单状态徽章配置统一收口，避免多个页面重复维护颜色和文案。 */
export const ORDER_STATUS_BADGE_MAP: Record<
  Order["status"],
  {
    label: string;
    color: string;
    backgroundColor: string;
  }
> = {
  pending: {
    label: "待付款",
    color: "#f97316",
    backgroundColor: "#fff7ed",
  },
  paid: {
    label: "待发货",
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  shipping: {
    label: "运输中",
    color: "#2f6e3d",
    backgroundColor: "#f0fdf4",
  },
  delivered: {
    label: "已完成",
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
  },
  cancelled: {
    label: "已取消",
    color: "#ef4444",
    backgroundColor: "#fef2f2",
  },
};

/** 个人中心订单状态快捷入口配置，供订单状态条与统计模块复用。 */
export const ORDER_STATUS_SHORTCUTS = [
  {
    icon: "payments" as const,
    label: "待付款",
    status: "pending" as const,
  },
  {
    icon: "inventory-2" as const,
    label: "待发货",
    status: "paid" as const,
  },
  {
    icon: "local-shipping" as const,
    label: "待收货",
    status: "shipping" as const,
  },
  {
    icon: "rate-review" as const,
    label: "待评价",
    status: "delivered" as const,
  },
] as const;

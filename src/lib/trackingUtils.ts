/**
 * 物流追踪页面的纯工具函数集合。
 * 从 src/app/tracking.tsx 中提取，便于复用和单元测试。
 */

import { Colors } from "@/constants/Colors";
import type { Order, OrderItem } from "@/types/database";

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export type TimelineState = "done" | "current" | "pending" | "cancelled";

export interface TimelineItem {
  title: string;
  detail: string;
  time: string;
  state: TimelineState;
}

export interface StatusMeta {
  title: string;
  description: string;
  icon: string;
  color: string;
  background: string;
}

export interface PackageSummary {
  title: string;
  count: number;
  imageUrls: string[];
}

export interface TrackingEventRow {
  status: string;
  title: string;
  detail: string;
  event_time: string;
  sort_order: number;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 将 ISO 时间统一格式化成页面展示文案。
 * 若后端当前没有更细的物流时间字段，则明确展示"待更新"，避免伪造具体时间。
 */
export function formatDateTime(value?: string | null) {
  if (!value) {
    return "待更新";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "待更新";
  }

  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** 优先展示面向用户的 order_no，无则回落到 UUID 后 8 位。 */
export function getDisplayOrderCode(orderId: string, orderNo?: string | null) {
  return orderNo ?? orderId.slice(-8);
}

/**
 * 物流页只需要一个"对用户友好"的手机号展示形式，因此统一在前端脱敏。
 */
export function maskPhone(phone?: string | null) {
  if (!phone) {
    return "暂未获取";
  }

  if (phone.length < 7) {
    return phone;
  }

  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

/**
 * 当前项目的配送方式仍是内部值，先在页面层做最小翻译。
 * 后续如果配送方式扩展，只需要维护这个映射表即可。
 */
export function getDeliveryLabel(deliveryType?: string | null) {
  switch (deliveryType) {
    case "standard":
      return "标准配送";
    case "express":
      return "极速配送";
    case "pickup":
      return "到店自提";
    default:
      return deliveryType ? `配送方式：${deliveryType}` : "待分配配送方式";
  }
}

/**
 * 物流页的"支付已完成"节点不直接依赖单一字段。
 * 这里做一个轻量聚合判断，兼容历史订单与不同来源的数据写入。
 */
export function hasPaymentEvidence(order: Order) {
  return Boolean(
    order.paid_at ||
      order.paid_amount ||
      order.trade_no ||
      order.payment_status === "success" ||
      order.status === "paid" ||
      order.status === "shipping" ||
      order.status === "delivered"
  );
}


/**
 * 顶部状态卡只负责回答"订单当前走到哪一步了"，
 * 文案和视觉色统一从这里派生，避免在 JSX 内散落条件判断。
 */
export function getTrackingStatusMeta(status: Order["status"]): StatusMeta {
  switch (status) {
    case "pending":
      return {
        title: "待支付",
        description: "订单已创建，请尽快完成支付后进入发货流程。",
        icon: "payments",
        color: "#d97706",
        background: "#fff7ed",
      };
    case "paid":
      return {
        title: "待发货",
        description: "支付成功，仓库正在准备商品并安排出库。",
        icon: "inventory-2",
        color: Colors.primaryContainer,
        background: "#eef6eb",
      };
    case "shipping":
      return {
        title: "运输中",
        description: "包裹已发出，正在配送途中，请留意后续状态更新。",
        icon: "local-shipping",
        color: "#2563eb",
        background: "#eff6ff",
      };
    case "delivered":
      return {
        title: "已送达",
        description: "包裹已送达，本次订单履约已完成。",
        icon: "task-alt",
        color: "#15803d",
        background: "#f0fdf4",
      };
    case "cancelled":
      return {
        title: "已取消",
        description: "订单已取消，本次履约流程已终止。",
        icon: "cancel",
        color: Colors.error,
        background: "#fef2f2",
      };
  }
}

/**
 * 使用现有订单字段生成"准真实"履约时间线。
 * 这一步的目标不是伪装成第三方物流轨迹，而是把当前订单状态讲清楚。
 */
export function buildTrackingTimeline(order: Order): TimelineItem[] {
  const paid = hasPaymentEvidence(order);
  const paidTime = formatDateTime(order.paid_at ?? (paid ? order.updated_at : null));
  const updatedTime = formatDateTime(order.updated_at);

  const items: TimelineItem[] = [
    {
      title: "订单已创建",
      detail: "订单已提交，系统已记录您的商品、地址和配送信息。",
      time: formatDateTime(order.created_at),
      state: "done",
    },
  ];

  if (order.status === "pending") {
    items.push(
      {
        title: "待支付",
        detail: "订单已创建，请完成支付后进入发货流程。",
        time: "待更新",
        state: "current",
      },
      {
        title: "待发货",
        detail: "支付成功后，仓库会尽快配货并安排出库。",
        time: "待更新",
        state: "pending",
      },
      {
        title: "运输中",
        detail: "商家发货后，订单履约进度会在这里继续更新。",
        time: "待更新",
        state: "pending",
      },
      {
        title: "已送达",
        detail: "订单完成配送后，系统会在这里标记已送达。",
        time: "待更新",
        state: "pending",
      }
    );

    return items;
  }

  items.push({
    title: "支付已完成",
    detail: "订单已完成支付，系统已将其加入仓库处理队列。",
    time: paidTime,
    state: "done",
  });

  if (order.status === "paid") {
    items.push(
      {
        title: "待发货",
        detail: "仓库正在配货打包，准备发货。",
        time: updatedTime,
        state: "current",
      },
      {
        title: "运输中",
        detail: "商家发货后，运输节点会在这里继续更新。",
        time: "待更新",
        state: "pending",
      },
      {
        title: "已送达",
        detail: "订单完成配送后，系统会在这里标记已送达。",
        time: "待更新",
        state: "pending",
      }
    );

    return items;
  }

  if (order.status === "shipping") {
    items.push(
      {
        title: "待发货",
        detail: "仓库已完成配货并安排出库。",
        time: updatedTime,
        state: "done",
      },
      {
        title: "运输中",
        detail: "包裹已发出，正在运输途中。",
        time: updatedTime,
        state: "current",
      },
      {
        title: "已送达",
        detail: "订单完成配送后，系统会在这里标记已送达。",
        time: "待更新",
        state: "pending",
      }
    );

    return items;
  }

  if (order.status === "delivered") {
    items.push(
      {
        title: "待发货",
        detail: "仓库已完成配货并安排出库。",
        time: paidTime,
        state: "done",
      },
      {
        title: "运输中",
        detail: "包裹已完成在途运输。",
        time: updatedTime,
        state: "done",
      },
      {
        title: "已送达",
        detail: "包裹已送达，请及时查收并确认商品状态。",
        time: updatedTime,
        state: "done",
      }
    );

    return items;
  }

  if (order.status === "cancelled") {
    items.push({
      title: "订单已取消",
      detail: paid
        ? "订单已终止，本次履约流程不会继续推进。"
        : "订单在支付前已取消，本次履约流程不会继续推进。",
      time: updatedTime,
      state: "cancelled",
    });
  }

  return items;
}

/**
 * 包裹摘要只展示最关键的信息：商品名、件数和已有图片。
 * 没有图片时使用占位，不再回退到固定网络图。
 */
export function summarizeOrderItems(items?: OrderItem[]): PackageSummary {
  const safeItems = items ?? [];
  const names = safeItems.map((item) => item.product?.name ?? "商品");
  const count = safeItems.reduce((sum, item) => sum + item.quantity, 0);
  const imageUrls = safeItems
    .map((item) => item.product?.image_url)
    .filter((value): value is string => Boolean(value))
    .slice(0, 2);

  if (names.length === 0) {
    return {
      title: "暂无商品信息",
      count: 0,
      imageUrls,
    };
  }

  if (names.length === 1) {
    return {
      title: names[0],
      count,
      imageUrls,
    };
  }

  if (names.length === 2) {
    return {
      title: `${names[0]}、${names[1]}`,
      count,
      imageUrls,
    };
  }

  return {
    title: `${names[0]}、${names[1]}等${count}件商品`,
    count,
    imageUrls,
  };
}

/** 物流状态码到中文标签的映射 */
export function getLogisticsStatusLabel(status?: string | null) {
  switch (status) {
    case "pending":
      return "待发货";
    case "shipped":
      return "已发货";
    case "in_transit":
      return "运输中";
    case "pickup_pending":
      return "待到店自提";
    case "delivered":
      return "已送达";
    default:
      return status ? `物流状态：${status}` : "待同步";
  }
}

/** 将数据库行格式的物流事件映射为前端 TrackingEvent 类型 */
export function mapTrackingEvents(rows: TrackingEventRow[] | null | undefined) {
  return (rows ?? []).map((item) => ({
    status: item.status,
    title: item.title,
    detail: item.detail,
    eventTime: item.event_time,
    sortOrder: item.sort_order,
  }));
}

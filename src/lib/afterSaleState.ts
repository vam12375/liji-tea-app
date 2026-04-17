// 售后域纯逻辑模块：不依赖 supabase / react-native，方便测试与 SQL 镜像对齐。

import type { AfterSaleRequestStatus, Order } from "@/types/database";

export const AFTER_SALE_REASON_OPTIONS = [
  { code: "wrong_item", label: "商品拍错 / 下错单" },
  { code: "delay", label: "发货慢 / 不想等了" },
  { code: "damaged", label: "包装破损 / 商品异常" },
  { code: "quality_issue", label: "品质问题" },
  { code: "other", label: "其他原因" },
] as const;

const ACTIVE_AFTER_SALE_STATUSES = new Set<AfterSaleRequestStatus>([
  "submitted",
  "auto_approved",
  "pending_review",
  "approved",
  "refunding",
]);

// 处理中状态：与 SQL 侧 uq_after_sale_requests_active_order 唯一索引保持口径一致。
export function isActiveAfterSaleStatus(
  status?: AfterSaleRequestStatus | null,
) {
  return status ? ACTIVE_AFTER_SALE_STATUSES.has(status) : false;
}

// 订单是否允许发起售后：已完成支付但未退款 / 未发起售后时放行。
export function canApplyAfterSale(order: Order | null | undefined) {
  if (!order) {
    return false;
  }

  if (
    order.status !== "paid" &&
    order.status !== "shipping" &&
    order.status !== "delivered"
  ) {
    return false;
  }

  if (order.after_sale_status) {
    return false;
  }

  if (order.refund_status === "refunded") {
    return false;
  }

  return true;
}

export function getAfterSaleReasonLabel(reasonCode?: string | null) {
  if (!reasonCode) {
    return "--";
  }

  return (
    AFTER_SALE_REASON_OPTIONS.find((item) => item.code === reasonCode)?.label ??
    reasonCode
  );
}

export function getAfterSaleStatusLabel(
  status?: AfterSaleRequestStatus | null,
) {
  switch (status) {
    case "submitted":
      return "已提交";
    case "auto_approved":
      return "自动通过";
    case "pending_review":
      return "待审核";
    case "approved":
      return "审核通过";
    case "rejected":
      return "已拒绝";
    case "refunding":
      return "退款中";
    case "refunded":
      return "已退款";
    case "cancelled":
      return "已撤销";
    default:
      return "待处理";
  }
}

export function getAfterSaleStatusDescription(
  status?: AfterSaleRequestStatus | null,
) {
  switch (status) {
    case "auto_approved":
      return "系统已自动通过退款申请，正在等待退款结果。";
    case "pending_review":
      return "申请已进入人工审核，请耐心等待。";
    case "approved":
      return "审核已通过，正在处理退款。";
    case "rejected":
      return "申请未通过，请查看审核说明。";
    case "refunding":
      return "退款处理中，请留意后续到账结果。";
    case "refunded":
      return "退款已完成。";
    case "cancelled":
      return "退款申请已撤销。";
    case "submitted":
      return "申请已提交。";
    default:
      return "状态同步中。";
  }
}

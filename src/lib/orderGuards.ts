import type { Address, Order, OrderItem, Product } from "@/types/database";
import type { OrderPaymentStatus, PaymentChannel } from "@/types/payment";

/**
 *订单项联表后的原始结构。
 * Supabase 可能返回 `product: null`，因此这里先保留可空形态，后续再统一归一化。
 */
export type OrderItemRow = Omit<OrderItem, "product"> & {
  product?: Product | null;
};

/**
 * Supabase 查询结果会带可空联表字段，这里单独定义运行时校验前使用的原始结构。
 */
export type OrderRow = Omit<Order, "coupon_discount" | "order_items" | "address"> & {
  coupon_discount?: number | null;
  order_items?: OrderItemRow[] | null;
  address?: Address | null;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

export function isOptionalNullableString(
  value: unknown,
): value is string | null | undefined {
  return value === undefined || isNullableString(value);
}

export function isOptionalNullableNumber(
  value: unknown,
): value is number | null | undefined {
  return value === undefined || value === null || typeof value === "number";
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isNullableStringArray(value: unknown): value is string[] | null {
  return value === null || isStringArray(value);
}

export function isPaymentChannel(value: unknown): value is PaymentChannel {
  return value === "alipay" || value === "wechat" || value === "card";
}

export function isNullablePaymentChannel(
  value: unknown,
): value is PaymentChannel | null {
  return value === null || isPaymentChannel(value);
}

export function isOptionalNullablePaymentChannel(
  value: unknown,
): value is PaymentChannel | null | undefined {
  return value === undefined || isNullablePaymentChannel(value);
}

export function isOrderPaymentStatus(
  value: unknown,
): value is OrderPaymentStatus | null | undefined {
  return (
    value === undefined ||
    value === null ||
    value === "pending_payment" ||
    value === "paying" ||
    value === "success" ||
    value === "failed" ||
    value === "closed"
  );
}

/**订单主状态只接受数据库定义的五种状态。 */
export function isOrderStatus(value: unknown): value is Order["status"] {
  return (
    value === "pending" ||
    value === "paid" ||
    value === "shipping" ||
    value === "delivered" ||
    value === "cancelled"
  );
}

export function isAfterSaleRequestStatus(
  value: unknown,
): value is Order["after_sale_status"] {
  return (
    value === undefined ||
    value === null ||
    value === "submitted" ||
    value === "auto_approved" ||
    value === "pending_review" ||
    value === "approved" ||
    value === "rejected" ||
    value === "refunding" ||
    value === "refunded" ||
    value === "cancelled"
  );
}

export function isRefundStatus(
  value: unknown,
): value is Order["refund_status"] {
  return (
    value === undefined ||
    value === null ||
    value === "refunding" ||
    value === "refunded"
  );
}

/** 商品风味画像是结构化数组，这里保证页面读取时字段完整。 */
export function isTastingProfile(value: unknown): value is Product["tasting_profile"] {
  return (
    value === null ||
    (Array.isArray(value) &&
      value.every(
        (item) =>
          isRecord(item) &&
          typeof item.label === "string" &&
          typeof item.description === "string" &&
          typeof item.value === "number",
      ))
  );
}

/** 冲泡指南是对象结构，避免页面直接读取未知字段时报错。 */
export function isBrewingGuide(value: unknown): value is Product["brewing_guide"] {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.temperature === "string" &&
      typeof value.time === "string" &&
      typeof value.amount === "string" &&
      typeof value.equipment === "string")
  );
}

/** 订单详情会联表商品信息，这里校验商品结构是否满足页面渲染要求。 */
export function isProductRow(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isNullableString(value.origin) &&
    typeof value.price === "number" &&
    typeof value.unit === "string" &&
    isNullableString(value.image_url) &&
    isNullableString(value.description) &&
    typeof value.is_new === "boolean" &&
    typeof value.category === "string" &&
    isNullableString(value.tagline) &&
    isTastingProfile(value.tasting_profile) &&
    isBrewingGuide(value.brewing_guide) &&
    isNullableString(value.origin_story) &&
    isNullableStringArray(value.process) &&
    typeof value.stock === "number" &&
    typeof value.is_active === "boolean" &&
    typeof value.created_at === "string"
  );
}

/**地址联表数据的最小结构校验。 */
export function isAddressRow(value: unknown): value is Address {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.user_id === "string" &&
    typeof value.name === "string" &&
    typeof value.phone === "string" &&
    typeof value.address === "string" &&
    typeof value.is_default === "boolean" &&
    typeof value.created_at === "string"
  );
}

/**订单项结构校验，同时校验可选商品联表字段。 */
export function isOrderItemRow(value: unknown): value is OrderItemRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.order_id === "string" &&
    typeof value.product_id === "string" &&
    typeof value.quantity === "number" &&
    typeof value.unit_price === "number" &&
    (value.product === undefined || value.product === null || isProductRow(value.product))
  );
}

/** 完整订单结构校验，确保列表页和详情页拿到的订单对象都可安全消费。 */
export function isOrderRow(value: unknown): value is OrderRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isOptionalNullableString(value.order_no) &&
    typeof value.user_id === "string" &&
    isNullableString(value.address_id) &&
    isOrderStatus(value.status) &&
    typeof value.total === "number" &&
    isOptionalNullableString(value.coupon_id) &&
    isOptionalNullableString(value.user_coupon_id) &&
    isOptionalNullableString(value.coupon_code) &&
    isOptionalNullableString(value.coupon_title) &&
    isOptionalNullableNumber(value.coupon_discount) &&
    typeof value.delivery_type === "string" &&
    isNullablePaymentChannel(value.payment_method) &&
    isOptionalNullablePaymentChannel(value.payment_channel) &&
    isOrderPaymentStatus(value.payment_status) &&
    isOptionalNullableString(value.out_trade_no) &&
    isOptionalNullableNumber(value.paid_amount) &&
    isOptionalNullableString(value.paid_at) &&
    isOptionalNullableString(value.trade_no) &&
    isOptionalNullableString(value.payment_error_code) &&
    isOptionalNullableString(value.payment_error_message) &&
    isOptionalNullableString(value.logistics_company) &&
    isOptionalNullableString(value.logistics_tracking_no) &&
    isOptionalNullableString(value.logistics_status) &&
    isOptionalNullableString(value.logistics_receiver_name) &&
    isOptionalNullableString(value.logistics_receiver_phone) &&
    isOptionalNullableString(value.logistics_address) &&
    isOptionalNullableString(value.shipped_at) &&
    isOptionalNullableString(value.delivered_at) &&
    isAfterSaleRequestStatus(value.after_sale_status) &&
    isRefundStatus(value.refund_status) &&
    isOptionalNullableNumber(value.refund_amount) &&
    isOptionalNullableString(value.refunded_at) &&
    (typeof value.notes === "string" || value.notes === null) &&
    typeof value.gift_wrap === "boolean" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    (value.order_items === undefined ||
      value.order_items === null ||
      (Array.isArray(value.order_items) && value.order_items.every(isOrderItemRow))) &&
    (value.address === undefined || value.address === null || isAddressRow(value.address))
  );
}

import { PENDING_ORDER_EXPIRE_MINUTES } from "@/lib/orderTiming";

/** 通用页面状态文案统一收口，便于后续继续扩展多语言。 */
export const screenStateCopy = {
  ordersLoading: {
    title: "正在加载订单",
    description: "请稍候，订单状态与履约信息正在同步。",
  },
  ordersEmpty: {
    title: "暂无相关订单",
    description: "下单后可在这里查看订单状态与物流进度。",
  },
  trackingLoading: {
    title: "正在加载订单履约信息",
    description: "页面会根据当前订单状态生成真实的履约阶段展示。",
  },
  trackingMissing: {
    title: "未找到订单信息",
    description:
      "当前订单不存在、已失效，或您暂时无权查看这条订单履约信息。",
    actionLabel: "返回订单列表",
  },
} as const;

/** 订单列表和订单卡片的固定文案统一集中定义。 */
export const orderCopy = {
  screenTitle: "我的订单",
  listFooter: {
    loadingMore: "正在加载更多订单...",
    noMore: "没有更多订单了",
  },
  labels: {
    orderNumber: "订单号",
    couponUsed: "已使用优惠券",
    couponCode: "券码",
    itemCountPrefix: "共",
    itemCountSuffix: "件商品",
  },
  actions: {
    payNow: "立即付款",
    cancel: "取消订单",
    cancelTitle: "取消订单",
    cancelMessage: "确定要取消该订单吗？库存将被释放。",
    cancelConfirm: "确认取消",
    cancelFailedTitle: "取消失败",
  },
  couponFallback: "订单已享受优惠券抵扣",
} as const;

/** 待支付倒计时相关文案集中到这里，避免 orders/tracking 各写一份。 */
export function getPendingPaymentCopy() {
  return {
    activeTitle: "请尽快完成支付",
    expiredTitle: "订单支付已超时，系统正在自动取消",
    description: `待付款订单会在下单 ${PENDING_ORDER_EXPIRE_MINUTES} 分钟后自动关闭，超时后将无法继续支付。`,
  };
}

/** 支付结果说明按真实支付与 mock 支付分流。 */
export function getPaymentResultCopy(selectedMethod: "alipay" | "mock") {
  if (selectedMethod === "alipay") {
    return "最终支付结果以服务端验签后的订单状态为准，客户端不会直接写入 paid。";
  }

  return "当前支付方式为后端模拟支付，支付成功后由服务端直接更新订单状态。";
}

/** 支付页文案统一收口，减少页面内分散硬编码。 */
export const paymentCopy = {
  titles: {
    confirm: "确认支付",
    failed: "支付失败",
    success: "支付成功",
    incomplete: "支付未完成",
    result: "支付结果说明",
  },
  labels: {
    amount: "支付金额",
    paymentMethod: "支付方式",
    orderNumber: "订单编号",
    orderStatus: "订单状态",
    orderPendingStatus: "待支付",
    tradeNumber: "支付单号",
    sdkStatus: "SDK 状态",
  },
  buttons: {
    retry: "重新发起支付",
    backToOrders: "返回订单",
    viewOrders: "查看订单",
  },
  modalTitles: {
    cannotStart: "无法发起支付",
  },
  messages: {
    missingOrderId: "缺少订单编号，无法发起支付。",
    channelDisabled: "当前支付渠道未启用，请返回订单页重新选择。",
    fallbackFailed: "支付失败，请稍后重试。",
    waitingForServerConfirm: "请勿关闭页面，支付状态会在服务端确认后更新。",
    waitingAfterSdk: "支付客户端返回结果后，仍会继续等待服务端验签确认。",
    mockSuccessHint: "模拟支付成功后，订单会由后端直接更新为待发货。",
  },
} as const;

/** 支付确认按钮文案带金额，统一由常量层拼接。 */
export function getConfirmPaymentButtonText(amount: number) {
  return `确认支付 ¥${amount.toFixed(2)}`;
}

/** 物流追踪页与动作卡的文案集中维护，便于后续继续抽离多语言。 */
export const trackingCopy = {
  screenTitle: "物流追踪",
  sections: {
    address: "收货信息",
    logistics: "物流信息",
    latestEvents: "最新物流轨迹",
    progress: "履约进度",
    package: "包裹摘要",
  },
  labels: {
    orderNumber: "订单号",
    orderedAt: "下单时间",
    deliveryType: "配送方式",
    coupon: "优惠券",
    couponDiscount: "优惠抵扣",
    consignee: "收货人",
    address: "收货地址",
    logisticsCompany: "物流公司",
    trackingNumber: "运单号",
    logisticsStatus: "物流状态",
    shippedAt: "发货时间",
    deliveredAt: "签收时间",
    orderNote: "订单备注",
  },
  fallback: {
    noAddress: "暂未获取收货地址",
    mockCompany: "模拟快递",
    trackingNumberPending: "待生成",
    trackingLoading: "正在加载物流轨迹",
    trackingEmpty: "暂无物流轨迹",
    trackingLoadingDescription: "请稍候，系统正在同步最新物流事件。",
    trackingEmptyDescription:
      "支付成功后，系统会初始化物流轨迹；后续可在此页面继续模拟推进发货与签收。",
    couponUsed: "已使用优惠券",
  },
  packageSummary: {
    itemCountPrefix: "共",
    itemCountSuffix: "件商品",
    couponDiscountApplied: "优惠券已抵扣",
    giftWrapEnabled: "已选礼盒包装",
  },
  actions: {
    payNow: "立即付款",
    cancel: "取消订单",
    cancelTitle: "取消订单",
    cancelMessage: "确定要取消该订单吗？库存将被释放。",
    cancelConfirm: "确认取消",
    advanceLogistics: "模拟发货",
    advancingLogistics: "正在推进物流...",
    confirmReceive: "确认收货",
    confirmReceiveTitle: "确认收货",
    confirmReceiveMessage: "确认已收到商品吗？",
    receiveConfirmedTitle: "已确认",
    receiveConfirmedMessage: "感谢您的购买。",
    applyRefund: "申请退款",
    viewAfterSale: "查看售后进度",
  },
  errors: {
    logisticsUpdateFailedTitle: "物流更新失败",
    logisticsUpdateFailedMessage: "更新模拟物流失败。",
    confirmReceiveFailedTitle: "确认失败",
    cancelFailedTitle: "取消失败",
  },
} as const;

/** 售后 / 退款中心文案。 */
export const afterSaleCopy = {
  titles: {
    apply: "申请退款",
    detail: "售后进度",
  },
  actions: {
    submit: "提交申请",
    cancel: "撤销申请",
    viewOrder: "查看订单",
  },
  messages: {
    applySuccess: "退款申请已提交。",
    cancelSuccess: "退款申请已撤销。",
    needReason: "请选择退款原因。",
    needDescription: "请补充问题说明，方便后续处理。",
    duplicateRequest: "该订单已有进行中的售后申请。",
    uploadPermissionDenied: "需要相册权限才能上传凭证。",
    uploadFailed: "上传凭证失败，请稍后重试。",
  },
  labels: {
    orderNumber: "订单号",
    requestedAmount: "申请金额",
    approvedAmount: "退款金额",
    reason: "退款原因",
    description: "问题说明",
    status: "当前状态",
    submittedAt: "申请时间",
    reviewedAt: "审核时间",
    refundedAt: "退款完成",
    evidences: "凭证图片",
  },
} as const;

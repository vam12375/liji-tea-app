import {useCallback } from "react";
import type { Router } from "expo-router";

import { getEnabledPaymentChannels, isPaymentChannelEnabled } from "@/lib/paymentConfig";
import { routes } from "@/lib/routes";
import { showModal } from "@/stores/modalStore";
import type { PaymentChannel } from "@/types/payment";
import type { DeliveryType } from "@/lib/order";

interface RequestItem {
productId: string;
  quantity: number;
}

interface AddressLike {
  id: string;
}

interface SessionLike {
  user?: { id?: string };
}

interface CreateOrderResult {
  order: {
    orderId: string;
    total: number;
  } | null;
  error: string | null;
}

interface UseCheckoutSubmitParams {
  router: Router;
  session: SessionLike | null;
address: AddressLike | null | undefined;
  requestItems: RequestItem[];
  delivery: DeliveryType;
  payment: PaymentChannel;
  note: string;
  giftBox: boolean;
  selectedUserCouponId: string | null;
pricingLoading: boolean;
  pricingError: string | null;
  productId?: string;
  createOrder: (params: {
    items: RequestItem[];
    addressId: string;
    deliveryType: DeliveryType;
    paymentMethod: PaymentChannel;
    notes?: string;
giftWrap: boolean;
    userCouponId?: string;
  }) => Promise<CreateOrderResult>;
  clearSelectedCoupon: () => void;
}

// 下单提交流程统一收口到 hook，页面只负责把当前选择态传进来。
export function useCheckoutSubmit({
  router,
  session,
  address,
  requestItems,
delivery,
  payment,
  note,
  giftBox,
  selectedUserCouponId,
  pricingLoading,
  pricingError,
  productId,
  createOrder,
  clearSelectedCoupon,
}: UseCheckoutSubmitParams) {
  return useCallback(async () => {
const enabledChannels = getEnabledPaymentChannels();

    // 提交前先把支付、地址、询价这几条高风险前置条件挡住。
    if (!session) {
      router.push(routes.login);
      return;
    }

    if (enabledChannels.length === 0 || !isPaymentChannelEnabled(payment)) {
      showModal("暂不可下单", "当前环境未启用有效的支付渠道。", "error");
      return;
    }

    if (requestItems.length === 0) {
      showModal("提示", "当前暂无可结算商品");
      return;
    }

    if (!address) {
      showModal("提示", "请先添加收货地址");
      return;
    }

    if (pricingLoading) {
      showModal("请稍候", "订单金额正在由服务端计算，请稍后再提交。");
      return;
    }

    if (pricingError) {
      showModal("订单失败", pricingError, "error");
      return;
    }

    const { order, error } = await createOrder({
      items: requestItems,
      addressId: address.id,
      deliveryType: delivery,
      paymentMethod: payment,
      notes: note || undefined,
      giftWrap: giftBox,
      userCouponId: selectedUserCouponId ?? undefined,
    });

    if (error || !order) {
      showModal("订单失败", error ?? "创建订单失败", "error");
      return;
    }

    clearSelectedCoupon();

    router.replace(
      routes.payment({
        orderId: order.orderId,
total: order.total.toFixed(2),
        paymentMethod: payment,
        fromCart: productId ? "0" : "1",
      }),
    );
  }, [
address,
    clearSelectedCoupon,
    createOrder,
    delivery,
    giftBox,
    note,
    payment,
    pricingError,
    pricingLoading,
    productId,
    requestItems,
    router,
    selectedUserCouponId,
    session,
  ]);
}

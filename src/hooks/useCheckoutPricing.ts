import { useEffect, useMemo, useState } from "react";

import { quoteOrder, type DeliveryType, type OrderPricingQuote } from "@/lib/order";

interface RequestItem {
  productId: string;
  quantity: number;
}

interface UseCheckoutPricingParams {
items: RequestItem[];
  deliveryType: DeliveryType;
  giftWrap: boolean;
  selectedUserCouponId: string | null;
}

// 结算页统一从这里发起服务端询价，避免页面层自己拼接金额状态。
export function useCheckoutPricing({
  items,
  deliveryType,
  giftWrap,
selectedUserCouponId,
}: UseCheckoutPricingParams) {
  const [pricing, setPricing] = useState<OrderPricingQuote | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

const hasItems = items.length > 0;

  const submitDisabledByPricing = useMemo(
    () => !hasItems || pricingLoading || !!pricingError || !pricing,
    [hasItems, pricing, pricingError, pricingLoading],
  );

  useEffect(() => {
    if (!hasItems) {
      setPricing(null);
setPricingError("暂无可结算商品");
      setPricingLoading(false);
      return;
    }

    // 参数变化时直接重新询价，页面展示始终以后端最新金额为准。
    let cancelled = false;
    setPricingLoading(true);
    setPricingError(null);

    quoteOrder({
      items,
      deliveryType,
      giftWrap,
      userCouponId:selectedUserCouponId ?? undefined,
    })
      .then((quote) => {
        if (!cancelled) {
          setPricing(quote);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setPricing(null);
        setPricingError(
          error instanceof Error ? error.message : "获取订单金额失败",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setPricingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deliveryType, giftWrap, hasItems, items, selectedUserCouponId]);

  return {
pricing,
    pricingLoading,
    pricingError,
    submitDisabledByPricing,
  };
}

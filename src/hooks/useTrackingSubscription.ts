import { useEffect } from "react";

import { track } from "@/lib/analytics";
import { logWarn } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { useOrderStore } from "@/stores/orderStore";
import type { Order } from "@/types/database";

// Realtime 订阅收到的 payload 只需要最小校验 id 字段即可落到 store。
function isOrderUpdatePayload(
  value: unknown,
): value is Partial<Order> & { id: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  );
}

// 将订单订阅逻辑抽成独立 hook，避免页面主体继续混杂频道与 payload 处理细节。
export function useTrackingSubscription(orderId?: string, userId?: string) {
  const updateOrder = useOrderStore((state) => state.updateOrder);

  useEffect(() => {
    if (!orderId || !userId) {
      return;
    }

    const channelName = `order-tracking:${userId}:${orderId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          // 这里只接受最小合法的订单更新结构，避免异常 payload 直接污染 store。
          if (!isOrderUpdatePayload(payload.new)) {
            logWarn("tracking", "收到非法订单更新 payload", {
              orderId,
              userId,
              payload: payload.new,
            });
            return;
          }

          updateOrder(payload.new);
        },
      )
      .subscribe((status) => {
        // 订阅异常统一接入埋点，后续可接真实监控平台统计频道稳定性。
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          track("tracking_subscription_error", {
            orderId,
            userId,
            channelName,
            status,
          });
          logWarn("tracking", "订单追踪订阅状态异常", {
            orderId,
            userId,
            channelName,
            status,
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, updateOrder, userId]);
}

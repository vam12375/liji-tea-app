import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { normalizeCancelPendingOrderResponse } from "@/lib/orderRpc";

/** 订单关闭 RPC 响应解析测试。 */
export async function runOrderRpcTests() {
  console.log("[Suite] orderRpc");

  await runCase("normalizes cancel order rpc response", () => {
    assert.deepEqual(
      normalizeCancelPendingOrderResponse({
        released: true,
        order_status: "cancelled",
        payment_status: "closed",
      }),
      {
        released: true,
        orderStatus: "cancelled",
        paymentStatus: "closed",
      },
    );
  });

  await runCase("rejects invalid cancel order rpc payload", () => {
    assert.equal(
      normalizeCancelPendingOrderResponse({
        released: true,
        orderStatus: "cancelled",
      }),
      null,
    );
  });
}

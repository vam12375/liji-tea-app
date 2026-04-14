import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { routes } from "../src/lib/routes";

/** 路由工具函数测试。 */
export async function runRoutesTests() {
  console.log("[Suite] routes");

  await runCase("builds orders tab route", () => {
    assert.deepEqual(routes.ordersTab("paid"), {
      pathname: "/orders",
      params: { initialTab: "paid" },
    });
  });

  await runCase("builds payment route params", () => {
    assert.deepEqual(
      routes.payment({
        orderId: "order-1",
        total: "88.00",
        paymentMethod: "alipay",
        fromCart: "1",
      }),
      {
        pathname: "/payment",
        params: {
          orderId: "order-1",
          total: "88.00",
          paymentMethod: "alipay",
          fromCart: "1",
        },
      },
    );
  });

  await runCase("builds product reviews route params", () => {
    assert.deepEqual(routes.productReviews("product-1"), {
      pathname: "/my-reviews",
      params: { productId: "product-1", initialTab: "已评价" },
    });
  });
}

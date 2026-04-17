import { runAfterSaleTests } from "./afterSale.test";
import { runAliOneClickSupportTests } from "./aliOneClickSupport.test";
import { runCollectionsTests } from "./collections.test";
import { runCommunityFeedTests } from "./communityFeed.test";
import { runCouponSelectionTests } from "./couponSelection.test";
import { runCouponExpiryReleaseTests } from "./couponExpiryRelease.test";
import { runCouponPricingTests } from "./couponPricing.test";
import { runCouponScopeTests } from "./couponScope.test";
import { runCouponScopeExpansionTests } from "./couponScopeExpansion.test";
import { runOrderRpcTests } from "./orderRpc.test";
import { runOrderTimingTests } from "./orderTiming.test";
import { runPaymentConfigTests } from "./paymentConfig.test";
import { runPaymentFlowTests } from "./paymentFlow.test";
import { runPushNotificationsTests } from "./pushNotifications.test";
import { runRoutesTests } from "./routes.test";
import { runReviewsNotificationsTests } from "./reviewsNotifications.test";
import { runSearchNormalizeTests } from "./searchNormalize.test";
import { runMemberPointsTests } from "./memberPoints.test";
import { runTrackingUtilsTests } from "./trackingUtils.test";
import { runUserMutationsTests } from "./userMutations.test";

/**
 * 轻量测试入口：按固定顺序串行执行各个测试套件。
 * 当前仓库不引入大型测试框架，因此由这里统一汇总并输出总结信息。
 */
async function main() {
  /** 按业务域分组后的测试套件列表，便于后续继续追加。 */
  const suites = [
    runAfterSaleTests,
    runAliOneClickSupportTests,
    runCollectionsTests,
    runCommunityFeedTests,
 runCouponSelectionTests,
 runCouponExpiryReleaseTests,
 runCouponPricingTests,
 runCouponScopeTests,
 runCouponScopeExpansionTests,
 runOrderRpcTests,
    runOrderTimingTests,
    runTrackingUtilsTests,
    runPaymentConfigTests,
    runPaymentFlowTests,
    runPushNotificationsTests,
    runRoutesTests,
    runReviewsNotificationsTests,
    runSearchNormalizeTests,
    runMemberPointsTests,
    runUserMutationsTests,
  ];

  for (const suite of suites) {
    await suite();
  }

  console.log("[Summary] All test suites passed.");
}

/** 顶层兜底异常处理，保证 CI / 本地命令能以非零退出码失败。 */
main().catch((error) => {
  console.error("[Summary] Test run failed.");
  console.error(error);
  process.exit(1);
});

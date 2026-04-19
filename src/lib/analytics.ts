import { logInfo } from "@/lib/logger";

/**
 * 客户端行为事件 facade（纯 Node 友好）。
 *
 * 为什么不在这里直接写入远端：
 * - 既有 paymentFlow / orderStore / tracking 等多个测试通过 transitive import 走到这里；
 *   若本文件直接依赖 `@/lib/supabase`（-> react-native），会把 RN 模块拖进 tsx 测试运行时。
 * - 参考 `logger.ts` + `crashReporter.ts` 模式：本文件只负责类型与事件分发，
 *   真正的 AsyncStorage 队列 / Edge Function 上报由 `analyticsReporter.ts` 独立承载，
 *   通过 `registerAnalyticsHandler` 在应用入口挂接即可。
 */

// 白名单事件名——既用于 TS 类型提示，也便于后台统一字段约束。
// 分组约束：每个事件都应能直接支撑一个运营/转化分析问题，避免追加"投机事件"。
export type AnalyticsEvent =
  // ===== 支付 / 订单（原有，保持兼容） =====
  | "payment_started"
  | "payment_succeeded"
  | "payment_failed"
  | "payment_cancelled"
  | "order_list_fetch_failed"
  | "order_detail_fetch_failed"
  | "order_cancelled"
  | "order_confirmed"
  | "tracking_events_fetch_failed"
  | "tracking_subscription_error"
  // ===== 曝光 / 发现 =====
  | "home_impression"          // 首页冷启曝光（统计 DAU / 跳失率基线）
  | "product_impression"       // 首页推荐位商品可见（CTR 分子基线）
  | "product_view"             // 商品详情页进入（加购漏斗第 1 步）
  | "article_view"             // 内容文章进入（内容侧活跃度）
  | "search_submit"            // 搜索关键词提交（搜索词运营）
  // ===== 购买漏斗 =====
  | "add_to_cart"              // 加购（漏斗第 2 步）
  | "checkout_start"           // 进入结算页（漏斗第 3 步）
  | "coupon_apply"             // 结算页应用券（辅助漏斗侧支）
  | "order_submit"             // 订单提交成功（漏斗第 4 步，与 payment_succeeded 组合看最终转化）
  // ===== 留存 / 账户 =====
  | "login_success"            // 登录成功（区分 email / one-click）
  | "register_success"         // 注册成功
  | "favorite_added"           // 收藏（意向型指标）
  | "coupon_claim"             // 领券（运营活动效果）
  // ===== 内容 / 分享 =====
  | "post_publish"             // 社区发帖成功（UGC 健康度）
  | "share_triggered";         // 分享触发（裂变传播基础）

export interface AnalyticsPayload {
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
  occurredAt: string;
}

export type AnalyticsHandler = (payload: AnalyticsPayload) => void;

let handler: AnalyticsHandler | null = null;

/** 由应用入口（analyticsReporter.ts）调用挂接远端 transport；传入 null 可解绑。 */
export function registerAnalyticsHandler(next: AnalyticsHandler | null): void {
  handler = next;
}

/**
 * 业务代码主入口：记录一条行为事件。
 *
 * - 本地 logInfo 保留可观测性：即使远端 ingest 未挂接或挂了，开发者仍能看到事件流。
 * - 已挂接 handler 时把事件透传出去，由 handler 负责队列 / 批量 / 持久化；
 *   handler 内部任何异常都在这里吞掉，绝不回调 captureError，避免无限递归。
 */
export function track(
  event: AnalyticsEvent,
  payload?: Record<string, unknown>,
): void {
  logInfo("analytics", event, payload);

  if (!handler) {
    return;
  }

  try {
    handler({
      event,
      properties: payload,
      occurredAt: new Date().toISOString(),
    });
  } catch {
    // 防御式兜底：handler 异常不能拖垮业务日志路径。
  }
}

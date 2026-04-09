import { logInfo } from "@/lib/logger";

export type AnalyticsEvent =
  | "payment_started"
  | "payment_succeeded"
  | "payment_failed"
  | "payment_cancelled"
  | "order_list_fetch_failed"
  | "order_detail_fetch_failed"
  | "order_cancelled"
  | "order_confirmed"
  | "tracking_events_fetch_failed"
  | "tracking_subscription_error";

export function track(
  event: AnalyticsEvent,
  payload?: Record<string, unknown>,
) {
  logInfo("analytics", event, payload);
}


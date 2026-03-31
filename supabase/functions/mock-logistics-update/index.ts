declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
    createServiceClient,
    getUserFromRequest,
} from "../_shared/supabase.ts";

interface TrackingEventRow {
  id: string;
  status: string;
  title: string;
  detail: string;
  event_time: string;
  sort_order: number;
}

interface OrderLogisticsRow {
  id: string;
  user_id: string;
  status: string;
  logistics_company: string | null;
  logistics_tracking_no: string | null;
  logistics_status: string | null;
  logistics_receiver_name: string | null;
  logistics_receiver_phone: string | null;
  logistics_address: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}

function buildShippedEvent(order: OrderLogisticsRow, now: string) {
  return {
    status: "shipped",
    title: order.logistics_company === "门店自提" ? "商品待自提" : "包裹已发货",
    detail:
      order.logistics_company === "门店自提"
        ? "商品已备货完成，请根据门店通知前往自提。"
        : `包裹已由${order.logistics_company ?? "物流服务商"}发出，运单号 ${order.logistics_tracking_no ?? "待生成"}。`,
    event_time: now,
    sort_order: 50,
  };
}

function buildDeliveredEvent(order: OrderLogisticsRow, now: string) {
  return {
    status: "delivered",
    title: order.logistics_company === "门店自提" ? "商品已取货" : "包裹已签收",
    detail:
      order.logistics_company === "门店自提"
        ? `${order.logistics_receiver_name ?? "您"} 已完成提货。`
        : `包裹已送达 ${order.logistics_address ?? "收货地址"}，请确认商品状态。`,
    event_time: now,
    sort_order: 60,
  };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse("仅支持 POST 请求。", 405, "method_not_allowed");
  }

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return errorResponse("未登录或登录状态已失效。", 401, "unauthorized");
    }

    const requestBody = await req.json().catch(() => null);
    const orderId =
      requestBody && typeof requestBody.orderId === "string"
        ? requestBody.orderId
        : "";
    const action =
      requestBody && typeof requestBody.action === "string"
        ? requestBody.action
        : "advance";

    if (!orderId) {
      return errorResponse("缺少 orderId。", 400, "missing_order_id");
    }

    const supabase = createServiceClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, user_id, status, logistics_company, logistics_tracking_no, logistics_status, logistics_receiver_name, logistics_receiver_phone, logistics_address, shipped_at, delivered_at",
      )
      .eq("id", orderId)
      .single<OrderLogisticsRow>();

    if (error || !order) {
      return errorResponse(
        "订单不存在。",
        404,
        "order_not_found",
        error?.message,
      );
    }

    if (order.user_id !== user.id) {
      return errorResponse("无权访问该订单。", 403, "forbidden");
    }

    if (order.status === "pending" || order.status === "cancelled") {
      return errorResponse(
        "当前订单尚未进入物流流程。",
        409,
        "invalid_order_status",
      );
    }

    const { data: existingEvents, error: eventError } = await supabase
      .from("order_tracking_events")
      .select("id, status, title, detail, event_time, sort_order")
      .eq("order_id", order.id)
      .order("sort_order", { ascending: true })
      .order("event_time", { ascending: true })
      .returns<TrackingEventRow[]>();

    if (eventError) {
      return errorResponse(
        "读取物流轨迹失败。",
        500,
        "tracking_events_failed",
        eventError.message,
      );
    }

    const now = new Date().toISOString();
    const hasShipped = (existingEvents ?? []).some(
      (item: TrackingEventRow) => item.status === "shipped",
    );
    const hasDelivered = (existingEvents ?? []).some(
      (item: TrackingEventRow) => item.status === "delivered",
    );

    let nextStatus = order.status;
    let logisticsStatus = order.logistics_status ?? "pending";
    let shippedAt = order.shipped_at;
    let deliveredAt = order.delivered_at;
    const eventsToInsert: Omit<TrackingEventRow, "id">[] = [];

    if (
      action === "ship" ||
      (action === "advance" && order.status === "paid")
    ) {
      if (!hasShipped) {
        nextStatus = "shipping";
        logisticsStatus = "shipped";
        shippedAt = now;
        eventsToInsert.push(buildShippedEvent(order, now));
      }
    } else if (
      action === "deliver" ||
      (action === "advance" && order.status === "shipping")
    ) {
      if (!hasShipped) {
        shippedAt = now;
        eventsToInsert.push(buildShippedEvent(order, now));
      }
      if (!hasDelivered) {
        nextStatus = "delivered";
        logisticsStatus = "delivered";
        deliveredAt = now;
        eventsToInsert.push(buildDeliveredEvent(order, now));
      }
    } else {
      return errorResponse("不支持的物流操作。", 400, "invalid_action");
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: nextStatus,
        logistics_status: logisticsStatus,
        shipped_at: shippedAt,
        delivered_at: deliveredAt,
        updated_at: now,
      })
      .eq("id", order.id);

    if (updateError) {
      return errorResponse(
        "更新物流状态失败。",
        500,
        "update_order_failed",
        updateError.message,
      );
    }

    if (eventsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("order_tracking_events")
        .insert(
          eventsToInsert.map((item) => ({
            order_id: order.id,
            user_id: order.user_id,
            status: item.status,
            title: item.title,
            detail: item.detail,
            event_time: item.event_time,
            sort_order: item.sort_order,
          })),
        );

      if (insertError) {
        return errorResponse(
          "写入物流轨迹失败。",
          500,
          "insert_tracking_failed",
          insertError.message,
        );
      }
    }

    const { data: latestEvents } = await supabase
      .from("order_tracking_events")
      .select("status, title, detail, event_time, sort_order")
      .eq("order_id", order.id)
      .order("sort_order", { ascending: true })
      .order("event_time", { ascending: true });

    return jsonResponse({
      orderId: order.id,
      status: nextStatus,
      logisticsStatus: logisticsStatus,
      shippedAt,
      deliveredAt,
      trackingEvents: latestEvents ?? [],
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "更新模拟物流失败。",
      500,
      "internal_error",
    );
  }
});

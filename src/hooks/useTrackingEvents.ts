import { useCallback, useEffect, useState } from "react";

import { track } from "@/lib/analytics";
import { captureError } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import {
  mapTrackingEvents,
  type TrackingEventRow,
} from "@/lib/trackingUtils";
import type { TrackingEvent } from "@/types/payment";

// 将物流事件查询抽成独立 hook，让页面主体只消费“事件列表 + 加载状态”。
export function useTrackingEvents(
  orderId?: string,
  userId?: string,
  updatedAt?: string | null,
) {
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    if (!orderId || !userId) {
      setTrackingEvents([]);
      setEventsLoading(false);
      return;
    }

    let active = true;

    const loadTrackingEvents = async () => {
      try {
        setEventsLoading(true);

        const { data, error } = await supabase
          .from("order_tracking_events")
          .select("status, title, detail, event_time, sort_order")
          .eq("order_id", orderId)
          .order("sort_order", { ascending: false })
          .order("event_time", { ascending: false })
          .returns<TrackingEventRow[]>();

        if (error) {
          throw error;
        }

        if (active) {
          setTrackingEvents(mapTrackingEvents(data));
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "物流轨迹加载失败";

        track("tracking_events_fetch_failed", {
          orderId,
          userId,
          message,
        });
        captureError(error, {
          scope: "tracking",
          message: "loadTrackingEvents 失败",
          orderId,
          userId,
        });

        if (active) {
          setTrackingEvents([]);
        }
      } finally {
        if (active) {
          setEventsLoading(false);
        }
      }
    };

    void loadTrackingEvents();

    return () => {
      active = false;
    };
  }, [orderId, updatedAt, userId]);

  // 允许页面在模拟物流成功后直接回填最新轨迹，减少一次无意义等待。
  const replaceTrackingEvents = useCallback((events: TrackingEvent[]) => {
    setTrackingEvents(events);
    setEventsLoading(false);
  }, []);

  return {
    trackingEvents,
    eventsLoading,
    replaceTrackingEvents,
  };
}

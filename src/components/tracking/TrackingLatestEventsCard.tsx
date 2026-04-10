import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Text, View } from "react-native";

import { TrackingTimelineMarker } from "@/components/tracking/TrackingTimelineMarker";
import { Colors } from "@/constants/Colors";
import { trackingCopy } from "@/constants/copy";
import {
  formatDateTime,
  type TimelineState,
} from "@/lib/trackingUtils";
import type { TrackingEvent } from "@/types/payment";

interface TrackingLatestEventsCardProps {
  trackingEvents: TrackingEvent[];
  eventsLoading: boolean;
}

// 最新物流轨迹卡专注处理 section 内部的加载态、空态和列表渲染。
export function TrackingLatestEventsCard({
  trackingEvents,
  eventsLoading,
}: TrackingLatestEventsCardProps) {
  return (
    <View className="gap-4 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons
          name="fact-check"
          size={18}
          color={Colors.primaryContainer}
        />
        <Text className="text-base font-bold text-on-surface">
          {trackingCopy.sections.latestEvents}
        </Text>
      </View>

      {eventsLoading ? (
        <View className="items-center gap-3 rounded-xl bg-background px-4 py-5">
          <ActivityIndicator size="small" color={Colors.primaryContainer} />
          <Text className="text-sm font-medium text-on-surface">
            {trackingCopy.fallback.trackingLoading}
          </Text>
          <Text className="text-center text-xs leading-5 text-outline">
            {trackingCopy.fallback.trackingLoadingDescription}
          </Text>
        </View>
      ) : trackingEvents.length > 0 ? (
        <View className="relative">
          <View
            className="absolute bottom-3 left-[11px] top-3 w-[2px] bg-outline-variant/40"
          />

          {trackingEvents.map((item, index) => {
            // 最新物流轨迹按倒序展示，因此首条视为当前节点，其余默认为已完成节点。
            const markerState: TimelineState =
              item.status === "cancelled"
                ? "cancelled"
                : item.status === "delivered"
                  ? "done"
                  : index === 0
                    ? "current"
                    : "done";

            return (
              <View
                key={`${item.title}-${item.eventTime}-${index}`}
                className={
                  index === trackingEvents.length - 1
                    ? "flex-row gap-4"
                    : "flex-row gap-4 pb-6"
                }
              >
                <View className="w-6 items-center pt-1">
                  <TrackingTimelineMarker state={markerState} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-medium text-on-surface">
                    {item.title}
                  </Text>
                  <Text className="text-xs leading-5 text-on-surface-variant">
                    {item.detail}
                  </Text>
                  <Text className="mt-0.5 text-[10px] text-outline">
                    {formatDateTime(item.eventTime)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View className="items-center gap-2 rounded-xl bg-background px-4 py-5">
          <MaterialIcons
            name="local-shipping"
            size={22}
            color={Colors.outline}
          />
          <Text className="text-sm font-medium text-on-surface">
            {trackingCopy.fallback.trackingEmpty}
          </Text>
          <Text className="text-center text-xs leading-5 text-outline">
            {trackingCopy.fallback.trackingEmptyDescription}
          </Text>
        </View>
      )}
    </View>
  );
}

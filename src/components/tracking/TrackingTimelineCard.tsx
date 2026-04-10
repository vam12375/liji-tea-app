import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";

import { TrackingTimelineMarker } from "@/components/tracking/TrackingTimelineMarker";
import { Colors } from "@/constants/Colors";
import { trackingCopy } from "@/constants/copy";
import type { TimelineItem } from "@/lib/trackingUtils";

interface TrackingTimelineCardProps {
  timeline: TimelineItem[];
}

// 履约进度卡负责承接 buildTrackingTimeline 的纯数据结果。
export function TrackingTimelineCard({ timeline }: TrackingTimelineCardProps) {
  return (
    <View className="gap-4 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons
          name="timeline"
          size={18}
          color={Colors.primaryContainer}
        />
        <Text className="text-base font-bold text-on-surface">
          {trackingCopy.sections.progress}
        </Text>
      </View>

      <View className="gap-4">
        {timeline.map((item, index) => {
          const isLast = index === timeline.length - 1;

          return (
            <View key={`${item.title}-${index}`} className="flex-row gap-4">
              <View className="w-6 items-center pt-1">
                <TrackingTimelineMarker state={item.state} />
              </View>
              <View
                className={`flex-1 gap-1 ${
                  isLast ? "" : "border-b border-outline-variant/10 pb-4"
                }`}
              >
                <Text className="text-sm font-medium text-on-surface">
                  {item.title}
                </Text>
                <Text className="text-xs leading-5 text-on-surface-variant">
                  {item.detail}
                </Text>
                <Text className="mt-0.5 text-[10px] text-outline">
                  {item.time}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

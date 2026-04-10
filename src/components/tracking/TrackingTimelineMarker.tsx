import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { View } from "react-native";

import { Colors } from "@/constants/Colors";
import type { TimelineState } from "@/lib/trackingUtils";

// 统一渲染时间线节点，保证物流轨迹与履约进度视觉风格一致。
export function TrackingTimelineMarker({ state }: { state: TimelineState }) {
  if (state === "done") {
    return (
      <View
        className="h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: Colors.primaryContainer }}
      >
        <MaterialIcons name="check" size={14} color="#fff" />
      </View>
    );
  }

  if (state === "current") {
    return (
      <View
        className="h-6 w-6 items-center justify-center rounded-full border-2"
        style={{
          borderColor: Colors.primaryContainer,
          backgroundColor: Colors.background,
        }}
      >
        <View
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: Colors.primaryContainer }}
        />
      </View>
    );
  }

  if (state === "cancelled") {
    return (
      <View
        className="h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: Colors.error }}
      >
        <MaterialIcons name="close" size={14} color="#fff" />
      </View>
    );
  }

  return (
    <View
      className="h-3 w-3 rounded-full"
      style={{ backgroundColor: Colors.outlineVariant }}
    />
  );
}

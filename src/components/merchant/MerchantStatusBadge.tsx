import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { MerchantColors } from "@/constants/MerchantColors";

export type MerchantStatusTone = "wait" | "go" | "done" | "stop";

const TONE_COLOR: Record<MerchantStatusTone, string> = {
  wait: MerchantColors.statusWait,
  go: MerchantColors.statusGo,
  done: MerchantColors.statusDone,
  stop: MerchantColors.statusStop,
};

interface Props {
  tone: MerchantStatusTone;
  label: string;
  /** 待办类默认 true，其它静态；可显式传 false 关掉呼吸。 */
  breathing?: boolean;
  size?: "sm" | "md";
}

// 语义状态徽标：小圆角方形 + 反白字 + 色块。
// wait 态默认呼吸 opacity 1↔0.7 每 2 秒一次，提示"有事要处理"。
export function MerchantStatusBadge({
  tone,
  label,
  breathing,
  size = "sm",
}: Props) {
  const defaultBreathing = tone === "wait";
  const enabled = breathing ?? defaultBreathing;

  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.7, { duration: 1000 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [enabled, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const padX = size === "sm" ? 8 : 12;
  const padY = size === "sm" ? 3 : 5;
  const fontSize = size === "sm" ? 11 : 13;

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          backgroundColor: TONE_COLOR[tone],
          borderRadius: 6,
          paddingHorizontal: padX,
          paddingVertical: padY,
          alignSelf: "flex-start",
        },
      ]}
    >
      <Text
        style={{
          color: "#fff",
          fontSize,
          fontWeight: "600",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

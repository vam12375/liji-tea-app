import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import { MerchantColors } from "@/constants/MerchantColors";
import {
  dismissMerchantToast,
  useMerchantToastStore,
  type MerchantToastKind,
} from "@/stores/merchantToastStore";

const AUTO_DISMISS_MS = 3000;

// 三种 Toast 对应的 tone 色与 icon；都走 MaterialIcons 内置集，零额外资源。
const KIND_META: Record<
  MerchantToastKind,
  { color: string; icon: keyof typeof MaterialIcons.glyphMap }
> = {
  success: { color: MerchantColors.statusGo, icon: "check-circle" },
  error: { color: MerchantColors.statusStop, icon: "error-outline" },
  info: { color: MerchantColors.ink500, icon: "info-outline" },
};

// 商家端顶部 Toast 组件：
// - 单 slot（由 merchantToastStore 保证）
// - Reanimated FadeInUp / FadeOutUp 预设，零自定义时间线
// - 3 秒自动消失；定时器按 id 捕获，避免新消息替换后误 dismiss
// - 点击整条可手动关闭，方便测试与急迫场景
export function MerchantToast() {
  const current = useMerchantToastStore((s) => s.current);

  useEffect(() => {
    if (!current) return;
    const capturedId = current.id;
    const timer = setTimeout(() => {
      if (useMerchantToastStore.getState().current?.id === capturedId) {
        dismissMerchantToast();
      }
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [current?.id, current]);

  if (!current) return null;

  const meta = KIND_META[current.kind];

  return (
    <Animated.View
      key={current.id}
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        paddingHorizontal: 16,
        paddingTop: 48,
        zIndex: 50,
      }}
    >
      <Pressable
        onPress={dismissMerchantToast}
        style={{
          backgroundColor: MerchantColors.paper,
          borderColor: MerchantColors.line,
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          shadowColor: "#0e1411",
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 3,
        }}
      >
        <MaterialIcons name={meta.icon} size={20} color={meta.color} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: MerchantColors.ink900,
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            {current.title}
          </Text>
          {current.detail ? (
            <Text
              style={{
                color: MerchantColors.ink500,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {current.detail}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

import { MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import { Colors } from "@/constants/Colors";
import { MerchantColors } from "@/constants/MerchantColors";
import {
  dismissToast,
  useToastStore,
  type ToastKind,
  type ToastScope,
} from "@/stores/toastStore";

const AUTO_DISMISS_MS = 3000;

type Tone = { color: string; icon: keyof typeof MaterialIcons.glyphMap };

// scope × kind 的视觉语义映射。商家端沿用 MerchantColors 的茶青/朱砂/墨灰；
// C 端沿用 Colors 的 primary/error/outline，与 TabBar 等 JS 色值保持一致。
const KIND_META: Record<ToastScope, Record<ToastKind, Tone>> = {
  merchant: {
    success: { color: MerchantColors.statusGo, icon: "check-circle" },
    error: { color: MerchantColors.statusStop, icon: "error-outline" },
    info: { color: MerchantColors.ink500, icon: "info-outline" },
  },
  customer: {
    success: { color: Colors.primary, icon: "check-circle" },
    error: { color: Colors.error, icon: "error-outline" },
    info: { color: Colors.outline, icon: "info-outline" },
  },
};

// 卡片基础色（底/描边/主文案/副文案），按 scope 选择不同的 token。
const SCOPE_CARD: Record<
  ToastScope,
  { bg: string; border: string; fg: string; sub: string }
> = {
  merchant: {
    bg: MerchantColors.paper,
    border: MerchantColors.line,
    fg: MerchantColors.ink900,
    sub: MerchantColors.ink500,
  },
  customer: {
    bg: Colors.surface,
    border: Colors.outlineVariant,
    fg: Colors.onSurface,
    sub: Colors.outline,
  },
};

// 全局顶部 Toast 组件：
// - 挂在根布局（_layout.tsx），所有路由共享同一个单 slot
// - Reanimated FadeInUp / FadeOutUp 预设，零自定义时间线
// - 3 秒自动消失；定时器按 id 捕获，避免新消息替换后误 dismiss
// - 点击整条可手动关闭
export function Toast() {
  const current = useToastStore((s) => s.current);

  useEffect(() => {
    if (!current) return;
    const capturedId = current.id;
    const timer = setTimeout(() => {
      if (useToastStore.getState().current?.id === capturedId) {
        dismissToast();
      }
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [current?.id, current]);

  if (!current) return null;

  const meta = KIND_META[current.scope][current.kind];
  const card = SCOPE_CARD[current.scope];

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
        onPress={dismissToast}
        style={{
          backgroundColor: card.bg,
          borderColor: card.border,
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
          <Text style={{ color: card.fg, fontWeight: "600", fontSize: 14 }}>
            {current.title}
          </Text>
          {current.detail ? (
            <Text style={{ color: card.sub, fontSize: 12, marginTop: 2 }}>
              {current.detail}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

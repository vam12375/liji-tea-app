import { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MerchantColors } from "@/constants/MerchantColors";

interface Props {
  children: ReactNode;
}

// 详情页底部 sticky 操作条：
// - 绝对定位 + SafeArea inset，兼容带底部指示器的设备
// - 纸白底 + 顶部米线，与页面内容形成层级
// - 按钮由调用方决定布局（通常 row flex:1 gap:12）
export function MerchantStickyActions({ children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 12 + insets.bottom,
        backgroundColor: MerchantColors.paper,
        borderTopColor: MerchantColors.line,
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}

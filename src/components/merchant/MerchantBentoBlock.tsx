import { ReactNode } from "react";
import { Text, View, ViewStyle } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";

interface Props {
  title?: string;
  /** 右上角小标（如"2 件 · ¥398"）。 */
  summary?: string;
  children: ReactNode;
  style?: ViewStyle;
}

// 详情页 Bento 块容器：纸白底 + 1px 米线 + 可选标题/汇总。
// 每块职责单一，内容由 children 决定；容器不承担业务逻辑。
export function MerchantBentoBlock({ title, summary, children, style }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: MerchantColors.paper,
          borderColor: MerchantColors.line,
          borderWidth: 1,
          borderRadius: 20,
          padding: 16,
          gap: 12,
        },
        style,
      ]}
    >
      {title || summary ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          {title ? (
            <Text
              style={{
                color: MerchantColors.ink900,
                fontFamily: "Manrope_700Bold",
                fontSize: 14,
                letterSpacing: 0.4,
              }}
            >
              {title}
            </Text>
          ) : (
            <View />
          )}
          {summary ? (
            <Text style={{ color: MerchantColors.ink500, fontSize: 11 }}>
              {summary}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

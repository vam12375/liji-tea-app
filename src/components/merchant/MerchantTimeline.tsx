import { Text, View } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";

export interface TimelineStep {
  /** 形如 "11:32" 或 "04-17 11:32"；为空展示 "--"。 */
  time: string | null;
  label: string;
  /** 已完成实心茶青点 + 深字；未到空心米线点 + 灰字。 */
  done: boolean;
}

interface Props {
  steps: TimelineStep[];
}

// 详情页状态时间线（下单 → 已支付 → 发货 → 送达）。
export function MerchantTimeline({ steps }: Props) {
  return (
    <View style={{ gap: 12 }}>
      {steps.map((step, i) => (
        <View
          key={`${step.label}-${i}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: step.done
                ? MerchantColors.statusGo
                : "transparent",
              borderWidth: 1,
              borderColor: step.done
                ? MerchantColors.statusGo
                : MerchantColors.line,
            }}
          />
          <Text
            style={{
              color: step.done ? MerchantColors.ink900 : MerchantColors.ink500,
              fontSize: 13,
              fontVariant: ["tabular-nums"],
              width: 96,
            }}
          >
            {step.time ?? "--"}
          </Text>
          <Text
            style={{
              color: step.done ? MerchantColors.ink900 : MerchantColors.ink500,
              fontSize: 13,
            }}
          >
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

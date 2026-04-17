import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";
import {
  COUNT_UP_DURATION_MS,
  COUNT_UP_FRAME_MS,
  interpolateCount,
} from "@/lib/merchantHeroStats";

// 单元格 hook：value 变化时触发 count-up；无变化时直接返回当前值。
function useCountUp(value: number) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const from = display;
    const to = value;
    if (from === to) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = (Date.now() - start) / COUNT_UP_DURATION_MS;
      setDisplay(interpolateCount(from, to, progress));
      if (progress >= 1) clearInterval(timer);
    }, COUNT_UP_FRAME_MS);
    return () => clearInterval(timer);
    // 仅依赖目标值，避免 display 变化引起循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

export interface HeroStatItem {
  value: number;
  label: string;
  /** 可点：低库存等支持直达筛选的场景。 */
  onPress?: () => void;
  /** 可选：强调色（如"待发货"用 statusWait）。 */
  accent?: string;
}

interface Props {
  items: HeroStatItem[];
}

// N 列等宽 Hero 数字横排。2~4 自适应；超过 4 个请拆分到下一行。
export function MerchantHeroStats({ items }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 24,
      }}
    >
      {items.map((item, index) => (
        <HeroCell key={`${item.label}-${index}`} item={item} />
      ))}
    </View>
  );
}

function HeroCell({ item }: { item: HeroStatItem }) {
  const display = useCountUp(item.value);
  const content = (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: item.accent ?? MerchantColors.ink900,
          fontFamily: "NotoSerifSC_700Bold",
          fontSize: 32,
          lineHeight: 36,
          fontVariant: ["tabular-nums"],
        }}
      >
        {display}
      </Text>
      <Text
        style={{
          color: MerchantColors.ink500,
          fontSize: 11,
          letterSpacing: 0.8,
          marginTop: 4,
        }}
      >
        {item.label}
      </Text>
    </View>
  );
  return item.onPress ? (
    <Pressable onPress={item.onPress} style={{ flex: 1 }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";
import type {
  MerchantOrderFilter,
  MerchantOrderScope,
} from "@/lib/merchantFilters";

// 订单列表筛选栏：chips 选状态 + 独立一行关键字搜索。
// Chips 激活用品牌主色填充；未激活改米线描边 + 透明底，降低视觉干扰。

const SCOPES: { value: MerchantOrderScope; label: string }[] = [
  { value: "pending_ship", label: "待发货" },
  { value: "shipping", label: "已发货" },
  { value: "delivered", label: "已完成" },
  { value: "cancelled", label: "已取消" },
  { value: "all", label: "全部" },
];

interface Props {
  filter: MerchantOrderFilter;
  onChange: (patch: Partial<MerchantOrderFilter>) => void;
}

export function MerchantOrderFilterBar({ filter, onChange }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 10,
        borderBottomColor: MerchantColors.line,
        borderBottomWidth: 1,
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {SCOPES.map((s) => {
          const active = filter.status === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => onChange({ status: s.value })}
              style={{
                height: 28,
                paddingHorizontal: 14,
                borderRadius: 999,
                justifyContent: "center",
                marginRight: 8,
                backgroundColor: active ? "#435c3c" : "transparent",
                borderWidth: 1,
                borderColor: active ? "#435c3c" : MerchantColors.line,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: active ? "600" : "500",
                  color: active ? "#fff" : MerchantColors.ink500,
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <TextInput
        value={filter.keyword}
        onChangeText={(v) => onChange({ keyword: v })}
        placeholder="搜索订单号 / 收件人手机"
        placeholderTextColor={MerchantColors.ink500}
        style={{
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: MerchantColors.line,
          fontSize: 13,
          color: MerchantColors.ink900,
        }}
      />
    </View>
  );
}

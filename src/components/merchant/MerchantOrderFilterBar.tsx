import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import type {
  MerchantOrderFilter,
  MerchantOrderScope,
} from "@/lib/merchantFilters";

// 订单列表顶部筛选栏：chips 选状态 + 关键字模糊搜索（订单号 / 手机）。

const SCOPES: { value: MerchantOrderScope; label: string }[] = [
  { value: "pending_ship", label: "待发货" },
  { value: "shipping",     label: "已发货" },
  { value: "delivered",    label: "已完成" },
  { value: "cancelled",    label: "已取消" },
  { value: "all",          label: "全部" },
];

interface Props {
  filter: MerchantOrderFilter;
  onChange: (patch: Partial<MerchantOrderFilter>) => void;
}

export function MerchantOrderFilterBar({ filter, onChange }: Props) {
  return (
    <View className="px-4 py-3 gap-2 border-b border-outline-variant bg-background">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {SCOPES.map((s) => {
          const active = filter.status === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => onChange({ status: s.value })}
              className={`px-3 py-1.5 rounded-full mr-2 ${
                active ? "bg-primary" : "bg-surface-variant"
              }`}
            >
              <Text
                className={`text-xs ${
                  active ? "text-on-primary" : "text-on-surface"
                }`}
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
        className="px-3 py-2 rounded-lg bg-surface-variant text-sm text-on-surface"
      />
    </View>
  );
}

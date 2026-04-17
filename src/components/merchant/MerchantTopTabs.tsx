import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";

// 商家端顶部三段式 Tab：订单 / 售后 / 商品。
// 放在各列表页顶部，避免为了三个 Tab 再嵌套一层 Tabs 导航器。
type MerchantTab = "orders" | "after-sale" | "products" | "staff";

interface Props {
  active: MerchantTab;
  showStaff?: boolean; // 仅 admin 可见
}

const TABS: { value: MerchantTab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: "orders",     label: "订单", icon: "receipt-long" },
  { value: "after-sale", label: "售后", icon: "assignment-return" },
  { value: "products",   label: "商品", icon: "inventory-2" },
  { value: "staff",      label: "员工", icon: "badge" },
];

export function MerchantTopTabs({ active, showStaff = false }: Props) {
  const visible = TABS.filter((tab) => tab.value !== "staff" || showStaff);
  return (
    <View className="flex-row border-b border-outline-variant bg-background">
      {visible.map((tab) => {
        const isActive = tab.value === active;
        const color = isActive ? Colors.primary : Colors.outline;
        return (
          <Pressable
            key={tab.value}
            onPress={() => {
              if (isActive) return;
              // staff 页放在 /merchant/staff，其它在 /merchant/<tab>/
              const href = tab.value === "staff" ? "/merchant/staff" : `/merchant/${tab.value}`;
              router.replace(href as never);
            }}
            className="flex-1 items-center justify-center py-3 gap-1"
          >
            <MaterialIcons name={tab.icon} size={20} color={color} />
            <Text
              style={{ color, fontWeight: isActive ? "600" : "400" }}
              className="text-xs"
            >
              {tab.label}
            </Text>
            {isActive ? (
              <View
                style={{ backgroundColor: Colors.primary }}
                className="absolute bottom-0 h-0.5 w-10 rounded-full"
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

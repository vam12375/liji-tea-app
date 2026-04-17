import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { MerchantColors } from "@/constants/MerchantColors";

// 商家端顶部 Tab：订单 / 售后 / 商品 / 员工（admin）。
// pill 高度 28pt；激活主色填充，未激活米线描边 + 透明底。
type MerchantTab = "orders" | "after-sale" | "products" | "staff";

interface Props {
  active: MerchantTab;
  showStaff?: boolean;
}

const TABS: {
  value: MerchantTab;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { value: "orders", label: "订单", icon: "receipt-long" },
  { value: "after-sale", label: "售后", icon: "assignment-return" },
  { value: "products", label: "商品", icon: "inventory-2" },
  { value: "staff", label: "员工", icon: "badge" },
];

export function MerchantTopTabs({ active, showStaff = false }: Props) {
  const visible = TABS.filter((tab) => tab.value !== "staff" || showStaff);
  return (
    <View
      style={{
        flexDirection: "row",
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        borderBottomColor: MerchantColors.line,
        borderBottomWidth: 1,
        backgroundColor: MerchantColors.paper,
      }}
    >
      {visible.map((tab) => {
        const isActive = tab.value === active;
        const color = isActive ? "#fff" : MerchantColors.ink500;
        return (
          <Pressable
            key={tab.value}
            onPress={() => {
              if (isActive) return;
              const href =
                tab.value === "staff"
                  ? "/merchant/staff"
                  : `/merchant/${tab.value}`;
              router.replace(href as never);
            }}
            style={{
              height: 28,
              paddingHorizontal: 12,
              borderRadius: 999,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: isActive ? "#435c3c" : "transparent",
              borderWidth: 1,
              borderColor: isActive ? "#435c3c" : MerchantColors.line,
            }}
          >
            <MaterialIcons name={tab.icon} size={14} color={color} />
            <Text
              style={{
                color,
                fontSize: 13,
                fontWeight: isActive ? "600" : "500",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

// 菜单项类型定义（含可选的 badge 和 highlight 字段）
interface MenuItem {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  badge?: string;
  highlight?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { icon: "location-on", label: "收货地址管理" },
  { icon: "confirmation-number", label: "优惠券", badge: "3张可用" },
  { icon: "receipt-long", label: "我的订单" },
  { icon: "favorite", label: "我的收藏" },
  { icon: "comment", label: "我的评价" },
  { icon: "history-edu", label: "冲泡记录" },
  { icon: "person-add", label: "邀请好友", highlight: true },
  { icon: "settings", label: "设置" },
];

export default function MenuList() {
  return (
    <View className="px-4 gap-0">
      {MENU_ITEMS.map((item) => (
        <Pressable
          key={item.label}
          className={`flex-row items-center py-4 border-b border-outline-variant/10 active:bg-surface-container/50 ${
            item.highlight ? "bg-primary/5" : ""
          }`}
        >
          <MaterialIcons
            name={item.icon}
            size={20}
            color={item.highlight ? Colors.primary : Colors.onSurface}
          />
          <Text
            className={`flex-1 ml-3 text-sm ${
              item.highlight ? "text-primary" : "text-on-surface"
            }`}
          >
            {item.label}
          </Text>
          {item.badge && (
            <View className="bg-tertiary/10 px-2 py-0.5 rounded mr-2">
              <Text className="text-tertiary text-[10px]">{item.badge}</Text>
            </View>
          )}
          <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
        </Pressable>
      ))}
    </View>
  );
}

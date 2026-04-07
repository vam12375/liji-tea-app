import { View, Text, Pressable } from "react-native";
import { useRouter, type Href } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { routes } from "@/lib/routes";
import { showModal, showConfirm } from "@/stores/modalStore";
import { useCouponStore } from "@/stores/couponStore";
import { useUserStore } from "@/stores/userStore";

// 菜单项类型定义（含可选的 badge、highlight 和 route 字段）
interface MenuItem {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  badge?: string;
  highlight?: boolean;
  route?: Href | null;
}

const MENU_ITEMS: MenuItem[] = [
  { icon: "location-on", label: "收货地址管理", route: routes.addresses },
  { icon: "confirmation-number", label: "优惠券", route: routes.coupons },
  { icon: "receipt-long", label: "我的订单", route: routes.orders },
  { icon: "favorite", label: "我的收藏", route: routes.favorites },
  { icon: "article", label: "我的帖子", route: routes.myPosts },
  { icon: "comment", label: "我的评价", route: "/my-reviews" as Href },
  { icon: "history-edu", label: "冲泡记录", route: "/brewing-log" as Href },
  { icon: "person-add", label: "邀请好友", highlight: true, route: null },
  { icon: "settings", label: "设置", route: routes.settings },
];

export default function MenuList() {
  const router = useRouter();
  const signOut = useUserStore((s) => s.signOut);
  const availableCouponCount = useCouponStore(
    (s) => s.userCoupons.filter((item) => item.status === "available").length,
  );

  /** 菜单项点击处理 */
  const handlePress = (item: MenuItem) => {
    if (item.route) {
      router.push(item.route);
    } else {
      showModal("提示", "该功能即将上线");
    }
  };

  /** 退出登录确认 */
  const handleLogout = () => {
    showConfirm("确认退出", "确定要退出登录吗？", async () => {
      await signOut();
      router.replace("/(tabs)");
    }, {
      icon: "logout",
      confirmText: "确认退出",
      confirmStyle: "destructive",
    });
  };

  return (
    <View className="px-4 gap-0">
      {/* 菜单列表 */}
      {MENU_ITEMS.map((item) => {
        const badge =
          item.label === "优惠券" && availableCouponCount > 0
            ? `${availableCouponCount}张可用`
            : item.badge;

        return (
          <Pressable
            key={item.label}
            onPress={() => handlePress(item)}
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
            {badge && (
              <View className="bg-tertiary/10 px-2 py-0.5 rounded mr-2">
                <Text className="text-tertiary text-[10px]">{badge}</Text>
              </View>
            )}
            <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />
          </Pressable>
        );
      })}

      {/* 退出登录按钮 */}
      <Pressable
        onPress={handleLogout}
        className="mt-8 py-3 items-center active:opacity-70"
      >
        <Text className="text-error text-sm font-medium">退出登录</Text>
      </Pressable>
    </View>
  );
}

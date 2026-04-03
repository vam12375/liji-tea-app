import { ScrollView, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useUserStore } from "@/stores/userStore";
import MemberHeader from "@/components/profile/MemberHeader";
import StatsGrid from "@/components/profile/StatsGrid";
import OrderStatusRow from "@/components/profile/OrderStatusRow";
import MenuList from "@/components/profile/MenuList";
import MemberBenefitsCard from "@/components/profile/MemberBenefitsCard";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useUserStore((s) => s.session);

  // 未登录状态
  if (!session) {
    return (
      <View
        className="flex-1 bg-background items-center justify-center gap-6"
        style={{ paddingTop: insets.top }}
      >
        <MaterialIcons name="account-circle" size={80} color={Colors.outlineVariant} />
        <Text className="text-on-surface-variant text-base">登录后查看个人信息</Text>
        <Pressable
          onPress={() => router.push("/login")}
          className="bg-primary-container px-8 py-3 rounded-full"
        >
          <Text className="text-on-primary font-medium">登录 / 注册</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <MemberHeader />
        <StatsGrid />
        <OrderStatusRow />
        <MenuList />
        <MemberBenefitsCard />
      </ScrollView>
    </View>
  );
}

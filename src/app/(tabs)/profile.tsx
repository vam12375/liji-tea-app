import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MemberHeader from "@/components/profile/MemberHeader";
import StatsGrid from "@/components/profile/StatsGrid";
import OrderStatusRow from "@/components/profile/OrderStatusRow";
import MenuList from "@/components/profile/MenuList";
import MemberBenefitsCard from "@/components/profile/MemberBenefitsCard";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

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

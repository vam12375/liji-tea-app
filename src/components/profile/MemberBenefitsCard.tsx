import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useUserStore } from "@/stores/userStore";

/** 各等级权益配置 */
const TIER_BENEFITS: Record<string, { title: string; subtitle: string; benefits: string[] }> = {
  "新叶会员": {
    title: "新叶会员权益",
    subtitle: "New Leaf Benefits",
    benefits: ["免费包邮(满99)", "新品资讯"],
  },
  "翡翠会员": {
    title: "翡翠会员专享",
    subtitle: "Jade Member Benefits",
    benefits: ["免费包邮", "专属折扣", "新品优先"],
  },
  "金叶会员": {
    title: "金叶会员专享",
    subtitle: "Scholar of Tea Benefits",
    benefits: ["免费包邮", "专属折扣", "新品优先", "生日礼茶"],
  },
};

export default function MemberBenefitsCard() {
  // 从 store 读取当前会员等级
  const memberTier = useUserStore((s) => s.memberTier);
  const config = TIER_BENEFITS[memberTier] ?? TIER_BENEFITS["新叶会员"];

  return (
    <View className="mx-4 bg-tertiary-fixed/30 border border-tertiary-fixed-dim/20 rounded-2xl p-5 gap-4">
      {/* 头部 */}
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="font-headline text-tertiary text-lg font-bold">
            {config.title}
          </Text>
          <Text className="text-on-surface-variant text-xs mt-0.5">
            {config.subtitle}
          </Text>
        </View>
        <MaterialIcons name="military-tech" size={28} color={Colors.tertiary} />
      </View>

      {/* 权益列表 */}
      <View className="flex-row flex-wrap gap-y-3 gap-x-6">
        {config.benefits.map((benefit) => (
          <View key={benefit} className="flex-row items-center gap-1.5">
            <MaterialIcons name="verified" size={14} color={Colors.tertiary} />
            <Text className="text-on-surface text-xs">{benefit}</Text>
          </View>
        ))}
      </View>

      {/* 了解更多 */}
      <Pressable className="flex-row items-center gap-1 self-end">
        <Text className="text-tertiary text-xs">了解更多</Text>
        <MaterialIcons name="arrow-right-alt" size={14} color={Colors.tertiary} />
      </Pressable>
    </View>
  );
}

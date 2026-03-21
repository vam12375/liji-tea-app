import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Colors } from "@/constants/Colors";
import { useUserStore } from "@/stores/userStore";

export default function MemberHeader() {
  const { name, memberTier, points } = useUserStore();
  const displayName = name || "王先生";
  const progress = 89;

  return (
    <View className="bg-primary/5 px-6 pt-8 pb-6 gap-4">
      {/* 头像 + 信息 */}
      <View className="flex-row items-center gap-4">
        <View className="relative">
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200" }}
            style={{ width: 80, height: 80, borderRadius: 9999, borderWidth: 2, borderColor: Colors.tertiary }}
            contentFit="cover"
          />
          <View className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-tertiary items-center justify-center">
            <Text className="text-on-tertiary text-[8px]">🍃</Text>
          </View>
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-headline text-xl text-on-surface font-bold">
            {displayName}
          </Text>
          <View className="bg-tertiary self-start px-2.5 py-0.5 rounded-full">
            <Text className="text-on-tertiary text-xs font-bold">
              {memberTier}
            </Text>
          </View>
          <Text className="text-on-surface-variant text-xs mt-1">
            茶叶积分 {points.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* 等级进度条 */}
      <View className="gap-1.5">
        <View className="flex-row justify-between">
          <Text className="text-on-surface-variant text-[10px]">
            距离翡翠会员还需 320 积分
          </Text>
          <Text className="text-tertiary text-[10px] font-bold">{progress}%</Text>
        </View>
        <View className="h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
          <View
            className="h-full bg-tertiary rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>
    </View>
  );
}

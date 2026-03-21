import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

const TIMELINE = [
  { status: "已签收", detail: "已由本人签收，感谢使用顺丰速运", time: "2026-03-20 14:32", active: true },
  { status: "派送中", detail: "快递员张师傅正在派送中 (138****6789)", time: "2026-03-20 09:15" },
  { status: "运输中", detail: "快件到达【上海静安营业部】", time: "2026-03-19 22:40" },
  { status: "已发货", detail: "卖家已发货，顺丰快递揽收", time: "2026-03-18 16:20" },
];

export default function TrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "物流追踪",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1" contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
        {/* 地图区域（模拟） */}
        <View className="mx-4 h-48 rounded-2xl overflow-hidden bg-surface-container-high relative">
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800" }}
            style={{ width: "100%", height: "100%", opacity: 0.4 }}
            contentFit="cover"
          />
          <View className="absolute inset-0 items-center justify-center">
            <MaterialIcons name="local-shipping" size={36} color={Colors.primaryContainer} />
          </View>
          {/* 起点/终点 */}
          <View className="absolute bottom-3 left-4 flex-row items-center gap-1">
            <View className="w-2 h-2 rounded-full bg-primary" />
            <Text className="text-on-surface text-[10px]">福建武夷山</Text>
          </View>
          <View className="absolute bottom-3 right-4 flex-row items-center gap-1">
            <Text className="text-on-surface text-[10px]">上海静安</Text>
            <View className="w-2 h-2 rounded-full bg-tertiary" />
          </View>
        </View>

        {/* 快递信息 */}
        <View className="mx-4 mt-4 bg-surface-container-low rounded-xl p-4 flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-on-surface font-bold text-sm">顺丰速运</Text>
            <Text className="text-outline text-xs">SF1234567890</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable className="px-3 py-1.5 rounded-full border border-outline-variant">
              <Text className="text-on-surface text-xs">复制</Text>
            </Pressable>
            <Pressable className="w-9 h-9 rounded-full bg-primary-container items-center justify-center">
              <MaterialIcons name="phone" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* 物流时间线 */}
        <View className="mx-4 mt-6 gap-0 relative">
          {/* 垂直连接线 */}
          <View className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-surface-variant" />

          {TIMELINE.map((item, index) => (
            <View key={index} className="flex-row gap-4 pb-6">
              {/* 圆点 */}
              <View className="items-center w-6 pt-1">
                {item.active ? (
                  <View className="w-6 h-6 rounded-full bg-primary-container items-center justify-center z-10">
                    <MaterialIcons name="check" size={14} color="#fff" />
                  </View>
                ) : (
                  <View className="w-3 h-3 rounded-full bg-outline-variant z-10" />
                )}
              </View>
              {/* 内容 */}
              <View className="flex-1 gap-1">
                <Text className={`text-sm font-medium ${item.active ? "text-on-surface" : "text-outline"}`}>
                  {item.status}
                </Text>
                <Text className="text-on-surface-variant text-xs">{item.detail}</Text>
                <Text className="text-outline text-[10px] mt-0.5">{item.time}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 包裹概要 */}
        <View className="mx-4 mt-2 bg-surface-container-low rounded-xl p-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="flex-row -space-x-3">
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=100" }}
                style={{ width: 40, height: 40, borderRadius: 9999, borderWidth: 2, borderColor: Colors.surfaceContainerLow }}
                contentFit="cover"
              />
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=100" }}
                style={{ width: 40, height: 40, borderRadius: 9999, borderWidth: 2, borderColor: Colors.surfaceContainerLow }}
                contentFit="cover"
              />
            </View>
            <View className="gap-0.5">
              <Text className="text-on-surface text-sm font-medium">特级龙井 & 熟普洱套装</Text>
              <Text className="text-outline text-xs">共2件商品</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
        </View>
      </ScrollView>
    </View>
  );
}

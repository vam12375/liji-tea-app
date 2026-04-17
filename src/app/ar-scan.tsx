import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

export default function ARScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [identified, setIdentified] = useState(false);

  return (
    <View className="flex-1 bg-on-surface">
      <Stack.Screen options={{ headerShown: false }} />

      {/* 模拟相机背景 */}
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800" }}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.6 }}
        contentFit="cover"
      />

      {/* 顶部导航 */}
      <View style={{ paddingTop: insets.top }} className="absolute top-0 left-0 right-0 z-50 px-4">
        <View className="flex-row justify-between items-center h-14">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center">
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Text className="text-surface-bright font-medium text-base">AR 识茶</Text>
          <Pressable className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center">
            <MaterialIcons name="flash-on" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* 扫描框 */}
      <View className="flex-1 items-center justify-center">
        <View className="w-60 h-60 relative">
          {/* 四个角的金色边框 */}
          <View className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-tertiary-fixed rounded-tl-lg" />
          <View className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-tertiary-fixed rounded-tr-lg" />
          <View className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-tertiary-fixed rounded-bl-lg" />
          <View className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-tertiary-fixed rounded-br-lg" />
        </View>
        <Text className="text-surface-bright/60 text-xs mt-4">将茶叶对准框内</Text>
      </View>

      {/* 底部工具栏 */}
      <View style={{ paddingBottom: insets.bottom || 24 }} className="absolute bottom-0 left-0 right-0 z-50 px-8 pb-4">
        {/* 操作按钮 */}
        <View className="flex-row justify-between items-center mb-6">
          <Pressable className="w-12 h-12 rounded-full bg-surface/20 items-center justify-center">
            <MaterialIcons name="photo-library" size={24} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => setIdentified(true)}
            className="w-20 h-20 rounded-full border-4 border-tertiary-fixed items-center justify-center"
            // 使用数值缩放反馈按压态，避免 NativeWind 把 active:scale-95 转成非法百分比。
            style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            <View className="w-16 h-16 rounded-full bg-surface-bright" />
          </Pressable>
          <Pressable className="w-12 h-12 rounded-full bg-surface/20 items-center justify-center">
            <MaterialIcons name="history" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* 识别结果底部弹出 */}
        {identified && (
          <Pressable
            onPress={() => router.back()}
            className="bg-surface/90 rounded-t-[32px] rounded-b-2xl p-6 gap-3"
          >
            <View className="w-10 h-1 bg-outline-variant/40 rounded-full self-center" />
            <View className="flex-row items-center justify-between">
              <View className="gap-1">
                <Text className="font-headline text-on-surface text-lg font-bold">特级西湖龙井</Text>
                <View className="flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full bg-primary" />
                  <Text className="text-primary text-xs font-medium">匹配度 96%</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Colors.outline} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function CultureBanner() {
  return (
    <Pressable className="w-full h-32 rounded-xl overflow-hidden active:opacity-90">
      {/* 暗色背景 + 水墨画 */}
      <View className="absolute inset-0 bg-[#2C2C2C]">
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800",
          }}
          style={{ width: "100%", height: "100%", opacity: 0.5 }}
          contentFit="cover"
        />
      </View>

      {/* 文字叠层 */}
      <View className="absolute inset-0 flex justify-center px-8">
        <Text className="font-headline text-2xl text-surface-bright tracking-[8px]">
          茶之道
        </Text>
        <Text className="text-surface-bright/80 text-xs mt-1">
          探索千年茶文化
        </Text>
      </View>

      {/* 右侧图标 */}
      <View className="absolute right-6 top-1/2 -translate-y-1/2">
        <MaterialIcons name="auto-stories" size={36} color="rgba(254,249,241,0.4)" />
      </View>
    </Pressable>
  );
}

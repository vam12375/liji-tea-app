import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { TeaImage } from "@/components/ui/TeaImage";

export default function HeroBanner() {
  const router = useRouter();

  return (
    <View className="w-full h-[200px] rounded-xl overflow-hidden">
      <TeaImage
        source={{
          uri: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=800",
        }}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        contentFit="cover"
        transition={300}
      />
      {/* 渐变遮罩 */}
      <View className="absolute inset-0 bg-black/40" />

      {/* 文字内容 */}
      <View className="absolute inset-0 flex justify-center px-8 gap-2">
        <Text className="font-headline text-3xl text-surface-bright tracking-widest">
          一叶知春
        </Text>
        <Text className="text-surface-bright/90 text-sm font-light tracking-wide">
          新春明前龙井 · 限量发售
        </Text>
        <View className="pt-3">
          <Pressable
            onPress={() => router.push("/(tabs)/shop")}
            className="bg-primary-container self-start px-6 py-2.5 rounded-full active:bg-primary"
          >
            <Text className="text-surface-bright text-sm font-medium">
              立即探索
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

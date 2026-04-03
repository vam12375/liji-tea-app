import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";

export default function SeasonalStory() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/community")}
      className="w-full aspect-video rounded-xl overflow-hidden"
    >
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=800",
        }}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        contentFit="cover"
        transition={300}
      />

      <View className="absolute inset-0 bg-black/30 items-center justify-center p-6 gap-3">
        <Text className="font-headline text-2xl text-surface-bright tracking-[4px]">
          春日热聊
        </Text>
        <View className="w-12 h-px bg-surface-bright/50" />
        <Text className="text-surface-bright/90 text-sm italic font-light text-center">
          “看看茶友们最近在喝什么、聊什么、分享什么。”
        </Text>
        <View className="mt-3 border border-surface-bright/50 px-5 py-1.5 rounded-full">
          <Text className="text-surface-bright text-xs">进入社区</Text>
        </View>
      </View>
    </Pressable>
  );
}

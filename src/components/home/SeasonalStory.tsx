import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";

export default function SeasonalStory() {
  return (
    <View className="w-full aspect-video rounded-xl overflow-hidden">
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=800",
        }}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        contentFit="cover"
        transition={300}
      />

      {/* 遮罩 + 内容 */}
      <View className="absolute inset-0 bg-black/30 items-center justify-center p-6 gap-3">
        <Text className="font-headline text-2xl text-surface-bright tracking-[6px]">
          春茶物语
        </Text>
        <View className="w-12 h-px bg-surface-bright/50" />
        <Text className="text-surface-bright/90 text-sm italic font-light text-center">
          "将这一抹春色，收纳在方寸壶中。"
        </Text>
        <Pressable className="mt-3 border border-surface-bright/50 px-5 py-1.5 rounded-full active:bg-surface-bright/20">
          <Text className="text-surface-bright text-xs">阅读全文</Text>
        </Pressable>
      </View>
    </View>
  );
}

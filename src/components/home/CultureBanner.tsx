import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function CultureBanner() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/community" as any)}
      className="w-full h-32 rounded-xl overflow-hidden active:opacity-90"
    >
      <View className="absolute inset-0 bg-[#2C2C2C]">
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800",
          }}
          style={{ width: "100%", height: "100%", opacity: 0.5 }}
          contentFit="cover"
        />
      </View>

      <View className="absolute inset-0 flex justify-center px-8">
        <Text className="font-headline text-2xl text-surface-bright tracking-[6px]">
          茶圈社区
        </Text>
        <Text className="text-surface-bright/80 text-xs mt-1">
          茶道灵感 × 茶友分享 × 热门问答
        </Text>
      </View>

      <View className="absolute right-6 top-1/2 -translate-y-1/2">
        <MaterialIcons name="forum" size={36} color="rgba(254,249,241,0.4)" />
      </View>
    </Pressable>
  );
}

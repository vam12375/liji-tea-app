import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { Article } from "@/data/articles";

export default function ArticleCard({ article, large = false }: { article: Article; large?: boolean }) {
  return (
    <Pressable className={`${large ? "" : "flex-1"} active:opacity-80`} onPress={() => router.push(`/article/${article.id}` as any)}>
      <View className={`${large ? "aspect-video" : "aspect-square"} rounded-xl overflow-hidden mb-2`}>
        <Image source={{ uri: article.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
      </View>
      <Text className={`font-headline text-on-surface ${large ? "text-xl" : "text-sm"} font-bold`} numberOfLines={2}>
        {article.title}
      </Text>
      {article.subtitle && (
        <Text className="text-on-surface-variant text-xs mt-1" numberOfLines={2}>{article.subtitle}</Text>
      )}
      {large && (
        <View className="flex-row items-center gap-1 mt-2">
          <MaterialIcons name="schedule" size={12} color={Colors.outline} />
          <Text className="text-outline text-xs">{article.readTime}阅读</Text>
        </View>
      )}
    </Pressable>
  );
}

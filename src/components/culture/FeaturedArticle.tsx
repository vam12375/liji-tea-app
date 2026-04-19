import { View, Text, Pressable } from "react-native";
import { TeaImage } from "@/components/ui/TeaImage";
import { router } from "expo-router";
import type { Article } from "@/data/articles";

export default function FeaturedArticle({ article }: { article: Article }) {
  return (
    <Pressable className="h-[220px] rounded-2xl overflow-hidden active:opacity-90" onPress={() => router.push({ pathname: "/article/[id]", params: { id: article.id } })}>
      <TeaImage source={{ uri: article.image }} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} contentFit="cover" />
      <View className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <View className="absolute top-4 left-4">
        <View className="bg-tertiary px-2.5 py-0.5 rounded-full">
          <Text className="text-on-tertiary text-[10px] font-bold">{article.category}</Text>
        </View>
      </View>
      <View className="absolute bottom-6 left-6 right-6 gap-1">
        <Text className="font-headline text-xl text-surface-bright font-bold">{article.title}</Text>
        <Text className="text-surface-bright/60 text-xs">{article.date}</Text>
      </View>
    </Pressable>
  );
}

import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { articles, type CultureCategory } from "@/data/articles";
import FeaturedArticle from "@/components/culture/FeaturedArticle";
import CategoryTabs from "@/components/culture/CategoryTabs";
import ArticleCard from "@/components/culture/ArticleCard";
import BrewingShortcut from "@/components/culture/BrewingShortcut";
import SeasonalPicks from "@/components/culture/SeasonalPicks";

export default function CultureScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<CultureCategory>("全部");

  const filtered = useMemo(
    () => category === "全部" ? articles : articles.filter((a) => a.category === category),
    [category]
  );

  return (
    <View className="flex-1 bg-background">
      {/* 顶部标题栏 */}
      <View style={{ paddingTop: insets.top }} className="px-6 pb-3 bg-background/70">
        <View className="flex-row justify-between items-center h-14">
          <Text className="font-headline text-2xl text-on-surface font-bold">茶道</Text>
          <View className="flex-row gap-4">
            <Pressable hitSlop={8}>
              <MaterialIcons name="bookmark-border" size={24} color={Colors.onSurface} />
            </Pressable>
            <Pressable hitSlop={8}>
              <MaterialIcons name="search" size={24} color={Colors.onSurface} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8 gap-8" showsVerticalScrollIndicator={false}>
        {filtered.length > 0 && <FeaturedArticle article={filtered[0]} />}
        <CategoryTabs selected={category} onSelect={setCategory} />
        {filtered.length > 1 && <ArticleCard article={filtered[1]} large />}
        <BrewingShortcut />
        {filtered.length > 2 && (
          <View className="flex-row gap-4">
            {filtered.slice(2, 4).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </View>
        )}
        <SeasonalPicks />
      </ScrollView>
    </View>
  );
}

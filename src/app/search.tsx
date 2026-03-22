import { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { hotSearches } from "@/data/search";
import { useProductStore, type Product } from "@/stores/productStore";
import SearchHistoryChips from "@/components/search/SearchHistoryChips";
import HotSearches from "@/components/search/HotSearches";

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState(["龙井", "白毫银针", "冲泡方法", "送礼推荐"]);
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 从 store 获取产品作为"猜你喜欢"
  const products = useProductStore((s) => s.products);
  const searchProducts = useProductStore((s) => s.searchProducts);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setHasSearched(false);
      setResults([]);
      return;
    }
    setSearching(true);
    setHasSearched(true);
    const found = await searchProducts(text.trim());
    setResults(found);
    setSearching(false);

    // 添加到历史（去重，最多 8 个）
    setHistory((prev) => {
      const next = [text.trim(), ...prev.filter((h) => h !== text.trim())];
      return next.slice(0, 8);
    });
  }, [searchProducts]);

  // 展示数据：搜索结果 或 猜你喜欢
  const displayData = hasSearched ? results : products.slice(0, 4);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 搜索栏 */}
      <View className="px-4 pt-2 pb-3 flex-row items-center gap-3">
        <View className="flex-1 flex-row items-center bg-surface-container-high rounded-full px-4 h-11 gap-2">
          <MaterialIcons name="search" size={20} color={Colors.outline} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索茶品、茶器、冲泡方法..."
            placeholderTextColor={Colors.outline}
            className="flex-1 text-on-surface text-sm"
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => handleSearch(query)}
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => { setQuery(''); setHasSearched(false); setResults([]); }}>
              <MaterialIcons name="close" size={18} color={Colors.outline} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()}>
          <Text className="text-primary text-sm">取消</Text>
        </Pressable>
      </View>

      {/* 内容 */}
      <FlatList
        data={displayData}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperClassName="gap-3 px-4"
        contentContainerClassName="px-4 gap-8 pb-8"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-8">
            {!hasSearched && (
              <>
                <SearchHistoryChips items={history} onClear={() => setHistory([])} onSelect={handleSearch} />
                <HotSearches items={hotSearches} onSelect={handleSearch} />
              </>
            )}
            <Text className="text-on-surface font-medium text-sm">
              {hasSearched ? `搜索结果 (${results.length})` : '猜你喜欢'}
            </Text>
            {searching && <ActivityIndicator color={Colors.primaryContainer} />}
          </View>
        }
        ListEmptyComponent={
          hasSearched && !searching ? (
            <View className="items-center py-12">
              <Text className="text-outline">未找到相关茶品</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            className="flex-1 active:opacity-80"
            onPress={() => router.push(`/product/${item.id}` as any)}
          >
            <View className="aspect-[4/5] rounded-xl overflow-hidden mb-2">
              <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
            </View>
            <Text className="font-headline text-on-surface text-sm font-bold" numberOfLines={1}>{item.name}</Text>
            <Text className="text-on-surface-variant text-xs">{item.origin}</Text>
            <Text className="text-tertiary font-bold mt-1">¥{item.price}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

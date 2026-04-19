import { useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TeaImage } from "@/components/ui/TeaImage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/Colors";
import { TEA_CATEGORIES, type TeaCategory } from "@/data/products";
import { track } from "@/lib/analytics";
import { goBackOrReplace } from "@/lib/navigation";
import {
  FALLBACK_HOT_KEYWORDS,
  fetchTopSearchKeywords,
  recordSearchKeyword,
} from "@/lib/searchKeywords";
import { useProductStore, type Product } from "@/stores/productStore";
import SearchFilters from "@/components/search/SearchFilters";
import SearchHistoryChips from "@/components/search/SearchHistoryChips";
import HotSearches from "@/components/search/HotSearches";
import {
  useSearchResults,
  type SearchPriceBand,
  type SearchSortMode,
} from "@/hooks/useSearchResults";

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  // 筛选与排序状态全部放在页面内 useState，避免污染 store。
  const [category, setCategory] = useState<TeaCategory>(TEA_CATEGORIES[0]);
  const [priceBand, setPriceBand] = useState<SearchPriceBand>("all");
  const [sortMode, setSortMode] = useState<SearchSortMode>("relevance");
  // 热词列表走后端 RPC，初始值用静态兜底，保证首屏即可渲染。
  const [hotKeywords, setHotKeywords] = useState<string[]>([
    ...FALLBACK_HOT_KEYWORDS,
  ]);

  // 从本地存储加载搜索历史
  useEffect(() => {
    AsyncStorage.getItem('search-history').then((raw) => {
      if (raw) {
        try { setHistory(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  // 进入搜索页时异步刷新一次热词，失败直接沿用静态兜底。
  useEffect(() => {
    let cancelled = false;
    fetchTopSearchKeywords(8).then((list) => {
      if (!cancelled) {
        setHotKeywords(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 保存搜索历史到本地存储
  const saveHistory = useCallback((next: string[]) => {
    setHistory(next);
    AsyncStorage.setItem('search-history', JSON.stringify(next)).catch(() => {});
  }, []);

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

    // 搜索提交埋点：关键词长度（防误打标签）+ 命中数，便于分析"搜不到"场景。
    track("search_submit", {
      keywordLength: text.trim().length,
      resultCount: found.length,
    });

    // 添加到历史（去重，最多 8 个）
    saveHistory([text.trim(), ...history.filter((h) => h !== text.trim())].slice(0, 8));
    // 命中任意结果才写入热词，避免"搜了个空"也被记录。
    if (found.length > 0) {
      recordSearchKeyword(text.trim());
    }
  }, [searchProducts, saveHistory, history]);

  // 展示数据：搜索结果 或 猜你喜欢。搜索结果走 useSearchResults 做本地筛选 / 排序。
  const filteredResults = useSearchResults({
    baseResults: results,
    category,
    priceBand,
    sortMode,
  });
  const displayData = hasSearched ? filteredResults : products.slice(0, 4);

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
        <Pressable onPress={() => goBackOrReplace(router)}>
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
                <SearchHistoryChips items={history} onClear={() => saveHistory([])} onSelect={handleSearch} />
                <HotSearches items={hotKeywords} onSelect={handleSearch} />
              </>
            )}
            {hasSearched && (
              <SearchFilters
                category={category}
                priceBand={priceBand}
                sortMode={sortMode}
                onCategoryChange={setCategory}
                onPriceBandChange={setPriceBand}
                onSortModeChange={setSortMode}
              />
            )}
            <Text className="text-on-surface font-medium text-sm">
              {hasSearched ? `搜索结果 (${filteredResults.length})` : '猜你喜欢'}
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
            onPress={() =>
              router.push({ pathname: "/product/[id]", params: { id: item.id } })
            }
          >
            <View className="aspect-[4/5] rounded-xl overflow-hidden mb-2">
              <TeaImage source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
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

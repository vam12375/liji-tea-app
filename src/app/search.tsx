import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import PostCard from "@/components/community/PostCard";
import ArticleCard from "@/components/culture/ArticleCard";
import HotSearches from "@/components/search/HotSearches";
import SearchHistoryChips from "@/components/search/SearchHistoryChips";
import { TeaImage } from "@/components/ui/TeaImage";
import { Colors } from "@/constants/Colors";
import { track } from "@/lib/analytics";
import {
  searchArticles,
  searchCommunityPosts,
} from "@/lib/communityDiscovery";
import { goBackOrReplace } from "@/lib/navigation";
import { routes } from "@/lib/routes";
import {
  FALLBACK_HOT_KEYWORDS,
  fetchTopSearchKeywords,
  recordSearchKeyword,
} from "@/lib/searchKeywords";
import { useArticleStore, type Article } from "@/stores/articleStore";
import { useCommunityStore, type Post } from "@/stores/communityStore";
import { useProductStore, type Product } from "@/stores/productStore";

const STORAGE_KEY = "search-history";
const SEARCH_TABS = [
  { key: "all", label: "全部" },
  { key: "product", label: "商品" },
  { key: "content", label: "内容" },
  { key: "question", label: "问答" },
  { key: "brewing", label: "冲泡" },
] as const;

type SearchTabKey = (typeof SEARCH_TABS)[number]["key"];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<SearchTabKey>("all");
  const [hotKeywords, setHotKeywords] = useState<string[]>([
    ...FALLBACK_HOT_KEYWORDS,
  ]);

  const products = useProductStore((state) => state.products);
  const fetchProducts = useProductStore((state) => state.fetchProducts);
  const searchProducts = useProductStore((state) => state.searchProducts);
  const posts = useCommunityStore((state) => state.posts);
  const fetchPosts = useCommunityStore((state) => state.fetchPosts);
  const articles = useArticleStore((state) => state.articles);
  const fetchArticles = useArticleStore((state) => state.fetchArticles);

  // 搜索历史继续放本地缓存，不把这类短期 UI 数据塞回全局 store。
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) {
        return;
      }

      try {
        setHistory(JSON.parse(raw));
      } catch {
        setHistory([]);
      }
    });
  }, []);

  // 热搜词优先拉后端统计，失败时自动回退到静态兜底。
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

  // 统一搜索页需要商品、社区和文章三个数据源，首期先走现有 store 预取。
  useEffect(() => {
    if (products.length === 0) {
      void fetchProducts();
    }
    if (posts.length === 0) {
      void fetchPosts();
    }
    if (articles.length === 0) {
      void fetchArticles();
    }
  }, [
    articles.length,
    fetchArticles,
    fetchPosts,
    fetchProducts,
    posts.length,
    products.length,
  ]);

  const saveHistory = useCallback((next: string[]) => {
    setHistory(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const communityResults = useMemo(
    () => (submittedQuery ? searchCommunityPosts(posts, submittedQuery) : []),
    [posts, submittedQuery],
  );
  const articleResults = useMemo(
    () => (submittedQuery ? searchArticles(articles, submittedQuery) : []),
    [articles, submittedQuery],
  );
  const photoResults = useMemo(
    () => communityResults.filter((post) => post.type === "photo"),
    [communityResults],
  );
  const questionResults = useMemo(
    () => communityResults.filter((post) => post.type === "question"),
    [communityResults],
  );
  const brewingResults = useMemo(
    () => communityResults.filter((post) => post.type === "brewing"),
    [communityResults],
  );

  const handleSearch = useCallback(
    async (text: string) => {
      const nextQuery = text.trim();
      setQuery(nextQuery);

      if (!nextQuery) {
        setSubmittedQuery("");
        setProductResults([]);
        setActiveTab("all");
        return;
      }

      setSearching(true);
      setSubmittedQuery(nextQuery);
      setActiveTab("all");

      const foundProducts = await searchProducts(nextQuery);
      const foundPosts = searchCommunityPosts(posts, nextQuery);
      const foundArticles = searchArticles(articles, nextQuery);

      setProductResults(foundProducts);
      setSearching(false);

      track("search_submit", {
        keywordLength: nextQuery.length,
        resultCount:
          foundProducts.length + foundPosts.length + foundArticles.length,
      });

      saveHistory(
        [nextQuery, ...history.filter((item) => item !== nextQuery)].slice(0, 8),
      );

      if (foundProducts.length + foundPosts.length + foundArticles.length > 0) {
        recordSearchKeyword(nextQuery);
      }
    },
    [articles, history, posts, saveHistory, searchProducts],
  );

  const hasSearched = submittedQuery.length > 0;
  const hasAnyResult =
    productResults.length > 0 ||
    photoResults.length > 0 ||
    questionResults.length > 0 ||
    brewingResults.length > 0 ||
    articleResults.length > 0;

  const suggestedProducts = useMemo(() => products.slice(0, 4), [products]);
  const suggestedPosts = useMemo(() => posts.slice(0, 3), [posts]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-4 pt-2 pb-3 flex-row items-center gap-3">
        <View className="flex-1 flex-row items-center bg-surface-container-high rounded-full px-4 h-11 gap-2">
          <MaterialIcons name="search" size={20} color={Colors.outline} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索茶品、内容、问答、冲泡记录..."
            placeholderTextColor={Colors.outline}
            className="flex-1 text-on-surface text-sm"
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => void handleSearch(query)}
          />
          {query.length > 0 ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                setQuery("");
                setSubmittedQuery("");
                setProductResults([]);
              }}
            >
              <MaterialIcons name="close" size={18} color={Colors.outline} />
            </Pressable>
          ) : null}
        </View>

        <Pressable onPress={() => goBackOrReplace(router)}>
          <Text className="text-primary text-sm">取消</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 gap-8"
        showsVerticalScrollIndicator={false}
      >
        {!hasSearched ? (
          <>
            <SearchHistoryChips
              items={history}
              onClear={() => saveHistory([])}
              onSelect={(term) => void handleSearch(term)}
            />
            <HotSearches
              items={hotKeywords}
              onSelect={(term) => void handleSearch(term)}
            />

            <View className="gap-4">
              <SectionHeader title="推荐商品" />
              <View className="flex-row flex-wrap gap-3">
                {suggestedProducts.map((product) => (
                  <ProductResultCard key={product.id} product={product} />
                ))}
              </View>
            </View>

            <View className="gap-4">
              <SectionHeader title="社区正在聊" />
              {suggestedPosts.length > 0 ? (
                suggestedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))
              ) : (
                <EmptyState text="社区内容正在准备中，先看看推荐商品。" />
              )}
            </View>
          </>
        ) : (
          <>
            <ResultTabs activeTab={activeTab} onChange={setActiveTab} />

            {searching ? (
              <EmptyState text="正在整理搜索结果..." />
            ) : null}

            {!searching && !hasAnyResult ? (
              <EmptyState text="没有找到匹配的结果，试试换一个茶名或问题描述。" />
            ) : null}

            {!searching && hasAnyResult ? (
              <SearchResultContent
                activeTab={activeTab}
                productResults={productResults}
                photoResults={photoResults}
                questionResults={questionResults}
                brewingResults={brewingResults}
                articleResults={articleResults}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SearchResultContent({
  activeTab,
  productResults,
  photoResults,
  questionResults,
  brewingResults,
  articleResults,
}: {
  activeTab: SearchTabKey;
  productResults: Product[];
  photoResults: Post[];
  questionResults: Post[];
  brewingResults: Post[];
  articleResults: Article[];
}) {
  const router = useRouter();

  return (
    <View className="gap-6">
      {(activeTab === "all" || activeTab === "product") &&
      productResults.length > 0 ? (
        <View className="gap-4">
          <SectionHeader title={`商品 (${productResults.length})`} />
          <View className="flex-row flex-wrap gap-3">
            {productResults.map((product) => (
              <ProductResultCard key={product.id} product={product} />
            ))}
          </View>
        </View>
      ) : null}

      {(activeTab === "all" || activeTab === "content") &&
      photoResults.length > 0 ? (
        <View className="gap-4">
          <SectionHeader title={`内容 (${photoResults.length})`} />
          {photoResults.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </View>
      ) : null}

      {(activeTab === "all" || activeTab === "content") &&
      articleResults.length > 0 ? (
        <View className="gap-4">
          <SectionHeader title={`茶知识 (${articleResults.length})`} />
          {articleResults.map((article) => (
            <Pressable
              key={article.id}
              onPress={() => router.push(routes.article(article.id))}
              className="active:opacity-85"
            >
              <ArticleCard article={article} large />
            </Pressable>
          ))}
        </View>
      ) : null}

      {(activeTab === "all" || activeTab === "question") &&
      questionResults.length > 0 ? (
        <View className="gap-4">
          <SectionHeader title={`问答 (${questionResults.length})`} />
          {questionResults.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </View>
      ) : null}

      {(activeTab === "all" || activeTab === "brewing") &&
      brewingResults.length > 0 ? (
        <View className="gap-4">
          <SectionHeader title={`冲泡 (${brewingResults.length})`} />
          {brewingResults.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ResultTabs({
  activeTab,
  onChange,
}: {
  activeTab: SearchTabKey;
  onChange: (tab: SearchTabKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3"
    >
      {SEARCH_TABS.map((tab) => {
        const active = tab.key === activeTab;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            className={`px-4 py-2 rounded-full border ${
              active
                ? "bg-primary border-primary"
                : "bg-surface-container-low border-outline-variant/10"
            }`}
          >
            <Text
              className={`text-sm ${
                active ? "text-white font-medium" : "text-on-surface"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ProductResultCard({ product }: { product: Product }) {
  const router = useRouter();

  return (
    <Pressable
      className="w-[48%] active:opacity-80"
      onPress={() => router.push(routes.product(product.id))}
    >
      <View className="aspect-[4/5] rounded-xl overflow-hidden mb-2">
        <TeaImage
          source={{ uri: product.image }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={200}
        />
      </View>
      <Text
        className="font-headline text-on-surface text-sm font-bold"
        numberOfLines={2}
      >
        {product.name}
      </Text>
      <Text className="text-on-surface-variant text-xs" numberOfLines={1}>
        {product.origin}
      </Text>
      <Text className="text-primary font-bold mt-1">¥{product.price}</Text>
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text className="text-on-surface text-sm font-bold">{title}</Text>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="rounded-3xl bg-surface-container-low px-5 py-6 items-center gap-2 border border-outline-variant/10">
      <MaterialIcons name="search-off" size={24} color={Colors.outline} />
      <Text className="text-on-surface-variant text-sm text-center">{text}</Text>
    </View>
  );
}

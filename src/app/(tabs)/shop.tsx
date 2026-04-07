import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import SearchBar from "@/components/shop/SearchBar";
import FilterChips from "@/components/shop/FilterChips";
import ShopProductCard from "@/components/shop/ShopProductCard";
import { type TeaCategory } from "@/data/products";
import { useProductStore } from "@/stores/productStore";
import { useCartStore } from "@/stores/cartStore";

/** 排序选项类型 */
type SortKey = "recommend" | "price-asc" | "price-desc" | "newest";

/** 排序选项配置 */
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recommend", label: "推荐" },
  { key: "price-asc", label: "价格从低到高" },
  { key: "price-desc", label: "价格从高到低" },
  { key: "newest", label: "最新上架" },
];

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // 从首页分类导航传入的初始分类参数
  const { category: initialCategory } = useLocalSearchParams<{
    category?: string;
  }>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TeaCategory>(
    (initialCategory as TeaCategory) || "全部"
  );

  // 排序状态
  const [sort, setSort] = useState<SortKey>("recommend");
  const [showSortModal, setShowSortModal] = useState(false);

  // 下拉刷新状态
  const [refreshing, setRefreshing] = useState(false);

  const { products: allProducts, loading, fetchProducts, loadMoreProducts, hasMore } = useProductStore();
  // 直接订阅 items 确保购物车数量响应式更新
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  // 当前排序的显示名称
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "推荐";

  // 筛选 + 排序产品
  const filteredProducts = useMemo(() => {
    let result = allProducts;
    // 分类筛选
    if (category !== "全部") {
      result = result.filter((p) => p.category === category);
    }
    // 搜索筛选
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.origin.toLowerCase().includes(q)
      );
    }
    // 排序
    switch (sort) {
      case "price-asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "newest":
        // isNew 优先，再按原始顺序（即数据库 created_at 排序）
        result = [...result].sort((a, b) => {
          if (a.isNew && !b.isNew) return -1;
          if (!a.isNew && b.isNew) return 1;
          return 0;
        });
        break;
      default:
        // recommend: 保持默认顺序
        break;
    }
    return result;
  }, [allProducts, category, search, sort]);

  // 下拉刷新回调
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);

  // Loading 状态：首次加载中且无产品数据
  if (loading && allProducts.length === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text className="text-on-surface-variant mt-3">正在加载茶品...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* 顶部导航 */}
      <View
        style={{ paddingTop: insets.top }}
        className="px-4 pb-3 bg-background"
      >
        <View className="flex-row justify-between items-center h-14">
          {/* 品牌标题 */}
          <Text className="font-headline text-2xl tracking-widest font-bold text-primary">
            李记茶·商城
          </Text>

          {/* 右侧图标组 */}
          <View className="flex-row items-center gap-4">
            {/* 搜索图标 — 跳转搜索页 */}
            <Pressable hitSlop={8} onPress={() => router.push("/search")}>
              <MaterialIcons name="search" size={24} color={Colors.primary} />
            </Pressable>

            {/* 购物车图标 + 徽标 */}
            <Pressable hitSlop={8} onPress={() => router.push("/cart")}>
              <MaterialIcons
                name="shopping-cart"
                size={24}
                color={Colors.primary}
              />
              {cartCount > 0 && (
                <View className="absolute -top-2 -right-2 bg-error rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                  <Text className="text-on-error text-[10px] font-bold leading-tight">
                    {cartCount > 99 ? "99+" : cartCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperClassName="gap-3 px-4"
        contentContainerClassName="gap-4 pb-8"
        showsVerticalScrollIndicator={false}
        onEndReached={() => void loadMoreProducts()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <View className="gap-4 px-4">
            <SearchBar value={search} onChangeText={setSearch} />
            <FilterChips selected={category} onSelect={setCategory} />
            {/* 排序行 — 相对定位，为下拉菜单提供锚点 */}
            <View className="flex-row justify-between items-center">
              <Text className="text-on-surface-variant text-sm">
                {filteredProducts.length} 款茶品
              </Text>
              {/* 排序按钮 */}
              <View>
                <Pressable
                  className="flex-row items-center gap-1"
                  onPress={() => setShowSortModal(!showSortModal)}
                >
                  <Text className="text-on-surface-variant text-sm">
                    排序: {sortLabel}
                  </Text>
                  <MaterialIcons
                    name={showSortModal ? "expand-less" : "expand-more"}
                    size={18}
                    color={Colors.outline}
                  />
                </Pressable>

                {/* 排序下拉菜单 */}
                {showSortModal && (
                  <View className="absolute top-8 right-0 z-10 bg-surface rounded-lg shadow-md border border-outline-variant py-1 min-w-[160px]">
                    {SORT_OPTIONS.map((option) => (
                      <Pressable
                        key={option.key}
                        className="px-4 py-2.5"
                        onPress={() => {
                          setSort(option.key);
                          setShowSortModal(false);
                        }}
                      >
                        <Text
                          className={`text-sm ${
                            sort === option.key
                              ? "text-primary font-bold"
                              : "text-on-surface"
                          }`}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          /* 空状态：无匹配茶品 */
          <View className="items-center justify-center py-20">
            <MaterialIcons name="search-off" size={48} color={Colors.outline} />
            <Text className="text-on-surface text-base font-bold mt-4">
              未找到相关茶品
            </Text>
            <Text className="text-on-surface-variant text-sm mt-1">
              试试其他分类？
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ShopProductCard
            product={item}
            onPress={() =>
              router.push({ pathname: "/product/[id]", params: { id: item.id } })
            }
          />
        )}
        ListFooterComponent={
          loading && allProducts.length > 0 ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : !hasMore && filteredProducts.length > 0 ? (
            <View className="py-4 items-center">
              <Text className="text-outline text-xs">已加载全部茶品</Text>
            </View>
          ) : null
        }
      />

      {/* 排序下拉菜单的透明遮罩 — 点击关闭 */}
      {showSortModal && (
        <Pressable
          className="absolute inset-0"
          style={{ zIndex: 5 }}
          onPress={() => setShowSortModal(false)}
        />
      )}
    </View>
  );
}

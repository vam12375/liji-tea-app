import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { TeaImage } from "@/components/ui/TeaImage";
import { Colors } from "@/constants/Colors";
import { shareContent } from "@/lib/share";
import { supabase } from "@/lib/supabase";
import { useProductStore } from "@/stores/productStore";
import { useCartStore } from "@/stores/cartStore";
import { useUserStore } from "@/stores/userStore";
import { useReviewStore } from "@/stores/reviewStore";
import TastingProfile from "@/components/product/TastingProfile";
import BrewingGuideCard from "@/components/product/BrewingGuideCard";
import ProcessTimeline from "@/components/product/ProcessTimeline";
import { ProductBottomBar } from "@/components/customer/product/ProductBottomBar";
import { ProductReviewsSummary } from "@/components/customer/product/ProductReviewsSummary";
import { useAddToCartAnimation } from "@/components/customer/product/useAddToCartAnimation";
import type { Product as DBProduct } from "@/types/database";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addItem = useCartStore((s) => s.addItem);
  // 直接订阅 items 以确保响应式更新
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  // 直接订阅 favorites 确保收藏状态实时响应
  const favorites = useUserStore((s) => s.favorites);
  const isFav = id ? favorites.includes(id) : false;

  const products = useProductStore((s) => s.products);
  const fetchProductById = useProductStore((s) => s.fetchProductById);
  const product = products.find((p) => p.id === id);
  const [bootstrapping, setBootstrapping] = useState(() => !product);
  const [notFound, setNotFound] = useState(false);
  const fetchProductReviews = useReviewStore(
    (state) => state.fetchProductReviews,
  );
  const productReviewsById = useReviewStore(
    (state) => state.productReviewsById,
  );
  const productReviews = id ? productReviewsById[id] ?? [] : [];

  const [quantity, setQuantity] = useState(1);

  // 加购复合动画集中封装到独立 hook，详情页只关心何时触发。
  const animation = useAddToCartAnimation();

  // 收藏心跳动画保留在页面内，仅影响 Hero 右上角。
  const heartScale = useRef(new Animated.Value(1)).current;

  /** 收藏切换 + 心跳动画 */
  const handleToggleFavorite = useCallback(() => {
    if (!id) return;
    toggleFavorite(id);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.5,
        useNativeDriver: true,
        damping: 6,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 8,
      }),
    ]).start();
  }, [heartScale, id, toggleFavorite]);

  const handleShare = useCallback(async () => {
    if (!product) return;

    try {
      await shareContent({
        path: `/product/${encodeURIComponent(product.id)}`,
        title: product.name,
        lines: [
          `【李记茶铺】${product.name}`,
          product.tagline,
          product.origin ? `产地：${product.origin}` : undefined,
          `价格：¥${product.price}/${product.unit}`,
        ],
      });
    } catch {
      // 用户取消分享
    }
  }, [product]);

  /** 加入购物车 + 触发飞点/抖动/Toast 复合动画。 */
  const handleAddToCart = useCallback(() => {
    if (!product || (product.stock ?? 0) === 0) return;
    addItem(product, quantity);
    animation.play();
  }, [addItem, animation, product, quantity]);

  // 实时订阅商品库存变化，确保详情页在库存更新后及时同步显示。
  useEffect(() => {
    let active = true;

    if (!id) {
      setBootstrapping(false);
      setNotFound(true);
      return () => {
        active = false;
      };
    }

    if (product) {
      setBootstrapping(false);
      setNotFound(false);
      return () => {
        active = false;
      };
    }

    setBootstrapping(true);
    void fetchProductById(id).then((result) => {
      if (!active) {
        return;
      }

      setNotFound(!result);
      setBootstrapping(false);
    });

    return () => {
      active = false;
    };
  }, [fetchProductById, id, product]);

  // 商品切换时重置数量
  useEffect(() => {
    setQuantity(1);
  }, [id]);

  // 商品详情进入后拉取评价数据，供评价摘要和预览列表使用。
  useEffect(() => {
    if (!id) return;
    void fetchProductReviews(id);
  }, [fetchProductReviews, id]);

  // 订阅当前商品的数据库更新事件，主要用于库存等字段的实时同步。
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`product-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          useProductStore.getState().updateProduct(payload.new as DBProduct);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (bootstrapping) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background">
        <MaterialIcons name="hourglass-top" size={26} color={Colors.outline} />
        <Text className="text-outline">正在加载商品信息...</Text>
      </View>
    );
  }

  if (notFound) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-outline">商品未找到</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background">
        <MaterialIcons name="hourglass-top" size={26} color={Colors.outline} />
        <Text className="text-outline">正在加载商品信息...</Text>
      </View>
    );
  }

  const stock = product.stock ?? 0;

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero 图片 */}
        <View className="h-[360px] relative">
          <TeaImage
            source={{ uri: product.image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={300}
          />
          <View className="absolute inset-0 bg-black/30" />

          {/* 顶部导航按钮 */}
          <View
            style={{ paddingTop: insets.top }}
            className="absolute top-0 left-0 right-0 flex-row justify-between items-center px-4"
          >
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => void handleShare()}
                className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center"
              >
                <MaterialIcons name="share" size={22} color="#fff" />
              </Pressable>
              <Pressable
                onPress={handleToggleFavorite}
                className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center"
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <MaterialIcons
                    name={isFav ? "favorite" : "favorite-border"}
                    size={22}
                    color={isFav ? "#ff4d6a" : "#fff"}
                  />
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </View>

        {/* 内容卡片 - 上移覆盖 */}
        <View className="bg-background rounded-t-3xl -mt-8 pt-8 px-6 pb-32 gap-8">
          {/* 基本信息 */}
          <View className="gap-2">
            <Text className="font-headline text-3xl text-on-surface font-bold">
              {product.name}
            </Text>
            <Text className="text-outline text-sm">{product.origin}</Text>
            {product.tagline && (
              <Text className="text-on-surface-variant text-sm italic mt-1">
                {"“"}
                {product.tagline}
                {"”"}
              </Text>
            )}
            <Text className="text-primary text-2xl font-bold mt-3">
              ¥{product.price}
              <Text className="text-outline text-sm font-normal">
                /{product.unit}
              </Text>
            </Text>
            {/* 库存信息 */}
            <View className="flex-row items-center gap-1.5 mt-1">
              <MaterialIcons
                name={
                  stock > 10 ? "check-circle" : stock > 0 ? "warning" : "cancel"
                }
                size={14}
                color={
                  stock > 10
                    ? Colors.primary
                    : stock > 0
                      ? "#e6a700"
                      : Colors.error
                }
              />
              <Text
                className={`text-xs ${stock > 10 ? "text-primary" : stock > 0 ? "text-[#e6a700]" : "text-error"}`}
              >
                {stock > 10
                  ? "库存充足"
                  : stock > 0
                    ? `仅剩 ${stock} 件`
                    : "已售罄"}
              </Text>
            </View>
          </View>

          {/* 数量选择器 */}
          {stock > 0 && (
            <View className="flex-row items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
              <Text className="text-on-surface text-sm font-medium">
                购买数量
              </Text>
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className={`w-8 h-8 rounded-lg bg-surface-container-high items-center justify-center ${quantity <= 1 ? "opacity-40" : "active:opacity-70"}`}
                >
                  <MaterialIcons
                    name="remove"
                    size={18}
                    color={Colors.onSurface}
                  />
                </Pressable>
                <Text className="text-on-surface text-base font-bold min-w-[28px] text-center">
                  {quantity}
                </Text>
                <Pressable
                  onPress={() =>
                    setQuantity((q) => Math.min(stock, q + 1))
                  }
                  disabled={quantity >= stock}
                  className={`w-8 h-8 rounded-lg bg-surface-container-high items-center justify-center ${quantity >= stock ? "opacity-40" : "active:opacity-70"}`}
                >
                  <MaterialIcons
                    name="add"
                    size={18}
                    color={Colors.onSurface}
                  />
                </Pressable>
              </View>
            </View>
          )}

          {/* 风味赏析 */}
          {product.tastingProfile && (
            <TastingProfile items={product.tastingProfile} />
          )}

          {/* 冲泡指南 */}
          {product.brewingGuide && (
            <BrewingGuideCard guide={product.brewingGuide} />
          )}

          {/* 产地故事 */}
          {product.originStory && (
            <View className="gap-3">
              <Text className="font-headline text-lg text-on-surface">
                产地故事
              </Text>
              <View className="rounded-2xl overflow-hidden aspect-[16/10]">
                <TeaImage
                  source={{ uri: product.image }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={300}
                />
              </View>
              <Text className="text-on-surface-variant text-sm leading-relaxed">
                {product.originStory}
              </Text>
            </View>
          )}

          {/* 制作工艺 */}
          {product.process && <ProcessTimeline steps={product.process} />}

          {/* 用户评价概览 */}
          {id ? (
            <ProductReviewsSummary
              productId={id}
              productReviews={productReviews}
            />
          ) : null}
        </View>
      </ScrollView>

      <ProductBottomBar
        productId={product.id}
        quantity={quantity}
        cartCount={cartCount}
        stock={stock}
        onAddToCart={handleAddToCart}
        animation={animation}
      />
    </View>
  );
}

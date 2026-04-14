import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { routes } from "@/lib/routes";
import { shareContent } from "@/lib/share";
import { supabase } from "@/lib/supabase";
import { useProductStore } from "@/stores/productStore";

import { useCartStore } from "@/stores/cartStore";
import { useUserStore } from "@/stores/userStore";
import { useReviewStore } from "@/stores/reviewStore";
import TastingProfile from "@/components/product/TastingProfile";
import BrewingGuideCard from "@/components/product/BrewingGuideCard";
import ProcessTimeline from "@/components/product/ProcessTimeline";
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
  const fetchProductReviews = useReviewStore((state) => state.fetchProductReviews);
  const productReviewsById = useReviewStore((state) => state.productReviewsById);
  const productReviews = useMemo(() => (id ? productReviewsById[id] ?? [] : []), [id, productReviewsById]);
  const reviewSummary = useMemo(
    () => ({
      total: productReviews.length,
      averageRating:
        productReviews.length > 0
          ? productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length
          : 0,
      positiveRate:
        productReviews.length > 0
          ? productReviews.filter((review) => review.rating >= 4).length / productReviews.length
          : 0,
      tags: [] as { label: string; count: number }[],
    }),
    [productReviews],
  );
  const previewReviews = useMemo(() => productReviews.slice(0, 3), [productReviews]);

  // ====== 数量选择器状态 ======
  const [quantity, setQuantity] = useState(1);

  // ====== 加购反馈动画状态：控制成功提示与飞点显示 ======
  const [showToast, setShowToast] = useState(false);
  const [showDot, setShowDot] = useState(false);

  // 动画值：分别驱动 Toast、购物车抖动、角标弹跳与飞点轨迹
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(20)).current;
  const toastScale = useRef(new Animated.Value(0.8)).current;
  const cartShake = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const dotTranslateY = useRef(new Animated.Value(0)).current;
  const dotTranslateX = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  // 收藏心跳动画
  const heartScale = useRef(new Animated.Value(1)).current;

  /** 收藏切换 + 心跳动画 */
  const handleToggleFavorite = useCallback(() => {
    if (!id) return;
    toggleFavorite(id);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.5, useNativeDriver: true, damping: 6 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, damping: 8 }),
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

  /** 加入购物车 + 动画编排 */
  const handleAddToCart = useCallback(() => {

    if (!product || (product.stock ?? 0) === 0) return;
    addItem(product, quantity);

    // 1. 显示打钩 Toast
    setShowToast(true);
    toastOpacity.setValue(0);
    toastTranslateY.setValue(20);
    toastScale.setValue(0.8);
    checkScale.setValue(0);

    Animated.parallel([
      Animated.spring(toastOpacity, { toValue: 1, useNativeDriver: true }),
      Animated.spring(toastTranslateY, { toValue: 0, useNativeDriver: true, damping: 12 }),
      Animated.spring(toastScale, { toValue: 1, useNativeDriver: true, damping: 10 }),
    ]).start();

    // 打钩弹出
    setTimeout(() => {
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, damping: 8 }).start();
    }, 150);

    // 2. 飞入红点动画（延迟 300ms）
    setTimeout(() => {
      setShowDot(true);
      dotOpacity.setValue(1);
      dotScale.setValue(1);
      dotTranslateY.setValue(0);
      dotTranslateX.setValue(0);

      Animated.parallel([
        // 红点飞向左侧购物车（向左移动、向下移动）
        Animated.timing(dotTranslateX, {
          toValue: -100,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(dotTranslateY, {
          toValue: 20,
          duration: 450,
          useNativeDriver: true,
        }),
        // 缩小消失
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(dotScale, {
            toValue: 0.3,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
        // 淡出
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(dotOpacity, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => setShowDot(false));
    }, 300);

    // 3. 购物车图标抖动（延迟 700ms，红点到达时触发）
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(cartShake, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: 3, duration: 40, useNativeDriver: true }),
        Animated.timing(cartShake, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();

      // Badge 弹跳
      Animated.sequence([
        Animated.spring(badgeScale, { toValue: 1.4, useNativeDriver: true, damping: 6 }),
        Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, damping: 8 }),
      ]).start();
    }, 700);

    // 4. Toast 自动消失
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(toastTranslateY, { toValue: -10, duration: 250, useNativeDriver: true }),
      ]).start(() => setShowToast(false));
    }, 1800);
  }, [
    addItem,
    badgeScale,
    cartShake,
    checkScale,
    dotOpacity,
    dotScale,
    dotTranslateX,
    dotTranslateY,
    product,
    quantity,
    toastOpacity,
    toastScale,
    toastTranslateY,
  ]);

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
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${id}` },
        (payload) => {
          useProductStore.getState().updateProduct(payload.new as DBProduct);
        }
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

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero 图片 */}
        <View className="h-[360px] relative">
          <Image
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
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
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
                name={(product.stock ?? 0) > 10 ? "check-circle" : (product.stock ?? 0) > 0 ? "warning" : "cancel"}
                size={14}
                color={(product.stock ?? 0) > 10 ? Colors.primary : (product.stock ?? 0) > 0 ? "#e6a700" : Colors.error}
              />
              <Text className={`text-xs ${(product.stock ?? 0) > 10 ? "text-primary" : (product.stock ?? 0) > 0 ? "text-[#e6a700]" : "text-error"}`}>
                {(product.stock ?? 0) > 10 ? "库存充足" : (product.stock ?? 0) > 0 ? `仅剩 ${product.stock} 件` : "已售罄"}
              </Text>
            </View>
          </View>

          {/* 数量选择器 */}
          {(product.stock ?? 0) > 0 && (
            <View className="flex-row items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
              <Text className="text-on-surface text-sm font-medium">购买数量</Text>
              <View className="flex-row items-center gap-3">
                {/* 减少按钮 */}
                <Pressable
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className={`w-8 h-8 rounded-lg bg-surface-container-high items-center justify-center ${quantity <= 1 ? "opacity-40" : "active:opacity-70"}`}
                >
                  <MaterialIcons name="remove" size={18} color={Colors.onSurface} />
                </Pressable>
                {/* 当前数量 */}
                <Text className="text-on-surface text-base font-bold min-w-[28px] text-center">
                  {quantity}
                </Text>
                {/* 增加按钮 */}
                <Pressable
                  onPress={() => setQuantity((q) => Math.min(product.stock ?? 99, q + 1))}
                  disabled={quantity >= (product.stock ?? 99)}
                  className={`w-8 h-8 rounded-lg bg-surface-container-high items-center justify-center ${quantity >= (product.stock ?? 99) ? "opacity-40" : "active:opacity-70"}`}
                >
                  <MaterialIcons name="add" size={18} color={Colors.onSurface} />
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
              {/* 产地配图 */}
              <View className="rounded-2xl overflow-hidden aspect-[16/10]">
                <Image
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

          {/* 用户评价概览：展示评分摘要、标签统计与前几条评价预览 */}
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <View className="gap-1">
                <Text className="font-headline text-lg text-on-surface font-bold">
                  茶友评价
                </Text>
                <Text className="text-on-surface-variant text-xs">
                  {reviewSummary.total > 0
                    ? `综合评分 ${reviewSummary.averageRating} · 好评率 ${reviewSummary.positiveRate}%`
                    : "还没有茶友评价，期待你的第一条反馈"}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => router.push(routes.productReviews(product.id))}
                  className="px-3 py-2 rounded-full bg-surface-container-low active:opacity-70"
                >
                  <Text className="text-primary text-xs font-medium">查看全部</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(routes.myReviews)}
                  className="px-3 py-2 rounded-full bg-surface-container-low active:opacity-70"
                >
                  <Text className="text-primary text-xs font-medium">去评价</Text>
                </Pressable>
              </View>
            </View>

            {reviewSummary.tags.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {reviewSummary.tags.map((tag) => (
                  <View
                    key={tag.label}
                    className="px-3 py-1 rounded-full bg-primary-container/20"
                  >
                    <Text className="text-primary text-xs">
                      {tag.label} · {tag.count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {previewReviews.length > 0 ? (
              <View className="gap-3">
                {previewReviews.map((review) => (
                  <View
                    key={review.id}
                    className="rounded-2xl bg-surface-container-low p-4 gap-2"
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-on-surface text-sm font-medium">
                        {review.is_anonymous
                          ? "匿名茶友"
                          : review.user?.name ?? "茶友"}
                      </Text>
                      <Text className="text-primary text-sm">
                        {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                      </Text>
                    </View>
                    {review.tags.length > 0 ? (
                      <View className="flex-row flex-wrap gap-2">
                        {review.tags.map((tag) => (
                          <View
                            key={`${review.id}-${tag}`}
                            className="px-2.5 py-1 rounded-full bg-background"
                          >
                            <Text className="text-on-surface-variant text-[11px]">
                              {tag}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Text className="text-on-surface-variant text-sm leading-6">
                      {review.content?.trim() || "这位茶友暂未填写文字评价。"}
                    </Text>
                    <Text className="text-outline text-[11px]">
                      {new Date(review.created_at).toLocaleDateString("zh-CN")}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="rounded-2xl bg-surface-container-low p-5 items-center gap-2">
                <MaterialIcons
                  name="rate-review"
                  size={24}
                  color={Colors.outline}
                />
                <Text className="text-on-surface-variant text-sm text-center">
                  暂无评价，购买后可前往“我的评价”提交晒单与口感反馈。
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ====== 加购成功 Toast ====== */}
      {showToast && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: 100 + (insets.bottom || 16),
            alignSelf: "center",
            opacity: toastOpacity,
            transform: [
              { translateY: toastTranslateY },
              { scale: toastScale },
            ],
          }}
          className="bg-on-surface/85 rounded-2xl px-6 py-3 flex-row items-center gap-3"
          pointerEvents="none"
        >
          {/* 打钩圆圈 */}
          <Animated.View
            style={{ transform: [{ scale: checkScale }] }}
            className="w-7 h-7 rounded-full bg-primary items-center justify-center"
          >
            <MaterialIcons name="check" size={18} color="#fff" />
          </Animated.View>
          <Text className="text-surface-bright text-sm font-medium">
            已加入购物车
          </Text>
        </Animated.View>
      )}

      {/* ====== 飞入红点 ====== */}
      {showDot && (
        <Animated.View
          style={{
            position: "absolute",
            bottom: 36 + (insets.bottom || 16),
            right: "38%",
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: Colors.error,
            opacity: dotOpacity,
            transform: [
              { translateX: dotTranslateX },
              { translateY: dotTranslateY },
              { scale: dotScale },
            ],
          }}
          pointerEvents="none"
        />
      )}

      {/* 底部操作栏 */}
      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3 flex-row items-center gap-3"
      >
        {/* 购物车图标（带抖动动画） */}
        <Animated.View style={{ transform: [{ translateX: cartShake }] }}>
          <Pressable
            onPress={() => router.push(routes.cart)}
            className="w-12 h-12 rounded-full border border-outline-variant items-center justify-center relative"
          >
            <MaterialIcons name="shopping-cart" size={22} color={Colors.primary} />
            {cartCount > 0 && (
              <Animated.View
                style={{ transform: [{ scale: badgeScale }] }}
                className="absolute -top-1 -right-1 bg-error w-5 h-5 rounded-full items-center justify-center"
              >
                <Text className="text-on-error text-[10px] font-bold">
                  {cartCount > 99 ? "99+" : cartCount}
                </Text>
              </Animated.View>
            )}
          </Pressable>
        </Animated.View>

        {/* 加入购物车 */}
        <Pressable
          onPress={handleAddToCart}
          className={`flex-1 bg-surface-container-high h-12 rounded-full items-center justify-center active:bg-surface-container-highest ${(product.stock ?? 0) === 0 ? "opacity-50" : ""}`}
        >
          <Text className="text-on-surface font-medium">加入购物车</Text>
        </Pressable>

        {/* 立即购买 */}
        <Pressable
          onPress={() => {
            if ((product.stock ?? 0) === 0) return;
            router.push(routes.checkout(id, quantity));
          }}
          className={`flex-1 bg-primary-container h-12 rounded-full items-center justify-center active:bg-primary ${(product.stock ?? 0) === 0 ? "opacity-50" : ""}`}
        >
          <Text className="text-on-primary font-medium">立即购买</Text>
        </Pressable>
      </View>
    </View>
  );
}
